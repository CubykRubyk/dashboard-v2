import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { canManageSav, canViewSav } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/geo/geocode";
import {
  HISTORY_TYPE_TO_DB,
  PRIORITY_TO_DB,
  STATUS_TO_DB,
  serializeSavTicket,
} from "@/lib/sav/mappers";

const TICKET_INCLUDE = { team: true, history: { include: { author: true }, orderBy: { createdAt: "desc" as const } } };

const fieldsSchema = z
  .object({
    title: z.string().min(1),
    company: z.string().min(1),
    contact: z.string().min(1),
    phone: z.string().max(40),
    address: z.string().max(300),
    equipment: z.string().max(200),
    description: z.string().max(2000),
    priority: z.enum(["Basse", "Normale", "Haute", "Urgente"]),
    status: z.enum(["Ouvert", "Clôturé"]),
    teamId: z.string().nullable(),
    desiredDate: z.string().nullable(),
    closedAt: z.string().nullable(),
    closureReason: z.string().max(120).nullable(),
    closureNote: z.string().max(2000).nullable(),
    planningDate: z.string().nullable(),
    planningStartTime: z.string().max(8).nullable(),
    planningEndTime: z.string().max(8).nullable(),
    planningNote: z.string().max(2000).nullable(),
  })
  .partial();

const historySchema = z.object({
  type: z.enum(["note", "status", "priority", "closure", "planning"]),
  text: z.string().min(1),
  detail: z.string().max(2000).optional(),
});

const updateSchema = z.object({
  fields: fieldsSchema.optional(),
  history: historySchema.optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user || !canViewSav(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await params;

  const ticket = await prisma.savTicket.findUnique({ where: { id }, include: TICKET_INCLUDE });
  if (!ticket) {
    return NextResponse.json({ error: "Bilet introuvable." }, { status: 404 });
  }
  return NextResponse.json({ ticket: serializeSavTicket(ticket) });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user || !canManageSav(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.savTicket.findUnique({ where: { id }, select: { id: true, address: true } });
  if (!existing) {
    return NextResponse.json({ error: "Bilet introuvable." }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Le contenu JSON n'est pas valide." }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }
  const { fields, history } = parsed.data;
  if (!fields && !history) {
    return NextResponse.json({ error: "Aucune modification fournie." }, { status: 400 });
  }

  const {
    priority,
    status,
    desiredDate,
    closedAt,
    planningDate,
    teamId,
    ...restFields
  } = fields ?? {};
  const geocoded =
    restFields.address !== undefined && restFields.address !== existing.address
      ? await geocodeAddress(restFields.address)
      : null;

  await prisma.$transaction([
    prisma.savTicket.update({
      where: { id },
      data: {
        ...restFields,
        ...(priority !== undefined ? { priority: PRIORITY_TO_DB[priority] } : {}),
        ...(status !== undefined ? { status: STATUS_TO_DB[status] } : {}),
        ...(teamId !== undefined ? { teamId } : {}),
        ...(desiredDate !== undefined ? { desiredDate: desiredDate ? new Date(desiredDate) : null } : {}),
        ...(closedAt !== undefined ? { closedAt: closedAt ? new Date(closedAt) : null } : {}),
        ...(planningDate !== undefined ? { planningDate: planningDate ? new Date(planningDate) : null } : {}),
        ...(geocoded ? { latitude: geocoded.latitude, longitude: geocoded.longitude } : {}),
      },
    }),
    ...(history
      ? [
          prisma.savHistoryEntry.create({
            data: {
              savTicketId: id,
              type: HISTORY_TYPE_TO_DB[history.type],
              text: history.text,
              detail: history.detail,
              authorId: user.id,
            },
          }),
        ]
      : []),
  ]);

  const refreshed = await prisma.savTicket.findUnique({ where: { id }, include: TICKET_INCLUDE });
  if (!refreshed) {
    return NextResponse.json({ error: "Bilet introuvable." }, { status: 404 });
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "SAV_TICKET_UPDATE",
      entityType: "SavTicket",
      entityId: id,
      metadata: { fields: fields ?? {}, historyType: history?.type ?? null },
    },
  });

  return NextResponse.json({ ticket: serializeSavTicket(refreshed) });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user || !canManageSav(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.savTicket.findUnique({ where: { id }, select: { reference: true } });
  if (!existing) {
    return NextResponse.json({ error: "Bilet introuvable." }, { status: 404 });
  }

  await prisma.savTicket.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "SAV_TICKET_DELETE",
      entityType: "SavTicket",
      entityId: id,
      metadata: { reference: existing.reference },
    },
  });
  return NextResponse.json({ success: true });
}

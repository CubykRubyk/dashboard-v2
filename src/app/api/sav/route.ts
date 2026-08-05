import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { canManageSav, canViewSav } from "@/lib/auth/permissions";
import { notifyAdmins } from "@/lib/notifications/create";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/geo/geocode";
import { PRIORITY_TO_DB, serializeSavTicket, type SavTicketWithRelations } from "@/lib/sav/mappers";

const bodySchema = z.object({
  title: z.string().min(1),
  company: z.string().min(1),
  contact: z.string().min(1),
  phone: z.string().max(40).optional(),
  address: z.string().max(300).optional(),
  equipment: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  priority: z.enum(["Basse", "Normale", "Haute", "Urgente"]).optional(),
});

const TICKET_INCLUDE = { team: true, history: { include: { author: true }, orderBy: { createdAt: "desc" as const } } };

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || !canViewSav(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() || undefined;
  const status = params.get("status") || undefined;
  const priority = params.get("priority") || undefined;
  const teamId = params.get("teamId") || undefined;
  const company = params.get("company") || undefined;
  const insensitive = q ? { contains: q, mode: "insensitive" as const } : undefined;

  const tickets = await prisma.savTicket.findMany({
    where: {
      ...(insensitive
        ? {
            OR: [
              { reference: insensitive },
              { company: insensitive },
              { contact: insensitive },
              { address: insensitive },
              { title: insensitive },
            ],
          }
        : {}),
      ...(status ? { status: status as "OUVERT" | "CLOTURE" } : {}),
      ...(priority ? { priority: priority as "BASSE" | "NORMALE" | "HAUTE" | "URGENTE" } : {}),
      ...(teamId ? { teamId } : {}),
      ...(company ? { company } : {}),
    },
    include: TICKET_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ tickets: tickets.map(serializeSavTicket) });
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user || !canManageSav(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Le contenu JSON n'est pas valide." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }
  const { title, company, contact, phone, address, equipment, description, priority } = parsed.data;
  const geocoded = address ? await geocodeAddress(address) : null;

  const count = await prisma.savTicket.count();
  let ticket: SavTicketWithRelations | undefined;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = `SAV-${2700 + count + 1 + attempt}`;
    try {
      ticket = await prisma.savTicket.create({
        data: {
          reference,
          title,
          company,
          contact,
          phone: phone ?? "",
          address: address ?? "",
          equipment: equipment ?? "",
          description: description ?? "",
          priority: priority ? PRIORITY_TO_DB[priority] : "NORMALE",
          latitude: geocoded?.latitude,
          longitude: geocoded?.longitude,
          createdById: user.id,
          history: {
            create: {
              type: "STATUS",
              text: "Bilet créé",
              authorId: user.id,
            },
          },
        },
        include: TICKET_INCLUDE,
      });
      break;
    } catch (error) {
      const isUniqueConflict =
        typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
      if (!isUniqueConflict) throw error;
    }
  }
  if (!ticket) {
    return NextResponse.json({ error: "Impossible de générer une référence unique." }, { status: 500 });
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "SAV_TICKET_CREATE",
      entityType: "SavTicket",
      entityId: ticket.id,
      metadata: { reference: ticket.reference, company: ticket.company },
    },
  });

  // Les administrateurs sont prévenus de tout nouveau SAV, quelle qu'en soit l'origine (ici la
  // saisie interne, côté formulaire public c'est `api/sav-request`). L'auteur n'a pas besoin de
  // se notifier lui-même.
  await notifyAdmins({
    type: "SAV_CREATED",
    title: `Nouveau SAV — ${ticket.company}`,
    body: `${ticket.reference} · ${ticket.title}`,
    entityType: "SavTicket",
    entityId: ticket.id,
  });

  return NextResponse.json({ ticket: serializeSavTicket(ticket) }, { status: 201 });
}

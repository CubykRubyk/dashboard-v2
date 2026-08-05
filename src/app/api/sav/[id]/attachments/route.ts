import { NextRequest, NextResponse } from "next/server";

import { canManageSav, canViewSav } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { DocumentError } from "@/lib/documents/errors";
import { prisma } from "@/lib/prisma";
import {
  MAX_ATTACHMENTS_PER_TICKET,
  removeAttachment,
  writeAttachment,
} from "@/lib/sav/attachment-storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user || !canViewSav(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await params;

  const attachments = await prisma.savAttachment.findMany({
    where: { savTicketId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      originalFileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
    },
  });
  return NextResponse.json({
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      originalFileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      createdAt: attachment.createdAt.toISOString(),
      // `null` = pièce déposée par le client via le formulaire public.
      uploadedBy: attachment.uploadedBy?.name ?? null,
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user || !canManageSav(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await params;

  const ticket = await prisma.savTicket.findUnique({ where: { id }, select: { id: true } });
  if (!ticket) return NextResponse.json({ error: "Bilet introuvable." }, { status: 404 });

  const existing = await prisma.savAttachment.count({ where: { savTicketId: id } });
  if (existing >= MAX_ATTACHMENTS_PER_TICKET) {
    return NextResponse.json(
      { error: `${MAX_ATTACHMENTS_PER_TICKET} pièces jointes maximum par bilet.` },
      { status: 409 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }

  let stored;
  try {
    stored = await writeAttachment(file);
  } catch (error) {
    if (error instanceof DocumentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  // Fichier déjà sur disque : si l'écriture en base échoue, on le supprime pour ne pas laisser
  // d'orphelin (même compensation que pour les photos de fiche).
  try {
    const attachment = await prisma.savAttachment.create({
      data: {
        savTicketId: id,
        storageName: stored.storageName,
        originalFileName: stored.originalFileName,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        checksumSha256: stored.checksumSha256,
        uploadedById: user.id,
      },
      select: { id: true, originalFileName: true, mimeType: true, sizeBytes: true },
    });
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    await removeAttachment(stored.storageName);
    throw error;
  }
}

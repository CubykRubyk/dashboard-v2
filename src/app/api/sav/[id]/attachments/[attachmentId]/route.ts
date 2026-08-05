import { NextRequest, NextResponse } from "next/server";

import { canManageSav, canViewSav } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { DocumentError } from "@/lib/documents/errors";
import { prisma } from "@/lib/prisma";
import { readAttachment, removeAttachment } from "@/lib/sav/attachment-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const user = await getSession();
  if (!user || !canViewSav(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id, attachmentId } = await params;

  const attachment = await prisma.savAttachment.findFirst({
    where: { id: attachmentId, savTicketId: id },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Pièce jointe introuvable." }, { status: 404 });
  }

  try {
    const content = await readAttachment(attachment.storageName);
    const download = request.nextUrl.searchParams.get("download") === "1";
    const safeName = attachment.originalFileName.replace(/[^a-zA-Z0-9 ._-]/g, "").trim() || "piece";
    return new NextResponse(new Uint8Array(content), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(content.byteLength),
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(safeName)}"`,
      },
    });
  } catch (error) {
    if (error instanceof DocumentError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const user = await getSession();
  if (!user || !canManageSav(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id, attachmentId } = await params;

  const attachment = await prisma.savAttachment.findFirst({
    where: { id: attachmentId, savTicketId: id },
    select: { id: true, storageName: true, originalFileName: true },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Pièce jointe introuvable." }, { status: 404 });
  }

  await prisma.savAttachment.delete({ where: { id: attachment.id } });
  await removeAttachment(attachment.storageName);
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "SAV_ATTACHMENT_DELETE",
      entityType: "SavTicket",
      entityId: id,
      metadata: { fileName: attachment.originalFileName },
    },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}

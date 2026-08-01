import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dolibarrRequest, getDolibarrConfig } from "@/lib/dolibarr/client";
import { prisma } from "@/lib/prisma";
import { finalizationErrors } from "@/lib/worksheets/validation";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { id } = await params;
  const workSheet = await prisma.workSheet.findFirst({
    where: { id, archivedAt: null },
    include: { installations: true, items: true, tags: true },
  });
  if (!workSheet) {
    return NextResponse.json({ error: "Fiche chantier introuvable." }, { status: 404 });
  }
  const validation = finalizationErrors(workSheet);
  if (validation.length) {
    return NextResponse.json(
      { error: `Fiche incomplète : ${validation.join(" ")}`, errors: validation },
      { status: 422 },
    );
  }
  const eventId = workSheet.eventId!;
  const config = await getDolibarrConfig();
  if (!config) {
    return NextResponse.json({ error: "Configurez d’abord Dolibarr dans Paramètres." }, { status: 409 });
  }

  try {
    const path = `/agendaevents/${encodeURIComponent(eventId)}`;
    const event = await dolibarrRequest<{ note_private?: string; note?: string }>(config, path);
    const currentNote = String(event.note_private || event.note || "").trim();
    const startMarker = `<!-- DAMASCHIN-FICHE:${workSheet.id}:START -->`;
    const endMarker = `<!-- DAMASCHIN-FICHE:${workSheet.id}:END -->`;
    const reportHtml = escapeHtml(workSheet.reportText).replace(/\r?\n/g, "<br/>");
    const section = [
      startMarker,
      "<strong>--- Rapport fiche chantier ---</strong><br/><br/>",
      reportHtml,
      endMarker,
    ].join("");
    const existingSection = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);
    const note = existingSection.test(currentNote)
      ? currentNote.replace(existingSection, section)
      : [currentNote, section].filter(Boolean).join("<br/><br/>");

    await dolibarrRequest(config, path, {
      method: "PUT",
      body: { note_private: note },
    });
    const sentAt = new Date();
    await prisma.$transaction([
      prisma.workSheet.update({
        where: { id: workSheet.id },
        data: {
          status: "SENT",
          dolibarrSentAt: sentAt,
          dolibarrLastError: null,
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "WORKSHEET_DOLIBARR_SEND",
          entityType: "WorkSheet",
          entityId: workSheet.id,
          metadata: { eventId },
        },
      }),
    ]);
    return NextResponse.json({
      ok: true,
      sentAt: sentAt.toISOString(),
      message: "Rapport envoyé vers Dolibarr.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Envoi Dolibarr impossible.";
    await prisma.$transaction([
      prisma.workSheet.update({
        where: { id: workSheet.id },
        data: { dolibarrLastError: message.slice(0, 1_000) },
      }),
      prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "WORKSHEET_DOLIBARR_ERROR",
          entityType: "WorkSheet",
          entityId: workSheet.id,
          metadata: { eventId, error: message.slice(0, 500) },
        },
      }),
    ]);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

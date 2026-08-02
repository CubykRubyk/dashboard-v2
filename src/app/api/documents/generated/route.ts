import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { canGenerateDocuments } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { fillDocumentTemplate } from "@/lib/documents/pdf-fill";
import {
  documentTemplateStorageRoot,
  generatedDocumentStorageRoot,
  readDocumentFile,
  writeGeneratedPdf,
} from "@/lib/documents/storage";
import { DocumentError } from "@/lib/documents/errors";
import type { TemplateFieldConfig } from "@/lib/documents/types";

const bodySchema = z.object({
  eventId: z.string().max(80).optional(),
  clientLabel: z.string().max(160).optional(),
  templateId: z.string().min(1),
  issuerId: z.string().min(1).optional(),
  dynamicFields: z.record(z.string(), z.string()),
  enabledFields: z.array(z.string()),
});

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() || undefined;
  const templateId = params.get("templateId") || undefined;
  const eventId = params.get("eventId") || undefined;

  const documents = await prisma.generatedDocument.findMany({
    where: {
      ...(q ? { clientLabel: { contains: q, mode: "insensitive" } } : {}),
      ...(templateId ? { templateId } : {}),
      ...(eventId ? { eventId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      template: { select: { id: true, name: true } },
      issuer: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ documents });
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user || !canGenerateDocuments(user.role)) {
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
  const { eventId, clientLabel, templateId, issuerId, dynamicFields, enabledFields } = parsed.data;

  const [template, issuer] = await Promise.all([
    prisma.documentTemplate.findUnique({ where: { id: templateId } }),
    issuerId ? prisma.documentIssuer.findUnique({ where: { id: issuerId } }) : Promise.resolve(null),
  ]);
  if (!template) return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
  if (issuerId && !issuer) return NextResponse.json({ error: "Émetteur introuvable." }, { status: 404 });

  const fields = (template.fields as unknown as TemplateFieldConfig[]) ?? [];

  try {
    const templateBytes = await readDocumentFile(template.storageName, documentTemplateStorageRoot());
    const pdfBytes = await fillDocumentTemplate(templateBytes, {
      dynamicFields,
      enabledFields,
      fields,
      signatureImageBase64: issuer?.signatureData || undefined,
      stampImageBase64: issuer?.stampData || undefined,
    });
    const written = await writeGeneratedPdf(pdfBytes, generatedDocumentStorageRoot());

    const document = await prisma.generatedDocument.create({
      data: {
        eventId: eventId ?? "",
        clientLabel: clientLabel ?? "",
        templateId,
        issuerId: issuerId ?? null,
        storageName: written.storageName,
        dynamicFields,
        enabledFields,
        generatedById: user.id,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "GENERATED_DOCUMENT_CREATE",
        entityType: "GeneratedDocument",
        entityId: document.id,
        metadata: { templateName: template.name, clientLabel: clientLabel ?? "", eventId: eventId ?? "" },
      },
    });

    const safeTemplateName = template.name.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "document";
    const safeClient = (clientLabel ?? "").replace(/[^a-zA-Z0-9 _-]/g, "").trim();
    const fileName = `${safeTemplateName}${safeClient ? ` - ${safeClient}` : ""}.pdf`;

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "X-Document-Id": document.id,
      },
    });
  } catch (error) {
    if (error instanceof DocumentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

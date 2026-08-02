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
  removeDocumentFile,
  writeGeneratedPdf,
} from "@/lib/documents/storage";
import { DocumentError } from "@/lib/documents/errors";
import type { TemplateFieldConfig } from "@/lib/documents/types";

const updateSchema = z.object({
  dynamicFields: z.record(z.string(), z.string()).optional(),
  enabledFields: z.array(z.string()).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user || !canGenerateDocuments(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.generatedDocument.findUnique({
    where: { id },
    include: { template: true, issuer: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  let payload: unknown = {};
  try {
    const text = await request.text();
    payload = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: "Le contenu JSON n'est pas valide." }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  const dynamicFields = parsed.data.dynamicFields ?? (existing.dynamicFields as Record<string, string>);
  const enabledFields = parsed.data.enabledFields ?? (existing.enabledFields as string[]);
  const fields = Array.isArray(existing.template.fields)
    ? (existing.template.fields as unknown as TemplateFieldConfig[])
    : [];

  try {
    const templateBytes = await readDocumentFile(
      existing.template.storageName,
      documentTemplateStorageRoot(),
    );
    const pdfBytes = await fillDocumentTemplate(templateBytes, {
      dynamicFields,
      enabledFields,
      fields,
      signatureImageBase64: existing.issuer?.signatureData || undefined,
      stampImageBase64: existing.issuer?.stampData || undefined,
    });
    const written = await writeGeneratedPdf(pdfBytes, generatedDocumentStorageRoot());

    const updated = await prisma.generatedDocument.update({
      where: { id },
      data: {
        storageName: written.storageName,
        dynamicFields,
        enabledFields,
      },
    });
    await removeDocumentFile(existing.storageName, generatedDocumentStorageRoot());
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "GENERATED_DOCUMENT_REGENERATE",
        entityType: "GeneratedDocument",
        entityId: updated.id,
        metadata: { templateName: existing.template.name },
      },
    });

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="document-${updated.id}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof DocumentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user || !canGenerateDocuments(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.generatedDocument.findUnique({
    where: { id },
    include: { template: { select: { name: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  await prisma.generatedDocument.delete({ where: { id } });
  await removeDocumentFile(existing.storageName, generatedDocumentStorageRoot());
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "GENERATED_DOCUMENT_DELETE",
      entityType: "GeneratedDocument",
      entityId: id,
      metadata: { templateName: existing.template.name },
    },
  });
  return NextResponse.json({ success: true });
}

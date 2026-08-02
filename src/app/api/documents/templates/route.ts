import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth/session";
import { canManageDocumentTemplates } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { detectTemplateFields } from "@/lib/documents/pdf-fill";
import { documentTemplateStorageRoot, writeValidatedPdf } from "@/lib/documents/storage";
import { DocumentError } from "@/lib/documents/errors";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const templates = await prisma.documentTemplate.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { generatedDocuments: true } } },
  });
  return NextResponse.json({
    templates: templates.map((template) => ({
      ...template,
      fieldCount: Array.isArray(template.fields) ? template.fields.length : 0,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user || !canManageDocumentTemplates(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });
  }

  const name = formData.get("name");
  const file = formData.get("file");
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Le nom du modèle est requis." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Sélectionnez un fichier PDF." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const written = await writeValidatedPdf(file, documentTemplateStorageRoot());
    const fields = await detectTemplateFields(buffer);

    const template = await prisma.documentTemplate.create({
      data: {
        name: name.trim(),
        storageName: written.storageName,
        originalFileName: written.originalFileName,
        checksumSha256: written.checksumSha256,
        sizeBytes: written.sizeBytes,
        fields: fields as unknown as Prisma.InputJsonValue,
        createdById: user.id,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "DOCUMENT_TEMPLATE_CREATE",
        entityType: "DocumentTemplate",
        entityId: template.id,
        metadata: { name: template.name },
      },
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    if (error instanceof DocumentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

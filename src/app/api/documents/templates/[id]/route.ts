import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { canManageDocumentTemplates } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { documentTemplateStorageRoot, removeDocumentFile } from "@/lib/documents/storage";

const templateFieldSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["text", "checkbox"]),
  label: z.string().min(1),
  section: z.string().min(1),
  position: z.number(),
  enabled: z.boolean(),
  autofillKey: z
    .enum([
      "client",
      "company",
      "address",
      "workDate",
      "installer",
      "issuerResponsible",
      "issuerAttestationNumber",
      "issuerLeakDetectorId",
      "issuerLeakDetectorDate",
      "signature",
      "stamp",
    ])
    .optional()
    .catch(undefined),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
  fields: z.array(templateFieldSchema).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { id } = await params;

  const template = await prisma.documentTemplate.findUnique({ where: { id } });
  if (!template) {
    return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
  }
  return NextResponse.json({ template });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user || !canManageDocumentTemplates(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.documentTemplate.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
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

  const template = await prisma.documentTemplate.update({
    where: { id },
    data: parsed.data,
  });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "DOCUMENT_TEMPLATE_UPDATE",
      entityType: "DocumentTemplate",
      entityId: template.id,
      metadata: { name: template.name },
    },
  });
  return NextResponse.json({ template });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user || !canManageDocumentTemplates(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await params;

  const template = await prisma.documentTemplate.findUnique({ where: { id } });
  if (!template) {
    return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
  }
  const usageCount = await prisma.generatedDocument.count({ where: { templateId: id } });
  if (usageCount > 0) {
    return NextResponse.json(
      { error: "Ce modèle a déjà été utilisé pour générer des documents et ne peut pas être supprimé." },
      { status: 409 },
    );
  }

  await prisma.documentTemplate.delete({ where: { id } });
  await removeDocumentFile(template.storageName, documentTemplateStorageRoot());
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "DOCUMENT_TEMPLATE_DELETE",
      entityType: "DocumentTemplate",
      entityId: id,
      metadata: { name: template.name },
    },
  });
  return NextResponse.json({ success: true });
}

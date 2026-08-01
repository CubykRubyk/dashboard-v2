"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { requireTechnicalCatalogAdmin } from "@/lib/auth/authorization";

const tagSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const issuerSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(160),
  address: z.string().trim().max(500),
  phone: z.string().trim().max(80),
  email: z.string().trim().email("L’email n’est pas valide.").or(z.literal("")),
  defaultResponsible: z.string().trim().max(160),
  refrigerantAttestationNumber: z.string().trim().max(160),
});

async function requireAdmin() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("Accès non autorisé.");
  return user;
}

export async function createTag(formData: FormData) {
  const user = await requireAdmin();
  const data = tagSchema.parse(Object.fromEntries(formData));
  const position = await prisma.tag.count();
  const tag = await prisma.tag.create({ data: { ...data, position } });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "TAG_CREATE", entityType: "Tag", entityId: tag.id },
  });
  revalidatePath("/settings");
  revalidatePath("/fiches");
}

export async function updateTag(id: string, formData: FormData) {
  const user = await requireAdmin();
  const data = tagSchema.parse(Object.fromEntries(formData));
  await prisma.tag.update({ where: { id }, data });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "TAG_UPDATE", entityType: "Tag", entityId: id },
  });
  revalidatePath("/settings");
  revalidatePath("/fiches");
}

export async function toggleTag(id: string, active: boolean) {
  const user = await requireAdmin();
  await prisma.tag.update({ where: { id }, data: { active } });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: active ? "TAG_ENABLE" : "TAG_DISABLE",
      entityType: "Tag",
      entityId: id,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/fiches");
}

export async function deleteTag(id: string) {
  const user = await requireAdmin();
  const tag = await prisma.tag.findUnique({
    where: { id },
    select: { name: true, _count: { select: { workSheets: true } } },
  });
  if (!tag) throw new Error("Tag introuvable.");

  await prisma.$transaction([
    prisma.workSheetTag.deleteMany({ where: { tagId: id } }),
    prisma.tag.delete({ where: { id } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "TAG_DELETE",
        entityType: "Tag",
        entityId: id,
        metadata: {
          name: tag.name,
          detachedWorkSheets: tag._count.workSheets,
        },
      },
    }),
  ]);
  revalidatePath("/settings");
  revalidatePath("/fiches");
}

export async function createDocumentIssuer(formData: FormData) {
  const user = await requireTechnicalCatalogAdmin();
  const data = issuerSchema.parse(Object.fromEntries(formData));
  const issuer = await prisma.documentIssuer.create({ data });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "DOCUMENT_ISSUER_CREATE",
      entityType: "DocumentIssuer",
      entityId: issuer.id,
      metadata: { name: issuer.name },
    },
  });
  revalidatePath("/settings");
}

export async function updateDocumentIssuer(
  id: string,
  formData: FormData,
) {
  const user = await requireTechnicalCatalogAdmin();
  const data = issuerSchema.parse(Object.fromEntries(formData));
  await prisma.$transaction([
    prisma.documentIssuer.update({ where: { id }, data }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "DOCUMENT_ISSUER_UPDATE",
        entityType: "DocumentIssuer",
        entityId: id,
        metadata: { name: data.name },
      },
    }),
  ]);
  revalidatePath("/settings");
}

export async function toggleDocumentIssuer(id: string, active: boolean) {
  const user = await requireTechnicalCatalogAdmin();
  await prisma.$transaction([
    prisma.documentIssuer.update({ where: { id }, data: { active } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: active ? "DOCUMENT_ISSUER_ENABLE" : "DOCUMENT_ISSUER_DISABLE",
        entityType: "DocumentIssuer",
        entityId: id,
        metadata: { active },
      },
    }),
  ]);
  revalidatePath("/settings");
}

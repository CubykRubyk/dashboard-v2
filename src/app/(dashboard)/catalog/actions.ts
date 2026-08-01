"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MaterialInputType, MaterialUnit } from "@/generated/prisma/enums";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("Accès non autorisé.");
  return user;
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
});

const materialSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  reportLabel: z.string().trim().min(1).max(180),
  inputType: z.enum(MaterialInputType),
  unit: z.enum(MaterialUnit),
});

const variantSchema = z.object({
  name: z.string().trim().min(1).max(100),
  reportLabel: z.string().trim().min(1).max(180),
});

export async function createCategory(formData: FormData) {
  const user = await requireAdmin();
  const parsed = categorySchema.parse({ name: formData.get("name") });
  const count = await prisma.materialCategory.count();
  const key = `${slug(parsed.name)}_${Date.now().toString(36)}`;
  const category = await prisma.materialCategory.create({
    data: { key, name: parsed.name, position: count },
  });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "CATEGORY_CREATE", entityType: "MaterialCategory", entityId: category.id },
  });
  revalidatePath("/catalog");
}

export async function updateCategory(id: string, formData: FormData) {
  const user = await requireAdmin();
  const parsed = categorySchema.parse({ name: formData.get("name") });
  await prisma.materialCategory.update({ where: { id }, data: parsed });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "CATEGORY_UPDATE", entityType: "MaterialCategory", entityId: id },
  });
  revalidatePath("/catalog");
}

export async function createMaterial(formData: FormData) {
  const user = await requireAdmin();
  const parsed = materialSchema.parse(Object.fromEntries(formData));
  const count = await prisma.material.count({ where: { categoryId: parsed.categoryId } });
  const material = await prisma.material.create({
    data: {
      ...parsed,
      key: `${slug(parsed.name)}_${Date.now().toString(36)}`,
      position: count,
    },
  });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "MATERIAL_CREATE", entityType: "Material", entityId: material.id },
  });
  revalidatePath("/catalog");
}

export async function createVariant(materialId: string, formData: FormData) {
  const user = await requireAdmin();
  const parsed = variantSchema.parse(Object.fromEntries(formData));
  const count = await prisma.materialVariant.count({ where: { materialId } });
  const variant = await prisma.materialVariant.create({
    data: { ...parsed, materialId, position: count },
  });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "MATERIAL_VARIANT_CREATE", entityType: "MaterialVariant", entityId: variant.id },
  });
  revalidatePath("/catalog");
}

export async function updateMaterial(id: string, formData: FormData) {
  const user = await requireAdmin();
  const parsed = materialSchema.parse(Object.fromEntries(formData));
  await prisma.material.update({ where: { id }, data: parsed });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "MATERIAL_UPDATE", entityType: "Material", entityId: id },
  });
  revalidatePath("/catalog");
}

export async function updateVariant(id: string, formData: FormData) {
  const user = await requireAdmin();
  const parsed = variantSchema.parse(Object.fromEntries(formData));
  await prisma.materialVariant.update({ where: { id }, data: parsed });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "MATERIAL_VARIANT_UPDATE", entityType: "MaterialVariant", entityId: id },
  });
  revalidatePath("/catalog");
}

export async function toggleMaterial(id: string, active: boolean) {
  const user = await requireAdmin();
  await prisma.material.update({ where: { id }, data: { active } });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: active ? "MATERIAL_ENABLE" : "MATERIAL_DISABLE",
      entityType: "Material",
      entityId: id,
    },
  });
  revalidatePath("/catalog");
}

export async function toggleVariant(id: string, active: boolean) {
  const user = await requireAdmin();
  await prisma.materialVariant.update({ where: { id }, data: { active } });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: active ? "MATERIAL_VARIANT_ENABLE" : "MATERIAL_VARIANT_DISABLE",
      entityType: "MaterialVariant",
      entityId: id,
    },
  });
  revalidatePath("/catalog");
}

export async function deleteVariant(id: string) {
  const user = await requireAdmin();
  const variant = await prisma.materialVariant.findUnique({
    where: { id },
    select: { name: true, _count: { select: { workSheetItems: true } } },
  });
  if (!variant) return;
  await prisma.$transaction([
    prisma.materialVariant.delete({ where: { id } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "MATERIAL_VARIANT_DELETE",
        entityType: "MaterialVariant",
        entityId: id,
        metadata: { name: variant.name, usageCount: variant._count.workSheetItems },
      },
    }),
  ]);
  revalidatePath("/catalog");
}

export async function deleteMaterial(id: string) {
  const user = await requireAdmin();
  const material = await prisma.material.findUnique({
    where: { id },
    select: {
      name: true,
      _count: { select: { workSheetItems: true, variants: true } },
    },
  });
  if (!material) return;
  await prisma.$transaction([
    prisma.material.delete({ where: { id } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "MATERIAL_DELETE",
        entityType: "Material",
        entityId: id,
        metadata: {
          name: material.name,
          usageCount: material._count.workSheetItems,
          variantCount: material._count.variants,
        },
      },
    }),
  ]);
  revalidatePath("/catalog");
}

export async function deleteCategory(id: string) {
  const user = await requireAdmin();
  const category = await prisma.materialCategory.findUnique({
    where: { id },
    select: { name: true, _count: { select: { materials: true } } },
  });
  if (!category) return;
  if (category._count.materials > 0) {
    throw new Error("La catégorie doit être vide avant sa suppression.");
  }
  await prisma.$transaction([
    prisma.materialCategory.delete({ where: { id } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CATEGORY_DELETE",
        entityType: "MaterialCategory",
        entityId: id,
        metadata: { name: category.name },
      },
    }),
  ]);
  revalidatePath("/catalog");
}

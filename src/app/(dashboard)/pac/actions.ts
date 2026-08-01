"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { rejectLegacyCatalogMutation } from "@/lib/hvac/legacy-read-only";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("Accès non autorisé.");
  return user;
}

export async function createPacBrand(formData: FormData) {
  const user = await requireAdmin();
  const name = z.string().trim().min(1).max(100).parse(formData.get("name"));
  const brand = await prisma.pacBrand.create({ data: { name } });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "PAC_BRAND_CREATE", entityType: "PacBrand", entityId: brand.id },
  });
  revalidatePath("/pac");
}

export async function createRefrigerant(formData: FormData) {
  const user = await requireAdmin();
  const data = z.object({
    name: z.string().trim().min(1).max(40),
    gwp: z.coerce.number().min(0).max(100_000),
  }).parse(Object.fromEntries(formData));
  const refrigerant = await prisma.refrigerant.create({ data });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "REFRIGERANT_CREATE", entityType: "Refrigerant", entityId: refrigerant.id },
  });
  revalidatePath("/pac");
}

export async function updatePacBrand(id: string, formData: FormData) {
  const user = await requireAdmin();
  const name = z.string().trim().min(1).max(100).parse(formData.get("name"));
  await prisma.$transaction([
    prisma.pacBrand.update({ where: { id }, data: { name } }),
    prisma.auditLog.create({
      data: { userId: user.id, action: "PAC_BRAND_UPDATE", entityType: "PacBrand", entityId: id },
    }),
  ]);
  revalidatePath("/pac");
}

export async function togglePacBrand(id: string, active: boolean) {
  const user = await requireAdmin();
  await prisma.$transaction([
    prisma.pacBrand.update({ where: { id }, data: { active } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: active ? "PAC_BRAND_ENABLE" : "PAC_BRAND_DISABLE",
        entityType: "PacBrand",
        entityId: id,
      },
    }),
  ]);
  revalidatePath("/pac");
}

export async function deletePacBrand(id: string) {
  const user = await requireAdmin();
  const brand = await prisma.pacBrand.findUnique({
    where: { id },
    select: { name: true, _count: { select: { models: true } } },
  });
  if (!brand) return;
  if (brand._count.models > 0) {
    throw new Error("Une marque utilisée par un modèle PAC ne peut pas être supprimée.");
  }
  await prisma.$transaction([
    prisma.pacBrand.delete({ where: { id } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PAC_BRAND_DELETE",
        entityType: "PacBrand",
        entityId: id,
        metadata: { name: brand.name },
      },
    }),
  ]);
  revalidatePath("/pac");
}

export async function updateRefrigerant(id: string, formData: FormData) {
  const user = await requireAdmin();
  const data = z.object({
    name: z.string().trim().min(1).max(40),
    gwp: z.coerce.number().min(0).max(100_000),
  }).parse(Object.fromEntries(formData));
  await prisma.$transaction([
    prisma.refrigerant.update({ where: { id }, data }),
    prisma.auditLog.create({
      data: { userId: user.id, action: "REFRIGERANT_UPDATE", entityType: "Refrigerant", entityId: id },
    }),
  ]);
  revalidatePath("/pac");
}

export async function toggleRefrigerant(id: string, active: boolean) {
  const user = await requireAdmin();
  await prisma.$transaction([
    prisma.refrigerant.update({ where: { id }, data: { active } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: active ? "REFRIGERANT_ENABLE" : "REFRIGERANT_DISABLE",
        entityType: "Refrigerant",
        entityId: id,
      },
    }),
  ]);
  revalidatePath("/pac");
}

export async function deleteRefrigerant(id: string) {
  const user = await requireAdmin();
  const refrigerant = await prisma.refrigerant.findUnique({
    where: { id },
    select: { name: true, gwp: true, _count: { select: { models: true } } },
  });
  if (!refrigerant) return;
  if (refrigerant._count.models > 0) {
    throw new Error("Un réfrigérant utilisé par un modèle PAC ne peut pas être supprimé.");
  }
  await prisma.$transaction([
    prisma.refrigerant.delete({ where: { id } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "REFRIGERANT_DELETE",
        entityType: "Refrigerant",
        entityId: id,
        metadata: { name: refrigerant.name, gwp: refrigerant.gwp },
      },
    }),
  ]);
  revalidatePath("/pac");
}

export async function createHeatPump(formData: FormData) {
  void formData;
  rejectLegacyCatalogMutation();
}

export async function updateHeatPump(id: string, formData: FormData) {
  void id;
  void formData;
  rejectLegacyCatalogMutation();
}

export async function toggleHeatPump(id: string, active: boolean) {
  void id;
  void active;
  rejectLegacyCatalogMutation();
}

export async function uploadPacDocument(heatPumpId: string, formData: FormData) {
  void heatPumpId;
  void formData;
  rejectLegacyCatalogMutation();
}

export async function deletePacDocument(id: string) {
  void id;
  rejectLegacyCatalogMutation();
}

"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ElectricalSupply,
  HeatPumpConfiguration,
  HeatPumpSplitLiaisonType,
  HeatPumpType,
  PacDocumentType,
} from "@/generated/prisma/enums";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const documentDirectory = path.join(process.cwd(), "data", "pac-documents");

async function requireAdmin() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("Accès non autorisé.");
  return user;
}

const optionalNumber = z.preprocess(
  (value) => value === "" || value === null ? null : value,
  z.coerce.number().min(0).nullable(),
);

const heatPumpSchema = z.object({
  brandId: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  type: z.enum(HeatPumpType),
  configuration: z.enum(HeatPumpConfiguration),
  electricalSupply: z.enum(ElectricalSupply),
  powerKw: optionalNumber,
  outdoorReference: z.string().trim().max(160),
  indoorReference: z.string().trim().max(160),
  splitLiaisonType: z.string().transform((value) => value || null).pipe(z.enum(HeatPumpSplitLiaisonType).nullable()),
  refrigerantId: z.string().transform((value) => value || null),
  factoryChargeKg: optionalNumber,
  maxPipeLengthM: optionalNumber,
  maxHeightDifferenceM: optionalNumber,
  includedPipeLengthM: optionalNumber,
  additionalChargeGPerM: optionalNumber,
  liquidPipeDiameter: z.string().trim().max(80),
  gasPipeDiameter: z.string().trim().max(80),
  indoorPowerCable: z.string().trim().max(120),
  outdoorPowerCable: z.string().trim().max(120),
  recommendedProtection: z.string().trim().max(120),
  communicationCable: z.string().trim().max(120),
  hydraulicConnections: z.string().trim().max(160),
  minimumFlow: z.string().trim().max(120),
  minimumWaterVolume: z.string().trim().max(120),
  maximumFlowTemperature: z.string().trim().max(120),
  bufferTankRecommendation: z.string().trim().max(500),
  commissioningNotes: z.string().trim().max(10_000),
  installationNotes: z.string().trim().max(20_000),
  internalNotes: z.string().trim().max(20_000),
}).transform((data) => {
  if (data.configuration === HeatPumpConfiguration.MONOBLOC) {
    return {
      ...data,
      splitLiaisonType: null,
      outdoorPowerCable: "",
      maxPipeLengthM: null,
      maxHeightDifferenceM: null,
      includedPipeLengthM: null,
      additionalChargeGPerM: null,
      liquidPipeDiameter: "",
      gasPipeDiameter: "",
      powerCable: data.indoorPowerCable,
    };
  }

  if (data.splitLiaisonType === HeatPumpSplitLiaisonType.HYDRAULIC) {
    return {
      ...data,
      maxPipeLengthM: null,
      maxHeightDifferenceM: null,
      includedPipeLengthM: null,
      additionalChargeGPerM: null,
      liquidPipeDiameter: "",
      gasPipeDiameter: "",
      powerCable: data.indoorPowerCable,
    };
  }

  return {
    ...data,
    powerCable: data.indoorPowerCable,
  };
}).superRefine((data, ctx) => {
  if (data.configuration === HeatPumpConfiguration.SPLIT && !data.splitLiaisonType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["splitLiaisonType"],
      message: "Sélectionnez le type de liaison pour un modèle split.",
    });
  }
});

function normalizeHeatPumpFormData(formData: FormData) {
  const raw = Object.fromEntries(formData);
  return {
    splitLiaisonType: "",
    refrigerantId: "",
    maxPipeLengthM: "",
    maxHeightDifferenceM: "",
    includedPipeLengthM: "",
    additionalChargeGPerM: "",
    liquidPipeDiameter: "",
    gasPipeDiameter: "",
    indoorPowerCable: "",
    outdoorPowerCable: "",
    commissioningNotes: "",
    installationNotes: "",
    internalNotes: "",
    ...raw,
  };
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
  const user = await requireAdmin();
  const data = heatPumpSchema.parse(normalizeHeatPumpFormData(formData));
  const heatPump = await prisma.heatPump.create({ data });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "PAC_MODEL_CREATE", entityType: "HeatPump", entityId: heatPump.id },
  });
  redirect(`/pac/${heatPump.id}`);
}

export async function updateHeatPump(id: string, formData: FormData) {
  const user = await requireAdmin();
  const data = heatPumpSchema.parse(normalizeHeatPumpFormData(formData));
  await prisma.$transaction([
    prisma.heatPump.update({ where: { id }, data }),
    prisma.auditLog.create({
      data: { userId: user.id, action: "PAC_MODEL_UPDATE", entityType: "HeatPump", entityId: id },
    }),
  ]);
  revalidatePath("/pac");
  revalidatePath(`/pac/${id}`);
}

export async function toggleHeatPump(id: string, active: boolean) {
  const user = await requireAdmin();
  await prisma.$transaction([
    prisma.heatPump.update({ where: { id }, data: { active } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: active ? "PAC_MODEL_ENABLE" : "PAC_MODEL_DISABLE",
        entityType: "HeatPump",
        entityId: id,
      },
    }),
  ]);
  revalidatePath("/pac");
  revalidatePath(`/pac/${id}`);
}

export async function uploadPacDocument(heatPumpId: string, formData: FormData) {
  const user = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Sélectionnez un fichier PDF.");
  if (file.type !== "application/pdf" || file.size > 25 * 1024 * 1024) {
    throw new Error("Le document doit être un PDF de 25 Mo maximum.");
  }
  const metadata = z.object({
    name: z.string().trim().min(1).max(160),
    type: z.enum(PacDocumentType),
    version: z.string().trim().max(40),
    documentDate: z.string(),
  }).parse(Object.fromEntries(formData));
  const storageName = `${randomUUID()}.pdf`;
  await mkdir(documentDirectory, { recursive: true });
  await writeFile(path.join(documentDirectory, storageName), Buffer.from(await file.arrayBuffer()));
  const document = await prisma.pacDocument.create({
    data: {
      heatPumpId,
      name: metadata.name,
      type: metadata.type,
      version: metadata.version,
      documentDate: metadata.documentDate
        ? new Date(`${metadata.documentDate}T12:00:00Z`)
        : null,
      originalName: file.name,
      storageName,
      mimeType: file.type,
      sizeBytes: file.size,
    },
  });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "PAC_DOCUMENT_UPLOAD", entityType: "PacDocument", entityId: document.id },
  });
  revalidatePath(`/pac/${heatPumpId}`);
}

export async function deletePacDocument(id: string) {
  const user = await requireAdmin();
  const document = await prisma.pacDocument.findUnique({ where: { id } });
  if (!document) throw new Error("Document introuvable.");
  await prisma.$transaction([
    prisma.pacDocument.delete({ where: { id } }),
    prisma.auditLog.create({
      data: { userId: user.id, action: "PAC_DOCUMENT_DELETE", entityType: "PacDocument", entityId: id },
    }),
  ]);
  await unlink(path.join(documentDirectory, document.storageName)).catch(() => undefined);
  revalidatePath(`/pac/${document.heatPumpId}`);
}

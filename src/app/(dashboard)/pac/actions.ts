"use server";

import { rejectLegacyCatalogMutation } from "@/lib/hvac/legacy-mutation-guard";
import { prisma } from "@/lib/prisma";

export async function createPacBrand(formData: FormData) {
  void formData;
  return rejectLegacyCatalogMutation({
    operation: "CREATE",
    entityType: "PacBrand",
  });
}

export async function createRefrigerant(formData: FormData) {
  void formData;
  return rejectLegacyCatalogMutation({
    operation: "CREATE",
    entityType: "Refrigerant",
  });
}

export async function updatePacBrand(id: string, formData: FormData) {
  void formData;
  return rejectLegacyCatalogMutation({
    operation: "UPDATE",
    entityType: "PacBrand",
    entityId: id,
  });
}

export async function togglePacBrand(id: string, active: boolean) {
  return rejectLegacyCatalogMutation({
    operation: active ? "ENABLE" : "DISABLE",
    entityType: "PacBrand",
    entityId: id,
  });
}

export async function deletePacBrand(id: string) {
  return rejectLegacyCatalogMutation({
    operation: "DELETE",
    entityType: "PacBrand",
    entityId: id,
  });
}

export async function updateRefrigerant(id: string, formData: FormData) {
  void formData;
  return rejectLegacyCatalogMutation({
    operation: "UPDATE",
    entityType: "Refrigerant",
    entityId: id,
  });
}

export async function toggleRefrigerant(id: string, active: boolean) {
  return rejectLegacyCatalogMutation({
    operation: active ? "ENABLE" : "DISABLE",
    entityType: "Refrigerant",
    entityId: id,
  });
}

export async function deleteRefrigerant(id: string) {
  const refrigerant = await prisma.refrigerant.findUnique({
    where: { id },
    select: {
      _count: {
        select: {
          models: true,
          equipment: true,
        },
      },
    },
  });
  const dependencies = refrigerant
    ? ` Dépendances bloquantes : ${refrigerant._count.models} modèle(s) legacy et ${refrigerant._count.equipment} équipement(s) du catalogue technique.`
    : "";
  return rejectLegacyCatalogMutation({
    operation: "DELETE",
    entityType: "Refrigerant",
    entityId: id,
  }, `Le catalogue PAC historique est en lecture seule.${dependencies}`);
}

export async function createHeatPump(formData: FormData) {
  void formData;
  return rejectLegacyCatalogMutation({
    operation: "CREATE",
    entityType: "HeatPump",
  });
}

export async function updateHeatPump(id: string, formData: FormData) {
  void formData;
  return rejectLegacyCatalogMutation({
    operation: "UPDATE",
    entityType: "HeatPump",
    entityId: id,
  });
}

export async function toggleHeatPump(id: string, active: boolean) {
  return rejectLegacyCatalogMutation({
    operation: active ? "ENABLE" : "DISABLE",
    entityType: "HeatPump",
    entityId: id,
  });
}

export async function uploadPacDocument(heatPumpId: string, formData: FormData) {
  void formData;
  return rejectLegacyCatalogMutation({
    operation: "UPLOAD_DOCUMENT",
    entityType: "PacDocument",
    entityId: heatPumpId,
  });
}

export async function deletePacDocument(id: string) {
  return rejectLegacyCatalogMutation({
    operation: "DELETE",
    entityType: "PacDocument",
    entityId: id,
  });
}

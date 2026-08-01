"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/forms/action-state";
import { requireTechnicalCatalogAdmin } from "@/lib/auth/authorization";
import {
  createEquipmentRecord,
  createManufacturerRecord,
  createProductRangeRecord,
  findEquipmentReferenceState,
  findProductRangeChangeState,
  technicalCatalogRepository,
  toggleEquipmentRecord,
  toggleManufacturerRecord,
  toggleProductRangeRecord,
  updateEquipmentRecord,
  updateManufacturerRecord,
  updateProductRangeRecord,
} from "@/lib/hvac/catalog-repository";
import {
  equipmentData,
  referenceNeedsReviewAfterEdit,
  validateEquipmentAssociations,
  validateManufacturerName,
  validateProductRange,
} from "@/lib/hvac/catalog-service";
import {
  actionErrorState,
  TechnicalCatalogError,
} from "@/lib/hvac/errors";
import {
  equipmentFormData,
  equipmentInputSchema,
  manufacturerInputSchema,
  productRangeInputSchema,
} from "@/lib/hvac/validation";

const catalogPaths = [
  "/pac/technical",
  "/pac/technical/manufacturers",
  "/pac/technical/ranges",
];

function revalidateCatalog() {
  for (const path of catalogPaths) revalidatePath(path);
}

export async function createManufacturerAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void _previousState;
  try {
    const user = await requireTechnicalCatalogAdmin();
    const input = manufacturerInputSchema.parse({
      name: formData.get("name"),
    });
    const data = await validateManufacturerName(
      technicalCatalogRepository,
      input,
    );
    await createManufacturerRecord(data, user.id);
    revalidateCatalog();
    return { status: "success", message: "Fabricant créé." };
  } catch (error) {
    return actionErrorState(error, "Impossible de créer le fabricant.");
  }
}

export async function updateManufacturerAction(
  id: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void _previousState;
  try {
    const user = await requireTechnicalCatalogAdmin();
    const input = manufacturerInputSchema.parse({
      name: formData.get("name"),
    });
    const data = await validateManufacturerName(
      technicalCatalogRepository,
      input,
      id,
    );
    await updateManufacturerRecord(id, data, user.id);
    revalidateCatalog();
    return { status: "success", message: "Fabricant mis à jour." };
  } catch (error) {
    return actionErrorState(error, "Impossible de modifier le fabricant.");
  }
}

export async function toggleManufacturerAction(
  id: string,
  active: boolean,
  _previousState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  void _previousState;
  void _formData;
  try {
    const user = await requireTechnicalCatalogAdmin();
    const manufacturer = await technicalCatalogRepository.findManufacturer(id);
    if (!manufacturer) {
      throw new TechnicalCatalogError(
        "Le fabricant n’existe plus.",
        "NOT_FOUND",
      );
    }
    await toggleManufacturerRecord(id, active, user.id);
    revalidateCatalog();
    return {
      status: "success",
      message: active ? "Fabricant activé." : "Fabricant désactivé.",
    };
  } catch (error) {
    return actionErrorState(error, "Impossible de modifier le statut.");
  }
}

export async function createProductRangeAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireTechnicalCatalogAdmin();
    const input = productRangeInputSchema.parse(Object.fromEntries(formData));
    const data = await validateProductRange(
      technicalCatalogRepository,
      input,
    );
    await createProductRangeRecord(data, user.id);
    revalidateCatalog();
    return { status: "success", message: "Gamme créée." };
  } catch (error) {
    return actionErrorState(error, "Impossible de créer la gamme.");
  }
}

export async function updateProductRangeAction(
  id: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireTechnicalCatalogAdmin();
    const input = productRangeInputSchema.parse(Object.fromEntries(formData));
    const current = await findProductRangeChangeState(id);
    if (!current) {
      throw new TechnicalCatalogError("La gamme n’existe plus.", "NOT_FOUND");
    }
    const linkedCount =
      current._count.equipment + current._count.systemCombinations;
    if (
      current.manufacturerId !== input.manufacturerId
      && linkedCount > 0
    ) {
      throw new TechnicalCatalogError(
        "Une gamme déjà utilisée ne peut pas être déplacée vers un autre fabricant.",
        "RANGE_MANUFACTURER_MISMATCH",
      );
    }
    const data = await validateProductRange(
      technicalCatalogRepository,
      input,
      id,
    );
    await updateProductRangeRecord(id, data, user.id);
    revalidateCatalog();
    return { status: "success", message: "Gamme mise à jour." };
  } catch (error) {
    return actionErrorState(error, "Impossible de modifier la gamme.");
  }
}

export async function toggleProductRangeAction(
  id: string,
  active: boolean,
  _previousState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  void _previousState;
  void _formData;
  try {
    const user = await requireTechnicalCatalogAdmin();
    const productRange = await technicalCatalogRepository.findProductRange(id);
    if (!productRange) {
      throw new TechnicalCatalogError("La gamme n’existe plus.", "NOT_FOUND");
    }
    await toggleProductRangeRecord(id, active, user.id);
    revalidateCatalog();
    return {
      status: "success",
      message: active ? "Gamme activée." : "Gamme désactivée.",
    };
  } catch (error) {
    return actionErrorState(error, "Impossible de modifier le statut.");
  }
}

export async function createEquipmentAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let equipmentId: string;
  try {
    const user = await requireTechnicalCatalogAdmin();
    const input = equipmentInputSchema.parse(equipmentFormData(formData));
    const { normalizedReference } = await validateEquipmentAssociations(
      technicalCatalogRepository,
      input,
    );
    const equipment = await createEquipmentRecord(
      equipmentData(input, normalizedReference, false),
      user.id,
    );
    equipmentId = equipment.id;
    revalidateCatalog();
  } catch (error) {
    return actionErrorState(error, "Impossible de créer l’équipement.");
  }
  redirect(`/pac/technical/equipment/${equipmentId}`);
}

export async function updateEquipmentAction(
  id: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireTechnicalCatalogAdmin();
    const current = await findEquipmentReferenceState(id);
    if (!current) {
      throw new TechnicalCatalogError(
        "L’équipement n’existe plus.",
        "NOT_FOUND",
      );
    }
    const input = equipmentInputSchema.parse(equipmentFormData(formData));
    const { normalizedReference } = await validateEquipmentAssociations(
      technicalCatalogRepository,
      input,
      id,
    );
    const referenceNeedsReview = referenceNeedsReviewAfterEdit(
      current,
      normalizedReference,
    );
    await updateEquipmentRecord(
      id,
      equipmentData(input, normalizedReference, referenceNeedsReview),
      user.id,
    );
    revalidateCatalog();
    revalidatePath(`/pac/technical/equipment/${id}`);
    return { status: "success", message: "Équipement mis à jour." };
  } catch (error) {
    return actionErrorState(error, "Impossible de modifier l’équipement.");
  }
}

export async function toggleEquipmentAction(
  id: string,
  active: boolean,
  _previousState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  void _previousState;
  void _formData;
  try {
    const user = await requireTechnicalCatalogAdmin();
    const equipment = await findEquipmentReferenceState(id);
    if (!equipment) {
      throw new TechnicalCatalogError(
        "L’équipement n’existe plus.",
        "NOT_FOUND",
      );
    }
    await toggleEquipmentRecord(id, active, user.id);
    revalidateCatalog();
    revalidatePath(`/pac/technical/equipment/${id}`);
    return {
      status: "success",
      message: active ? "Équipement activé." : "Équipement désactivé.",
    };
  } catch (error) {
    return actionErrorState(error, "Impossible de modifier le statut.");
  }
}

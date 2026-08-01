"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/forms/action-state";
import { requireTechnicalCatalogAdmin } from "@/lib/auth/authorization";
import {
  createCombinationRecord,
  toggleCombinationRecord,
  updateCombinationRecord,
} from "@/lib/hvac/combination-repository";
import { deleteSystemCombinationRecord } from "@/lib/hvac/deletion-repository";
import {
  combinationFormData,
  combinationInputSchema,
} from "@/lib/hvac/combination-validation";
import { actionErrorState } from "@/lib/hvac/errors";

function revalidateCombinationPaths(id?: string) {
  revalidatePath("/pac/technical");
  revalidatePath("/pac/technical/combinations");
  if (id) revalidatePath(`/pac/technical/combinations/${id}`);
}

export async function createCombinationAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void _previousState;
  let combinationId: string;
  try {
    const user = await requireTechnicalCatalogAdmin();
    const input = combinationInputSchema.parse(combinationFormData(formData));
    const combination = await createCombinationRecord(input, user.id);
    combinationId = combination.id;
    revalidateCombinationPaths(combination.id);
  } catch (error) {
    return actionErrorState(error, "Impossible de créer la combinaison.");
  }
  redirect(`/pac/technical/combinations/${combinationId}`);
}

export async function updateCombinationAction(
  id: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void _previousState;
  try {
    const user = await requireTechnicalCatalogAdmin();
    const input = combinationInputSchema.parse(combinationFormData(formData));
    await updateCombinationRecord(id, input, user.id);
    revalidateCombinationPaths(id);
    return { status: "success", message: "Combinaison mise à jour." };
  } catch (error) {
    return actionErrorState(error, "Impossible de modifier la combinaison.");
  }
}

export async function toggleCombinationAction(
  id: string,
  active: boolean,
  _previousState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  void _previousState;
  void _formData;
  try {
    const user = await requireTechnicalCatalogAdmin();
    await toggleCombinationRecord(id, active, user.id);
    revalidateCombinationPaths(id);
    return {
      status: "success",
      message: active ? "Combinaison activée." : "Combinaison désactivée.",
    };
  } catch (error) {
    return actionErrorState(error, "Impossible de modifier le statut.");
  }
}

export async function deleteCombinationAction(
  id: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void _previousState;
  let deleted = false;
  try {
    const user = await requireTechnicalCatalogAdmin();
    const result = await deleteSystemCombinationRecord(
      id,
      String(formData.get("confirmation") ?? ""),
      user.id,
    );
    deleted = result.deleted;
    revalidateCombinationPaths(id);
    revalidatePath("/pac/technical/documents");
  } catch (error) {
    return actionErrorState(error, "Impossible de supprimer la combinaison.");
  }
  redirect(
    `/pac/technical/combinations?deleted=${
      deleted ? "combination" : "already-removed"
    }`,
  );
}

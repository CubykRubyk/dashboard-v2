"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/forms/action-state";
import { requireTechnicalCatalogAdmin } from "@/lib/auth/authorization";
import {
  toggleTechnicalDocumentRecord,
  updateTechnicalDocumentRecord,
} from "@/lib/hvac/document-repository";
import { uploadTechnicalDocument } from "@/lib/hvac/document-upload-service";
import {
  technicalDocumentFormData,
  technicalDocumentInputSchema,
} from "@/lib/hvac/document-validation";
import { actionErrorState, TechnicalCatalogError } from "@/lib/hvac/errors";

function revalidateDocumentPaths(id?: string) {
  revalidatePath("/pac/technical/documents");
  revalidatePath("/pac/technical");
  revalidatePath("/pac/technical/combinations");
  if (id) revalidatePath(`/pac/technical/documents/${id}`);
}

export async function createTechnicalDocumentAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void _previousState;
  let documentId: string;
  try {
    const user = await requireTechnicalCatalogAdmin();
    const input = technicalDocumentInputSchema.parse(
      technicalDocumentFormData(formData),
    );
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new TechnicalCatalogError(
        "Sélectionnez un fichier PDF.",
        "INVALID_FILE",
      );
    }
    const document = await uploadTechnicalDocument(file, input, user.id);
    documentId = document.id;
    revalidateDocumentPaths(document.id);
  } catch (error) {
    return actionErrorState(error, "Impossible d’importer le document.");
  }
  redirect(`/pac/technical/documents/${documentId}`);
}

export async function updateTechnicalDocumentAction(
  id: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void _previousState;
  try {
    const user = await requireTechnicalCatalogAdmin();
    const input = technicalDocumentInputSchema.parse(
      technicalDocumentFormData(formData),
    );
    await updateTechnicalDocumentRecord(id, input, user.id);
    revalidateDocumentPaths(id);
    return { status: "success", message: "Document mis à jour." };
  } catch (error) {
    return actionErrorState(error, "Impossible de modifier le document.");
  }
}

export async function toggleTechnicalDocumentAction(
  id: string,
  active: boolean,
  _previousState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  void _previousState;
  void _formData;
  try {
    const user = await requireTechnicalCatalogAdmin();
    await toggleTechnicalDocumentRecord(id, active, user.id);
    revalidateDocumentPaths(id);
    return {
      status: "success",
      message: active ? "Document activé." : "Document désactivé.",
    };
  } catch (error) {
    return actionErrorState(error, "Impossible de modifier le statut.");
  }
}

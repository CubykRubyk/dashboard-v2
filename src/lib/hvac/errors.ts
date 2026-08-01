import { z } from "zod";
import type { ActionState } from "@/lib/forms/action-state";

export class TechnicalCatalogError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "DUPLICATE"
      | "NOT_FOUND"
      | "RANGE_MANUFACTURER_MISMATCH"
      | "INVALID_COMPONENT"
      | "INACTIVE_COMPONENT"
      | "INVALID_FILE"
      | "DUPLICATE_DOCUMENT"
      | "INVALID_ASSOCIATION"
      | "FILE_NOT_FOUND",
  ) {
    super(message);
    this.name = "TechnicalCatalogError";
  }
}

export class DuplicateTechnicalDocumentError extends TechnicalCatalogError {
  constructor(public readonly documentId: string) {
    super(
      "Ce fichier existe déjà dans la bibliothèque. Utilisez le document existant pour ajouter les associations nécessaires.",
      "DUPLICATE_DOCUMENT",
    );
    this.name = "DuplicateTechnicalDocumentError";
  }
}

function isPrismaUniqueError(error: unknown) {
  return Boolean(
    error
      && typeof error === "object"
      && "code" in error
      && error.code === "P2002",
  );
}

export function actionErrorState(
  error: unknown,
  fallback = "Une erreur inattendue est survenue.",
): ActionState {
  if (error instanceof z.ZodError) {
    const flattened = z.flattenError(error);
    return {
      status: "error",
      message: flattened.formErrors[0] || "Vérifiez les informations saisies.",
      fieldErrors: flattened.fieldErrors,
    };
  }
  if (error instanceof TechnicalCatalogError) {
    return {
      status: "error",
      message: error.message,
      ...(error instanceof DuplicateTechnicalDocumentError
        ? {
            link: {
              href: `/pac/technical/documents/${error.documentId}`,
              label: "Ouvrir le document existant",
            },
          }
        : {}),
    };
  }
  if (isPrismaUniqueError(error)) {
    return {
      status: "error",
      message: "Un enregistrement identique existe déjà.",
    };
  }
  return { status: "error", message: fallback };
}

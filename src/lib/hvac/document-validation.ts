import { z } from "zod";
import { TechnicalDocumentType } from "@/generated/prisma/enums";
import { cleanCatalogName } from "@/lib/hvac/normalization";
import { text } from "@/lib/hvac/validation";

const booleanValue = z.preprocess(
  (value) => value === "true" || value === "on" || value === true,
  z.boolean(),
);

const documentDate = z.preprocess(
  (value) => value === "" || value == null ? null : value,
  z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La date du document est invalide.")
    .transform((value) => new Date(`${value}T12:00:00.000Z`))
    .refine((value) => !Number.isNaN(value.getTime()), "La date est invalide.")
    .nullable(),
);

const associationIds = z.array(
  z.string().trim().min(1, "Un identifiant d’association est invalide.").max(100),
).max(500, "Trop d’associations ont été sélectionnées.");

export const technicalDocumentInputSchema = z.object({
  title: z.string()
    .transform(cleanCatalogName)
    .pipe(z.string().min(1, "Le titre est obligatoire.").max(160)),
  type: z.enum(TechnicalDocumentType),
  version: text(40),
  documentDate,
  isPrimary: booleanValue,
  active: booleanValue,
  equipmentIds: associationIds,
  systemCombinationIds: associationIds,
}).superRefine((input, context) => {
  if (new Set(input.equipmentIds).size !== input.equipmentIds.length) {
    context.addIssue({
      code: "custom",
      path: ["equipmentIds"],
      message: "Un équipement a été sélectionné plusieurs fois.",
    });
  }
  if (
    new Set(input.systemCombinationIds).size
    !== input.systemCombinationIds.length
  ) {
    context.addIssue({
      code: "custom",
      path: ["systemCombinationIds"],
      message: "Une combinaison a été sélectionnée plusieurs fois.",
    });
  }
});

export type TechnicalDocumentInput = z.infer<
  typeof technicalDocumentInputSchema
>;

export function technicalDocumentFormData(formData: FormData) {
  return {
    title: formData.get("title"),
    type: formData.get("type"),
    version: formData.get("version") ?? "",
    documentDate: formData.get("documentDate") ?? "",
    isPrimary: formData.get("isPrimary") ?? "false",
    active: formData.get("active") ?? "true",
    equipmentIds: formData.getAll("equipmentIds"),
    systemCombinationIds: formData.getAll("systemCombinationIds"),
  };
}

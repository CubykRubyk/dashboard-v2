import { z } from "zod";

import {
  cleanCatalogName,
  cleanEquipmentReference,
  normalizeEquipmentReference,
} from "@/lib/hvac/normalization";
import { optionalId, optionalNumber, text } from "@/lib/hvac/validation";

/**
 * Configuration déclarée au moment de la saisie rapide. `UNKNOWN` est un cas de première
 * intention assumé : Ion saisit souvent une pompe sans encore savoir comment elle se décompose,
 * et devoir choisir à ce moment-là est précisément ce qui rendait l'ancien parcours pénible.
 */
export const PUMP_CONFIGURATIONS = ["MONOBLOC", "SPLIT", "UNKNOWN"] as const;
export type PumpConfiguration = (typeof PUMP_CONFIGURATIONS)[number];

export const simplePumpInputSchema = z.object({
  manufacturerId: z.string().min(1, "Sélectionnez un fabricant."),

  // Gamme : soit une gamme existante, soit un nom libre à créer au passage (évite d'obliger
  // l'utilisateur à quitter le formulaire pour aller créer la gamme d'abord).
  productRangeId: optionalId,
  newProductRangeName: z.string()
    .transform(cleanCatalogName)
    .pipe(z.string().max(120)),

  name: z.string()
    .transform(cleanCatalogName)
    .pipe(z.string().min(1, "Le nom de la pompe est obligatoire.").max(160)),

  configuration: z.enum(PUMP_CONFIGURATIONS),

  // Les deux références sont facultatives : c'est tout l'intérêt de ce formulaire.
  indoorReference: z.string().transform(cleanEquipmentReference).pipe(z.string().max(160)),
  outdoorReference: z.string().transform(cleanEquipmentReference).pipe(z.string().max(160)),

  nominalPowerKw: optionalNumber,
  installationNotes: text(20_000),
  internalNotes: text(20_000),
}).superRefine((input, context) => {
  if (input.productRangeId && input.newProductRangeName) {
    context.addIssue({
      code: "custom",
      path: ["newProductRangeName"],
      message: "Choisissez une gamme existante ou saisissez-en une nouvelle, pas les deux.",
    });
  }
  // Comparaison sur la forme *normalisée* (espaces et casse ignorés), la même règle que celle
  // qui détecte les doublons dans tout le catalogue : sinon « EPRA 16 » et « epra  16 »
  // passeraient ici pour être rejetés plus loin par la contrainte d'unicité, avec un message
  // trompeur (« cette référence existe déjà ») alors qu'on vient tout juste de la saisir.
  if (
    input.indoorReference
    && input.outdoorReference
    && normalizeEquipmentReference(input.indoorReference)
      === normalizeEquipmentReference(input.outdoorReference)
  ) {
    context.addIssue({
      code: "custom",
      path: ["outdoorReference"],
      message: "Les références intérieure et extérieure doivent être différentes.",
    });
  }
});

export type SimplePumpInput = z.infer<typeof simplePumpInputSchema>;

const simplePumpDefaults = {
  productRangeId: "",
  newProductRangeName: "",
  indoorReference: "",
  outdoorReference: "",
  nominalPowerKw: "",
  installationNotes: "",
  internalNotes: "",
};

export function simplePumpFormData(formData: FormData) {
  return {
    ...simplePumpDefaults,
    ...Object.fromEntries(formData),
  };
}

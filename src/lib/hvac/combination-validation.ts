import { z } from "zod";
import {
  ElectricalSupply,
  HeatPumpSplitLiaisonType,
  HeatPumpType,
} from "@/generated/prisma/enums";
import { cleanCatalogName } from "@/lib/hvac/normalization";
import {
  optionalEnum,
  optionalId,
  optionalNumber,
  text,
} from "@/lib/hvac/validation";

const optionalName = z.preprocess(
  (value) => value == null ? "" : value,
  z.string()
    .transform(cleanCatalogName)
    .pipe(z.string().max(160, "Le nom ne peut pas dépasser 160 caractères.")),
);

const active = z.preprocess(
  (value) => value === "false" ? false : value === "true" ? true : value,
  z.boolean(),
);

export const combinationInputSchema = z.object({
  manufacturerId: z.string().min(1, "Sélectionnez un fabricant."),
  productRangeId: optionalId,
  outdoorEquipmentId: z.string().min(1, "Sélectionnez une unité extérieure."),
  indoorEquipmentId: z.string().min(1, "Sélectionnez une unité intérieure."),
  name: optionalName,
  applicationType: optionalEnum(HeatPumpType),
  splitLiaisonType: optionalEnum(HeatPumpSplitLiaisonType),
  electricalSupply: optionalEnum(ElectricalSupply),
  nominalPowerKw: optionalNumber,
  commissioningNotes: text(10_000),
  installationNotes: text(20_000),
  internalNotes: text(20_000),
  active,
});

export type CombinationInput = z.infer<typeof combinationInputSchema>;

const combinationDefaults = {
  productRangeId: "",
  name: "",
  applicationType: "",
  splitLiaisonType: "",
  electricalSupply: "",
  nominalPowerKw: "",
  commissioningNotes: "",
  installationNotes: "",
  internalNotes: "",
  active: "true",
};

export function combinationFormData(formData: FormData) {
  return {
    ...combinationDefaults,
    ...Object.fromEntries(formData),
  };
}

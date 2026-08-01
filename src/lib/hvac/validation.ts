import { z } from "zod";
import {
  ElectricalSupply,
  EquipmentType,
} from "@/generated/prisma/enums";
import {
  cleanCatalogName,
  cleanEquipmentReference,
} from "@/lib/hvac/normalization";

export const optionalId = z.preprocess(
  (value) => value === "" || value == null ? null : value,
  z.string().min(1).nullable(),
);

export const optionalEnum = <T extends Record<string, string>>(values: T) =>
  z.preprocess(
    (value) => value === "" || value == null ? null : value,
    z.enum(values).nullable(),
  );

export const optionalNumber = z.preprocess((value) => {
  if (value === "" || value == null) return null;
  if (typeof value === "string") return value.replace(",", ".");
  return value;
}, z.coerce.number().finite().min(0).nullable());

export const text = (maximum: number) =>
  z.preprocess(
    (value) => value == null ? "" : value,
    z.string().trim().max(maximum),
  );

export const manufacturerInputSchema = z.object({
  name: z.string()
    .transform(cleanCatalogName)
    .pipe(z.string().min(1, "Le nom du fabricant est obligatoire.").max(100)),
});

export const productRangeInputSchema = z.object({
  manufacturerId: z.string().min(1, "Sélectionnez un fabricant."),
  name: z.string()
    .transform(cleanCatalogName)
    .pipe(z.string().min(1, "Le nom de la gamme est obligatoire.").max(120)),
});

export const equipmentInputSchema = z.object({
  manufacturerId: z.string().min(1, "Sélectionnez un fabricant."),
  productRangeId: optionalId,
  type: z.enum(EquipmentType),
  name: z.string()
    .transform(cleanCatalogName)
    .pipe(z.string().min(1, "La désignation est obligatoire.").max(160)),
  manufacturerReference: z.string()
    .transform(cleanEquipmentReference)
    .pipe(z.string().min(1, "La référence fabricant est obligatoire.").max(160)),

  electricalSupply: optionalEnum(ElectricalSupply),
  recommendedProtection: text(120),
  powerCable: text(120),
  communicationCable: text(120),

  refrigerantId: optionalId,
  factoryChargeKg: optionalNumber,

  maxPipeLengthM: optionalNumber,
  maxHeightDifferenceM: optionalNumber,
  includedPipeLengthM: optionalNumber,
  additionalChargeGPerM: optionalNumber,
  liquidPipeDiameter: text(80),
  gasPipeDiameter: text(80),

  hydraulicConnections: text(160),
  minimumFlow: text(120),
  minimumWaterVolume: text(120),
  maximumFlowTemperature: text(120),
  bufferTankRecommendation: text(500),

  nominalPowerKw: optionalNumber,

  commissioningNotes: text(10_000),
  installationNotes: text(20_000),
  internalNotes: text(20_000),
});

export type ManufacturerInput = z.infer<typeof manufacturerInputSchema>;
export type ProductRangeInput = z.infer<typeof productRangeInputSchema>;
export type EquipmentInput = z.infer<typeof equipmentInputSchema>;

const equipmentDefaults = {
  productRangeId: "",
  electricalSupply: "",
  recommendedProtection: "",
  powerCable: "",
  communicationCable: "",
  refrigerantId: "",
  factoryChargeKg: "",
  maxPipeLengthM: "",
  maxHeightDifferenceM: "",
  includedPipeLengthM: "",
  additionalChargeGPerM: "",
  liquidPipeDiameter: "",
  gasPipeDiameter: "",
  hydraulicConnections: "",
  minimumFlow: "",
  minimumWaterVolume: "",
  maximumFlowTemperature: "",
  bufferTankRecommendation: "",
  nominalPowerKw: "",
  commissioningNotes: "",
  installationNotes: "",
  internalNotes: "",
};

export function equipmentFormData(formData: FormData) {
  return {
    ...equipmentDefaults,
    ...Object.fromEntries(formData),
  };
}

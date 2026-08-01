import type {
  ElectricalSupply,
  EquipmentType,
  HeatPumpSplitLiaisonType,
  HeatPumpType,
  TechnicalDocumentType,
} from "@/generated/prisma/enums";

export const equipmentTypeLabels: Record<EquipmentType, string> = {
  INDOOR_UNIT: "Unité intérieure",
  OUTDOOR_UNIT: "Unité extérieure",
  MONOBLOC: "Monobloc",
  ACCESSORY: "Accessoire",
  CONTROLLER: "Régulation",
  OTHER: "Autre",
};

export const electricalSupplyLabels: Record<ElectricalSupply, string> = {
  SINGLE_PHASE: "Monophasé",
  THREE_PHASE: "Triphasé",
};

export const heatPumpTypeLabels: Record<HeatPumpType, string> = {
  AIR_WATER: "Air / eau",
  AIR_AIR: "Air / air",
  GROUND_WATER: "Sol / eau",
};

export const splitLiaisonTypeLabels: Record<
  HeatPumpSplitLiaisonType,
  string
> = {
  FRIGORIFIC: "Frigorifique",
  HYDRAULIC: "Hydraulique",
};

export const technicalDocumentTypeLabels: Record<
  TechnicalDocumentType,
  string
> = {
  INSTALLATION_MANUAL: "Manuel d’installation",
  USER_MANUAL: "Manuel utilisateur",
  DATASHEET: "Fiche technique",
  WIRING_DIAGRAM: "Schéma électrique",
  ERROR_CODES: "Codes erreur",
  CERTIFICATE: "Certificat",
  OTHER: "Autre",
};

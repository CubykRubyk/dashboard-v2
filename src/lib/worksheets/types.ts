import type { MaterialInputType, MaterialUnit } from "@/generated/prisma/enums";

export interface CatalogVariant {
  id: string;
  name: string;
  reportLabel: string;
}

export interface CatalogMaterial {
  id: string;
  key: string;
  name: string;
  reportLabel: string;
  inputType: MaterialInputType;
  unit: MaterialUnit;
  defaultQuantity: number;
  detailLabel: string | null;
  allowSupplier: boolean;
  allowNotInstalled: boolean;
  variants: CatalogVariant[];
}

export interface CatalogCategory {
  id: string;
  key: string;
  name: string;
  materials: CatalogMaterial[];
}

export interface WorkSheetSelection {
  materialId: string;
  selected: boolean;
  variantId: string;
  quantity: number;
  detailValue: number;
  supplier: "INTERNAL" | "COMPANY";
  installed: boolean;
}

export interface WorkSheetInstallationInput {
  designation: string;
  quantity: number;
  supplier: "INTERNAL" | "COMPANY";
  sourceSupplier: string;
  deliveryNote: string;
  installed: boolean;
}

export interface WorkSheetFormData {
  workDate: string;
  client: string;
  company: string;
  installer: string;
  eventId: string;
  mainInstallations: string;
  installations: WorkSheetInstallationInput[];
  otherMaterials: string;
  reportText: string;
  reportFrozen: boolean;
  tagIds: string[];
  selections: WorkSheetSelection[];
}

export interface WorkSheetTagOption {
  id: string;
  name: string;
  color: string;
  active: boolean;
}

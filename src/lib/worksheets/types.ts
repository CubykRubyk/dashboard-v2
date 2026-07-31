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

export interface WorkSheetFormData {
  workDate: string;
  client: string;
  company: string;
  installer: string;
  eventId: string;
  mainInstallations: string;
  otherMaterials: string;
  reportText: string;
  reportFrozen: boolean;
  selections: WorkSheetSelection[];
}

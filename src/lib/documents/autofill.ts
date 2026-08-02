import { IMAGE_AUTOFILL_KEYS, type AutofillKey, type TemplateFieldConfig } from "@/lib/documents/types";

export interface AutofillEventInfo {
  client: string;
  company: string;
  address: string;
  installer: string;
  workDate: string;
}

export interface AutofillIssuerInfo {
  defaultResponsible: string;
  refrigerantAttestationNumber: string;
  leakDetectorId: string;
  leakDetectorInspectionDate: string;
}

function autofillValue(
  key: AutofillKey,
  event: AutofillEventInfo,
  issuer: AutofillIssuerInfo | null,
): string {
  switch (key) {
    case "client": return event.client;
    case "company": return event.company;
    case "address": return event.address;
    case "installer": return event.installer;
    case "workDate": return event.workDate;
    case "issuerResponsible": return issuer?.defaultResponsible ?? "";
    case "issuerAttestationNumber": return issuer?.refrigerantAttestationNumber ?? "";
    case "issuerLeakDetectorId": return issuer?.leakDetectorId ?? "";
    case "issuerLeakDetectorDate": return issuer?.leakDetectorInspectionDate ?? "";
    case "signature":
    case "stamp":
    default:
      return "";
  }
}

export function buildAutoFilledFields(
  event: AutofillEventInfo,
  issuer: AutofillIssuerInfo | null,
  fields: TemplateFieldConfig[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of fields) {
    if (!field.enabled || !field.autofillKey || IMAGE_AUTOFILL_KEYS.has(field.autofillKey)) continue;
    const value = autofillValue(field.autofillKey, event, issuer);
    if (value) result[field.name] = value;
  }
  return result;
}

export type DocumentFieldType = "text" | "checkbox";

export type AutofillKey =
  | "client"
  | "company"
  | "address"
  | "workDate"
  | "installer"
  | "issuerResponsible"
  | "issuerAttestationNumber"
  | "issuerLeakDetectorId"
  | "issuerLeakDetectorDate"
  | "signature"
  | "stamp";

export const AUTOFILL_KEY_LABELS: Record<AutofillKey, string> = {
  client: "Nom du client",
  company: "Société du client",
  address: "Adresse du client",
  workDate: "Date d'intervention",
  installer: "Installateur",
  issuerResponsible: "Responsable émetteur",
  issuerAttestationNumber: "N° d'attestation fluides",
  issuerLeakDetectorId: "ID détecteur de fuites",
  issuerLeakDetectorDate: "Date de contrôle du détecteur",
  signature: "Signature (image)",
  stamp: "Tampon de la société (image)",
};

/** autofillKey values rendered as an embedded image rather than a text/checkbox form field. */
export const IMAGE_AUTOFILL_KEYS: ReadonlySet<AutofillKey> = new Set(["signature", "stamp"]);

export interface TemplateFieldConfig {
  name: string;
  type: DocumentFieldType;
  label: string;
  section: string;
  position: number;
  enabled: boolean;
  autofillKey?: AutofillKey;
}

export const DEFAULT_SECTION = "Général";

const AUTOFILL_KEYS = new Set<string>(Object.keys(AUTOFILL_KEY_LABELS));

export function isAutofillKey(value: unknown): value is AutofillKey {
  return typeof value === "string" && AUTOFILL_KEYS.has(value);
}

/** Drops autofillKey values that no longer exist (e.g. removed from AUTOFILL_KEY_LABELS after a field was saved). */
export function sanitizeTemplateFields(fields: TemplateFieldConfig[]): TemplateFieldConfig[] {
  return fields.map((field) => (
    field.autofillKey && !isAutofillKey(field.autofillKey)
      ? { ...field, autofillKey: undefined }
      : field
  ));
}

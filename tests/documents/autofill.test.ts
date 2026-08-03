import assert from "node:assert/strict";
import test from "node:test";
import { buildAutoFilledFields, type AutofillEventInfo, type AutofillIssuerInfo } from "../../src/lib/documents/autofill";
import { DocumentError } from "../../src/lib/documents/errors";
import { isAutofillKey, sanitizeTemplateFields, type TemplateFieldConfig } from "../../src/lib/documents/types";

function field(overrides: Partial<TemplateFieldConfig> = {}): TemplateFieldConfig {
  return {
    name: "field1",
    type: "text",
    label: "Champ 1",
    section: "Général",
    position: 0,
    enabled: true,
    ...overrides,
  };
}

const event: AutofillEventInfo = {
  client: "Jean Dupont",
  company: "N.S SERVICES",
  address: "12 rue des Fleurs",
  installer: "Paul Martin",
  workDate: "2026-08-02",
};

const issuer: AutofillIssuerInfo = {
  defaultResponsible: "Marie Curie",
  refrigerantAttestationNumber: "ATT-123",
  leakDetectorId: "DET-7",
  leakDetectorInspectionDate: "2026-01-15",
};

test("buildAutoFilledFields maps each autofillKey to its event/issuer value", () => {
  const fields = [
    field({ name: "client_field", autofillKey: "client" }),
    field({ name: "company_field", autofillKey: "company" }),
    field({ name: "responsible_field", autofillKey: "issuerResponsible" }),
  ];
  assert.deepEqual(buildAutoFilledFields(event, issuer, fields), {
    client_field: "Jean Dupont",
    company_field: "N.S SERVICES",
    responsible_field: "Marie Curie",
  });
});

test("buildAutoFilledFields skips disabled fields and fields without an autofillKey", () => {
  const fields = [
    field({ name: "disabled_field", autofillKey: "client", enabled: false }),
    field({ name: "no_key_field" }),
  ];
  assert.deepEqual(buildAutoFilledFields(event, issuer, fields), {});
});

test("buildAutoFilledFields skips image autofill keys (signature/stamp) — those are embedded, not text-filled", () => {
  const fields = [
    field({ name: "signature_field", autofillKey: "signature" }),
    field({ name: "stamp_field", autofillKey: "stamp" }),
  ];
  assert.deepEqual(buildAutoFilledFields(event, issuer, fields), {});
});

test("buildAutoFilledFields omits keys whose resolved value is empty", () => {
  const fields = [field({ name: "workdate_field", autofillKey: "workDate" })];
  const emptyEvent: AutofillEventInfo = { ...event, workDate: "" };
  assert.deepEqual(buildAutoFilledFields(emptyEvent, issuer, fields), {});
});

test("buildAutoFilledFields resolves issuer-dependent keys to empty string when issuer is null", () => {
  const fields = [field({ name: "responsible_field", autofillKey: "issuerResponsible" })];
  assert.deepEqual(buildAutoFilledFields(event, null, fields), {});
});

test("isAutofillKey accepts only known autofill keys", () => {
  assert.equal(isAutofillKey("client"), true);
  assert.equal(isAutofillKey("stamp"), true);
  assert.equal(isAutofillKey("unknown_key"), false);
  assert.equal(isAutofillKey(42), false);
});

test("sanitizeTemplateFields clears autofillKey values that no longer exist, keeps valid ones", () => {
  const fields = [
    field({ name: "a", autofillKey: "client" }),
    { ...field({ name: "b" }), autofillKey: "legacy_removed_key" } as unknown as TemplateFieldConfig,
  ];
  const sanitized = sanitizeTemplateFields(fields);
  assert.equal(sanitized[0].autofillKey, "client");
  assert.equal(sanitized[1].autofillKey, undefined);
});

test("DocumentError carries a stable name and the given error code", () => {
  const error = new DocumentError("Fichier introuvable.", "FILE_NOT_FOUND");
  assert.equal(error.name, "DocumentError");
  assert.equal(error.code, "FILE_NOT_FOUND");
  assert.equal(error.message, "Fichier introuvable.");
  assert.ok(error instanceof Error);
});

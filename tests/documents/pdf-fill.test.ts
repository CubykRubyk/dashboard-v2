import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { DocumentError } from "../../src/lib/documents/errors";
import { detectTemplateFields, fillDocumentTemplate } from "../../src/lib/documents/pdf-fill";
import type { TemplateFieldConfig } from "../../src/lib/documents/types";

async function buildFormPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([300, 200]);
  const form = pdfDoc.getForm();

  const textField = form.createTextField("client_name");
  textField.addToPage(page, { x: 20, y: 150, width: 200, height: 20 });

  const checkbox = form.createCheckBox("accepted");
  checkbox.addToPage(page, { x: 20, y: 100, width: 20, height: 20 });

  return pdfDoc.save();
}

test("detectTemplateFields reads AcroForm fields and classifies checkboxes vs text fields", async () => {
  const bytes = await buildFormPdf();
  const fields = await detectTemplateFields(bytes);
  const byName = new Map(fields.map((field) => [field.name, field]));

  assert.equal(byName.get("client_name")?.type, "text");
  assert.equal(byName.get("accepted")?.type, "checkbox");
  assert.equal(fields.every((field) => field.enabled), true);
});

test("detectTemplateFields rejects bytes that aren't a loadable PDF", async () => {
  await assert.rejects(
    detectTemplateFields(new TextEncoder().encode("not a pdf")),
    (error: unknown) => error instanceof DocumentError && error.code === "INVALID_FILE",
  );
});

test("fillDocumentTemplate fills text fields and flattens the form so no fields remain", async () => {
  const bytes = await buildFormPdf();
  const fields: TemplateFieldConfig[] = [
    { name: "client_name", type: "text", label: "Client", section: "Général", position: 0, enabled: true, autofillKey: "client" },
    { name: "accepted", type: "checkbox", label: "Accepté", section: "Général", position: 1, enabled: true },
  ];

  const filled = await fillDocumentTemplate(bytes, {
    dynamicFields: { client_name: "Jean Dupont" },
    enabledFields: ["accepted"],
    fields,
  });

  const reloaded = await PDFDocument.load(filled);
  assert.equal(reloaded.getForm().getFields().length, 0, "form fields should be flattened away");
});

test("fillDocumentTemplate ignores dynamicFields entries that don't match any real form field", async () => {
  const bytes = await buildFormPdf();
  const fields: TemplateFieldConfig[] = [
    { name: "client_name", type: "text", label: "Client", section: "Général", position: 0, enabled: true, autofillKey: "client" },
  ];

  const filled = await fillDocumentTemplate(bytes, {
    dynamicFields: { does_not_exist: "value" },
    enabledFields: [],
    fields,
  });

  const reloaded = await PDFDocument.load(filled);
  assert.equal(reloaded.getForm().getFields().length, 0);
});

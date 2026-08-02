import { PDFDocument, StandardFonts, type PDFPage, type PDFRef } from "pdf-lib";
import { DEFAULT_SECTION, type TemplateFieldConfig } from "@/lib/documents/types";
import { DocumentError } from "@/lib/documents/errors";

export async function detectTemplateFields(pdfBytes: Uint8Array): Promise<TemplateFieldConfig[]> {
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(pdfBytes);
  } catch {
    throw new DocumentError("Le fichier PDF n'a pas pu être lu.", "INVALID_FILE");
  }
  const fields = pdfDoc.getForm().getFields();
  return fields.map((field, index) => ({
    name: field.getName(),
    type: field.constructor.name.includes("CheckBox") ? "checkbox" : "text",
    label: field.getName(),
    section: DEFAULT_SECTION,
    position: index,
    enabled: true,
  }));
}

function findWidgetPage(pdfDoc: PDFDocument, widget: { P(): PDFRef | undefined }): PDFPage {
  const pageRef = widget.P();
  const pages = pdfDoc.getPages();
  if (pageRef) {
    const match = pages.find((page) => page.ref === pageRef);
    if (match) return match;
  }
  return pages[0];
}

export interface FillDocumentTemplateInput {
  dynamicFields: Record<string, string>;
  enabledFields: string[];
  fields: TemplateFieldConfig[];
  signatureImageBase64?: string;
  stampImageBase64?: string;
}

async function embedImageField(
  pdfDoc: PDFDocument,
  form: ReturnType<PDFDocument["getForm"]>,
  helvetica: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  fieldName: string,
  imageBase64: string,
) {
  try {
    const textField = form.getTextField(fieldName);
    const widgets = textField.acroField.getWidgets();
    if (widgets.length === 0) return;
    const rect = widgets[0].getRectangle();
    const page = findWidgetPage(pdfDoc, widgets[0]);
    textField.setText("");
    textField.updateAppearances(helvetica);
    const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
    const bytes = Buffer.from(base64Data, "base64");
    const image = imageBase64.includes("image/png")
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);
    const scale = Math.min(
      (rect.width - 10) / image.width,
      (rect.height - 10) / image.height,
    );
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    page.drawImage(image, {
      x: rect.x + (rect.width - drawW) / 2,
      y: rect.y + (rect.height - drawH) / 2,
      width: drawW,
      height: drawH,
    });
  } catch {
    // Image illisible ou champ incompatible : ignorée silencieusement.
  }
}

export async function fillDocumentTemplate(
  pdfBytes: Uint8Array,
  { dynamicFields, enabledFields, fields, signatureImageBase64, stampImageBase64 }: FillDocumentTemplateInput,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const zapf = await pdfDoc.embedFont(StandardFonts.ZapfDingbats);
  const fontSize = 8;
  const allFields = form.getFields();

  for (const [fieldName, value] of Object.entries(dynamicFields)) {
    if (!value) continue;
    const field = allFields.find((f) => f.getName() === fieldName);
    if (!field || field.constructor.name.includes("CheckBox")) continue;
    try {
      const textField = form.getTextField(fieldName);
      textField.setFontSize(fontSize);
      textField.setText(value);
      textField.updateAppearances(helvetica);
    } catch {
      // Champ incompatible avec la valeur fournie : ignoré silencieusement.
    }
  }

  const enabledSet = new Set(enabledFields);
  for (const field of allFields) {
    if (!field.constructor.name.includes("CheckBox")) continue;
    if (!enabledSet.has(field.getName())) continue;
    try {
      const checkbox = form.getCheckBox(field.getName());
      const widgets = checkbox.acroField.getWidgets();
      if (widgets.length === 0) continue;
      const rect = widgets[0].getRectangle();
      const page = findWidgetPage(pdfDoc, widgets[0]);
      page.drawText("✔", { x: rect.x + 0.5, y: rect.y - 1, size: 10, font: zapf });
    } catch {
      // Widget checkbox invalide : ignoré silencieusement.
    }
  }

  if (signatureImageBase64) {
    const signatureField = fields.find((f) => f.autofillKey === "signature" && f.enabled);
    if (signatureField) await embedImageField(pdfDoc, form, helvetica, signatureField.name, signatureImageBase64);
  }
  if (stampImageBase64) {
    const stampField = fields.find((f) => f.autofillKey === "stamp" && f.enabled);
    if (stampField) await embedImageField(pdfDoc, form, helvetica, stampField.name, stampImageBase64);
  }

  form.flatten();
  return pdfDoc.save();
}

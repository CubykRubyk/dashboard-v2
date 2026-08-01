"use server";

import { PDFDocument } from "pdf-lib";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTechnicalCatalogAdmin } from "@/lib/auth/authorization";
import { isPdfSignature, MAX_TEMPLATE_BYTES, pdfStorageName, sha256, writeNewPdf, removeOwnedPdf } from "@/lib/generation/template-storage";

const schema = z.object({ name: z.string().trim().min(1, "Le nom est requis.").max(160) });

export async function uploadDocumentTemplate(formData: FormData) {
  const user = await requireTechnicalCatalogAdmin();
  const { name } = schema.parse({ name: formData.get("name") });
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Sélectionnez un fichier PDF.");
  if (file.size > MAX_TEMPLATE_BYTES) throw new Error("Le PDF ne peut pas dépasser 25 Mo.");
  if (!file.name.toLowerCase().endsWith(".pdf") || file.type !== "application/pdf") {
    throw new Error("Le template doit être un fichier PDF.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdfSignature(bytes)) throw new Error("La signature du fichier PDF est invalide.");
  const checksumSha256 = sha256(bytes);
  const duplicate = await prisma.documentTemplate.findUnique({ where: { checksumSha256 }, select: { id: true, name: true } });
  if (duplicate) throw new Error(`Ce fichier existe déjà comme template « ${duplicate.name} ».`);

  let pdf: PDFDocument;
  try { pdf = await PDFDocument.load(bytes, { updateMetadata: false }); }
  catch { throw new Error("Le PDF ne peut pas être lu."); }
  const fields = pdf.getForm().getFields().map((field) => ({
    name: field.getName(),
    type: field.constructor.name,
  }));
  const storageName = pdfStorageName();
  await writeNewPdf(storageName, bytes);
  try {
    const template = await prisma.$transaction(async (tx) => {
      const created = await tx.documentTemplate.create({
        data: { name, originalFileName: file.name, storageName, mimeType: "application/pdf", sizeBytes: bytes.byteLength, checksumSha256, fields },
      });
      await tx.auditLog.create({ data: { userId: user.id, action: "DOCUMENT_TEMPLATE_CREATE", entityType: "DocumentTemplate", entityId: created.id, metadata: { name, originalFileName: file.name, checksumSha256, fieldCount: fields.length } } });
      return created;
    });
    revalidatePath("/documents/templates");
    void template;
  } catch (error) {
    await removeOwnedPdf(storageName);
    throw error;
  }
}

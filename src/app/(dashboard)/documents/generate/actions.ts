"use server";

import { PDFDocument } from "pdf-lib";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { dolibarrRequest, getDolibarrConfig } from "@/lib/dolibarr/client";
import { isPdfSignature, pdfStorageName, sha256, writeNewPdf, removeOwnedPdf, readPdf } from "@/lib/generation/template-storage";

const schema = z.object({ templateId: z.string().min(1), issuerId: z.string().min(1), systemCombinationId: z.string().optional(), dolibarrEventId: z.string().trim().min(1).max(80), manualFields: z.string().max(20_000).default("{}") });

type Event = { datep?: string; label?: string; location?: string; socid?: string | number; userownerid?: string | number };
type Thirdparty = { name?: string; address?: string; town?: string; zip?: string };

export async function generateDocument(formData: FormData) {
  const user = await requireUser();
  const input = schema.parse(Object.fromEntries(formData));
  let manualFields: Record<string, string | boolean>;
  try { manualFields = JSON.parse(input.manualFields) as Record<string, string | boolean>; }
  catch { throw new Error("Les champs manuels doivent être un objet JSON valide."); }
  const [template, issuer, combination, config] = await Promise.all([
    prisma.documentTemplate.findUnique({ where: { id: input.templateId } }),
    prisma.documentIssuer.findUnique({ where: { id: input.issuerId } }),
    input.systemCombinationId ? prisma.systemCombination.findUnique({ where: { id: input.systemCombinationId }, select: { id: true, name: true, indoorEquipment: { select: { manufacturerReference: true, name: true } }, outdoorEquipment: { select: { manufacturerReference: true, name: true } } } }) : null,
    getDolibarrConfig(),
  ]);
  if (!template?.active) throw new Error("Template introuvable ou inactif.");
  if (!issuer?.active) throw new Error("Société introuvable ou inactive.");
  if (input.systemCombinationId && !combination) throw new Error("La combinaison PAC est introuvable.");
  if (!config) throw new Error("Configurez d’abord la connexion Dolibarr.");
  const event = await dolibarrRequest<Event>(config, `/agendaevents/${encodeURIComponent(input.dolibarrEventId)}`);
  const thirdparty = event.socid ? await dolibarrRequest<Thirdparty>(config, `/thirdparties/${encodeURIComponent(String(event.socid))}`) : {};
  const bytes = await readPdf(template.storageName);
  if (!isPdfSignature(bytes)) throw new Error("Fișierul template lipsește sau nu este un PDF valid.");
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  const form = pdf.getForm();
  const automaticFields: Record<string, string | boolean> = {
    issuer_name: issuer.name,
    societe_nom: issuer.name,
    societe_adresse: issuer.address,
    societe_telephone: issuer.phone,
    societe_email: issuer.email,
    numero_attestation: issuer.refrigerantAttestationNumber,
    attestation_fluide: issuer.refrigerantAttestationNumber,
    detecteur_fuite_id: issuer.leakDetectorId,
    date_controle_detecteur: issuer.leakDetectorInspectionDate?.toISOString().slice(0, 10) || "",
    responsable: issuer.defaultResponsible,
    client: thirdparty.name || "",
    adresse_chantier: event.location || "",
    pac_combinaison: combination?.name || "",
    reference_ui: combination?.indoorEquipment.manufacturerReference || "",
    reference_ue: combination?.outdoorEquipment.manufacturerReference || "",
  };
  for (const [key, value] of Object.entries({ ...automaticFields, ...manualFields })) {
    try { if (typeof value === "boolean") form.getCheckBox(key).check(); else form.getTextField(key).setText(String(value)); } catch { /* un champ optionnel peut ne pas exister dans ce template */ }
  }
  form.flatten();
  const output = await pdf.save();
  const storageName = pdfStorageName();
  await writeNewPdf(storageName, output);
  const clientName = thirdparty.name || "";
  const siteAddress = event.location || [thirdparty.address, thirdparty.zip, thirdparty.town].filter(Boolean).join(", ");
  const title = event.label || `${template.name} – ${input.dolibarrEventId}`;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.generatedDocument.create({ data: { templateId: template.id, issuerId: issuer.id, systemCombinationId: combination?.id, title, originalFileName: `${title.replace(/[^a-z0-9_-]+/gi, "_")}.pdf`, storageName, sizeBytes: output.byteLength, checksumSha256: sha256(output), dolibarrEventId: input.dolibarrEventId, dateDocument: event.datep ? new Date(event.datep) : null, clientName, siteAddress, responsible: issuer.defaultResponsible, manualFields, sourceSnapshot: { event, thirdparty, systemCombinationId: combination?.id || null } } });
      await tx.auditLog.create({ data: { userId: user.id, action: "GENERATED_DOCUMENT_CREATE", entityType: "GeneratedDocument", metadata: { templateId: template.id, issuerId: issuer.id, dolibarrEventId: input.dolibarrEventId } } });
    });
  } catch (error) { await removeOwnedPdf(storageName); throw error; }
  revalidatePath("/documents");
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { canGenerateDocuments } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { GenerateDocumentForm } from "@/components/documents/GenerateDocumentForm";
import { sanitizeTemplateFields, type TemplateFieldConfig } from "@/lib/documents/types";

export const dynamic = "force-dynamic";

export default async function GenerateDocumentPage() {
  const user = await getSession();
  if (!user || !canGenerateDocuments(user.role)) redirect("/documents");

  const [templates, issuers] = await Promise.all([
    prisma.documentTemplate.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.documentIssuer.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Documents</p>
          <h1>Générer un document</h1>
          <p>Récupérez les informations depuis un événement Dolibarr ou saisissez-les manuellement.</p>
        </div>
      </div>
      <GenerateDocumentForm
        templates={templates.map((template) => ({
          id: template.id,
          name: template.name,
          fields: sanitizeTemplateFields((template.fields as unknown as TemplateFieldConfig[]) ?? []),
        }))}
        issuers={issuers.map((issuer) => ({
          id: issuer.id,
          name: issuer.name,
          defaultResponsible: issuer.defaultResponsible,
          refrigerantAttestationNumber: issuer.refrigerantAttestationNumber,
          leakDetectorId: issuer.leakDetectorId,
          leakDetectorInspectionDate: issuer.leakDetectorInspectionDate
            ? issuer.leakDetectorInspectionDate.toISOString().slice(0, 10)
            : "",
          signatureData: issuer.signatureData,
        }))}
      />
    </>
  );
}

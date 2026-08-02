import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { canManageDocumentTemplates } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { TemplateFieldEditor } from "@/components/documents/TemplateFieldEditor";
import { sanitizeTemplateFields, type TemplateFieldConfig } from "@/lib/documents/types";

export const dynamic = "force-dynamic";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user || !canManageDocumentTemplates(user.role)) redirect("/documents");
  const { id } = await params;

  const template = await prisma.documentTemplate.findUnique({ where: { id } });
  if (!template) notFound();

  const fields = sanitizeTemplateFields(
    Array.isArray(template.fields) ? (template.fields as unknown as TemplateFieldConfig[]) : [],
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Documents</p>
          <h1>{template.name}</h1>
          <p>Configurez les champs détectés dans ce modèle PDF.</p>
        </div>
      </div>

      <TemplateFieldEditor
        templateId={template.id}
        initialName={template.name}
        initialActive={template.active}
        initialFields={fields}
      />
    </>
  );
}

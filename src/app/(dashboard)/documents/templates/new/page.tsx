import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { canManageDocumentTemplates } from "@/lib/auth/permissions";
import { TemplateUploadForm } from "@/components/documents/TemplateUploadForm";

export default async function NewTemplatePage() {
  const user = await getSession();
  if (!user || !canManageDocumentTemplates(user.role)) redirect("/documents");

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Documents</p>
          <h1>Ajouter un modèle</h1>
          <p>Importez un PDF avec des champs de formulaire (AcroForm).</p>
        </div>
      </div>

      <section className="card">
        <TemplateUploadForm />
      </section>
    </>
  );
}

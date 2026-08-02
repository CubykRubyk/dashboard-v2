import Link from "next/link";
import { CirclePlus, FileText, Pencil } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { canManageDocumentTemplates } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DocumentTemplatesPage() {
  const user = await getSession();
  if (!user || !canManageDocumentTemplates(user.role)) redirect("/documents");

  const templates = await prisma.documentTemplate.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { generatedDocuments: true } } },
  });

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Documents</p>
          <h1>Modèles de documents</h1>
          <p>Gérez les modèles PDF utilisés pour générer les documents des fiches chantier.</p>
        </div>
        <Link className="button button-primary" href="/documents/templates/new">
          <CirclePlus size={17} /> Ajouter un modèle
        </Link>
      </div>

      <section className="card">
        {templates.length === 0 ? (
          <p className="docgen-empty">Aucun modèle n&apos;a encore été ajouté.</p>
        ) : (
          <div className="docgen-list">
            {templates.map((template) => {
              const fields = Array.isArray(template.fields) ? template.fields : [];
              return (
                <Link
                  key={template.id}
                  href={`/documents/templates/${template.id}`}
                  className="docgen-row"
                >
                  <span className="docgen-row-icon"><FileText size={18} /></span>
                  <span className="docgen-row-main">
                    <strong>{template.name}</strong>
                    <small>
                      {fields.length} champ{fields.length > 1 ? "s" : ""} · {template._count.generatedDocuments} document{template._count.generatedDocuments > 1 ? "s" : ""} généré{template._count.generatedDocuments > 1 ? "s" : ""}
                    </small>
                  </span>
                  <span className={`badge ${template.active ? "badge-success" : ""}`}>
                    {template.active ? "Actif" : "Inactif"}
                  </span>
                  <Pencil size={16} />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

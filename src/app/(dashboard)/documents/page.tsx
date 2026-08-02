import Link from "next/link";
import { CirclePlus, FileStack } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { canGenerateDocuments, canManageDocumentTemplates } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { GeneratedDocumentActions } from "@/components/documents/GeneratedDocumentActions";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function GeneratedDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSession();
  if (!user || !canGenerateDocuments(user.role)) redirect("/");

  const params = await searchParams;
  const q = valueOf(params.q).trim().slice(0, 160);
  const templateId = valueOf(params.templateId);

  const where: Prisma.GeneratedDocumentWhereInput = {
    ...(q ? { clientLabel: { contains: q, mode: "insensitive" } } : {}),
    ...(templateId ? { templateId } : {}),
  };

  const [documents, templates] = await Promise.all([
    prisma.generatedDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        template: { select: { id: true, name: true } },
        issuer: { select: { name: true } },
      },
    }),
    prisma.documentTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Documents</p>
          <h1>Documents générés</h1>
          <p>Historique des documents produits à partir des événements Dolibarr.</p>
        </div>
        <div className="page-heading-actions">
          <Link className="button button-primary" href="/documents/generate">
            <CirclePlus size={17} /> Générer un document
          </Link>
          {canManageDocumentTemplates(user.role) && (
            <Link className="button button-ghost" href="/documents/templates">
              Modèles de documents
            </Link>
          )}
        </div>
      </div>

      <form className="card reports-filters" method="get">
        <label>
          Client
          <input type="text" name="q" defaultValue={q} placeholder="Nom du client…" />
        </label>
        <label>
          Modèle
          <select name="templateId" defaultValue={templateId}>
            <option value="">Tous</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        </label>
        <button className="button button-primary">Filtrer</button>
        {(q || templateId) && (
          <Link className="button button-ghost" href="/documents">Réinitialiser</Link>
        )}
      </form>

      <section className="card">
        {documents.length === 0 ? (
          <p className="docgen-empty">Aucun document trouvé.</p>
        ) : (
          <div className="docgen-list">
            {documents.map((doc) => (
              <div key={doc.id} className="docgen-row">
                <span className="docgen-row-icon"><FileStack size={18} /></span>
                <span className="docgen-row-main">
                  <strong>{doc.clientLabel || "Client non renseigné"}</strong>
                  <small>
                    {doc.template.name}
                    {doc.eventId ? ` · Événement ${doc.eventId}` : ""}
                    {doc.issuer ? ` · ${doc.issuer.name}` : ""} · {dateFormatter.format(doc.createdAt)}
                  </small>
                </span>
                <GeneratedDocumentActions documentId={doc.id} />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

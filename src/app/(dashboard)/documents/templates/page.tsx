import Link from "next/link";
import { FileText, Plus, UploadCloud } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export default async function DocumentTemplatesPage() {
  const [templates, session] = await Promise.all([
    prisma.documentTemplate.findMany({ orderBy: [{ active: "desc" }, { updatedAt: "desc" }] }),
    getSession(),
  ]);
  const canEdit = session?.role === "ADMIN";
  return <main className="page-shell"><div className="page-heading"><div><p className="eyebrow">Documents générés</p><h1>Templates PDF</h1><p className="page-subtitle">Une bibliothèque de modèles réutilisables pour vos documents techniques.</p></div><div className="button-row"><Link className="button secondary" href="/documents">Documents générés</Link>{canEdit && <Link className="button" href="/documents/templates/new"><Plus size={16} /> Ajouter un template</Link>}</div></div>{templates.length === 0 ? <section className="document-empty-hero template-empty"><div className="document-empty-icon"><FileText size={32} /></div><h2>Votre bibliothèque est vide</h2><p>Importez un PDF avec des champs AcroForm pour pouvoir le réutiliser lors de la génération.</p>{canEdit && <Link className="button" href="/documents/templates/new"><UploadCloud size={16} /> Importer le premier template</Link>}</section> : <section className="card"><div className="section-heading"><div><p className="eyebrow">Bibliothèque</p><h2>Templates disponibles</h2></div><span className="badge">{templates.length}</span></div><div className="template-card-grid">{templates.map((template) => { const fields = Array.isArray(template.fields) ? template.fields as Array<{ name?: string; type?: string }> : []; return <article className="template-card" key={template.id}><div className="template-card-icon"><FileText size={21} /></div><div className="template-card-heading"><div><strong>{template.name}</strong><p className="muted">{template.originalFileName}</p></div><span className={`status-pill ${template.active ? "active" : "inactive"}`}>{template.active ? "Actif" : "Inactif"}</span></div><div className="template-card-meta"><span>{fields.length} champs</span><span>{(template.sizeBytes / 1024 / 1024).toFixed(1)} Mo</span><span>v{template.version}</span></div>{fields.length > 0 && <details><summary>Voir les champs</summary><p className="muted">{fields.map((field) => `${field.name || "?"} (${field.type || "champ"})`).join(" · ")}</p></details>}</article>; })}</div></section>}</main>;
}

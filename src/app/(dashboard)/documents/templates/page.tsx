import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { uploadDocumentTemplate } from "./actions";

export default async function DocumentTemplatesPage() {
  const [templates, session] = await Promise.all([
    prisma.documentTemplate.findMany({ orderBy: [{ active: "desc" }, { updatedAt: "desc" }] }),
    getSession(),
  ]);
  const canEdit = session?.role === "ADMIN";
  return <main className="page-shell">
    <div className="page-heading"><div><p className="eyebrow">Documents générés</p><h1>Templates PDF</h1><p className="page-subtitle">Chargez une fois un modèle PDF avec ses champs, séparément des fiches de chantier.</p></div><Link className="button secondary" href="/documents">Retour aux documents</Link></div>
    {canEdit && <form action={uploadDocumentTemplate} className="card issuer-form" encType="multipart/form-data"><h2>Nouveau template</h2><div className="form-grid"><label>Nom<input name="name" required maxLength={160} placeholder="PV de mise en service" /></label><label>Fichier PDF<input name="file" type="file" accept="application/pdf,.pdf" required /></label></div><button className="button" type="submit">Téléverser le template</button><p className="muted">Maximum 25 Mo. Les champs AcroForm sont détectés automatiquement.</p></form>}
    <section className="card"><div className="section-heading"><h2>Templates disponibles</h2><span className="badge">{templates.length}</span></div>{templates.length === 0 ? <p className="empty-state">Aucun template chargé.</p> : <div className="stack-list">{templates.map((template) => { const fields = Array.isArray(template.fields) ? template.fields as Array<{ name?: string; type?: string }> : []; return <article className="list-row" key={template.id}><div><strong>{template.name}</strong><p className="muted">{template.originalFileName} · {fields.length} champs · {(template.sizeBytes / 1024 / 1024).toFixed(1)} Mo</p>{fields.length > 0 && <details><summary>Voir les champs</summary><p className="muted">{fields.map((field) => `${field.name || "?"} (${field.type || "champ"})`).join(" · ")}</p></details>}</div><span className={`status-pill ${template.active ? "active" : "inactive"}`}>{template.active ? "Actif" : "Inactif"}</span></article>; })}</div>}</section>
  </main>;
}

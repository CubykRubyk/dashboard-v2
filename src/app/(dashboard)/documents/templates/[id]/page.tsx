import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Pencil, Trash2 } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { deleteDocumentTemplate, updateDocumentTemplate } from "../actions";

export default async function DocumentTemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [template, session] = await Promise.all([
    prisma.documentTemplate.findUnique({ where: { id }, include: { _count: { select: { generatedDocuments: true } } } }),
    getSession(),
  ]);
  if (!template) notFound();
  const fields = Array.isArray(template.fields) ? template.fields as Array<{ name?: string; type?: string }> : [];
  const canEdit = session?.role === "ADMIN";
  return <main className="page-shell"><div className="page-heading"><div><p className="eyebrow">Bibliothèque de templates</p><h1>{template.name}</h1><p className="page-subtitle">{template.originalFileName} · {fields.length} champs détectés</p></div><div className="button-row"><Link className="button secondary" href="/documents/templates">Retour</Link><Link className="button" href={`/documents/generate?templateId=${template.id}`}><FileText size={16} /> Utiliser ce template</Link></div></div><div className="template-detail-grid"><section className="card template-detail-summary"><div className="template-detail-icon"><FileText size={28} /></div><h2>Informations</h2><dl><div><dt>Nom du fichier</dt><dd>{template.originalFileName}</dd></div><div><dt>Taille</dt><dd>{(template.sizeBytes / 1024 / 1024).toFixed(1)} Mo</dd></div><div><dt>Version</dt><dd>v{template.version}</dd></div><div><dt>Documents générés</dt><dd>{template._count.generatedDocuments}</dd></div><div><dt>Checksum</dt><dd className="template-checksum">{template.checksumSha256}</dd></div></dl></section><section className="card"><div className="section-heading"><div><p className="eyebrow">AcroForm</p><h2>Champs du template</h2></div><span className="badge">{fields.length}</span></div>{fields.length === 0 ? <p className="empty-state">Ce PDF ne contient aucun champ AcroForm.</p> : <div className="template-field-list">{fields.map((field, index) => <div className="template-field-row" key={`${field.name}-${index}`}><span>{index + 1}</span><div><strong>{field.name || "Champ sans nom"}</strong><small>{field.type || "Champ PDF"}</small></div></div>)}</div>}</section></div>{canEdit && <section className="card template-edit-panel"><div className="section-heading"><div><p className="eyebrow">Administration</p><h2>Modifier le template</h2></div><Pencil size={18} /></div><form action={updateDocumentTemplate.bind(null, template.id)} className="template-edit-form"><label>Nom<input name="name" defaultValue={template.name} required maxLength={160} /></label><label>Statut<select name="active" defaultValue={String(template.active)}><option value="true">Actif</option><option value="false">Inactif</option></select></label><button className="button" type="submit">Enregistrer</button></form><form action={deleteDocumentTemplate.bind(null, template.id)} className="template-delete-form"><button className="button danger" type="submit"><Trash2 size={15} /> Supprimer le template</button><small className="muted">La suppression est refusée si des documents ont déjà été générés avec ce template.</small></form></section>}</main>;
}

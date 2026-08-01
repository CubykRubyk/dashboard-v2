import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { generateDocument } from "./actions";

export default async function GenerateDocumentPage() {
  const [templates, issuers, combinations] = await Promise.all([
    prisma.documentTemplate.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.documentIssuer.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.systemCombination.findMany({ where: { active: true }, include: { indoorEquipment: true, outdoorEquipment: true }, orderBy: { name: "asc" } }),
  ]);
  return <main className="page-shell"><div className="page-heading"><div><p className="eyebrow">Documents générés</p><h1>Générer un document</h1><p className="page-subtitle">L’ID Dolibarr fournit le chantier; les champs absents restent manuels.</p></div><Link className="button secondary" href="/documents">Annuler</Link></div><form action={generateDocument} className="card issuer-form"><div className="form-grid"><label>Template<select name="templateId" required defaultValue=""><option value="" disabled>Choisir un template</option>{templates.map((t) => <option value={t.id} key={t.id}>{t.name}</option>)}</select></label><label>Société émettrice<select name="issuerId" required defaultValue=""><option value="" disabled>Choisir une société</option>{issuers.map((i) => <option value={i.id} key={i.id}>{i.name}</option>)}</select></label><label>Combinaison PAC (optionnel)<select name="systemCombinationId" defaultValue=""><option value="">Aucune</option>{combinations.map((c) => <option value={c.id} key={c.id}>{c.name} · {c.outdoorEquipment.manufacturerReference} + {c.indoorEquipment.manufacturerReference}</option>)}</select></label><label>ID événement Dolibarr<input name="dolibarrEventId" required placeholder="1234" /></label></div><label>Champs manuels (JSON)<textarea name="manualFields" rows={8} defaultValue="{}" placeholder={'{"modele_pac":"...","date_controle":"..."}'} /></label><button className="button" type="submit">Générer le PDF</button><p className="muted">Les noms des champs doivent correspondre aux champs AcroForm du template.</p></form></main>;
}

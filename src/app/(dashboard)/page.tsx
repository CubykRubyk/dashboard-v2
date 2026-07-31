import { Boxes, FileOutput, FileText, Link2 } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [workSheets, activeMaterials, settings] = await Promise.all([
    prisma.workSheet.count({ where: { archivedAt: null } }),
    prisma.material.count({ where: { active: true, category: { active: true } } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  const dolibarrConfigured = Boolean(
    settings?.dolibarrUrl && settings.dolibarrApiKeyEncrypted,
  );
  const cards = [
    { label: "Fiches chantier", value: String(workSheets), note: "Fiches actives", icon: FileText, tone: "primary" },
    { label: "Documents générés", value: "—", note: "Prochain module", icon: FileOutput, tone: "success" },
    { label: "Matériel actif", value: String(activeMaterials), note: "Catalogue configurable", icon: Boxes, tone: "warning" },
    { label: "Dolibarr", value: dolibarrConfigured ? "Configuré" : "Non configuré", note: "Connexion serveur à serveur", icon: Link2, tone: "info" },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Vue d’ensemble</p>
          <h1>Dashboard</h1>
          <p>Le socle de la nouvelle application est opérationnel.</p>
        </div>
      </div>
      <section className="stats-grid" aria-label="Indicateurs">
        {cards.map(({ label, value, note, icon: Icon, tone }) => (
          <article className="stat-card" key={label}>
            <span className={`stat-icon ${tone}`}><Icon aria-hidden size={22} /></span>
            <div><p>{label}</p><strong>{value}</strong><small>{note}</small></div>
          </article>
        ))}
      </section>
      <section className="content-grid">
        <article className="card">
          <div className="card-header">
            <div><p className="eyebrow">Étape actuelle</p><h2>Socle de l’application</h2></div>
            <span className="badge badge-success">En cours</span>
          </div>
          <div className="milestone-list">
            <div className="milestone done"><span>1</span><div><strong>Projet séparé</strong><p>L’ancienne version reste intacte.</p></div></div>
            <div className="milestone done"><span>2</span><div><strong>Authentification et rôles</strong><p>L’accès à l’application est protégé.</p></div></div>
            <div className="milestone done"><span>3</span><div><strong>Catalogue configurable</strong><p>Matériels et modèles administrables.</p></div></div>
            <div className="milestone done"><span>4</span><div><strong>Intégration Dolibarr</strong><p>Événements et rapports connectés.</p></div></div>
          </div>
        </article>
        <article className="card accent-card">
          <p className="eyebrow">Objectif</p>
          <h2>Le même fonctionnement, sans listes figées dans le code.</h2>
          <p>Le matériel, les modèles et les templates seront gérés directement depuis les Paramètres.</p>
        </article>
      </section>
    </>
  );
}

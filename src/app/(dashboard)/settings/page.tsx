import Link from "next/link";
import { CirclePlus, Link2, Pencil, Power, PowerOff, Tags } from "lucide-react";
import { DismissibleDetails } from "@/components/ui/DismissibleDetails";
import { DeleteTagButton } from "@/components/settings/DeleteTagButton";
import { DolibarrSettingsForm } from "@/components/settings/DolibarrSettingsForm";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { createTag, deleteTag, toggleTag, updateTag } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "tags" ? "tags" : "dolibarr";
  const [user, tags, settings] = await Promise.all([
    getSession(),
    activeTab === "tags"
      ? prisma.tag.findMany({
          orderBy: [{ position: "asc" }, { name: "asc" }],
          include: { _count: { select: { workSheets: true } } },
        })
      : Promise.resolve([]),
    activeTab === "dolibarr"
      ? prisma.appSettings.findUnique({ where: { id: 1 } })
      : Promise.resolve(null),
  ]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Configuration</p>
          <h1>Paramètres</h1>
          <p>Configurez les éléments réutilisés dans l’application.</p>
        </div>
      </div>

      <nav className="settings-tabs" aria-label="Sections des paramètres">
        <Link
          href="/settings?tab=dolibarr"
          className={activeTab === "dolibarr" ? "active" : ""}
          aria-current={activeTab === "dolibarr" ? "page" : undefined}
        >
          <Link2 size={17} /> Dolibarr
        </Link>
        <Link
          href="/settings?tab=tags"
          className={activeTab === "tags" ? "active" : ""}
          aria-current={activeTab === "tags" ? "page" : undefined}
        >
          <Tags size={17} /> Tags
        </Link>
      </nav>

      {activeTab === "dolibarr" && (
      <section className="card settings-section" id="dolibarr">
        <div className="settings-heading">
          <div className="settings-title">
            <span className="settings-icon"><Link2 size={20} /></span>
            <div>
              <h2>Connexion Dolibarr</h2>
              <p>Configurez l’accès aux événements et l’envoi des rapports chantier.</p>
            </div>
          </div>
          <span className={`connection-state ${
            settings?.dolibarrUrl && settings.dolibarrApiKeyEncrypted ? "configured" : ""
          }`}>
            {settings?.dolibarrUrl && settings.dolibarrApiKeyEncrypted
              ? "Configuré"
              : "Non configuré"}
          </span>
        </div>
        {user?.role === "ADMIN" ? (
          <DolibarrSettingsForm
            initialUrl={settings?.dolibarrUrl || ""}
            configured={Boolean(settings?.dolibarrUrl && settings.dolibarrApiKeyEncrypted)}
          />
        ) : (
          <div className="alert alert-danger">Droits administrateur requis.</div>
        )}
      </section>
      )}

      {activeTab === "tags" && (
      <section className="card settings-section">
        <div className="settings-heading">
          <div className="settings-title">
            <span className="settings-icon"><Tags size={20} /></span>
            <div><h2>Tags des fiches chantier</h2><p>Identifiez rapidement le type d’installation réalisée.</p></div>
          </div>
          <DismissibleDetails
            summaryClassName="button button-primary"
            summary={<><CirclePlus size={17} /> Ajouter un tag</>}
          >
            <form action={createTag} className="tag-form">
              <label>Nom<input name="name" required placeholder="Ex. PAC air/eau" /></label>
              <label>Couleur<input name="color" type="color" defaultValue="#316aff" /></label>
              <button className="button button-primary">Enregistrer</button>
            </form>
          </DismissibleDetails>
        </div>

        {tags.length === 0 ? (
          <div className="settings-empty">Aucun tag configuré.</div>
        ) : (
          <div className="tag-settings-list">
            {tags.map((tag) => (
              <div className={`tag-settings-row${tag.active ? "" : " inactive"}`} key={tag.id}>
                <span className="tag-color" style={{ backgroundColor: tag.color }} />
                <strong>{tag.name}</strong>
                <span>{tag._count.workSheets} fiche{tag._count.workSheets > 1 ? "s" : ""}</span>
                <div className="tag-settings-actions">
                  <DismissibleDetails summaryClassName="mini-action" summary={<><Pencil size={14} /> Modifier</>}>
                    <form action={updateTag.bind(null, tag.id)} className="tag-form tag-edit-form">
                      <label>Nom<input name="name" required defaultValue={tag.name} /></label>
                      <label>Couleur<input name="color" type="color" defaultValue={tag.color} /></label>
                      <button className="button button-primary button-small">Enregistrer</button>
                    </form>
                  </DismissibleDetails>
                  <form action={toggleTag.bind(null, tag.id, !tag.active)}>
                    <button className={`status-button${tag.active ? " active" : ""}`}>
                      {tag.active ? <><Power size={14} /> Actif</> : <><PowerOff size={14} /> Inactif</>}
                    </button>
                  </form>
                  <DeleteTagButton
                    action={deleteTag.bind(null, tag.id)}
                    name={tag.name}
                    usageCount={tag._count.workSheets}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      )}
    </>
  );
}

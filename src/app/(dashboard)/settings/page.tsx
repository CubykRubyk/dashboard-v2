import Link from "next/link";
import Image from "next/image";
import { Building2, CirclePlus, Link2, Pencil, Power, PowerOff, Tags } from "lucide-react";
import { DismissibleDetails } from "@/components/ui/DismissibleDetails";
import { DeleteTagButton } from "@/components/settings/DeleteTagButton";
import { DolibarrSettingsForm } from "@/components/settings/DolibarrSettingsForm";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  createDocumentIssuer,
  createTag,
  deleteTag,
  toggleDocumentIssuer,
  toggleTag,
  updateDocumentIssuer,
  updateTag,
} from "./actions";

export const dynamic = "force-dynamic";

function dateInputValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "tags" || tab === "issuers" ? tab : "dolibarr";
  const [user, tags, issuers, settings] = await Promise.all([
    getSession(),
    activeTab === "tags"
      ? prisma.tag.findMany({
          orderBy: [{ position: "asc" }, { name: "asc" }],
          include: { _count: { select: { workSheets: true } } },
        })
      : Promise.resolve([]),
    activeTab === "issuers"
      ? prisma.documentIssuer.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] })
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
          href="/settings?tab=issuers"
          className={activeTab === "issuers" ? "active" : ""}
          aria-current={activeTab === "issuers" ? "page" : undefined}
        >
          <Building2 size={17} /> Sociétés émettrices
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

      {activeTab === "issuers" && (
        <section className="card settings-section">
          <div className="settings-heading">
            <div className="settings-title">
              <span className="settings-icon"><Building2 size={20} /></span>
              <div>
                <h2>Sociétés émettrices</h2>
                <p>Les sociétés utilisées pour générer les documents, séparées de Dolibarr.</p>
              </div>
            </div>
            {user?.role === "ADMIN" && (
              <DismissibleDetails
                summaryClassName="button button-primary"
                summary={<><CirclePlus size={17} /> Ajouter une société</>}
              >
                <form action={createDocumentIssuer} className="issuer-form">
                  <label>Nom<input name="name" required placeholder="Nom de la société" /></label>
                  <label>Adresse<textarea name="address" rows={2} /></label>
                  <label>Téléphone<input name="phone" /></label>
                  <label>Email<input name="email" type="email" /></label>
                  <label>Responsable par défaut<input name="defaultResponsible" /></label>
                  <label>N° attestation fluides frigorigènes<input name="refrigerantAttestationNumber" /></label>
                  <label>ID détecteur de fuite<input name="leakDetectorId" /></label>
                  <label>Date de contrôle<input name="leakDetectorInspectionDate" type="date" /></label>
                  <label>Logo<input name="logo" type="file" accept="image/png,image/jpeg" /></label>
                  <label>Tampon<input name="stamp" type="file" accept="image/png,image/jpeg" /></label>
                  <label>Signature<input name="signature" type="file" accept="image/png,image/jpeg" /></label>
                  <button className="button button-primary">Enregistrer</button>
                </form>
              </DismissibleDetails>
            )}
          </div>

          {user?.role !== "ADMIN" && (
            <div className="alert alert-danger">Droits administrateur requis pour modifier les sociétés.</div>
          )}
          {issuers.length === 0 ? (
            <div className="settings-empty">Aucune société émettrice configurée.</div>
          ) : (
            <div className="issuer-settings-list">
              {issuers.map((issuer) => (
                <div className={`issuer-settings-card${issuer.active ? "" : " inactive"}`} key={issuer.id}>
                  <div className="issuer-settings-heading">
                    <div className="issuer-identity">
                      {issuer.logoData ? <Image src={issuer.logoData} alt="" width={46} height={46} unoptimized /> : <Building2 size={22} />}
                      <div><strong>{issuer.name}</strong><span>{issuer.active ? "Active" : "Inactive"}</span></div>
                    </div>
                    {user?.role === "ADMIN" && (
                      <div className="tag-settings-actions">
                        <DismissibleDetails summaryClassName="mini-action" summary={<><Pencil size={14} /> Modifier</>}>
                          <form action={updateDocumentIssuer.bind(null, issuer.id)} className="issuer-form issuer-edit-form">
                            <label>Nom<input name="name" required defaultValue={issuer.name} /></label>
                            <label>Adresse<textarea name="address" rows={2} defaultValue={issuer.address} /></label>
                            <label>Téléphone<input name="phone" defaultValue={issuer.phone} /></label>
                            <label>Email<input name="email" type="email" defaultValue={issuer.email} /></label>
                            <label>Responsable par défaut<input name="defaultResponsible" defaultValue={issuer.defaultResponsible} /></label>
                            <label>N° attestation fluides frigorigènes<input name="refrigerantAttestationNumber" defaultValue={issuer.refrigerantAttestationNumber} /></label>
                            <label>ID détecteur de fuite<input name="leakDetectorId" defaultValue={issuer.leakDetectorId} /></label>
                            <label>Date de contrôle<input name="leakDetectorInspectionDate" type="date" defaultValue={dateInputValue(issuer.leakDetectorInspectionDate)} /></label>
                            <label>Logo<input name="logo" type="file" accept="image/png,image/jpeg" /></label>
                            <label>Tampon<input name="stamp" type="file" accept="image/png,image/jpeg" /></label>
                            <label>Signature<input name="signature" type="file" accept="image/png,image/jpeg" /></label>
                            <button className="button button-primary button-small">Enregistrer</button>
                          </form>
                        </DismissibleDetails>
                        <form action={toggleDocumentIssuer.bind(null, issuer.id, !issuer.active)}>
                          <button className={`status-button${issuer.active ? " active" : ""}`}>
                            {issuer.active ? <><PowerOff size={14} /> Désactiver</> : <><Power size={14} /> Activer</>}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                  <div className="issuer-assets">
                    <div>{issuer.stampData ? <Image src={issuer.stampData} alt="Tampon" width={88} height={45} unoptimized /> : <span>Tampon non chargé</span>}<small>Tampon</small></div>
                    <div>{issuer.signatureData ? <Image src={issuer.signatureData} alt="Signature" width={88} height={45} unoptimized /> : <span>Signature non chargée</span>}<small>Signature</small></div>
                  </div>
                  <div className="issuer-settings-details">
                    <span>{issuer.address || "Adresse non renseignée"}</span>
                    <span>{issuer.defaultResponsible || "Responsable non renseigné"}</span>
                    <span>{issuer.refrigerantAttestationNumber || "N° attestation non renseigné"}</span>
                    <span>{issuer.leakDetectorId || "Détecteur non renseigné"}</span>
                    <span>{issuer.leakDetectorInspectionDate ? `Contrôle ${issuer.leakDetectorInspectionDate.toLocaleDateString("fr-FR")}` : "Date de contrôle non renseignée"}</span>
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

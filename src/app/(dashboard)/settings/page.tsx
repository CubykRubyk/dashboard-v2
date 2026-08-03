import Link from "next/link";
import Image from "next/image";
import { Building2, CirclePlus, History, KeyRound, Link2, Pencil, Power, PowerOff, Tags, UserCog, UsersRound } from "lucide-react";
import { DismissibleDetails } from "@/components/ui/DismissibleDetails";
import { GxonModal } from "@/components/ui/GxonModal";
import { DeleteTagButton } from "@/components/settings/DeleteTagButton";
import { DeleteTeamButton } from "@/components/settings/DeleteTeamButton";
import { DolibarrSettingsForm } from "@/components/settings/DolibarrSettingsForm";
import { AuditLogSection } from "@/components/settings/AuditLogSection";
import { getSession } from "@/lib/auth/session";
import { canManageUsers, canViewAuditLog } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import {
  adminResetPassword,
  createDocumentIssuer,
  createTag,
  createTeam,
  createUser,
  deleteTag,
  deleteTeam,
  toggleDocumentIssuer,
  toggleTag,
  toggleTeam,
  toggleUser,
  updateDocumentIssuer,
  updateTag,
  updateTeam,
  updateUser,
} from "./actions";

const USER_ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrateur",
  OPERATOR: "Opérateur",
  VIEWER: "Lecteur",
  TECHNICIEN: "Technicien",
};

export const dynamic = "force-dynamic";

function dateInputValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const tab = resolvedSearchParams.tab;
  const user = await getSession();
  const requestedTab =
    tab === "tags" || tab === "issuers" || tab === "teams" || tab === "journal" || tab === "users"
      ? tab
      : "dolibarr";
  const activeTab =
    (requestedTab === "journal" && !canViewAuditLog(user?.role)) ||
    (requestedTab === "users" && !canManageUsers(user?.role))
      ? "dolibarr"
      : requestedTab;
  const [tags, issuers, teams, settings, users, activeTeams] = await Promise.all([
    activeTab === "tags"
      ? prisma.tag.findMany({
          orderBy: [{ position: "asc" }, { name: "asc" }],
          include: { _count: { select: { workSheets: true } } },
        })
      : Promise.resolve([]),
    activeTab === "issuers"
      ? prisma.documentIssuer.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] })
      : Promise.resolve([]),
    activeTab === "teams"
      ? prisma.team.findMany({
          orderBy: [{ active: "desc" }, { name: "asc" }],
          include: { _count: { select: { savTickets: true } } },
        })
      : Promise.resolve([]),
    activeTab === "dolibarr"
      ? prisma.appSettings.findUnique({ where: { id: 1 } })
      : Promise.resolve(null),
    activeTab === "users"
      ? prisma.user.findMany({
          orderBy: [{ active: "desc" }, { name: "asc" }],
          include: { team: true },
        })
      : Promise.resolve([]),
    activeTab === "users"
      ? prisma.team.findMany({ where: { active: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
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
        <Link
          href="/settings?tab=teams"
          className={activeTab === "teams" ? "active" : ""}
          aria-current={activeTab === "teams" ? "page" : undefined}
        >
          <UsersRound size={17} /> Équipes
        </Link>
        {canManageUsers(user?.role) && (
          <Link
            href="/settings?tab=users"
            className={activeTab === "users" ? "active" : ""}
            aria-current={activeTab === "users" ? "page" : undefined}
          >
            <UserCog size={17} /> Utilisateurs
          </Link>
        )}
        {canViewAuditLog(user?.role) && (
          <Link
            href="/settings?tab=journal"
            className={activeTab === "journal" ? "active" : ""}
            aria-current={activeTab === "journal" ? "page" : undefined}
          >
            <History size={17} /> Journal d’activité
          </Link>
        )}
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

      {activeTab === "teams" && (
      <section className="card settings-section">
        <div className="settings-heading">
          <div className="settings-title">
            <span className="settings-icon"><UsersRound size={20} /></span>
            <div><h2>Équipes SAV</h2><p>Utilisées pour l’assignation des bilets SAV dans Planification &amp; SAV.</p></div>
          </div>
          <DismissibleDetails
            summaryClassName="button button-primary"
            summary={<><CirclePlus size={17} /> Ajouter une équipe</>}
          >
            <form action={createTeam} className="tag-form">
              <label>Nom<input name="name" required placeholder="Ex. Équipe Nord" /></label>
              <button className="button button-primary">Enregistrer</button>
            </form>
          </DismissibleDetails>
        </div>

        {teams.length === 0 ? (
          <div className="settings-empty">Aucune équipe configurée.</div>
        ) : (
          <div className="tag-settings-list">
            {teams.map((team) => (
              <div className={`tag-settings-row${team.active ? "" : " inactive"}`} key={team.id}>
                <strong>{team.name}</strong>
                <span>{team._count.savTickets} bilet{team._count.savTickets > 1 ? "s" : ""}</span>
                <div className="tag-settings-actions">
                  <DismissibleDetails summaryClassName="mini-action" summary={<><Pencil size={14} /> Modifier</>}>
                    <form action={updateTeam.bind(null, team.id)} className="tag-form tag-edit-form">
                      <label>Nom<input name="name" required defaultValue={team.name} /></label>
                      <button className="button button-primary button-small">Enregistrer</button>
                    </form>
                  </DismissibleDetails>
                  <form action={toggleTeam.bind(null, team.id, !team.active)}>
                    <button className={`status-button${team.active ? " active" : ""}`}>
                      {team.active ? <><Power size={14} /> Actif</> : <><PowerOff size={14} /> Inactif</>}
                    </button>
                  </form>
                  {team._count.savTickets === 0 && (
                    <DeleteTeamButton action={deleteTeam.bind(null, team.id)} name={team.name} />
                  )}
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
              <GxonModal triggerClassName="button button-primary" trigger={<><CirclePlus size={17} /> Ajouter une société</>} title="Ajouter une société émettrice" description="Ces informations seront utilisées pour les documents techniques.">
                <form action={createDocumentIssuer} className="issuer-form">
                  <label>Nom<input name="name" required placeholder="Nom de la société" /></label>
                  <label>Adresse<textarea name="address" rows={2} /></label>
                  <label>Téléphone<input name="phone" /></label>
                  <label>Email<input name="email" type="email" /></label>
                  <label>Responsable par défaut<input name="defaultResponsible" /></label>
                  <label>N° attestation fluides frigorigènes<input name="refrigerantAttestationNumber" /></label>
                  <label>ID détecteur de fuite<input name="leakDetectorId" /></label>
                  <label>Date de contrôle<input name="leakDetectorInspectionDate" type="date" /></label>
                  <div className="issuer-form-assets">
                    <label>Logo<input name="logo" type="file" accept="image/png,image/jpeg" /></label>
                    <label>Tampon<input name="stamp" type="file" accept="image/png,image/jpeg" /></label>
                    <label>Signature<input name="signature" type="file" accept="image/png,image/jpeg" /></label>
                  </div>
                  <button className="button button-primary">Enregistrer</button>
                </form>
              </GxonModal>
            )}
          </div>

          {user?.role !== "ADMIN" && (
            <div className="alert alert-danger">Droits administrateur requis pour modifier les sociétés.</div>
          )}
          {issuers.length === 0 ? (
            <div className="settings-empty">Aucune société émettrice configurée.</div>
          ) : (
            <div className="entity-card-grid">
              {issuers.map((issuer) => (
                <div className={`entity-card${issuer.active ? "" : " inactive"}`} key={issuer.id}>
                  <div className="entity-card-top">
                    <span className="entity-card-icon">
                      {issuer.logoData ? <Image src={issuer.logoData} alt="" width={46} height={46} unoptimized /> : <Building2 size={22} />}
                    </span>
                    <div className="entity-card-title">
                      <h2>{issuer.name}</h2>
                      <p>{issuer.address || "Adresse non renseignée"}</p>
                    </div>
                    <span className={`entity-card-pill ${issuer.active ? "active" : "inactive"}`}>
                      {issuer.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="entity-card-rows">
                    <div className="entity-card-row"><span>Responsable</span><span>{issuer.defaultResponsible || "—"}</span></div>
                    <div className="entity-card-row"><span>N° attestation</span><span>{issuer.refrigerantAttestationNumber || "—"}</span></div>
                    <div className="entity-card-row"><span>Détecteur</span><span>{issuer.leakDetectorId || "—"}</span></div>
                    <div className="entity-card-row"><span>Contrôle</span><span>{issuer.leakDetectorInspectionDate ? issuer.leakDetectorInspectionDate.toLocaleDateString("fr-FR") : "—"}</span></div>
                  </div>
                  <div className="entity-card-assets">
                    <span className={`entity-card-asset${issuer.stampData ? " filled" : ""}`}>{issuer.stampData ? "Tampon ✓" : "Tampon"}</span>
                    <span className={`entity-card-asset${issuer.signatureData ? " filled" : ""}`}>{issuer.signatureData ? "Signature ✓" : "Signature"}</span>
                  </div>
                  {user?.role === "ADMIN" && (
                    <div className="entity-card-foot">
                      <GxonModal triggerClassName="mini-action" trigger={<><Pencil size={14} /> Modifier</>} title={`Modifier ${issuer.name}`} description="Les assets et informations de la société seront conservés.">
                        <form action={updateDocumentIssuer.bind(null, issuer.id)} className="issuer-form issuer-edit-form">
                          <label>Nom<input name="name" required defaultValue={issuer.name} /></label>
                          <label>Adresse<textarea name="address" rows={2} defaultValue={issuer.address} /></label>
                          <label>Téléphone<input name="phone" defaultValue={issuer.phone} /></label>
                          <label>Email<input name="email" type="email" defaultValue={issuer.email} /></label>
                          <label>Responsable par défaut<input name="defaultResponsible" defaultValue={issuer.defaultResponsible} /></label>
                          <label>N° attestation fluides frigorigènes<input name="refrigerantAttestationNumber" defaultValue={issuer.refrigerantAttestationNumber} /></label>
                          <label>ID détecteur de fuite<input name="leakDetectorId" defaultValue={issuer.leakDetectorId} /></label>
                          <label>Date de contrôle<input name="leakDetectorInspectionDate" type="date" defaultValue={dateInputValue(issuer.leakDetectorInspectionDate)} /></label>
                          <div className="issuer-form-assets">
                            <label>Logo<input name="logo" type="file" accept="image/png,image/jpeg" /><small>{issuer.logoData ? "Actuel : défini ✓" : "Aucun logo enregistré"}</small></label>
                            <label>Tampon<input name="stamp" type="file" accept="image/png,image/jpeg" /><small>{issuer.stampData ? "Actuel : défini ✓" : "Aucun tampon enregistré"}</small></label>
                            <label>Signature<input name="signature" type="file" accept="image/png,image/jpeg" /><small>{issuer.signatureData ? "Actuelle : définie ✓" : "Aucune signature enregistrée"}</small></label>
                          </div>
                          <button className="button button-primary button-small">Enregistrer</button>
                        </form>
                      </GxonModal>
                      <form action={toggleDocumentIssuer.bind(null, issuer.id, !issuer.active)}>
                        <button className={`status-button${issuer.active ? " active" : ""}`}>
                          {issuer.active ? <><PowerOff size={14} /> Désactiver</> : <><Power size={14} /> Activer</>}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "users" && (
        <section className="card settings-section">
          <div className="settings-heading">
            <div className="settings-title">
              <span className="settings-icon"><UserCog size={20} /></span>
              <div><h2>Utilisateurs</h2><p>Comptes ayant accès au CRM, rôles et affectation d’équipe.</p></div>
            </div>
            <GxonModal triggerClassName="button button-primary" trigger={<><CirclePlus size={17} /> Ajouter un utilisateur</>} title="Ajouter un utilisateur" description="Le mot de passe initial est à communiquer vous-même à la personne concernée.">
              <form action={createUser} className="issuer-form">
                <label>Nom<input name="name" required placeholder="Nom complet" /></label>
                <label>Email<input name="email" type="email" required placeholder="prenom.nom@exemple.fr" /></label>
                <label>Rôle
                  <select name="role" defaultValue="OPERATOR">
                    {Object.entries(USER_ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>Équipe <small>(optionnelle)</small>
                  <select name="teamId" defaultValue="">
                    <option value="">Aucune équipe</option>
                    {activeTeams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </label>
                <label>Mot de passe initial<input name="password" type="password" required minLength={12} placeholder="12 caractères minimum" /></label>
                <button className="button button-primary">Créer le compte</button>
              </form>
            </GxonModal>
          </div>

          {users.length === 0 ? (
            <div className="settings-empty">Aucun utilisateur.</div>
          ) : (
            <div className="entity-card-grid">
              {users.map((entry) => (
                <div className={`entity-card${entry.active ? "" : " inactive"}`} key={entry.id}>
                  <div className="entity-card-top">
                    <span className="entity-card-icon">{entry.name.slice(0, 1).toUpperCase()}</span>
                    <div className="entity-card-title">
                      <h2>{entry.name}</h2>
                      <p>{entry.email}</p>
                    </div>
                    <span className={`entity-card-pill ${entry.active ? "active" : "inactive"}`}>
                      {entry.active ? "Actif" : "Inactif"}
                    </span>
                  </div>
                  <div className="entity-card-rows">
                    <div className="entity-card-row"><span>Rôle</span><span>{USER_ROLE_LABELS[entry.role] ?? entry.role}</span></div>
                    <div className="entity-card-row"><span>Équipe</span><span>{entry.team?.name ?? "—"}</span></div>
                  </div>
                  <div className="entity-card-foot">
                    <GxonModal triggerClassName="mini-action" trigger={<><Pencil size={14} /> Modifier</>} title={`Modifier ${entry.name}`}>
                      <form action={updateUser.bind(null, entry.id)} className="issuer-form issuer-edit-form">
                        <label>Nom<input name="name" required defaultValue={entry.name} /></label>
                        <label>Email<input name="email" type="email" required defaultValue={entry.email} /></label>
                        <label>Rôle
                          <select name="role" defaultValue={entry.role}>
                            {Object.entries(USER_ROLE_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <label>Équipe <small>(optionnelle)</small>
                          <select name="teamId" defaultValue={entry.teamId ?? ""}>
                            <option value="">Aucune équipe</option>
                            {activeTeams.map((team) => (
                              <option key={team.id} value={team.id}>{team.name}</option>
                            ))}
                          </select>
                        </label>
                        <button className="button button-primary button-small">Enregistrer</button>
                      </form>
                    </GxonModal>
                    <GxonModal triggerClassName="mini-action" trigger={<><KeyRound size={14} /> Réinitialiser</>} title={`Réinitialiser le mot de passe de ${entry.name}`} description="Communiquez le nouveau mot de passe vous-même à la personne concernée.">
                      <form action={adminResetPassword.bind(null, entry.id)} className="issuer-form">
                        <label>Nouveau mot de passe<input name="password" type="password" required minLength={12} placeholder="12 caractères minimum" /></label>
                        <button className="button button-primary button-small">Réinitialiser</button>
                      </form>
                    </GxonModal>
                    <form action={toggleUser.bind(null, entry.id, !entry.active)}>
                      <button className={`status-button${entry.active ? " active" : ""}`} disabled={entry.id === user?.id}>
                        {entry.active ? <><PowerOff size={14} /> Désactiver</> : <><Power size={14} /> Activer</>}
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "journal" && <AuditLogSection searchParams={resolvedSearchParams} />}
    </>
  );
}

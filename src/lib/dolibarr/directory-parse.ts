/**
 * Lecture des réponses `/users` et `/thirdparties` de Dolibarr.
 *
 * Pas de `server-only` : module purement calculatoire, testable hors Next (même partage que
 * `event-payload.ts` vs `event-update.ts`). Les fixtures des tests sont les réponses réelles
 * fournies par Ion.
 */

export interface ParsedDolibarrUser {
  dolibarrId: string;
  name: string;
  login: string;
  email: string;
  job: string;
  color: string;
  isEmployee: boolean;
  active: boolean;
}

export interface ParsedDolibarrCompany {
  dolibarrId: string;
  name: string;
  address: string;
  zip: string;
  town: string;
  clientCode: string;
  active: boolean;
}

/**
 * Drapeau Dolibarr → booléen.
 *
 * Indispensable : **une même réponse mélange les types** — sur un tiers, `client: "1"` est une
 * chaîne alors que `prospect: 0` est un nombre. Un `=== "1"` marcherait sur l'un et échouerait
 * silencieusement sur l'autre.
 */
export function isTrue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    return trimmed !== "" && trimmed !== "0" && trimmed !== "false";
  }
  return false;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

/**
 * Nom affichable d'un utilisateur.
 *
 * Sur cette instance, `firstname` est souvent vide et `lastname` porte le nom entier
 * (« Gabriel S. »). Sans le repli sur `login`, des lignes sans nom apparaîtraient dans les
 * sélecteurs — invisibles à choisir.
 */
export function userDisplayName(user: Record<string, unknown>): string {
  const composed = [text(user.firstname), text(user.lastname)].filter(Boolean).join(" ").trim();
  return composed || text(user.login) || text(user.email) || `Utilisateur ${text(user.id)}`;
}

/** `color` arrive sans `#` (« cccccc »), comme pour la synchronisation des interventions. */
export function normalizeColor(value: unknown): string {
  const raw = text(value).replace(/^#/, "");
  return /^[0-9a-f]{3,8}$/i.test(raw) ? `#${raw}` : "";
}

export function parseDolibarrUser(raw: Record<string, unknown>): ParsedDolibarrUser | null {
  const dolibarrId = text(raw.id);
  if (!dolibarrId) return null;

  return {
    dolibarrId,
    name: userDisplayName(raw),
    login: text(raw.login),
    email: text(raw.email),
    job: text(raw.job),
    color: normalizeColor(raw.color),
    isEmployee: isTrue(raw.employee),
    // Côté utilisateur, c'est `statut` qui porte l'information (et non `status`).
    active: isTrue(raw.statut),
  };
}

/**
 * Un tiers n'est retenu que s'il est **client** : un fournisseur pur n'a rien à faire dans le
 * sélecteur de société d'une intervention. Renvoie `null` pour tout le reste.
 */
export function parseDolibarrCompany(raw: Record<string, unknown>): ParsedDolibarrCompany | null {
  const dolibarrId = text(raw.id);
  const name = text(raw.name);
  if (!dolibarrId || !name) return null;
  if (!isTrue(raw.client)) return null;

  return {
    dolibarrId,
    name,
    address: text(raw.address),
    zip: text(raw.zip),
    town: text(raw.town),
    clientCode: text(raw.code_client),
    // Sur un tiers, deux champs coexistent : `status` porte l'information, `statut` est un résidu
    // souvent `null` — s'y fier désactiverait tout le répertoire.
    active: isTrue(raw.status),
  };
}

/** Adresse d'affichage, pour distinguer deux clients homonymes dans une liste. */
export function companyAddressLabel(company: {
  address: string;
  zip: string;
  town: string;
}): string {
  const locality = [company.zip, company.town].filter(Boolean).join(" ");
  return [company.address, locality].filter(Boolean).join(", ");
}

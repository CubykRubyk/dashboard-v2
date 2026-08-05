/**
 * Construction du corps envoyé à Dolibarr lors de la modification d'un événement d'agenda.
 *
 * Pas de `server-only` ici (contrairement à `event-update.ts`, qui fait les appels réseau) : ce
 * module est purement calculatoire et reste ainsi testable hors Next — même partage que
 * `lib/backup/storage.ts` vs `lib/backup/pg.ts`.
 */

export interface DolibarrEventPatch {
  /** Composantes « heure de Paris » — voir `toDolibarrTimestamp`. */
  startAt?: Date | null;
  endAt?: Date | null;
  label?: string;
  location?: string;
  note?: string;
  /** `userownerid` du technicien à qui l'intervention est confiée. */
  ownerId?: string | null;
  /** `socid` : référence de la fiche tiers Dolibarr, jamais un nom libre. */
  companyId?: string | null;
  /** `true` clôture l'événement (percentage 100), `false` le rouvre. */
  closed?: boolean;
}

export type DolibarrEventModel = Record<string, unknown> & { id?: string | number };

/**
 * Sur cette instance, `datep`/`datef` encodent l'heure locale Europe/Paris **dans les composantes
 * UTC brutes** (constaté en production, voir CLAUDE.md). La lecture ne convertit donc aucun
 * fuseau ; l'écriture doit suivre exactement la même convention, sinon chaque enregistrement
 * décalerait l'intervention d'une à deux heures.
 */
export function toDolibarrTimestamp(date: Date | null | undefined) {
  if (!date) return null;
  return Math.floor(date.getTime() / 1000);
}

/**
 * Applique le patch sur le modèle **relu** et renvoie le corps à envoyer.
 *
 * On renvoie toujours le modèle entier : un PUT partiel est risqué sur l'API Dolibarr — selon les
 * versions et les champs, ce qui n'est pas transmis peut être remis à sa valeur par défaut.
 * Aucun champ n'est retiré : ce que l'instance nous a renvoyé, elle sait le relire ; filtrer « ce
 * qui a l'air calculé » reviendrait à deviner, et c'est ainsi qu'on perd un champ propre à une
 * version donnée.
 */
export function applyEventPatch(
  event: DolibarrEventModel,
  patch: DolibarrEventPatch,
): DolibarrEventModel {
  const next: DolibarrEventModel = { ...event };

  if (patch.startAt !== undefined) {
    const timestamp = toDolibarrTimestamp(patch.startAt);
    next.datep = timestamp;
    // `date_start_in_calendar` suit `datep` dans le modèle Dolibarr ; laissé désynchronisé,
    // l'agenda continue d'afficher l'ancien créneau.
    if ("date_start_in_calendar" in event) next.date_start_in_calendar = timestamp;
  }
  if (patch.endAt !== undefined) {
    const timestamp = toDolibarrTimestamp(patch.endAt);
    next.datef = timestamp;
    if ("date_end_in_calendar" in event) next.date_end_in_calendar = timestamp;
  }
  if (patch.label !== undefined) {
    next.label = patch.label;
    // Certaines versions exposent le libellé sous les deux noms ; la clé n'est pas créée si elle
    // n'existait pas, pour ne pas inventer un champ que l'instance ne connaît pas.
    if ("actioncomm" in event) next.actioncomm = patch.label;
  }
  if (patch.location !== undefined) next.location = patch.location;
  if (patch.note !== undefined) {
    // **Constaté sur l'instance réelle** : Dolibarr ignore une chaîne vide lors d'un PUT — il
    // répond 200 mais la note reste telle quelle. Vider une note depuis l'interface était donc
    // silencieusement sans effet. Un espace est le plus petit contenu qui l'efface réellement
    // (il disparaît ensuite au nettoyage HTML à la lecture, la note apparaît bien vide).
    const value = patch.note.length > 0 ? patch.note : " ";
    next.note_private = value;
    if ("note" in event) next.note = value;
  }
  if (patch.ownerId !== undefined) next.userownerid = patch.ownerId;
  if (patch.companyId !== undefined) next.socid = patch.companyId;
  if (patch.closed !== undefined) next.percentage = patch.closed ? "100" : "0";

  return next;
}

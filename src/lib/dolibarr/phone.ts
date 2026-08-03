const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&eacute;": "é",
  "&egrave;": "è",
  "&agrave;": "à",
  "&ecirc;": "ê",
  "&ccedil;": "ç",
  "&#39;": "'",
  "&quot;": '"',
};

// Convertit le HTML brut des notes Dolibarr (`<br />`, `<div>`/`<p>` imbriqués, `\r\n`) en texte lisible
// avec sauts de ligne préservés — pas un unique bloc aplati, ni une soupe de balises/entités brutes.
// Piège réel : l'éditeur Dolibarr écrit à la fois `<br />` ET un vrai `\r\n` juste après (mise en forme
// du source HTML, sans signification visuelle) — si on convertit aussi ce `\r\n` littéral en saut de
// ligne, chaque ligne se retrouve doublée (un "paragraphe" par ligne). On neutralise donc les retours
// à la ligne bruts (espace insignifiant, comme le ferait un navigateur) AVANT de traiter les balises
// qui, elles, sont les seules vraies sources de saut de ligne.
export function stripDolibarrNoteHtml(html: string): string {
  return html
    .replace(/[\r\n]+/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&amp;|&eacute;|&egrave;|&agrave;|&ecirc;|&ccedil;|&#39;|&quot;/g, (match) => HTML_ENTITIES[match] ?? " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Numéros mobiles/fixes français : 10 chiffres commençant par 0, séparateurs espace/point/tiret
// optionnels entre les paires — couvre les formats vus dans les notes Dolibarr réelles
// ("0611970407" ou "06 11 97 04 07"). Les lookarounds évitent de matcher un sous-ensemble d'un
// nombre plus long (ex. une référence produit).
const PHONE_RE = /(?<!\d)0[1-9](?:[\s.-]?\d{2}){4}(?!\d)/;

export function extractPhoneFromNote(note: string | null | undefined): string {
  if (!note) return "";
  const text = stripDolibarrNoteHtml(note);
  const match = text.match(PHONE_RE);
  if (!match) return "";
  const digits = match[0].replace(/[\s.-]/g, "");
  return digits.match(/\d{2}/g)?.join(" ") ?? digits;
}

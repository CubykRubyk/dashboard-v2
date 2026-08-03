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

function decodeEntities(text: string) {
  return text.replace(/&nbsp;|&amp;|&eacute;|&egrave;|&agrave;|&ecirc;|&ccedil;|&#39;|&quot;/g, (match) => HTML_ENTITIES[match] ?? " ");
}

export type NoteToken = { kind: "break" } | { kind: "text"; text: string; bold: boolean; color: string | null };

const BREAK_TAGS = new Set(["p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "tr"]);
const BOLD_TAGS = new Set(["strong", "b"]);
const COLOR_RE = /color\s*:\s*(#[0-9a-fA-F]{3,8})/i;

// Convertit une note Dolibarr (HTML brut, non fiable) en une liste de tokens sûrs pour l'affichage —
// jamais de HTML injecté tel quel. Allowlist stricte : gras (`<strong>`/`<b>`) et couleur inline en hex
// (`<span style="color:#hex">`), tout le reste (attributs, autres balises) est ignoré silencieusement.
export function parseDolibarrNote(html: string): NoteToken[] {
  const normalized = html.replace(/[\r\n]+/g, " ");
  const tokens: NoteToken[] = [];
  let boldDepth = 0;
  const colorStack: (string | null)[] = [];
  const tagRe = /<(\/?)([a-zA-Z0-9]+)([^>]*)>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushText = (raw: string) => {
    const text = decodeEntities(raw).replace(/[ \t]+/g, " ");
    // Les retours à la ligne bruts normalisés en espace plus haut laissent des fragments "blancs" entre
    // deux balises (ex. entre `<br />` et `<hr />`) — insignifiants, on les ignore plutôt que de les
    // compter comme du texte (ça fausserait le comptage des sauts de ligne consécutifs ci-dessous).
    if (!text.trim()) return;
    tokens.push({ kind: "text", text, bold: boldDepth > 0, color: colorStack[colorStack.length - 1] ?? null });
  };

  while ((match = tagRe.exec(normalized))) {
    if (match.index > lastIndex) pushText(normalized.slice(lastIndex, match.index));
    const [, closing, tagNameRaw, attrs] = match;
    const tagName = tagNameRaw.toLowerCase();
    if (!closing) {
      if (tagName === "br") tokens.push({ kind: "break" });
      else if (tagName === "hr") tokens.push({ kind: "break" }, { kind: "break" });
      else if (BOLD_TAGS.has(tagName)) boldDepth += 1;
      else if (tagName === "span") {
        const colorMatch = attrs.match(COLOR_RE);
        colorStack.push(colorMatch ? colorMatch[1] : null);
      }
    } else {
      if (BOLD_TAGS.has(tagName)) boldDepth = Math.max(0, boldDepth - 1);
      else if (tagName === "span") colorStack.pop();
      else if (BREAK_TAGS.has(tagName)) tokens.push({ kind: "break" });
    }
    lastIndex = tagRe.lastIndex;
  }
  if (lastIndex < normalized.length) pushText(normalized.slice(lastIndex));

  const collapsed: NoteToken[] = [];
  let breakRun = 0;
  for (const token of tokens) {
    if (token.kind === "break") {
      breakRun += 1;
      continue;
    }
    if (breakRun > 0 && collapsed.length > 0) {
      collapsed.push({ kind: "break" });
      if (breakRun > 1) collapsed.push({ kind: "break" });
    }
    breakRun = 0;
    collapsed.push(token);
  }

  // Nettoyage final : un espace en début/fin de segment n'a de sens que s'il touche un autre segment
  // de texte sur la même ligne — juste à côté d'un saut de ligne (ou en bord de note), c'est du bruit.
  for (let index = 0; index < collapsed.length; index += 1) {
    const token = collapsed[index];
    if (token.kind !== "text") continue;
    const prev = collapsed[index - 1];
    const next = collapsed[index + 1];
    let text = token.text;
    if (!prev || prev.kind === "break") text = text.trimStart();
    if (!next || next.kind === "break") text = text.trimEnd();
    collapsed[index] = { ...token, text };
  }

  return collapsed.filter((token) => token.kind === "break" || token.text.length > 0);
}

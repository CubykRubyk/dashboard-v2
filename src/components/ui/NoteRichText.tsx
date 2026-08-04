"use client";

import type { NoteToken } from "@/lib/dolibarr/noteFormat";

export type { NoteToken };

// Rend les tokens produits par `parseDolibarrNote` (allowlist stricte : gras + couleur hex) —
// jamais de HTML brut injecté. Partagé entre le drawer desktop et l'écran de détail mobile.
export function NoteRichText({ tokens }: { tokens: NoteToken[] }) {
  return (
    <>
      {tokens.map((token, index) =>
        token.kind === "break" ? (
          <br key={index} />
        ) : (
          <span key={index} style={{ fontWeight: token.bold ? 700 : undefined, color: token.color ?? undefined }}>
            {token.text}
          </span>
        ),
      )}
    </>
  );
}

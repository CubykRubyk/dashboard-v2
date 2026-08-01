"use client";

import { AlertTriangle } from "lucide-react";

export default function DocumentsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="card technical-empty technical-empty-action">
      <AlertTriangle size={30} />
      <h2>Chargement impossible</h2>
      <p>La bibliothèque de documents n’a pas pu être chargée.</p>
      <button className="button button-primary" onClick={reset}>
        Réessayer
      </button>
    </section>
  );
}

"use client";

import { AlertTriangle } from "lucide-react";

export default function CombinationsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="card technical-empty technical-empty-action">
      <AlertTriangle size={30} />
      <h2>Chargement impossible</h2>
      <p>Les combinaisons n’ont pas pu être chargées.</p>
      <button className="button button-primary" onClick={reset}>
        Réessayer
      </button>
    </section>
  );
}

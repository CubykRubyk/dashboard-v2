"use client";

import { useEffect, useState } from "react";

/**
 * Alimente un sélecteur depuis le répertoire Dolibarr importé.
 *
 * Comportement voulu par Ion : **les favoris s'affichent d'emblée** (la liste courte du quotidien),
 * et dès qu'on tape, la recherche porte sur tout le répertoire. La bascule est portée par le
 * paramètre `favorites`, que la route ignore justement dès qu'une recherche est fournie.
 */
export interface DirectoryUser {
  id: string;
  dolibarrId: string;
  name: string;
  job: string;
  favorite: boolean;
  /** Faux = personne à notifier lors d'une affectation (pas de compte CRM). */
  hasCrmAccount: boolean;
}

export interface DirectoryCompany {
  id: string;
  dolibarrId: string;
  name: string;
  addressLabel: string;
  favorite: boolean;
}

function useDirectory<T>(kind: "users" | "companies", query: string, enabled = true) {
  const [entries, setEntries] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const trimmed = query.trim();
    // Délai seulement quand on tape : l'ouverture du sélecteur doit afficher les favoris tout de
    // suite, sans attente perceptible.
    const delay = trimmed.length >= 2 ? 250 : 0;
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (trimmed.length >= 2) params.set("q", trimmed);
      else params.set("favorites", "1");

      fetch(`/api/dolibarr/directory/${kind}?${params.toString()}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (cancelled || !data) return;
          setEntries(kind === "users" ? data.users : data.companies);
          setLoading(false);
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kind, query, enabled]);

  return { entries, loading };
}

export function useDirectoryUsers(query: string, enabled = true) {
  const { entries, loading } = useDirectory<DirectoryUser>("users", query, enabled);
  return { users: entries, loading };
}

export function useDirectoryCompanies(query: string, enabled = true) {
  const { entries, loading } = useDirectory<DirectoryCompany>("companies", query, enabled);
  return { companies: entries, loading };
}

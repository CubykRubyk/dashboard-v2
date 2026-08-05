import { NextRequest, NextResponse } from "next/server";

import { canEditDolibarrIntervention } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { dolibarrRequest, getDolibarrConfig } from "@/lib/dolibarr/client";

/**
 * Recherche de sociétés (tiers) dans Dolibarr.
 *
 * Nécessaire parce que `socid` sur un événement d'agenda est une **référence** vers une fiche
 * tiers, pas un texte : réaffecter une intervention à une autre société suppose de choisir un
 * tiers existant. Une société absente de Dolibarr doit y être créée d'abord — le CRM ne crée
 * volontairement pas de tiers (cela multiplierait les endroits d'où naissent des données).
 *
 * Réservée aux administrateurs : c'est un outil d'édition, et la liste des clients n'a pas à être
 * parcourable par tout le monde.
 */
type DolibarrThirdParty = {
  id?: string | number;
  name?: string;
  address?: string;
  zip?: string;
  town?: string;
};

// Cache court par requête : la même recherche est relancée à chaque frappe côté client.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!canEditDolibarrIntervention(user?.role)) {
    return NextResponse.json({ error: "Droits administrateur requis." }, { status: 403 });
  }

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (query.length < 2) return NextResponse.json({ thirdparties: [] });

  const cached = cache.get(query);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.value);
  }

  const config = await getDolibarrConfig();
  if (!config) {
    return NextResponse.json({ error: "Dolibarr n’est pas configuré." }, { status: 503 });
  }

  // Les apostrophes doivent être neutralisées : elles ferment la chaîne du `sqlfilters`.
  const safe = query.replace(/['\\%]/g, " ").trim();
  if (!safe) return NextResponse.json({ thirdparties: [] });

  try {
    const results = await dolibarrRequest<DolibarrThirdParty[]>(
      config,
      `/thirdparties?sqlfilters=${encodeURIComponent(`(t.nom:like:'%${safe}%')`)}&limit=20&sortfield=t.nom&sortorder=ASC`,
    );

    const thirdparties = (Array.isArray(results) ? results : []).map((party) => ({
      id: String(party.id ?? ""),
      name: String(party.name ?? "").trim(),
      // Adresse recomposée pour aider à distinguer deux clients homonymes.
      address: [party.address, [party.zip, party.town].filter(Boolean).join(" ")]
        .filter((part) => part && String(part).trim())
        .join(", "),
    })).filter((party) => party.id && party.name);

    const payload = { thirdparties };
    cache.set(query, { at: Date.now(), value: payload });
    if (cache.size > 200) cache.clear();
    return NextResponse.json(payload);
  } catch (error) {
    // Dolibarr renvoie 404 quand aucun tiers ne correspond : ce n'est pas une erreur pour nous.
    const message = error instanceof Error ? error.message : "";
    if (message.includes("404")) return NextResponse.json({ thirdparties: [] });
    return NextResponse.json({ error: `Recherche impossible : ${message}` }, { status: 502 });
  }
}

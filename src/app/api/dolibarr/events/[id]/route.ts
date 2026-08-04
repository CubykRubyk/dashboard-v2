import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dolibarrRequest, getDolibarrConfig, type DolibarrConfig } from "@/lib/dolibarr/client";
import { extractPhoneFromNote, stripDolibarrNoteHtml } from "@/lib/dolibarr/phone";
import { parseDolibarrNote } from "@/lib/dolibarr/noteFormat";

// La fiche d'un événement (note, téléphone extrait…) était refaite depuis Dolibarr à chaque
// ouverture — y compris en rouvrant le même événement dix fois de suite. Cache mémoire simple,
// 5 min par événement (`unstable_cache`/`revalidateTag` de Next 16 exigent un "cache profile" en
// plus, encore instable à ce stade — une Map suffit largement pour ce volume). `?refresh=1`
// invalide explicitement (bouton "Rafraîchir" côté mobile/desktop).
const CACHE_TTL_MS = 5 * 60 * 1000;
type CachedEntry = { data: Awaited<ReturnType<typeof fetchEventData>>; expiresAt: number };
const eventCache = new Map<string, CachedEntry>();

type DolibarrEvent = {
  label?: string;
  actioncomm?: string;
  datep?: string | number;
  datef?: string | number;
  socid?: string | number;
  userownerid?: string | number;
  location?: string;
  note_public?: string;
  note_private?: string;
};

function dateValue(value: string | number | undefined) {
  if (value === undefined || value === "") return "";
  const raw = String(value).trim();
  if (!raw || raw === "0") return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const numericValue = /^\d+$/.test(raw) ? Number(raw) : null;
  const date = new Date(
    numericValue === null
      ? raw
      : numericValue < 1e12
        ? numericValue * 1000
        : numericValue,
  );
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function fetchEventData(config: DolibarrConfig, id: string) {
  const event = await dolibarrRequest<DolibarrEvent>(
    config,
    `/agendaevents/${encodeURIComponent(id)}`,
  );
  const label = String(event.label || event.actioncomm || "").trim();
  const noteRaw = String(event.note_private || event.note_public || "").trim();
  const result = {
    id,
    label,
    workDate: dateValue(event.datef) || dateValue(event.datep),
    company: "",
    client: label,
    address: String(event.location || "").trim(),
    installer: "",
    note: stripDolibarrNoteHtml(noteRaw),
    noteTokens: parseDolibarrNote(noteRaw),
    phone: extractPhoneFromNote(noteRaw),
  };

  if (event.socid) {
    try {
      const thirdparty = await dolibarrRequest<{ name?: string }>(
        config,
        `/thirdparties/${encodeURIComponent(String(event.socid))}`,
      );
      result.company = String(thirdparty.name || "").trim();
    } catch {}
  }
  if (event.userownerid) {
    try {
      const owner = await dolibarrRequest<{ firstname?: string; lastname?: string }>(
        config,
        `/users/${encodeURIComponent(String(event.userownerid))}`,
      );
      result.installer = [owner.firstname, owner.lastname].filter(Boolean).join(" ").trim();
    } catch {}
  }
  return result;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const config = await getDolibarrConfig();
  if (!config) {
    return NextResponse.json({ error: "Configurez d’abord Dolibarr dans Paramètres." }, { status: 409 });
  }
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) {
    return NextResponse.json({ error: "ID événement invalide." }, { status: 400 });
  }

  const forceRefresh = new URL(request.url).searchParams.get("refresh") === "1";
  const cached = eventCache.get(id);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const result = await fetchEventData(config, id);
    eventCache.set(id, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(result);
  } catch (error) {
    // Une erreur réseau ne doit pas jeter un cache valide — on ressert ce qu'on a plutôt que
    // d'afficher une page d'erreur pour une simple coupure momentanée.
    if (cached) return NextResponse.json(cached.data);
    const message = error instanceof Error ? error.message : "Connexion Dolibarr impossible.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

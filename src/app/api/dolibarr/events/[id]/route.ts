import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dolibarrRequest, getDolibarrConfig } from "@/lib/dolibarr/client";

type DolibarrEvent = {
  label?: string;
  actioncomm?: string;
  datep?: string | number;
  datef?: string | number;
  socid?: string | number;
  userownerid?: string | number;
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

export async function GET(
  _request: Request,
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

  try {
    const event = await dolibarrRequest<DolibarrEvent>(
      config,
      `/agendaevents/${encodeURIComponent(id)}`,
    );
    const result = {
      id,
      label: String(event.label || event.actioncomm || "").trim(),
      workDate: dateValue(event.datef) || dateValue(event.datep),
      company: "",
      installer: "",
    };

    if (event.socid) {
      try {
        const company = await dolibarrRequest<{ name?: string }>(
          config,
          `/thirdparties/${encodeURIComponent(String(event.socid))}`,
        );
        result.company = String(company.name || "").trim();
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
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connexion Dolibarr impossible.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

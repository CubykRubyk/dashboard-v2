import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dolibarrRequest, getDolibarrConfig } from "@/lib/dolibarr/client";

export async function POST() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Droits administrateur requis." }, { status: 403 });
  }
  const config = await getDolibarrConfig();
  if (!config) {
    return NextResponse.json({ error: "Dolibarr n’est pas configuré." }, { status: 409 });
  }
  try {
    await dolibarrRequest(config, "/agendaevents?limit=1");
    return NextResponse.json({
      ok: true,
      message: "Connexion Dolibarr opérationnelle. Accès aux événements autorisé.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connexion impossible.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

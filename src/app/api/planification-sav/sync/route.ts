import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canManageSav } from "@/lib/auth/permissions";
import { getDolibarrConfig } from "@/lib/dolibarr/client";
import { syncInterventionPlannings } from "@/lib/dolibarr/interventions";
import { computeProximitySuggestions } from "@/lib/planification/proximity";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const user = await getSession();
  if (!user || !canManageSav(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const config = await getDolibarrConfig();
  if (!config) {
    return NextResponse.json({ error: "Configurez d'abord Dolibarr dans Paramètres." }, { status: 409 });
  }

  try {
    await syncInterventionPlannings(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Synchronisation Dolibarr échouée.";
    await prisma.appSettings.update({ where: { id: 1 }, data: { dolibarrLastSyncError: message } });
    return NextResponse.json({ error: message }, { status: 502 });
  }

  try {
    await computeProximitySuggestions();
  } catch (error) {
    console.error("Calcul des suggestions de proximité échoué:", error);
  }

  return NextResponse.json({ success: true });
}

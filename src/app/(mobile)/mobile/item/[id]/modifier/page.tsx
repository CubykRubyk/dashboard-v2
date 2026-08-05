import { notFound, redirect } from "next/navigation";

import { EditInterventionScreen } from "@/components/mobile/EditInterventionScreen";
import { canEditDolibarrIntervention } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { findPlanningItem } from "@/lib/mobile/data";

export const dynamic = "force-dynamic";

export default async function EditInterventionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login?next=/mobile");
  // Garde côté serveur : l'écran d'édition écrit dans Dolibarr, il reste réservé aux
  // administrateurs même si quelqu'un connaît l'URL.
  if (!canEditDolibarrIntervention(user.role)) redirect("/mobile");

  const { id } = await params;
  const item = await findPlanningItem(id);
  // Seules les interventions Dolibarr sont éditables : un SAV se modifie depuis le desktop.
  if (!item || item.source !== "dolibarr") notFound();

  // Les techniciens viennent du répertoire Dolibarr importé, chargé côté client au fil de la
  // recherche — plus besoin de les précharger ici.
  return <EditInterventionScreen item={item} />;
}

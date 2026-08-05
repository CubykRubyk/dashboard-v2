import { redirect } from "next/navigation";

import { WorkSitesScreen } from "@/components/mobile/WorkSitesScreen";
import { loadCompletedWorkSites } from "@/lib/mobile/data";
import { getMobileScope } from "@/lib/mobile/scope";

export const dynamic = "force-dynamic";

export default async function MobileWorkSitesPage() {
  const scope = await getMobileScope();
  // La garde du layout a déjà filtré les accès ; ce repli ne couvre qu'une session expirée
  // entre-temps.
  if (!scope) redirect("/login?next=/mobile/chantiers");

  const sites = await loadCompletedWorkSites(scope);
  return <WorkSitesScreen sites={sites} />;
}

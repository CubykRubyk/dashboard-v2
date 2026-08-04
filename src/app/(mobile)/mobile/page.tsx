import { TodayScreen } from "@/components/mobile/TodayScreen";
import { loadPlanningItems, todayIsoParis } from "@/lib/mobile/data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Société affichée en en-tête : le siège configuré dans Paramètres si présent, sinon la société
// principale par défaut (demande d'Ion — "societatea de baza pina cind").
const FALLBACK_COMPANY = "2C ENERGIES";

export default async function MobileTodayPage() {
  const [items, headquarters] = await Promise.all([
    loadPlanningItems(),
    prisma.documentIssuer.findFirst({
      where: { isHeadquarters: true, active: true },
      select: { name: true },
    }),
  ]);

  return (
    <TodayScreen
      items={items}
      todayIso={todayIsoParis()}
      companyName={headquarters?.name || FALLBACK_COMPANY}
    />
  );
}

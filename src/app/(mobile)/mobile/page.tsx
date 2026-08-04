import { TodayScreen } from "@/components/mobile/TodayScreen";
import { loadInterventions, todayIsoParis } from "@/lib/mobile/data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Société affichée en en-tête : le siège configuré dans Paramètres si présent, sinon la société
// principale par défaut (demande d'Ion — "societatea de baza pina cind").
const FALLBACK_COMPANY = "2C ENERGIES";

export default async function MobileTodayPage() {
  // Uniquement les interventions ici — un SAV créé depuis une intervention Dolibarr apparaîtrait
  // sinon deux fois (une fois comme intervention, une fois comme SAV), ce qui prêtait à confusion.
  // Les SAV ont leur propre onglet.
  const [items, headquarters] = await Promise.all([
    loadInterventions(),
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

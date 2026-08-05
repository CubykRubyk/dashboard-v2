import { AgendaScreen } from "@/components/mobile/AgendaScreen";
import { loadInterventions } from "@/lib/mobile/data";

export const dynamic = "force-dynamic";

// Uniquement les interventions Dolibarr — un SAV créé manuellement peut, entre-temps, donner lieu à
// la création d'un événement Dolibarr pour la même intervention ; les deux apparaîtraient alors en
// double sur le calendrier. Les SAV restent visibles dans leur propre onglet (voir SavScreen), pas
// sur le calendrier. Même règle que "Aujourd'hui" (mobile/page.tsx).
export default async function MobileAgendaPage() {
  const items = await loadInterventions();
  return <AgendaScreen items={items} />;
}

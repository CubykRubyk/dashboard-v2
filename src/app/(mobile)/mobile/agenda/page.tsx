import { AgendaScreen } from "@/components/mobile/AgendaScreen";
import { loadPlanningItems } from "@/lib/mobile/data";

export const dynamic = "force-dynamic";

export default async function MobileAgendaPage() {
  const items = await loadPlanningItems();
  return <AgendaScreen items={items} />;
}

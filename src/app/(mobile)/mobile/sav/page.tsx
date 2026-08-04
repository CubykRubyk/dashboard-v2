import { SavScreen } from "@/components/mobile/SavScreen";
import { loadSavTickets } from "@/lib/mobile/data";

export const dynamic = "force-dynamic";

export default async function MobileSavPage() {
  const tickets = await loadSavTickets();
  return <SavScreen tickets={tickets} />;
}

import { notFound } from "next/navigation";
import { FinishScreen } from "@/components/mobile/FinishScreen";
import { findPlanningItem } from "@/lib/mobile/data";
import { getActiveCatalog } from "@/lib/worksheets/catalog";

export const dynamic = "force-dynamic";

export default async function MobileFinishPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [item, catalog] = await Promise.all([findPlanningItem(id), getActiveCatalog()]);
  if (!item) notFound();
  return <FinishScreen item={item} catalog={catalog} />;
}

import { notFound } from "next/navigation";
import { DetailScreen } from "@/components/mobile/DetailScreen";
import { findPlanningItem } from "@/lib/mobile/data";

export const dynamic = "force-dynamic";

export default async function MobileItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await findPlanningItem(id);
  if (!item) notFound();
  return <DetailScreen item={item} />;
}

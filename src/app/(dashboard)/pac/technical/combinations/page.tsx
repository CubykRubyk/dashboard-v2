import { CombinationCatalog } from "@/components/pac/technical/CombinationCatalog";

export const dynamic = "force-dynamic";

export default function TechnicalCombinationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <CombinationCatalog
      searchParams={searchParams}
      basePath="/pac/technical/combinations"
      eyebrow="Bibliothèque HVAC"
      title="Combinaisons"
      description="Systèmes split compatibles composés d’une unité extérieure et intérieure."
    />
  );
}

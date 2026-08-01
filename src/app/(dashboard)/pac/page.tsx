import { CombinationCatalog } from "@/components/pac/technical/CombinationCatalog";

export const dynamic = "force-dynamic";

export default function PacCatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <CombinationCatalog
      searchParams={searchParams}
      basePath="/pac"
      eyebrow="Catalogue PAC"
      title="Modèles PAC"
      description="Les modèles PAC sont créés à partir de combinaisons compatibles UI + UE."
      presentation="cards"
      technicalLibraryHref="/pac/technical"
    />
  );
}

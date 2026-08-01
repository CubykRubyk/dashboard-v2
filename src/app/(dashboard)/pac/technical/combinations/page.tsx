import Link from "next/link";
import { CirclePlus } from "lucide-react";
import { CatalogPagination } from "@/components/pac/technical/CatalogPagination";
import { CombinationFilters } from "@/components/pac/technical/CombinationFilters";
import { CombinationTable } from "@/components/pac/technical/CombinationTable";
import { canManageTechnicalCatalog } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import {
  COMBINATION_PAGE_SIZE,
  getCombinationFilterOptions,
  getCombinationList,
} from "@/lib/hvac/combination-queries";

export const dynamic = "force-dynamic";

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function TechnicalCombinationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = valueOf(params.q).trim().slice(0, 160);
  const manufacturerId = valueOf(params.manufacturer).slice(0, 100);
  const productRangeId = valueOf(params.range).slice(0, 100);
  const activeValue = valueOf(params.active);
  const active = activeValue === "inactive" || activeValue === "all"
    ? activeValue
    : "active";
  const reviewValue = valueOf(params.review);
  const review = reviewValue === "required" || reviewValue === "verified"
    ? reviewValue
    : "";
  const requestedPage = Math.max(
    1,
    Number.parseInt(valueOf(params.page), 10) || 1,
  );
  const filters = {
    query,
    manufacturerId,
    productRangeId,
    active,
    review,
    page: requestedPage,
  } as const;

  const [user, [manufacturers, productRanges], result] = await Promise.all([
    getSession(),
    getCombinationFilterOptions(),
    getCombinationList(filters),
  ]);
  const totalPages = Math.max(
    1,
    Math.ceil(result.total / COMBINATION_PAGE_SIZE),
  );
  const canManage = canManageTechnicalCatalog(user?.role);
  const urlParams = new URLSearchParams();
  if (query) urlParams.set("q", query);
  if (manufacturerId) urlParams.set("manufacturer", manufacturerId);
  if (productRangeId) urlParams.set("range", productRangeId);
  if (active !== "active") urlParams.set("active", active);
  if (review) urlParams.set("review", review);
  const hrefForPage = (page: number) => {
    const next = new URLSearchParams(urlParams);
    next.set("page", String(page));
    return `/pac/technical/combinations?${next.toString()}`;
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Bibliothèque HVAC</p>
          <h1>Combinaisons</h1>
          <p>Systèmes split compatibles composés d’une unité extérieure et intérieure.</p>
        </div>
        {canManage && (
          <Link
            href="/pac/technical/combinations/new"
            className="button button-primary"
          >
            <CirclePlus size={17} /> Ajouter une combinaison
          </Link>
        )}
      </div>

      {!canManage && (
        <div className="alert alert-danger technical-read-only-notice">
          Consultation seule. Les droits administrateur sont requis pour modifier.
        </div>
      )}

      <CombinationFilters
        filters={{
          q: query,
          manufacturer: manufacturerId,
          range: productRangeId,
          active,
          review,
        }}
        manufacturers={manufacturers}
        productRanges={productRanges}
      />

      <div className="technical-results-summary">
        <strong>{result.total}</strong> combinaison
        {result.total === 1 ? "" : "s"}
        {result.total > 0 && (
          <span> · page {requestedPage} sur {totalPages}</span>
        )}
      </div>

      <CombinationTable
        combinations={result.combinations}
        emptyMessage={
          result.overallTotal === 0
            ? "Aucune combinaison n’a encore été créée."
            : "Aucune combinaison ne correspond aux critères."
        }
      />
      <CatalogPagination
        currentPage={requestedPage}
        totalPages={totalPages}
        hrefForPage={hrefForPage}
        ariaLabel="Pagination des combinaisons"
      />
    </>
  );
}

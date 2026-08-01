import Link from "next/link";
import { CirclePlus } from "lucide-react";
import { CatalogPagination } from "@/components/pac/technical/CatalogPagination";
import { CombinationFilters } from "@/components/pac/technical/CombinationFilters";
import { CombinationCards } from "@/components/pac/technical/CombinationCards";
import { CombinationTable } from "@/components/pac/technical/CombinationTable";
import { canManageTechnicalCatalog } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import {
  COMBINATION_PAGE_SIZE,
  getCombinationFilterOptions,
  getCombinationList,
} from "@/lib/hvac/combination-queries";

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export interface CombinationCatalogProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  basePath: string;
  eyebrow: string;
  title: string;
  description: string;
  presentation?: "table" | "cards";
  technicalLibraryHref?: string;
}

export async function CombinationCatalog({
  searchParams,
  basePath,
  eyebrow,
  title,
  description,
  presentation = "table",
  technicalLibraryHref,
}: CombinationCatalogProps) {
  const params = await searchParams;
  const deleted = valueOf(params.deleted);
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
    return `${basePath}?${next.toString()}`;
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="page-heading-actions">
          {canManage && (
            <Link
              href="/pac/technical/combinations/new"
              className="button button-primary"
            >
              <CirclePlus size={17} /> Ajouter une combinaison
            </Link>
          )}
          {technicalLibraryHref && (
            <Link href={technicalLibraryHref} className="button button-ghost">
              Bibliothèque technique
            </Link>
          )}
        </div>
      </div>

      {deleted && (
        <div className="alert alert-success" role="status">
          {deleted === "combination"
            ? "La combinaison a été supprimée. Les équipements, documents et fichiers PDF ont été conservés."
            : "La combinaison avait déjà été supprimée."}
        </div>
      )}

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
        resetHref={basePath}
      />

      <div className="technical-results-summary">
        <strong>{result.total}</strong> modèle
        {result.total === 1 ? "" : "s"} PAC
        {result.total > 0 && (
          <span> · page {requestedPage} sur {totalPages}</span>
        )}
      </div>

      {presentation === "cards" ? (
        <CombinationCards
          combinations={result.combinations}
          emptyMessage={
            result.overallTotal === 0
              ? "Aucun modèle PAC n’a encore été créé à partir d’une combinaison UI + UE."
              : "Aucun modèle PAC ne correspond aux critères."
          }
        />
      ) : (
        <CombinationTable
          combinations={result.combinations}
          emptyMessage={
            result.overallTotal === 0
              ? "Aucun modèle PAC n’a encore été créé à partir d’une combinaison UI + UE."
              : "Aucun modèle PAC ne correspond aux critères."
          }
        />
      )}
      <CatalogPagination
        currentPage={requestedPage}
        totalPages={totalPages}
        hrefForPage={hrefForPage}
        ariaLabel="Pagination des modèles PAC"
      />
    </>
  );
}

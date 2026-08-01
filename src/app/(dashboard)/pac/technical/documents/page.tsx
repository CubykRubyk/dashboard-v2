import Link from "next/link";
import { CirclePlus } from "lucide-react";
import { CatalogPagination } from "@/components/pac/technical/CatalogPagination";
import { DocumentFilters } from "@/components/pac/technical/DocumentFilters";
import { DocumentTable } from "@/components/pac/technical/DocumentTable";
import { TechnicalDocumentType } from "@/generated/prisma/enums";
import { canManageTechnicalCatalog } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import {
  DOCUMENT_PAGE_SIZE,
  getDocumentFilterOptions,
  getDocumentList,
} from "@/lib/hvac/document-queries";

export const dynamic = "force-dynamic";

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function TechnicalDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = valueOf(params.q).trim().slice(0, 160);
  const typeValue = valueOf(params.type);
  const type = Object.values(TechnicalDocumentType).includes(
    typeValue as TechnicalDocumentType,
  )
    ? typeValue as TechnicalDocumentType
    : "";
  const activeValue = valueOf(params.active);
  const active = activeValue === "inactive" || activeValue === "all"
    ? activeValue
    : "active";
  const manufacturerId = valueOf(params.manufacturer).slice(0, 100);
  const associationValue = valueOf(params.association);
  const association = [
    "equipment",
    "combination",
    "unassociated",
  ].includes(associationValue)
    ? associationValue as "equipment" | "combination" | "unassociated"
    : "";
  const legacyValue = valueOf(params.legacy);
  const legacy = legacyValue === "legacy" || legacyValue === "native"
    ? legacyValue
    : "";
  const requestedPage = Math.max(
    1,
    Number.parseInt(valueOf(params.page), 10) || 1,
  );
  const filters = {
    query,
    type,
    active,
    manufacturerId,
    association,
    legacy,
    page: requestedPage,
  } as const;

  const [user, manufacturers, result] = await Promise.all([
    getSession(),
    getDocumentFilterOptions(),
    getDocumentList(filters),
  ]);
  const canManage = canManageTechnicalCatalog(user?.role);
  const totalPages = Math.max(
    1,
    Math.ceil(result.total / DOCUMENT_PAGE_SIZE),
  );
  const urlParams = new URLSearchParams();
  if (query) urlParams.set("q", query);
  if (type) urlParams.set("type", type);
  if (active !== "active") urlParams.set("active", active);
  if (manufacturerId) urlParams.set("manufacturer", manufacturerId);
  if (association) urlParams.set("association", association);
  if (legacy) urlParams.set("legacy", legacy);
  const hrefForPage = (page: number) => {
    const next = new URLSearchParams(urlParams);
    next.set("page", String(page));
    return `/pac/technical/documents?${next.toString()}`;
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Bibliothèque HVAC</p>
          <h1>Documents techniques</h1>
          <p>Un fichier unique, associé à plusieurs équipements ou combinaisons.</p>
        </div>
        {canManage && (
          <Link
            href="/pac/technical/documents/new"
            className="button button-primary"
          >
            <CirclePlus size={17} /> Importer un document
          </Link>
        )}
      </div>

      {!canManage && (
        <div className="alert alert-danger technical-read-only-notice">
          Consultation seule. Les droits administrateur sont requis pour modifier.
        </div>
      )}

      <DocumentFilters
        filters={{
          q: query,
          type,
          active,
          manufacturer: manufacturerId,
          association,
          legacy,
        }}
        manufacturers={manufacturers}
      />

      <div className="technical-results-summary">
        <strong>{result.total}</strong> document
        {result.total === 1 ? "" : "s"}
        {result.total > 0 && (
          <span> · page {requestedPage} sur {totalPages}</span>
        )}
      </div>

      <DocumentTable
        documents={result.documents}
        emptyMessage={
          result.overallTotal === 0
            ? "La bibliothèque technique est vide."
            : "Aucun document ne correspond aux critères."
        }
      />
      <CatalogPagination
        currentPage={requestedPage}
        totalPages={totalPages}
        hrefForPage={hrefForPage}
        ariaLabel="Pagination des documents techniques"
      />
    </>
  );
}

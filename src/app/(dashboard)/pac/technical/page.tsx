import Link from "next/link";
import { CirclePlus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { EquipmentType } from "@/generated/prisma/enums";
import { CatalogPagination } from "@/components/pac/technical/CatalogPagination";
import { EquipmentFilters } from "@/components/pac/technical/EquipmentFilters";
import { EquipmentTable } from "@/components/pac/technical/EquipmentTable";
import { canManageTechnicalCatalog } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { normalizeEquipmentReference } from "@/lib/hvac/normalization";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function TechnicalEquipmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const deleted = valueOf(params.deleted);
  const query = valueOf(params.q).trim().slice(0, 160);
  const manufacturerId = valueOf(params.manufacturer).slice(0, 100);
  const productRangeId = valueOf(params.range).slice(0, 100);
  const typeValue = valueOf(params.type);
  const type = Object.values(EquipmentType).includes(typeValue as EquipmentType)
    ? typeValue as EquipmentType
    : "";
  const activeValue = valueOf(params.active);
  const active = ["inactive", "all"].includes(activeValue)
    ? activeValue
    : "active";
  const reviewValue = valueOf(params.review);
  const review = ["required", "verified"].includes(reviewValue)
    ? reviewValue
    : "";
  const requestedPage = Math.max(1, Number.parseInt(valueOf(params.page), 10) || 1);
  const normalizedQuery = normalizeEquipmentReference(query);

  const where: Prisma.EquipmentWhereInput = {
    ...(manufacturerId ? { manufacturerId } : {}),
    ...(productRangeId ? { productRangeId } : {}),
    ...(type ? { type } : {}),
    ...(active === "inactive" ? { active: false } : active === "all" ? {} : { active: true }),
    ...(review === "required"
      ? { referenceNeedsReview: true }
      : review === "verified"
        ? { referenceNeedsReview: false }
        : {}),
    ...(query
      ? {
          OR: [
            { manufacturerReference: { contains: query, mode: "insensitive" } },
            { normalizedReference: { contains: normalizedQuery } },
            { name: { contains: query, mode: "insensitive" } },
            { manufacturer: { name: { contains: query, mode: "insensitive" } } },
            { productRange: { name: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [user, manufacturers, productRanges, total, equipment] =
    await Promise.all([
      getSession(),
      prisma.manufacturer.findMany({
        orderBy: [{ active: "desc" }, { name: "asc" }],
        select: { id: true, name: true },
      }),
      prisma.productRange.findMany({
        orderBy: [
          { manufacturer: { name: "asc" } },
          { active: "desc" },
          { name: "asc" },
        ],
        select: {
          id: true,
          manufacturerId: true,
          name: true,
        },
      }),
      prisma.equipment.count({ where }),
      prisma.equipment.findMany({
        where,
        orderBy: [
          { referenceNeedsReview: "desc" },
          { manufacturer: { name: "asc" } },
          { manufacturerReference: "asc" },
        ],
        skip: (requestedPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          manufacturer: { select: { name: true } },
          productRange: { select: { name: true } },
        },
      }),
    ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const urlParams = new URLSearchParams();
  if (query) urlParams.set("q", query);
  if (manufacturerId) urlParams.set("manufacturer", manufacturerId);
  if (productRangeId) urlParams.set("range", productRangeId);
  if (type) urlParams.set("type", type);
  if (active !== "active") urlParams.set("active", active);
  if (review) urlParams.set("review", review);
  const hrefForPage = (page: number) => {
    const next = new URLSearchParams(urlParams);
    next.set("page", String(page));
    return `/pac/technical?${next.toString()}`;
  };
  const canManage = canManageTechnicalCatalog(user?.role);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Catalogue PAC</p>
          <h1>Pompes et équipements</h1>
          <p>
            Une fiche par référence physique. Les références manquantes peuvent être complétées
            plus tard.
          </p>
        </div>
        {canManage && (
          <div className="page-heading-actions">
            <Link href="/pac/technical/pumps/new" className="button button-primary">
              <CirclePlus size={17} /> Ajouter une pompe
            </Link>
            {/* Ancien formulaire complet : conservé pour les cas où tous les champs techniques
                sont connus, mais il n'est plus le parcours par défaut. */}
            <Link href="/pac/technical/equipment/new" className="button button-ghost">
              Saisie détaillée
            </Link>
          </div>
        )}
      </div>

      {deleted && (
        <div className="alert alert-success" role="status">
          {deleted === "equipment"
            ? "L’équipement a été supprimé. Ses documents et fichiers PDF ont été conservés."
            : "L’équipement avait déjà été supprimé."}
        </div>
      )}

      <EquipmentFilters
        filters={{
          q: query,
          manufacturer: manufacturerId,
          range: productRangeId,
          type,
          active,
          review,
        }}
        manufacturers={manufacturers}
        productRanges={productRanges}
      />

      <div className="technical-results-summary">
        <strong>{total}</strong> équipement{total === 1 ? "" : "s"}
        {total > 0 && <span> · page {requestedPage} sur {totalPages}</span>}
      </div>

      <EquipmentTable equipment={equipment} />
      <CatalogPagination
        currentPage={requestedPage}
        totalPages={totalPages}
        hrefForPage={hrefForPage}
      />
    </>
  );
}

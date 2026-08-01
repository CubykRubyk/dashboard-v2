import Link from "next/link";
import { Boxes, Droplets, Factory, Search, Snowflake } from "lucide-react";
import { DismissibleDetails } from "@/components/ui/DismissibleDetails";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const typeLabels = {
  AIR_WATER: "Air / eau",
  AIR_AIR: "Air / air",
  GROUND_WATER: "Sol / eau",
} as const;

const configurationLabels = {
  MONOBLOC: "Monobloc",
  SPLIT: "Split",
} as const;

const splitLiaisonLabels = {
  FRIGORIFIC: "liaison frigorifique",
  HYDRAULIC: "liaison hydraulique",
} as const;

export default async function PacCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; active?: string }>;
}) {
  const filters = await searchParams;
  const q = filters.q?.trim() || "";
  const [brands, refrigerants, models] = await Promise.all([
    prisma.pacBrand.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { models: true } } } }),
    prisma.refrigerant.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { models: true } } } }),
    prisma.heatPump.findMany({
      where: {
        ...(filters.brand ? { brandId: filters.brand } : {}),
        ...(filters.active === "inactive" ? { active: false } : filters.active === "all" ? {} : { active: true }),
        ...(q ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { outdoorReference: { contains: q, mode: "insensitive" } },
            { indoorReference: { contains: q, mode: "insensitive" } },
            { brand: { name: { contains: q, mode: "insensitive" } } },
          ],
        } : {}),
      },
      include: { brand: true, refrigerant: true, _count: { select: { documents: true } } },
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Base technique</p>
          <h1>Catalogue PAC</h1>
          <p>Modèles, données d’installation, réfrigérants et documentation technique.</p>
        </div>
        <div className="page-heading-actions">
          <Link href="/pac/technical" className="button button-ghost">
            <Boxes size={17} /> Bibliothèque technique
          </Link>
        </div>
      </div>

      <div className="alert alert-danger">
        Ce catalogue historique est conservé en lecture seule pour la
        traçabilité. Les équipements, combinaisons et documents se gèrent
        désormais dans la bibliothèque technique.
      </div>

      <section className="card pac-toolbar">
        <form className="pac-filters">
          <label className="filter-input-shell"><Search size={16} /><input name="q" defaultValue={q} placeholder="Marque, modèle ou référence…" /></label>
          <select name="brand" defaultValue={filters.brand || ""}><option value="">Toutes les marques</option>{brands.map((brand) => <option value={brand.id} key={brand.id}>{brand.name}</option>)}</select>
          <select name="active" defaultValue={filters.active || ""}><option value="">Modèles actifs</option><option value="inactive">Modèles inactifs</option><option value="all">Tous les modèles</option></select>
          <button className="button button-ghost">Filtrer</button>
        </form>
        <div className="pac-reference-actions">
          <DismissibleDetails className="pac-reference-details" summaryClassName="button button-ghost button-small" summary={<><Factory size={15} /> Marques ({brands.length})</>}>
            <div className="pac-reference-panel">
              <div className="pac-reference-heading">
                <div><strong>Marques PAC</strong><small>{brands.length} marque{brands.length === 1 ? "" : "s"} enregistrée{brands.length === 1 ? "" : "s"}</small></div>
              </div>
              <div className="pac-reference-list">
                {brands.map((brand) => (
                  <div className={`pac-reference-row${brand.active ? "" : " inactive"}`} key={brand.id}>
                    <div className="pac-reference-edit">
                      <strong>{brand.name}</strong>
                      <span>{brand._count.models} modèle{brand._count.models === 1 ? "" : "s"}</span>
                      <span>{brand.active ? "Active" : "Inactive"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DismissibleDetails>
          <DismissibleDetails className="pac-reference-details" summaryClassName="button button-ghost button-small" summary={<><Droplets size={15} /> Réfrigérants ({refrigerants.length})</>}>
            <div className="pac-reference-panel refrigerant-panel">
              <div className="pac-reference-heading">
                <div><strong>Réfrigérants</strong><small>{refrigerants.length} réfrigérant{refrigerants.length === 1 ? "" : "s"} enregistré{refrigerants.length === 1 ? "" : "s"}</small></div>
              </div>
              <div className="pac-reference-list">
                {refrigerants.map((refrigerant) => (
                  <div className={`pac-reference-row${refrigerant.active ? "" : " inactive"}`} key={refrigerant.id}>
                    <div className="pac-reference-edit refrigerant-edit">
                      <strong>{refrigerant.name}</strong>
                      <span>GWP {refrigerant.gwp}</span>
                      <span>{refrigerant._count.models} modèle{refrigerant._count.models === 1 ? "" : "s"}</span>
                      <span>{refrigerant.active ? "Actif" : "Inactif"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DismissibleDetails>
        </div>
      </section>

      {models.length === 0 ? (
        <section className="card worksheet-empty">
          <Snowflake size={34} />
          <h2>Aucun modèle PAC</h2>
          <p>Les créations se font désormais dans la bibliothèque technique.</p>
        </section>
      ) : (
        <div className="pac-model-grid">
          {models.map((model) => {
            const tco2 = model.factoryChargeKg != null && model.refrigerant
              ? model.factoryChargeKg * model.refrigerant.gwp / 1000
              : null;
            return (
              <Link href={`/pac/${model.id}`} className={`card pac-model-card${model.active ? "" : " inactive"}`} key={model.id}>
                <div className="pac-model-top">
                  <span className="pac-brand">{model.brand.name}</span>
                  <span className={`status-dot ${model.active ? "active" : ""}`}>{model.active ? "Actif" : "Inactif"}</span>
                </div>
                <h2>{model.name}</h2>
                <p>
                  {typeLabels[model.type]}
                  {" · "}
                  {model.configuration === "SPLIT" && model.splitLiaisonType
                    ? `${configurationLabels[model.configuration]} ${splitLiaisonLabels[model.splitLiaisonType]}`
                    : configurationLabels[model.configuration]}
                  {" · "}
                  {model.powerKw != null ? `${model.powerKw} kW` : "Puissance non renseignée"}
                </p>
                <div className="pac-model-meta">
                  <span><strong>{model.refrigerant?.name || "—"}</strong> Réfrigérant</span>
                  <span><strong>{tco2 != null ? `${tco2.toFixed(3)} t` : "—"}</strong> CO₂e</span>
                  <span><strong>{model._count.documents}</strong> Documents</span>
                </div>
                {(model.outdoorReference || model.indoorReference) && (
                  <small>{[model.outdoorReference, model.indoorReference].filter(Boolean).join(" · ")}</small>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

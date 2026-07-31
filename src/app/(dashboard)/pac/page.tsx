import Link from "next/link";
import { CirclePlus, Droplets, Factory, Search, Snowflake } from "lucide-react";
import { DismissibleDetails } from "@/components/ui/DismissibleDetails";
import { prisma } from "@/lib/prisma";
import { createPacBrand, createRefrigerant } from "./actions";

export const dynamic = "force-dynamic";

const typeLabels = {
  AIR_WATER: "Air / eau",
  AIR_AIR: "Air / air",
  GROUND_WATER: "Sol / eau",
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
        <Link href="/pac/nouveau" className="button button-primary">
          <CirclePlus size={17} /> Ajouter un modèle
        </Link>
      </div>

      <section className="card pac-toolbar">
        <form className="pac-filters">
          <label className="filter-input-shell"><Search size={16} /><input name="q" defaultValue={q} placeholder="Marque, modèle ou référence…" /></label>
          <select name="brand" defaultValue={filters.brand || ""}><option value="">Toutes les marques</option>{brands.map((brand) => <option value={brand.id} key={brand.id}>{brand.name}</option>)}</select>
          <select name="active" defaultValue={filters.active || ""}><option value="">Modèles actifs</option><option value="inactive">Modèles inactifs</option><option value="all">Tous les modèles</option></select>
          <button className="button button-ghost">Filtrer</button>
        </form>
        <div className="pac-reference-actions">
          <DismissibleDetails summaryClassName="button button-ghost button-small" summary={<><Factory size={15} /> Marques ({brands.length})</>}>
            <form action={createPacBrand} className="pac-quick-form">
              <label>Nouvelle marque<input name="name" required placeholder="Ex. Daikin" /></label>
              <button className="button button-primary button-small">Ajouter</button>
            </form>
          </DismissibleDetails>
          <DismissibleDetails summaryClassName="button button-ghost button-small" summary={<><Droplets size={15} /> Réfrigérants ({refrigerants.length})</>}>
            <form action={createRefrigerant} className="pac-quick-form refrigerant-form">
              <label>Réfrigérant<input name="name" required placeholder="Ex. R32" /></label>
              <label>GWP<input name="gwp" required type="number" min="0" step="0.01" /></label>
              <button className="button button-primary button-small">Ajouter</button>
            </form>
          </DismissibleDetails>
        </div>
      </section>

      {models.length === 0 ? (
        <section className="card worksheet-empty">
          <Snowflake size={34} />
          <h2>Aucun modèle PAC</h2>
          <p>Ajoutez d’abord une marque et un réfrigérant, puis créez votre premier modèle.</p>
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
                <p>{typeLabels[model.type]} · {model.powerKw != null ? `${model.powerKw} kW` : "Puissance non renseignée"}</p>
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

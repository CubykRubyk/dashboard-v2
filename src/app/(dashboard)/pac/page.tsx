import Link from "next/link";
import { Boxes, CirclePlus, Droplets, Factory, Power, PowerOff, Save, Search, Snowflake } from "lucide-react";
import { DeletePacReferenceButton } from "@/components/pac/DeletePacReferenceButton";
import { DismissibleDetails } from "@/components/ui/DismissibleDetails";
import { prisma } from "@/lib/prisma";
import {
  createPacBrand,
  createRefrigerant,
  deletePacBrand,
  deleteRefrigerant,
  togglePacBrand,
  toggleRefrigerant,
  updatePacBrand,
  updateRefrigerant,
} from "./actions";

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
              <form action={createPacBrand} className="pac-reference-add">
                <label>Nouvelle marque<input name="name" required placeholder="Ex. Daikin" /></label>
                <button className="button button-primary button-small"><CirclePlus size={15} /> Ajouter</button>
              </form>
              <div className="pac-reference-list">
                {brands.map((brand) => (
                  <div className={`pac-reference-row${brand.active ? "" : " inactive"}`} key={brand.id}>
                    <form action={updatePacBrand.bind(null, brand.id)} className="pac-reference-edit">
                      <input name="name" defaultValue={brand.name} required aria-label={`Nom de la marque ${brand.name}`} />
                      <span>{brand._count.models} modèle{brand._count.models === 1 ? "" : "s"}</span>
                      <button className="mini-action" title="Enregistrer" aria-label={`Enregistrer ${brand.name}`}><Save size={14} /></button>
                    </form>
                    <form action={togglePacBrand.bind(null, brand.id, !brand.active)}>
                      <button className="mini-action" title={brand.active ? "Désactiver" : "Activer"} aria-label={`${brand.active ? "Désactiver" : "Activer"} ${brand.name}`}>
                        {brand.active ? <PowerOff size={14} /> : <Power size={14} />}
                      </button>
                    </form>
                    {brand._count.models === 0 && <DeletePacReferenceButton action={deletePacBrand.bind(null, brand.id)} label={brand.name} />}
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
              <form action={createRefrigerant} className="pac-reference-add refrigerant-add">
                <label>Réfrigérant<input name="name" required placeholder="Ex. R32" /></label>
                <label>GWP<input name="gwp" required type="number" min="0" step="0.01" /></label>
                <button className="button button-primary button-small"><CirclePlus size={15} /> Ajouter</button>
              </form>
              <div className="pac-reference-list">
                {refrigerants.map((refrigerant) => (
                  <div className={`pac-reference-row${refrigerant.active ? "" : " inactive"}`} key={refrigerant.id}>
                    <form action={updateRefrigerant.bind(null, refrigerant.id)} className="pac-reference-edit refrigerant-edit">
                      <input name="name" defaultValue={refrigerant.name} required aria-label={`Nom du réfrigérant ${refrigerant.name}`} />
                      <input name="gwp" defaultValue={refrigerant.gwp} required type="number" min="0" step="0.01" aria-label={`GWP de ${refrigerant.name}`} />
                      <span>{refrigerant._count.models} modèle{refrigerant._count.models === 1 ? "" : "s"}</span>
                      <button className="mini-action" title="Enregistrer" aria-label={`Enregistrer ${refrigerant.name}`}><Save size={14} /></button>
                    </form>
                    <form action={toggleRefrigerant.bind(null, refrigerant.id, !refrigerant.active)}>
                      <button className="mini-action" title={refrigerant.active ? "Désactiver" : "Activer"} aria-label={`${refrigerant.active ? "Désactiver" : "Activer"} ${refrigerant.name}`}>
                        {refrigerant.active ? <PowerOff size={14} /> : <Power size={14} />}
                      </button>
                    </form>
                    {refrigerant._count.models === 0 && <DeletePacReferenceButton action={deleteRefrigerant.bind(null, refrigerant.id)} label={refrigerant.name} />}
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

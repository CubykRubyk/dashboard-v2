"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import { GxonDropdown } from "@/components/ui/GxonDropdown";

export function CombinationFilters({
  filters,
  manufacturers,
  productRanges,
  resetHref = "/pac/technical/combinations",
}: {
  filters: {
    q: string;
    manufacturer: string;
    range: string;
    active: string;
    review: string;
  };
  manufacturers: Array<{ id: string; name: string }>;
  productRanges: Array<{ id: string; manufacturerId: string; name: string }>;
  resetHref?: string;
}) {
  const [manufacturerId, setManufacturerId] = useState(filters.manufacturer);
  const [productRangeId, setProductRangeId] = useState(filters.range);
  const [activeValue, setActiveValue] = useState(filters.active);
  const [reviewValue, setReviewValue] = useState(filters.review);
  const visibleRanges = useMemo(
    () => manufacturerId
      ? productRanges.filter((range) => range.manufacturerId === manufacturerId)
      : productRanges,
    [manufacturerId, productRanges],
  );
  const filtered = Boolean(
    filters.q
    || filters.manufacturer
    || filters.range
    || filters.active !== "active"
    || filters.review,
  );

  return (
    <form className="card technical-combination-filters" method="get">
      <label className="technical-filter-search">
        <span>Recherche</span>
        <span className="filter-input-shell">
          <Search size={16} />
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Nom, référence UI / UE, fabricant ou gamme…"
          />
        </span>
      </label>
      <GxonDropdown name="manufacturer" label="Fabricant" value={manufacturerId} onChange={(value) => { setManufacturerId(value); setProductRangeId(""); }} options={[{ value: "", label: "Tous" }, ...manufacturers.map((manufacturer) => ({ value: manufacturer.id, label: manufacturer.name }))]} />
      <GxonDropdown name="range" label="Gamme" value={productRangeId} onChange={setProductRangeId} options={[{ value: "", label: "Toutes" }, ...visibleRanges.map((range) => ({ value: range.id, label: range.name }))]} />
      <GxonDropdown name="active" label="Statut" value={activeValue} onChange={setActiveValue} options={[{ value: "active", label: "Actives" }, { value: "inactive", label: "Inactives" }, { value: "all", label: "Toutes" }]} />
      <GxonDropdown name="review" label="Références" value={reviewValue} onChange={setReviewValue} options={[{ value: "", label: "Toutes" }, { value: "required", label: "À vérifier" }, { value: "verified", label: "Vérifiées" }]} />
      <div className="filter-actions">
        <button className="button button-primary">Filtrer</button>
        {filtered && (
          <Link
            className="button button-ghost"
            href={resetHref}
          >
            <RotateCcw size={15} /> Réinitialiser
          </Link>
        )}
      </div>
    </form>
  );
}

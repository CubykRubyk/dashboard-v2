"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RotateCcw, Search } from "lucide-react";

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
      <label>
        <span>Fabricant</span>
        <select
          name="manufacturer"
          value={manufacturerId}
          onChange={(event) => {
            setManufacturerId(event.currentTarget.value);
            setProductRangeId("");
          }}
        >
          <option value="">Tous</option>
          {manufacturers.map((manufacturer) => (
            <option value={manufacturer.id} key={manufacturer.id}>
              {manufacturer.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Gamme</span>
        <select
          name="range"
          value={productRangeId}
          onChange={(event) => setProductRangeId(event.currentTarget.value)}
        >
          <option value="">Toutes</option>
          {visibleRanges.map((range) => (
            <option value={range.id} key={range.id}>{range.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Statut</span>
        <select name="active" defaultValue={filters.active}>
          <option value="active">Actives</option>
          <option value="inactive">Inactives</option>
          <option value="all">Toutes</option>
        </select>
      </label>
      <label>
        <span>Références</span>
        <select name="review" defaultValue={filters.review}>
          <option value="">Toutes</option>
          <option value="required">À vérifier</option>
          <option value="verified">Vérifiées</option>
        </select>
      </label>
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

"use client";

import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";
import { TechnicalDocumentType } from "@/generated/prisma/enums";
import { technicalDocumentTypeLabels } from "@/lib/hvac/labels";

export function DocumentFilters({
  filters,
  manufacturers,
}: {
  filters: {
    q: string;
    type: string;
    active: string;
    manufacturer: string;
    association: string;
    legacy: string;
  };
  manufacturers: Array<{ id: string; name: string }>;
}) {
  const filtered = Boolean(
    filters.q
    || filters.type
    || filters.active !== "active"
    || filters.manufacturer
    || filters.association
    || filters.legacy,
  );

  return (
    <form className="card technical-document-filters" method="get">
      <label className="technical-filter-search">
        <span>Recherche</span>
        <span className="filter-input-shell">
          <Search size={16} />
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Titre, fichier, référence, fabricant ou gamme…"
          />
        </span>
      </label>
      <label>
        <span>Type</span>
        <select name="type" defaultValue={filters.type}>
          <option value="">Tous</option>
          {Object.values(TechnicalDocumentType).map((type) => (
            <option value={type} key={type}>
              {technicalDocumentTypeLabels[type]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Fabricant</span>
        <select name="manufacturer" defaultValue={filters.manufacturer}>
          <option value="">Tous</option>
          {manufacturers.map((manufacturer) => (
            <option value={manufacturer.id} key={manufacturer.id}>
              {manufacturer.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Association</span>
        <select name="association" defaultValue={filters.association}>
          <option value="">Toutes</option>
          <option value="equipment">Avec équipement</option>
          <option value="combination">Avec combinaison</option>
          <option value="unassociated">Sans association</option>
        </select>
      </label>
      <label>
        <span>Origine</span>
        <select name="legacy" defaultValue={filters.legacy}>
          <option value="">Toutes</option>
          <option value="legacy">Migration legacy</option>
          <option value="native">Bibliothèque technique</option>
        </select>
      </label>
      <label>
        <span>Statut</span>
        <select name="active" defaultValue={filters.active}>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
          <option value="all">Tous</option>
        </select>
      </label>
      <div className="filter-actions">
        <button className="button button-primary">Filtrer</button>
        {filtered && (
          <Link
            className="button button-ghost"
            href="/pac/technical/documents"
          >
            <RotateCcw size={15} /> Réinitialiser
          </Link>
        )}
      </div>
    </form>
  );
}

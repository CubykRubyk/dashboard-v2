"use client";

import { useMemo, useState } from "react";
import { Check, Search, Snowflake } from "lucide-react";

export type GenerationCombination = {
  id: string;
  name: string;
  manufacturerId: string;
  manufacturerName: string;
  rangeName: string;
  indoorReference: string;
  indoorName: string;
  outdoorReference: string;
  outdoorName: string;
};

export function GenerationEquipmentPicker({ combinations }: { combinations: GenerationCombination[] }) {
  const [manufacturerId, setManufacturerId] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const manufacturers = useMemo(() => Array.from(new Map(combinations.map((item) => [item.manufacturerId, item.manufacturerName])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [combinations]);
  const available = useMemo(() => combinations.filter((item) => item.manufacturerId === manufacturerId && `${item.name} ${item.indoorReference} ${item.outdoorReference} ${item.rangeName}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 80), [combinations, manufacturerId, query]);
  const selected = combinations.find((item) => item.id === selectedId);
  return <div className="generation-pac-picker"><input type="hidden" name="systemCombinationId" value={selectedId} /><div className="generation-pac-controls"><label>Marque<select value={manufacturerId} onChange={(event) => { setManufacturerId(event.target.value); setSelectedId(""); setQuery(""); }}><option value="">Choisir une marque</option>{manufacturers.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label><label className="generation-model-search">Rechercher un modèle{manufacturerId ? <span className="generation-search-input"><Search size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedId(""); }} placeholder="Référence, modèle ou gamme" /></span> : <span className="generation-search-disabled">Choisissez d’abord une marque</span>}</label></div>{manufacturerId && <label>Modèle PAC<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Aucun modèle sélectionné</option>{available.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.outdoorReference} + {item.indoorReference}</option>)}</select><small className="muted">{available.length}{available.length === 80 ? "+" : ""} modèle(s) trouvé(s)</small></label>}{selected && <div className="generation-pac-selected"><div className="generation-pac-selected-icon"><Snowflake size={19} /></div><div><strong>{selected.name}</strong><p>{selected.rangeName || "Sans gamme"} · {selected.outdoorReference} + {selected.indoorReference}</p></div><Check size={18} /></div>}</div>;
}

"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { PlanningItem, ProximitySuggestion } from "./mock-data";
import styles from "./planification-sav.module.css";

function MapFocus({
  suggestion,
  items,
}: {
  suggestion: ProximitySuggestion | null;
  items: PlanningItem[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!suggestion) return;
    const intervention = items.find((item) => item.id === suggestion.interventionId);
    const sav = items.find((item) => item.id === suggestion.savId);
    if (!intervention || !sav) return;
    map.fitBounds([intervention.coordinates, sav.coordinates], {
      padding: [70, 70],
      maxZoom: 14,
      animate: true,
    });
  }, [items, map, suggestion]);

  return null;
}

function markerIcon(item: PlanningItem, highlighted: boolean) {
  const urgent = item.kind === "sav" && item.priority === "Urgente";
  const toneClass = urgent
    ? styles.markerUrgent
    : item.kind === "sav"
      ? styles.markerSav
      : styles.markerIntervention;
  const label = urgent ? "!" : item.kind === "sav" ? "S" : "I";

  return L.divIcon({
    className: `${styles.markerShell}${highlighted ? ` ${styles.markerHighlighted}` : ""}`,
    html: `<span class="${styles.mapMarker} ${toneClass}"><span>${label}</span></span>`,
    iconSize: [38, 44],
    iconAnchor: [19, 42],
    popupAnchor: [0, -38],
  });
}

export function PlanningMap({
  items,
  activeSuggestion,
  onSelectItem,
}: {
  items: PlanningItem[];
  activeSuggestion: ProximitySuggestion | null;
  onSelectItem: (item: PlanningItem) => void;
}) {
  const highlightedIds = useMemo(
    () =>
      new Set(
        activeSuggestion
          ? [activeSuggestion.interventionId, activeSuggestion.savId]
          : [],
      ),
    [activeSuggestion],
  );
  const selectedPair = activeSuggestion
    ? [
        items.find((item) => item.id === activeSuggestion.interventionId),
        items.find((item) => item.id === activeSuggestion.savId),
      ].filter((item): item is PlanningItem => Boolean(item))
    : [];

  return (
    <MapContainer
      center={[45.7638, 4.8467]}
      zoom={12}
      scrollWheelZoom
      className={styles.map}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {items.map((item) => (
        <Marker
          key={item.id}
          position={item.coordinates}
          icon={markerIcon(item, highlightedIds.has(item.id))}
          eventHandlers={{ click: () => onSelectItem(item) }}
          title={`${item.reference} · ${item.company}`}
          alt={`${item.kind === "sav" ? "SAV" : "Intervention"} ${item.company}`}
        >
          <Popup>
            <div className={styles.mapPopup}>
              <span>{item.reference}</span>
              <strong>{item.title}</strong>
              <p>{item.company}</p>
              <button type="button" onClick={() => onSelectItem(item)}>
                Voir les détails
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
      {selectedPair.length === 2 && (
        <Polyline
          positions={[selectedPair[0].coordinates, selectedPair[1].coordinates]}
          pathOptions={{
            color: "#316aff",
            weight: 4,
            opacity: 0.9,
            dashArray: "8 10",
          }}
        />
      )}
      <MapFocus suggestion={activeSuggestion} items={items} />
    </MapContainer>
  );
}


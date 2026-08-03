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
  useMapEvents,
} from "react-leaflet";
import { buildHeadquartersPlanningItem, HEADQUARTERS_STOP_ID, type PlanningItem, type ProximitySuggestion } from "./mock-data";
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
    if (!intervention?.coordinates || !sav?.coordinates) return;
    map.fitBounds([intervention.coordinates, sav.coordinates], {
      padding: [70, 70],
      maxZoom: 14,
      animate: true,
    });
  }, [items, map, suggestion]);

  return null;
}

function MapBackgroundClick({ onClick }: { onClick?: () => void }) {
  useMapEvents({
    click: () => onClick?.(),
  });
  return null;
}

function FitAllBounds({
  points,
  active,
}: {
  points: [number, number][];
  active: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (active || points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 12, { animate: true });
      return;
    }
    map.fitBounds(points, { padding: [40, 40], maxZoom: 13, animate: true });
  }, [active, map, points]);

  return null;
}

function headquartersIcon(routeOrder?: number) {
  const badge = routeOrder ? `<span class="${styles.markerRouteBadge}">${routeOrder}</span>` : "";
  return L.divIcon({
    className: `${styles.markerShell}${routeOrder ? ` ${styles.markerInRoute}` : ""}`,
    html: `<span class="${styles.mapMarkerHq}">🏠${badge}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
}

function markerIcon(item: PlanningItem, highlighted: boolean, routeOrder?: number, hasSuggestion?: boolean) {
  const urgent = item.kind === "sav" && item.priority === "Urgente";
  const closed = item.kind === "sav" && (item.status === "Clôturé" || Boolean(item.closedAt));
  const toneClass = closed
    ? styles.markerClosed
    : urgent
      ? styles.markerUrgent
      : item.kind === "sav"
        ? styles.markerSav
        : styles.markerIntervention;
  const label = closed ? "✓" : urgent ? "!" : item.kind === "sav" ? "S" : "I";
  const style = item.kind === "intervention" && item.color ? ` style="background:${item.color};border-color:${item.color}"` : "";
  const badge = routeOrder ? `<span class="${styles.markerRouteBadge}">${routeOrder}</span>` : "";
  const suggestionBadge = hasSuggestion ? `<span class="${styles.markerSuggestionBadge}">✦</span>` : "";

  return L.divIcon({
    className: `${styles.markerShell}${highlighted ? ` ${styles.markerHighlighted}` : ""}${routeOrder ? ` ${styles.markerInRoute}` : ""}`,
    html: `<span class="${styles.mapMarker} ${toneClass}"${style}><span>${label}</span>${badge}${suggestionBadge}</span>`,
    iconSize: [38, 44],
    iconAnchor: [19, 42],
    popupAnchor: [0, -38],
  });
}

export function PlanningMap({
  items,
  activeSuggestion,
  onSelectItem,
  routeMode = false,
  routeStopIds = [],
  routeGeometry = [],
  onToggleRouteStop,
  headquarters = null,
  onBackgroundClick,
  suggestionItemIds,
}: {
  items: PlanningItem[];
  activeSuggestion: ProximitySuggestion | null;
  onSelectItem: (item: PlanningItem) => void;
  routeMode?: boolean;
  routeStopIds?: string[];
  routeGeometry?: [number, number][];
  onToggleRouteStop?: (item: PlanningItem) => void;
  headquarters?: { name: string; address: string; coordinates: [number, number] } | null;
  onBackgroundClick?: () => void;
  suggestionItemIds?: Set<string>;
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
  const geolocatedItems = useMemo(
    () => items.filter((item): item is PlanningItem & { coordinates: [number, number] } => Boolean(item.coordinates)),
    [items],
  );
  const selectedPair = activeSuggestion
    ? [
        items.find((item) => item.id === activeSuggestion.interventionId),
        items.find((item) => item.id === activeSuggestion.savId),
      ].filter((item): item is PlanningItem & { coordinates: [number, number] } => Boolean(item?.coordinates))
    : [];

  const geolocatedPoints = useMemo(
    () => [...geolocatedItems.map((item) => item.coordinates), ...(headquarters ? [headquarters.coordinates] : [])],
    [geolocatedItems, headquarters],
  );

  return (
    <MapContainer
      center={[46.6, 2.5]}
      zoom={6}
      scrollWheelZoom
      className={styles.map}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {geolocatedItems.map((item) => {
        const routeOrder = routeStopIds.indexOf(item.id);
        const clientLabel = item.contact || item.company || item.title;
        return (
          <Marker
            key={item.id}
            position={item.coordinates}
            icon={markerIcon(item, highlightedIds.has(item.id), routeOrder >= 0 ? routeOrder + 1 : undefined, suggestionItemIds?.has(item.id))}
            eventHandlers={{
              click: () => (routeMode ? onToggleRouteStop?.(item) : onSelectItem(item)),
            }}
            title={clientLabel}
            alt={`${item.kind === "sav" ? "SAV" : "Intervention"} ${clientLabel}`}
          >
            <Popup>
              <div className={styles.mapPopup}>
                <span>{item.reference}</span>
                <strong>{item.title}</strong>
                <p>{item.company}</p>
                {routeMode ? (
                  <button type="button" onClick={() => onToggleRouteStop?.(item)}>
                    {routeOrder >= 0 ? "Retirer de l’itinéraire" : "Ajouter à l’itinéraire"}
                  </button>
                ) : (
                  <button type="button" onClick={() => onSelectItem(item)}>
                    Voir les détails
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
      {headquarters && (() => {
        const hqRouteOrder = routeStopIds.indexOf(HEADQUARTERS_STOP_ID);
        return (
          <Marker
            position={headquarters.coordinates}
            icon={headquartersIcon(hqRouteOrder >= 0 ? hqRouteOrder + 1 : undefined)}
            eventHandlers={{
              click: () => {
                if (routeMode) onToggleRouteStop?.(buildHeadquartersPlanningItem(headquarters));
              },
            }}
            title={headquarters.name}
            alt={`Siège social · ${headquarters.name}`}
            zIndexOffset={1000}
          >
            <Popup>
              <div className={styles.mapPopup}>
                <span>Siège social</span>
                <strong>{headquarters.name}</strong>
                <p>{headquarters.address}</p>
                {routeMode && (
                  <button
                    type="button"
                    onClick={() => onToggleRouteStop?.(buildHeadquartersPlanningItem(headquarters))}
                  >
                    {hqRouteOrder >= 0 ? "Retirer de l’itinéraire" : "Ajouter à l’itinéraire"}
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })()}
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
      {routeGeometry.length > 1 && (
        <Polyline
          positions={routeGeometry}
          pathOptions={{
            color: "#22b07e",
            weight: 5,
            opacity: 0.85,
          }}
        />
      )}
      <MapFocus suggestion={activeSuggestion} items={items} />
      <FitAllBounds points={geolocatedPoints} active={Boolean(activeSuggestion)} />
      <MapBackgroundClick onClick={onBackgroundClick} />
    </MapContainer>
  );
}

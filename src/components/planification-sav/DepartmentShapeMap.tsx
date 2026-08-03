"use client";

import { useMemo, useRef, useState } from "react";
import { getDepartments, groupItemsByDepartment } from "@/lib/geo/departments";
import type { PlanningItem } from "./mock-data";
import styles from "./planification-sav.module.css";

const IDF_CODES = ["75", "77", "78", "91", "92", "93", "94", "95"];

interface ProjectedFeature {
  code: string;
  nom: string;
  path: string;
  cx: number;
  cy: number;
}

function flattenOuterRings(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): GeoJSON.Position[][] {
  if (geometry.type === "Polygon") return [geometry.coordinates[0]];
  return geometry.coordinates.map((polygon) => polygon[0]);
}

// Projection équirectangulaire simple (pas de dépendance externe) — la longitude est compressée par
// cos(latitude moyenne) pour corriger l'aspect, comme dans le mockup d'artefact validé par Ion.
function projectDepartments(codes: string[] | null, width: number, height: number, padding: number): ProjectedFeature[] {
  const departments = codes ? getDepartments().filter((d) => codes.includes(d.code)) : getDepartments();
  const rings = departments.flatMap((d) => flattenOuterRings(d.geometry));
  const allPoints = rings.flat();
  const lons = allPoints.map((p) => p[0]);
  const lats = allPoints.map((p) => p[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const cosLat = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const widthUnits = (maxLon - minLon) * cosLat;
  const heightUnits = maxLat - minLat;
  const scale = Math.min((width - 2 * padding) / widthUnits, (height - 2 * padding) / heightUnits);
  const offsetX = padding + (width - 2 * padding - widthUnits * scale) / 2;
  const offsetY = padding + (height - 2 * padding - heightUnits * scale) / 2;

  const project = (lon: number, lat: number): [number, number] => [
    (lon - minLon) * cosLat * scale + offsetX,
    (maxLat - lat) * scale + offsetY,
  ];

  return departments.map((department) => {
    const outerRings = flattenOuterRings(department.geometry);
    const path = outerRings
      .map((ring) => {
        const points = ring.map(([lon, lat]) => project(lon, lat));
        return `M${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L")} Z`;
      })
      .join(" ");
    const ringPoints = outerRings.flat();
    const ringLons = ringPoints.map((p) => p[0]);
    const ringLats = ringPoints.map((p) => p[1]);
    const [cx, cy] = project(
      (Math.min(...ringLons) + Math.max(...ringLons)) / 2,
      (Math.min(...ringLats) + Math.max(...ringLats)) / 2,
    );
    return { code: department.code, nom: department.nom, path, cx, cy };
  });
}

function DeptFeatures({
  features,
  groups,
  selectedCode,
  onSelectDepartment,
  hideLabelCodes,
  useNativeClick,
}: {
  features: ProjectedFeature[];
  groups: ReturnType<typeof groupItemsByDepartment>;
  selectedCode: string | null;
  onSelectDepartment: (code: string) => void;
  hideLabelCodes?: string[];
  useNativeClick?: boolean;
}) {
  return (
    <>
      {features.map((feature) => {
        const group = groups.get(feature.code);
        const savCount = group?.savItems.length ?? 0;
        const interventionCount = group?.interventionItems.length ?? 0;
        const hasData = savCount + interventionCount > 0;
        const intensity = Math.min(1, (savCount + interventionCount) / 4);
        const showLabel = !hideLabelCodes?.includes(feature.code);
        return (
          <g key={feature.code}>
            <path
              d={feature.path}
              className={`${styles.deptShape}${hasData ? ` ${styles.deptShapeHasData}` : ""}${selectedCode === feature.code ? ` ${styles.deptShapeActive}` : ""}`}
              style={hasData ? { fill: `color-mix(in srgb, var(--primary) ${70 + intensity * 30}%, #10192e)` } : undefined}
              data-dept-code={feature.code}
              data-has-data={hasData}
              onClick={useNativeClick && hasData ? () => onSelectDepartment(feature.code) : undefined}
            >
              <title>{feature.nom}</title>
            </path>
            {showLabel && (
              <text x={feature.cx} y={feature.cy} className={`${styles.deptShapeLabel}${hasData ? ` ${styles.deptShapeLabelHasData}` : ""}`}>
                {feature.code}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

function ZoomableSvgMap({
  features,
  width,
  height,
  groups,
  selectedCode,
  onSelectDepartment,
  hideLabelCodes,
}: {
  features: ProjectedFeature[];
  width: number;
  height: number;
  groups: ReturnType<typeof groupItemsByDepartment>;
  selectedCode: string | null;
  onSelectDepartment: (code: string) => void;
  hideLabelCodes?: string[];
}) {
  const [transform, setTransform] = useState({ scale: 1, tx: 0, ty: 0 });
  const dragState = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const zoomBy = (factor: number) => {
    // La borne basse n'est pas 1 : en plein écran (conteneur très différent en forme), l'ajustement
    // "meet" du viewBox seul ne suffit pas toujours à tout montrer confortablement — Ion doit pouvoir
    // dézoomer sous l'échelle "normale" pour tout faire tenir.
    setTransform((current) => ({ ...current, scale: Math.min(8, Math.max(0.3, current.scale * factor)) }));
  };
  const resetView = () => setTransform({ scale: 1, tx: 0, ty: 0 });

  // `setPointerCapture` sur ce conteneur (nécessaire pour continuer à recevoir pointermove pendant un
  // glisser hors de son rectangle) empêche le "click" natif de se déclencher sur les `<path>` enfants
  // (le navigateur n'associe plus pointerdown/pointerup au même élément une fois capturés) — on détecte
  // donc nous-mêmes un clic (peu de mouvement entre down/up) et on retrouve l'élément réel sous le
  // curseur via `elementFromPoint`, plutôt que de compter sur l'événement click du SVG.
  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const wasClick = dragState.current && !dragState.current.moved;
    dragState.current = null;
    (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
    if (!wasClick) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const deptElement = target?.closest("[data-dept-code]");
    const code = deptElement?.getAttribute("data-dept-code");
    const hasData = deptElement?.getAttribute("data-has-data") === "true";
    if (code && hasData) onSelectDepartment(code);
  };

  return (
    <div className={styles.deptShapeToolbar}>
      <div className={styles.deptShapeZoomControls}>
        <button type="button" onClick={() => zoomBy(1 / 1.3)} aria-label="Dézoomer">−</button>
        <button type="button" onClick={() => zoomBy(1.3)} aria-label="Zoomer">+</button>
        <button type="button" onClick={resetView} aria-label="Réinitialiser le zoom">⟲</button>
      </div>
      <div
        className={styles.deptShapeViewport}
        onWheel={(event) => {
          event.preventDefault();
          zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15);
        }}
        onPointerDown={(event) => {
          dragState.current = { x: event.clientX, y: event.clientY, moved: false };
          (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!dragState.current) return;
          const dx = event.clientX - dragState.current.x;
          const dy = event.clientY - dragState.current.y;
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.current.moved = true;
          dragState.current.x = event.clientX;
          dragState.current.y = event.clientY;
          if (dragState.current.moved) {
            setTransform((current) => ({ ...current, tx: current.tx + dx, ty: current.ty + dy }));
          }
        }}
        onPointerUp={handlePointerUp}
      >
        <svg className={styles.deptShapeSvg} viewBox={`0 0 ${width} ${height}`}>
          <g transform={`translate(${transform.tx},${transform.ty}) scale(${transform.scale})`}>
            <DeptFeatures
              features={features}
              groups={groups}
              selectedCode={selectedCode}
              onSelectDepartment={onSelectDepartment}
              hideLabelCodes={hideLabelCodes}
            />
          </g>
        </svg>
      </div>
    </div>
  );
}

export function DepartmentShapeMap({
  items,
  selectedCode,
  onSelectDepartment,
}: {
  items: PlanningItem[];
  selectedCode: string | null;
  onSelectDepartment: (code: string) => void;
}) {
  const groups = useMemo(() => groupItemsByDepartment(items), [items]);
  const franceFeatures = useMemo(() => projectDepartments(null, 720, 720, 10), []);
  const idfFeatures = useMemo(() => projectDepartments(IDF_CODES, 200, 200, 10), []);

  return (
    <div className={styles.deptShapeMain}>
      <ZoomableSvgMap
        features={franceFeatures}
        width={720}
        height={720}
        groups={groups}
        selectedCode={selectedCode}
        onSelectDepartment={onSelectDepartment}
        hideLabelCodes={IDF_CODES}
      />
      {/* Île-de-France en médaillon fixe dans un coin — les départements y sont trop petits/serrés à
          l'échelle réelle de la France pour rester lisibles/cliquables ; même principe que la Corse
          (2A/2B), souvent isolée dans un encart sur les cartes de France. Ne zoome/déplace pas avec la
          carte principale — projection propre, plus grande, statique. */}
      <div className={styles.deptShapeCorner}>
        <span className={styles.deptShapeCornerLabel}>Île-de-France</span>
        <svg viewBox="0 0 200 200" className={styles.deptShapeCornerSvg}>
          <DeptFeatures
            features={idfFeatures}
            groups={groups}
            selectedCode={selectedCode}
            onSelectDepartment={onSelectDepartment}
            useNativeClick
          />
        </svg>
      </div>
    </div>
  );
}

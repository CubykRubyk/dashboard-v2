"use client";

import { useMemo } from "react";
import { CARTOGRAM_POSITIONS, groupItemsByDepartment } from "@/lib/geo/departments";
import type { PlanningItem } from "./mock-data";
import styles from "./planification-sav.module.css";

export function DepartmentCartogram({
  items,
  selectedCode,
  onSelectDepartment,
}: {
  items: PlanningItem[];
  selectedCode: string | null;
  onSelectDepartment: (code: string) => void;
}) {
  const groups = useMemo(() => groupItemsByDepartment(items), [items]);

  const { maxRow, maxCol } = useMemo(() => {
    let mr = 0;
    let mc = 0;
    for (const [row, col] of Object.values(CARTOGRAM_POSITIONS)) {
      if (row > mr) mr = row;
      if (col > mc) mc = col;
    }
    return { maxRow: mr, maxCol: mc };
  }, []);

  return (
    <div
      className={styles.departmentCartogram}
      style={{ gridTemplateRows: `repeat(${maxRow + 1}, 1fr)`, gridTemplateColumns: `repeat(${maxCol + 1}, 1fr)` }}
    >
      {Object.entries(CARTOGRAM_POSITIONS).map(([code, [row, col]]) => {
        const group = groups.get(code);
        const savCount = group?.savItems.length ?? 0;
        const interventionCount = group?.interventionItems.length ?? 0;
        const hasData = savCount > 0 || interventionCount > 0;
        const intensity = Math.min(1, (savCount + interventionCount) / 4);
        return (
          <button
            type="button"
            key={code}
            className={`${styles.departmentTile}${hasData ? ` ${styles.departmentTileHasData}` : ""}${selectedCode === code ? ` ${styles.departmentTileActive}` : ""}`}
            style={{
              gridRow: row + 1,
              gridColumn: col + 1,
              ...(hasData
                ? { background: `color-mix(in srgb, var(--primary-subtle) ${30 + intensity * 55}%, var(--surface))` }
                : {}),
            }}
            disabled={!hasData}
            onClick={() => onSelectDepartment(code)}
            title={group?.nom ?? code}
          >
            <span className={styles.departmentTileCode}>{code}</span>
            {hasData && (
              <span className={styles.departmentTileCounts}>
                {savCount > 0 && <b className={styles.departmentTileSav}>{savCount}</b>}
                {interventionCount > 0 && <b className={styles.departmentTileIntervention}>{interventionCount}</b>}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

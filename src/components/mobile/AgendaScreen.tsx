"use client";

import { useRouter } from "next/navigation";
import { useT } from "./MobilePreferences";
import { MobileTabBar } from "./MobileTabBar";
import { PlanningCalendar } from "@/components/planification-sav/PlanningCalendar";
import type { PlanningItem } from "@/components/planification-sav/mock-data";
import styles from "./mobile.module.css";

export function AgendaScreen({ items }: { items: PlanningItem[] }) {
  const t = useT();
  const router = useRouter();

  return (
    <>
      <header className={styles.topBar}>
        <p className={styles.topEyebrow}>{t("calendar.subtitle")}</p>
        <h1 className={styles.topTitle}>{t("calendar.title")}</h1>
      </header>

      <div className={`${styles.scroll} ${styles.scrollFlush} ${styles.pageEnter}`}>
        {/* On réutilise le calendrier du desktop (FullCalendar) tel quel — même rendu, mêmes
            couleurs d'équipe — plutôt que d'en réécrire un pour mobile. */}
        <div className={styles.calendarWrap}>
          <PlanningCalendar items={items} onSelectItem={(item) => router.push(`/mobile/item/${item.id}`)} />
        </div>
      </div>

      <MobileTabBar />
    </>
  );
}

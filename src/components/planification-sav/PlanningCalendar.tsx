"use client";

import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import frLocale from "@fullcalendar/react/locales/fr";
import type { PlanningItem } from "./mock-data";
import styles from "./planification-sav.module.css";

export function PlanningCalendar({
  items,
  onSelectItem,
}: {
  items: PlanningItem[];
  onSelectItem: (item: PlanningItem) => void;
}) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const events = items.map((item) => {
    const isSav = item.kind === "sav";
    return {
      id: item.id,
      title: `${isSav ? "SAV" : item.team} · ${item.company}`,
      start: isSav ? item.date : `${item.date}T${item.time}:00`,
      end: isSav ? undefined : `${item.date}T${endTime(item.time!, item.duration)}`,
      allDay: isSav,
      color: isSav
        ? item.priority === "Urgente"
          ? "#ff401c"
          : "#ff8110"
        : "#316aff",
      contrastColor: "#ffffff",
      className: isSav
        ? item.priority === "Urgente"
          ? styles.calendarUrgentEvent
          : styles.calendarSavEvent
        : styles.calendarInterventionEvent,
      extendedProps: { itemId: item.id },
    };
  });

  return (
    <div className={styles.calendarShell}>
      <div className={styles.calendarLegend} aria-label="Légende du calendrier">
        <span><i className={styles.legendIntervention} />Intervention Dolibarr</span>
        <span><i className={styles.legendSav} />SAV à planifier</span>
        <span><i className={styles.legendUrgent} />SAV urgent</span>
      </div>
      <FullCalendar
        plugins={[timeGridPlugin, classicThemePlugin]}
        initialView="timeGridWeek"
        initialDate="2026-08-05"
        locale={frLocale}
        firstDay={1}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "",
        }}
        allDayText="À planifier"
        slotMinTime="07:00:00"
        slotMaxTime="19:00:00"
        slotDuration="01:00:00"
        nowIndicator={false}
        weekends
        editable={false}
        eventStartEditable={false}
        eventDurationEditable={false}
        selectable={false}
        height="auto"
        events={events}
        eventClick={(info) => {
          const item = itemById.get(info.event.extendedProps.itemId as string);
          if (item) onSelectItem(item);
        }}
      />
    </div>
  );
}

function endTime(startTime: string, duration = "1 h") {
  const [hours, minutes] = startTime.split(":").map(Number);
  const durationMatch = duration.match(/(\d+)\s*h(?:\s*(\d+))?/);
  const durationMinutes = durationMatch
    ? Number(durationMatch[1]) * 60 + Number(durationMatch[2] || 0)
    : 60;
  const total = hours * 60 + minutes + durationMinutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;
}

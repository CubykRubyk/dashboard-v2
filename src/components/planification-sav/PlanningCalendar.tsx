"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import frLocale from "@fullcalendar/react/locales/fr";
import { MapPin, UsersRound } from "lucide-react";
import type { PlanningItem } from "./mock-data";
import styles from "./planification-sav.module.css";

function addDaysIso(dateIso: string, days: number) {
  const date = new Date(`${dateIso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

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
    const interventionColor = !isSav ? item.color : undefined;
    return {
      id: item.id,
      title: isSav ? item.company : item.title,
      start: isSav ? item.date : `${item.date}T${item.time || "00:00"}:00`,
      end: !isSav && item.endDate ? `${addDaysIso(item.endDate, 1)}T00:00:00` : undefined,
      allDay: isSav,
      color: interventionColor
        ? interventionColor
        : isSav
          ? item.status === "Clôturé"
            ? "#22b07e"
            : item.priority === "Urgente"
              ? "#ff401c"
              : "#ff8110"
          : "#316aff",
      contrastColor: isSav ? "#ffffff" : "#1a1d29",
      className: isSav
        ? item.status === "Clôturé"
          ? styles.calendarClosedEvent
          : item.priority === "Urgente"
            ? styles.calendarUrgentEvent
            : styles.calendarSavEvent
        : styles.calendarInterventionEvent,
      extendedProps: { itemId: item.id, company: item.company, team: item.team, address: item.address },
    };
  });

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className={styles.calendarShell}>
      <FullCalendar
        plugins={[dayGridPlugin, classicThemePlugin]}
        initialView="dayGridWeek"
        initialDate={todayIso}
        locale={frLocale}
        firstDay={1}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridWeek,dayGridMonth",
        }}
        eventDisplay="block"
        dayMaxEvents={false}
        nowIndicator={false}
        weekends
        editable={false}
        eventStartEditable={false}
        eventDurationEditable={false}
        selectable={false}
        height="auto"
        events={events}
        eventContent={(arg) => {
          const props = arg.event.extendedProps as { company?: string; team?: string; address?: string };
          const isSav = arg.event.allDay;
          const textColor = isSav ? "#ffffff" : "#1a1d29";
          return (
            <div className={styles.calendarEventCard} style={{ color: textColor }}>
              {arg.timeText && <span className={styles.calendarEventTime}>{arg.timeText}</span>}
              <strong>{arg.event.title}</strong>
              {!isSav && props.company && (
                <small><UsersRound aria-hidden size={10} />{props.company}</small>
              )}
              {!isSav && props.address && (
                <small><MapPin aria-hidden size={10} />{props.address}</small>
              )}
              {!isSav && props.team && (
                <small><UsersRound aria-hidden size={10} />{props.team}</small>
              )}
            </div>
          );
        }}
        eventDidMount={(info) => {
          const isSav = info.event.allDay;
          const textColor = isSav ? "#ffffff" : "#1a1d29";
          info.el.style.setProperty("color", textColor, "important");
          info.el.querySelectorAll<HTMLElement>("*").forEach((node) => {
            node.style.setProperty("color", textColor, "important");
          });
        }}
        eventClick={(info) => {
          const item = itemById.get(info.event.extendedProps.itemId as string);
          if (item) onSelectItem(item);
        }}
      />
    </div>
  );
}

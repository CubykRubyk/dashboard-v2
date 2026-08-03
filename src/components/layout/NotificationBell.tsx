"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, Sparkles, Wrench } from "lucide-react";

type NotificationData = {
  unassignedSav: { id: string; reference: string; title: string; company: string }[];
  suggestionsActive: number;
  dolibarrLastSyncError: string | null;
};

const EMPTY: NotificationData = { unassignedSav: [], suggestionsActive: 0, dolibarrLastSyncError: null };

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications")
      .then((response) => (response.ok ? response.json() : EMPTY))
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const hasNotifications =
    data.unassignedSav.length > 0 || data.suggestionsActive > 0 || Boolean(data.dolibarrLastSyncError);

  return (
    <div className="notification-menu" ref={rootRef}>
      <button
        type="button"
        className="icon-button"
        aria-label="Notifications"
        data-tooltip="Notifications"
        data-tooltip-placement="bottom"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell aria-hidden size={19} />
        {loaded && hasNotifications && <span className="notification-dot" />}
      </button>
      {open && (
        <div className="notification-popover">
          <div className="notification-popover-header">
            <strong>Notifications</strong>
          </div>
          {!loaded && <p className="notification-empty">Chargement…</p>}
          {loaded && !hasNotifications && <p className="notification-empty">Rien à signaler.</p>}
          {loaded && data.dolibarrLastSyncError && (
            <div className="notification-item notification-item-danger">
              <AlertTriangle aria-hidden size={15} />
              <div>
                <strong>Synchronisation Dolibarr échouée</strong>
                <p>{data.dolibarrLastSyncError}</p>
              </div>
            </div>
          )}
          {loaded && data.suggestionsActive > 0 && (
            <Link href="/planification-sav" className="notification-item">
              <Sparkles aria-hidden size={15} />
              <div>
                <strong>
                  {data.suggestionsActive} suggestion{data.suggestionsActive > 1 ? "s" : ""} de proximité
                </strong>
                <p>Rapprochements SAV/intervention à consulter.</p>
              </div>
            </Link>
          )}
          {loaded &&
            data.unassignedSav.map((ticket) => (
              <Link href={`/planification-sav/${ticket.id}`} key={ticket.id} className="notification-item">
                <Wrench aria-hidden size={15} />
                <div>
                  <strong>{ticket.title}</strong>
                  <p>{ticket.reference} · {ticket.company} · non affecté</p>
                </div>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}

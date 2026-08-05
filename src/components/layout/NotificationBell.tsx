"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, BellRing, Sparkles, Wrench } from "lucide-react";

/** Événement daté et persisté, propre à l'utilisateur (SAV créé, fiche envoyée…). */
type FeedItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationData = {
  feed: FeedItem[];
  unreadCount: number;
  unassignedSav: { id: string; reference: string; title: string; company: string }[];
  suggestionsActive: number;
  dolibarrLastSyncError: string | null;
};

const EMPTY: NotificationData = {
  feed: [],
  unreadCount: 0,
  unassignedSav: [],
  suggestionsActive: 0,
  dolibarrLastSyncError: null,
};

const relativeFormatter = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

function relativeTime(iso: string) {
  const diffMs = new Date(iso).getTime() - Date.now();
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 60) return relativeFormatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeFormatter.format(hours, "hour");
  return relativeFormatter.format(Math.round(hours / 24), "day");
}

/** Lien de rebond vers l'entité concernée, quand elle est connue. */
function feedHref(item: FeedItem) {
  if (item.entityType === "SavTicket" && item.entityId) return `/planification-sav/${item.entityId}`;
  if (item.entityType === "WorkSheet" && item.entityId) return `/fiches/${item.entityId}`;
  return null;
}

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
    data.feed.length > 0
    || data.unassignedSav.length > 0
    || data.suggestionsActive > 0
    || Boolean(data.dolibarrLastSyncError);

  // Le point rouge signale d'abord du non-lu réel ; à défaut, un état courant à traiter.
  const showDot = data.unreadCount > 0 || hasNotifications;

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      // Ouvrir le panneau vaut lecture : on efface le non-lu côté serveur, et localement pour
      // que le compteur disparaisse sans attendre un rechargement.
      if (next && data.unreadCount > 0) {
        void fetch("/api/notifications", { method: "POST" }).catch(() => undefined);
        setData((current) => ({
          ...current,
          unreadCount: 0,
          feed: current.feed.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
        }));
      }
      return next;
    });
  };

  return (
    <div className="notification-menu" ref={rootRef}>
      <button
        type="button"
        className="icon-button"
        aria-label="Notifications"
        data-tooltip="Notifications"
        data-tooltip-placement="bottom"
        aria-expanded={open}
        onClick={toggle}
      >
        <Bell aria-hidden size={19} />
        {loaded && showDot && <span className="notification-dot" />}
      </button>
      {open && (
        <div className="notification-popover">
          <div className="notification-popover-header">
            <strong>Notifications</strong>
            {data.unreadCount > 0 && <span className="notification-count">{data.unreadCount}</span>}
          </div>
          {!loaded && <p className="notification-empty">Chargement…</p>}
          {loaded && !hasNotifications && <p className="notification-empty">Rien à signaler.</p>}
          {loaded
            && data.feed.map((item) => {
              const href = feedHref(item);
              const content = (
                <>
                  <BellRing aria-hidden size={15} />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.body ? `${item.body} · ` : ""}{relativeTime(item.createdAt)}</p>
                  </div>
                </>
              );
              const className = `notification-item${item.readAt ? "" : " notification-item-unread"}`;
              return href ? (
                <Link href={href} key={item.id} className={className}>{content}</Link>
              ) : (
                <div key={item.id} className={className}>{content}</div>
              );
            })}
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

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  CircleDot,
  History,
  MessageSquarePlus,
  Route,
} from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { canViewSav } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { serializeSavTicket } from "@/lib/sav/mappers";
import styles from "./sav-detail.module.css";

export const dynamic = "force-dynamic";

const TICKET_INCLUDE = {
  team: true,
  history: { include: { author: true }, orderBy: { createdAt: "desc" as const } },
};

const fullDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const priorityClass: Record<string, string> = {
  Basse: styles.priorityBasse,
  Normale: styles.priorityNormale,
  Haute: styles.priorityHaute,
  Urgente: styles.priorityUrgente,
};

const historyIconFor: Record<string, typeof MessageSquarePlus> = {
  note: MessageSquarePlus,
  closure: CheckCircle2,
  planning: CalendarClock,
  priority: CircleAlert,
  status: CircleDot,
};

export default async function SavTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSession();
  if (!user || !canViewSav(user.role)) notFound();

  const ticket = await prisma.savTicket.findUnique({ where: { id }, include: TICKET_INCLUDE });
  if (!ticket) notFound();

  const item = serializeSavTicket(ticket);
  const isClosed = item.status === "Clôturé" || Boolean(item.closedAt);

  return (
    <>
      <div className="page-heading">
        <div className={styles.headerRow} style={{ width: "100%" }}>
          <div>
            <p className="eyebrow">{item.reference} · Dashboard SAV</p>
            <h1>{item.title}</h1>
            <p>{item.company}</p>
            <div className={styles.badges}>
              <span className={`${styles.badge} ${priorityClass[item.priority]}`}>{item.priority}</span>
              <span className={`${styles.badge} ${isClosed ? styles.statusCloture : styles.statusOuvert}`}>
                {item.status}
              </span>
            </div>
          </div>
          <Link href={`/planification-sav?open=${item.id}`} className="button button-primary">
            <Route aria-hidden size={16} />
            Ouvrir dans Planification &amp; SAV
          </Link>
        </div>
      </div>

      <div className={styles.sections}>
        <div>
          <article className="card">
            <div className={styles.section}>
              <h3>Client &amp; lieu</h3>
              <div className={styles.rows}>
                <div className={styles.row}><span>Société</span><span>{item.company}</span></div>
                <div className={styles.row}><span>Contact</span><span>{item.contact}</span></div>
                <div className={styles.row}><span>Téléphone</span><span>{item.phone || "—"}</span></div>
                <div className={styles.row}><span>Adresse</span><span>{item.address || "—"}</span></div>
              </div>
            </div>
            <div className={styles.section}>
              <h3>Intervention</h3>
              <div className={styles.rows}>
                <div className={styles.row}>
                  <span>Date souhaitée</span>
                  <span>{item.date ? fullDateFormatter.format(new Date(`${item.date}T12:00:00`)) : "—"}</span>
                </div>
                <div className={styles.row}><span>Équipe</span><span>{item.team || "Non affectée"}</span></div>
                <div className={styles.row}><span>Équipement</span><span>{item.equipment || "—"}</span></div>
              </div>
            </div>
            {item.description && (
              <div className={styles.section}>
                <h3>Description</h3>
                <p className={styles.description}>{item.description}</p>
              </div>
            )}
            {item.planningDraft && (
              <div className={styles.section}>
                <h3>Préparation de planification</h3>
                <div className={styles.rows}>
                  <div className={styles.row}>
                    <span>Créneau</span>
                    <span>
                      {item.planningDraft.date} · {item.planningDraft.startTime}–{item.planningDraft.endTime}
                    </span>
                  </div>
                  <div className={styles.row}><span>Équipe</span><span>{item.planningDraft.team}</span></div>
                  {item.planningDraft.note && (
                    <div className={styles.row}><span>Note</span><span>{item.planningDraft.note}</span></div>
                  )}
                </div>
              </div>
            )}
            {isClosed && (
              <div className={styles.section}>
                <h3>Clôture</h3>
                <div className={styles.rows}>
                  <div className={styles.row}><span>Motif</span><span>{item.closureReason || "—"}</span></div>
                  {item.closedAt && (
                    <div className={styles.row}>
                      <span>Date</span>
                      <span>{fullDateFormatter.format(new Date(item.closedAt))}</span>
                    </div>
                  )}
                  {item.closureNote && (
                    <div className={styles.row}><span>Note</span><span>{item.closureNote}</span></div>
                  )}
                </div>
              </div>
            )}
          </article>
        </div>

        <div>
          <article className="card">
            <div className="card-header">
              <div><p className="eyebrow">Journal</p><h2>Historique</h2></div>
              <span className="badge badge-success">{item.history?.length ?? 0}</span>
            </div>
            {!item.history?.length ? (
              <p className={styles.historyEmpty}>Aucune action enregistrée.</p>
            ) : (
              <div className={styles.historyList}>
                {[...item.history].reverse().map((entry) => {
                  const Icon = historyIconFor[entry.type] ?? History;
                  return (
                    <div className={styles.historyEntry} key={entry.id}>
                      <span className={styles.historyIcon}><Icon aria-hidden size={13} /></span>
                      <div>
                        <strong>{entry.text}</strong>
                        {entry.detail && <p>{entry.detail}</p>}
                        <small>{dateTimeFormatter.format(new Date(entry.date))} · {entry.author}</small>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </div>
      </div>
    </>
  );
}

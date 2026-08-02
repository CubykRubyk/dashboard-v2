import Link from "next/link";
import { History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { CatalogPagination } from "@/components/pac/technical/CatalogPagination";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 50;

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatAction(action: string) {
  return action
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (char) => char.toUpperCase());
}

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export async function AuditLogSection({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const userId = valueOf(searchParams.userId);
  const action = valueOf(searchParams.action);
  const entityType = valueOf(searchParams.entityType);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(valueOf(searchParams.from)) ? valueOf(searchParams.from) : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(valueOf(searchParams.to)) ? valueOf(searchParams.to) : "";
  const page = Math.max(1, Number.parseInt(valueOf(searchParams.page), 10) || 1);

  const where: Prisma.AuditLogWhereInput = {
    ...(userId ? { userId } : {}),
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  };

  const [entries, total, users, actions, entityTypes] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    prisma.auditLog.findMany({
      distinct: ["entityType"],
      where: { entityType: { not: null } },
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseParams = new URLSearchParams();
  if (userId) baseParams.set("userId", userId);
  if (action) baseParams.set("action", action);
  if (entityType) baseParams.set("entityType", entityType);
  if (from) baseParams.set("from", from);
  if (to) baseParams.set("to", to);
  const hrefForPage = (targetPage: number) => {
    const next = new URLSearchParams(baseParams);
    next.set("tab", "journal");
    next.set("page", String(targetPage));
    return `/settings?${next.toString()}`;
  };
  const hasFilters = Boolean(userId || action || entityType || from || to);

  return (
    <section className="card settings-section">
      <div className="settings-heading">
        <div className="settings-title">
          <span className="settings-icon"><History size={20} /></span>
          <div>
            <h2>Journal d’activité</h2>
            <p>Historique des actions effectuées dans l’application.</p>
          </div>
        </div>
      </div>

      <form className="card reports-filters" method="get">
        <input type="hidden" name="tab" value="journal" />
        <label>
          Utilisateur
          <select name="userId" defaultValue={userId}>
            <option value="">Tous</option>
            {users.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
        </label>
        <label>
          Action
          <select name="action" defaultValue={action}>
            <option value="">Toutes</option>
            {actions.map((entry) => (
              <option key={entry.action} value={entry.action}>{formatAction(entry.action)}</option>
            ))}
          </select>
        </label>
        <label>
          Entité
          <select name="entityType" defaultValue={entityType}>
            <option value="">Toutes</option>
            {entityTypes.map((entry) => (
              entry.entityType ? <option key={entry.entityType} value={entry.entityType}>{entry.entityType}</option> : null
            ))}
          </select>
        </label>
        <label>Du<input type="date" name="from" defaultValue={from} /></label>
        <label>Au<input type="date" name="to" defaultValue={to} /></label>
        <button className="button button-primary">Filtrer</button>
        {hasFilters && <Link className="button button-ghost" href="/settings?tab=journal">Réinitialiser</Link>}
      </form>

      {entries.length === 0 ? (
        <div className="settings-empty">Aucune entrée ne correspond aux critères.</div>
      ) : (
        <div className="catalog-table-wrap">
          <table className="catalog-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Utilisateur</th>
                <th>Action</th>
                <th>Entité</th>
                <th>Adresse IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{dateTimeFormatter.format(entry.createdAt)}</td>
                  <td>{entry.user?.name || "Utilisateur supprimé"}</td>
                  <td>{formatAction(entry.action)}</td>
                  <td>
                    {entry.entityType || "—"}
                    {entry.entityId && <small>{entry.entityId}</small>}
                  </td>
                  <td>{entry.ipAddress || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CatalogPagination
        currentPage={page}
        totalPages={totalPages}
        hrefForPage={hrefForPage}
        ariaLabel="Pagination du journal d’activité"
      />
    </section>
  );
}

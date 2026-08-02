"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  Filter,
  List,
  LocateFixed,
  LockKeyhole,
  Map,
  MapPin,
  Navigation,
  Phone,
  RefreshCcw,
  Search,
  Sparkles,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import {
  allPlanningItems,
  interventions,
  proximitySuggestions,
  savItems,
  type PlanningItem,
  type ProximitySuggestion,
} from "./mock-data";
import { PlanningCalendar } from "./PlanningCalendar";
import styles from "./planification-sav.module.css";

const PlanningMap = dynamic(
  () => import("./PlanningMap").then((module) => module.PlanningMap),
  {
    ssr: false,
    loading: () => (
      <div className={styles.mapLoading}>
        <MapPin aria-hidden size={22} />
        Chargement de la carte…
      </div>
    ),
  },
);

type ViewMode = "map" | "calendar" | "list";

interface Filters {
  period: string;
  team: string;
  company: string;
  priority: string;
  status: string;
}

const initialFilters: Filters = {
  period: "week",
  team: "all",
  company: "all",
  priority: "all",
  status: "all",
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const fullDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function PlanificationSavDashboard() {
  const [view, setView] = useState<ViewMode>("map");
  const [filters, setFilters] = useState(initialFilters);
  const [selectedItem, setSelectedItem] = useState<PlanningItem | null>(null);
  const [activeSuggestion, setActiveSuggestion] =
    useState<ProximitySuggestion | null>(null);
  const [notificationVisible, setNotificationVisible] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!selectedItem) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedItem(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedItem]);

  const filterOptions = useMemo(
    () => ({
      teams: Array.from(new Set(allPlanningItems.map((item) => item.team))).sort(),
      companies: Array.from(
        new Set(allPlanningItems.map((item) => item.company)),
      ).sort(),
      priorities: Array.from(
        new Set(allPlanningItems.map((item) => item.priority)),
      ),
      statuses: Array.from(
        new Set(allPlanningItems.map((item) => item.status)),
      ).sort(),
    }),
    [],
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("fr");
    return allPlanningItems.filter((item) => {
      const dateMatches =
        filters.period === "week" ||
        (filters.period === "today" && item.date === "2026-08-05") ||
        (filters.period === "tomorrow" && item.date === "2026-08-06");
      const searchMatches =
        !normalizedSearch ||
        [
          item.reference,
          item.company,
          item.contact,
          item.address,
          item.title,
        ].some((value) =>
          value.toLocaleLowerCase("fr").includes(normalizedSearch),
        );
      return (
        dateMatches &&
        (filters.team === "all" || item.team === filters.team) &&
        (filters.company === "all" || item.company === filters.company) &&
        (filters.priority === "all" || item.priority === filters.priority) &&
        (filters.status === "all" || item.status === filters.status) &&
        searchMatches
      );
    });
  }, [filters, search]);

  const filteredSav = filteredItems.filter((item) => item.kind === "sav");
  const filteredInterventions = filteredItems.filter(
    (item) => item.kind === "intervention",
  );
  const visibleSuggestions = proximitySuggestions.filter(
    (suggestion) =>
      filteredItems.some((item) => item.id === suggestion.interventionId) &&
      filteredItems.some((item) => item.id === suggestion.savId),
  );

  const updateFilter = (name: keyof Filters, value: string) =>
    setFilters((current) => ({ ...current, [name]: value }));

  const chooseSuggestion = (suggestion: ProximitySuggestion) => {
    setView("map");
    setActiveSuggestion(suggestion);
    setSelectedItem(null);
  };

  return (
    <div className={styles.page}>
      <div className={`page-heading ${styles.heading}`}>
        <div>
          <p className="eyebrow">Opérations terrain</p>
          <h1>Planification &amp; SAV</h1>
          <p>Anticipez les déplacements et rapprochez les urgences des équipes.</p>
        </div>
        <div className={styles.prototypeBadge}>
          <span />
          Prototype · données fictives
        </div>
      </div>

      <section className={styles.statsGrid} aria-label="Indicateurs de planification">
        <StatCard
          icon={Wrench}
          tone="orange"
          value={savItems.length}
          label="SAV non planifiés"
          note={`${filteredSav.length} visibles avec les filtres`}
        />
        <StatCard
          icon={CalendarDays}
          tone="blue"
          value={interventions.length}
          label="Interventions Dolibarr"
          note={`${filteredInterventions.length} externes · lecture seule`}
        />
        <StatCard
          icon={Sparkles}
          tone="green"
          value={proximitySuggestions.length}
          label="Suggestions de proximité"
          note={`${visibleSuggestions.length} opportunités visibles`}
        />
      </section>

      <section className={styles.filterCard} aria-label="Filtres">
        <div className={styles.filterHeading}>
          <span><Filter aria-hidden size={17} /></span>
          <div>
            <strong>Filtres opérationnels</strong>
            <small>La carte, le calendrier et la liste sont synchronisés.</small>
          </div>
        </div>
        <div className={styles.searchField}>
          <Search aria-hidden size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Référence, société, adresse…"
            aria-label="Rechercher"
          />
        </div>
        <FilterSelect
          label="Période"
          value={filters.period}
          onChange={(value) => updateFilter("period", value)}
          options={[
            { value: "week", label: "Cette semaine" },
            { value: "today", label: "Aujourd’hui · 5 août" },
            { value: "tomorrow", label: "Demain · 6 août" },
          ]}
        />
        <FilterSelect
          label="Équipe"
          value={filters.team}
          onChange={(value) => updateFilter("team", value)}
          options={filterOptions.teams.map((value) => ({ value, label: value }))}
        />
        <FilterSelect
          label="Société"
          value={filters.company}
          onChange={(value) => updateFilter("company", value)}
          options={filterOptions.companies.map((value) => ({ value, label: value }))}
        />
        <FilterSelect
          label="Priorité"
          value={filters.priority}
          onChange={(value) => updateFilter("priority", value)}
          options={filterOptions.priorities.map((value) => ({ value, label: value }))}
        />
        <FilterSelect
          label="Statut"
          value={filters.status}
          onChange={(value) => updateFilter("status", value)}
          options={filterOptions.statuses.map((value) => ({ value, label: value }))}
        />
        <button
          type="button"
          className={styles.resetButton}
          onClick={() => {
            setFilters(initialFilters);
            setSearch("");
            setActiveSuggestion(null);
          }}
          aria-label="Réinitialiser les filtres"
          title="Réinitialiser les filtres"
        >
          <RefreshCcw aria-hidden size={16} />
        </button>
      </section>

      <div className={styles.viewBar}>
        <div className={styles.viewTabs} role="tablist" aria-label="Vues">
          <ViewTab
            active={view === "map"}
            icon={Map}
            label="Carte"
            onClick={() => setView("map")}
          />
          <ViewTab
            active={view === "calendar"}
            icon={CalendarDays}
            label="Calendrier"
            onClick={() => setView("calendar")}
          />
          <ViewTab
            active={view === "list"}
            icon={List}
            label="Liste"
            onClick={() => setView("list")}
          />
        </div>
        <p>
          <strong>{filteredItems.length}</strong> éléments affichés
          <span>·</span> Semaine du 3 au 9 août 2026
        </p>
      </div>

      {view === "map" && (
        <section className={styles.mapLayout} aria-label="Vue carte">
          <article className={styles.mapCard}>
            <div className={styles.mapHeader}>
              <div>
                <p className="eyebrow">Zone de Lyon</p>
                <h2>Couverture terrain</h2>
              </div>
              <div className={styles.mapLegend}>
                <span><i className={styles.legendSav} />SAV</span>
                <span><i className={styles.legendUrgent} />Urgence</span>
                <span><i className={styles.legendIntervention} />Intervention</span>
              </div>
            </div>
            <div className={styles.mapFrame}>
              <PlanningMap
                items={filteredItems}
                activeSuggestion={activeSuggestion}
                onSelectItem={setSelectedItem}
              />
              <div className={styles.mapCount}>
                <LocateFixed aria-hidden size={15} />
                {filteredItems.length} points
              </div>
            </div>
          </article>

          <aside className={styles.suggestionsCard}>
            <div className={styles.suggestionHeading}>
              <span><Sparkles aria-hidden size={18} /></span>
              <div>
                <h2>Suggestions de proximité</h2>
                <p>Rapprochements estimés sur données fictives</p>
              </div>
            </div>
            <div className={styles.suggestionList}>
              {visibleSuggestions.map((suggestion) => {
                const intervention = interventions.find(
                  (item) => item.id === suggestion.interventionId,
                )!;
                const sav = savItems.find((item) => item.id === suggestion.savId)!;
                const active = activeSuggestion?.id === suggestion.id;
                return (
                  <button
                    key={suggestion.id}
                    type="button"
                    className={`${styles.suggestion}${active ? ` ${styles.suggestionActive}` : ""}`}
                    onClick={() => chooseSuggestion(suggestion)}
                  >
                    <span className={styles.suggestionRoute}>
                      <i className={styles.routeStart} />
                      <b />
                      <i className={styles.routeEnd} />
                    </span>
                    <span className={styles.suggestionContent}>
                      <span className={styles.suggestionMeta}>
                        <strong>{suggestion.travelMinutes} min</strong>
                        <small>{suggestion.distanceKm.toFixed(1)} km estimés</small>
                      </span>
                      <b>{intervention.team} → {sav.contact.split(" ").at(-1)}</b>
                      <small>{intervention.reference} · {sav.reference}</small>
                    </span>
                    <ChevronRight aria-hidden size={16} />
                  </button>
                );
              })}
              {visibleSuggestions.length === 0 && (
                <div className={styles.emptyState}>
                  <Navigation aria-hidden size={22} />
                  <strong>Aucune suggestion visible</strong>
                  <p>Élargissez les filtres pour retrouver les rapprochements.</p>
                </div>
              )}
            </div>
            <div className={styles.demoNotice}>
              <CircleAlert aria-hidden size={16} />
              <p>
                Temps et distances simulés. La ligne sur la carte ne représente
                pas un itinéraire réel.
              </p>
            </div>
          </aside>
        </section>
      )}

      {view === "calendar" && (
        <section className={styles.viewCard} aria-label="Vue calendrier">
          <div className={styles.cardTitleRow}>
            <div>
              <p className="eyebrow">Planning hebdomadaire</p>
              <h2>Semaine du 3 au 9 août 2026</h2>
            </div>
            <span className={styles.readOnlyPill}>
              <LockKeyhole aria-hidden size={13} />
              Dolibarr en lecture seule
            </span>
          </div>
          <PlanningCalendar items={filteredItems} onSelectItem={setSelectedItem} />
        </section>
      )}

      {view === "list" && (
        <section className={`${styles.viewCard} ${styles.tableCard}`} aria-label="Vue liste">
          <div className={styles.cardTitleRow}>
            <div>
              <p className="eyebrow">File SAV</p>
              <h2>SAV à qualifier et planifier</h2>
            </div>
            <span className={styles.resultPill}>{filteredSav.length} sur {savItems.length}</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Société / contact</th>
                  <th>Demande</th>
                  <th>Date souhaitée</th>
                  <th>Priorité</th>
                  <th>Statut</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filteredSav.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.reference}</strong><small>Dashboard SAV</small></td>
                    <td><strong>{item.company}</strong><small>{item.contact}</small></td>
                    <td><strong>{item.title}</strong><small>{item.equipment}</small></td>
                    <td>{dateFormatter.format(new Date(`${item.date}T12:00:00`))}</td>
                    <td><PriorityBadge priority={item.priority} /></td>
                    <td><StatusBadge status={item.status} /></td>
                    <td>
                      <button
                        type="button"
                        className={styles.rowButton}
                        onClick={() => setSelectedItem(item)}
                        aria-label={`Voir ${item.reference}`}
                      >
                        <ChevronRight aria-hidden size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredSav.length === 0 && (
              <div className={styles.emptyState}>
                <Search aria-hidden size={24} />
                <strong>Aucun SAV ne correspond aux filtres</strong>
                <p>Réinitialisez les critères pour afficher la file complète.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {notificationVisible && (
        <div className={styles.toast} role="status" aria-live="polite">
          <span className={styles.toastIcon}><BellRing aria-hidden size={18} /></span>
          <div>
            <strong>Proximité détectée</strong>
            <p>Intervention de l’équipe Dima à 12 minutes du SAV Dupont.</p>
            <button
              type="button"
              onClick={() => chooseSuggestion(proximitySuggestions[0])}
            >
              Afficher sur la carte
            </button>
          </div>
          <button
            type="button"
            className={styles.toastClose}
            onClick={() => setNotificationVisible(false)}
            aria-label="Fermer la notification"
          >
            <X aria-hidden size={16} />
          </button>
        </div>
      )}

      {selectedItem && (
        <DetailDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  tone,
  value,
  label,
  note,
}: {
  icon: typeof Wrench;
  tone: "orange" | "blue" | "green";
  value: number;
  label: string;
  note: string;
}) {
  return (
    <article className={styles.statCard}>
      <span className={`${styles.statIcon} ${styles[tone]}`}>
        <Icon aria-hidden size={21} />
      </span>
      <div>
        <span className={styles.statValue}>{value}</span>
        <strong>{label}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.filterSelect}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {label !== "Période" && <option value="all">Tous</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function ViewTab({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Map;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={active ? styles.viewTabActive : ""}
      onClick={onClick}
    >
      <Icon aria-hidden size={16} />
      {label}
    </button>
  );
}

function DetailDrawer({
  item,
  onClose,
}: {
  item: PlanningItem;
  onClose: () => void;
}) {
  const isExternal = item.source === "dolibarr";
  return (
    <div className={styles.drawerLayer} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="planning-detail-title">
        <div className={styles.drawerHeader}>
          <div>
            <span className={`${styles.kindBadge} ${isExternal ? styles.kindIntervention : styles.kindSav}`}>
              {isExternal ? <CalendarDays aria-hidden size={13} /> : <Wrench aria-hidden size={13} />}
              {isExternal ? "Intervention" : "SAV"}
            </span>
            <h2 id="planning-detail-title">{item.title}</h2>
            <p>{item.reference}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer">
            <X aria-hidden size={18} />
          </button>
        </div>
        {isExternal && (
          <div className={styles.externalBanner}>
            <LockKeyhole aria-hidden size={17} />
            <div>
              <strong>Donnée externe Dolibarr</strong>
              <p>Consultation uniquement — aucune modification depuis ce prototype.</p>
            </div>
          </div>
        )}
        <div className={styles.drawerBody}>
          <div className={styles.drawerBadges}>
            <PriorityBadge priority={item.priority} />
            <StatusBadge status={item.status} />
          </div>
          <section className={styles.detailSection}>
            <h3>Client &amp; lieu</h3>
            <DetailRow icon={UsersRound} label="Société" value={item.company} />
            <DetailRow icon={UsersRound} label="Contact" value={item.contact} />
            <DetailRow icon={Phone} label="Téléphone" value={item.phone} />
            <DetailRow icon={MapPin} label="Adresse" value={item.address} />
          </section>
          <section className={styles.detailSection}>
            <h3>Intervention</h3>
            <DetailRow
              icon={CalendarDays}
              label={item.kind === "sav" ? "Date souhaitée" : "Date planifiée"}
              value={fullDateFormatter.format(new Date(`${item.date}T12:00:00`))}
            />
            {item.time && (
              <DetailRow icon={Clock3} label="Créneau" value={`${item.time} · ${item.duration}`} />
            )}
            <DetailRow icon={UsersRound} label="Équipe" value={item.team} />
            <DetailRow icon={Wrench} label="Équipement" value={item.equipment} />
          </section>
          <section className={styles.detailSection}>
            <h3>Description</h3>
            <p className={styles.description}>{item.description}</p>
          </section>
        </div>
        <div className={styles.drawerFooter}>
          {isExternal ? (
            <button type="button" className="button button-primary">
              <ExternalLink aria-hidden size={15} />
              Ouvrir dans Dolibarr
            </button>
          ) : (
            <>
              <button type="button" className="button button-ghost">Ajouter une note</button>
              <button type="button" className="button button-primary">
                <Check aria-hidden size={15} />
                Préparer la planification
              </button>
            </>
          )}
          <small>Action démonstrative — aucune donnée ne sera enregistrée.</small>
        </div>
      </aside>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UsersRound;
  label: string;
  value: string;
}) {
  return (
    <div className={styles.detailRow}>
      <span><Icon aria-hidden size={16} /></span>
      <div><small>{label}</small><strong>{value}</strong></div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: PlanningItem["priority"] }) {
  return (
    <span className={`${styles.priorityBadge} ${styles[`priority${priority}`]}`}>
      {priority === "Urgente" && <CircleAlert aria-hidden size={12} />}
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Confirmée"
      ? styles.statusSuccess
      : status === "Nouveau"
        ? styles.statusInfo
        : status === "À confirmer" || status === "En attente client"
          ? styles.statusWarning
          : styles.statusNeutral;
  return <span className={`${styles.statusBadge} ${tone}`}>{status}</span>;
}


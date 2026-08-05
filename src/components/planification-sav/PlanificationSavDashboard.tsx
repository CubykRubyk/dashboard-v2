"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleDot,
  Clock3,
  ExternalLink,
  Filter,
  History,
  Kanban,
  List,
  LocateFixed,
  LockKeyhole,
  Map,
  MapPin,
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  Navigation,
  Phone,
  RefreshCcw,
  Route,
  Search,
  Sparkles,
  Trash2,
  UsersRound,
  Wand2,
  Wrench,
  X,
} from "lucide-react";
import {
  buildHeadquartersPlanningItem,
  isOngoingOn,
  type SavHistoryEntry,
  type SavPlanningDraft,
  type PlanningItem,
  type ProximitySuggestion,
} from "./mock-data";
import {
  computeItinerary,
  createSavTicket,
  deleteSavTicket,
  dismissProximitySuggestion,
  patchSavTicket,
  type ItineraryResult,
} from "./api";
import { NoteRichText, type NoteToken } from "@/components/ui/NoteRichText";
import { getTodayIsoDateParis, groupItemsByDepartment } from "@/lib/geo/departments";
import { PlanningCalendar } from "./PlanningCalendar";
import { DepartmentCartogram } from "./DepartmentCartogram";
import { useToast } from "@/components/layout/ToastProvider";
import { RowActionMenu } from "@/components/ui/RowActionMenu";
import { InterventionEditor } from "./InterventionEditor";
import { InterventionMaterials } from "./InterventionMaterials";
import { SavAttachments } from "./SavAttachments";
import styles from "./planification-sav.module.css";

export interface SavTeam {
  id: string;
  name: string;
}

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

const DepartmentShapeMap = dynamic(
  () => import("./DepartmentShapeMap").then((module) => module.DepartmentShapeMap),
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

type MapMode = "pins" | "cartogram" | "shape";
type ViewMode = "map" | "calendar" | "list" | "kanban";
type KanbanColumnKey = "nonplanned" | "planned" | "closed";
type WorkflowAction = "note" | "close" | "planning" | null;
type ListStatusFilter = "open" | "closed" | "all";
const priorityOptions: PlanningItem["priority"][] = ["Basse", "Normale", "Haute", "Urgente"];

// Masquée temporairement (demande utilisateur, "ma deruteaza") — la légende de la carte et le badge
// "✦ suggestion active" sur les pins. Repasser à true pour les réafficher.
const SHOW_MAP_LEGEND = false;

interface NewSavDraft {
  title: string;
  company: string;
  contact: string;
  phone: string;
  address: string;
  priority: PlanningItem["priority"];
  equipment: string;
  description: string;
}

interface Filters {
  period: string;
  team: string;
  company: string;
  priority: string;
  status: string;
  radius: string;
  kind: string;
}

const initialFilters: Filters = {
  period: "week",
  team: "all",
  company: "all",
  priority: "all",
  status: "all",
  radius: "20",
  kind: "all",
};

const radiusOptions = [
  { value: "10", label: "10 km" },
  { value: "20", label: "20 km" },
  { value: "50", label: "50 km" },
  { value: "100", label: "100 km" },
];

const kindOptions = [
  { value: "sav", label: "SAV" },
  { value: "intervention", label: "Interventions" },
];

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

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const closedDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const weekRangeDayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric" });
const weekRangeMonthYearFormatter = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

function currentWeekLabel() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `Semaine du ${weekRangeDayFormatter.format(monday)} au ${weekRangeDayFormatter.format(sunday)} ${weekRangeMonthYearFormatter.format(sunday)}`;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function currentWeekRange() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: isoDate(monday), end: isoDate(sunday) };
}

function todayIsoDate() {
  return isoDate(new Date());
}

// Le dimanche est un jour off chez le client — les interventions Dolibarr posées ce jour-là servent
// d'aide-mémoire et doivent rester visibles au calendrier/liste, mais ne doivent pas polluer la carte
// avec un pin un jour où personne ne se déplace.
function isSundayIntervention(item: PlanningItem) {
  if (item.kind !== "intervention" || item.source !== "dolibarr" || !item.date) return false;
  return new Date(`${item.date}T12:00:00`).getDay() === 0;
}

const periodDayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

function isClosed(item: PlanningItem) {
  return item.status === "Clôturé" || Boolean(item.closedAt);
}

function makeHistory(
  type: SavHistoryEntry["type"],
  text: string,
  detail?: string,
): SavHistoryEntry {
  return {
    id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    date: new Date().toISOString(),
    author: "Vous",
    text,
    detail,
  };
}

export function PlanificationSavDashboard({
  worksheetCompanies = [],
  initialTickets = [],
  teams = [],
  interventions = [],
  dolibarrConfigured = false,
  initialSuggestions = [],
  headquarters = null,
  initialSelectedId = null,
  canManageSav = false,
  canEditIntervention = false,
}: {
  worksheetCompanies?: string[];
  initialTickets?: PlanningItem[];
  teams?: SavTeam[];
  interventions?: PlanningItem[];
  dolibarrConfigured?: boolean;
  initialSuggestions?: ProximitySuggestion[];
  headquarters?: { name: string; address: string; coordinates: [number, number] } | null;
  initialSelectedId?: string | null;
  /** ADMIN/OPERATOR : conditionne l'ajout et la suppression de pièces jointes. */
  canManageSav?: boolean;
  /** ADMIN seul : autorise l'édition d'une intervention, qui écrit dans Dolibarr. */
  canEditIntervention?: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [view, setView] = useState<ViewMode>("map");
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>("pins");
  const [selectedDeptCode, setSelectedDeptCode] = useState<string | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [activeSuggestion, setActiveSuggestion] =
    useState<ProximitySuggestion | null>(null);
  const [notificationVisible, setNotificationVisible] = useState(true);
  const [search, setSearch] = useState("");
  const [workflowAction, setWorkflowAction] = useState<WorkflowAction>(null);
  const [listStatusFilter, setListStatusFilter] =
    useState<ListStatusFilter>("open");
  const savRecords = initialTickets;
  const proximitySuggestions = initialSuggestions;
  const [showSavForm, setShowSavForm] = useState(false);
  const [interventionSavDraft, setInterventionSavDraft] = useState<NewSavDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [syncingDolibarr, setSyncingDolibarr] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [routeMode, setRouteMode] = useState(false);
  const [routeStopIds, setRouteStopIds] = useState<string[]>([]);
  const [routeResult, setRouteResult] = useState<ItineraryResult | null>(null);
  const [routeComputing, setRouteComputing] = useState(false);
  const [expandedSavGroups, setExpandedSavGroups] = useState<Set<string>>(new Set());
  const [draggedSavId, setDraggedSavId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KanbanColumnKey | null>(null);

  const toggleSavGroup = (savId: string) =>
    setExpandedSavGroups((current) => {
      const next = new Set(current);
      if (next.has(savId)) next.delete(savId);
      else next.add(savId);
      return next;
    });

  const dismissSuggestion = async (suggestion: ProximitySuggestion) => {
    try {
      await dismissProximitySuggestion(suggestion.id);
      if (activeSuggestion?.id === suggestion.id) setActiveSuggestion(null);
      router.refresh();
    } catch {
      showToast("Impossible d'ignorer cette suggestion. Réessayez.", "danger");
    }
  };

  const toggleRouteMode = () => {
    setRouteMode((current) => !current);
    setRouteResult(null);
  };

  const toggleRouteStop = (item: PlanningItem) => {
    setRouteResult(null);
    setRouteStopIds((current) =>
      current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id],
    );
  };

  const clearRoute = () => {
    setRouteStopIds([]);
    setRouteResult(null);
  };

  const syncDolibarr = async () => {
    setSyncingDolibarr(true);
    try {
      const res = await fetch("/api/planification-sav/sync", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        showToast(body?.error || "La synchronisation Dolibarr a échoué.", "danger");
      } else {
        showToast("Synchronisation Dolibarr terminée.", "success");
      }
      router.refresh();
    } catch {
      showToast("La synchronisation Dolibarr a échoué.", "danger");
    } finally {
      setSyncingDolibarr(false);
    }
  };

  const planningItems = useMemo(
    () => [...interventions, ...savRecords],
    [interventions, savRecords],
  );

  // Le siège social n'apparaît jamais dans les listes/filtres/calendrier, mais doit pouvoir être
  // sélectionné comme arrêt d'itinéraire — ce tableau étend planningItems uniquement pour cette
  // résolution-là (route panel + calcul), sans polluer les autres vues.
  const routeLookupItems = useMemo(
    () => (headquarters ? [...planningItems, buildHeadquartersPlanningItem(headquarters)] : planningItems),
    [planningItems, headquarters],
  );

  const selectedItem = useMemo(
    () => (selectedId ? planningItems.find((item) => item.id === selectedId) ?? null : null),
    [planningItems, selectedId],
  );

  const calculateRoute = async (optimize: boolean) => {
    const stops = routeStopIds
      .map((id) => routeLookupItems.find((item) => item.id === id))
      .filter((item): item is PlanningItem & { coordinates: [number, number] } => Boolean(item?.coordinates));
    if (stops.length < 2) {
      showToast("Sélectionnez au moins 2 arrêts géolocalisés.", "warning");
      return;
    }
    setRouteComputing(true);
    try {
      const result = await computeItinerary(
        stops.map((stop) => ({ id: stop.id, lat: stop.coordinates[0], lng: stop.coordinates[1] })),
        optimize,
      );
      if (optimize && result.order) setRouteStopIds(result.order);
      setRouteResult(result);
    } catch {
      showToast("Le calcul de l'itinéraire a échoué. Réessayez.", "danger");
    } finally {
      setRouteComputing(false);
    }
  };

  useEffect(() => {
    if (!selectedItem && !workflowAction) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (workflowAction) setWorkflowAction(null);
      else setSelectedId(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedItem, workflowAction]);

  useEffect(() => {
    if (!mapFullscreen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMapFullscreen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mapFullscreen]);

  const filterOptions = useMemo(
    () => ({
      teams: Array.from(new Set(planningItems.map((item) => item.team))).sort(),
      companies: Array.from(
        new Set(planningItems.map((item) => item.company)),
      ).sort(),
      priorities: Array.from(
        new Set(planningItems.map((item) => item.priority)),
      ),
      statuses: Array.from(
        new Set(planningItems.map((item) => item.status)),
      ).sort(),
    }),
    [planningItems],
  );

  const activeFilterCount =
    Object.entries(filters).filter(([key, value]) => value !== initialFilters[key as keyof Filters]).length +
    (search.trim() ? 1 : 0);

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("fr");
    const weekRange = currentWeekRange();
    return planningItems.filter((item) => {
      // Le filtre de période (Aujourd'hui/Demain/Cette semaine) ne s'applique qu'aux interventions
      // Dolibarr planifiées — les SAV n'ont pas de date de planification tant qu'ils sont "à
      // planifier", donc ce filtre ne doit jamais les masquer.
      // Une intervention multi-jours reste "aujourd'hui"/"cette semaine" tant que la période choisie
      // recoupe son intervalle [date, endDate], pas seulement son premier jour.
      const itemEnd = item.endDate ?? item.date;
      const dateMatches =
        item.kind === "sav" ||
        filters.period === "all" ||
        (filters.period === "week" && item.date <= weekRange.end && itemEnd >= weekRange.start) ||
        (filters.period === "today" && isOngoingOn(item, todayIsoDate()));
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
        (filters.kind === "all" || item.kind === filters.kind) &&
        (filters.team === "all" || item.team === filters.team) &&
        (filters.company === "all" || item.company === filters.company) &&
        // La priorité/le statut SAV n'ont pas de sens pour une intervention Dolibarr (toujours
        // "Normale"/"Ouvert" par défaut) — ces filtres ne doivent affecter que les SAV, pas masquer
        // les interventions.
        (filters.priority === "all" || item.kind === "intervention" || item.priority === filters.priority) &&
        (filters.status === "all" || item.kind === "intervention" || item.status === filters.status) &&
        searchMatches
      );
    });
  }, [filters, planningItems, search]);

  const filteredSav = filteredItems.filter((item) => item.kind === "sav");
  const filteredInterventions = filteredItems.filter(
    (item) => item.kind === "intervention",
  );
  const mapItems = useMemo(
    () => filteredItems.filter((item) => !isSundayIntervention(item)),
    [filteredItems],
  );
  const deptGroups = useMemo(() => groupItemsByDepartment(mapItems), [mapItems]);
  const selectedDeptGroup = selectedDeptCode ? deptGroups.get(selectedDeptCode) : null;
  const suggestionItemIds = useMemo(
    () =>
      new globalThis.Set(
        proximitySuggestions.flatMap((suggestion) => [suggestion.interventionId, suggestion.savId]),
      ),
    [proximitySuggestions],
  );

  const visibleSuggestions = proximitySuggestions.filter(
    (suggestion) =>
      (filters.radius === "all" || suggestion.distanceKm <= Number(filters.radius)) &&
      filteredItems.some((item) => item.id === suggestion.interventionId) &&
      filteredItems.some((item) => item.id === suggestion.savId),
  );

  const groupedSuggestions = useMemo(() => {
    const groups = new globalThis.Map<string, { sav: PlanningItem; suggestions: ProximitySuggestion[] }>();
    for (const suggestion of visibleSuggestions) {
      const sav = savRecords.find((item) => item.id === suggestion.savId);
      if (!sav) continue;
      const existing = groups.get(suggestion.savId);
      if (existing) existing.suggestions.push(suggestion);
      else groups.set(suggestion.savId, { sav, suggestions: [suggestion] });
    }
    return Array.from(groups.entries()).map(([savId, group]) => ({ savId, ...group }));
  }, [visibleSuggestions, savRecords]);

  const listSav = filteredSav.filter((item) =>
    listStatusFilter === "all"
      ? true
      : listStatusFilter === "closed"
        ? isClosed(item)
        : !isClosed(item),
  );

  const updateFilter = (name: keyof Filters, value: string) =>
    setFilters((current) => ({ ...current, [name]: value }));

  const chooseSuggestion = (suggestion: ProximitySuggestion) => {
    setView("map");
    setActiveSuggestion(suggestion);
    setSelectedId(null);
  };

  const openWorkflowAction = (item: PlanningItem, action: Exclude<WorkflowAction, null>) => {
    setSelectedId(item.id);
    setWorkflowAction(action);
  };

  type SavStatePatch = Partial<Omit<PlanningItem, "planningDraft">> & {
    teamId?: string | null;
    planningDraft?: SavPlanningDraft | null;
  };

  function buildFieldsPayload(patch: SavStatePatch) {
    const fields: Record<string, unknown> = {};
    if (patch.priority !== undefined) fields.priority = patch.priority;
    if (patch.status !== undefined) fields.status = patch.status;
    if ("closedAt" in patch) fields.closedAt = patch.closedAt ?? null;
    if ("closureReason" in patch) fields.closureReason = patch.closureReason ?? null;
    if ("closureNote" in patch) fields.closureNote = patch.closureNote ?? null;
    if (patch.teamId !== undefined) fields.teamId = patch.teamId;
    if (patch.planningDraft) {
      fields.planningDate = patch.planningDraft.date;
      fields.planningStartTime = patch.planningDraft.startTime;
      fields.planningEndTime = patch.planningDraft.endTime;
      fields.planningNote = patch.planningDraft.note;
    } else if (patch.planningDraft === null) {
      fields.planningDate = null;
      fields.planningStartTime = null;
      fields.planningEndTime = null;
      fields.planningNote = null;
    }
    return Object.keys(fields).length ? fields : undefined;
  }

  const updateSavState = async (
    item: PlanningItem,
    patch: SavStatePatch,
    history: SavHistoryEntry | SavHistoryEntry[],
    select = true,
  ) => {
    const entries = Array.isArray(history) ? history : [history];
    const fields = buildFieldsPayload(patch);
    setPending(true);
    try {
      if (entries.length === 0) {
        await patchSavTicket(item.id, { fields });
      } else {
        for (let i = 0; i < entries.length; i += 1) {
          const entry = entries[i];
          await patchSavTicket(item.id, {
            fields: i === 0 ? fields : undefined,
            history: { type: entry.type, text: entry.text, detail: entry.detail },
          });
        }
      }
      if (select) setSelectedId(item.id);
      router.refresh();
    } catch {
      showToast("La mise à jour du SAV a échoué. Réessayez.", "danger");
    } finally {
      setPending(false);
    }
  };

  const kanbanColumnOf = (item: PlanningItem): KanbanColumnKey => {
    if (isClosed(item)) return "closed";
    return item.planningDraft ? "planned" : "nonplanned";
  };

  const kanbanColumns = useMemo(() => {
    const buckets: Record<KanbanColumnKey, PlanningItem[]> = { nonplanned: [], planned: [], closed: [] };
    for (const item of filteredSav) buckets[kanbanColumnOf(item)].push(item);
    return [
      { key: "nonplanned" as const, label: "Non planifiés", items: buckets.nonplanned },
      { key: "planned" as const, label: "Planifiés", items: buckets.planned },
      { key: "closed" as const, label: "Clôturés", items: buckets.closed },
    ];
  }, [filteredSav]);

  const handleKanbanDrop = (target: KanbanColumnKey) => {
    const id = draggedSavId;
    setDraggedSavId(null);
    setDragOverColumn(null);
    if (!id) return;
    const item = filteredSav.find((candidate) => candidate.id === id);
    if (!item) return;
    const source = kanbanColumnOf(item);
    if (source === target) return;

    if (target === "closed") {
      openWorkflowAction(item, "close");
      return;
    }
    if (target === "planned") {
      if (item.planningDraft) {
        updateSavState(
          item,
          { status: "Ouvert", closedAt: undefined, closureReason: undefined, closureNote: undefined },
          makeHistory("status", "Statut changé vers Ouvert"),
        );
      } else {
        openWorkflowAction(item, "planning");
      }
      return;
    }
    // target === "nonplanned"
    const wasClosed = source === "closed";
    updateSavState(
      item,
      {
        ...(wasClosed ? { status: "Ouvert", closedAt: undefined, closureReason: undefined, closureNote: undefined } : {}),
        planningDraft: null,
      },
      wasClosed
        ? [makeHistory("status", "Statut changé vers Ouvert"), makeHistory("planning", "Planification annulée")]
        : makeHistory("planning", "Planification annulée"),
      false,
    );
  };

  const deleteSav = async (item: PlanningItem) => {
    if (!window.confirm(`Supprimer ${item.reference} ?`)) return;
    setPending(true);
    try {
      await deleteSavTicket(item.id);
      setSelectedId((current) => (current === item.id ? null : current));
      router.refresh();
      showToast("SAV supprimé.", "success");
    } catch {
      showToast("La suppression du SAV a échoué. Réessayez.", "danger");
    } finally {
      setPending(false);
    }
  };

  const addSav = async (draft: NewSavDraft) => {
    setPending(true);
    try {
      await createSavTicket({
        title: draft.title,
        company: draft.company,
        contact: draft.contact,
        phone: draft.phone,
        address: draft.address,
        priority: draft.priority,
        equipment: draft.equipment || "Équipement à préciser",
        description: draft.description || "SAV ajouté manuellement.",
      });
      setShowSavForm(false);
      router.refresh();
      showToast("SAV créé.", "success");
    } catch {
      showToast("La création du SAV a échoué. Réessayez.", "danger");
    } finally {
      setPending(false);
    }
  };

  const prepareSavFromIntervention = async (item: PlanningItem) => {
    setPending(true);
    try {
      let phone = "";
      let note = "";
      const eventId = item.dolibarrEventId || item.reference;
      if (eventId) {
        try {
          const response = await fetch(`/api/dolibarr/events/${encodeURIComponent(eventId)}`);
          if (response.ok) {
            const data = await response.json();
            phone = data.phone || "";
            note = data.note || "";
          }
        } catch {}
      }
      setInterventionSavDraft({
        title: item.title,
        company: item.company || "",
        contact: item.company || item.title,
        phone,
        address: item.address,
        priority: "Normale",
        equipment: item.equipment || "",
        description: note || `SAV créé depuis l'intervention Dolibarr ${item.reference}.`,
      });
    } catch {
      showToast("Impossible de récupérer les informations de cette intervention. Réessayez.", "danger");
    } finally {
      setPending(false);
    }
  };

  const confirmSavFromIntervention = async (draft: NewSavDraft) => {
    setPending(true);
    try {
      await createSavTicket({
        title: draft.title,
        company: draft.company,
        contact: draft.contact,
        phone: draft.phone,
        address: draft.address,
        priority: draft.priority,
        equipment: draft.equipment || "",
        description: draft.description,
      });
      setInterventionSavDraft(null);
      setSelectedId(null);
      router.refresh();
      showToast("SAV ajouté depuis l'intervention Dolibarr.", "success");
    } catch {
      showToast("La création du SAV a échoué. Réessayez.", "danger");
    } finally {
      setPending(false);
    }
  };

  const closeWorkflow = () => setWorkflowAction(null);
  const selectItem = (item: PlanningItem) => setSelectedId(item.id);

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
          {dolibarrConfigured ? "SAV persisté · Interventions synchronisées depuis Dolibarr" : "SAV persisté · Dolibarr non configuré (Paramètres)"}
        </div>
      </div>

      <section className={styles.statsGrid} aria-label="Indicateurs de planification">
        <StatCard
          icon={Wrench}
          tone="orange"
          value={savRecords.length}
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

      <div className={mapFullscreen ? styles.mapFullscreen : undefined}>
      <section className={styles.filterCard} aria-label="Filtres">
        <button
          type="button"
          className={styles.filterHeading}
          onClick={() => setFiltersExpanded((current) => !current)}
          aria-expanded={filtersExpanded}
        >
          <span><Filter aria-hidden size={17} /></span>
          <div>
            <strong>Filtres opérationnels</strong>
            <small>
              {activeFilterCount > 0
                ? `${activeFilterCount} filtre${activeFilterCount > 1 ? "s" : ""} actif${activeFilterCount > 1 ? "s" : ""}`
                : "La carte, le calendrier et la liste sont synchronisés."}
            </small>
          </div>
          <ChevronDown aria-hidden size={16} className={styles.filterChevron} style={{ transform: filtersExpanded ? "rotate(180deg)" : undefined }} />
        </button>
        {filtersExpanded && (
          <>
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
              label="Type"
              value={filters.kind}
              onChange={(value) => updateFilter("kind", value)}
              options={kindOptions}
            />
            <FilterSelect
              label="Période"
              value={filters.period}
              onChange={(value) => updateFilter("period", value)}
              options={[
                { value: "today", label: `Aujourd’hui · ${periodDayFormatter.format(new Date())}` },
                { value: "week", label: "Cette semaine" },
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
            <FilterSelect
              label="Rayon"
              value={filters.radius}
              onChange={(value) => updateFilter("radius", value)}
              options={radiusOptions}
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
          </>
        )}
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
            onClick={() => { setMapFullscreen(false); setView("calendar"); }}
          />
          <ViewTab
            active={view === "list"}
            icon={List}
            label="Liste"
            onClick={() => { setMapFullscreen(false); setView("list"); }}
          />
          <ViewTab
            active={view === "kanban"}
            icon={Kanban}
            label="Kanban"
            onClick={() => { setMapFullscreen(false); setView("kanban"); }}
          />
        </div>
        {view === "map" && mapMode === "pins" && (
          <button
            type="button"
            className={`button button-small ${routeMode ? "button-primary" : "button-outline-primary"}`}
            onClick={toggleRouteMode}
          >
            <Route aria-hidden size={15} />
            Mode itinéraire
          </button>
        )}
        <p>
          <strong>{filteredItems.length}</strong> éléments affichés
          <span>·</span> {currentWeekLabel()}
        </p>
      </div>

      {view === "map" && (
        <section className={styles.mapLayout} aria-label="Vue carte">
          <article className={styles.mapCard}>
            <div className={styles.mapHeader}>
              <div>
                <h2>Couverture terrain</h2>
              </div>
              <div className={styles.mapHeaderRight}>
                {SHOW_MAP_LEGEND && (
                  <div className={styles.mapLegend}>
                    <span><i className={styles.legendSav} />SAV</span>
                    <span><i className={styles.legendUrgent} />Urgence</span>
                    <span><i className={styles.legendIntervention} />Intervention</span>
                    <span><i className={styles.legendClosed} />Clôturé</span>
                    <span><i className={styles.legendSuggestion} />Suggestion active</span>
                  </div>
                )}
                <div className={styles.quickFilters} role="group" aria-label="Type de carte">
                  {([
                    { value: "pins", label: "Pins" },
                    { value: "cartogram", label: "Cartogramme" },
                    { value: "shape", label: "Départements" },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={mapMode === option.value ? styles.quickFilterActive : ""}
                      onClick={() => {
                        setMapMode(option.value);
                        setSelectedDeptCode(null);
                        if (option.value !== "pins") { setRouteMode(false); setRouteResult(null); }
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={styles.mapFullscreenToggle}
                  onClick={() => setMapFullscreen((current) => !current)}
                  aria-label={mapFullscreen ? "Quitter le plein écran" : "Passer en plein écran"}
                  title={mapFullscreen ? "Quitter le plein écran" : "Passer en plein écran"}
                >
                  {mapFullscreen ? <Minimize2 aria-hidden size={16} /> : <Maximize2 aria-hidden size={16} />}
                </button>
              </div>
            </div>
            <div className={styles.mapFrame}>
              {mapMode === "pins" && (
                <>
                  <PlanningMap
                    items={mapItems}
                    activeSuggestion={activeSuggestion}
                    onSelectItem={selectItem}
                    routeMode={routeMode}
                    routeStopIds={routeStopIds}
                    routeGeometry={routeResult?.geometry ?? []}
                    onToggleRouteStop={toggleRouteStop}
                    headquarters={headquarters}
                    onBackgroundClick={() => setActiveSuggestion(null)}
                    suggestionItemIds={SHOW_MAP_LEGEND ? suggestionItemIds : undefined}
                  />
                  <div className={styles.mapCount}>
                    <LocateFixed aria-hidden size={15} />
                    {mapItems.filter((item) => item.coordinates).length} points
                    {mapItems.some((item) => !item.coordinates) && (
                      <small>
                        {" "}
                        · {mapItems.filter((item) => !item.coordinates).length} sans position connue
                      </small>
                    )}
                  </div>
                </>
              )}
              {mapMode === "cartogram" && (
                <DepartmentCartogram
                  items={mapItems}
                  selectedCode={selectedDeptCode}
                  onSelectDepartment={(code) => setSelectedDeptCode(code)}
                />
              )}
              {mapMode === "shape" && (
                <DepartmentShapeMap
                  items={mapItems}
                  selectedCode={selectedDeptCode}
                  onSelectDepartment={(code) => setSelectedDeptCode(code)}
                />
              )}
            </div>
          </article>

          {mapMode !== "pins" ? (
            <aside className={styles.suggestionsCard}>
              <div className={styles.suggestionHeading}>
                <span><MapPin aria-hidden size={18} /></span>
                <div>
                  <h2>{selectedDeptCode ? `Département ${selectedDeptCode}${selectedDeptGroup ? ` · ${selectedDeptGroup.nom}` : ""}` : "Détail par département"}</h2>
                  <p>{selectedDeptCode ? "SAV et interventions de ce département" : "Cliquez sur un département coloré pour voir le détail"}</p>
                </div>
              </div>
              <div className={styles.suggestionList}>
                {!selectedDeptCode && (
                  <div className={styles.emptyState}>
                    <MapPin aria-hidden size={22} />
                    <strong>Aucun département sélectionné</strong>
                    <p>Cliquez sur un département coloré sur la carte pour voir ce qu’il contient.</p>
                  </div>
                )}
                {selectedDeptCode && !selectedDeptGroup?.savItems.length && !selectedDeptGroup?.interventionItems.length && (
                  <div className={styles.emptyState}>
                    <MapPin aria-hidden size={22} />
                    <strong>Rien dans ce département</strong>
                  </div>
                )}
                {selectedDeptCode && Boolean(selectedDeptGroup?.savItems.length) && (
                  <div className={styles.deptDrilldownGroup}>
                    <h4>SAV ({selectedDeptGroup!.savItems.length})</h4>
                    {selectedDeptGroup!.savItems.map((item) => (
                      <button type="button" key={item.id} className={styles.deptDrilldownRow} onClick={() => selectItem(item)}>
                        <span className={styles.deptDrilldownRef}>{item.reference}</span>
                        <span className={styles.deptDrilldownMain}>
                          <strong>{item.title}</strong>
                          <small>{item.company} · {item.address}</small>
                        </span>
                        <ChevronRight aria-hidden size={15} />
                      </button>
                    ))}
                  </div>
                )}
                {selectedDeptCode && Boolean(selectedDeptGroup?.interventionItems.length) && (
                  <div className={styles.deptDrilldownGroup}>
                    <h4>Interventions ({selectedDeptGroup!.interventionItems.length})</h4>
                    {selectedDeptGroup!.interventionItems.map((item) => {
                      const today = getTodayIsoDateParis();
                      const isToday = isOngoingOn(item, today);
                      // En cours depuis un jour précédent (intervention multi-jours) — à distinguer
                      // visuellement d'une intervention qui démarre aujourd'hui même.
                      const isContinuation = isToday && item.date !== today;
                      return (
                        <button
                          type="button"
                          key={item.id}
                          className={`${styles.deptDrilldownRow}${isToday ? ` ${styles.deptDrilldownRowToday}` : ""}`}
                          onClick={() => selectItem(item)}
                        >
                          <span className={styles.deptDrilldownMain}>
                            <strong>{item.title}</strong>
                            <small>{item.company} · {item.address}</small>
                          </span>
                          {isContinuation && <span className={styles.continuationBadge}>Suite</span>}
                          {item.date && (
                            <span className={styles.deptDrilldownDate}>
                              {dateFormatter.format(new Date(`${item.date}T12:00:00`))}
                              {item.endDate && ` → ${dateFormatter.format(new Date(`${item.endDate}T12:00:00`))}`}
                            </span>
                          )}
                          <ChevronRight aria-hidden size={15} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>
          ) : routeMode ? (
            <aside className={styles.suggestionsCard}>
              <div className={styles.suggestionHeading}>
                <span><Route aria-hidden size={18} /></span>
                <div>
                  <h2>Itinéraire</h2>
                  <p>Cliquez sur des points de la carte pour construire votre trajet</p>
                </div>
              </div>
              <div className={styles.suggestionList}>
                {routeStopIds.length === 0 && (
                  <div className={styles.emptyState}>
                    <Route aria-hidden size={22} />
                    <strong>Aucun arrêt sélectionné</strong>
                    <p>Cliquez sur des SAV ou interventions sur la carte pour les ajouter.</p>
                  </div>
                )}
                {routeStopIds.map((id, index) => {
                  const item = routeLookupItems.find((candidate) => candidate.id === id);
                  if (!item) return null;
                  const leg = routeResult?.legs[index];
                  const nextId = routeStopIds[index + 1];
                  const nextItem = nextId ? routeLookupItems.find((candidate) => candidate.id === nextId) : undefined;
                  return (
                    <div key={id} className={styles.routeStopRow}>
                      <span className={styles.routeStopNumber}>{index + 1}</span>
                      <div className={styles.routeStopContent}>
                        <b>{item.title}</b>
                        <small>{item.company}</small>
                        {leg && nextItem && (
                          <small className={styles.routeStopLeg}>
                            → {nextItem.title} · {leg.travelMinutes} min · {leg.distanceKm.toFixed(1)} km
                          </small>
                        )}
                      </div>
                      <button
                        type="button"
                        className={styles.routeStopRemove}
                        onClick={() => toggleRouteStop(item)}
                        aria-label="Retirer de l’itinéraire"
                        title="Retirer de l’itinéraire"
                      >
                        <X aria-hidden size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
              {routeResult && (
                <div className={styles.routeSummary}>
                  <span>Total</span>
                  <strong>
                    {routeResult.totalTravelMinutes} min · {routeResult.totalDistanceKm.toFixed(1)} km
                  </strong>
                </div>
              )}
              <div className={styles.routeActions}>
                <button
                  type="button"
                  className="button button-primary button-small"
                  disabled={routeStopIds.length < 2 || routeComputing}
                  onClick={() => calculateRoute(false)}
                >
                  Calculer
                </button>
                <button
                  type="button"
                  className="button button-outline-primary button-small"
                  disabled={routeStopIds.length < 2 || routeComputing}
                  onClick={() => calculateRoute(true)}
                >
                  <Wand2 aria-hidden size={14} /> Optimiser
                </button>
                <button
                  type="button"
                  className="button button-ghost button-small"
                  disabled={routeStopIds.length === 0}
                  onClick={clearRoute}
                >
                  <Trash2 aria-hidden size={14} /> Effacer
                </button>
              </div>
            </aside>
          ) : (
            <aside className={styles.suggestionsCard}>
              <div className={styles.suggestionHeading}>
                <span><Sparkles aria-hidden size={18} /></span>
                <div>
                  <h2>Suggestions de proximité</h2>
                  <p>Basé sur le temps de trajet réel (OSRM)</p>
                </div>
              </div>
              <div className={styles.suggestionList}>
                {groupedSuggestions.map((group) => {
                  const expanded = expandedSavGroups.has(group.savId);
                  return (
                    <div key={group.savId} className={styles.suggestionGroup}>
                      <button
                        type="button"
                        className={styles.suggestionGroupHeader}
                        onClick={() => toggleSavGroup(group.savId)}
                        aria-expanded={expanded}
                      >
                        <span className={styles.suggestionGroupInfo}>
                          <strong>{group.sav.contact || group.sav.company}</strong>
                          <small>{group.sav.reference} · {group.sav.title}</small>
                        </span>
                        <span className={styles.suggestionGroupCount}>
                          {group.suggestions.length}
                        </span>
                        <ChevronDown
                          aria-hidden
                          size={15}
                          className={styles.suggestionGroupChevron}
                          style={{ transform: expanded ? "rotate(180deg)" : undefined }}
                        />
                      </button>
                      {expanded && (
                        <div className={styles.suggestionGroupBody}>
                          {group.suggestions.map((suggestion) => {
                            const intervention = interventions.find(
                              (item) => item.id === suggestion.interventionId,
                            )!;
                            const sav = group.sav;
                            const active = activeSuggestion?.id === suggestion.id;
                            return (
                              <div
                                key={suggestion.id}
                                className={`${styles.suggestion}${active ? ` ${styles.suggestionActive}` : ""}`}
                              >
                                <button
                                  type="button"
                                  className={styles.suggestionMain}
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
                                      <small>{suggestion.distanceKm.toFixed(1)} km</small>
                                    </span>
                                    <b>{intervention.title} → {sav.contact}</b>
                                    <small>{intervention.team}</small>
                                    <small>{intervention.reference} · {sav.reference}</small>
                                  </span>
                                  <ChevronRight aria-hidden size={16} />
                                </button>
                                <button
                                  type="button"
                                  className={styles.suggestionDismiss}
                                  onClick={() => dismissSuggestion(suggestion)}
                                  aria-label="Ignorer cette suggestion"
                                  title="Ignorer cette suggestion"
                                >
                                  <X aria-hidden size={13} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {visibleSuggestions.length === 0 && (
                  <div className={styles.emptyState}>
                    <Navigation aria-hidden size={22} />
                    <strong>Aucune suggestion visible</strong>
                    <p>Élargissez les filtres (rayon, période) pour retrouver les rapprochements.</p>
                  </div>
                )}
              </div>
              <div className={styles.demoNotice}>
                <CircleAlert aria-hidden size={16} />
                <p>
                  Distances et temps de trajet réels (OSRM). La ligne sur la carte reste indicative,
                  pas un tracé d’itinéraire exact.
                </p>
              </div>
            </aside>
          )}
        </section>
      )}
      </div>

      {view === "calendar" && (
        <section className={styles.viewCard} aria-label="Vue calendrier">
          <div className={styles.cardTitleRow}>
            <div>
              <p className="eyebrow">Planning hebdomadaire</p>
              <h2>{currentWeekLabel()}</h2>
            </div>
            <div className={styles.listHeaderActions}>
              <span className={styles.readOnlyPill}>
                <LockKeyhole aria-hidden size={13} />
                Dolibarr en lecture seule
              </span>
              <button
                type="button"
                className="button button-icon button-outline-primary button-small"
                onClick={syncDolibarr}
                disabled={syncingDolibarr}
                aria-label="Resynchroniser avec Dolibarr"
                title="Resynchroniser avec Dolibarr"
              >
                <RefreshCcw aria-hidden size={15} className={syncingDolibarr ? styles.spinning : undefined} />
              </button>
            </div>
          </div>
          {/* Uniquement les interventions Dolibarr — un SAV créé manuellement peut donner lieu, plus
             tard, à un événement Dolibarr pour la même intervention ; les deux apparaîtraient sinon
             en double sur le calendrier. Les SAV restent visibles en Liste/Kanban, pas ici. */}
          <PlanningCalendar items={filteredInterventions} onSelectItem={selectItem} />
        </section>
      )}

      {view === "list" && (
        <section className={`${styles.viewCard} ${styles.tableCard}`} aria-label="Vue liste">
          <div className={styles.cardTitleRow}>
            <div>
              <p className="eyebrow">File SAV</p>
              <h2>SAV à qualifier et planifier</h2>
            </div>
            <div className={styles.listHeaderActions}>
              <div className={styles.quickFilters} role="group" aria-label="Filtrer les SAV par état">
                {(["open", "closed", "all"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={listStatusFilter === value ? styles.quickFilterActive : ""}
                    onClick={() => setListStatusFilter(value)}
                  >
                    {value === "open" ? "Ouverts" : value === "closed" ? "Fermés" : "Tous"}
                  </button>
                ))}
              </div>
              <button type="button" className={`${styles.compactHeaderButton} button button-primary`} disabled={pending} onClick={() => setShowSavForm(true)}>Nouveau SAV</button>
              <span className={styles.resultPill}>{listSav.length} sur {savRecords.length}</span>
            </div>
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
                  <th>Clôture</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {listSav.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.reference}</strong><small>Dashboard SAV</small></td>
                    <td><strong>{item.company}</strong><small>{item.contact}</small></td>
                    <td><strong>{item.title}</strong><small>{item.equipment}</small></td>
                    <td>{dateFormatter.format(new Date(`${item.date}T12:00:00`))}</td>
                    <td>
                      <select
                        className={`${styles.prioritySelect} ${styles[`priority${item.priority}`]}`}
                        value={item.priority}
                        aria-label={`Priorité ${item.reference}`}
                        onChange={(event) => updateSavState(item, { priority: event.target.value as PlanningItem["priority"] }, makeHistory("priority", `Priorité changée en ${event.target.value}`), false)}
                      >
                        {priorityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </td>
                    <td><StatusBadge status={item.status} /></td>
                    <td>
                      {isClosed(item) ? (
                        <>
                          <strong>{item.closureReason}</strong>
                          <small>{item.closedAt ? closedDateFormatter.format(new Date(item.closedAt)) : "—"}</small>
                        </>
                      ) : (
                        <small>—</small>
                      )}
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={styles.rowButton}
                          onClick={() => selectItem(item)}
                          aria-label={`Voir ${item.reference}`}
                        >
                          <ChevronRight aria-hidden size={17} />
                        </button>
                        <RowActionMenu
                          label={`Actions pour ${item.reference}`}
                          items={[
                            { key: "detail", label: "Voir le détail", onClick: () => selectItem(item) },
                            isClosed(item)
                              ? { key: "reopen", label: "Réouvrir le SAV", onClick: () => updateSavState(item, { status: "Ouvert", closedAt: undefined, closureReason: undefined, closureNote: undefined }, makeHistory("status", "Statut changé vers Ouvert")) }
                              : { key: "close", label: "Clôturer le SAV", onClick: () => openWorkflowAction(item, "close") },
                            { key: "note", label: "Ajouter une note", onClick: () => openWorkflowAction(item, "note") },
                            { key: "planning", label: "Préparer la planification", onClick: () => openWorkflowAction(item, "planning") },
                            { key: "delete", label: "Supprimer le SAV", danger: true, onClick: () => deleteSav(item) },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {listSav.length === 0 && (
              <div className={styles.emptyState}>
                <Search aria-hidden size={24} />
                <strong>Aucun SAV dans cette vue</strong>
                <p>Changez le filtre Ouverts/Fermés ou réinitialisez les critères.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {view === "kanban" && (
        <section className={styles.viewCard} aria-label="Vue kanban">
          <div className={styles.cardTitleRow}>
            <div>
              <p className="eyebrow">File SAV</p>
              <h2>Kanban SAV</h2>
            </div>
            <span className={styles.resultPill}>{filteredSav.length} SAV</span>
          </div>
          <div className={styles.kanbanBoard}>
            {kanbanColumns.map((column) => (
              <div
                key={column.key}
                className={`${styles.kanbanColumn} ${styles[`kanbanColumn${column.key}`]}${dragOverColumn === column.key ? ` ${styles.kanbanColumnDragOver}` : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverColumn(column.key);
                }}
                onDragLeave={() => setDragOverColumn((current) => (current === column.key ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  handleKanbanDrop(column.key);
                }}
              >
                <div className={styles.kanbanColumnHeader}>
                  <strong>{column.label}</strong>
                  <span>{column.items.length}</span>
                </div>
                <div className={styles.kanbanColumnBody}>
                  {column.items.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => setDraggedSavId(item.id)}
                      onDragEnd={() => {
                        setDraggedSavId(null);
                        setDragOverColumn(null);
                      }}
                      onClick={() => selectItem(item)}
                      className={`${styles.kanbanCard}${draggedSavId === item.id ? ` ${styles.kanbanCardDragging}` : ""}`}
                    >
                      <div className={styles.kanbanCardHeader}>
                        <span>{item.reference}</span>
                        <span className={styles.kanbanCardHeaderActions}>
                          <span
                            className={`${styles.priorityDot} ${styles[`priority${item.priority}`]}`}
                            title={item.priority}
                          />
                          <span onClick={(event) => event.stopPropagation()}>
                            <RowActionMenu
                              label={`Actions pour ${item.reference}`}
                              triggerClassName="rowButton rowButton-compact"
                              triggerSize={14}
                              items={[
                                { key: "detail", label: "Voir le détail", onClick: () => selectItem(item) },
                                ...(isClosed(item)
                                  ? [{ key: "reopen", label: "Réouvrir le SAV", onClick: () => updateSavState(item, { status: "Ouvert", closedAt: undefined, closureReason: undefined, closureNote: undefined }, makeHistory("status", "Statut changé vers Ouvert")) }]
                                  : [
                                      { key: "planning", label: item.planningDraft ? "Modifier la planification" : "Préparer la planification", onClick: () => openWorkflowAction(item, "planning") },
                                      ...(item.planningDraft
                                        ? [{ key: "cancel-planning", label: "Annuler la planification", onClick: () => updateSavState(item, { planningDraft: null }, makeHistory("planning", "Planification annulée"), false) }]
                                        : []),
                                      { key: "close", label: "Clôturer le SAV", onClick: () => openWorkflowAction(item, "close") },
                                    ]),
                                { key: "delete", label: "Supprimer le SAV", danger: true, onClick: () => deleteSav(item) },
                              ]}
                            />
                          </span>
                        </span>
                      </div>
                      <strong>{item.title}</strong>
                      <small>{item.contact || item.company}</small>
                      {item.team && item.team !== "Non affectée" && (
                        <small className={styles.kanbanCardMeta}>
                          <UsersRound aria-hidden size={11} />
                          {item.team}
                        </small>
                      )}
                      {item.planningDraft && (
                        <small className={styles.kanbanCardMeta}>
                          <CalendarClock aria-hidden size={11} />
                          {dateFormatter.format(new Date(`${item.planningDraft.date}T12:00:00`))} · {item.planningDraft.startTime}
                        </small>
                      )}
                      {isClosed(item) && item.closureReason && (
                        <small className={styles.kanbanCardMeta}>
                          <CheckCircle2 aria-hidden size={11} />
                          {item.closureReason}
                        </small>
                      )}
                    </div>
                  ))}
                  {column.items.length === 0 && <p className={styles.kanbanEmpty}>Aucun SAV</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {notificationVisible && visibleSuggestions.length > 0 && (
        <div className={styles.toast} role="status" aria-live="polite">
          <span className={styles.toastIcon}><BellRing aria-hidden size={18} /></span>
          <div>
            <strong>Proximité détectée</strong>
            <p>
              {visibleSuggestions.length === 1
                ? "1 rapprochement SAV/intervention disponible."
                : `${visibleSuggestions.length} rapprochements SAV/intervention disponibles.`}
            </p>
            <button
              type="button"
              onClick={() => chooseSuggestion(visibleSuggestions[0])}
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
        <DetailDrawer
          key={selectedItem.id}
          item={selectedItem}
          action={workflowAction}
          teams={teams}
          interventions={interventions}
          proximitySuggestions={proximitySuggestions}
          pending={pending}
          onClose={() => setSelectedId(null)}
          onAction={openWorkflowAction}
          onCloseAction={closeWorkflow}
          onUpdate={updateSavState}
          onCreateSavFromIntervention={prepareSavFromIntervention}
          canManageSav={canManageSav}
          canEditIntervention={canEditIntervention}
        />
      )}
      {showSavForm && <NewSavModal companies={worksheetCompanies} onClose={() => setShowSavForm(false)} onSubmit={addSav} />}
      {interventionSavDraft && (
        <NewSavModal
          companies={worksheetCompanies}
          initialDraft={interventionSavDraft}
          eyebrow="Depuis Dolibarr"
          heading="Confirmer le SAV"
          submitLabel="Ajouter en SAV"
          onClose={() => setInterventionSavDraft(null)}
          onSubmit={confirmSavFromIntervention}
        />
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
        <option value="all">Tous</option>
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
  action,
  teams,
  interventions,
  proximitySuggestions,
  pending,
  onClose,
  onAction,
  onCloseAction,
  onUpdate,
  onCreateSavFromIntervention,
  canManageSav,
  canEditIntervention,
}: {
  item: PlanningItem;
  action: WorkflowAction;
  teams: SavTeam[];
  interventions: PlanningItem[];
  proximitySuggestions: ProximitySuggestion[];
  pending: boolean;
  onClose: () => void;
  onAction: (item: PlanningItem, action: Exclude<WorkflowAction, null>) => void;
  onCloseAction: () => void;
  onUpdate: (
    item: PlanningItem,
    patch: Partial<PlanningItem> & { teamId?: string | null },
    history: SavHistoryEntry | SavHistoryEntry[],
  ) => void;
  onCreateSavFromIntervention: (item: PlanningItem) => void;
  canManageSav: boolean;
  canEditIntervention: boolean;
}) {
  const isExternal = item.source === "dolibarr";
  const eventId = isExternal ? item.dolibarrEventId || item.reference : "";
  const [dolibarrNoteTokens, setDolibarrNoteTokens] = useState<NoteToken[] | null>(null);
  const [dolibarrNoteLoading, setDolibarrNoteLoading] = useState(Boolean(eventId));

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    fetch(`/api/dolibarr/events/${encodeURIComponent(eventId)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setDolibarrNoteTokens(data?.noteTokens || []);
      })
      .catch(() => {
        if (!cancelled) setDolibarrNoteTokens([]);
      })
      .finally(() => {
        if (!cancelled) setDolibarrNoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

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
            {isExternal ? <PriorityBadge priority={item.priority} /> : (
              <label className={styles.priorityEditor}>
                <span>Priorité</span>
                <select
                  className={`${styles.prioritySelect} ${styles[`priority${item.priority}`]}`}
                  value={item.priority}
                  onChange={(event) => onUpdate(item, { priority: event.target.value as PlanningItem["priority"] }, makeHistory("priority", `Priorité changée en ${event.target.value}`))}
                >
                  {priorityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            )}
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
            {/* Édition réservée aux administrateurs et aux interventions Dolibarr : c'est la
                seule action du module qui écrit dans un système externe. */}
            {isExternal && canEditIntervention && (
              <InterventionEditor item={item} onDone={onClose} />
            )}
          </section>
          {/* Matériel à poser : visible par tous ceux qui voient l'intervention (le technicien doit
              savoir ce qu'il installe et accéder à la doc), modifiable par les administrateurs. */}
          {isExternal && (
            <section className={styles.detailSection}>
              <h3>Matériel à poser</h3>
              <InterventionMaterials interventionId={item.id} canManage={canEditIntervention} />
            </section>
          )}
          <section className={styles.detailSection}>
            <h3>{isExternal ? "Note Dolibarr" : "Description"}</h3>
            {isExternal ? (
              <p className={styles.description}>
                {dolibarrNoteLoading ? (
                  "Chargement…"
                ) : dolibarrNoteTokens && dolibarrNoteTokens.length > 0 ? (
                  <NoteRichText tokens={dolibarrNoteTokens} />
                ) : (
                  "Aucune note."
                )}
              </p>
            ) : (
              <p className={styles.description}>{item.description}</p>
            )}
          </section>
          {!isExternal && (
            <>
              {/* Photos et documents : déposés par un opérateur, ou par la société cliente
                  depuis le formulaire public `/sav-request`. */}
              <section className={styles.detailSection}>
                <h3>Pièces jointes</h3>
                <SavAttachments savId={item.id} canManage={canManageSav} />
              </section>
              <section className={styles.detailSection}>
                <div className={styles.sectionHeadingRow}>
                  <h3>Actions SAV</h3>
                  {isClosed(item) && <span className={styles.closedMiniLabel}><CheckCircle2 aria-hidden size={12} />Clôturé</span>}
                </div>
                <div className={styles.drawerActions}>
                  <button type="button" className={styles.drawerAction} onClick={() => onAction(item, "note")}>
                    <MessageSquarePlus aria-hidden size={16} />
                    <span>Ajouter une note</span>
                    <ChevronRight aria-hidden size={14} />
                  </button>
                  <button
                    type="button"
                    className={styles.drawerAction}
                    onClick={() => isClosed(item)
                      ? onUpdate(item, { status: "Ouvert", closedAt: undefined, closureReason: undefined, closureNote: undefined }, makeHistory("status", "Statut changé vers Ouvert"))
                      : onAction(item, "close")}
                  >
                    <CheckCircle2 aria-hidden size={16} />
                    <span>{isClosed(item) ? "Réouvrir le SAV" : "Clôturer le SAV"}</span>
                    <ChevronRight aria-hidden size={14} />
                  </button>
                  <button type="button" className={`${styles.drawerAction} ${styles.drawerActionPrimary}`} onClick={() => onAction(item, "planning")}>
                    <CalendarClock aria-hidden size={16} />
                    <span>{item.planningDraft ? "Modifier la planification" : "Préparer la planification"}</span>
                    <ChevronRight aria-hidden size={14} />
                  </button>
                </div>
              </section>
              {item.planningDraft && (
                <section className={styles.detailSection}>
                  <div className={styles.sectionHeadingRow}>
                    <h3>Préparation de planification</h3>
                    <span className={styles.preparedPill}><Check aria-hidden size={12} />Prête</span>
                  </div>
                  <p className={styles.planningSummary}>
                    {dateFormatter.format(new Date(`${item.planningDraft.date}T12:00:00`))} · {item.planningDraft.startTime}–{item.planningDraft.endTime} · {item.planningDraft.team}
                  </p>
                  {item.planningDraft.note && <small className={styles.planningNote}>{item.planningDraft.note}</small>}
                </section>
              )}
              <section className={styles.detailSection}>
                <div className={styles.sectionHeadingRow}>
                  <h3>Historique</h3>
                  <span className={styles.historyCount}>{item.history?.length || 0} événements</span>
                </div>
                <HistoryList entries={item.history || []} />
              </section>
            </>
          )}
        </div>
        <div className={styles.drawerFooter}>
          {isExternal ? (
            <>
              <button
                type="button"
                className="button"
                disabled={pending}
                onClick={() => onCreateSavFromIntervention(item)}
              >
                <Wrench aria-hidden size={15} />
                Ajouter en SAV
              </button>
              <button type="button" className="button button-primary">
                <ExternalLink aria-hidden size={15} />
                Ouvrir dans Dolibarr
              </button>
            </>
          ) : <small>Bilet SAV persisté en base de données.</small>}
        </div>
      </aside>
      {!isExternal && action && (
        <WorkflowModal
          action={action}
          item={item}
          teams={teams}
          interventions={interventions}
          proximitySuggestions={proximitySuggestions}
          onClose={onCloseAction}
          onAddNote={(note) => {
            onUpdate(item, {}, makeHistory("note", note));
            onCloseAction();
          }}
          onCloseSav={(reason, note) => {
            const closedAt = new Date().toISOString();
            onUpdate(
              item,
              { status: "Clôturé", closedAt, closureReason: reason, closureNote: note },
              [
                makeHistory("status", "Statut changé vers Clôturé"),
                makeHistory("closure", "SAV clôturé", `${reason}${note ? ` · ${note}` : ""}`),
              ],
            );
            onCloseAction();
          }}
          onPrepare={(draft) => {
            const intervention = interventions.find((candidate) => candidate.id === draft.interventionId);
            const matchedTeam = teams.find((team) => team.name === draft.team);
            onUpdate(
              item,
              { planningDraft: draft, teamId: matchedTeam?.id ?? null },
              makeHistory(
                "planning",
                "Préparation de planification enregistrée",
                `${draft.date} · ${draft.startTime}–${draft.endTime} · ${draft.team}${intervention ? ` · ${intervention.reference}` : ""}${draft.note ? ` · ${draft.note}` : ""}`,
              ),
            );
            onCloseAction();
          }}
        />
      )}
    </div>
  );
}

function HistoryList({ entries }: { entries: SavHistoryEntry[] }) {
  if (!entries.length) {
    return (
      <div className={styles.historyEmpty}>
        <History aria-hidden size={18} />
        <span>Aucune action enregistrée.</span>
      </div>
    );
  }
  return (
    <div className={styles.historyList}>
      {[...entries].reverse().map((entry) => (
        <div className={styles.historyEntry} key={entry.id}>
          <span className={`${styles.historyIcon} ${styles[`history${entry.type}`]}`}>
            {entry.type === "note" ? <MessageSquarePlus aria-hidden size={13} /> : entry.type === "closure" ? <CheckCircle2 aria-hidden size={13} /> : entry.type === "planning" ? <CalendarClock aria-hidden size={13} /> : entry.type === "priority" ? <CircleAlert aria-hidden size={13} /> : <CircleDot aria-hidden size={13} />}
          </span>
          <div>
            <strong>{entry.text}</strong>
            {entry.detail && <p>{entry.detail}</p>}
            <small>{dateTimeFormatter.format(new Date(entry.date))} · {entry.author}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkflowModal({
  action,
  item,
  teams,
  interventions,
  proximitySuggestions,
  onClose,
  onAddNote,
  onCloseSav,
  onPrepare,
}: {
  action: Exclude<WorkflowAction, null>;
  item: PlanningItem;
  teams: SavTeam[];
  interventions: PlanningItem[];
  proximitySuggestions: ProximitySuggestion[];
  onClose: () => void;
  onAddNote: (note: string) => void;
  onCloseSav: (reason: string, note: string) => void;
  onPrepare: (draft: SavPlanningDraft) => void;
}) {
  const [note, setNote] = useState("");
  const [closureReason, setClosureReason] = useState("Résolu par téléphone");
  const [closureNote, setClosureNote] = useState("");
  const [date, setDate] = useState(item.planningDraft?.date || item.date);
  const [startTime, setStartTime] = useState(item.planningDraft?.startTime || "09:00");
  const [endTime, setEndTime] = useState(item.planningDraft?.endTime || "11:00");
  const [team, setTeam] = useState(item.planningDraft?.team || teams[0]?.name || "Non affectée");
  const [interventionId, setInterventionId] = useState(item.planningDraft?.interventionId || "none");
  const [planningNote, setPlanningNote] = useState(item.planningDraft?.note || "");
  const nearbyInterventions = interventions.filter((intervention) =>
    proximitySuggestions.some(
      (suggestion) => suggestion.savId === item.id && suggestion.interventionId === intervention.id,
    ),
  );

  const titles = {
    note: "Ajouter une note",
    close: "Clôturer le SAV",
    planning: "Préparer la planification",
  };

  return (
    <div className={styles.workflowModalLayer} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={styles.workflowModal} role="dialog" aria-modal="true" aria-labelledby="workflow-modal-title">
        <header className={styles.workflowModalHeader}>
          <div>
            <p className="eyebrow">{item.reference}</p>
            <h2 id="workflow-modal-title">{titles[action]}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer"><X aria-hidden size={17} /></button>
        </header>
        <div className={styles.workflowModalBody}>
          {action === "note" && (
            <label className={styles.modalField}>
              <span>Note interne</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ajouter un compte-rendu…" autoFocus rows={5} />
            </label>
          )}
          {action === "close" && (
            <>
              <div className={styles.closeConfirmNotice}><CheckCircle2 aria-hidden size={18} /><p>La clôture est indépendante de la planification d’une intervention.</p></div>
              <label className={styles.modalField}>
                <span>Motif de résolution</span>
                <select value={closureReason} onChange={(event) => setClosureReason(event.target.value)}>
                  {['Résolu par téléphone', 'Résolu sur place', 'Annulé', 'Doublon', 'Autre'].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className={styles.modalField}>
                <span>Note de résolution <small>(optionnelle)</small></span>
                <textarea value={closureNote} onChange={(event) => setClosureNote(event.target.value)} placeholder="Préciser la résolution…" rows={4} />
              </label>
            </>
          )}
          {action === "planning" && (
            <div className={styles.planningFormGrid}>
              <label className={styles.modalField}><span>Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
              <label className={styles.modalField}><span>Équipe</span><select value={team} onChange={(event) => setTeam(event.target.value)}>{teams.length ? teams.map((option) => <option key={option.id} value={option.name}>{option.name}</option>) : <option value="Non affectée">Non affectée</option>}</select></label>
              <label className={styles.modalField}><span>Début</span><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
              <label className={styles.modalField}><span>Fin</span><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
              <label className={`${styles.modalField} ${styles.modalFieldWide}`}><span>Intervention Dolibarr proche <small>(optionnelle)</small></span><select value={interventionId} onChange={(event) => setInterventionId(event.target.value)}><option value="none">Aucune intervention associée</option>{nearbyInterventions.length ? nearbyInterventions.map((intervention) => <option key={intervention.id} value={intervention.id}>{intervention.reference} · {intervention.company}</option>) : <option disabled>Pas d’intervention proche détectée</option>}</select></label>
              <label className={`${styles.modalField} ${styles.modalFieldWide}`}><span>Note de planification <small>(optionnelle)</small></span><textarea value={planningNote} onChange={(event) => setPlanningNote(event.target.value)} placeholder="Contrainte d’accès, matériel à prévoir…" rows={3} /></label>
            </div>
          )}
        </div>
        <footer className={styles.workflowModalFooter}>
          <button type="button" className="button button-ghost" onClick={onClose}>Annuler</button>
          {action === "note" && <button type="button" className="button button-primary" disabled={!note.trim()} onClick={() => onAddNote(note.trim())}>Ajouter la note</button>}
          {action === "close" && <button type="button" className="button button-primary" onClick={() => onCloseSav(closureReason, closureNote.trim())}>Confirmer la clôture</button>}
          {action === "planning" && <button type="button" className="button button-primary" onClick={() => onPrepare({ date, startTime, endTime, team, interventionId, note: planningNote.trim() })}>Enregistrer la préparation</button>}
        </footer>
      </section>
    </div>
  );
}

function NewSavModal({
  companies,
  initialDraft,
  eyebrow = "Dashboard SAV",
  heading = "Nouveau SAV",
  submitLabel = "Créer le SAV",
  onClose,
  onSubmit,
}: {
  companies: string[];
  initialDraft?: NewSavDraft;
  eyebrow?: string;
  heading?: string;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (draft: NewSavDraft) => void;
}) {
  const [draft, setDraft] = useState<NewSavDraft>(
    initialDraft ?? {
      title: "",
      company: "",
      contact: "",
      phone: "",
      address: "",
      priority: "Normale",
      equipment: "",
      description: "",
    },
  );
  const [dolibarrEventId, setDolibarrEventId] = useState("");
  const [fetchingDolibarrEvent, setFetchingDolibarrEvent] = useState(false);
  const [dolibarrEventError, setDolibarrEventError] = useState("");
  const set = (field: keyof NewSavDraft, value: string) => setDraft((current) => ({ ...current, [field]: value }));
  const canSubmit = draft.title.trim() && draft.company.trim() && draft.contact.trim();

  const fetchDolibarrEvent = async () => {
    if (!dolibarrEventId.trim()) return;
    setFetchingDolibarrEvent(true);
    setDolibarrEventError("");
    try {
      const response = await fetch(`/api/dolibarr/events/${encodeURIComponent(dolibarrEventId.trim())}`);
      const result = await response.json();
      if (!response.ok) {
        setDolibarrEventError(result.error || "Impossible de récupérer l'événement.");
        return;
      }
      setDraft((current) => ({
        ...current,
        contact: result.client || current.contact,
        company: result.company || current.company,
        address: result.address || current.address,
      }));
    } catch {
      setDolibarrEventError("Impossible de récupérer l'événement.");
    } finally {
      setFetchingDolibarrEvent(false);
    }
  };

  return (
    <div className={styles.workflowModalLayer} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={styles.workflowModal} role="dialog" aria-modal="true" aria-labelledby="new-sav-title">
        <header className={styles.workflowModalHeader}>
          <div><p className="eyebrow">{eyebrow}</p><h2 id="new-sav-title">{heading}</h2></div>
          <button type="button" onClick={onClose} aria-label="Fermer"><X aria-hidden size={17} /></button>
        </header>
        <div className={styles.workflowModalBody}>
          <div className={styles.docgenEventRow}>
            <label className={styles.modalField}>
              <span>ID événement Dolibarr <small>(facultatif)</small></span>
              <input
                type="text"
                value={dolibarrEventId}
                onChange={(event) => setDolibarrEventId(event.target.value)}
                placeholder="Ex : 4821"
              />
            </label>
            <button
              type="button"
              className="button button-ghost"
              onClick={fetchDolibarrEvent}
              disabled={fetchingDolibarrEvent || !dolibarrEventId.trim()}
            >
              <Search aria-hidden size={15} /> {fetchingDolibarrEvent ? "Récupération…" : "Récupérer"}
            </button>
          </div>
          {dolibarrEventError && <p className={styles.formHint}>{dolibarrEventError}</p>}
          <div className={styles.planningFormGrid}>
            <label className={styles.modalField}><span>Demande</span><input value={draft.title} onChange={(event) => set("title", event.target.value)} placeholder="Ex. Défaut de chauffage" autoFocus /></label>
            <label className={`${styles.modalField} ${styles.modalFieldWide}`}><span>Société cliente</span><input list="sav-company-options" value={draft.company} onChange={(event) => set("company", event.target.value)} placeholder="Rechercher ou sélectionner une société…" />{companies.length ? <datalist id="sav-company-options">{companies.map((company) => <option key={company} value={company} />)}</datalist> : <small className={styles.formHint}>Aucune société trouvée dans les fiches chantier.</small>}</label>
            <label className={styles.modalField}><span>Contact</span><input value={draft.contact} onChange={(event) => set("contact", event.target.value)} placeholder="Nom du contact" /></label>
            <label className={styles.modalField}><span>Téléphone</span><input value={draft.phone} onChange={(event) => set("phone", event.target.value)} placeholder="06 …" /></label>
            <label className={styles.modalField}><span>Priorité</span><select value={draft.priority} onChange={(event) => set("priority", event.target.value)}>{priorityOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label className={`${styles.modalField} ${styles.modalFieldWide}`}><span>Adresse</span><input value={draft.address} onChange={(event) => set("address", event.target.value)} placeholder="Adresse d’intervention" /></label>
            <label className={styles.modalField}><span>Équipement</span><input value={draft.equipment} onChange={(event) => set("equipment", event.target.value)} placeholder="PAC, chaudière…" /></label>
            <label className={`${styles.modalField} ${styles.modalFieldWide}`}><span>Description</span><textarea value={draft.description} onChange={(event) => set("description", event.target.value)} placeholder="Décrire la demande…" rows={3} /></label>
          </div>
        </div>
        <footer className={styles.workflowModalFooter}><button type="button" className="button button-ghost" onClick={onClose}>Annuler</button><button type="button" className="button button-primary" disabled={!canSubmit} onClick={() => onSubmit(draft)}>{submitLabel}</button></footer>
      </section>
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
  const tone = status === "Clôturé" ? styles.statusSuccess : styles.statusInfo;
  return <span className={`${styles.statusBadge} ${tone}`}>{status}</span>;
}

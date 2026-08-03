"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ClipboardList,
  Clock,
  Cpu,
  FileCode2,
  FileText,
  Layers,
  Package,
  Search,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const RECENT_KEY = "commandPaletteRecent";
const RECENT_LIMIT = 8;

type SearchResult = { id: string; label: string; sub?: string; href: string };
type SearchGroup = { key: string; label: string; icon: LucideIcon; results: SearchResult[] };
type RecentEntry = SearchResult & { groupLabel: string };

type SearchResponse = {
  worksheets: { id: string; client: string; company: string; workDate: string | null }[];
  documents: { id: string; clientLabel: string; eventId: string }[];
  templates: { id: string; name: string }[];
  issuers: { id: string; name: string }[];
  materials: { id: string; name: string }[];
  combinations: { id: string; name: string }[];
  equipment: { id: string; name: string; manufacturer: { name: string } }[];
  technicalDocuments: { id: string; title: string }[];
  sav: { id: string; reference: string; title: string; company: string }[];
};

const CATEGORY_META: Record<string, { label: string; icon: LucideIcon }> = {
  worksheets: { label: "Fiches chantier", icon: ClipboardList },
  documents: { label: "Documents générés", icon: FileText },
  templates: { label: "Modèles de documents", icon: FileCode2 },
  issuers: { label: "Sociétés émettrices", icon: Building2 },
  materials: { label: "Catalogue matériel", icon: Package },
  combinations: { label: "Combinaisons PAC", icon: Layers },
  equipment: { label: "Équipements techniques", icon: Cpu },
  technicalDocuments: { label: "Documents techniques", icon: FileText },
  sav: { label: "SAV", icon: Wrench },
};

function buildGroups(data: SearchResponse): SearchGroup[] {
  const raw: Record<string, SearchResult[]> = {
    worksheets: data.worksheets.map((w) => ({
      id: w.id,
      label: w.client,
      sub: w.company,
      href: `/fiches/${w.id}`,
    })),
    documents: data.documents.map((d) => ({
      id: d.id,
      label: d.clientLabel || "(sans nom)",
      sub: d.eventId ? `Événement ${d.eventId}` : undefined,
      href: `/documents?q=${encodeURIComponent(d.clientLabel)}`,
    })),
    templates: data.templates.map((t) => ({
      id: t.id,
      label: t.name,
      href: `/documents/templates/${t.id}`,
    })),
    issuers: data.issuers.map((i) => ({
      id: i.id,
      label: i.name,
      href: `/settings?tab=issuers`,
    })),
    materials: data.materials.map((m) => ({
      id: m.id,
      label: m.name,
      href: `/catalog`,
    })),
    combinations: data.combinations.map((c) => ({
      id: c.id,
      label: c.name,
      href: `/pac/technical/combinations/${c.id}`,
    })),
    equipment: data.equipment.map((e) => ({
      id: e.id,
      label: e.name,
      sub: e.manufacturer.name,
      href: `/pac/technical/equipment/${e.id}`,
    })),
    technicalDocuments: data.technicalDocuments.map((d) => ({
      id: d.id,
      label: d.title,
      href: `/pac/technical/documents/${d.id}`,
    })),
    sav: data.sav.map((s) => ({
      id: s.id,
      label: s.title,
      sub: `${s.reference} · ${s.company}`,
      href: `/planification-sav/${s.id}`,
    })),
  };
  return Object.entries(raw)
    .filter(([, results]) => results.length > 0)
    .map(([key, results]) => ({ key, label: CATEGORY_META[key].label, icon: CATEGORY_META[key].icon, results }));
}

function loadRecent(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentEntry[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(entry: RecentEntry) {
  if (typeof window === "undefined") return;
  const deduped = loadRecent().filter((r) => r.href !== entry.href);
  const next = [entry, ...deduped].slice(0, RECENT_LIMIT);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors (e.g. private browsing quota)
  }
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [recent] = useState<RecentEntry[]>(() => loadRecent());
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);

  const showingRecent = query.trim().length < 2;
  const flatResults = useMemo(
    () => (showingRecent ? recent : groups.flatMap((g) => g.results)),
    [showingRecent, recent, groups],
  );

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const requestId = ++requestIdRef.current;
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) return;
        const data: SearchResponse = await res.json();
        if (requestIdRef.current !== requestId) return;
        setGroups(buildGroups(data));
        setActiveIndex(0);
      } catch {
        // ignore transient fetch errors
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const target = flatResults[activeIndex];
        if (target) go(target, showingRecent ? "Récent" : groups.find((g) => g.results.includes(target))!.label);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, flatResults, activeIndex, showingRecent, groups]);

  function go(result: SearchResult, groupLabel: string) {
    if (groupLabel !== "Récent") saveRecent({ ...result, groupLabel });
    router.push(result.href);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="command-palette-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="Recherche globale">
        <div className="command-palette-input">
          <Search aria-hidden size={17} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              if (value.trim().length < 2) setGroups([]);
            }}
            placeholder="Rechercher une fiche, un document, un équipement..."
            aria-label="Recherche globale"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-palette-results">
          {showingRecent && recent.length === 0 && (
            <p className="command-palette-hint">Tapez au moins 2 caractères pour lancer la recherche.</p>
          )}
          {showingRecent && recent.length > 0 && (
            <div className="command-palette-group">
              <div className="command-palette-group-label">
                <Clock aria-hidden size={13} />
                Recherches récentes
              </div>
              {recent.map((result) => {
                const index = flatResults.indexOf(result);
                return (
                  <button
                    key={result.href}
                    type="button"
                    className={`command-palette-result${index === activeIndex ? " active" : ""}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => go(result, "Récent")}
                  >
                    <span className="command-palette-result-label">{result.label}</span>
                    <span className="command-palette-result-sub">{result.groupLabel}</span>
                  </button>
                );
              })}
            </div>
          )}
          {!showingRecent && groups.length === 0 && (
            <p className="command-palette-hint">Aucun résultat pour « {query.trim()} ».</p>
          )}
          {!showingRecent &&
            groups.map((group) => {
              const Icon = group.icon;
              return (
                <div className="command-palette-group" key={group.key}>
                  <div className="command-palette-group-label">
                    <Icon aria-hidden size={13} />
                    {group.label}
                  </div>
                  {group.results.map((result) => {
                    const index = flatResults.indexOf(result);
                    return (
                      <button
                        key={result.id}
                        type="button"
                        className={`command-palette-result${index === activeIndex ? " active" : ""}`}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => go(result, group.label)}
                      >
                        <span className="command-palette-result-label">{result.label}</span>
                        {result.sub && <span className="command-palette-result-sub">{result.sub}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

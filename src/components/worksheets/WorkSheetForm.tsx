"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, CheckCircle2, CloudDownload, Save, Send, Trash2 } from "lucide-react";
import type { WorkSheetStatus } from "@/generated/prisma/enums";
import { generateWorkSheetReport } from "@/lib/worksheets/report";
import type {
  CatalogCategory,
  WorkSheetFormData,
  WorkSheetSelection,
  WorkSheetTagOption,
} from "@/lib/worksheets/types";

function initialSelections(catalog: CatalogCategory[], existing?: WorkSheetSelection[]) {
  const saved = new Map((existing || []).map((item) => [item.materialId, item]));
  return catalog.flatMap((category) =>
    category.materials.map((material) =>
      saved.get(material.id) || {
        materialId: material.id,
        selected: false,
        variantId: "",
        quantity: material.defaultQuantity || 1,
        detailValue: 0,
        supplier: "INTERNAL" as const,
        installed: true,
      },
    ),
  );
}

const emptyData: Omit<WorkSheetFormData, "selections"> = {
  workDate: "",
  client: "",
  company: "",
  installer: "",
  eventId: "",
  mainInstallations: "",
  otherMaterials: "",
  reportText: "",
  reportFrozen: false,
  tagIds: [],
};

const directQuantityCategories = new Set([
  "cables",
  "isolation",
  "multicouche",
  "raccords",
]);

function lineDifference(source: string[], comparison: string[]) {
  const available = new Map<string, number>();
  comparison.forEach((line) => available.set(line, (available.get(line) || 0) + 1));
  return source.filter((line) => {
    const count = available.get(line) || 0;
    if (count > 0) {
      available.set(line, count - 1);
      return false;
    }
    return true;
  });
}

function syncGeneratedLines(previous: string, edited: string, next: string) {
  if (!edited.trim() || edited === previous) return next;

  const previousLines = previous.split("\n");
  const nextLines = next.split("\n");
  const result = edited.split("\n");

  for (const removedLine of lineDifference(previousLines, nextLines)) {
    const index = result.indexOf(removedLine);
    if (index >= 0) result.splice(index, 1);
  }

  const additions = lineDifference(nextLines, previousLines);
  for (const addedLine of additions) {
    const generatedIndex = nextLines.indexOf(addedLine);
    const previousNeighbour = nextLines
      .slice(0, generatedIndex)
      .reverse()
      .find((line) => result.includes(line));
    const nextNeighbour = nextLines
      .slice(generatedIndex + 1)
      .find((line) => result.includes(line));

    if (nextNeighbour !== undefined) {
      result.splice(result.indexOf(nextNeighbour), 0, addedLine);
    } else if (previousNeighbour !== undefined) {
      result.splice(result.lastIndexOf(previousNeighbour) + 1, 0, addedLine);
    } else {
      result.push(addedLine);
    }
  }

  return result.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

export function WorkSheetForm({
  catalog,
  workSheetId,
  initialData,
  initialDolibarrSentAt,
  tags,
  initialStatus = "DRAFT",
  canDeletePermanently = false,
}: {
  catalog: CatalogCategory[];
  workSheetId?: string;
  initialData?: WorkSheetFormData;
  initialDolibarrSentAt?: string;
  tags: WorkSheetTagOption[];
  initialStatus?: WorkSheetStatus;
  canDeletePermanently?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<WorkSheetFormData>(() => {
    const initial: WorkSheetFormData = {
      ...emptyData,
      ...initialData,
      selections: initialSelections(catalog, initialData?.selections),
      reportFrozen: true,
    };
    return {
      ...initial,
      reportText: initial.reportText || generateWorkSheetReport(initial, catalog),
    };
  });
  const [saving, setSaving] = useState(false);
  const [dolibarrBusy, setDolibarrBusy] = useState<"load" | "send" | "">("");
  const [dolibarrSentAt, setDolibarrSentAt] = useState(initialDolibarrSentAt || "");
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const report = data.reportText;

  const updateData = (patch: Partial<WorkSheetFormData>) => {
    setData((current) => {
      const next = { ...current, ...patch, reportFrozen: true };
      return {
        ...next,
        reportText: syncGeneratedLines(
          generateWorkSheetReport(current, catalog),
          current.reportText,
          generateWorkSheetReport(next, catalog),
        ),
      };
    });
  };

  const updateSelection = (
    materialId: string,
    patch: Partial<WorkSheetSelection>,
  ) => {
    setData((current) => {
      const next = {
        ...current,
        selections: current.selections.map((selection) =>
        selection.materialId === materialId
          ? { ...selection, ...patch }
          : selection,
        ),
      };
      return {
        ...next,
        reportText: syncGeneratedLines(
          generateWorkSheetReport(current, catalog),
          current.reportText,
          generateWorkSheetReport(next, catalog),
        ),
        reportFrozen: true,
      };
    });
  };

  const save = async (redirectAfterCreate = true): Promise<string | null> => {
    setSaving(true);
    setMessage("");
    const payload = { ...data, reportText: report, reportFrozen: true };
    const response = await fetch(
      workSheetId ? `/api/fiches/${workSheetId}` : "/api/fiches",
      {
        method: workSheetId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const result = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessageError(true);
      setMessage(result.error || "Une erreur est survenue.");
      return null;
    }
    setMessageError(false);
    if (!workSheetId && redirectAfterCreate) router.push(`/fiches/${result.id}`);
    else {
      setMessage("Fiche enregistrée.");
      router.refresh();
    }
    return result.id;
  };

  const loadDolibarrEvent = async () => {
    if (!data.eventId.trim()) {
      setMessageError(true);
      setMessage("Indiquez l’ID de l’événement Dolibarr.");
      return;
    }
    setDolibarrBusy("load");
    setMessage("");
    const response = await fetch(
      `/api/dolibarr/events/${encodeURIComponent(data.eventId.trim())}`,
    );
    const result = await response.json();
    setDolibarrBusy("");
    if (!response.ok) {
      setMessageError(true);
      setMessage(result.error || "Impossible de récupérer l’événement.");
      return;
    }
    updateData({
      client: result.label || data.client,
      company: result.company || data.company,
      installer: result.installer || data.installer,
      workDate: result.workDate || data.workDate,
    });
    setMessageError(false);
    setMessage("Données de l’événement Dolibarr récupérées.");
  };

  const sendToDolibarr = async () => {
    setDolibarrBusy("send");
    setMessage("");
    setValidationErrors([]);
    const id = await save(false);
    if (!id) {
      setDolibarrBusy("");
      return;
    }
    const response = await fetch(`/api/fiches/${id}/dolibarr`, { method: "POST" });
    const result = await response.json();
    setDolibarrBusy("");
    setMessageError(!response.ok);
    setMessage(result.message || result.error);
    setValidationErrors(result.errors || []);
    if (response.ok) {
      setDolibarrSentAt(result.sentAt);
      if (!workSheetId) router.push(`/fiches/${id}`);
      else router.refresh();
    }
  };

  const complete = async () => {
    setValidationErrors([]);
    const id = await save(false);
    if (!id) return;
    const response = await fetch(`/api/fiches/${id}/complete`, { method: "POST" });
    const result = await response.json();
    setMessageError(!response.ok);
    setMessage(result.message || result.error);
    setValidationErrors(result.errors || []);
    if (response.ok) {
      if (!workSheetId) router.push(`/fiches/${id}`);
      else router.refresh();
    }
  };

  const archive = async () => {
    if (!workSheetId || !confirm("Archiver cette fiche chantier ?")) return;
    const response = await fetch(`/api/fiches/${workSheetId}`, { method: "DELETE" });
    if (response.ok) router.push("/fiches");
  };

  const deletePermanently = async () => {
    if (!workSheetId) return;
    if (!confirm(
      "Supprimer définitivement cette fiche chantier ? Cette action est irréversible et supprimera également ses matériels et ses tags.",
    )) return;
    const response = await fetch(`/api/fiches/${workSheetId}?permanent=true`, {
      method: "DELETE",
    });
    const result = await response.json();
    if (!response.ok) {
      setMessageError(true);
      setMessage(result.error || "Suppression impossible.");
      return;
    }
    router.push("/fiches");
  };

  return (
    <div className="worksheet-layout">
      <div className="worksheet-main">
        {message && <div className={`alert ${messageError ? "alert-danger" : "alert-success"}`}>{message}</div>}
        <section className="card worksheet-general">
          <div className="worksheet-section-heading">
            <p className="eyebrow">Chantier</p>
            <h2>Informations générales</h2>
          </div>
          <div className="worksheet-grid">
            <label>Société<input value={data.company} onChange={(e) => updateData({ company: e.target.value })} /></label>
            <label>Client<input value={data.client} onChange={(e) => updateData({ client: e.target.value })} /></label>
            <label>Installateur<input value={data.installer} onChange={(e) => updateData({ installer: e.target.value })} /></label>
            <label>Date<input type="date" value={data.workDate} onChange={(e) => updateData({ workDate: e.target.value })} /></label>
          </div>
          <div className="worksheet-event-row">
            <label className="worksheet-event">
              ID événement Dolibarr
              <input value={data.eventId} onChange={(e) => updateData({ eventId: e.target.value })} placeholder="Ex. 12345" />
            </label>
            <button
              className="button button-ghost"
              onClick={loadDolibarrEvent}
              disabled={Boolean(dolibarrBusy) || !data.eventId.trim()}
            >
              <CloudDownload size={16} />
              {dolibarrBusy === "load" ? "Récupération…" : "Récupérer l’événement"}
            </button>
          </div>
          {tags.length > 0 && (
            <div className="worksheet-tag-field">
              <span>Type d’installation</span>
              <div className="worksheet-tag-picker">
                {tags.map((tag) => {
                  const selected = data.tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className={`tag-chip${selected ? " selected" : ""}${tag.active ? "" : " inactive"}`}
                      style={{ "--tag-color": tag.color } as React.CSSProperties}
                      onClick={() => updateData({
                        tagIds: selected
                          ? data.tagIds.filter((id) => id !== tag.id)
                          : [...data.tagIds, tag.id],
                      })}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <div className="worksheet-section-heading">
            <p className="eyebrow">Intervention</p>
            <h2>Installations principales</h2>
          </div>
          <label className="worksheet-textarea">
            Description <small>Une installation par ligne</small>
            <textarea rows={4} value={data.mainInstallations} onChange={(e) => updateData({ mainInstallations: e.target.value })} placeholder={"PAC A/E LG 9kw DUO MONO\nballon ECS intégré"} />
          </label>
        </section>

        <div className="worksheet-categories">
          {[catalog.slice(0, 4), catalog.slice(4)].map((categoryGroup, groupIndex) => (
            <div className="worksheet-category-column" key={groupIndex}>
              <div className="worksheet-column-heading">
                <p className="eyebrow">{groupIndex === 0 ? "Installation" : "Réseaux"}</p>
                <h2>{groupIndex === 0 ? "Équipements et accessoires" : "Liaisons et consommables"}</h2>
              </div>
              {categoryGroup.map((category) => (
            <section className="card worksheet-category" key={category.id}>
              <h2>{category.name}</h2>
              <div className="worksheet-materials">
                {category.materials.map((material) => {
                  const selection = data.selections.find((item) => item.materialId === material.id)!;
                  const isSelect = material.inputType === "SELECT";
                  const isQuantity = material.inputType === "QUANTITY";
                  const isDetail = material.inputType === "DETAIL";
                  const isDirectQuantity =
                    isQuantity && directQuantityCategories.has(category.key);
                  return (
                    <div className={`worksheet-material${selection.selected ? " selected" : ""}`} key={material.id}>
                      <div className="material-primary">
                        {isSelect ? (
                          <label>
                            <span>{material.name}</span>
                            <select
                              value={selection.variantId}
                              onChange={(e) => updateSelection(material.id, { variantId: e.target.value, selected: Boolean(e.target.value) })}
                            >
                              <option value="">—</option>
                              {material.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}
                            </select>
                          </label>
                        ) : isDirectQuantity ? (
                          <label className="direct-quantity-label">
                            <span>{material.name}</span>
                            <input
                              className="quantity-input"
                              type="number"
                              min="0"
                              step="0.1"
                              value={selection.selected ? selection.quantity : ""}
                              placeholder="0"
                              onChange={(e) => {
                                const value = e.target.value;
                                updateSelection(material.id, {
                                  selected: value !== "" && Number(value) > 0,
                                  quantity: value === "" ? 0 : Number(value),
                                });
                              }}
                            />
                          </label>
                        ) : (
                          <label className="check-label">
                            <input type="checkbox" checked={selection.selected} onChange={(e) => updateSelection(material.id, { selected: e.target.checked })} />
                            <span>{material.name}</span>
                          </label>
                        )}
                        {selection.selected && isQuantity && !isDirectQuantity && (
                          <input className="quantity-input" type="number" min="0" step="0.1" value={selection.quantity} onChange={(e) => updateSelection(material.id, { quantity: Number(e.target.value) })} />
                        )}
                        {selection.selected && isDetail && (
                          <input className="detail-input" type="number" min="0" value={selection.detailValue || ""} placeholder={material.detailLabel || "Détail"} onChange={(e) => updateSelection(material.id, { detailValue: Number(e.target.value) })} />
                        )}
                      </div>
                      {selection.selected && (
                        <div className="material-options">
                          {material.allowSupplier && (
                            <label><input type="checkbox" checked={selection.supplier === "COMPANY"} onChange={(e) => updateSelection(material.id, { supplier: e.target.checked ? "COMPANY" : "INTERNAL" })} /> Fourni par la société</label>
                          )}
                          {material.allowNotInstalled && (
                            <label><input type="checkbox" checked={!selection.installed} onChange={(e) => updateSelection(material.id, { installed: !e.target.checked })} /> Non installé</label>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
              ))}
            </div>
          ))}
        </div>

        <section className="card">
          <div className="worksheet-section-heading">
            <p className="eyebrow">Complément</p>
            <h2>Matériels hors catalogue</h2>
          </div>
          <label className="worksheet-textarea">
            Description
            <textarea rows={3} value={data.otherMaterials} onChange={(e) => updateData({ otherMaterials: e.target.value })} />
          </label>
        </section>
      </div>

      <aside className="card worksheet-report">
        <div className="report-heading">
          <div><p className="eyebrow">Aperçu</p><h2>Rapport</h2></div>
          <span className="report-sync-label">Édition et mise à jour automatiques</span>
        </div>
        <textarea
          className="report-editor"
          value={report}
          onChange={(e) => setData({ ...data, reportText: e.target.value })}
        />
        <div className="dolibarr-report-status">
          <span className={dolibarrSentAt ? "sent" : ""}>
            {dolibarrSentAt
              ? `Envoyé à Dolibarr le ${new Date(dolibarrSentAt).toLocaleString("fr-FR")}`
              : "Rapport non envoyé à Dolibarr"}
          </span>
          <button
            className="button button-ghost button-small"
            onClick={sendToDolibarr}
            disabled={saving || Boolean(dolibarrBusy) || !data.eventId.trim()}
          >
            <Send size={15} />
            {dolibarrBusy === "send"
              ? "Envoi…"
              : dolibarrSentAt
                ? "Mettre à jour Dolibarr"
                : "Envoyer à Dolibarr"}
          </button>
        </div>
        <div className="worksheet-actions">
          <button className="button button-primary" onClick={() => void save()} disabled={saving}>
            <Save size={16} /> {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          {initialStatus === "DRAFT" && (
            <button className="button button-success" onClick={complete} disabled={saving}>
              <CheckCircle2 size={16} /> Terminer
            </button>
          )}
          {workSheetId && (
            <button className="button button-danger" onClick={archive}>
              <Archive size={16} /> Archiver
            </button>
          )}
        </div>
        {validationErrors.length > 0 && (
          <ul className="worksheet-validation-errors">
            {validationErrors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        )}
        {workSheetId && canDeletePermanently && (
          <button className="worksheet-delete-permanent" onClick={deletePermanently}>
            <Trash2 size={14} /> Supprimer définitivement cette fiche
          </button>
        )}
      </aside>
    </div>
  );
}

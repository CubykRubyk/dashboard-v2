"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Save } from "lucide-react";
import { generateWorkSheetReport } from "@/lib/worksheets/report";
import type {
  CatalogCategory,
  WorkSheetFormData,
  WorkSheetSelection,
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
};

export function WorkSheetForm({
  catalog,
  workSheetId,
  initialData,
}: {
  catalog: CatalogCategory[];
  workSheetId?: string;
  initialData?: WorkSheetFormData;
}) {
  const router = useRouter();
  const [data, setData] = useState<WorkSheetFormData>({
    ...emptyData,
    ...initialData,
    selections: initialSelections(catalog, initialData?.selections),
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const generatedReport = useMemo(
    () => generateWorkSheetReport(data, catalog),
    [data, catalog],
  );
  const report = data.reportFrozen ? data.reportText : generatedReport;

  const updateSelection = (
    materialId: string,
    patch: Partial<WorkSheetSelection>,
  ) => {
    setData((current) => ({
      ...current,
      selections: current.selections.map((selection) =>
        selection.materialId === materialId
          ? { ...selection, ...patch }
          : selection,
      ),
    }));
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    const payload = { ...data, reportText: report };
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
      setMessage(result.error || "Une erreur est survenue.");
      return;
    }
    if (!workSheetId) router.push(`/fiches/${result.id}`);
    else {
      setMessage("Fiche enregistrée.");
      router.refresh();
    }
  };

  const archive = async () => {
    if (!workSheetId || !confirm("Archiver cette fiche chantier ?")) return;
    const response = await fetch(`/api/fiches/${workSheetId}`, { method: "DELETE" });
    if (response.ok) router.push("/fiches");
  };

  return (
    <div className="worksheet-layout">
      <div className="worksheet-main">
        {message && <div className="alert alert-danger">{message}</div>}
        <section className="card worksheet-general">
          <div className="worksheet-grid">
            <label>Société<input value={data.company} onChange={(e) => setData({ ...data, company: e.target.value })} /></label>
            <label>Client<input value={data.client} onChange={(e) => setData({ ...data, client: e.target.value })} /></label>
            <label>Installateur<input value={data.installer} onChange={(e) => setData({ ...data, installer: e.target.value })} /></label>
            <label>Date<input type="date" value={data.workDate} onChange={(e) => setData({ ...data, workDate: e.target.value })} /></label>
          </div>
          <label className="worksheet-event">ID événement Dolibarr<input value={data.eventId} onChange={(e) => setData({ ...data, eventId: e.target.value })} placeholder="Connexion Dolibarr à venir" /></label>
        </section>

        <section className="card">
          <label className="worksheet-textarea">
            Installations principales <small>Une installation par ligne</small>
            <textarea rows={4} value={data.mainInstallations} onChange={(e) => setData({ ...data, mainInstallations: e.target.value })} placeholder={"PAC A/E LG 9kw DUO MONO\nballon ECS intégré"} />
          </label>
        </section>

        <div className="worksheet-categories">
          {catalog.map((category) => (
            <section className="card worksheet-category" key={category.id}>
              <h2>{category.name}</h2>
              <div className="worksheet-materials">
                {category.materials.map((material) => {
                  const selection = data.selections.find((item) => item.materialId === material.id)!;
                  const isSelect = material.inputType === "SELECT";
                  const isQuantity = material.inputType === "QUANTITY";
                  const isDetail = material.inputType === "DETAIL";
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
                        ) : (
                          <label className="check-label">
                            <input type="checkbox" checked={selection.selected} onChange={(e) => updateSelection(material.id, { selected: e.target.checked })} />
                            <span>{material.name}</span>
                          </label>
                        )}
                        {selection.selected && isQuantity && (
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

        <section className="card">
          <label className="worksheet-textarea">
            Autres matériels
            <textarea rows={3} value={data.otherMaterials} onChange={(e) => setData({ ...data, otherMaterials: e.target.value })} />
          </label>
        </section>
      </div>

      <aside className="card worksheet-report">
        <div className="report-heading">
          <div><p className="eyebrow">Aperçu</p><h2>Rapport</h2></div>
          <label className="freeze-toggle"><input type="checkbox" checked={data.reportFrozen} onChange={(e) => setData({ ...data, reportFrozen: e.target.checked, reportText: e.target.checked ? generatedReport : data.reportText })} /> Éditer manuellement</label>
        </div>
        <textarea
          className="report-editor"
          value={report}
          readOnly={!data.reportFrozen}
          onChange={(e) => setData({ ...data, reportText: e.target.value })}
        />
        <div className="worksheet-actions">
          <button className="button button-primary" onClick={save} disabled={saving}>
            <Save size={16} /> {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          {workSheetId && (
            <button className="button button-danger" onClick={archive}>
              <Archive size={16} /> Archiver
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

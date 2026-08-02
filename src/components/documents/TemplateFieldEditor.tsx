"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Save, Trash2 } from "lucide-react";
import { AUTOFILL_KEY_LABELS, DEFAULT_SECTION, type AutofillKey, type TemplateFieldConfig } from "@/lib/documents/types";

const AUTOFILL_OPTIONS = Object.entries(AUTOFILL_KEY_LABELS) as [AutofillKey, string][];

export function TemplateFieldEditor({
  templateId,
  initialName,
  initialActive,
  initialFields,
}: {
  templateId: string;
  initialName: string;
  initialActive: boolean;
  initialFields: TemplateFieldConfig[];
}) {
  const [name, setName] = useState(initialName);
  const [active, setActive] = useState(initialActive);
  const [fields, setFields] = useState(
    [...initialFields].sort((a, b) => a.position - b.position),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const router = useRouter();

  const sections = useMemo(() => {
    const set = new Set(fields.map((field) => field.section || DEFAULT_SECTION));
    set.add(DEFAULT_SECTION);
    return Array.from(set);
  }, [fields]);

  const updateField = (index: number, patch: Partial<TemplateFieldConfig>) => {
    setFields((current) => current.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  };

  const moveField = (index: number, direction: -1 | 1) => {
    setFields((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((field, i) => ({ ...field, position: i }));
    });
  };

  const save = async () => {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/documents/templates/${templateId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        active,
        fields: fields.map((field, index) => ({ ...field, position: index })),
      }),
    });
    const result = await response.json();
    setBusy(false);
    setError(!response.ok);
    setMessage(response.ok ? "Modifications enregistrées." : result.error || "Une erreur est survenue.");
  };

  const remove = async () => {
    if (!window.confirm("Supprimer définitivement ce modèle ?")) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/documents/templates/${templateId}`, { method: "DELETE" });
    if (response.ok) {
      router.push("/documents/templates");
      return;
    }
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    setError(true);
    setMessage(result.error || "Une erreur est survenue.");
  };

  return (
    <div className="docgen-editor-layout">
      <div className="docgen-editor-preview">
        <iframe title="Aperçu du modèle PDF" src={`/api/documents/templates/${templateId}/file`} />
      </div>
      <div className="docgen-editor-panel">
        <div className="settings-form">
          <label>
            Nom du modèle
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="docgen-active-toggle">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Modèle actif (disponible pour la génération)
          </label>
        </div>

        <div className="docgen-field-rows">
          {fields.map((field, index) => (
            <div className="docgen-field-row" key={field.name}>
              <div className="docgen-field-reorder">
                <button
                  type="button"
                  className="button button-ghost button-small"
                  onClick={() => moveField(index, -1)}
                  disabled={index === 0}
                  aria-label="Monter"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className="button button-ghost button-small"
                  onClick={() => moveField(index, 1)}
                  disabled={index === fields.length - 1}
                  aria-label="Descendre"
                >
                  <ArrowDown size={14} />
                </button>
              </div>
              <div className="docgen-field-main">
                <small className="docgen-field-technical-name">
                  {field.name} · {field.type === "checkbox" ? "case à cocher" : "texte"}
                </small>
                <label>
                  Libellé affiché
                  <input
                    type="text"
                    value={field.label}
                    onChange={(event) => updateField(index, { label: event.target.value })}
                  />
                </label>
                <div className="docgen-field-selects">
                  <label>
                    Section
                    <input
                      type="text"
                      list="docgen-sections"
                      value={field.section}
                      onChange={(event) => updateField(index, { section: event.target.value || DEFAULT_SECTION })}
                    />
                  </label>
                  <label>
                    Correspond à
                    <select
                      value={field.autofillKey ?? ""}
                      onChange={(event) => updateField(index, {
                        autofillKey: (event.target.value || undefined) as AutofillKey | undefined,
                      })}
                    >
                      <option value="">— Manuel —</option>
                      {AUTOFILL_OPTIONS.map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <label className="docgen-field-enabled">
                <input
                  type="checkbox"
                  checked={field.enabled}
                  onChange={(event) => updateField(index, { enabled: event.target.checked })}
                />
                Actif
              </label>
            </div>
          ))}
        </div>
        <datalist id="docgen-sections">
          {sections.map((section) => <option key={section} value={section} />)}
        </datalist>

        <div className="settings-actions">
          <button className="button button-primary" onClick={save} disabled={busy}>
            <Save size={16} /> {busy ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
          <button className="button button-danger" onClick={remove} disabled={busy} type="button">
            <Trash2 size={16} /> Supprimer le modèle
          </button>
        </div>
        {message && <div className={`alert ${error ? "alert-danger" : "alert-success"}`}>{message}</div>}
      </div>
    </div>
  );
}

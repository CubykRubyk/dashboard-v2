"use client";

import { useMemo, useState } from "react";
import { FileDown, Search } from "lucide-react";
import { DEFAULT_SECTION, IMAGE_AUTOFILL_KEYS, type TemplateFieldConfig } from "@/lib/documents/types";
import { buildAutoFilledFields, type AutofillEventInfo, type AutofillIssuerInfo } from "@/lib/documents/autofill";

interface IssuerInfo extends AutofillIssuerInfo {
  id: string;
  name: string;
  signatureData: string;
}

interface TemplateInfo {
  id: string;
  name: string;
  fields: TemplateFieldConfig[];
}

const EMPTY_EVENT: AutofillEventInfo = { client: "", company: "", address: "", installer: "", workDate: "" };

export function GenerateDocumentForm({
  templates,
  issuers,
}: {
  templates: TemplateInfo[];
  issuers: IssuerInfo[];
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [issuerId, setIssuerId] = useState(issuers[0]?.id ?? "");
  const [eventId, setEventId] = useState("");
  const [event, setEvent] = useState<AutofillEventInfo>(EMPTY_EVENT);
  const [fetchingEvent, setFetchingEvent] = useState(false);
  const [eventError, setEventError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const template = templates.find((item) => item.id === templateId) ?? null;
  const issuer = issuers.find((item) => item.id === issuerId) ?? null;

  const enabledFields = useMemo(
    () => (template?.fields ?? []).filter((field) => field.enabled).sort((a, b) => a.position - b.position),
    [template],
  );

  const [values, setValues] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const applyAutofill = (nextTemplate: TemplateInfo | null, nextEvent: AutofillEventInfo, nextIssuer: IssuerInfo | null) => {
    setValues(buildAutoFilledFields(nextEvent, nextIssuer, nextTemplate?.fields ?? []));
  };

  const fetchEvent = async () => {
    if (!eventId.trim()) return;
    setFetchingEvent(true);
    setEventError("");
    const response = await fetch(`/api/dolibarr/events/${encodeURIComponent(eventId.trim())}`);
    const result = await response.json();
    setFetchingEvent(false);
    if (!response.ok) {
      setEventError(result.error || "Impossible de récupérer l'événement.");
      return;
    }
    const nextEvent: AutofillEventInfo = {
      client: result.client || "",
      company: result.company || "",
      address: result.address || "",
      installer: result.installer || "",
      workDate: result.workDate || "",
    };
    setEvent(nextEvent);
    applyAutofill(template, nextEvent, issuer);
  };

  const selectTemplate = (id: string) => {
    setTemplateId(id);
    setChecked(new Set());
    applyAutofill(templates.find((item) => item.id === id) ?? null, event, issuer);
  };
  const selectIssuer = (id: string) => {
    setIssuerId(id);
    applyAutofill(template, event, issuers.find((item) => item.id === id) ?? null);
  };

  const sections = useMemo(() => {
    const map = new Map<string, TemplateFieldConfig[]>();
    for (const field of enabledFields) {
      if (field.autofillKey && IMAGE_AUTOFILL_KEYS.has(field.autofillKey)) continue;
      const section = field.section || DEFAULT_SECTION;
      map.set(section, [...(map.get(section) ?? []), field]);
    }
    return Array.from(map.entries());
  }, [enabledFields]);

  const generate = async () => {
    if (!template) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/documents/generated", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: eventId.trim(),
        clientLabel: event.client,
        templateId: template.id,
        issuerId: issuer?.id,
        dynamicFields: values,
        enabledFields: Array.from(checked),
      }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setError(result.error || "Une erreur est survenue.");
      setBusy(false);
      return;
    }
    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = /filename\*?=(?:UTF-8''|")?([^";]+)"?/.exec(disposition);
    const fileName = match ? decodeURIComponent(match[1]) : "document.pdf";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    setBusy(false);
  };

  if (templates.length === 0) {
    return <p className="docgen-empty">Aucun modèle actif n&apos;est disponible. Créez-en un dans les modèles de documents.</p>;
  }

  return (
    <div className="docgen-generate-form">
      <div className="card docgen-generate-section">
        <h2>Événement Dolibarr</h2>
        <div className="docgen-event-row">
          <label>
            ID événement (facultatif)
            <input
              type="text"
              value={eventId}
              onChange={(event_) => setEventId(event_.target.value)}
              placeholder="Ex : 4821"
            />
          </label>
          <button
            className="button button-ghost"
            type="button"
            onClick={fetchEvent}
            disabled={fetchingEvent || !eventId.trim()}
          >
            <Search size={16} /> {fetchingEvent ? "Récupération…" : "Récupérer"}
          </button>
        </div>
        {eventError && <div className="alert alert-danger">{eventError}</div>}
        {(event.client || event.company || event.address || event.installer || event.workDate) && (
          <p className="docgen-event-summary">
            {event.client}
            {event.company && event.company !== event.client ? ` (${event.company})` : ""}
            {event.address ? ` · ${event.address}` : ""}
            {event.installer ? ` · ${event.installer}` : ""}
            {event.workDate ? ` · ${event.workDate}` : ""}
          </p>
        )}
      </div>

      <div className="docgen-generate-header">
        <label>
          Modèle
          <select value={templateId} onChange={(event_) => selectTemplate(event_.target.value)}>
            {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>
          Émetteur
          <select value={issuerId} onChange={(event_) => selectIssuer(event_.target.value)}>
            <option value="">— Aucun —</option>
            {issuers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </div>

      {sections.map(([section, fields]) => (
        <div className="card docgen-generate-section" key={section}>
          <h2>{section}</h2>
          <div className="docgen-generate-fields">
            {fields.map((field) => (
              field.type === "checkbox" ? (
                <label key={field.name} className="docgen-checkbox-field">
                  <input
                    type="checkbox"
                    checked={checked.has(field.name)}
                    onChange={(event_) => {
                      setChecked((current) => {
                        const next = new Set(current);
                        if (event_.target.checked) next.add(field.name); else next.delete(field.name);
                        return next;
                      });
                    }}
                  />
                  {field.label}
                </label>
              ) : (
                <label key={field.name}>
                  {field.label}
                  <input
                    type="text"
                    value={values[field.name] ?? ""}
                    onChange={(event_) => setValues((current) => ({ ...current, [field.name]: event_.target.value }))}
                  />
                </label>
              )
            ))}
          </div>
        </div>
      ))}

      <div className="settings-actions">
        <button className="button button-success" onClick={generate} disabled={busy || !template}>
          <FileDown size={16} /> {busy ? "Génération…" : "Générer le document"}
        </button>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
    </div>
  );
}

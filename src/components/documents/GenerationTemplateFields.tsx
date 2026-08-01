"use client";

import { useMemo, useState } from "react";

type Field = { name?: string; type?: string };
type Template = { id: string; name: string; fields: Field[] };

export function GenerationTemplateFields({ templates }: { templates: Template[] }) {
  const [templateId, setTemplateId] = useState("");
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const fields = useMemo(() => templates.find((template) => template.id === templateId)?.fields || [], [templateId, templates]);
  const update = (name: string, value: string | boolean) => setValues((current) => ({ ...current, [name]: value }));
  return <div className="generation-template-fields"><input type="hidden" name="templateId" value={templateId} /><label>Template PDF<select value={templateId} onChange={(event) => { setTemplateId(event.target.value); setValues({}); }} required><option value="" disabled>Choisir un template</option>{templates.map((template) => <option value={template.id} key={template.id}>{template.name}</option>)}</select></label>{fields.length > 0 && <div className="generation-acroform-grid">{fields.map((field, index) => { const name = field.name || `field_${index}`; const checkbox = /checkbox|radio/i.test(field.type || ""); return <label className={checkbox ? "generation-checkbox" : ""} key={`${name}-${index}`}>{checkbox ? <><input type="checkbox" checked={values[name] === true} onChange={(event) => update(name, event.target.checked)} /><span>{name}</span></> : <><span>{name}</span><input value={typeof values[name] === "string" ? values[name] : ""} onChange={(event) => update(name, event.target.value)} placeholder={`Valeur pour ${name}`} /></>}</label>; })}</div>}{templateId && fields.length === 0 && <p className="muted">Ce template ne contient pas de champs remplissables.</p>}<input type="hidden" name="manualFields" value={JSON.stringify(values)} /></div>;
}

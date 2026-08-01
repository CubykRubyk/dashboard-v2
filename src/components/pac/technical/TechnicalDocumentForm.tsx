"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  FileText,
  Link2,
  Tag,
  Upload,
} from "lucide-react";
import type { TechnicalDocumentType } from "@/generated/prisma/enums";
import type { ActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";
import {
  type DocumentCombinationOption,
  type DocumentEquipmentOption,
  DocumentAssociationSelector,
} from "@/components/pac/technical/DocumentAssociationSelector";
import { technicalDocumentTypeLabels } from "@/lib/hvac/labels";

export interface TechnicalDocumentFormValues {
  title: string;
  type: TechnicalDocumentType;
  version: string;
  documentDate: string;
  isPrimary: boolean;
  active: boolean;
  equipmentIds: string[];
  systemCombinationIds: string[];
}

function SectionHeading({
  icon: Icon,
  eyebrow,
  title,
}: {
  icon: React.ComponentType<{ size?: number }>;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="pac-form-heading technical-form-heading">
      <span><Icon size={18} /></span>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

export function TechnicalDocumentForm({
  action,
  equipment,
  combinations,
  document,
  submitLabel,
  readOnly = false,
  includeFile = false,
  initialEquipmentIds = [],
  initialCombinationIds = [],
}: {
  action: (
    previousState: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  equipment: DocumentEquipmentOption[];
  combinations: DocumentCombinationOption[];
  document?: TechnicalDocumentFormValues;
  submitLabel: string;
  readOnly?: boolean;
  includeFile?: boolean;
  initialEquipmentIds?: string[];
  initialCombinationIds?: string[];
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );
  const [title, setTitle] = useState(document?.title || "");

  return (
    <form
      action={formAction}
      className="pac-model-form technical-document-form"
    >
      {state.message && (
        <div
          className={`alert ${
            state.status === "success" ? "alert-success" : "alert-danger"
          }`}
          role="status"
        >
          {state.message}
          {state.link && (
            <Link className="alert-inline-link" href={state.link.href}>
              {state.link.label}
            </Link>
          )}
        </div>
      )}

      {includeFile && (
        <section className="card pac-form-section">
          <SectionHeading icon={Upload} eyebrow="Fichier" title="Document PDF" />
          <label className="technical-document-file-field">
            Sélectionner le fichier
            <input
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              required
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file && !title) {
                  setTitle(file.name.replace(/\.pdf$/i, ""));
                }
              }}
            />
            <small>PDF uniquement · 25 Mo maximum</small>
          </label>
        </section>
      )}

      <section className="card pac-form-section">
        <SectionHeading icon={Tag} eyebrow="Métadonnées" title="Identification du document" />
        <div className="pac-form-grid technical-form-grid">
          <label className="technical-reference-field">
            Titre
            <input
              name="title"
              required
              maxLength={160}
              value={title}
              disabled={readOnly}
              onChange={(event) => setTitle(event.currentTarget.value)}
            />
          </label>
          <label>
            Type
            <select
              name="type"
              defaultValue={document?.type || "OTHER"}
              disabled={readOnly}
            >
              {Object.entries(technicalDocumentTypeLabels).map(
                ([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Version
            <input
              name="version"
              maxLength={40}
              defaultValue={document?.version}
              placeholder="Ex. 2026.1"
              disabled={readOnly}
            />
          </label>
          <label>
            Date du document
            <input
              name="documentDate"
              type="date"
              defaultValue={document?.documentDate}
              disabled={readOnly}
            />
          </label>
          <label>
            Document principal
            <select
              name="isPrimary"
              defaultValue={String(document?.isPrimary ?? false)}
              disabled={readOnly}
            >
              <option value="false">Non</option>
              <option value="true">Oui</option>
            </select>
          </label>
          <label>
            Statut
            <select
              name="active"
              defaultValue={String(document?.active ?? true)}
              disabled={readOnly}
            >
              <option value="true">Actif</option>
              <option value="false">Inactif</option>
            </select>
          </label>
        </div>
      </section>

      <section className="card pac-form-section">
        <SectionHeading icon={Link2} eyebrow="Associations" title="Équipements et combinaisons" />
        <DocumentAssociationSelector
          equipment={equipment}
          combinations={combinations}
          initialEquipmentIds={
            document?.equipmentIds || initialEquipmentIds
          }
          initialCombinationIds={
            document?.systemCombinationIds || initialCombinationIds
          }
          readOnly={readOnly}
        />
      </section>

      {!readOnly && (
        <div className="pac-form-actions">
          <button className="button button-primary" disabled={pending}>
            <FileText size={16} />
            {pending ? "Enregistrement…" : submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}

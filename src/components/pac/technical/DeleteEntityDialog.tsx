"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Trash2,
  X,
} from "lucide-react";
import {
  useActionState,
  useRef,
  useState,
} from "react";
import type { ActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";

interface DeleteBlocker {
  id: string;
  label: string;
  detail: string;
  href: string;
}

export function DeleteEntityDialog({
  action,
  buttonLabel,
  title,
  entityLabel,
  expectedConfirmation,
  facts,
  blockers = [],
}: {
  action: (
    previousState: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  buttonLabel: string;
  title: string;
  entityLabel: string;
  expectedConfirmation: string;
  facts: string[];
  blockers?: DeleteBlocker[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );
  const blocked = blockers.length > 0;
  const confirmed = confirmation === expectedConfirmation;

  return (
    <>
      <button
        className="button button-danger"
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        <Trash2 size={16} /> {buttonLabel}
      </button>
      <dialog
        className="technical-delete-dialog"
        ref={dialogRef}
        aria-labelledby="technical-delete-title"
      >
        <div className="technical-delete-dialog-heading">
          <span><AlertTriangle size={21} /></span>
          <div>
            <p className="eyebrow">Suppression définitive</p>
            <h2 id="technical-delete-title">{title}</h2>
          </div>
          <button
            type="button"
            className="mini-action"
            aria-label="Fermer"
            onClick={() => dialogRef.current?.close()}
          >
            <X size={16} />
          </button>
        </div>

        <p>
          Vous allez supprimer <strong>{entityLabel}</strong>. Cette opération
          est auditée et ne supprime aucun document technique ni fichier PDF.
        </p>
        <ul className="technical-delete-facts">
          {facts.map((fact) => <li key={fact}>{fact}</li>)}
        </ul>

        {blockers.length > 0 && (
          <div className="alert alert-danger">
            <strong>Suppression bloquée.</strong>
            <p>Supprimez d’abord les combinaisons suivantes :</p>
            <ul className="technical-delete-blockers">
              {blockers.map((blocker) => (
                <li key={blocker.id}>
                  <Link href={blocker.href}>
                    {blocker.label} <small>{blocker.detail}</small>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form action={formAction} className="technical-delete-form">
          {state.message && (
            <div className="alert alert-danger" role="status">
              {state.message}
            </div>
          )}
          <label>
            Pour confirmer, saisissez exactement :
            <code>{expectedConfirmation}</code>
            <input
              name="confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.currentTarget.value)}
              autoComplete="off"
              disabled={blocked || pending}
            />
          </label>
          <div className="technical-delete-actions">
            <button
              className="button button-ghost"
              type="button"
              disabled={pending}
              onClick={() => dialogRef.current?.close()}
            >
              Annuler
            </button>
            <button
              className="button button-danger"
              disabled={blocked || !confirmed || pending}
            >
              <Trash2 size={16} />
              {pending ? "Suppression…" : "Supprimer définitivement"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

"use client";

import { useActionState } from "react";
import { Power, PowerOff } from "lucide-react";
import type { ActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";

export function CatalogStatusToggle({
  action,
  active,
  compact = false,
}: {
  action: (
    previousState: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  active: boolean;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );

  return (
    <form action={formAction} className="technical-status-form">
      {state.status === "error" && (
        <small className="technical-action-error">{state.message}</small>
      )}
      <button
        className={`status-button${active ? " active" : ""}`}
        disabled={pending}
        title={active ? "Désactiver" : "Activer"}
      >
        {active ? <Power size={14} /> : <PowerOff size={14} />}
        {!compact && (active ? "Actif" : "Inactif")}
      </button>
    </form>
  );
}

"use client";

import {
  useActionState,
  useEffect,
  useRef,
} from "react";
import type { ActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";

export function CatalogActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Enregistrement…",
  className,
  resetOnSuccess = false,
}: {
  action: (
    previousState: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.status === "success") {
      formRef.current?.reset();
    }
  }, [resetOnSuccess, state.status]);

  return (
    <form ref={formRef} action={formAction} className={className}>
      {state.message && (
        <div
          className={`alert ${
            state.status === "success" ? "alert-success" : "alert-danger"
          }`}
          role="status"
        >
          {state.message}
        </div>
      )}
      {children}
      <button className="button button-primary" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}

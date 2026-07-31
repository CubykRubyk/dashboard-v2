"use client";

import { useActionState } from "react";
import { LockKeyhole, LogIn, Mail } from "lucide-react";
import { login } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, {});

  return (
    <form action={formAction} className="login-form">
      {state.error && (
        <div className="alert alert-danger" role="alert">
          {state.error}
        </div>
      )}
      <label className="field">
        <span>Adresse e-mail</span>
        <span className="input-shell">
          <Mail aria-hidden size={18} />
          <input
            name="email"
            type="email"
            autoComplete="username"
            defaultValue={state.values?.email}
            placeholder="admin@exemplu.ro"
            required
            autoFocus
          />
        </span>
      </label>
      <label className="field">
        <span>Mot de passe</span>
        <span className="input-shell">
          <LockKeyhole aria-hidden size={18} />
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Mot de passe du compte"
            required
          />
        </span>
      </label>
      <button className="button button-primary button-block" disabled={pending}>
        <LogIn aria-hidden size={18} />
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}

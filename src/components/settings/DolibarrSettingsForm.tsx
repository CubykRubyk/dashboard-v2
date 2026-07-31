"use client";

import { useState } from "react";
import { PlugZap, Save } from "lucide-react";

export function DolibarrSettingsForm({
  initialUrl,
  configured,
}: {
  initialUrl: string;
  configured: boolean;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [apiKey, setApiKey] = useState("");
  const [isConfigured, setConfigured] = useState(configured);
  const [busy, setBusy] = useState<"save" | "test" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const save = async () => {
    setBusy("save");
    setMessage("");
    const response = await fetch("/api/settings/dolibarr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dolibarrUrl: url, dolibarrApiKey: apiKey }),
    });
    const result = await response.json();
    setBusy("");
    setError(!response.ok);
    setMessage(response.ok ? "Paramètres Dolibarr enregistrés." : result.error);
    if (response.ok) {
      setConfigured(true);
      setApiKey("");
    }
  };

  const test = async () => {
    setBusy("test");
    setMessage("");
    const response = await fetch("/api/settings/dolibarr/test", { method: "POST" });
    const result = await response.json();
    setBusy("");
    setError(!response.ok);
    setMessage(result.message || result.error);
  };

  return (
    <div className="settings-form">
      <label>
        URL Dolibarr
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://dolibarr.exemple.fr"
        />
        <small>Adresse de l’instance, sans <code>/api/index.php</code>.</small>
      </label>
      <label>
        Clé API
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={isConfigured ? "Laisser vide pour conserver la clé actuelle" : "Clé API Dolibarr"}
          autoComplete="new-password"
        />
        <small>La clé est chiffrée avant son enregistrement et n’est jamais renvoyée au navigateur.</small>
      </label>
      <div className="settings-actions">
        <button className="button button-primary" onClick={save} disabled={Boolean(busy) || !url.trim()}>
          <Save size={16} /> {busy === "save" ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button className="button button-ghost" onClick={test} disabled={Boolean(busy) || !isConfigured}>
          <PlugZap size={16} /> {busy === "test" ? "Test…" : "Tester la connexion"}
        </button>
        <span className={`connection-state ${isConfigured ? "configured" : ""}`}>
          {isConfigured ? "Configuré" : "Non configuré"}
        </span>
      </div>
      {message && <div className={`alert ${error ? "alert-danger" : "alert-success"}`}>{message}</div>}
    </div>
  );
}

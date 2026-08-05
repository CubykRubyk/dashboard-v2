"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BellRing, KeyRound, Mail, Save, Send, Smartphone, Trash2 } from "lucide-react";

export interface NotificationDevice {
  id: string;
  device: string;
  user: string;
  email: string;
  createdAt: string;
}

export interface NotificationSettingsView {
  push: { configured: boolean; publicKey: string; subject: string };
  email: { configured: boolean; from: string };
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

type Busy = "save" | "generate" | "test-push" | "test-email" | "";

export function NotificationSettingsForm({
  settings,
  devices,
  adminEmail,
}: {
  settings: NotificationSettingsView;
  devices: NotificationDevice[];
  adminEmail: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const [subject, setSubject] = useState(settings.push.subject);
  const [emailFrom, setEmailFrom] = useState(settings.email.from);
  const [resendKey, setResendKey] = useState("");
  const [testEmailTo, setTestEmailTo] = useState(adminEmail);
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);

  const report = (ok: boolean, text: string) => {
    setIsError(!ok);
    setMessage(text);
  };

  const call = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, init).catch(() => null);
    if (!response) return { ok: false, body: { error: "Requête impossible." } };
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, body };
  };

  const save = async () => {
    setBusy("save");
    setMessage("");
    const { ok, body } = await call("/api/settings/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vapidSubject: subject,
        emailFrom,
        // Champ vide = on conserve la clé déjà enregistrée (jamais renvoyée au navigateur).
        ...(resendKey ? { resendApiKey: resendKey } : {}),
      }),
    });
    setBusy("");
    report(ok, ok ? "Paramètres enregistrés." : body.error);
    if (ok) {
      setResendKey("");
      router.refresh();
    }
  };

  const generate = async () => {
    setBusy("generate");
    setMessage("");
    const { ok, body } = await call("/api/settings/notifications/generate-vapid", { method: "POST" });
    setBusy("");
    setConfirmingRegenerate(false);
    report(
      ok,
      ok
        ? `Nouvelles clés générées.${body.devicesDisconnected > 0 ? ` ${body.devicesDisconnected} appareil(s) déconnecté(s) : ils doivent réactiver les notifications.` : ""}`
        : body.error,
    );
    if (ok) router.refresh();
  };

  const testPush = async () => {
    setBusy("test-push");
    setMessage("");
    const { ok, body } = await call("/api/settings/notifications/test-push", { method: "POST" });
    setBusy("");
    report(ok, ok ? body.message : body.error);
  };

  const testEmail = async () => {
    setBusy("test-email");
    setMessage("");
    const { ok, body } = await call("/api/settings/notifications/test-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testEmailTo }),
    });
    setBusy("");
    report(ok, ok ? body.message : body.error);
  };

  const revokeDevice = async (id: string) => {
    const { ok, body } = await call(`/api/settings/notifications/devices?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!ok) {
      report(false, body.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="settings-form">
      {message && (
        <div className={`alert ${isError ? "alert-danger" : "alert-success"}`} role="status">
          {message}
        </div>
      )}

      {/* ------------------------------------------------------------------ Push */}
      <div className="settings-heading">
        <div className="settings-title">
          <span className="settings-icon"><BellRing size={18} /></span>
          <div>
            <h3>Notifications push</h3>
            <p>Alertes sur le téléphone, même application fermée.</p>
          </div>
        </div>
        <span className={`connection-state ${settings.push.configured ? "configured" : ""}`}>
          {settings.push.configured ? "Configuré" : "Non configuré"}
        </span>
      </div>

      <label>
        Clé publique
        <input value={settings.push.publicKey} readOnly placeholder="Aucune clé générée" />
        <small>
          Transmise au navigateur lors de l’abonnement — ce n’est pas un secret. La clé privée,
          elle, n’est jamais affichée.
        </small>
      </label>
      <label>
        Contact de l’expéditeur
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="mailto:contact@2cenergies.fr"
        />
        <small>Adresse que les services de push contactent en cas de problème d’envoi.</small>
      </label>

      <div className="settings-actions">
        <button
          className="button button-ghost"
          disabled={Boolean(busy)}
          onClick={() => setConfirmingRegenerate((open) => !open)}
        >
          <KeyRound size={16} /> {settings.push.configured ? "Générer de nouvelles clés" : "Générer les clés"}
        </button>
        {settings.push.configured && (
          <button className="button button-ghost" disabled={Boolean(busy)} onClick={testPush}>
            <Send size={16} /> {busy === "test-push" ? "Envoi…" : "Envoyer une notification de test"}
          </button>
        )}
      </div>

      {confirmingRegenerate && (
        <div className="alert alert-danger">
          <p>
            <AlertTriangle size={16} /> <strong>Cette action déconnecte tous les appareils.</strong>{" "}
            Les clés push identifient l’expéditeur : en changer invalide les{" "}
            {devices.length} abonnement{devices.length > 1 ? "s" : ""} existant
            {devices.length > 1 ? "s" : ""}. Chaque personne devra réactiver les notifications
            depuis Profil sur son téléphone.
          </p>
          <div className="settings-actions">
            <button className="button button-danger" disabled={Boolean(busy)} onClick={generate}>
              {busy === "generate" ? "Génération…" : "Générer quand même"}
            </button>
            <button className="button button-ghost" onClick={() => setConfirmingRegenerate(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ E-mail */}
      <div className="settings-heading">
        <div className="settings-title">
          <span className="settings-icon"><Mail size={18} /></span>
          <div>
            <h3>E-mails de suivi</h3>
            <p>Accusés de réception et changements de statut envoyés aux clients.</p>
          </div>
        </div>
        <span className={`connection-state ${settings.email.configured ? "configured" : ""}`}>
          {settings.email.configured ? "Configuré" : "Non configuré"}
        </span>
      </div>

      <label>
        Clé API Resend
        <input
          type="password"
          value={resendKey}
          onChange={(event) => setResendKey(event.target.value)}
          placeholder={settings.email.configured ? "Laisser vide pour conserver la clé actuelle" : "re_…"}
          autoComplete="new-password"
        />
        <small>Chiffrée avant enregistrement, jamais renvoyée au navigateur.</small>
      </label>
      <label>
        Adresse d’expédition
        <input
          value={emailFrom}
          onChange={(event) => setEmailFrom(event.target.value)}
          placeholder="SAV 2C Énergies <sav@exemple.fr>"
        />
        <small>Le domaine doit être vérifié chez Resend, sinon l’envoi est refusé.</small>
      </label>

      <div className="settings-actions">
        <button className="button button-primary" disabled={Boolean(busy)} onClick={save}>
          <Save size={16} /> {busy === "save" ? "Enregistrement…" : "Enregistrer"}
        </button>
        {settings.email.configured && (
          <>
            <input
              type="email"
              value={testEmailTo}
              onChange={(event) => setTestEmailTo(event.target.value)}
              placeholder="destinataire@exemple.fr"
              style={{ maxWidth: 260 }}
            />
            <button
              className="button button-ghost"
              disabled={Boolean(busy) || !testEmailTo.trim()}
              onClick={testEmail}
            >
              <Send size={16} /> {busy === "test-email" ? "Envoi…" : "Envoyer un e-mail de test"}
            </button>
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------ Appareils */}
      <div className="settings-heading">
        <div className="settings-title">
          <span className="settings-icon"><Smartphone size={18} /></span>
          <div>
            <h3>Appareils abonnés</h3>
            <p>Téléphones et ordinateurs qui reçoivent les notifications push.</p>
          </div>
        </div>
      </div>

      <div className="technical-table-wrap">
        <table className="technical-table">
          <thead>
            <tr>
              <th>Appareil</th>
              <th>Utilisateur</th>
              <th>Abonné le</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {devices.length === 0 && (
              <tr>
                <td colSpan={4}>
                  Aucun appareil abonné. Sur le téléphone : installez l’application sur l’écran
                  d’accueil, puis Profil → « Activer les notifications ».
                </td>
              </tr>
            )}
            {devices.map((device) => (
              <tr key={device.id}>
                <td>{device.device}</td>
                <td>{device.user}<br /><small>{device.email}</small></td>
                <td>{dateFormatter.format(new Date(device.createdAt))}</td>
                <td>
                  <button className="button button-ghost" onClick={() => revokeDevice(device.id)}>
                    <Trash2 size={16} /> Déconnecter
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import "server-only";

import { getEmailConfig } from "@/lib/settings/runtime-config";

/**
 * Envoi d'e-mail via l'API HTTP de Resend — un simple POST, pas de SDK : le projet n'a aucune
 * dépendance de ce genre et une requête `fetch` suffit ici. La clé et l'expéditeur se règlent
 * depuis Paramètres → Notifications (`lib/settings/runtime-config.ts`).
 *
 * Rien n'est envoyé si la clé n'est pas configurée : l'application reste parfaitement
 * fonctionnelle sans e-mail, on ne fait que journaliser. C'est ce qui permet de développer et de
 * tester le formulaire public sans compte Resend.
 */
const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type EmailResult =
  | { sent: true; id?: string }
  | { sent: false; reason: "not-configured" | "failed"; error?: string };

export async function isEmailConfigured() {
  return (await getEmailConfig()) !== null;
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const config = await getEmailConfig();
  if (!config) {
    console.info(
      `[email] non configuré (Paramètres → Notifications) — message non envoyé à ${message.to} : ${message.subject}`,
    );
    return { sent: false, reason: "not-configured" };
  }
  const { apiKey, from } = config;

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`[email] échec ${response.status} pour ${message.to} : ${detail.slice(0, 300)}`);
      return { sent: false, reason: "failed", error: `${response.status}` };
    }
    const result = (await response.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: result.id };
  } catch (error) {
    console.error("[email] erreur réseau :", error);
    return { sent: false, reason: "failed", error: error instanceof Error ? error.message : "inconnue" };
  }
}

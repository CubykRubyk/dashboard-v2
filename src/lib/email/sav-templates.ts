import type { SavPriority, SavStatus } from "@/generated/prisma/enums";

import type { EmailMessage } from "./send";

/**
 * Gabarits d'e-mails de suivi SAV. HTML écrit à la main plutôt qu'un moteur de templates : deux
 * messages très simples ne justifient pas une dépendance de plus, et l'e-mail impose de toute
 * façon des styles en ligne (les clients de messagerie ignorent les feuilles de style externes).
 */

const BRAND = "2C Énergies";
const ACCENT = "#ff8110";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(title: string, bodyHtml: string) {
  return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f4f6fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2d2a3c">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;padding:28px">
    <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${ACCENT}">${BRAND}</p>
    <h1 style="margin:0 0 18px;font-size:19px;line-height:1.35">${escapeHtml(title)}</h1>
    ${bodyHtml}
    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e6e8ef;font-size:12px;color:#6d7386">
      Cet e-mail est envoyé automatiquement, merci de ne pas y répondre.
    </p>
  </div>
</body></html>`;
}

function detailRow(label: string, value: string) {
  if (!value) return "";
  return `<tr>
    <td style="padding:6px 12px 6px 0;font-size:13px;color:#6d7386;vertical-align:top">${escapeHtml(label)}</td>
    <td style="padding:6px 0;font-size:13px;font-weight:600">${escapeHtml(value)}</td>
  </tr>`;
}

const STATUS_WORDING: Record<string, { title: string; message: string }> = {
  OUVERT: {
    title: "Votre demande est en cours de traitement",
    message: "Votre demande a été prise en compte. Nous revenons vers vous dès qu’une intervention est planifiée.",
  },
  PLANIFIE: {
    title: "Votre intervention est planifiée",
    message: "Une intervention a été planifiée pour votre demande.",
  },
  CLOTURE: {
    title: "Votre demande est résolue",
    message: "Votre demande a été clôturée. Si le problème persiste, répondez-nous en créant une nouvelle demande.",
  },
};

export interface SavEmailTicket {
  reference: string;
  title: string;
  company: string;
  contact: string;
  address: string;
  description: string;
  priority: SavPriority;
  status: SavStatus;
  contactEmail: string;
}

const PRIORITY_LABELS: Record<SavPriority, string> = {
  BASSE: "Basse",
  NORMALE: "Normale",
  HAUTE: "Haute",
  URGENTE: "Urgente",
};

/** Accusé de réception, envoyé juste après la soumission du formulaire public. */
export function savReceivedEmail(ticket: SavEmailTicket, attachmentCount = 0): EmailMessage {
  const details = [
    detailRow("Référence", ticket.reference),
    detailRow("Objet", ticket.title),
    detailRow("Société", ticket.company),
    detailRow("Adresse", ticket.address),
    detailRow("Priorité", PRIORITY_LABELS[ticket.priority]),
    attachmentCount > 0
      ? detailRow("Pièces jointes", `${attachmentCount} fichier${attachmentCount > 1 ? "s" : ""}`)
      : "",
  ].join("");

  const html = layout(
    "Nous avons bien reçu votre demande",
    `<p style="margin:0 0 16px;font-size:14px;line-height:1.6">
       Bonjour ${escapeHtml(ticket.contact)},<br>
       Votre demande d’intervention a bien été enregistrée sous la référence
       <strong>${escapeHtml(ticket.reference)}</strong>. Vous recevrez un e-mail à chaque
       changement de statut.
     </p>
     <table style="border-collapse:collapse;width:100%">${details}</table>`,
  );

  const text = [
    `Bonjour ${ticket.contact},`,
    "",
    `Votre demande d'intervention a bien été enregistrée sous la référence ${ticket.reference}.`,
    "Vous recevrez un e-mail à chaque changement de statut.",
    "",
    `Objet : ${ticket.title}`,
    `Société : ${ticket.company}`,
    ticket.address ? `Adresse : ${ticket.address}` : "",
    `Priorité : ${PRIORITY_LABELS[ticket.priority]}`,
  ].filter(Boolean).join("\n");

  return {
    to: ticket.contactEmail,
    subject: `${ticket.reference} — demande bien reçue`,
    html,
    text,
  };
}

/** Notification de changement de statut (ouvert → planifié → clôturé). */
export function savStatusEmail(
  ticket: SavEmailTicket,
  state: "OUVERT" | "PLANIFIE" | "CLOTURE",
  planningDate?: string,
): EmailMessage {
  const wording = STATUS_WORDING[state] ?? STATUS_WORDING.OUVERT;
  const details = [
    detailRow("Référence", ticket.reference),
    detailRow("Objet", ticket.title),
    planningDate ? detailRow("Date prévue", planningDate) : "",
  ].join("");

  const html = layout(
    wording.title,
    `<p style="margin:0 0 16px;font-size:14px;line-height:1.6">
       Bonjour ${escapeHtml(ticket.contact)},<br>${escapeHtml(wording.message)}
     </p>
     <table style="border-collapse:collapse;width:100%">${details}</table>`,
  );

  const text = [
    `Bonjour ${ticket.contact},`,
    "",
    wording.message,
    "",
    `Référence : ${ticket.reference}`,
    `Objet : ${ticket.title}`,
    planningDate ? `Date prévue : ${planningDate}` : "",
  ].filter(Boolean).join("\n");

  return {
    to: ticket.contactEmail,
    subject: `${ticket.reference} — ${wording.title.toLowerCase()}`,
    html,
    text,
  };
}

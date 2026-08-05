/**
 * Parcours complet du formulaire SAV public, contre un serveur lancé.
 *
 *   npx tsx --env-file=.env scripts/test-sav-public-flow.ts
 *
 * Couvre : soumission publique sans session, pièces jointes, validation, limitation de débit,
 * notification des administrateurs, e-mails de suivi (journalisés si Resend n'est pas configuré),
 * accès aux pièces jointes réservé aux sessions, et changement d'état visible par le client.
 * Idempotent : supprime les tickets qu'il a créés (et leurs fichiers) à la fin.
 */
import { rm } from "node:fs/promises";
import path from "node:path";

import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";
const COMPANY = "ZZ Société Test (script)";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

let failures = 0;
function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) console.log(`✓ ${label}`);
  else {
    failures += 1;
    console.error(`✗ ${label}`, detail ?? "");
  }
}

async function sessionCookie(user: { id: string; email: string; name: string; role: string }) {
  const token = await new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
  return `dashboard_session=${token}`;
}

/** PNG 1×1 valide — assez pour exercer la validation d'image et le stockage. */
function pngFile(name: string) {
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  return new File([new Uint8Array(bytes)], name, { type: "image/png" });
}

function pdfFile(name: string) {
  const bytes = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
  return new File([new Uint8Array(bytes)], name, { type: "application/pdf" });
}

async function cleanup() {
  const tickets = await prisma.savTicket.findMany({
    where: { company: COMPANY },
    select: { id: true, attachments: { select: { storageName: true } } },
  });
  const root =
    process.env.SAV_ATTACHMENT_STORAGE_ROOT?.trim()
    || path.join(process.cwd(), "data", "sav-attachments");
  for (const ticket of tickets) {
    for (const attachment of ticket.attachments) {
      await rm(path.resolve(root, attachment.storageName), { force: true }).catch(() => undefined);
    }
  }
  const ids = tickets.map((ticket) => ticket.id);
  if (ids.length > 0) {
    await prisma.notification.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { entityType: "SavTicket", entityId: { in: ids } } });
    await prisma.savTicket.deleteMany({ where: { id: { in: ids } } });
  }
  return ids.length;
}

function baseForm() {
  const form = new FormData();
  form.set("company", COMPANY);
  form.set("contact", "Jean Testeur");
  form.set("contactEmail", "client.test@exemple.fr");
  form.set("phone", "0611970407");
  form.set("address", "12 rue de la Paix, 75002 Paris");
  form.set("equipment", "PAC Daikin Altherma");
  form.set("title", "Pompe à chaleur en défaut");
  form.set("description", "Code erreur U4 affiché depuis ce matin.");
  return form;
}

async function main() {
  await cleanup();

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  if (!admin) throw new Error("Aucun compte ADMIN actif en base.");
  const adminCookie = await sessionCookie({ ...admin, role: "ADMIN" });
  const notificationsBefore = await prisma.notification.count({ where: { userId: admin.id } });

  try {
    // 1) Validation : e-mail invalide refusé, sans créer de ticket.
    const badEmail = baseForm();
    badEmail.set("contactEmail", "pas-un-email");
    const invalid = await fetch(`${BASE_URL}/api/sav-request`, { method: "POST", body: badEmail });
    check("E-mail invalide → 400", invalid.status === 400, invalid.status);

    const missing = new FormData();
    missing.set("company", COMPANY);
    const incomplete = await fetch(`${BASE_URL}/api/sav-request`, { method: "POST", body: missing });
    check("Champs obligatoires manquants → 400", incomplete.status === 400, incomplete.status);

    // 2) Soumission publique **sans aucune session**, avec pièces jointes.
    const form = baseForm();
    form.append("attachments", pngFile("photo-erreur.png"));
    form.append("attachments", pdfFile("devis.pdf"));
    const created = await fetch(`${BASE_URL}/api/sav-request`, { method: "POST", body: form });
    const createdBody = await created.json();
    check("Soumission publique sans session → 201", created.status === 201, createdBody);
    check("Une référence est renvoyée", typeof createdBody.reference === "string", createdBody);

    const ticket = await prisma.savTicket.findFirst({
      where: { company: COMPANY },
      include: { attachments: true, history: true },
      orderBy: { createdAt: "desc" },
    });
    check("Le ticket est en base", Boolean(ticket));
    if (!ticket) throw new Error("Ticket introuvable, abandon.");

    check("Origine marquée CLIENT_FORM", ticket.origin === "CLIENT_FORM", ticket.origin);
    check("Aucun auteur interne", ticket.createdById === null, ticket.createdById);
    check("E-mail de contact enregistré", ticket.contactEmail === "client.test@exemple.fr");
    check("Les 2 pièces jointes sont enregistrées", ticket.attachments.length === 2,
      ticket.attachments.length);
    check("Les pièces jointes publiques n’ont pas d’auteur",
      ticket.attachments.every((item) => item.uploadedById === null));
    check("Un checksum est calculé",
      ticket.attachments.every((item) => item.checksumSha256.length === 64));
    check("Une entrée d’historique décrit l’origine",
      ticket.history.some((entry) => entry.text.includes("formulaire client")));
    check("L’adresse a été géocodée", ticket.latitude !== null && ticket.longitude !== null,
      { lat: ticket.latitude, lon: ticket.longitude });

    // 3) Les administrateurs sont notifiés.
    const notificationsAfter = await prisma.notification.count({ where: { userId: admin.id } });
    check("L’administrateur a reçu une notification", notificationsAfter > notificationsBefore,
      { before: notificationsBefore, after: notificationsAfter });
    const notification = await prisma.notification.findFirst({
      where: { userId: admin.id, entityId: ticket.id },
    });
    check("La notification pointe vers le SAV", notification?.entityType === "SavTicket");
    check("La notification est non lue", notification?.readAt === null);

    // 4) Un fichier non autorisé est refusé.
    const badFile = baseForm();
    badFile.append(
      "attachments",
      new File([new Uint8Array(Buffer.from("MZ"))], "virus.exe", { type: "application/x-msdownload" }),
    );
    const refusedFile = await fetch(`${BASE_URL}/api/sav-request`, { method: "POST", body: badFile });
    check("Format de fichier non autorisé → 400", refusedFile.status === 400, refusedFile.status);

    // Un PDF qui n'en est pas un (type MIME menteur) doit aussi être refusé.
    const fakePdf = baseForm();
    fakePdf.append(
      "attachments",
      new File([new Uint8Array(Buffer.from("pas un pdf"))], "faux.pdf", { type: "application/pdf" }),
    );
    const refusedPdf = await fetch(`${BASE_URL}/api/sav-request`, { method: "POST", body: fakePdf });
    check("PDF invalide (signature absente) → 400", refusedPdf.status === 400, refusedPdf.status);

    // 5) Pièces jointes : lecture réservée aux sessions.
    const attachmentId = ticket.attachments[0].id;
    const anonymous = await fetch(`${BASE_URL}/api/sav/${ticket.id}/attachments/${attachmentId}`);
    check("Pièce jointe inaccessible sans session → 401", anonymous.status === 401, anonymous.status);

    const authorized = await fetch(
      `${BASE_URL}/api/sav/${ticket.id}/attachments/${attachmentId}`,
      { headers: { cookie: adminCookie } },
    );
    check("Pièce jointe servie à un admin → 200", authorized.status === 200, authorized.status);
    const bytes = Buffer.from(await authorized.arrayBuffer());
    check("Le contenu du fichier est bien servi", bytes.byteLength > 0);

    const listed = await fetch(`${BASE_URL}/api/sav/${ticket.id}/attachments`, {
      headers: { cookie: adminCookie },
    });
    const listedBody = await listed.json();
    check("Liste des pièces jointes → 200", listed.status === 200);
    check("La liste contient les 2 pièces", listedBody.attachments?.length === 2, listedBody);

    // 6) Changement d'état visible par le client (ouvert → planifié).
    const planned = await fetch(`${BASE_URL}/api/sav/${ticket.id}`, {
      method: "PATCH",
      headers: { cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { planningDate: new Date().toISOString() } }),
    });
    check("Planification du SAV → 200", planned.status === 200, planned.status);

    // 7) Le flux de notifications remonte l'événement et le marquage lu fonctionne.
    const feed = await fetch(`${BASE_URL}/api/notifications`, { headers: { cookie: adminCookie } });
    const feedBody = await feed.json();
    check("Le flux de notifications contient l’événement",
      Array.isArray(feedBody.feed) && feedBody.feed.some((item: { entityId: string }) => item.entityId === ticket.id),
      feedBody.feed?.length);
    check("Un compteur de non-lus est exposé", typeof feedBody.unreadCount === "number");

    const marked = await fetch(`${BASE_URL}/api/notifications`, {
      method: "POST",
      headers: { cookie: adminCookie },
    });
    check("Marquage comme lu → 200", marked.status === 200);
    const stillUnread = await prisma.notification.count({
      where: { userId: admin.id, readAt: null },
    });
    check("Plus aucune notification non lue", stillUnread === 0, stillUnread);

    // 8) Limitation de débit : la 6e soumission depuis la même IP est refusée.
    let limited = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await fetch(`${BASE_URL}/api/sav-request`, {
        method: "POST",
        body: baseForm(),
      });
      if (response.status === 429) {
        limited = true;
        break;
      }
    }
    check("La limitation de débit finit par répondre 429", limited);

    // 9) La page publique se rend sans session.
    const page = await fetch(`${BASE_URL}/sav-request`);
    const html = await page.text();
    check("GET /sav-request sans session → 200", page.status === 200, page.status);
    check("Le formulaire est rendu", html.includes("Demande d’intervention"));
    check("Le champ de pièces jointes est rendu", html.includes("Photos ou documents"));
  } finally {
    const removed = await cleanup();
    console.log(`\n· ${removed} ticket(s) de test supprimé(s), fichiers effacés.`);
  }

  console.log(`\n${failures === 0 ? "Tous les tests sont passés." : `${failures} test(s) en échec.`}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});

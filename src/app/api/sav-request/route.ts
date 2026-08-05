import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { DocumentError } from "@/lib/documents/errors";
import { sendEmail } from "@/lib/email/send";
import { savReceivedEmail } from "@/lib/email/sav-templates";
import { geocodeAddress } from "@/lib/geo/geocode";
import { notifyAdmins } from "@/lib/notifications/create";
import { prisma } from "@/lib/prisma";
import {
  MAX_ATTACHMENTS_PER_TICKET,
  removeAttachment,
  writeAttachment,
} from "@/lib/sav/attachment-storage";

// Route **publique** : aucune session. Pas de captcha pour l'instant (choix explicite d'Ion pour
// la phase de test), d'où ce garde-fou minimal en mémoire — il ne survit pas à un redémarrage et
// ne protège pas d'une attaque distribuée, mais suffit à absorber un bot naïf ou un double-clic.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const submissions = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (submissions.get(ip) ?? []).filter((at) => now - at < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    submissions.set(ip, recent);
    return true;
  }
  recent.push(now);
  submissions.set(ip, recent);
  // Purge opportuniste : sans elle, la Map grossit indéfiniment sur un serveur de longue durée.
  if (submissions.size > 5000) {
    for (const [key, times] of submissions) {
      if (times.every((at) => now - at >= RATE_LIMIT_WINDOW_MS)) submissions.delete(key);
    }
  }
  return false;
}

const requestSchema = z.object({
  company: z.string().trim().min(1, "La société est obligatoire.").max(160),
  contact: z.string().trim().min(1, "Le nom du contact est obligatoire.").max(160),
  contactEmail: z.string().trim().toLowerCase().email("L’adresse e-mail n’est pas valide.").max(200),
  phone: z.string().trim().max(40).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
  equipment: z.string().trim().max(200).optional().default(""),
  title: z.string().trim().min(1, "L’objet de la demande est obligatoire.").max(200),
  description: z.string().trim().min(1, "Décrivez le problème rencontré.").max(4000),
});

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "inconnue";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Trop de demandes envoyées. Réessayez dans quelques minutes." },
      { status: 429 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse({
    company: form.get("company") ?? "",
    contact: form.get("contact") ?? "",
    contactEmail: form.get("contactEmail") ?? "",
    phone: form.get("phone") ?? "",
    address: form.get("address") ?? "",
    equipment: form.get("equipment") ?? "",
    title: form.get("title") ?? "",
    description: form.get("description") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides." },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const files = form.getAll("attachments").filter((value): value is File =>
    value instanceof File && value.size > 0);
  if (files.length > MAX_ATTACHMENTS_PER_TICKET) {
    return NextResponse.json(
      { error: `${MAX_ATTACHMENTS_PER_TICKET} fichiers maximum.` },
      { status: 400 },
    );
  }

  // Les fichiers sont écrits sur disque avant la transaction ; en cas d'échec ensuite, ils sont
  // supprimés (même compensation que pour les photos de fiche).
  const stored = [];
  try {
    for (const file of files) stored.push(await writeAttachment(file));
  } catch (error) {
    await Promise.all(stored.map((item) => removeAttachment(item.storageName)));
    if (error instanceof DocumentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const geocoded = data.address ? await geocodeAddress(data.address).catch(() => null) : null;

  try {
    const count = await prisma.savTicket.count();
    let ticket = null;
    for (let attempt = 0; attempt < 5 && !ticket; attempt += 1) {
      const reference = `SAV-${2700 + count + 1 + attempt}`;
      try {
        ticket = await prisma.savTicket.create({
          data: {
            reference,
            title: data.title,
            company: data.company,
            contact: data.contact,
            contactEmail: data.contactEmail,
            phone: data.phone,
            address: data.address,
            equipment: data.equipment,
            description: data.description,
            origin: "CLIENT_FORM",
            // Aucun auteur interne : la demande vient de l'extérieur (colonne rendue optionnelle).
            createdById: null,
            latitude: geocoded?.latitude,
            longitude: geocoded?.longitude,
            history: {
              create: {
                type: "STATUS",
                text: "Demande reçue via le formulaire client",
                detail: data.contactEmail,
              },
            },
            ...(stored.length > 0
              ? {
                  attachments: {
                    create: stored.map((item) => ({
                      storageName: item.storageName,
                      originalFileName: item.originalFileName,
                      mimeType: item.mimeType,
                      sizeBytes: item.sizeBytes,
                      checksumSha256: item.checksumSha256,
                    })),
                  },
                }
              : {}),
          },
        });
      } catch (error) {
        const isUniqueConflict =
          typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
        if (!isUniqueConflict) throw error;
      }
    }
    if (!ticket) {
      throw new Error("Impossible de générer une référence unique.");
    }

    await prisma.auditLog.create({
      data: {
        action: "SAV_TICKET_CREATE_PUBLIC",
        entityType: "SavTicket",
        entityId: ticket.id,
        ipAddress: ip,
        metadata: {
          reference: ticket.reference,
          company: ticket.company,
          attachments: stored.length,
        },
      },
    }).catch(() => undefined);

    // Alerte interne : une demande client peut être urgente, elle ne doit pas attendre que
    // quelqu'un ouvre le tableau de bord par hasard.
    await notifyAdmins({
      type: "SAV_CREATED",
      title: `Nouveau SAV client — ${ticket.company}`,
      body: `${ticket.reference} · ${ticket.title}`,
      entityType: "SavTicket",
      entityId: ticket.id,
    });

    // Accusé de réception : l'échec d'envoi ne remet pas en cause la demande enregistrée.
    await sendEmail(savReceivedEmail(ticket, stored.length)).catch(() => undefined);

    return NextResponse.json({ reference: ticket.reference }, { status: 201 });
  } catch (error) {
    await Promise.all(stored.map((item) => removeAttachment(item.storageName)));
    throw error;
  }
}

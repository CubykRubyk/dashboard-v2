import "server-only";

import { decryptSecret } from "@/lib/dolibarr/crypto";
import { prisma } from "@/lib/prisma";

/**
 * Source unique de la configuration des notifications (push et e-mail).
 *
 * Elle vit **en base**, chiffrée, et non dans l'environnement : Ion doit pouvoir la régler depuis
 * les Paramètres, sans éditer un fichier sur le serveur ni redémarrer l'application. Même principe
 * que la clé API Dolibarr, avec le même chiffrement (`lib/dolibarr/crypto.ts`).
 */

export interface PushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface EmailConfig {
  apiKey: string;
  from: string;
}

interface CachedSettings {
  push: PushConfig | null;
  email: EmailConfig | null;
}

// Cache court : `pushToUser` est appelé en boucle (un SAV notifie tous les administrateurs), une
// requête par destinataire serait du gaspillage. 30 s suffisent, et `invalidateRuntimeConfig()`
// est appelé à l'enregistrement — sans quoi une clé fraîchement saisie semblerait « ne pas
// s'appliquer » pendant une demi-minute, précisément au moment où l'on teste.
const CACHE_TTL_MS = 30_000;
let cache: { value: CachedSettings; expiresAt: number } | null = null;

export function invalidateRuntimeConfig() {
  cache = null;
}

function decodeOrNull(encrypted: string) {
  if (!encrypted) return null;
  try {
    return decryptSecret(encrypted);
  } catch {
    // Une valeur indéchiffrable (AUTH_SECRET changé, base restaurée d'un autre environnement)
    // ne doit pas faire tomber l'application : la fonctionnalité est simplement considérée
    // comme non configurée, ce que l'écran de paramètres montrera.
    console.error("[settings] secret indéchiffrable — vérifiez AUTH_SECRET.");
    return null;
  }
}

async function load(): Promise<CachedSettings> {
  const settings = await prisma.appSettings
    .findUnique({
      where: { id: 1 },
      select: {
        vapidPublicKey: true,
        vapidPrivateKeyEncrypted: true,
        vapidSubject: true,
        resendApiKeyEncrypted: true,
        emailFrom: true,
      },
    })
    .catch(() => null);

  if (!settings) return { push: null, email: null };

  const privateKey = decodeOrNull(settings.vapidPrivateKeyEncrypted);
  const apiKey = decodeOrNull(settings.resendApiKeyEncrypted);

  return {
    // Les deux clés sont nécessaires : une paire incomplète ne permet aucun envoi.
    push:
      settings.vapidPublicKey && privateKey
        ? {
            publicKey: settings.vapidPublicKey,
            privateKey,
            subject: settings.vapidSubject || "mailto:contact@2cenergies.fr",
          }
        : null,
    email: apiKey && settings.emailFrom ? { apiKey, from: settings.emailFrom } : null,
  };
}

async function read(): Promise<CachedSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  const value = await load();
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function getPushConfig() {
  return (await read()).push;
}

export async function getEmailConfig() {
  return (await read()).email;
}

/** Clé publique seule — sert au navigateur pour s'abonner, elle n'est pas secrète. */
export async function getVapidPublicKey() {
  return (await getPushConfig())?.publicKey ?? null;
}

import "server-only";

import { prisma } from "@/lib/prisma";
import { decryptSecret } from "./crypto";

export interface DolibarrConfig {
  baseUrl: string;
  apiKey: string;
}

export function normalizeDolibarrUrl(value: string) {
  const parsed = new URL(value.trim());
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("L’URL Dolibarr n’est pas valide.");
  }
  return parsed.toString().replace(/\/+$/, "");
}

export async function getDolibarrConfig(): Promise<DolibarrConfig | null> {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  if (!settings?.dolibarrUrl || !settings.dolibarrApiKeyEncrypted) return null;
  return {
    baseUrl: normalizeDolibarrUrl(settings.dolibarrUrl),
    apiKey: decryptSecret(settings.dolibarrApiKeyEncrypted),
  };
}

export async function dolibarrRequest<T>(
  config: DolibarrConfig,
  path: string,
  init?: { method?: "GET" | "PUT"; body?: Record<string, unknown> },
): Promise<T> {
  if (!path.startsWith("/") || path.includes("..")) {
    throw new Error("Chemin Dolibarr invalide.");
  }
  const response = await fetch(
    `${config.baseUrl}/api/index.php${path}`,
    {
      method: init?.method || "GET",
      headers: {
        Accept: "application/json",
        DOLAPIKEY: config.apiKey,
        "User-Agent": "Damaschin-CRM/2.0",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    },
  );
  const text = await response.text();
  if (!response.ok) {
    let detail = text.slice(0, 240);
    try {
      const json = JSON.parse(text) as { error?: { message?: string }; message?: string };
      detail = json.error?.message || json.message || detail;
    } catch {}
    throw new Error(`Dolibarr ${response.status}: ${detail || response.statusText}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Dolibarr a renvoyé une réponse invalide.");
  }
}

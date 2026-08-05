import "server-only";

import { prisma } from "@/lib/prisma";

import { dolibarrRequest, type DolibarrConfig } from "./client";
import {
  parseDolibarrCompany,
  parseDolibarrUser,
  type ParsedDolibarrCompany,
  type ParsedDolibarrUser,
} from "./directory-parse";

/**
 * Import du répertoire Dolibarr : utilisateurs et sociétés clientes.
 *
 * **Liste de référence, pas des comptes de connexion** : Dolibarr contient des comptes qui n'ont
 * rien à faire dans le CRM. Elle sert à rattacher un compte existant à son `userownerid` sans le
 * saisir à la main, et à alimenter les sélecteurs d'affectation et de société.
 *
 * Deux `GET` seulement — **aucune écriture côté Dolibarr**.
 */

// Dolibarr plafonne les réponses ; sans pagination, une base de plusieurs centaines de tiers
// serait tronquée en silence, ce qui est pire qu'un échec (on croirait le répertoire complet).
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export interface DirectorySyncResult {
  users: { imported: number; deactivated: number };
  companies: { imported: number; deactivated: number };
}

async function fetchAllPages<T>(config: DolibarrConfig, path: string): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    let batch: T[];
    try {
      batch = await dolibarrRequest<T[]>(
        config,
        `${path}${separator}limit=${PAGE_SIZE}&page=${page}`,
      );
    } catch (error) {
      // Dolibarr répond 404 quand une page dépasse le dernier enregistrement : c'est une fin de
      // liste normale, pas une erreur.
      if (error instanceof Error && error.message.includes("404")) break;
      throw error;
    }
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return all;
}

export async function syncDolibarrDirectory(
  config: DolibarrConfig,
): Promise<DirectorySyncResult> {
  const [rawUsers, rawCompanies] = await Promise.all([
    fetchAllPages<Record<string, unknown>>(config, "/users"),
    fetchAllPages<Record<string, unknown>>(config, "/thirdparties"),
  ]);

  const users = rawUsers
    .map(parseDolibarrUser)
    .filter((user): user is ParsedDolibarrUser => user !== null);
  // `parseDolibarrCompany` écarte les fournisseurs purs : seuls les clients nous intéressent.
  const companies = rawCompanies
    .map(parseDolibarrCompany)
    .filter((company): company is ParsedDolibarrCompany => company !== null);

  for (const user of users) {
    await prisma.dolibarrUser.upsert({
      where: { dolibarrId: user.dolibarrId },
      // `favorite` n'est jamais touché : c'est une donnée du CRM, pas de Dolibarr.
      update: user,
      create: user,
    });
  }
  for (const company of companies) {
    await prisma.dolibarrCompany.upsert({
      where: { dolibarrId: company.dolibarrId },
      update: company,
      create: company,
    });
  }

  // Ce qui n'est plus renvoyé est **désactivé, jamais supprimé** : supprimer effacerait les
  // favoris et casserait l'affichage des interventions passées rattachées à cette société.
  const seenUserIds = users.map((user) => user.dolibarrId);
  const seenCompanyIds = companies.map((company) => company.dolibarrId);

  const [deactivatedUsers, deactivatedCompanies] = await Promise.all([
    prisma.dolibarrUser.updateMany({
      where: { dolibarrId: { notIn: seenUserIds }, active: true },
      data: { active: false },
    }),
    prisma.dolibarrCompany.updateMany({
      where: { dolibarrId: { notIn: seenCompanyIds }, active: true },
      data: { active: false },
    }),
  ]);

  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: { dolibarrDirectorySyncedAt: new Date(), dolibarrDirectoryError: null },
    create: { id: 1, dolibarrDirectorySyncedAt: new Date() },
  });

  return {
    users: { imported: users.length, deactivated: deactivatedUsers.count },
    companies: { imported: companies.length, deactivated: deactivatedCompanies.count },
  };
}

/** Mémorise l'échec pour que l'écran de paramètres puisse l'afficher. */
export async function recordDirectoryError(message: string) {
  await prisma.appSettings
    .upsert({
      where: { id: 1 },
      update: { dolibarrDirectoryError: message.slice(0, 1000) },
      create: { id: 1, dolibarrDirectoryError: message.slice(0, 1000) },
    })
    .catch(() => undefined);
}

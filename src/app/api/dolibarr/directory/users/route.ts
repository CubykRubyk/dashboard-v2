import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { canEditDolibarrIntervention, canManageSav } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const LIMIT = 50;

/**
 * Répertoire des utilisateurs Dolibarr.
 *
 * `favorites=1` renvoie la liste courte utilisée par défaut dans les sélecteurs ; une recherche
 * (`q`) porte au contraire sur **tout** le répertoire — c'est la demande d'Ion : les habitués sous
 * la main, le reste accessible.
 */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || !canManageSav(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 80);
  const favoritesOnly = params.get("favorites") === "1" && !query;
  const employeesOnly = params.get("employees") !== "0";

  const users = await prisma.dolibarrUser.findMany({
    where: {
      active: true,
      ...(employeesOnly ? { isEmployee: true } : {}),
      ...(favoritesOnly ? { favorite: true } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { login: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { job: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    // Favoris d'abord même dans une recherche : ce sont les plus probables.
    orderBy: [{ favorite: "desc" }, { name: "asc" }],
    take: LIMIT,
    select: {
      id: true,
      dolibarrId: true,
      name: true,
      login: true,
      job: true,
      color: true,
      favorite: true,
    },
  });

  // Un utilisateur Dolibarr sans compte CRM ne peut pas être notifié d'une affectation : on le
  // signale plutôt que de laisser croire que l'alerte partira.
  const linked = await prisma.user.findMany({
    where: { dolibarrUserId: { in: users.map((entry) => entry.dolibarrId) } },
    select: { dolibarrUserId: true },
  });
  const linkedIds = new Set(linked.map((entry) => entry.dolibarrUserId));

  return NextResponse.json({
    users: users.map((entry) => ({ ...entry, hasCrmAccount: linkedIds.has(entry.dolibarrId) })),
  });
}

const favoriteSchema = z.object({ favorite: z.boolean() });

/** Bascule le favori (commun à toute la société, décision d'Ion). */
export async function PATCH(request: NextRequest) {
  const user = await getSession();
  if (!canEditDolibarrIntervention(user?.role)) {
    return NextResponse.json({ error: "Droits administrateur requis." }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const parsed = favoriteSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  const updated = await prisma.dolibarrUser.updateMany({
    where: { id },
    data: { favorite: parsed.data.favorite },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

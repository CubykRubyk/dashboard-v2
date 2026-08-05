import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { canEditDolibarrIntervention, canManageSav } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { companyAddressLabel } from "@/lib/dolibarr/directory-parse";
import { prisma } from "@/lib/prisma";

const LIMIT = 50;

/**
 * Répertoire des sociétés clientes importées de Dolibarr.
 *
 * Même principe que les utilisateurs : `favorites=1` pour la liste courte, une recherche porte sur
 * tout le répertoire. La recherche est **locale** — plus d'aller-retour vers Dolibarr à chaque
 * frappe, contrairement à `/api/dolibarr/thirdparties` (conservée comme repli tant que l'import
 * n'a pas été lancé).
 */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || !canManageSav(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 80);
  const favoritesOnly = params.get("favorites") === "1" && !query;

  const companies = await prisma.dolibarrCompany.findMany({
    where: {
      active: true,
      ...(favoritesOnly ? { favorite: true } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { town: { contains: query, mode: "insensitive" } },
              { zip: { contains: query, mode: "insensitive" } },
              { clientCode: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ favorite: "desc" }, { name: "asc" }],
    take: LIMIT,
    select: {
      id: true,
      dolibarrId: true,
      name: true,
      address: true,
      zip: true,
      town: true,
      clientCode: true,
      favorite: true,
    },
  });

  return NextResponse.json({
    companies: companies.map((company) => ({
      ...company,
      addressLabel: companyAddressLabel(company),
    })),
  });
}

const favoriteSchema = z.object({ favorite: z.boolean() });

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

  const updated = await prisma.dolibarrCompany.updateMany({
    where: { id },
    data: { favorite: parsed.data.favorite },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Société introuvable." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

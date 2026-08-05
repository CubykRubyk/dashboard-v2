import { NextRequest, NextResponse } from "next/server";

import { canReadTechnicalDocuments } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { searchLibrary } from "@/lib/mobile/library";

/**
 * Recherche d'équipements du catalogue, pour les sélecteurs (matériel à poser).
 *
 * Réutilise `searchLibrary` — la même recherche que la bibliothèque technique mobile : référence
 * exacte, référence normalisée (espaces et casse ignorés), désignation, fabricant, gamme.
 */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || !canReadTechnicalDocuments(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q") ?? "";
  const results = await searchLibrary(query);

  return NextResponse.json({
    equipment: results.map((item) => ({
      id: item.id,
      name: item.name,
      reference: item.reference,
      manufacturer: item.manufacturer,
      type: item.type,
      documentCount: item.documents.length,
    })),
  });
}

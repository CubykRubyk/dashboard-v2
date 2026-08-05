import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { canEditDolibarrIntervention, canUseMobileApp } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { loadInterventionMaterials } from "@/lib/interventions/materials";
import { prisma } from "@/lib/prisma";

/**
 * Matériel à poser sur une intervention.
 *
 * **Lecture ouverte** à tout compte pouvant consulter l'application (technicien compris) : voir ce
 * qu'on a à installer, et la documentation correspondante, est précisément l'usage visé.
 * **Écriture réservée aux administrateurs** (`canEditDolibarrIntervention`), comme le reste de
 * l'édition d'intervention.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user || !canUseMobileApp(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { id } = await params;

  return NextResponse.json({ materials: await loadInterventionMaterials(id) });
}

const addSchema = z.object({
  equipmentId: z.string().trim().min(1, "Sélectionnez un équipement."),
  quantity: z.number().int().min(1).max(999).optional().default(1),
  note: z.string().trim().max(500).optional().default(""),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user || !canEditDolibarrIntervention(user.role)) {
    return NextResponse.json({ error: "Droits administrateur requis." }, { status: 403 });
  }
  const { id } = await params;

  const intervention = await prisma.interventionPlanning.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!intervention) {
    return NextResponse.json({ error: "Intervention introuvable." }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const parsed = addSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const { equipmentId, quantity, note } = parsed.data;

  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true },
  });
  if (!equipment) {
    return NextResponse.json({ error: "Cet équipement n’existe plus au catalogue." }, { status: 400 });
  }

  try {
    await prisma.interventionMaterial.create({
      data: { interventionId: id, equipmentId, quantity, note },
    });
  } catch (error) {
    // Contrainte d'unicité : le même équipement est déjà listé. On ajuste la quantité plutôt que
    // de renvoyer une erreur — c'est ce que l'utilisateur voulait dire en le rajoutant.
    const isDuplicate =
      typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
    if (!isDuplicate) throw error;
    await prisma.interventionMaterial.update({
      where: { interventionId_equipmentId: { interventionId: id, equipmentId } },
      data: { quantity, ...(note ? { note } : {}) },
    });
  }

  await prisma.auditLog
    .create({
      data: {
        userId: user.id,
        action: "INTERVENTION_MATERIAL_SET",
        entityType: "InterventionPlanning",
        entityId: id,
        metadata: { equipmentId, quantity },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ materials: await loadInterventionMaterials(id) }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user || !canEditDolibarrIntervention(user.role)) {
    return NextResponse.json({ error: "Droits administrateur requis." }, { status: 403 });
  }
  const { id } = await params;

  const materialId = request.nextUrl.searchParams.get("materialId");
  if (!materialId) {
    return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });
  }

  // Filtré sur l'intervention : impossible de retirer une ligne appartenant à une autre.
  const deleted = await prisma.interventionMaterial.deleteMany({
    where: { id: materialId, interventionId: id },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Ligne introuvable." }, { status: 404 });
  }

  return NextResponse.json({ materials: await loadInterventionMaterials(id) });
}

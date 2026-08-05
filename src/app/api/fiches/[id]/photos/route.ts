import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { DocumentError } from "@/lib/documents/errors";
import { removePhoto, writePhoto } from "@/lib/worksheets/photo-storage";

const MAX_PHOTOS_PER_SHEET = 50;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { id } = await params;

  const photos = await prisma.workSheetPhoto.findMany({
    where: { workSheetId: id },
    orderBy: { position: "asc" },
    select: { id: true, originalFileName: true, mimeType: true, sizeBytes: true, label: true, createdAt: true },
  });
  return NextResponse.json({ photos });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { id } = await params;

  const workSheet = await prisma.workSheet.findUnique({ where: { id }, select: { id: true } });
  if (!workSheet) return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });

  const existingCount = await prisma.workSheetPhoto.count({ where: { workSheetId: id } });
  if (existingCount >= MAX_PHOTOS_PER_SHEET) {
    return NextResponse.json({ error: "Trop de photos sur cette fiche." }, { status: 409 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }
  const label = String(form.get("label") || "").trim().slice(0, 60);

  let stored;
  try {
    stored = await writePhoto(file);
  } catch (error) {
    if (error instanceof DocumentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  // Le fichier est déjà sur disque : si l'écriture en base échoue, on le supprime pour ne pas
  // laisser un orphelin (même logique de compensation que pour les documents techniques).
  try {
    const photo = await prisma.workSheetPhoto.create({
      data: {
        workSheetId: id,
        storageName: stored.storageName,
        originalFileName: stored.originalFileName,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        checksumSha256: stored.checksumSha256,
        label,
        position: existingCount,
        uploadedById: user.id,
      },
      select: { id: true, originalFileName: true, mimeType: true, sizeBytes: true, label: true },
    });
    return NextResponse.json({ photo }, { status: 201 });
  } catch (error) {
    await removePhoto(stored.storageName);
    throw error;
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { removePhoto } from "@/lib/worksheets/photo-storage";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { id, photoId } = await params;

  const photo = await prisma.workSheetPhoto.findFirst({ where: { id: photoId, workSheetId: id } });
  if (!photo) return NextResponse.json({ error: "Photo introuvable." }, { status: 404 });

  await prisma.workSheetPhoto.delete({ where: { id: photo.id } });
  await removePhoto(photo.storageName);
  return NextResponse.json({ ok: true });
}

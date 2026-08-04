import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { DocumentError } from "@/lib/documents/errors";
import { readPhoto } from "@/lib/worksheets/photo-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { id, photoId } = await params;

  const photo = await prisma.workSheetPhoto.findFirst({
    where: { id: photoId, workSheetId: id },
  });
  if (!photo) return NextResponse.json({ error: "Photo introuvable." }, { status: 404 });

  try {
    const content = await readPhoto(photo.storageName);
    // Par défaut on l'affiche (balise <img>) ; `?download=1` force le téléchargement avec le nom
    // d'origine, pour qu'Ion puisse récupérer les photos telles quelles depuis le desktop.
    const download = request.nextUrl.searchParams.get("download") === "1";
    const safeName = photo.originalFileName.replace(/[^a-zA-Z0-9 ._-]/g, "").trim() || "photo";
    return new NextResponse(new Uint8Array(content), {
      headers: {
        "Content-Type": photo.mimeType,
        "Content-Length": String(content.byteLength),
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(safeName)}"`,
      },
    });
  } catch (error) {
    if (error instanceof DocumentError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}

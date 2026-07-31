import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const documentDirectory = path.join(process.cwd(), "data", "pac-documents");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { id } = await params;
  const document = await prisma.pacDocument.findUnique({ where: { id } });
  if (!document) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  try {
    const file = await readFile(path.join(documentDirectory, document.storageName));
    const safeName = document.originalName.replace(/["\r\n]/g, "_");
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(document.sizeBytes),
        "Content-Disposition": `inline; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(document.originalName)}`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Le fichier n’est plus disponible sur le serveur." }, { status: 404 });
  }
}

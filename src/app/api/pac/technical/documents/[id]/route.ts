import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canReadTechnicalDocuments } from "@/lib/auth/permissions";
import { readTechnicalDocumentFile } from "@/lib/hvac/document-storage";
import { prisma } from "@/lib/prisma";

function safeAsciiFileName(fileName: string) {
  const sanitized = fileName
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\\r\n]/g, "_")
    .trim();
  return sanitized || "document.pdf";
}

function encodeRfc5987(value: string) {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user || !canReadTechnicalDocuments(user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const document = await prisma.technicalDocument.findUnique({
    where: { id },
    select: {
      originalFileName: true,
      storageName: true,
    },
  });
  if (!document) {
    return NextResponse.json(
      { error: "Document introuvable." },
      { status: 404 },
    );
  }

  try {
    const file = await readTechnicalDocumentFile(document.storageName);
    const disposition = new URL(request.url).searchParams.get("download") === "1"
      ? "attachment"
      : "inline";
    const safeName = safeAsciiFileName(document.originalFileName);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(file.byteLength),
        "Content-Disposition":
          `${disposition}; filename="${safeName}"; filename*=UTF-8''${
            encodeRfc5987(document.originalFileName)
          }`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Le fichier n’est plus disponible sur le serveur." },
      { status: 404 },
    );
  }
}

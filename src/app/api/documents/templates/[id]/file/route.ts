import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { documentTemplateStorageRoot, readDocumentFile } from "@/lib/documents/storage";
import { DocumentError } from "@/lib/documents/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { id } = await params;

  const template = await prisma.documentTemplate.findUnique({ where: { id } });
  if (!template) {
    return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
  }

  try {
    const content = await readDocumentFile(template.storageName, documentTemplateStorageRoot());
    return new NextResponse(new Uint8Array(content), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(template.originalFileName)}"`,
      },
    });
  } catch (error) {
    if (error instanceof DocumentError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}

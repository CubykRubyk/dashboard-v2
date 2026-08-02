import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { generatedDocumentStorageRoot, readDocumentFile } from "@/lib/documents/storage";
import { DocumentError } from "@/lib/documents/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { id } = await params;

  const document = await prisma.generatedDocument.findUnique({
    where: { id },
    include: { template: { select: { name: true } } },
  });
  if (!document) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  try {
    const content = await readDocumentFile(document.storageName, generatedDocumentStorageRoot());
    const safeTemplateName = document.template.name.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "document";
    const fileName = `${safeTemplateName}.pdf`;
    return new NextResponse(new Uint8Array(content), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error) {
    if (error instanceof DocumentError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}

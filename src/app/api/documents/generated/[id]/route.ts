import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { readPdf } from "@/lib/generation/template-storage";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const document = await prisma.generatedDocument.findUnique({ where: { id }, select: { storageName: true, originalFileName: true } });
  if (!document) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readPdf(document.storageName);
    const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
    return new Response(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(document.originalFileName)}`, "Cache-Control": "private, no-store" } });
  } catch { return new Response("Document file is missing", { status: 404 }); }
}

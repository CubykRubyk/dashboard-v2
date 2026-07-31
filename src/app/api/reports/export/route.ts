import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.get("from") || "") ? params.get("from")! : "2000-01-01";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.get("to") || "") ? params.get("to")! : "2100-12-31";
  const installer = params.get("installer") || "";
  const company = params.get("company") || "";
  const tagId = params.get("tag") || "";
  const fiches = await prisma.workSheet.findMany({
    where: {
      archivedAt: null,
      workDate: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T23:59:59Z`) },
      ...(installer ? { installer } : {}),
      ...(company ? { company } : {}),
      ...(tagId ? { tags: { some: { tagId } } } : {}),
    },
    include: { tags: { include: { tag: true } }, items: true },
    orderBy: { workDate: "asc" },
  });
  let rows: string[][];
  let name: string;
  if (params.get("type") === "materials") {
    const totals = new Map<string, { unit: string; quantity: number; internal: number; company: number }>();
    fiches.flatMap((fiche) => fiche.items).forEach((item) => {
      const current = totals.get(item.materialNameSnapshot);
      totals.set(item.materialNameSnapshot, {
        unit: item.unitSnapshot,
        quantity: (current?.quantity || 0) + item.quantity,
        internal: (current?.internal || 0) + (item.supplier === "INTERNAL" ? item.quantity : 0),
        company: (current?.company || 0) + (item.supplier === "COMPANY" ? item.quantity : 0),
      });
    });
    rows = [
      ["Matériel", "Quantité totale", "Nos fournitures", "Fourni par la société", "Unité"],
      ...[...totals.entries()].map(([material, value]) => [
        material,
        String(value.quantity),
        String(value.internal),
        String(value.company),
        value.unit,
      ]),
    ];
    name = `materiels-${from}-${to}.csv`;
  } else {
    rows = [["Date", "Client", "Société", "Technicien", "Tags", "État", "ID Dolibarr"], ...fiches.map((fiche) => [
      fiche.workDate?.toISOString().slice(0, 10) || "",
      fiche.client,
      fiche.company,
      fiche.installer,
      fiche.tags.map(({ tag }) => tag.name).join(", "),
      fiche.status,
      fiche.eventId || "",
    ])];
    name = `fiches-${from}-${to}.csv`;
  }
  const content = `\uFEFF${rows.map((row) => row.map(csv).join(";")).join("\r\n")}`;
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}

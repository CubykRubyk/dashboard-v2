import ExcelJS from "exceljs";
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
    name = `materiels-${from}-${to}`;
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
    name = `fiches-${from}-${to}`;
  }

  // Classeur Excel : le CSV force Excel à deviner les types (un « ID Dolibarr » perd son zéro
  // initial, une date devient du texte). Le .xlsx porte les types et la mise en forme.
  if (params.get("format") === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Damaschin CRM";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(
      params.get("type") === "materials" ? "Matériels" : "Fiches",
      { views: [{ state: "frozen", ySplit: 1 }] },
    );

    const [header, ...body] = rows;
    sheet.addRow(header);
    for (const row of body) sheet.addRow(row);

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F4F8" } };

    // Largeurs calculées sur le contenu réel : sans ça, tout arrive tronqué et il faut
    // élargir chaque colonne à la main.
    header.forEach((label, index) => {
      const longest = Math.max(
        label.length,
        ...body.map((row) => String(row[index] ?? "").length),
      );
      sheet.getColumn(index + 1).width = Math.min(Math.max(longest + 2, 10), 50);
    });

    // Filtres sur l'en-tête : c'est la première chose qu'on ajoute à la main sinon.
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: header.length } };

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      },
    });
  }

  const content = `﻿${rows.map((row) => row.map(csv).join(";")).join("\r\n")}`;
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
    },
  });
}

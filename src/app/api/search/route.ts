import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  canGenerateDocuments,
  canManageDocumentTemplates,
  canReadTechnicalDocuments,
  canViewSav,
} from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

const TAKE = 5;

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2) {
    return NextResponse.json({
      worksheets: [],
      documents: [],
      templates: [],
      issuers: [],
      materials: [],
      combinations: [],
      equipment: [],
      technicalDocuments: [],
      sav: [],
    });
  }

  const canDocs = canGenerateDocuments(user.role);
  const canTemplates = canManageDocumentTemplates(user.role);
  const canTechnical = canReadTechnicalDocuments(user.role);
  const canSav = canViewSav(user.role);
  const insensitive = { contains: q, mode: "insensitive" as const };

  const [
    worksheets,
    documents,
    templates,
    issuers,
    materials,
    combinations,
    equipment,
    technicalDocuments,
    sav,
  ] = await Promise.all([
    prisma.workSheet.findMany({
      where: {
        OR: [
          { client: insensitive },
          { company: insensitive },
          { installer: insensitive },
          { eventId: insensitive },
        ],
      },
      select: { id: true, client: true, company: true, workDate: true },
      take: TAKE,
      orderBy: { updatedAt: "desc" },
    }),
    canDocs
      ? prisma.generatedDocument.findMany({
          where: { OR: [{ clientLabel: insensitive }, { eventId: insensitive }] },
          select: { id: true, clientLabel: true, eventId: true, createdAt: true },
          take: TAKE,
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    canTemplates
      ? prisma.documentTemplate.findMany({
          where: { name: insensitive },
          select: { id: true, name: true },
          take: TAKE,
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
    canTemplates
      ? prisma.documentIssuer.findMany({
          where: { name: insensitive },
          select: { id: true, name: true },
          take: TAKE,
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.material.findMany({
      where: { OR: [{ name: insensitive }, { reportLabel: insensitive }] },
      select: { id: true, name: true },
      take: TAKE,
      orderBy: { position: "asc" },
    }),
    prisma.systemCombination.findMany({
      where: { name: insensitive },
      select: { id: true, name: true },
      take: TAKE,
      orderBy: { updatedAt: "desc" },
    }),
    canTechnical
      ? prisma.equipment.findMany({
          where: {
            OR: [
              { name: insensitive },
              { manufacturerReference: insensitive },
              { manufacturer: { name: insensitive } },
            ],
          },
          select: { id: true, name: true, manufacturer: { select: { name: true } } },
          take: TAKE,
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
    canTechnical
      ? prisma.technicalDocument.findMany({
          where: {
            active: true,
            OR: [
              { title: insensitive },
              { equipment: { some: { equipment: { manufacturer: { name: insensitive } } } } },
              {
                systemCombinations: {
                  some: { systemCombination: { manufacturer: { name: insensitive } } },
                },
              },
            ],
          },
          select: { id: true, title: true },
          take: TAKE,
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
    canSav
      ? prisma.savTicket.findMany({
          where: {
            OR: [
              { reference: insensitive },
              { title: insensitive },
              { company: insensitive },
              { contact: insensitive },
            ],
          },
          select: { id: true, reference: true, title: true, company: true },
          take: TAKE,
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    worksheets,
    documents,
    templates,
    issuers,
    materials,
    combinations,
    equipment,
    technicalDocuments,
    sav,
  });
}

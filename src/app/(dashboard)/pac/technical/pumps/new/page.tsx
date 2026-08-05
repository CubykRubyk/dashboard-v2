import Link from "next/link";
import { ArrowLeft, Factory } from "lucide-react";

import { SimplePumpForm } from "@/components/pac/technical/SimplePumpForm";
import { requireTechnicalCatalogAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";

import { createSimplePumpAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewPumpPage() {
  await requireTechnicalCatalogAdmin();
  const [manufacturers, productRanges, documents] = await Promise.all([
    prisma.manufacturer.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    prisma.productRange.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, manufacturerId: true, name: true, active: true },
    }),
    prisma.technicalDocument.findMany({
      where: { active: true },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
      take: 200,
    }),
  ]);

  return (
    <>
      <div className="page-heading">
        <div>
          <Link className="page-back-link" href="/pac/technical">
            <ArrowLeft size={15} /> Retour au catalogue
          </Link>
          <p className="eyebrow">Catalogue PAC</p>
          <h1>Ajouter une pompe</h1>
          <p>
            Saisie rapide : le fabricant et le nom suffisent. Les références des groupes et le
            manuel sont facultatifs, à compléter plus tard si vous ne les avez pas sous la main.
          </p>
        </div>
      </div>

      {manufacturers.length === 0 ? (
        <section className="card technical-empty technical-empty-action">
          <Factory size={28} />
          <h2>Créez d’abord un fabricant</h2>
          <Link className="button button-primary" href="/pac/technical/manufacturers">
            Gérer les fabricants
          </Link>
        </section>
      ) : (
        <SimplePumpForm
          action={createSimplePumpAction}
          manufacturers={manufacturers}
          productRanges={productRanges}
          documents={documents}
        />
      )}
    </>
  );
}

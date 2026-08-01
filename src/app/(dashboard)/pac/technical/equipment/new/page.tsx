import Link from "next/link";
import { ArrowLeft, Factory } from "lucide-react";
import { EquipmentForm } from "@/components/pac/technical/EquipmentForm";
import { requireTechnicalCatalogAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import { createEquipmentAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewEquipmentPage() {
  await requireTechnicalCatalogAdmin();
  const [manufacturers, productRanges, refrigerants] = await Promise.all([
    prisma.manufacturer.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    prisma.productRange.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: {
        id: true,
        manufacturerId: true,
        name: true,
        active: true,
      },
    }),
    prisma.refrigerant.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, gwp: true, active: true },
    }),
  ]);

  return (
    <>
      <div className="page-heading">
        <div>
          <Link className="page-back-link" href="/pac/technical">
            <ArrowLeft size={15} /> Retour aux équipements
          </Link>
          <p className="eyebrow">Bibliothèque HVAC</p>
          <h1>Nouvel équipement</h1>
          <p>Créez une seule fiche par référence physique fabricant.</p>
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
        <EquipmentForm
          action={createEquipmentAction}
          manufacturers={manufacturers}
          productRanges={productRanges}
          refrigerants={refrigerants}
          submitLabel="Créer l’équipement"
        />
      )}
    </>
  );
}

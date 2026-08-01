import Link from "next/link";
import { ArrowLeft, Boxes } from "lucide-react";
import { CombinationForm } from "@/components/pac/technical/CombinationForm";
import { requireTechnicalCatalogAdmin } from "@/lib/auth/authorization";
import { getCombinationFormOptions } from "@/lib/hvac/combination-queries";
import { createCombinationAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCombinationPage() {
  await requireTechnicalCatalogAdmin();
  const [manufacturers, productRanges, equipment] =
    await getCombinationFormOptions();
  const viableManufacturerIds = new Set(
    equipment
      .filter((item) => item.active && item.type === "INDOOR_UNIT")
      .map((item) => item.manufacturerId)
      .filter((manufacturerId) => equipment.some(
        (item) => item.active
          && item.type === "OUTDOOR_UNIT"
          && item.manufacturerId === manufacturerId,
      )),
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <Link
            className="page-back-link"
            href="/pac/technical/combinations"
          >
            <ArrowLeft size={15} /> Retour aux combinaisons
          </Link>
          <p className="eyebrow">Bibliothèque HVAC</p>
          <h1>Nouvelle combinaison</h1>
          <p>Associez exactement une unité extérieure et une unité intérieure.</p>
        </div>
      </div>

      {viableManufacturerIds.size === 0 ? (
        <section className="card technical-empty technical-empty-action">
          <Boxes size={30} />
          <h2>Équipements insuffisants</h2>
          <p>
            Créez au moins une unité extérieure et une unité intérieure actives.
          </p>
          <Link className="button button-primary" href="/pac/technical">
            Gérer les équipements
          </Link>
        </section>
      ) : (
        <CombinationForm
          action={createCombinationAction}
          manufacturers={manufacturers}
          productRanges={productRanges}
          equipment={equipment}
          submitLabel="Créer la combinaison"
        />
      )}
    </>
  );
}

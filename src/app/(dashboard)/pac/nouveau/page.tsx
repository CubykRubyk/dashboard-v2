import { PacModelForm } from "@/components/pac/PacModelForm";
import { prisma } from "@/lib/prisma";
import { createHeatPump } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewPacModelPage() {
  const [brands, ranges, refrigerants] = await Promise.all([
    prisma.pacBrand.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.pacRange.findMany({ where: { active: true }, orderBy: [{ brand: { name: "asc" } }, { name: "asc" }] }),
    prisma.refrigerant.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">Catalogue PAC</p><h1>Nouveau modèle</h1><p>Créez la fiche technique et les informations d’installation.</p></div>
      </div>
      {brands.length ? (
        <PacModelForm action={createHeatPump} brands={brands} ranges={ranges} refrigerants={refrigerants} submitLabel="Créer le modèle" />
      ) : (
        <section className="card worksheet-empty"><h2>Ajoutez d’abord une marque</h2><p>Revenez au catalogue PAC pour créer la première marque.</p></section>
      )}
    </>
  );
}

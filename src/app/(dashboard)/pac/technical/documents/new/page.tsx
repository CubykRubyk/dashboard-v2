import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TechnicalDocumentForm } from "@/components/pac/technical/TechnicalDocumentForm";
import { requireTechnicalCatalogAdmin } from "@/lib/auth/authorization";
import { getDocumentAssociationOptions } from "@/lib/hvac/document-queries";
import { createTechnicalDocumentAction } from "../actions";

export const dynamic = "force-dynamic";

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function NewTechnicalDocumentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireTechnicalCatalogAdmin();
  const params = await searchParams;
  const [equipment, combinations] = await getDocumentAssociationOptions();
  const requestedEquipmentId = valueOf(params.equipment).slice(0, 100);
  const requestedCombinationId = valueOf(params.combination).slice(0, 100);
  const initialEquipmentIds = equipment.some(
    (item) => item.id === requestedEquipmentId && item.active,
  )
    ? [requestedEquipmentId]
    : [];
  const initialCombinationIds = combinations.some(
    (item) => item.id === requestedCombinationId && item.active,
  )
    ? [requestedCombinationId]
    : [];

  return (
    <>
      <div className="page-heading">
        <div>
          <Link
            className="page-back-link"
            href="/pac/technical/documents"
          >
            <ArrowLeft size={15} /> Retour aux documents
          </Link>
          <p className="eyebrow">Bibliothèque HVAC</p>
          <h1>Importer un document</h1>
          <p>Le fichier PDF sera stocké une seule fois, indépendamment des associations.</p>
        </div>
      </div>

      <TechnicalDocumentForm
        action={createTechnicalDocumentAction}
        equipment={equipment}
        combinations={combinations}
        submitLabel="Importer le document"
        includeFile
        initialEquipmentIds={initialEquipmentIds}
        initialCombinationIds={initialCombinationIds}
      />
    </>
  );
}

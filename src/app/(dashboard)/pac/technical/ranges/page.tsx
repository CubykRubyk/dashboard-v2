import Link from "next/link";
import {
  CirclePlus,
  Layers3,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { CatalogActionForm } from "@/components/pac/technical/CatalogActionForm";
import { CatalogStatusToggle } from "@/components/pac/technical/CatalogStatusToggle";
import { GxonModal } from "@/components/ui/GxonModal";
import { canManageTechnicalCatalog } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  createProductRangeAction,
  toggleProductRangeAction,
  updateProductRangeAction,
} from "../actions";

export const dynamic = "force-dynamic";

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function ProductRangesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const manufacturerId = valueOf(params.manufacturer).slice(0, 100);
  const [user, manufacturers, productRanges] = await Promise.all([
    getSession(),
    prisma.manufacturer.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    prisma.productRange.findMany({
      where: manufacturerId ? { manufacturerId } : undefined,
      orderBy: [
        { manufacturer: { name: "asc" } },
        { active: "desc" },
        { name: "asc" },
      ],
      include: {
        manufacturer: true,
        _count: {
          select: {
            equipment: true,
          },
        },
      },
    }),
  ]);
  const canManage = canManageTechnicalCatalog(user?.role);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Bibliothèque HVAC</p>
          <h1>Gammes</h1>
          <p>Organisez les références techniques par gamme fabricant.</p>
        </div>
        {canManage && manufacturers.length > 0 && (
          <GxonModal triggerClassName="button button-primary" trigger={<><CirclePlus size={17} /> Ajouter une gamme</>} title="Ajouter une gamme" description="Associez la gamme à son fabricant.">
            <CatalogActionForm
              action={createProductRangeAction}
              submitLabel="Créer la gamme"
              className="technical-popover-form"
              resetOnSuccess
            >
              <label>
                Fabricant
                <select name="manufacturerId" required defaultValue={manufacturerId}>
                  <option value="">Sélectionner…</option>
                  {manufacturers.map((manufacturer) => (
                    <option value={manufacturer.id} key={manufacturer.id}>
                      {manufacturer.name}{manufacturer.active ? "" : " · inactif"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nom de la gamme
                <input name="name" required maxLength={120} placeholder="Ex. Altherma 3" />
              </label>
            </CatalogActionForm>
          </GxonModal>
        )}
      </div>

      <form className="card technical-filter-bar">
        <label>
          <span>Fabricant</span>
          <select name="manufacturer" defaultValue={manufacturerId}>
            <option value="">Tous les fabricants</option>
            {manufacturers.map((manufacturer) => (
              <option value={manufacturer.id} key={manufacturer.id}>
                {manufacturer.name}
              </option>
            ))}
          </select>
        </label>
        <button className="button button-ghost">Filtrer</button>
        {manufacturerId && (
          <Link className="button button-ghost" href="/pac/technical/ranges">
            <RotateCcw size={15} /> Réinitialiser
          </Link>
        )}
      </form>

      <section className="card technical-list-card">
        <div className="technical-list-heading">
          <span className="technical-heading-icon"><Layers3 size={19} /></span>
          <div>
            <h2>{productRanges.length} gamme{productRanges.length === 1 ? "" : "s"}</h2>
            <p>Chaque gamme appartient à un seul fabricant.</p>
          </div>
        </div>

        {productRanges.length === 0 ? (
          <div className="technical-empty">Aucune gamme pour ce filtre.</div>
        ) : (
          <div className="technical-table-wrap">
            <table className="technical-table">
              <thead>
                <tr>
                  <th>Gamme</th>
                  <th>Fabricant</th>
                  <th>Équipements</th>
                  <th>Statut</th>
                  {canManage && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {productRanges.map((productRange) => (
                  <tr className={productRange.active ? "" : "inactive"} key={productRange.id}>
                    <td>
                      <strong>{productRange.name}</strong>
                      {productRange.legacyPacRangeId && <small>Gamme migrée</small>}
                    </td>
                    <td>{productRange.manufacturer.name}</td>
                    <td>{productRange._count.equipment}</td>
                    <td>
                      <span className={`status-dot ${productRange.active ? "active" : ""}`}>
                        {productRange.active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        <div className="technical-row-actions">
                          <GxonModal triggerClassName="mini-action" trigger={<><Pencil size={14} /> Modifier</>} title={`Modifier ${productRange.name}`} description="Les équipements associés seront conservés.">
                            <CatalogActionForm
                              action={updateProductRangeAction.bind(null, productRange.id)}
                              submitLabel="Enregistrer"
                              className="technical-popover-form"
                            >
                              <label>
                                Fabricant
                                <select
                                  name="manufacturerId"
                                  required
                                  defaultValue={productRange.manufacturerId}
                                >
                                  {manufacturers.map((manufacturer) => (
                                    <option value={manufacturer.id} key={manufacturer.id}>
                                      {manufacturer.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Nom
                                <input
                                  name="name"
                                  required
                                  maxLength={120}
                                  defaultValue={productRange.name}
                                />
                              </label>
                            </CatalogActionForm>
                          </GxonModal>
                          <CatalogStatusToggle
                            action={toggleProductRangeAction.bind(
                              null,
                              productRange.id,
                              !productRange.active,
                            )}
                            active={productRange.active}
                            compact
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

import {
  CirclePlus,
  Factory,
  Pencil,
} from "lucide-react";
import { CatalogActionForm } from "@/components/pac/technical/CatalogActionForm";
import { CatalogStatusToggle } from "@/components/pac/technical/CatalogStatusToggle";
import { GxonModal } from "@/components/ui/GxonModal";
import { canManageTechnicalCatalog } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  createManufacturerAction,
  toggleManufacturerAction,
  updateManufacturerAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function ManufacturersPage() {
  const [user, manufacturers] = await Promise.all([
    getSession(),
    prisma.manufacturer.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            productRanges: true,
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
          <h1>Fabricants</h1>
          <p>Gérez les fabricants utilisés par les gammes et les équipements.</p>
        </div>
        {canManage && (
          <GxonModal triggerClassName="button button-primary" trigger={<><CirclePlus size={17} /> Ajouter un fabricant</>} title="Ajouter un fabricant" description="Ajoutez un fabricant à la bibliothèque HVAC.">
            <CatalogActionForm
              action={createManufacturerAction}
              submitLabel="Créer le fabricant"
              className="technical-popover-form"
              resetOnSuccess
            >
              <label>
                Nom du fabricant
                <input name="name" required maxLength={100} placeholder="Ex. Daikin" />
              </label>
            </CatalogActionForm>
          </GxonModal>
        )}
      </div>

      <section className="card technical-list-card">
        <div className="technical-list-heading">
          <span className="technical-heading-icon"><Factory size={19} /></span>
          <div>
            <h2>{manufacturers.length} fabricant{manufacturers.length === 1 ? "" : "s"}</h2>
            <p>La désactivation conserve toutes les données associées.</p>
          </div>
        </div>

        {manufacturers.length === 0 ? (
          <div className="technical-empty">Aucun fabricant enregistré.</div>
        ) : (
          <div className="technical-table-wrap">
            <table className="technical-table">
              <thead>
                <tr>
                  <th>Fabricant</th>
                  <th>Gammes</th>
                  <th>Équipements</th>
                  <th>Statut</th>
                  {canManage && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {manufacturers.map((manufacturer) => (
                  <tr className={manufacturer.active ? "" : "inactive"} key={manufacturer.id}>
                    <td>
                      <strong>{manufacturer.name}</strong>
                      <small>{manufacturer.normalizedName}</small>
                    </td>
                    <td>{manufacturer._count.productRanges}</td>
                    <td>{manufacturer._count.equipment}</td>
                    <td>
                      <span className={`status-dot ${manufacturer.active ? "active" : ""}`}>
                        {manufacturer.active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        <div className="technical-row-actions">
                          <GxonModal triggerClassName="mini-action" trigger={<><Pencil size={14} /> Modifier</>} title={`Modifier ${manufacturer.name}`} description="Les gammes et équipements associés seront conservés.">
                            <CatalogActionForm
                              action={updateManufacturerAction.bind(null, manufacturer.id)}
                              submitLabel="Enregistrer"
                              className="technical-popover-form"
                            >
                              <label>
                                Nom
                                <input
                                  name="name"
                                  required
                                  maxLength={100}
                                  defaultValue={manufacturer.name}
                                />
                              </label>
                            </CatalogActionForm>
                          </GxonModal>
                          <CatalogStatusToggle
                            action={toggleManufacturerAction.bind(
                              null,
                              manufacturer.id,
                              !manufacturer.active,
                            )}
                            active={manufacturer.active}
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

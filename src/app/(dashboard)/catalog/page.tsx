import { CirclePlus, Layers3, Pencil, Power, PowerOff } from "lucide-react";
import { MaterialInputType, MaterialUnit } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { DismissibleDetails } from "@/components/ui/DismissibleDetails";
import { GxonModal } from "@/components/ui/GxonModal";
import { DeleteCatalogButton } from "@/components/catalog/DeleteCatalogButton";
import {
  createCategory,
  createMaterial,
  createVariant,
  deleteCategory,
  deleteMaterial,
  deleteVariant,
  toggleMaterial,
  toggleVariant,
  updateCategory,
  updateMaterial,
  updateVariant,
} from "./actions";

export const dynamic = "force-dynamic";

const typeLabels: Record<MaterialInputType, string> = {
  CHECKBOX: "Case à cocher",
  QUANTITY: "Quantité",
  SELECT: "Liste de modèles",
  DETAIL: "Case + détail",
};

const unitLabels: Record<MaterialUnit, string> = {
  NONE: "Sans unité",
  PIECE: "Pièce",
  METER: "Mètre",
  BAG: "Sac",
  RADIATOR: "Radiateur",
};

export default async function CatalogPage() {
  const categories = await prisma.materialCategory.findMany({
    orderBy: { position: "asc" },
    include: {
      materials: {
        orderBy: { position: "asc" },
        include: {
          _count: { select: { workSheetItems: true } },
          variants: {
            orderBy: { position: "asc" },
            include: { _count: { select: { workSheetItems: true } } },
          },
        },
      },
    },
  });
  const total = categories.reduce((sum, category) => sum + category.materials.length, 0);
  const active = categories.reduce(
    (sum, category) => sum + category.materials.filter((material) => material.active).length,
    0,
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Paramètres</p>
          <h1>Catalogue matériel</h1>
          <p>Gérez les accessoires et modèles proposés dans les fiches chantier.</p>
        </div>
        <div className="catalog-summary">
          <span><strong>{categories.length}</strong> catégories</span>
          <span><strong>{active}</strong> actifs sur {total}</span>
        </div>
      </div>

      <section className="catalog-toolbar card">
        <GxonModal triggerClassName="button button-primary" title="Ajouter un article" description="Configurez l’article et son comportement dans les fiches chantier." trigger={
            <>
            <CirclePlus size={17} /> Ajouter un article
            </>
          }>
          <form action={createMaterial} className="catalog-form">
            <label>Catégorie<select name="categoryId" required>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label>Nom affiché<input name="name" required placeholder="Ex. Circulateur Grundfos" /></label>
            <label>Texte du rapport<input name="reportLabel" required placeholder="Ex. circulateur Grundfos" /></label>
            <label>Type<select name="inputType" defaultValue="QUANTITY">{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Unité<select name="unit" defaultValue="PIECE">{Object.entries(unitLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <button className="button button-primary">Enregistrer l’article</button>
          </form>
        </GxonModal>
        <GxonModal triggerClassName="button button-ghost" title="Ajouter une catégorie" description="Les articles seront regroupés sous cette catégorie." trigger={
            <>
            <Layers3 size={17} /> Ajouter une catégorie
            </>
          }>
          <form action={createCategory} className="catalog-form compact-form">
            <label>Nom de la catégorie<input name="name" required placeholder="Ex. Évacuation condensats" /></label>
            <button className="button button-primary">Enregistrer</button>
          </form>
        </GxonModal>
      </section>

      <div className="catalog-categories">
        {categories.map((category) => (
          <section className="card catalog-category" key={category.id}>
            <div className="catalog-category-header">
              <div>
                <p className="eyebrow">Catégorie</p>
                <h2>{category.name}</h2>
              </div>
              <div className="category-actions">
                <span className="badge">{category.materials.length} article{category.materials.length > 1 ? "s" : ""}</span>
                <GxonModal triggerClassName="mini-action" trigger={<><Pencil size={14} /> Modifier</>} title={`Modifier ${category.name}`} description="Les articles de cette catégorie seront conservés.">
                  <form action={updateCategory.bind(null, category.id)} className="edit-popover category-edit-form">
                    <label>Nom de la catégorie<input name="name" required defaultValue={category.name} /></label>
                    <button className="button button-primary button-small">Enregistrer</button>
                  </form>
                </GxonModal>
                {category.materials.length === 0 && (
                  <DeleteCatalogButton
                    action={deleteCategory.bind(null, category.id)}
                    kind="catégorie"
                    name={category.name}
                  />
                )}
              </div>
            </div>
            <div className="catalog-table-wrap">
              <table className="catalog-table">
                <thead><tr><th>Article</th><th>Rapport</th><th>Type</th><th>Unité</th><th>Modèles</th><th>État</th><th>Actions</th></tr></thead>
                <tbody>
                  {category.materials.map((material) => (
                    <tr key={material.id} className={material.active ? "" : "disabled-row"}>
                      <td><strong>{material.name}</strong><small>{material.key}</small></td>
                      <td>{material.reportLabel}</td>
                      <td>{typeLabels[material.inputType]}</td>
                      <td>{unitLabels[material.unit]}</td>
                      <td>
                        {material.inputType === "SELECT" ? (
                          <DismissibleDetails
                            className="variant-details"
                            summary={<>{material.variants.length} modèle{material.variants.length > 1 ? "s" : ""}</>}
                          >
                            <div className="variant-panel">
                              {material.variants.map((variant) => (
                                <div className="variant-row" key={variant.id}>
                                  <span><strong>{variant.name}</strong><small>{variant.reportLabel}</small></span>
                                  <div className="variant-actions">
                                    <GxonModal triggerClassName="mini-action" trigger={<Pencil size={14} />} title={`Modifier ${variant.name}`} description="Modifiez le modèle affiché dans les fiches chantier.">
                                      <form action={updateVariant.bind(null, variant.id)} className="edit-popover variant-edit-form">
                                        <label>Nom<input name="name" required defaultValue={variant.name} /></label>
                                        <label>Texte du rapport<input name="reportLabel" required defaultValue={variant.reportLabel} /></label>
                                        <button className="button button-primary button-small">Enregistrer</button>
                                      </form>
                                    </GxonModal>
                                    <form action={toggleVariant.bind(null, variant.id, !variant.active)}>
                                      <button className="mini-action" title={variant.active ? "Désactiver" : "Activer"}>
                                        {variant.active ? <PowerOff size={14} /> : <Power size={14} />}
                                      </button>
                                    </form>
                                    <DeleteCatalogButton
                                      action={deleteVariant.bind(null, variant.id)}
                                      kind="modèle"
                                      name={variant.name}
                                      usageCount={variant._count.workSheetItems}
                                      compact
                                    />
                                  </div>
                                </div>
                              ))}
                              <form action={createVariant.bind(null, material.id)} className="variant-form">
                                <input name="name" required placeholder="Nom du modèle" />
                                <input name="reportLabel" required placeholder="Texte du rapport" />
                                <button className="button button-primary button-small">Ajouter</button>
                              </form>
                            </div>
                          </DismissibleDetails>
                        ) : "—"}
                      </td>
                      <td>
                        <form action={toggleMaterial.bind(null, material.id, !material.active)}>
                          <button className={`status-button ${material.active ? "active" : ""}`}>
                            {material.active ? <><Power size={14} /> Actif</> : <><PowerOff size={14} /> Inactif</>}
                          </button>
                        </form>
                      </td>
                      <td>
                        <div className="catalog-row-actions">
                          <GxonModal triggerClassName="mini-action" trigger={<><Pencil size={14} /> Modifier</>} title={`Modifier ${material.name}`} description="Les valeurs utilisées dans les fiches chantier seront mises à jour.">
                            <form action={updateMaterial.bind(null, material.id)} className="edit-popover material-edit-form">
                              <label>Catégorie<select name="categoryId" defaultValue={material.categoryId}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                              <label>Nom affiché<input name="name" required defaultValue={material.name} /></label>
                              <label>Texte du rapport<input name="reportLabel" required defaultValue={material.reportLabel} /></label>
                              <label>Type<select name="inputType" defaultValue={material.inputType}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                              <label>Unité<select name="unit" defaultValue={material.unit}>{Object.entries(unitLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                              <button className="button button-primary button-small">Enregistrer les modifications</button>
                            </form>
                          </GxonModal>
                          <DeleteCatalogButton
                            action={deleteMaterial.bind(null, material.id)}
                            kind="article"
                            name={material.name}
                            usageCount={material._count.workSheetItems}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

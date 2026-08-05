import { redirect } from "next/navigation";

/**
 * « Catalogue PAC » du menu latéral. Cet écran listait les `SystemCombination` sous forme de
 * cartes (« les modèles PAC sont créés à partir de combinaisons compatibles UI + UE ») — c'est
 * précisément le parcours qu'Ion a jugé trop complexe. Il n'y a plus qu'un seul catalogue :
 * `/pac/technical`, réorganisé autour de « Ajouter une pompe », les combinaisons étant reléguées
 * derrière « Avancé ».
 *
 * Redirection plutôt que suppression : les liens existants (favoris, ⌘K, `basePath="/pac"`
 * d'anciennes URL) continuent de fonctionner. La fiche legacy `/pac/[id]` reste accessible.
 */
export default function PacCatalogPage() {
  redirect("/pac/technical");
}

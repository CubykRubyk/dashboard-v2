import Link from "next/link";
import { Boxes } from "lucide-react";

export const dynamic = "force-dynamic";

export default function NewPacModelPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Catalogue PAC historique</p>
          <h1>Création désactivée</h1>
          <p>Le catalogue legacy est désormais conservé en lecture seule.</p>
        </div>
      </div>
      <section className="card worksheet-empty">
        <Boxes size={34} />
        <h2>Utilisez la bibliothèque technique</h2>
        <p>
          Créez les unités UI, UE ou monobloc dans le nouveau catalogue,
          puis assemblez les systèmes split dans les combinaisons.
        </p>
        <Link className="button button-primary" href="/pac/technical/equipment/new">
          Créer un équipement
        </Link>
      </section>
    </>
  );
}

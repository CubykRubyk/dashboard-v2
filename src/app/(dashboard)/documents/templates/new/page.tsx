import Link from "next/link";
import { UploadCloud } from "lucide-react";
import { uploadDocumentTemplate } from "../actions";

export default function NewDocumentTemplatePage() {
  return <main className="page-shell"><div className="page-heading"><div><p className="eyebrow">Bibliothèque de templates</p><h1>Ajouter un template</h1><p className="page-subtitle">Le fichier est stocké séparément et ses champs PDF sont détectés automatiquement.</p></div><Link className="button secondary" href="/documents/templates">Annuler</Link></div><form action={uploadDocumentTemplate} className="template-upload-layout"><div className="template-upload-dropzone"><UploadCloud size={35} /><h2>Importer un fichier PDF</h2><p>PDF uniquement, 25 Mo maximum.</p><input name="file" type="file" accept="application/pdf,.pdf" required /></div><div className="card template-upload-fields"><h2>Informations du template</h2><label>Nom du template<input name="name" required maxLength={160} placeholder="PV de mise en service" /></label><p className="muted">Après import, les champs AcroForm seront visibles dans la bibliothèque et pourront être remplis lors de la génération.</p><button className="button" type="submit">Enregistrer le template</button></div></form></main>;
}

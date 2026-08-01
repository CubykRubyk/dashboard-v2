import Link from "next/link";
import {
  ArrowUpRight,
  Boxes,
  FileQuestion,
  Network,
} from "lucide-react";
import type { TechnicalDocumentType } from "@/generated/prisma/enums";
import { formatDocumentSize } from "@/lib/hvac/document-format";
import { technicalDocumentTypeLabels } from "@/lib/hvac/labels";

interface DocumentRow {
  id: string;
  title: string;
  type: TechnicalDocumentType;
  originalFileName: string;
  sizeBytes: number;
  active: boolean;
  legacyPacDocumentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    equipment: number;
    systemCombinations: number;
  };
  equipment: Array<{
    equipment: { manufacturer: { name: string } };
  }>;
  systemCombinations: Array<{
    systemCombination: { manufacturer: { name: string } };
  }>;
}

function manufacturerLabel(document: DocumentRow) {
  const names = new Set([
    ...document.equipment.map((link) => link.equipment.manufacturer.name),
    ...document.systemCombinations.map(
      (link) => link.systemCombination.manufacturer.name,
    ),
  ]);
  if (names.size === 0) return "—";
  if (names.size === 1) return [...names][0];
  return `${names.size} fabricants`;
}

export function DocumentTable({
  documents,
  emptyMessage,
}: {
  documents: DocumentRow[];
  emptyMessage: string;
}) {
  if (documents.length === 0) {
    return (
      <section className="card technical-empty">
        <FileQuestion size={28} />
        <p>{emptyMessage}</p>
      </section>
    );
  }

  const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
  });

  return (
    <section className="card technical-list-card">
      <div className="technical-table-wrap">
        <table className="technical-table document-table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Fichier</th>
              <th>Fabricant</th>
              <th>Associations</th>
              <th>Taille</th>
              <th>Statut</th>
              <th>Dates</th>
              <th><span className="sr-only">Ouvrir</span></th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => {
              const associationCount =
                document._count.equipment + document._count.systemCombinations;
              return (
                <tr className={document.active ? "" : "inactive"} key={document.id}>
                  <td>
                    <strong>{document.title}</strong>
                    <small>{technicalDocumentTypeLabels[document.type]}</small>
                    <div className="technical-detail-badges">
                      {document.legacyPacDocumentId && (
                        <span className="document-origin-badge">Legacy</span>
                      )}
                      {associationCount === 0 && (
                        <span className="document-unassociated-badge">
                          Sans association
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="document-file-name">
                      {document.originalFileName}
                    </span>
                  </td>
                  <td>{manufacturerLabel(document)}</td>
                  <td>
                    <span className="document-association-count">
                      <Boxes size={14} /> {document._count.equipment}
                    </span>
                    <span className="document-association-count">
                      <Network size={14} /> {document._count.systemCombinations}
                    </span>
                  </td>
                  <td>{formatDocumentSize(document.sizeBytes)}</td>
                  <td>
                    <span className={`status-dot ${document.active ? "active" : ""}`}>
                      {document.active ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td>
                    <small>Créé {dateFormatter.format(document.createdAt)}</small>
                    <small>Modifié {dateFormatter.format(document.updatedAt)}</small>
                  </td>
                  <td>
                    <Link
                      className="mini-action"
                      href={`/pac/technical/documents/${document.id}`}
                      aria-label={`Ouvrir ${document.title}`}
                    >
                      <ArrowUpRight size={15} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

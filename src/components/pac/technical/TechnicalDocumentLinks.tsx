import Link from "next/link";
import {
  ArrowUpRight,
  ExternalLink,
  FileText,
} from "lucide-react";
import type { TechnicalDocumentType } from "@/generated/prisma/enums";
import {
  formatDocumentSize,
  technicalDocumentFileHref,
} from "@/lib/hvac/document-format";
import { technicalDocumentTypeLabels } from "@/lib/hvac/labels";

interface TechnicalDocumentLinkValue {
  id: string;
  title: string;
  type: TechnicalDocumentType;
  originalFileName: string;
  sizeBytes: number;
  active: boolean;
}

export function TechnicalDocumentLinks({
  title = "Documents techniques",
  description,
  documents,
  emptyMessage = "Aucun document associé.",
}: {
  title?: string;
  description?: string;
  documents: TechnicalDocumentLinkValue[];
  emptyMessage?: string;
}) {
  return (
    <section className="card technical-list-card technical-document-links">
      <div className="technical-list-heading">
        <span className="technical-heading-icon"><FileText size={18} /></span>
        <div>
          <h2>{title}</h2>
          <p>{description || `${documents.length} document(s) associé(s)`}</p>
        </div>
      </div>
      {documents.length === 0 ? (
        <div className="technical-empty">{emptyMessage}</div>
      ) : (
        <div className="technical-document-link-list">
          {documents.map((document) => (
            <div
              className={`technical-document-link-row ${
                document.active ? "" : "inactive"
              }`}
              key={document.id}
            >
              <FileText size={18} />
              <div>
                <strong>{document.title}</strong>
                <small>
                  {technicalDocumentTypeLabels[document.type]} ·{" "}
                  {document.originalFileName} ·{" "}
                  {formatDocumentSize(document.sizeBytes)}
                  {document.active ? "" : " · inactif"}
                </small>
              </div>
              <Link
                className="mini-action"
                href={technicalDocumentFileHref(document.id)}
                target="_blank"
                aria-label={`Visualiser ${document.title}`}
              >
                <ExternalLink size={15} />
              </Link>
              <Link
                className="mini-action"
                href={`/pac/technical/documents/${document.id}`}
                aria-label={`Ouvrir la fiche ${document.title}`}
              >
                <ArrowUpRight size={15} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

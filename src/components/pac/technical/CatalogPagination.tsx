import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function CatalogPagination({
  currentPage,
  totalPages,
  hrefForPage,
  ariaLabel = "Pagination",
}: {
  currentPage: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
  ariaLabel?: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="technical-pagination" aria-label={ariaLabel}>
      {currentPage > 1 ? (
        <Link className="button button-ghost" href={hrefForPage(currentPage - 1)}>
          <ChevronLeft size={16} /> Précédent
        </Link>
      ) : <span />}
      <span>Page {currentPage} sur {totalPages}</span>
      {currentPage < totalPages ? (
        <Link className="button button-ghost" href={hrefForPage(currentPage + 1)}>
          Suivant <ChevronRight size={16} />
        </Link>
      ) : <span />}
    </nav>
  );
}

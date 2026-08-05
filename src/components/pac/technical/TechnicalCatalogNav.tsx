"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Boxes,
  ChevronDown,
  Factory,
  FileText,
  Layers3,
  Network,
  Plus,
} from "lucide-react";

const primaryItems = [
  { href: "/pac/technical", label: "Équipements", icon: Boxes, exact: true },
  { href: "/pac/technical/documents", label: "Documents", icon: FileText },
];

// Écrans conservés mais rangés derrière « Avancé » : la création d'unités séparées puis leur
// combinaison reste possible, elle n'est simplement plus le parcours par défaut (le formulaire
// « Ajouter une pompe » l'a remplacé pour la saisie courante).
const advancedItems = [
  { href: "/pac/technical/combinations", label: "Combinaisons", icon: Network },
  { href: "/pac/technical/manufacturers", label: "Fabricants", icon: Factory },
  { href: "/pac/technical/ranges", label: "Gammes", icon: Layers3 },
];

export function TechnicalCatalogNav() {
  const pathname = usePathname();
  const advancedActive = advancedItems.some((item) => pathname.startsWith(item.href));
  // Ouvert d'office quand on se trouve déjà dans une de ces pages, sinon replié.
  const [advancedOpen, setAdvancedOpen] = useState(advancedActive);
  const showAdvanced = advancedOpen || advancedActive;

  return (
    <nav className="technical-catalog-nav" aria-label="Catalogue technique">
      <Link
        href="/pac/technical/pumps/new"
        className={pathname.startsWith("/pac/technical/pumps") ? "active" : ""}
        aria-current={pathname.startsWith("/pac/technical/pumps") ? "page" : undefined}
      >
        <Plus size={16} />
        Ajouter une pompe
      </Link>

      {primaryItems.map(({ href, label, icon: Icon, exact }) => {
        const active = exact
          ? pathname === href || pathname.startsWith("/pac/technical/equipment/")
          : pathname.startsWith(href);
        return (
          <Link
            href={href}
            key={href}
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}

      <button
        type="button"
        className={showAdvanced ? "active" : ""}
        aria-expanded={showAdvanced}
        onClick={() => setAdvancedOpen((open) => !open)}
      >
        <ChevronDown
          size={16}
          style={{ transform: showAdvanced ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
        Avancé
      </button>

      {showAdvanced
        && advancedItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              href={href}
              key={href}
              className={`technical-catalog-nav-nested${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Factory,
  FileText,
  Layers3,
  Network,
} from "lucide-react";

const items = [
  { href: "/pac/technical", label: "Équipements", icon: Boxes, exact: true },
  {
    href: "/pac/technical/manufacturers",
    label: "Fabricants",
    icon: Factory,
  },
  { href: "/pac/technical/ranges", label: "Gammes", icon: Layers3 },
  {
    href: "/pac/technical/combinations",
    label: "Combinaisons",
    icon: Network,
  },
  {
    href: "/pac/technical/documents",
    label: "Documents",
    icon: FileText,
  },
];

export function TechnicalCatalogNav() {
  const pathname = usePathname();

  return (
    <nav className="technical-catalog-nav" aria-label="Catalogue technique">
      {items.map(({ href, label, icon: Icon, exact }) => {
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
    </nav>
  );
}

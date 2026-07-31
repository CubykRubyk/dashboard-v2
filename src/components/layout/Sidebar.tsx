"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  BarChart3,
  Building2,
  FileOutput,
  FileText,
  Gauge,
  Settings,
  Snowflake,
} from "lucide-react";

const navigation = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/fiches", label: "Fiches chantier", icon: FileText },
  { href: "/reports", label: "Statistiques", icon: BarChart3 },
  { href: "/documents", label: "Documents", icon: FileOutput },
  { href: "/catalog", label: "Catalogue matériel", icon: Boxes },
  { href: "/pac", label: "Catalogue PAC", icon: Snowflake },
  { href: "/societati", label: "Sociétés", icon: Building2 },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

export function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <Link href="/" className="sidebar-brand">
        <span className="brand-mark">D</span>
        <span>
          <strong>Damaschin</strong>
          <small>CRM</small>
        </span>
      </Link>
      <nav aria-label="Navigation principale">
        <p className="nav-label">Menu principal</p>
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
          <Link
            key={href}
            href={href}
            className={`nav-link${active ? " active" : ""}`}
            onClick={onNavigate}
            title={label}
          >
            <Icon aria-hidden size={19} />
            <span>{label}</span>
          </Link>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <span>Nouvelle version</span>
        <small>Socle en développement</small>
      </div>
    </aside>
  );
}

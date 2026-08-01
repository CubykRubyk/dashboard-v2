"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  BarChart3,
  Building2,
  FileText,
  Gauge,
  Settings,
  Snowflake,
} from "lucide-react";

const navigation = [
  {
    label: "Vue d’ensemble",
    items: [{ href: "/", label: "Dashboard", icon: Gauge }],
  },
  {
    label: "Gestion",
    items: [
      { href: "/fiches", label: "Fiches chantier", icon: FileText },
      { href: "/reports", label: "Statistiques", icon: BarChart3 },
      { href: "/societati", label: "Sociétés", icon: Building2 },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/catalog", label: "Catalogue matériel", icon: Boxes },
      { href: "/pac", label: "Catalogue PAC", icon: Snowflake },
      { href: "/settings", label: "Paramètres", icon: Settings },
    ],
  },
];

export function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <Link href="/" className="sidebar-brand">
        <span className="brand-mark">D</span>
        <span className="brand-copy">
          <strong>Damaschin</strong>
          <small>CRM</small>
        </span>
      </Link>
      <nav aria-label="Navigation principale">
        {navigation.map((section) => (
          <div className="nav-section" key={section.label}>
            <p className="nav-label">{section.label}</p>
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`nav-link${active ? " active" : ""}`}
                  onClick={onNavigate}
                  title={label}
                >
                  <Icon aria-hidden size={18} strokeWidth={1.8} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="sidebar-footer-mark">D</span>
        <span>
          <strong>Damaschin CRM</strong>
          <small>Version 2.0</small>
        </span>
      </div>
    </aside>
  );
}

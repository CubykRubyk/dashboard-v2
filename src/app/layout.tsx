import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Damaschin CRM",
  description: "Gestion des fiches chantier et des documents",
  robots: { index: false, follow: false },
  // PWA — installable depuis Safari/Chrome mobile ("Ajouter à l'écran d'accueil"). `start_url` du
  // manifest pointe sur `/mobile`, pas `/` — sans ça l'icône relançait le dashboard desktop, pas
  // la version mobile, et s'ouvrait dans Safari plein cadre au lieu du mode standalone (sans barre).
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    // "black-translucent" — la page dessine son propre fond sous l'encoche/Dynamic Island, qui suit
    // le thème via `theme-color` (MobilePreferences.tsx). Nécessite `viewport-fit: cover` ; le vide
    // sous la tabBar que cette combinaison provoquait en PWA standalone iOS est traité à la racine
    // dans globals.css (padding sur `<html>`), pas ici — voir CLAUDE.md pour l'historique complet.
    statusBarStyle: "black-translucent",
    title: "2C Énergies",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff8110",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={jakarta.variable}>{children}</body>
    </html>
  );
}

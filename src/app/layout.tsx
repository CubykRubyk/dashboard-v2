import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Damaschin CRM",
  description: "Gestion des fiches chantier et des documents",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={jakarta.variable}>
        <Script id="theme-init" strategy="beforeInteractive">
          {`try{var p=localStorage.getItem("theme")||"auto";var d=p==="auto"?matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light":p;document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d}catch(e){}`}
        </Script>
        {children}
      </body>
    </html>
  );
}

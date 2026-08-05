"use client";

import { useEffect, useState } from "react";
import { useT } from "./MobilePreferences";
import styles from "./mobile.module.css";

// Durée totale = durée naturelle de l'animation d'Ion (2.3s : assemblage 1.6s, sortie "zoom + fondu
// en transparence" 0.7s) — pas un minimum arbitraire, la sortie EST la transition vers l'appli. Les
// pages mobiles sont des Server Components (`src/lib/mobile/data.ts`) : les données sont déjà
// chargées côté serveur avant que le HTML n'arrive au téléphone, donc ce splash ne coordonne aucun
// fetch réel, c'est un rideau de marque devant un contenu déjà rendu en dessous.
const TOTAL_DURATION_MS = 2300;
const REDUCED_MOTION_MS = 500;

// Animation "Elemente separate (exit)" portée depuis le design d'Ion (`Logo animation for mobile
// welcome/logo-scenes-d.jsx`) — 5 calques du logo qui arrivent de directions différentes avec un
// effet de rebond (`cubic-bezier(.34, 1.56, .64, 1)`, déjà utilisé ailleurs dans l'appli mobile pour
// cette même sensation — voir l'icône active de `MobileTabBar`), puis la marque entière zoome pendant
// que tout l'écran (fond + halo + logo) s'estompe en transparence pour révéler l'écran réel en
// dessous — pas un fondu vers du blanc (retour d'Ion : le fond doit disparaître, pas rester plein).
export function MobileSplash() {
  const t = useT();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hideTimer = window.setTimeout(
      () => setVisible(false),
      reduceMotion ? REDUCED_MOTION_MS : TOTAL_DURATION_MS,
    );
    return () => window.clearTimeout(hideTimer);
  }, []);

  if (!visible) return null;

  return (
    <div className={styles.splashOverlay} role="status" aria-live="polite">
      <div className={styles.splashGlow} aria-hidden />
      <div className={styles.splashGroup} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.splashPiece2c} src="/splash/logo-2c.png" alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.splashPieceFlame} src="/splash/logo-flame.png" alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.splashPieceSnow} src="/splash/logo-snow.png" alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.splashPieceEnergies} src="/splash/logo-energies.png" alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.splashPieceTagline} src="/splash/logo-tagline.png" alt="" />
      </div>
      <span className="sr-only">{t("splash.loading")}</span>
    </div>
  );
}

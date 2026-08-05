import type { Metadata } from "next";

import { SavRequestForm } from "./SavRequestForm";

/**
 * Formulaire public de demande d'intervention, destiné aux sociétés clientes. **Aucune session**
 * n'est requise — c'est la seule page de l'application dans ce cas avec `/login`. Le groupe de
 * routes `(public)` la tient volontairement à l'écart de `(dashboard)` (chrome interne) et de
 * `(mobile)` (application terrain).
 */
export const metadata: Metadata = {
  title: "Demande d’intervention — 2C Énergies",
  description: "Signalez une panne ou demandez une intervention.",
};

export default function SavRequestPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-logo-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="auth-logo" src="/logo-2c-energies.png" alt="2C Energies" />
        </div>
        <h1>Demande d’intervention</h1>
        <p className="auth-copy">
          Décrivez votre problème : nous revenons vers vous par e-mail dès la prise en charge, puis
          à chaque étape.
        </p>
        <SavRequestForm />
      </section>
      <aside className="auth-visual">
        <div>
          <span className="auth-kicker">Service après-vente</span>
          <h2>Une panne&nbsp;? Décrivez-la une fois, nous nous occupons du reste.</h2>
          <p>
            Vous recevez une référence de suivi immédiatement, puis un e-mail à chaque changement
            de statut de votre demande.
          </p>
        </div>
      </aside>
    </main>
  );
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getSession()) redirect("/");

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="brand-mark" aria-hidden>D</div>
        <p className="eyebrow">Damaschin CRM</p>
        <h1>Bienvenue</h1>
        <p className="auth-copy">
          Connectez-vous pour gérer les fiches chantier et les documents.
        </p>
        <LoginForm />
      </section>
      <aside className="auth-visual">
        <div>
          <span className="auth-kicker">Plateforme opérationnelle</span>
          <h2>Vos chantiers et vos documents réunis au même endroit.</h2>
          <p>
            La nouvelle version conserve vos habitudes de travail tout en
            apportant davantage de souplesse.
          </p>
        </div>
      </aside>
    </main>
  );
}

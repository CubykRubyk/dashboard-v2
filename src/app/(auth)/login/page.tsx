import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

// Après connexion, on doit revenir là où l'utilisateur voulait aller (typiquement `/mobile`,
// atteint via `(mobile)/mobile/layout.tsx` sans session) — jamais une redirection ouverte vers un
// domaine externe. `next` n'est accepté que s'il pointe vers un chemin interne relatif.
function sanitizeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = sanitizeNext(next);
  if (await getSession()) redirect(safeNext);

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-logo-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="auth-logo" src="/logo-2c-energies.png" alt="2C Energies" />
        </div>
        <h1>Bienvenue</h1>
        <p className="auth-copy">
          Connectez-vous pour gérer les fiches chantier et les documents.
        </p>
        <LoginForm next={safeNext} />
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

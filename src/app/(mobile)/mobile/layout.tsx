import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { canUseMobileApp } from "@/lib/auth/permissions";
import { MobileShell } from "@/components/mobile/MobileShell";
import { getMobileScope, isUnlinkedTechnician } from "@/lib/mobile/scope";

export const metadata = {
  title: "Damaschin CRM · Mobile",
};

export default async function MobileLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Pas `requireUser()` (qui renvoie toujours vers `/login` sans mémoriser d'où on venait) — sans
  // ça, se connecter depuis son téléphone renvoyait vers le dashboard desktop `/` au lieu de revenir
  // sur `/mobile`.
  const user = await getSession();
  if (!user) redirect("/login?next=/mobile");
  // `canUseMobileApp` et non `canViewSav` : les techniciens doivent entrer ici (c'est leur seul
  // écran) sans obtenir pour autant l'accès SAV du desktop. Le filtrage de leurs données est fait
  // en amont des requêtes, dans `lib/mobile/scope.ts`.
  if (!canUseMobileApp(user.role)) redirect("/fiches");
  const scope = await getMobileScope();
  return (
    <MobileShell
      technicianMode={Boolean(scope?.ownWorkOnly)}
      unlinked={isUnlinkedTechnician(scope)}
    >
      {children}
    </MobileShell>
  );
}

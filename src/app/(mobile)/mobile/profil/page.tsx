import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ProfileScreen } from "@/components/mobile/ProfileScreen";

export const dynamic = "force-dynamic";

export default async function MobileProfilePage() {
  // Pas `requireUser()` (redirige toujours vers `/login` sans mémoriser d'où on venait) — même
  // correctif que `(mobile)/mobile/layout.tsx`, resté non appliqué ici jusqu'à présent.
  const user = await getSession();
  if (!user) redirect("/login?next=/mobile/profil");
  return <ProfileScreen name={user.name} email={user.email} role={user.role} />;
}

import { requireUser } from "@/lib/auth/session";
import { ProfileScreen } from "@/components/mobile/ProfileScreen";

export const dynamic = "force-dynamic";

export default async function MobileProfilePage() {
  const user = await requireUser();
  return <ProfileScreen name={user.name} email={user.email} role={user.role} />;
}

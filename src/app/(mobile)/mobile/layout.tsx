import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { canViewSav } from "@/lib/auth/permissions";
import { MobileShell } from "@/components/mobile/MobileShell";

export const metadata = {
  title: "Damaschin CRM · Mobile",
};

export default async function MobileLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  // Même garde que la liste SAV du desktop — cette première version mobile est côté administration.
  if (!canViewSav(user.role)) redirect("/fiches");
  return <MobileShell>{children}</MobileShell>;
}

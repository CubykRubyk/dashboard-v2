import { AppChrome } from "@/components/layout/AppChrome";
import { requireUser } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  return <AppChrome user={user}>{children}</AppChrome>;
}

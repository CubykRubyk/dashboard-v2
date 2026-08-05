import { redirect } from "next/navigation";

import { LibraryScreen } from "@/components/mobile/LibraryScreen";
import { canReadTechnicalDocuments } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { searchLibrary } from "@/lib/mobile/library";

export const dynamic = "force-dynamic";

export default async function MobileLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login?next=/mobile/bibliotheque");
  // Lecture seule : la même permission que le téléchargement des PDF, qui inclut désormais les
  // techniciens.
  if (!canReadTechnicalDocuments(user.role)) redirect("/mobile");

  const { q } = await searchParams;
  const query = q ?? "";
  const results = await searchLibrary(query);

  return <LibraryScreen query={query} results={results} />;
}

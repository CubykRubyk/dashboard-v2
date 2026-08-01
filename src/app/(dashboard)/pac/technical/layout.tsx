import { TechnicalCatalogNav } from "@/components/pac/technical/TechnicalCatalogNav";

export default function TechnicalCatalogLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <TechnicalCatalogNav />
      {children}
    </>
  );
}

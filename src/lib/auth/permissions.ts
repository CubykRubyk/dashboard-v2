import type { UserRole } from "@/generated/prisma/enums";

export function canManageTechnicalCatalog(role: UserRole | null | undefined) {
  return role === "ADMIN";
}

export function canReadTechnicalDocuments(
  role: UserRole | null | undefined,
) {
  return role === "ADMIN" || role === "OPERATOR" || role === "VIEWER";
}

import type { UserRole } from "@/generated/prisma/enums";

export function canManageTechnicalCatalog(role: UserRole | null | undefined) {
  return role === "ADMIN";
}

export function canReadTechnicalDocuments(
  role: UserRole | null | undefined,
) {
  return role === "ADMIN" || role === "OPERATOR" || role === "VIEWER";
}

export function canManageDocumentTemplates(role: UserRole | null | undefined) {
  return role === "ADMIN";
}

export function canGenerateDocuments(role: UserRole | null | undefined) {
  return role === "ADMIN" || role === "OPERATOR";
}

export function canViewAuditLog(role: UserRole | null | undefined) {
  return role === "ADMIN";
}

export function canViewSav(role: UserRole | null | undefined) {
  return role === "ADMIN" || role === "OPERATOR" || role === "VIEWER";
}

export function canManageSav(role: UserRole | null | undefined) {
  return role === "ADMIN" || role === "OPERATOR";
}

export function canManageTeams(role: UserRole | null | undefined) {
  return role === "ADMIN";
}

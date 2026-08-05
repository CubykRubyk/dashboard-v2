import type { UserRole } from "@/generated/prisma/enums";

export function canManageTechnicalCatalog(role: UserRole | null | undefined) {
  return role === "ADMIN";
}

// TECHNICIEN inclus : consulter les manuels sur le terrain est précisément l'usage visé par la
// bibliothèque technique mobile. C'est de la lecture seule — la gestion du catalogue reste
// couverte par `canManageTechnicalCatalog` (ADMIN).
export function canReadTechnicalDocuments(
  role: UserRole | null | undefined,
) {
  return role === "ADMIN" || role === "OPERATOR" || role === "VIEWER" || role === "TECHNICIEN";
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

export function canManageUsers(role: UserRole | null | undefined) {
  return role === "ADMIN";
}

// Configuration des notifications (clés push, e-mail sortant) : ADMIN uniquement. Fonction
// distincte de `canManageBackups` malgré un profil identique — un nom qui décrit autre chose que
// ce qu'il garde coûte plus cher qu'une fonction de plus le jour où l'un des deux doit bouger.
export function canManageNotifications(role: UserRole | null | undefined) {
  return role === "ADMIN";
}

// Sauvegarde/restauration de la base : ADMIN uniquement — une restauration écrase toute la base.
export function canManageBackups(role: UserRole | null | undefined) {
  return role === "ADMIN";
}

/**
 * Modifier une intervention **et l'écrire dans Dolibarr**. ADMIN uniquement, plus restrictif que
 * `canManageSav` : c'est la seule action du module qui modifie un système externe, sans annulation
 * possible depuis l'application.
 */
export function canEditDolibarrIntervention(role: UserRole | null | undefined) {
  return role === "ADMIN";
}

/**
 * Accès à l'application mobile. Distinct de `canViewSav` — qui gardait cette porte auparavant et
 * rejetait donc les techniciens : un technicien doit entrer sur le mobile **sans** pour autant
 * obtenir l'accès SAV du desktop.
 */
export function canUseMobileApp(role: UserRole | null | undefined) {
  return role === "ADMIN" || role === "OPERATOR" || role === "VIEWER" || role === "TECHNICIEN";
}

/**
 * Vrai pour les comptes qui ne doivent voir que leur propre travail. Utilisé comme signal de
 * filtrage dans les requêtes mobiles, pas comme une porte : un technicien a bien accès à l'écran,
 * ce sont les données qui sont restreintes à ses interventions.
 */
export function canViewOwnWorkOnly(role: UserRole | null | undefined) {
  return role === "TECHNICIEN";
}

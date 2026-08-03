"use server";

import { revalidatePath } from "next/cache";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/session";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { requireTechnicalCatalogAdmin } from "@/lib/auth/authorization";
import type { UserRole } from "@/generated/prisma/enums";

const PASSWORD_HASH_COST = 12;
const userRoleEnum = z.enum(["ADMIN", "OPERATOR", "VIEWER", "TECHNICIEN"]);

const userSchema = z.object({
  email: z.string().trim().toLowerCase().email("L’email n’est pas valide."),
  name: z.string().trim().min(1, "Le nom est requis.").max(120),
  role: userRoleEnum,
  teamId: z.string().trim(),
  password: z.string().min(12, "12 caractères minimum."),
});

const userUpdateSchema = userSchema.omit({ password: true });

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

const tagSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const teamSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(80),
});

const issuerSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(160),
  address: z.string().trim().max(500),
  phone: z.string().trim().max(80),
  email: z.string().trim().email("L’email n’est pas valide.").or(z.literal("")),
  defaultResponsible: z.string().trim().max(160),
  refrigerantAttestationNumber: z.string().trim().max(160),
  leakDetectorId: z.string().trim().max(160),
  leakDetectorInspectionDate: z.string().trim().regex(/^$|^\d{4}-\d{2}-\d{2}$/),
});

const MAX_ISSUER_ASSET_BYTES = 2 * 1024 * 1024;

function parseIssuerData(formData: FormData) {
  const parsed = issuerSchema.parse(Object.fromEntries(formData));
  return {
    name: parsed.name,
    address: parsed.address,
    phone: parsed.phone,
    email: parsed.email,
    defaultResponsible: parsed.defaultResponsible,
    refrigerantAttestationNumber: parsed.refrigerantAttestationNumber,
    leakDetectorId: parsed.leakDetectorId,
    leakDetectorInspectionDate: parsed.leakDetectorInspectionDate
      ? new Date(`${parsed.leakDetectorInspectionDate}T00:00:00.000Z`)
      : null,
  };
}

async function readIssuerAsset(formData: FormData, field: string) {
  const value = formData.get(field);
  if (!(value instanceof File) || value.size === 0) return undefined;
  if (value.size > MAX_ISSUER_ASSET_BYTES) {
    throw new Error("Chaque image doit avoir une taille maximale de 2 Mo.");
  }
  if (value.type !== "image/png" && value.type !== "image/jpeg") {
    throw new Error("Les images doivent être au format PNG ou JPEG.");
  }
  const bytes = Buffer.from(await value.arrayBuffer());
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  if ((value.type === "image/png" && !isPng) || (value.type === "image/jpeg" && !isJpeg)) {
    throw new Error("La signature du fichier image est invalide.");
  }
  return `data:${value.type};base64,${bytes.toString("base64")}`;
}

async function issuerAssets(formData: FormData) {
  const [logoData, stampData, signatureData] = await Promise.all([
    readIssuerAsset(formData, "logo"),
    readIssuerAsset(formData, "stamp"),
    readIssuerAsset(formData, "signature"),
  ]);
  return {
    ...(logoData !== undefined ? { logoData } : {}),
    ...(stampData !== undefined ? { stampData } : {}),
    ...(signatureData !== undefined ? { signatureData } : {}),
  };
}

async function requireAdmin() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("Accès non autorisé.");
  return user;
}

export async function createTag(formData: FormData) {
  const user = await requireAdmin();
  const data = tagSchema.parse(Object.fromEntries(formData));
  const position = await prisma.tag.count();
  const tag = await prisma.tag.create({ data: { ...data, position } });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "TAG_CREATE", entityType: "Tag", entityId: tag.id },
  });
  revalidatePath("/settings");
  revalidatePath("/fiches");
}

export async function updateTag(id: string, formData: FormData) {
  const user = await requireAdmin();
  const data = tagSchema.parse(Object.fromEntries(formData));
  await prisma.tag.update({ where: { id }, data });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "TAG_UPDATE", entityType: "Tag", entityId: id },
  });
  revalidatePath("/settings");
  revalidatePath("/fiches");
}

export async function toggleTag(id: string, active: boolean) {
  const user = await requireAdmin();
  await prisma.tag.update({ where: { id }, data: { active } });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: active ? "TAG_ENABLE" : "TAG_DISABLE",
      entityType: "Tag",
      entityId: id,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/fiches");
}

export async function deleteTag(id: string) {
  const user = await requireAdmin();
  const tag = await prisma.tag.findUnique({
    where: { id },
    select: { name: true, _count: { select: { workSheets: true } } },
  });
  if (!tag) throw new Error("Tag introuvable.");

  await prisma.$transaction([
    prisma.workSheetTag.deleteMany({ where: { tagId: id } }),
    prisma.tag.delete({ where: { id } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "TAG_DELETE",
        entityType: "Tag",
        entityId: id,
        metadata: {
          name: tag.name,
          detachedWorkSheets: tag._count.workSheets,
        },
      },
    }),
  ]);
  revalidatePath("/settings");
  revalidatePath("/fiches");
}

export async function createDocumentIssuer(formData: FormData) {
  const user = await requireTechnicalCatalogAdmin();
  const data = { ...parseIssuerData(formData), ...await issuerAssets(formData) };
  const issuer = await prisma.documentIssuer.create({ data });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "DOCUMENT_ISSUER_CREATE",
      entityType: "DocumentIssuer",
      entityId: issuer.id,
      metadata: { name: issuer.name },
    },
  });
  revalidatePath("/settings");
}

export async function updateDocumentIssuer(
  id: string,
  formData: FormData,
) {
  const user = await requireTechnicalCatalogAdmin();
  const data = { ...parseIssuerData(formData), ...await issuerAssets(formData) };
  await prisma.$transaction([
    prisma.documentIssuer.update({ where: { id }, data }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "DOCUMENT_ISSUER_UPDATE",
        entityType: "DocumentIssuer",
        entityId: id,
        metadata: { name: data.name },
      },
    }),
  ]);
  revalidatePath("/settings");
}

export async function toggleDocumentIssuer(id: string, active: boolean) {
  const user = await requireTechnicalCatalogAdmin();
  await prisma.$transaction([
    prisma.documentIssuer.update({ where: { id }, data: { active } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: active ? "DOCUMENT_ISSUER_ENABLE" : "DOCUMENT_ISSUER_DISABLE",
        entityType: "DocumentIssuer",
        entityId: id,
        metadata: { active },
      },
    }),
  ]);
  revalidatePath("/settings");
}

export async function createTeam(formData: FormData) {
  const user = await requireAdmin();
  const data = teamSchema.parse(Object.fromEntries(formData));
  const team = await prisma.team.create({ data });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "TEAM_CREATE", entityType: "Team", entityId: team.id, metadata: { name: team.name } },
  });
  revalidatePath("/settings");
  revalidatePath("/planification-sav");
}

export async function updateTeam(id: string, formData: FormData) {
  const user = await requireAdmin();
  const data = teamSchema.parse(Object.fromEntries(formData));
  await prisma.team.update({ where: { id }, data });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "TEAM_UPDATE", entityType: "Team", entityId: id, metadata: { name: data.name } },
  });
  revalidatePath("/settings");
  revalidatePath("/planification-sav");
}

export async function toggleTeam(id: string, active: boolean) {
  const user = await requireAdmin();
  await prisma.team.update({ where: { id }, data: { active } });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: active ? "TEAM_ENABLE" : "TEAM_DISABLE",
      entityType: "Team",
      entityId: id,
      metadata: { active },
    },
  });
  revalidatePath("/settings");
  revalidatePath("/planification-sav");
}

export async function deleteTeam(id: string) {
  const user = await requireAdmin();
  const team = await prisma.team.findUnique({
    where: { id },
    select: { name: true, _count: { select: { savTickets: true } } },
  });
  if (!team) throw new Error("Équipe introuvable.");
  if (team._count.savTickets > 0) {
    throw new Error("Cette équipe est assignée à des bilets SAV et ne peut pas être supprimée.");
  }
  await prisma.$transaction([
    prisma.team.delete({ where: { id } }),
    prisma.auditLog.create({
      data: { userId: user.id, action: "TEAM_DELETE", entityType: "Team", entityId: id, metadata: { name: team.name } },
    }),
  ]);
  revalidatePath("/settings");
  revalidatePath("/planification-sav");
}

// Empêche de se retirer soi-même les droits ADMIN / de se désactiver, et de retirer le dernier
// administrateur actif restant — partagé par updateUser (changement de rôle) et toggleUser.
async function assertNotLastAdminOrSelfLockout(
  admin: SessionUser,
  targetId: string,
  next: { active?: boolean; role?: UserRole },
) {
  const losesAdmin = next.role !== undefined && next.role !== "ADMIN";
  const losesActive = next.active === false;
  if (!losesAdmin && !losesActive) return;

  if (targetId === admin.id) {
    throw new Error("Vous ne pouvez pas retirer vos propres droits administrateur ou désactiver votre compte.");
  }
  const otherActiveAdmins = await prisma.user.count({
    where: { id: { not: targetId }, role: "ADMIN", active: true },
  });
  if (otherActiveAdmins === 0) {
    throw new Error("Il doit rester au moins un administrateur actif.");
  }
}

export async function createUser(formData: FormData) {
  const admin = await requireAdmin();
  const data = userSchema.parse(Object.fromEntries(formData));
  const passwordHash = await hash(data.password, PASSWORD_HASH_COST);
  let user;
  try {
    user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role,
        teamId: data.teamId || null,
        passwordHash,
      },
    });
  } catch (error) {
    if (isUniqueConflict(error)) throw new Error("Un compte existe déjà avec cet email.");
    throw error;
  }
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "USER_CREATE",
      entityType: "User",
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    },
  });
  revalidatePath("/settings");
}

export async function updateUser(id: string, formData: FormData) {
  const admin = await requireAdmin();
  const data = userUpdateSchema.parse(Object.fromEntries(formData));
  await assertNotLastAdminOrSelfLockout(admin, id, { role: data.role });
  try {
    await prisma.user.update({
      where: { id },
      data: { email: data.email, name: data.name, role: data.role, teamId: data.teamId || null },
    });
  } catch (error) {
    if (isUniqueConflict(error)) throw new Error("Un compte existe déjà avec cet email.");
    throw error;
  }
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "USER_UPDATE",
      entityType: "User",
      entityId: id,
      metadata: { email: data.email, name: data.name, role: data.role },
    },
  });
  revalidatePath("/settings");
}

export async function toggleUser(id: string, active: boolean) {
  const admin = await requireAdmin();
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target) throw new Error("Utilisateur introuvable.");
  await assertNotLastAdminOrSelfLockout(admin, id, { active, role: target.role });

  await prisma.user.update({ where: { id }, data: { active } });
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: active ? "USER_ENABLE" : "USER_DISABLE",
      entityType: "User",
      entityId: id,
    },
  });
  revalidatePath("/settings");
}

const adminResetPasswordSchema = z.object({
  password: z.string().min(12, "12 caractères minimum."),
});

export async function adminResetPassword(id: string, formData: FormData) {
  const admin = await requireAdmin();
  const { password } = adminResetPasswordSchema.parse(Object.fromEntries(formData));
  const passwordHash = await hash(password, PASSWORD_HASH_COST);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "USER_PASSWORD_RESET_BY_ADMIN",
      entityType: "User",
      entityId: id,
    },
  });
  revalidatePath("/settings");
}

const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Le mot de passe actuel est requis."),
    newPassword: z.string().min(12, "12 caractères minimum."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });

export async function changeOwnPassword(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Non autorisé.");
  const data = changeOwnPasswordSchema.parse(Object.fromEntries(formData));

  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { id: true, passwordHash: true } });
  if (!user || !(await compare(data.currentPassword, user.passwordHash))) {
    throw new Error("Mot de passe actuel incorrect.");
  }

  const passwordHash = await hash(data.newPassword, PASSWORD_HASH_COST);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "USER_PASSWORD_CHANGE_SELF",
      entityType: "User",
      entityId: user.id,
    },
  });
}

"use server";

import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/auth/session";
import { loginSchema, type LoginState } from "@/lib/auth/validation";

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message || "Les informations saisies ne sont pas valides.",
      values: { email: String(formData.get("email") || "") },
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (!user || !user.active || !(await compare(parsed.data.password, user.passwordHash))) {
    return {
      error: "Adresse e-mail ou mot de passe incorrect.",
      values: { email: parsed.data.email },
    };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "AUTH_LOGIN",
        entityType: "User",
        entityId: user.id,
      },
    }),
  ]);

  await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

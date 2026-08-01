import "server-only";

import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { UserRole } from "@/generated/prisma/enums";
import {
  type SessionTokenUser,
  verifySessionToken,
} from "@/lib/auth/session-token";

const COOKIE_NAME = "dashboard_session";
const SESSION_SECONDS = 60 * 60 * 8;

export interface SessionUser extends SessionTokenUser {
  role: UserRole;
}

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET doit contenir au moins 32 caractères.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(user: SessionUser) {
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
  const token = await new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey());

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function deleteSession() {
  (await cookies()).delete(COOKIE_NAME);
}

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token, secretKey());
});

export async function requireUser() {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

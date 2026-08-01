import { jwtVerify } from "jose";
import type { UserRole } from "@/generated/prisma/enums";

export interface SessionTokenUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export async function verifySessionToken(
  token: string,
  key: Uint8Array,
): Promise<SessionTokenUser | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
    });
    const user = payload.user as SessionTokenUser | undefined;
    return user?.id && user.role ? user : null;
  } catch {
    return null;
  }
}

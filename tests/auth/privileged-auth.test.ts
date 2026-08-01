import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "../../src/generated/prisma/enums";
import { authorizeCurrentTechnicalCatalogAdmin } from "../../src/lib/auth/privileged-auth";
import { verifySessionToken } from "../../src/lib/auth/session-token";
import { TechnicalCatalogError } from "../../src/lib/hvac/errors";

const session = { id: "user-a", role: UserRole.ADMIN };

function lookup(
  current: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    active: boolean;
  } | null,
) {
  return {
    async findCurrentUser() {
      return current;
    },
  };
}

async function rejectsAuthorization(
  current: Parameters<typeof lookup>[0],
  currentSession: typeof session | null = session,
) {
  await assert.rejects(
    authorizeCurrentTechnicalCatalogAdmin(currentSession, lookup(current)),
    (error) => (
      error instanceof TechnicalCatalogError
      && error.code === "UNAUTHORIZED"
    ),
  );
}

test("active current ADMIN is authorized even if token role is stale", async () => {
  const current = {
    id: "user-a",
    email: "admin@example.test",
    name: "Admin",
    role: UserRole.ADMIN,
    active: true,
  };
  assert.equal(
    (
      await authorizeCurrentTechnicalCatalogAdmin(
        { ...session, role: UserRole.VIEWER },
        lookup(current),
      )
    ).role,
    UserRole.ADMIN,
  );
});

test("disabled, demoted, deleted and unauthenticated users are rejected", async () => {
  await rejectsAuthorization({
    id: "user-a",
    email: "admin@example.test",
    name: "Admin",
    role: UserRole.ADMIN,
    active: false,
  });
  await rejectsAuthorization({
    id: "user-a",
    email: "admin@example.test",
    name: "Admin",
    role: UserRole.OPERATOR,
    active: true,
  });
  await rejectsAuthorization({
    id: "user-a",
    email: "admin@example.test",
    name: "Admin",
    role: UserRole.VIEWER,
    active: true,
  });
  await rejectsAuthorization(null);
  await rejectsAuthorization(null, null);
});

test("an invalid JWT is treated as unauthenticated", async () => {
  const key = new TextEncoder().encode(
    "test-secret-at-least-32-characters-long",
  );
  assert.equal(await verifySessionToken("not-a-jwt", key), null);
});

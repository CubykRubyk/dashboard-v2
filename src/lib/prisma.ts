import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const PRISMA_CLIENT_SIGNATURE = "20260802170359_add_dolibarr_last_sync_error";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSignature?: string;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL nu este configurat.");
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

function getPrismaClient() {
  if (process.env.NODE_ENV === "production") {
    return createPrismaClient();
  }

  if (
    globalForPrisma.prisma &&
    globalForPrisma.prismaSignature === PRISMA_CLIENT_SIGNATURE
  ) {
    return globalForPrisma.prisma;
  }

  void globalForPrisma.prisma?.$disconnect().catch(() => undefined);
  const prisma = createPrismaClient();
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSignature = PRISMA_CLIENT_SIGNATURE;
  return prisma;
}

export const prisma = getPrismaClient();

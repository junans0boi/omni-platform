import { PrismaClient } from "@prisma/client";

// Keep the existing local database as the development default while allowing
// tests and migration tools to select an isolated SQLite file.
process.env.DATABASE_URL ??= "file:./dev.db";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

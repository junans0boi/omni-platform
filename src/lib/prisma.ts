import { PrismaClient } from "@prisma/client";
import { isAbsolute, join } from "node:path";

let dbUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";
if (dbUrl.startsWith("file:")) {
  const rawPath = dbUrl.slice(5);
  if (!isAbsolute(rawPath)) {
    const filename = rawPath.replace(/^\.\//, "").replace(/^prisma\//, "");
    dbUrl = `file:${join(process.cwd(), "prisma", filename)}`;
  }
}
process.env.DATABASE_URL = dbUrl;

const globalForPrisma = global as unknown as { prisma: PrismaClient; prismaUrl?: string };

export const prisma =
  globalForPrisma.prisma && globalForPrisma.prismaUrl === dbUrl
    ? globalForPrisma.prisma
    : new PrismaClient({
        datasources: {
          db: {
            url: dbUrl,
          },
        },
        log: ["query"],
      });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaUrl = dbUrl;
}

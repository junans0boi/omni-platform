import { rmSync } from "node:fs";
import { join } from "node:path";

const prismaDirectory = join(process.cwd(), "prisma");
const databaseFiles = ["e2e.db", "e2e.db-journal", "e2e.db-shm", "e2e.db-wal"];

export const e2eDatabasePath = join(prismaDirectory, databaseFiles[0]);

export function removeE2eDatabase() {
  for (const databaseFile of databaseFiles) {
    rmSync(join(prismaDirectory, databaseFile), { force: true });
  }
}

import { rmSync } from "node:fs";
import { join } from "node:path";

const prismaDirectory = join(process.cwd(), "prisma");
const allowedDatabaseNames = new Set(["e2e.db", "livekit-e2e.db"]);

export const e2eDatabasePath = join(prismaDirectory, "e2e.db");

export function removeE2eDatabase(databaseName = "e2e.db") {
  if (!allowedDatabaseNames.has(databaseName)) {
    throw new Error(`Refusing to remove non-test database: ${databaseName}`);
  }

  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    rmSync(join(prismaDirectory, `${databaseName}${suffix}`), { force: true });
  }
}

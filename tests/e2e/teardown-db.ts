import { rmSync } from "node:fs";
import { join } from "node:path";

export default function teardownDatabase() {
  const prismaDirectory = join(process.cwd(), "prisma");

  for (const databaseFile of ["e2e.db", "e2e.db-journal", "e2e.db-shm", "e2e.db-wal"]) {
    rmSync(join(prismaDirectory, databaseFile), { force: true });
  }
}

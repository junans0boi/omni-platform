import { execFileSync } from "node:child_process";
import { closeSync, openSync, rmSync } from "node:fs";
import { join } from "node:path";

const prismaDirectory = join(process.cwd(), "prisma");
const databaseFiles = ["e2e.db", "e2e.db-journal", "e2e.db-shm", "e2e.db-wal"];

for (const databaseFile of databaseFiles) {
  rmSync(join(prismaDirectory, databaseFile), { force: true });
}

closeSync(openSync(join(prismaDirectory, "e2e.db"), "w"));

execFileSync(join(process.cwd(), "node_modules", ".bin", "prisma"), ["migrate", "deploy"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    DATABASE_URL: "file:./e2e.db",
  },
  stdio: "inherit",
});

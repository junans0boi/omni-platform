import { execFileSync } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { join } from "node:path";
import { e2eDatabasePath, removeE2eDatabase } from "./database-artifacts.mjs";

const databaseName = process.env.E2E_DATABASE_NAME ?? "e2e.db";
const databasePath = databaseName === "e2e.db"
  ? e2eDatabasePath
  : join(process.cwd(), "prisma", databaseName);

removeE2eDatabase(databaseName);
closeSync(openSync(databasePath, "w"));

execFileSync(join(process.cwd(), "node_modules", ".bin", "prisma"), ["migrate", "deploy"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    DATABASE_URL: `file:./${databaseName}`,
  },
  stdio: "inherit",
});

execFileSync(join(process.cwd(), "node_modules", ".bin", "prisma"), ["generate"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

import { execFileSync } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { join } from "node:path";
import { e2eDatabasePath, removeE2eDatabase } from "./database-artifacts.mjs";

removeE2eDatabase();
closeSync(openSync(e2eDatabasePath, "w"));

execFileSync(join(process.cwd(), "node_modules", ".bin", "prisma"), ["migrate", "deploy"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    DATABASE_URL: "file:./e2e.db",
  },
  stdio: "inherit",
});

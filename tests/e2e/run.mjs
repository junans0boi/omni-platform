import { execFileSync, spawn } from "node:child_process";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { removeE2eDatabase } from "./database-artifacts.mjs";

const root = process.cwd();
const testEnvironment = {
  ...process.env,
  DATABASE_URL: "file:./e2e.db",
  E2E_MODE: "1",
};

function executable(name) {
  return `${root}/node_modules/.bin/${name}`;
}

async function waitForServer(server) {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next test server exited early with code ${server.exitCode}.`);
    }

    try {
      const response = await fetch("http://localhost:3100/login");
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }

    await delay(250);
  }

  throw new Error("Timed out waiting for the Next test server.");
}

async function stopServer(server) {
  if (server.exitCode !== null || server.pid === undefined) return;

  const exited = new Promise((resolve) => server.once("exit", resolve));

  server.kill("SIGTERM");

  await Promise.race([exited, delay(5_000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
  await exited;
}

execFileSync(process.execPath, ["tests/e2e/prepare-db.mjs"], {
  cwd: root,
  env: testEnvironment,
  stdio: "inherit",
});

// Remove stale .next cache — dev-mode chunks (e.g. 5611.js) left by a
// previous `next dev` run cause webpack-runtime "Cannot find module" crashes
// when `next start` tries to serve the new production build.
// Use `rm -rf` instead of rmSync to work around Node 24/macOS ENOTEMPTY.
execFileSync("rm", ["-rf", join(root, ".next")], { stdio: "inherit" });

// Build once before starting — eliminates incremental compiler race
// that caused /api/auth/signup 404 and .next/server ENOENT in next dev.
execFileSync(executable("next"), ["build"], {
  cwd: root,
  env: testEnvironment,
  stdio: "inherit",
});

const server = spawn(executable("next"), ["start", "-p", "3100"], {
  cwd: root,
  env: testEnvironment,
  stdio: ["ignore", "inherit", "inherit"],
});

let exitCode = 0;

try {
  await waitForServer(server);
  execFileSync(executable("playwright"), ["test"], {
    cwd: root,
    env: testEnvironment,
    stdio: "inherit",
  });
} catch (error) {
  exitCode = typeof error?.status === "number" ? error.status : 1;
  if (error?.status === undefined) console.error(error);
} finally {
  await stopServer(server);
  removeE2eDatabase();
}

process.exitCode = exitCode;

import { execFileSync, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import nextEnv from "@next/env";
import { removeE2eDatabase } from "../e2e/database-artifacts.mjs";

const root = process.cwd();
const databaseName = "livekit-e2e.db";
const { loadEnvConfig } = nextEnv;

loadEnvConfig(root);

const requiredEnvironment = [
  "NEXT_PUBLIC_LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);
if (missingEnvironment.length > 0) {
  throw new Error(`Missing LiveKit environment variable(s): ${missingEnvironment.join(", ")}`);
}

const testEnvironment = {
  ...process.env,
  DATABASE_URL: `file:./${databaseName}`,
  E2E_DATABASE_NAME: databaseName,
  RUN_LIVEKIT_E2E: "1",
};

function executable(name) {
  return `${root}/node_modules/.bin/${name}`;
}

async function waitForServer(server) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next LiveKit test server exited with code ${server.exitCode}.`);
    }
    try {
      const response = await fetch("http://127.0.0.1:3200/login");
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await delay(250);
  }
  throw new Error("Timed out waiting for the LiveKit test server.");
}

async function stopServer(server) {
  if (server.exitCode !== null || server.pid === undefined) return;
  const exited = new Promise((resolve) => server.once("exit", resolve));
  server.kill("SIGTERM");
  await Promise.race([exited, delay(5_000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
  await exited;
}

let server;
let exitCode = 0;
try {
  execFileSync(process.execPath, ["tests/e2e/prepare-db.mjs"], {
    cwd: root,
    env: testEnvironment,
    stdio: "inherit",
  });

  server = spawn(executable("next"), ["dev", "-p", "3200"], {
    cwd: root,
    env: testEnvironment,
    stdio: ["ignore", "inherit", "inherit"],
  });

  await waitForServer(server);
  execFileSync(executable("playwright"), ["test", "--config", "playwright.livekit.config.ts"], {
    cwd: root,
    env: testEnvironment,
    stdio: "inherit",
  });
} catch (error) {
  exitCode = typeof error?.status === "number" ? error.status : 1;
  if (error?.status === undefined) console.error(error);
} finally {
  if (server) await stopServer(server);
  removeE2eDatabase(databaseName);
}

process.exitCode = exitCode;

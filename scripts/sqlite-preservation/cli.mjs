#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildManifest, compareManifests, createReadOnlyBackup } from "./manifest.mjs";

const [command, ...args] = process.argv.slice(2);

if (command === "snapshot" && args.length === 3) {
  const [source, backup, manifest] = args.map(resolve);
  createReadOnlyBackup(source, backup);
  const evidence = buildManifest(backup);
  writeFileSync(manifest, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  if (!evidence.integrity.ok) process.exitCode = 1;
} else if (command === "verify" && args.length === 2) {
  const [sourcePath, targetPath] = args.map(resolve);
  const verdict = compareManifests(
    JSON.parse(readFileSync(sourcePath, "utf8")),
    JSON.parse(readFileSync(targetPath, "utf8")),
  );
  if (!verdict.ok) {
    console.error(verdict.mismatches.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("SQLite preservation parity verified.");
  }
} else {
  console.error("Usage: cli.mjs snapshot <source.db> <new-backup.db> <new-manifest.json>");
  console.error("   or: cli.mjs verify <source-manifest.json> <target-manifest.json>");
  process.exitCode = 2;
}

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";

const TABLES = {
  Profile: {
    timestamps: ["createdAt", "updatedAt"],
    unique: [["username"], ["email"]],
  },
  Session: {
    timestamps: ["createdAt", "expiresAt"],
    unique: [["tokenHash"]],
  },
  Space: {
    timestamps: ["createdAt", "archivedAt"],
    unique: [["inviteCode"]],
  },
  Category: { timestamps: ["createdAt"] },
  Channel: {
    timestamps: ["createdAt"],
    enums: { type: ["TEXT", "VOICE", "STAGE"] },
  },
  Member: {
    timestamps: ["createdAt"],
    unique: [["spaceId", "profileId"]],
    enums: { role: ["OWNER", "ADMIN", "MEMBER"] },
  },
  Message: { timestamps: ["createdAt", "editedAt"] },
  Reaction: {
    timestamps: ["createdAt"],
    unique: [["messageId", "profileId", "emoji"]],
  },
};

const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function query(databasePath, sql) {
  const output = execFileSync("sqlite3", ["-readonly", "-json", databasePath, sql], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  }).trim();
  return output ? JSON.parse(output) : [];
}

function scalar(databasePath, sql) {
  return query(databasePath, sql)[0]?.value;
}

function normalizeTimestamp(value) {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "number" || /^\d+$/.test(String(value))
    ? Number(value)
    : null;
  const date = new Date(numeric ?? String(value));
  if (Number.isNaN(date.valueOf())) throw new Error("Invalid timestamp found in SQLite source");
  return date.toISOString();
}

function duplicateCount(databasePath, table, columns) {
  const selected = columns.map(quoteIdentifier).join(", ");
  const nonNull = columns.map((column) => `${quoteIdentifier(column)} IS NOT NULL`).join(" AND ");
  return Number(scalar(databasePath, `
    SELECT COUNT(*) AS value FROM (
      SELECT ${selected} FROM ${quoteIdentifier(table)}
      WHERE ${nonNull} GROUP BY ${selected} HAVING COUNT(*) > 1
    )
  `));
}

function enumCounts(databasePath, table, column) {
  return Object.fromEntries(query(databasePath, `
    SELECT ${quoteIdentifier(column)} AS enumValue, COUNT(*) AS count
    FROM ${quoteIdentifier(table)} GROUP BY ${quoteIdentifier(column)}
    ORDER BY ${quoteIdentifier(column)}
  `).map(({ enumValue, count }) => [String(enumValue), Number(count)]));
}

export function createReadOnlyBackup(sourcePath, destinationPath) {
  if (!existsSync(sourcePath) || !statSync(sourcePath).isFile()) {
    throw new Error("SQLite source must be an existing regular file");
  }
  if (existsSync(destinationPath)) throw new Error("Backup destination already exists");
  if (realpathSync(sourcePath) === destinationPath) throw new Error("Backup must not overwrite source");

  const escapedDestination = destinationPath.replaceAll("'", "''");
  execFileSync("sqlite3", ["-readonly", sourcePath, `.backup '${escapedDestination}'`], {
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function buildManifest(databasePath) {
  if (!existsSync(databasePath) || !statSync(databasePath).isFile()) {
    throw new Error("SQLite snapshot must be an existing regular file");
  }

  const existingTables = new Set(query(databasePath, `
    SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
  `).map(({ name }) => name));
  const missing = Object.keys(TABLES).filter((table) => !existingTables.has(table));
  if (missing.length) throw new Error(`Missing required SQLite table(s): ${missing.join(", ")}`);

  const schemaRows = query(databasePath, `
    SELECT type, name, tbl_name, sql FROM sqlite_schema
    WHERE sql IS NOT NULL ORDER BY type, name
  `);
  const foreignKeyRows = query(databasePath, "PRAGMA foreign_key_check");
  /** @type {Record<string, {
   * rowCount: number,
   * primaryKeyHash: string,
   * foreignKeyOrphans: number,
   * invalidUuidCount: number,
   * uniqueDuplicateCounts: Record<string, number>,
   * enumCounts: Record<string, Record<string, number>>,
   * timestamps: Record<string, {min: string | null, max: string | null}>
   * }>} */
  const tableEvidence = {};
  let invalidEnums = 0;
  let duplicateUniqueKeys = 0;
  let invalidUuids = 0;

  for (const [table, contract] of Object.entries(TABLES)) {
    const ids = query(databasePath, `
      SELECT id FROM ${quoteIdentifier(table)} ORDER BY id
    `).map(({ id }) => String(id));
    const tableInvalidUuids = Number(scalar(databasePath, `
      SELECT COUNT(*) AS value FROM ${quoteIdentifier(table)}
      WHERE length(id) != 36 OR id NOT GLOB
        '[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]-[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]-[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]-[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]-[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'
    `));
    invalidUuids += tableInvalidUuids;

    const uniqueDuplicates = {};
    for (const columns of contract.unique ?? []) {
      const count = duplicateCount(databasePath, table, columns);
      uniqueDuplicates[columns.join("+")] = count;
      duplicateUniqueKeys += count;
    }

    const enums = {};
    for (const [column, allowed] of Object.entries(contract.enums ?? {})) {
      const counts = enumCounts(databasePath, table, column);
      enums[column] = counts;
      invalidEnums += Object.entries(counts)
        .filter(([value]) => !allowed.includes(value))
        .reduce((total, [, count]) => total + count, 0);
    }

    const timestamps = {};
    for (const column of contract.timestamps ?? []) {
      const range = query(databasePath, `
        SELECT MIN(${quoteIdentifier(column)}) AS minValue,
          MAX(${quoteIdentifier(column)}) AS maxValue FROM ${quoteIdentifier(table)}
      `)[0];
      timestamps[column] = {
        min: normalizeTimestamp(range?.minValue),
        max: normalizeTimestamp(range?.maxValue),
      };
    }

    tableEvidence[table] = {
      rowCount: ids.length,
      primaryKeyHash: sha256(ids.join("\n")),
      foreignKeyOrphans: foreignKeyRows.filter((row) => row.table === table).length,
      invalidUuidCount: tableInvalidUuids,
      uniqueDuplicateCounts: uniqueDuplicates,
      enumCounts: enums,
      timestamps,
    };
  }

  const integrity = {
    foreignKeyOrphans: foreignKeyRows.length,
    duplicateUniqueKeys,
    invalidEnums,
    invalidUuids,
  };

  return {
    formatVersion: 1,
    sourceChecksum: sha256(readFileSync(databasePath)),
    schemaFingerprint: sha256(JSON.stringify(schemaRows)),
    tables: tableEvidence,
    integrity: { ...integrity, ok: Object.values(integrity).every((count) => count === 0) },
  };
}

export function compareManifests(source, target) {
  const mismatches = [];
  for (const table of Object.keys(TABLES)) {
    for (const field of ["rowCount", "primaryKeyHash"]) {
      const expected = source.tables?.[table]?.[field];
      const received = target.tables?.[table]?.[field];
      if (expected !== received) {
        mismatches.push(`${table}.${field}: expected ${expected}, received ${received}`);
      }
    }
  }
  if (target.integrity?.ok !== true) mismatches.push("target.integrity.ok: expected true");
  return { ok: mismatches.length === 0, mismatches };
}

export const preservationTables = Object.freeze(Object.keys(TABLES));

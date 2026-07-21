import { execFileSync } from "node:child_process";

const TABLES = [
  ["Profile", "profiles", ["id", "username", "displayName", "avatarUrl", "createdAt", "updatedAt"]],
  ["Space", "spaces", ["id", "name", "avatarUrl", "inviteCode", "ownerId", "createdAt", "archivedAt"]],
  ["Category", "categories", ["id", "spaceId", "name", "position", "createdAt"]],
  ["Channel", "channels", ["id", "spaceId", "categoryId", "name", "type", "position", "createdAt"]],
  ["Member", "members", ["id", "spaceId", "profileId", "role", "createdAt"]],
  ["Message", "messages", ["id", "channelId", "profileId", "content", "createdAt", "editedAt"]],
  ["Reaction", "reactions", ["id", "messageId", "profileId", "emoji", "createdAt"]],
];

const snake = (value) => value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const timestamp = (key, value) =>
  (key.endsWith("At") && value !== null ? new Date(Number(value)).toISOString() : value);

function rows(databasePath, table, columns) {
  const sql = `SELECT ${columns.map((column) => `"${column}"`).join(",")}
    FROM "${table}" ORDER BY id`;
  const output = execFileSync("sqlite3", ["-readonly", "-json", databasePath, sql], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
  return output ? JSON.parse(output) : [];
}

export function buildImportBatches(databasePath) {
  return TABLES.map(([source, target, columns]) => ({
    table: target,
    rows: rows(databasePath, source, columns).map((row) =>
      Object.fromEntries(columns.map((column) => [snake(column), timestamp(column, row[column] ?? null)])),
    ),
  }));
}

/** Target must perform a primary-key upsert transactionally for each dependency-ordered batch. */
export async function importSQLiteSnapshot(databasePath, target) {
  for (const batch of buildImportBatches(databasePath)) {
    if (batch.rows.length > 0) await target.upsert(batch.table, batch.rows, { conflict: "id" });
  }
}

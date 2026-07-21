import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildManifest,
  compareManifests,
  createReadOnlyBackup,
} from "../../scripts/sqlite-preservation/manifest.mjs";
import { importSQLiteSnapshot } from "../../scripts/sqlite-preservation/importer.mjs";

const temporaryDirectories: string[] = [];

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "omni-preservation-"));
  temporaryDirectories.push(directory);
  const database = join(directory, "source.db");
  execFileSync("sqlite3", [database], {
    input: `
      PRAGMA foreign_keys=ON;
      CREATE TABLE Profile(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE,
        displayName TEXT, avatarUrl TEXT, password TEXT, passwordHash TEXT,
        createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
      CREATE TABLE Space(id TEXT PRIMARY KEY, name TEXT NOT NULL, avatarUrl TEXT, inviteCode TEXT UNIQUE NOT NULL,
        ownerId TEXT, createdAt INTEGER NOT NULL, archivedAt INTEGER,
        FOREIGN KEY(ownerId) REFERENCES Profile(id));
      CREATE TABLE Category(id TEXT PRIMARY KEY, spaceId TEXT NOT NULL, name TEXT NOT NULL,
        position INTEGER NOT NULL, createdAt INTEGER NOT NULL,
        FOREIGN KEY(spaceId) REFERENCES Space(id));
      CREATE TABLE Channel(id TEXT PRIMARY KEY, spaceId TEXT NOT NULL, categoryId TEXT, name TEXT NOT NULL,
        type TEXT NOT NULL, position INTEGER NOT NULL, createdAt INTEGER NOT NULL,
        FOREIGN KEY(spaceId) REFERENCES Space(id), FOREIGN KEY(categoryId) REFERENCES Category(id));
      CREATE TABLE Member(id TEXT PRIMARY KEY, spaceId TEXT NOT NULL, profileId TEXT NOT NULL,
        role TEXT NOT NULL, createdAt INTEGER NOT NULL, UNIQUE(spaceId, profileId),
        FOREIGN KEY(spaceId) REFERENCES Space(id), FOREIGN KEY(profileId) REFERENCES Profile(id));
      CREATE TABLE Message(id TEXT PRIMARY KEY, channelId TEXT NOT NULL, profileId TEXT NOT NULL,
        content TEXT NOT NULL, createdAt INTEGER NOT NULL, editedAt INTEGER,
        FOREIGN KEY(channelId) REFERENCES Channel(id), FOREIGN KEY(profileId) REFERENCES Profile(id));
      CREATE TABLE Reaction(id TEXT PRIMARY KEY, messageId TEXT NOT NULL, profileId TEXT NOT NULL,
        emoji TEXT NOT NULL, createdAt INTEGER NOT NULL, UNIQUE(messageId, profileId, emoji),
        FOREIGN KEY(messageId) REFERENCES Message(id), FOREIGN KEY(profileId) REFERENCES Profile(id));
      CREATE TABLE Session(id TEXT PRIMARY KEY, tokenHash TEXT UNIQUE NOT NULL, profileId TEXT NOT NULL,
        expiresAt INTEGER NOT NULL, createdAt INTEGER NOT NULL, FOREIGN KEY(profileId) REFERENCES Profile(id));
      INSERT INTO Profile VALUES('00000000-0000-4000-8000-000000000001','owner','owner@example.com',NULL,NULL,
        'plaintext-must-never-appear','hash-must-never-appear',1700000000000,1700000001000);
      INSERT INTO Space VALUES('00000000-0000-4000-8000-000000000002','Space',NULL,'invite-secret',
        '00000000-0000-4000-8000-000000000001',1700000002000,NULL);
      INSERT INTO Category VALUES('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','General',0,1700000003000);
      INSERT INTO Channel VALUES('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','general','TEXT',0,1700000004000);
      INSERT INTO Member VALUES('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','OWNER',1700000005000);
      INSERT INTO Message VALUES('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','private message',1700000006000,NULL);
      INSERT INTO Reaction VALUES('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','👍',1700000007000);
      INSERT INTO Session VALUES('00000000-0000-4000-8000-000000000008','token-must-never-appear','00000000-0000-4000-8000-000000000001',1800000000000,1700000008000);
    `,
  });
  return { directory, database };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true });
});

describe("SQLite preservation manifest", () => {
  it("backs up without changing the source and emits only redacted deterministic evidence", () => {
    const { directory, database } = fixture();
    const before = readFileSync(database);
    const backup = join(directory, "snapshot.db");

    createReadOnlyBackup(database, backup);
    const first = buildManifest(backup);
    const second = buildManifest(backup);

    expect(readFileSync(database)).toEqual(before);
    expect(first).toEqual(second);
    expect(first.tables.Message).toMatchObject({ rowCount: 1, foreignKeyOrphans: 0 });
    expect(first.tables.Channel.enumCounts.type).toEqual({ TEXT: 1 });
    expect(first.tables.Profile.timestamps.updatedAt).toEqual({
      min: "2023-11-14T22:13:21.000Z",
      max: "2023-11-14T22:13:21.000Z",
    });
    expect(first.integrity.ok).toBe(true);
    expect(JSON.stringify(first)).not.toMatch(/plaintext-must|hash-must|token-must|private message|invite-secret|owner@example/);
  }, 15_000);

  it("reports every parity mismatch and returns a failing verdict", () => {
    const { database } = fixture();
    const source = buildManifest(database);
    const target = structuredClone(source);
    target.tables.Message.rowCount = 2;
    target.tables.Message.primaryKeyHash = "different";

    expect(compareManifests(source, target)).toEqual({
      ok: false,
      mismatches: [
        "Message.rowCount: expected 1, received 2",
        `Message.primaryKeyHash: expected ${source.tables.Message.primaryKeyHash}, received different`,
      ],
    });
  }, 15_000);

  it("refuses to overwrite a backup", () => {
    const { directory, database } = fixture();
    const backup = join(directory, "snapshot.db");
    writeFileSync(backup, "keep");
    expect(() => createReadOnlyBackup(database, backup)).toThrow(/already exists/);
    expect(readFileSync(backup, "utf8")).toBe("keep");
  });

  it("imports dependency-ordered rows idempotently with UTC timestamps", async () => {
    const { database } = fixture();
    const stored = new Map<string, Map<string, Record<string, unknown>>>();
    const target = {
      async upsert(table: string, rows: Array<Record<string, unknown>>) {
        const tableRows = stored.get(table) ?? new Map();
        for (const row of rows) tableRows.set(String(row.id), row);
        stored.set(table, tableRows);
      },
    };

    await importSQLiteSnapshot(database, target);
    await importSQLiteSnapshot(database, target);

    expect([...stored.keys()]).toEqual([
      "profiles", "spaces", "categories", "channels", "members", "messages", "reactions",
    ]);
    expect(stored.get("messages")?.size).toBe(1);
    const importedMessage = [...(stored.get("messages")?.values() ?? [])][0];
    expect(importedMessage?.created_at).toBe("2023-11-14T22:13:26.000Z");
  });
});

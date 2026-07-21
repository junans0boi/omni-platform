# SQLite preservation manifest and verifier

Issue #54 establishes read-only evidence before any Supabase rehearsal. It does not import Auth
credentials, mutate the live SQLite file, reset a database, or authorize cutover.

## Safe snapshot

Choose new ignored paths outside the repository when handling real data. The command refuses to
overwrite either output and opens the source through SQLite's read-only mode.

```sh
node scripts/sqlite-preservation/cli.mjs snapshot \
  /absolute/path/source.db \
  /private/ignored/location/snapshot.db \
  /private/ignored/location/source-manifest.json
```

The redacted manifest contains only database/schema hashes, per-table counts and sorted primary-key
set hashes, FK orphan counts, duplicate unique-key counts, UUID/enum validation counts, and UTC
timestamp ranges. It never contains row content, emails, invite codes, password material, session
tokens, or identifiers. A non-zero integrity count exits unsuccessfully.

## Deterministic comparison

The target importer introduced with the isolated Supabase DDL/Auth slices must emit the same logical
manifest shape after explicit SQLite epoch-millisecond to UTC `timestamptz` conversion. Compare it
without printing row data:

```sh
node scripts/sqlite-preservation/cli.mjs verify source-manifest.json target-manifest.json
```

Any row-count, sorted PK-set hash, or target-integrity mismatch exits non-zero. The schema fingerprint
is audit evidence only: SQLite and Postgres necessarily have different physical schemas.

## Ownership boundary

- `prisma/dev.db`, its backups, and `prisma/migrations/**` remain unchanged.
- This slice deliberately excludes `Session` and Profile password fields from import payloads; the
  manifest only counts/hashes records. Supabase Auth claim/reset belongs to #56.
- PostgreSQL insertion is gated on the lossless DDL (#55) and Auth UUID provisioning (#56). Those
  slices must consume private data through an idempotent adapter and emit this comparator contract.
- Manifest files and database snapshots are operational artifacts and must never be committed.

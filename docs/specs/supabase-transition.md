# Supabase transition specification

Status: Accepted plan for GitHub issue #49. Implementation is intentionally deferred to
follow-up vertical slices.

## Outcome

Move the user-facing data plane from Prisma/SQLite and process-local SSE to Supabase
Auth/Postgres/RLS/Realtime while preserving every current domain record and keeping the
SQLite database, backup, and Prisma migrations unchanged. The evidence and rationale live in
[`docs/research/supabase-transition-strategy.md`](../research/supabase-transition-strategy.md)
and the ownership decision in
[`docs/adr/0001-supabase-owns-the-target-data-plane.md`](../adr/0001-supabase-owns-the-target-data-plane.md).

LiveKit configuration and E2E are outside this transition and remain in the dedicated
Wayfinder ticket.

## Invariants

- Never run a reset against a data-bearing SQLite or linked Supabase environment.
- Never delete, overwrite, commit, or silently restore `prisma/dev.db`, its ignored backups,
  or `prisma/migrations/**`.
- Preserve domain UUIDs, invite codes, content, ordering, nulls, role/channel values, and
  timestamps. Convert SQLite epoch milliseconds explicitly to UTC `timestamptz`.
- Never export credentials, password material, session tokens, or secret keys to Git,
  logs, issue text, manifests, or public tables.
- Never dual-write the same aggregate. SQLite is the sole writer before freeze; Supabase is
  the sole writer after cutover.
- Browser/user requests use a Supabase Auth JWT and RLS. A secret/service-role or direct
  Prisma connection is limited to migration and narrowly scoped trusted administration.

## Source snapshot and manifest

Every rehearsal and cutover starts from a new read-only SQLite backup. Its private manifest
records the source file checksum, schema fingerprint, per-table row counts, sorted PK-set
hashes, FK-orphan counts, unique-key duplicate counts, enum-like value counts, minimum and
maximum timestamps, and the highest domain update timestamp. The importer produces the same
normalized target measures.

The current read-only inventory is a sanity check only: 4 profiles, 5 sessions, 2 spaces,
2 categories, 5 channels, 5 memberships, 4 messages, and 2 reactions; no FK violations;
all entity IDs are UUID-shaped. Two profiles lack email and all four credentials use the
custom repository scrypt format. The older backup has fewer rows, so restoring it over the
current file would lose data.

## Lossless mapping

| Source | Target | Contract |
| --- | --- | --- |
| `Profile` | `auth.users` + `profiles` | Preserve the domain `id`; link the Auth-owned UUID through `auth_user_id` as decided by ADR 0003. Preserve username/display/avatar. Auth owns email and credentials. |
| `Session` | Supabase Auth session | Do not import; invalidate at cutover and require reauthentication. |
| `Space` | `spaces` | Preserve ID, owner, invite code, timestamps, and `archived_at`. |
| `Category` | `categories` | Preserve ID, Space FK, position, and timestamp. |
| `Channel` | `channels` | Preserve IDs/FKs/position/timestamp; validate `TEXT`, `VOICE`, `STAGE`. |
| `Member` | `members` | Preserve IDs/FKs/role/timestamp and unique Space/Profile pair. |
| `Message` | `messages` | Preserve content, IDs/FKs, `created_at`, and the currently omitted `edited_at`. |
| `Reaction` | `reactions` | Add the omitted target table and preserve its unique message/profile/emoji tuple. |

The target Auth SDK cannot create a caller-selected UUID, so ADR 0003 keeps the domain UUID
and links the generated Auth UUID through `profiles.auth_user_id`; no Profile or domain FK is
rewritten. Profiles without a unique user-controlled email remain preserved but cannot pass
the activation/cutover gate until a secure claim flow supplies and verifies one. Do not
invent routable or placeholder identities.

## Ordered gates

### 0. Preservation and rehearsal

Create the backup/manifest/verifier and use a separate local or staging Supabase target.
Confirm the existing remote target is understood before any migration. The tracked legacy
Supabase SQL is input to review, not an accepted baseline: it lacks reactions and edited
timestamps and its current policies do not meet the membership boundary.

### 1. #2-compatible Postgres DDL

Create a fresh, reproducible Supabase migration chain for all tables, constraints, indexes,
functions, grants, and the migration ledger. Apply it to an empty isolated target and run
synthetic parity tests. Supabase SQL is the only target schema authority.

### 2. #3-compatible Auth and profile transition

Apply ADR 0003's trusted Auth-to-legacy-Profile link on the exact target Auth version. Implement a
minimal, fixed-search-path profile trigger, a legacy account claim/reset flow, username and
email collision handling, and local-session invalidation. Import identities and then the
domain graph in FK order. The trigger and existing application signup must never both create
the same profile.

The repository scrypt representation is not assumed portable. A legacy password may be
verified only inside the trusted one-time claim boundary; plaintext exists only in request
memory and is never logged or persisted. Accounts without verified email block activation,
not preservation of their messages or memberships.

### 3. #4-compatible RLS

Enable RLS before exposing any public table. Test every supported CRUD operation as owner,
admin, member, non-member, anonymous user, and archived-Space member. Policies use explicit
`TO authenticated`, both `USING` and `WITH CHECK` where needed, prevent self-granted
membership/role escalation, deny archived-Space descendants, and prevent an owner from
leaving without transfer/archive. Trusted clients are excluded from proof because they
bypass RLS.

Account hard-delete semantics are not inferred from Auth cascading behavior. Until a
verified account-exit transaction has revoked sessions, resolved every owned Space, and
anonymized direct identifiers, no migration or UI may hard-delete an Auth user. Profile IDs
are durable domain UUIDs; a nullable, unique Auth link uses `ON DELETE SET NULL` rather than
making the Profile primary key cascade from Auth. The accepted lifecycle policy is recorded
in [`ADR 0002`](../adr/0002-account-exit-preserves-anonymized-history.md).

RLS must resolve the current active Profile through that Auth link instead of assuming
`auth.uid()` is forever interchangeable with the Profile ID. A pending, disabled, or
anonymized account is denied even if it presents an otherwise unexpired JWT. Membership
checks count only active Profiles in active Spaces. The test matrix additionally proves
that Auth deletion leaves Profile and Message history intact, anonymized accounts cannot
read or mutate domain data, and an owner cannot remove their OWNER membership before an
atomic transfer or Space archive.

The restricted exit operation deletes Memberships and Reactions, clears public identifiers
and profile storage, then deletes the Auth user while retaining the anonymized Profile and
Messages. It must be idempotent and transactional across database state; external Auth and
Storage cleanup uses a retryable ledger. Normal exit runs after a 30-day cancellation
window, while verified legal erasure skips the window. Restore procedures replay completed
ledger entries before serving restored data.

### 4. Shadow, freeze, cutover

Keep SQLite as the sole writer and compare normalized shadow reads. On zero unexplained
mismatches, freeze writes, create the final backup/manifest, import the final data, repeat
all integrity/Auth/RLS checks, then switch Auth, reads, and writes in one deployment gate.
Keep SQLite read-only through the observation window.

### 5. #6-compatible Realtime and Presence

After RLS passes, publish only durable change tables. Use authenticated private topics based
on immutable Space/Channel IDs and membership policies on `realtime.messages` for Broadcast
and Presence. Convert raw changes to the existing UI contract through an authorized refetch
or adapter; Postgres Changes does not supply the current joined message/reaction DTO.
Remove SSE only after two-user delivery, non-member denial, reconnect/JWT-refresh, multi-tab,
and multi-instance tests pass.

## Prisma/Supabase boundary

`OMNI_PLATFORM_BACKEND=legacy|supabase` is the single deployment authority gate. There is
no independent Auth switch: #60 changes Auth, reads, and writes together after rehearsal so
the application cannot enter a mixed-writer state.

| Phase | Prisma/SQLite | Supabase |
| --- | --- | --- |
| Rehearsal | Production writer; read-only export source | Isolated shadow/import target |
| Freeze | Read-only final snapshot | Final import and verification; writes disabled |
| Cutover | Read-only rollback evidence | Auth, domain reads/writes, RLS, Realtime authority |
| Observation end | Archived only after explicit approval | Sole data plane |

Prisma may implement a trusted exporter or reconciliation reader. It may not migrate
Supabase-owned objects or serve ordinary user CRUD through a privileged direct connection.
CamelCase application DTOs may remain stable behind an explicit snake_case adapter.

## Stop and rollback criteria

Stop before writes on any checksum/PK/count/timestamp mismatch, FK orphan, invalid enum,
identity collision, unresolved active account, trigger failure, authorization leak/denial,
or Realtime privacy/delivery failure. Error and latency thresholds must be declared by the
cutover drill rather than invented during an incident.

Before the first Supabase write, rollback switches the deployment to unchanged SQLite and
invalidates target test sessions. After the first accepted write, do not switch database
authority back blindly. Freeze writes and either run a tested reverse reconciliation,
forward-fix Supabase, or restore Supabase to an agreed recovery point. The application code
may be rolled back independently only when its old version is compatible with the Supabase
schema.

## Completion evidence per slice

Each follow-up ticket must provide versioned migrations/scripts, isolated-target replay,
automated positive and negative tests, a redacted manifest comparison, `git diff --check`,
typecheck/lint/build where applicable, and a resolution comment linking the evidence. The
SQLite files and credential values never appear in the commit or issue.

## Follow-up graph

- [SQLite preservation manifest and deterministic import verifier](https://github.com/junans0boi/omni-platform/issues/54)
  -> [Supabase Postgres lossless DDL baseline](https://github.com/junans0boi/omni-platform/issues/55)
  -> [Supabase Auth legacy account claim and profile trigger](https://github.com/junans0boi/omni-platform/issues/56)
  -> [Supabase membership RLS CRUD matrix](https://github.com/junans0boi/omni-platform/issues/58)
  -> [Supabase Realtime and private Presence transition](https://github.com/junans0boi/omni-platform/issues/59)
  -> [Supabase freeze, cutover, and rollback rehearsal](https://github.com/junans0boi/omni-platform/issues/60).
- [Account deletion and domain-history preservation](https://github.com/junans0boi/omni-platform/issues/57)
  is resolved by ADR 0002; the RLS slice must implement its authorization invariants.
- The cutover rehearsal is additionally blocked by
  [the test/E2E/CI baseline](https://github.com/junans0boi/omni-platform/issues/50).

These issues are children of the Wayfinder map and carry native blocking relationships. The
closed historical #2, #3, #4, and #6 remain evidence of the earlier incomplete implementation;
the follow-ups close the exact Supabase gaps without deleting the recovered SQLite work.

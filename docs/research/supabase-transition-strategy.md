# Supabase transition and local-data preservation strategy

- Status: Accepted research decision for [#49](https://github.com/junans0boi/omni-platform/issues/49)
- Date: 2026-07-21
- Scope: Prisma/SQLite to Supabase Auth/Postgres/RLS/Realtime

## Decision summary

Move to Supabase in vertical, reversible gates. Keep `prisma/dev.db`, its backup, and
the existing SQLite Prisma migration history intact until a separately approved
decommission gate. Use versioned Supabase SQL migrations as the only owner of the target
Postgres DDL, Auth trigger, grants, RLS policies, and Realtime configuration. During the
transition, Prisma may read SQLite and may be used by trusted server-side migration tools;
it must not co-own the Supabase-managed `auth` or `realtime` schemas or provide a second
write path to the same production aggregate.

The required implementation order is:

`#2 target DDL -> #3 Auth/profile identity -> #4 RLS -> #6 Realtime/Presence`

Presence does not require a Postgres Changes publication, but private Presence authorization
depends on an Auth JWT and the membership model/RLS. It therefore remains after #4 in the
product dependency graph.

## Evidence from the repository

The source SQLite model contains `Profile`, `Session`, `Space`, `Category`, `Channel`,
`Member`, `Message`, and `Reaction`. The existing Supabase migration is not yet a lossless
target: it omits `profiles.email`, reactions, `messages.edited_at`, and the behavior that
replaces local sessions; it also exposes all profiles and contains policies that require a
fresh security review. It must not be treated as already satisfying #2-#4.

The read-only 2026-07-21 inventory found 4 profiles, 5 local sessions, 2 spaces,
2 categories, 5 channels, 5 memberships, 4 messages, and 2 reactions. All persisted entity
IDs are UUID-shaped and SQLite reports no foreign-key violation. Two profiles have no email;
all four use the repository's custom Node `scrypt` representation. Persisted Prisma
`DateTime` values are SQLite integer epoch milliseconds, so the importer must not treat them
as ISO text. The older ignored backup contains fewer rows than the current database and is
recovery evidence, not an authoritative replacement. These counts are an audit
snapshot, not hard-coded migration expectations; the migration tool must calculate a fresh
manifest immediately before every rehearsal and cutover.

Prisma migration SQL is provider-specific, so SQLite migration files cannot be reused as the
PostgreSQL history. Prisma documents provider mismatch as a migration limitation. Preserve
the SQLite history and establish a separate Supabase/Postgres history rather than editing or
deleting applied SQLite migrations. [Prisma Migrate limitations](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/limitations-and-known-issues)

## Target data mapping

| SQLite source | Supabase target | Conversion and preservation rule |
| --- | --- | --- |
| `Profile.id` | `auth.users.id`, `public.profiles.id` | Preserve the UUID exactly when provisioning Auth users. The target profile PK is also the Auth FK. Abort on any invalid/colliding ID. |
| `Profile.username` | `profiles.username`, Auth user metadata | Preserve exactly; verify uniqueness before import. The public table remains authoritative for domain display/search. |
| `Profile.email` | `auth.users.email` | Require a unique, user-controlled email before account activation. The two currently missing values block those accounts, not business-data import. Do not invent routable addresses. |
| `Profile.displayName`, `avatarUrl` | `profiles.display_name`, `avatar_url` | Rename camelCase to snake_case; preserve nulls. |
| `Profile.password`, `passwordHash` | none directly | Never copy plaintext or an unverified hash into public tables or artifacts. Use an account claim/password-reset flow for the custom scrypt format. |
| `Session` | Supabase Auth sessions | Do not import. Invalidate local cookies/sessions at Auth cutover and require Supabase reauthentication. |
| `Space` | `spaces` | Preserve UUID, invite code, owner UUID, timestamps, and `archived_at`; verify the owner profile exists. |
| `Category` | `categories` | Preserve UUID, parent UUID, position, and timestamps. |
| `Channel` | `channels` | Preserve UUID/FKs/position/timestamps; constrain type to `TEXT`, `VOICE`, or `STAGE`. |
| `Member` | `members` | Preserve UUID/FKs/role/timestamp; retain unique `(space_id, profile_id)` and constrain the current roles. |
| `Message` | `messages` | Preserve UUID/FKs/content/`created_at` and add the currently missing `edited_at`. |
| `Reaction` | `reactions` | Add the missing table; preserve UUID/FKs/emoji/timestamp and unique `(message_id, profile_id, emoji)`. |

Supabase's official user-data pattern keeps API-visible user data in a protected public table
whose UUID primary key references `auth.users(id) on delete cascade`. It recommends a signup
trigger for keeping that row in sync. [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data)

The Auth admin API supports server-side user creation and must never expose the privileged
key to a browser. Existing IDs should be supplied explicitly during the controlled import so
all business foreign keys remain stable. The official client type exposes the optional `id`
override used for this purpose. [Supabase admin `createUser`](https://supabase.com/docs/reference/javascript/auth-admin-createuser) and [Supabase Auth client types](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/lib/types.ts#L523-L596)

Do not assume the current custom scrypt string is portable. Supabase's documented general
Auth migration path accepts bcrypt and Argon2 hashes; the repository's format is neither of
those documented formats. Therefore the safe accepted path is user claim/reset unless a
staging compatibility test against the exact deployed Auth version proves otherwise.
[Supabase Auth0 migration guide](https://supabase.com/docs/guides/platform/migrating-to-supabase/auth0)

Dates must be explicitly parsed and normalized to UTC `timestamptz`; do not rely on implicit
SQLite-to-Postgres coercion. Validate enum-like text, nullability, uniqueness, integer ranges,
and every FK before insertion. Prisma's connectors have different native/default mappings,
including SQLite and PostgreSQL `DateTime` behavior. [Prisma SQLite mapping](https://www.prisma.io/docs/orm/overview/databases/sqlite) and [Prisma PostgreSQL mapping](https://www.prisma.io/docs/orm/overview/databases/postgresql)

## Staged transition

### Gate 0: immutable source and manifest

1. Stop using destructive commands such as `prisma migrate reset`, `prisma db push`, or
   `supabase db reset --linked` against data-bearing environments.
2. Make a timestamped SQLite copy outside Git and record its checksum, schema version, table
   counts, PK set hashes, FK-orphan counts, unique-key duplicates, and maximum timestamps.
3. Keep `prisma/migrations/**` unchanged. Never commit database copies or exported credentials.
4. Define measurable error, latency, and reconciliation thresholds before cutover.

`prisma migrate reset` is explicitly data-destructive. Supabase likewise documents that a
linked reset drops and rebuilds the remote database. [Prisma migrate CLI](https://www.prisma.io/docs/cli/migrate) and [Supabase local workflow](https://supabase.com/docs/guides/local-development/cli-workflows)

### Gate 1: #2 target DDL

1. Replace the incomplete target baseline with reviewed, additive Supabase migrations for
   every mapped table, constraint, index, function, and grant.
2. Exercise the complete migration chain on an isolated local/staging Supabase stack.
3. Exercise the importer with synthetic data in dependency order. Do not copy the real
   profiles or dependent rows until Gate 2 has provisioned matching Auth identities.
4. Compare the generated manifest: equal row and PK-set counts, orphan count zero, all
   unique/check constraints satisfied, normalized timestamps/content equivalent.

Supabase supports CSV/COPY, API, and `pgloader` import paths. Because this dataset has
identity and timestamp transformations, use a versioned, idempotent importer with explicit
per-table transforms rather than an opaque one-shot copy. This tooling choice is an inference
from the supported import mechanisms and the repository constraints.
[Supabase importing data](https://supabase.com/docs/guides/database/import-data)

### Gate 2: #3 Auth and profiles

1. Install a minimal `security definer set search_path = ''` signup trigger that creates only
   the public profile row needed by the domain.
2. Rehearse trigger success, duplicate username, missing metadata, rollback-on-error, and
   Auth-user deletion behavior. A broken trigger can block signup, so trigger errors are a
   hard stop.
3. Provision legacy users server-side with their existing UUID where account prerequisites
   are met; first prove against the exact staging Auth version that explicit UUID creation is
   supported, and abort on collision. Preserve profile data without publishing credentials.
4. For profiles without a verified unique email or portable password, retain their business
   rows but mark account activation pending. Complete a claim/reset flow before allowing login.
5. Invalidate all Prisma `Session` rows/cookies at cutover. Do not attempt to translate them
   into Supabase refresh tokens.
6. Import the final identity-linked domain graph in dependency order: profiles, spaces,
   categories, channels, members, messages, reactions. Normalize SQLite epoch milliseconds
   explicitly to UTC `timestamptz` and preserve every existing UUID.

The trigger shape and warning that trigger failure can block signup come from Supabase's
official pattern. [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data)

### Gate 3: #4 RLS

1. Enable RLS on every exposed `public` table before browser/Data API access.
2. Add explicit `TO authenticated` policies, using space membership as the common boundary.
3. Test an allow/deny matrix with at least owner, admin, member, non-member, anonymous, and
   archived-space cases for every SELECT/INSERT/UPDATE/DELETE path.
4. Include `WITH CHECK` for inserted/updated ownership and membership values. Add the SELECT
   policies required for UPDATE to work.
5. Keep secret/service-role clients server-only. Because they bypass RLS, they are migration
   and trusted-administration tools, not substitutes for end-user policy tests.

Tables in exposed schemas require RLS; once RLS is enabled, API access is denied until an
applicable policy exists. Supabase also documents UPDATE/SELECT and `WITH CHECK` semantics.
[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
Privileged keys bypass RLS and must not reach the browser.
[Supabase secure data](https://supabase.com/docs/guides/database/secure-data)

### Gate 4: shadow comparison and write cutover

1. Keep SQLite as the sole writer while target reads run in shadow and their normalized
   results are compared. Shadow reads must not affect user-visible behavior.
2. Fix all mismatches, rerun the full import from a fresh source copy, and pass Gates 1-3.
3. Enter a short maintenance/write freeze, take the final source manifest/copy, import the
   final delta or rerun the idempotent import, and verify again.
4. Switch Auth, reads, and writes together behind a single deployment/feature gate. Never
   dual-write aggregates to SQLite and Supabase: partial failure makes source-of-truth and
   rollback ambiguous.
5. Retain SQLite read-only through the observation window.

Prisma recommends expand-and-contract migration, transactional backfills where possible,
backups, and rehearsal on production-like data. The gates above apply those principles to a
cross-provider cutover. [Prisma data migration guide](https://www.prisma.io/docs/guides/database/data-migration)

### Gate 5: #6 Realtime and Presence

1. Add only durable tables that need Postgres Changes to the `supabase_realtime` publication.
2. Confirm RLS SELECT policies before subscribing; Postgres Changes only sends rows readable
   by the subscriber. Treat DELETE payloads specially because old-row/RLS information is
   limited.
3. Use private, namespaced topics derived from immutable space/channel IDs.
4. Authorize Broadcast and Presence on `realtime.messages`: SELECT permits receiving/listening
   and INSERT permits broadcasting/tracking. Each policy must verify the Auth user is a member
   of the topic's space.
5. Refresh the Realtime channel's JWT after Auth refresh; authorization is evaluated on join
   and cached for the connection.
6. Replace process-local SSE only after two-user allow tests, non-member denial tests,
   reconnect/token-refresh tests, and multi-instance behavior pass.

Postgres Changes publication setup and RLS delivery behavior are documented by Supabase.
[Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
Private Broadcast/Presence uses policies on `realtime.messages`, Auth JWTs, and topics; policy
complexity can also increase join latency.
[Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)

## Prisma and Supabase ownership boundary

| Concern | Owner during migration | Final owner |
| --- | --- | --- |
| Existing SQLite files and history | Prisma, read/write until freeze | Archived read-only evidence until decommission |
| Target `public` schema, constraints, triggers, policies, publication | Supabase SQL migrations | Supabase SQL migrations |
| `auth.*`, Auth users/sessions/JWTs | Supabase Auth | Supabase Auth |
| `realtime.*`, private topic authorization | Supabase Realtime + SQL policies | Supabase Realtime + SQL policies |
| Backfill/reconciliation | Trusted server-only script; Prisma allowed for SQLite source | Removed after acceptance |
| End-user authorization | Existing server checks before cutover; target RLS tests in shadow | Supabase Auth JWT + RLS |

Do not let Prisma Migrate and Supabase migrations alter the same Postgres object. If Prisma is
temporarily retained for trusted target reads, introspect the target but keep Supabase-managed
schemas and unsupported security objects outside Prisma's migration ownership. Prisma's
externally managed tables feature exists for service-owned tables but is currently Preview,
so it is not required for this transition.
[Prisma externally managed tables](https://www.prisma.io/docs/orm/prisma-schema/data-model/externally-managed-tables)

## Rollback and stop criteria

Before target writes begin, rollback is a deployment flag reversal to the unchanged SQLite
application plus invalidation of any target test sessions. Restore the source from its
verified pre-cutover copy only if the original file was damaged; otherwise leave it untouched.

After the first accepted Supabase write, a blind switch back to SQLite is forbidden because
it would discard target-only changes. Choose one of these explicitly:

- freeze writes and run a tested reverse reconciliation before returning to SQLite;
- keep writes frozen and forward-fix Supabase;
- restore Supabase to a known recovery point, accepting the documented downtime and recovery
  point.

Stop or roll back the current gate on any of the following:

- backup/checksum cannot be verified;
- row count or PK-set mismatch, orphan FK, duplicate unique key, invalid enum, or timestamp
  conversion mismatch;
- Auth UUID mismatch, missing required account identity, trigger-caused signup failure, or
  unexpected session survival;
- any RLS matrix leak or valid-user denial;
- Realtime event leak, missed durable event beyond the agreed threshold, unauthorized
  Presence join, or failed JWT refresh/reconnect;
- sustained error or latency above the predeclared threshold.

Supabase provides backup/restore options but restore makes the project unavailable during the
operation; free-tier projects should take regular off-site CLI dumps. Recovery is therefore a
rehearsed contingency, not the normal application rollback mechanism.
[Supabase backups](https://supabase.com/docs/guides/platform/backups)

## Required durable artifacts and follow-up slices

Create these artifacts before implementation closes the related ticket:

1. ADR: Supabase SQL owns Postgres schema/security/Realtime; Prisma is transition-only for
   trusted legacy access.
2. Migration spec/runbook: exact column conversions, account-claim flow, manifest format,
   import idempotency, freeze/delta steps, thresholds, reverse reconciliation, and operators.
3. Security spec: space-membership allow/deny matrix for public tables and private Realtime
   topics.

The follow-up work is tracked as linked Wayfinder children:

1. [SQLite preservation manifest and deterministic import verifier](https://github.com/junans0boi/omni-platform/issues/54)
2. [Supabase Postgres lossless DDL baseline (#2 follow-up)](https://github.com/junans0boi/omni-platform/issues/55)
3. [Supabase Auth legacy account claim and profile trigger (#3 follow-up)](https://github.com/junans0boi/omni-platform/issues/56)
4. [Account deletion and domain-history preservation decision](https://github.com/junans0boi/omni-platform/issues/57)
5. [Supabase membership RLS CRUD matrix (#4 follow-up)](https://github.com/junans0boi/omni-platform/issues/58)
6. [Supabase Realtime and private Presence transition (#6 follow-up)](https://github.com/junans0boi/omni-platform/issues/59)
7. [Supabase freeze, cutover, and rollback rehearsal](https://github.com/junans0boi/omni-platform/issues/60)

Legacy decommission is not authorized by these tickets. It can happen only after the
observation window and explicit data-owner approval; archive rather than silently delete the
SQLite evidence and history.

## Non-decisions

- This research does not select a hosted Supabase project, region, paid backup tier, or
  operational secret values.
- It does not change LiveKit configuration or #53.
- It does not authorize deletion/reset of SQLite data or migrations.
- It does not approve the current `supabase/migrations/20260720000000_init_schema.sql` as the
  final #2/#3/#4 implementation.

# Auth identity links to a durable Profile UUID

## Status

Accepted for the Supabase Auth transition in #56.

## Context

The installed Supabase Auth admin SDK and its public `createUser` contract do not accept a
caller-selected user UUID. Requiring `auth.users.id` to equal every imported `profiles.id`
would therefore make the cutover depend on an unsupported Auth-internal write. Rewriting
Profile primary keys and every domain foreign key would add avoidable migration risk.

## Decision

Keep each legacy `profiles.id` and every domain foreign key unchanged. Let Supabase Auth own
its generated user UUID and link it through the existing nullable, unique
`profiles.auth_user_id` column.

Fresh public signup still creates a Profile whose ID initially equals the Auth ID. A trusted
legacy import creates the Auth identity with `app_metadata.legacy_profile_id`; the fixed
search-path trigger locks that exact unclaimed Profile and stores the generated Auth ID in
`auth_user_id`. User-controlled signup metadata cannot choose a legacy Profile. Username,
email, Profile-link, account-state, and concurrent-update collisions stop the transaction.

Custom scrypt credentials and Prisma sessions are never imported. An imported identity is
activated only after the user proves control of its email through Supabase recovery and the
Profile becomes `ACTIVE`. Profiles without a verified user-controlled email and all their
domain history remain preserved but disabled until a trusted claim process supplies one.

## Consequences

- Domain UUIDs remain stable without unsupported writes to `auth.users`.
- RLS must resolve the active Profile by `profiles.auth_user_id = auth.uid()`; it must never
  assume the Auth and Profile UUIDs are equal.
- A collision or unsupported target behavior aborts the rehearsal. There is no automatic
  primary-key rewrite fallback.

# Supabase owns the target data plane

Omni Platform will move to Supabase Auth, Postgres, RLS, and Realtime without deleting or
rewriting the existing Prisma/SQLite database or migration history. Versioned Supabase SQL
migrations exclusively own target DDL, Auth/profile triggers, grants, RLS, and Realtime;
Prisma is limited to the legacy SQLite source and trusted migration/reconciliation tooling.
This avoids two schema authorities and split-brain dual writes while retaining a verified
rollback source until an explicit decommission decision.

## Consequences

- A migrated aggregate has exactly one writer; shadow operation compares reads only.
- Existing UUIDs, invite codes, relationships, content, and timestamps are preserved.
- Local sessions and custom password hashes are not target domain data; accounts use a
  staged claim/reset path and Supabase sessions.
- A Profile UUID is a durable domain identifier, not the lifecycle owner of an Auth user.
  The nullable Auth link uses `ON DELETE SET NULL`; deleting an Auth user must not cascade
  through the retained domain graph. Account-exit behavior is defined by ADR 0002.
- Before Supabase accepts writes, rollback is an application switch to unchanged SQLite.
  Afterwards, database rollback requires a frozen, tested reverse reconciliation or a
  Supabase recovery/forward-fix; a blind switch would lose accepted writes.

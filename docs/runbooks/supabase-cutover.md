# Supabase cutover rehearsal

The release owner is the sole go/no-go owner. The database operator performs the commands;
the incident commander independently reads every redacted result. Credentials, row contents,
tokens, URLs, and identifiers must not be copied into this runbook, CI logs, or issues.

## Fixed gate and thresholds

`OMNI_PLATFORM_BACKEND=legacy|supabase` is the only authority gate. Auth, CRUD, and Realtime
must switch together; mixed values are invalid. Stop on any unexplained manifest mismatch,
FK orphan, identity collision, Auth/RLS denial or leak, Realtime delivery failure, error rate
above 1%, or p95 application latency above 750 ms.

## Rehearsal

1. Announce the staging write freeze and verify the application rejects mutations.
2. Create a new read-only SQLite snapshot and redacted manifest with the preservation CLI.
3. Import the snapshot into an empty isolated Supabase target twice; the second run must be a
   no-op. Compare counts, PK-set hashes, UTC timestamp ranges, and integrity counters.
4. Run signup, verified legacy UUID claim, session refresh, user-JWT RLS CRUD matrix, private
   Realtime two-user/non-member/multi-tab/reconnect tests, and process restart/multi-instance tests.
5. Deploy once with `OMNI_PLATFORM_BACKEND=supabase`, verify the first write and its single
   Realtime delivery, then observe metrics for 60 minutes. SQLite remains read-only.
6. Record only commit SHA, migration versions, redacted manifest hashes, pass/fail counts,
   timestamps, and the named owner's decision.

## Rollback drills

Before the first Supabase write, deploy the unchanged commit with the gate set to `legacy`,
invalidate target test sessions, and prove the SQLite manifest is unchanged. After the first
accepted Supabase write, freeze writes: never point ordinary traffic back to SQLite. Use a tested
reverse reconciliation into a new SQLite copy, forward-fix Supabase, or restore Supabase to the
agreed recovery point. Resume only after the full gate passes.

The observation window ends only with owner sign-off. Archiving or deleting SQLite databases or
Prisma migrations requires separate explicit approval and is not part of this procedure.

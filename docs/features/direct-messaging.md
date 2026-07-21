# Friendship and direct messaging policy

Issue: [#25](https://github.com/junans0boi/omni-platform/issues/25)

Home communication is independent of Space Membership. A `Friendship` stores one
lexicographically ordered Profile pair, so reversing requester and recipient cannot
create a second relationship. The requester is recorded separately from the pair.

## Lifecycle

1. A Profile requests another active Profile by exact, case-normalized username.
2. Self requests, an existing pending request, an accepted pair, and a blocked pair
   are rejected. A declined or removed pair may be requested again by updating the
   existing row.
3. Only the recipient can accept or decline. Acceptance locks the Friendship and
   creates or reuses its one `DirectConversation` with exactly two participants.
4. Either accepted friend can unfriend or block. Only the blocker can unblock.

## Authorization and retention

- Only the two durable `DirectParticipant` rows may list a conversation, read its
  message history, or subscribe to `dm:<conversation-id>` private Realtime.
- New messages additionally require the Friendship to be `ACCEPTED`; anonymous and
  third-user JWTs fail RLS, and route authorization returns `403`.
- `REMOVED` and `BLOCKED` stop new sends immediately but preserve history for the
  original two participants. This avoids silently deleting the other participant's
  copy of shared history and matches the account-exit history policy.
- Blocking never deletes or broadens visibility. Unblocking returns the pair to
  `REMOVED`, so a fresh request and acceptance are required before another send.

The legacy Prisma/SQLite migration is append-only. The Supabase migration exposes
friendship transitions through JWT-bound, locked RPCs; raw Friendship and participant
writes are not granted to clients.

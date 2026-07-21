# Account exit preserves anonymized conversation history

Status: Accepted

Date: 2026-07-21

Decision: [GitHub issue #57](https://github.com/junans0boi/omni-platform/issues/57)

## Context

An Auth user, the Profile shown in the product, and the messages attributed to that Profile
have different lifetimes. Letting `auth.users` own the Profile with `ON DELETE CASCADE`
would make an authentication operation erase Memberships, Messages, and Reactions. Keeping
all account data indefinitely would instead retain credentials and personal identifiers
that are unnecessary after exit. Owner exit also cannot leave an active Space ownerless or
silently grant another person elevated authority.

## Decision

User Identity and Profile have independent lifecycles. `profiles.id` remains the durable
domain UUID. The target stores the Auth association in a nullable, unique
`profiles.auth_user_id` reference with `ON DELETE SET NULL`; it must not cascade domain rows
from `auth.users`.

Account exit follows these rules:

1. A verified exit request immediately disables login, revokes sessions, and removes all
   domain access. A 30-day cancellation window follows. Cancellation requires verified
   account recovery.
2. Before a normal request is accepted, every active Space owned by the Profile must either
   be transferred explicitly to an active member of that Space or archived. The system does
   not choose a successor. Transfer changes the Space owner and OWNER Membership atomically
   and preserves exactly one active owner.
3. At the end of the window, a trusted server transaction removes the Auth user, credentials,
   sessions, profile avatar/storage objects, Memberships, and Reactions. It clears display
   name and avatar, replaces the internal unique username with a non-derived random value,
   removes the Auth link, and marks the Profile anonymized. No mapping back to the former
   identity is retained.
4. Messages remain as shared conversation history and keep their Profile foreign key. All
   consumers render an anonymized Profile as the constant label `탈퇴한 사용자`; they do
   not expose its internal username or former avatar. Users can delete their own messages
   before exit. A verified request concerning personal information inside message content
   is handled by deleting or redacting that content rather than by restoring identity data.
5. A verified legal-erasure request skips the cancellation window. Unresolved owned Spaces
   are archived so ownership cannot delay erasure indefinitely. Data that is not required
   for retained conversation integrity is removed.
6. A restore from operational backup must replay the durable deletion ledger before serving
   traffic, so restoration cannot reactivate an exited account or re-publish erased data.

Account exit is an orchestrated, restricted operation, not a sequence of browser-writable
table mutations. Completion is irreversible after anonymization.

## Consequences

- Auth deletion cannot erase Messages or the Profile row required by their foreign keys.
- Membership is current authorization state, so exited accounts retain no Membership row.
- Reactions are removed as nonessential personal activity; message content is retained for
  conversation continuity under a tombstone author.
- Profile APIs and RLS must distinguish active Profiles from pending, disabled, and
  anonymized Profiles. A surviving JWT alone never grants access.
- Owner transfer/archive is a prerequisite and transactional invariant. An active Space
  cannot have a null, inactive, or ambiguous owner.
- The DDL/Auth slices must replace the current `profiles.id -> auth.users ON DELETE CASCADE`
  relationship before any account-deletion feature is enabled.

## Alternatives rejected

- **Cascade-delete the entire graph:** destroys other members' shared history and can remove
  far more data than the user intended by deleting an authentication record.
- **Retain the active Profile forever:** keeps unnecessary personal identifiers and leaves
  a misleading visible identity after credentials are removed.
- **Automatically promote another member:** grants authority without an explicit owner
  decision and is unsafe when no suitable active member exists.
- **Keep Memberships and Reactions as history:** retains more user-linked activity than is
  required for referential integrity or conversation comprehension.

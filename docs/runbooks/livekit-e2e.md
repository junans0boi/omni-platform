# LiveKit Voice and Stage E2E

Issue #53 owns the credential-gated verification of the real LiveKit service. It is separate
from the secrets-free pull-request baseline and never records tokens, keys, secrets, or environment
values in output or artifacts.

## Run

Provide `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` through an ignored
local environment file, then run:

```sh
npm run test:livekit
```

The runner creates only `prisma/livekit-e2e.db`, deploys committed Prisma migrations, starts an
owned Next server on port 3200, runs headless Chromium with fake camera/microphone/display media,
then stops the server and removes that test database. It never opens, migrates, copies, or removes
`prisma/dev.db` or its backups. Playwright tracing is disabled because network traces could retain
short-lived room tokens.

## Verified contract

- Owner and Member receive publish/subscribe grants in a VoiceChannel.
- Both users connect to the same real room and observe the remote participant.
- Camera and screen-share publications reach the other browser.
- StageChannel Owner can publish; ordinary Member is subscribe-only in both token and controls.
- An authenticated non-member cannot receive a room token.
- The runner closes both browser contexts and leaves no local test database behind.

## Failure routing

| Failure | Route |
| --- | --- |
| Missing environment name | local configuration; do not open an issue containing values |
| Token endpoint 401/403 for a valid Member | auth/membership regression ticket |
| Token endpoint 500 or room connection rejection | LiveKit configuration/operations bug |
| Stage Member can publish | authorization bug; block #29 |
| Remote participant appears but media does not | media publication/subscription bug |
| Camera passes but display media fails | screen-share-specific browser/LiveKit bug |
| Intermittent reconnect/disconnect failure | attach redacted timestamps and browser/SDK versions only |

Any defect ticket links #53, includes the failing assertion and sanitized logs, and contains no
credentials, JWTs, room tokens, database contents, or environment values.

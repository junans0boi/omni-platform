# Domain Docs

This repository uses a single domain context.

## Before exploring

- Read the root `CONTEXT.md`.
- Read relevant ADRs under `docs/adr/` when present.
- If a required term is absent, use `domain-modeling` and update `CONTEXT.md` when the term is resolved.

Use the glossary's canonical terms in issues, specifications, code, and tests. Surface conflicts with an ADR instead of silently overriding it.

Expected layout:

```text
CONTEXT.md
docs/adr/
src/
```

Create ADRs only for decisions that are hard to reverse, surprising without context, and involve a real trade-off.

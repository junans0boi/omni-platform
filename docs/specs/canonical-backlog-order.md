# Canonical backlog implementation order

Issue #52 records the minimum hard dependency graph for canonical issues #21–#33 and #47.
An edge means the blocked issue cannot meet its acceptance criteria safely; preferred rollout
order and likely rebase work are not hard edges.

## Foundations

```text
#54 → #55 → #56 → #58 → #59 → #60
                  ↑
             #57 (human)

#53 → #29
#51 (human) ─┐
#28 ─────────┼→ #47
#29 ─────────┘
```

- #49 and #50 are completed foundations.
- #53 (LiveKit two-user verification), #54 (SQLite manifest/import verifier), and #21 (shell)
  are independent frontiers. #23 may prepare catalogs early, but Profile persistence waits for #60.
- #57 is the critical human decision: it blocks #58 and therefore the Supabase cutover chain.
- #51 only blocks the sound-effects slice.

## Post-cutover feature edges

- #60 blocks data-bearing additions #22, #23, #25, #26, #27, #28, #29, #30, #31, and #32.
  New domain data must not extend the legacy Prisma authority after the target authority decision.
- #22 blocks #28 global-mention authorization and #33 custom-role presentation.
- #27 blocks #30 because custom assets reuse the approved Storage/RLS upload seam.
- #53 and #60 block #24 so performance evidence measures the final LiveKit and Realtime paths.
- #51, #28, and #29 block #47 so DND/mention suppression and RTC mixer boundaries are settled.

#21 and #23 should land early to reduce later UI churn, but they do not hard-block every visual
feature. #24 should run after final transport paths exist; it does not need every product feature.

## Execution waves

1. Independent frontier: #53, #54, and #21; prepare #23 catalogs; obtain human decisions #51 and #57.
2. Supabase authority: #55 → #56 → #58 → #59 → #60.
3. First post-cutover slices: #22, #25, #26, #27, #31, #32, and #29 after #53.
4. Dependent slices: #28, #30, #33, and #24.
5. #47 after #51, #28, and #29.

Every issue is one vertical slice and must pass the required `verify` check described in
`docs/testing.md`. Partial legacy behavior is migration input, not proof that a canonical issue
is complete.

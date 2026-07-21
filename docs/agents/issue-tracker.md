# Issue tracker: GitHub

Issues and durable PRDs for this repository live in GitHub Issues. Use the `gh` CLI for operations and infer the repository from `git remote -v`.

## Conventions

- Create: `gh issue create --title "..." --body-file <file>`.
- Read: `gh issue view <number> --comments` and include labels and metadata.
- List: `gh issue list --state open --json number,title,body,labels,comments`.
- Comment: `gh issue comment <number> --body-file <file>`.
- Label: `gh issue edit <number> --add-label "..."`.
- Close: `gh issue close <number> --comment "..."`.
- Pull requests are not a triage request surface.

When a skill says to publish or fetch a ticket, use GitHub Issues.

## Wayfinding operations

- A map is an issue labelled `wayfinder:map`.
- A child ticket uses `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- Prefer GitHub sub-issues and native issue dependencies. If unavailable, use a task list in the map and `Part of #<map>` / `Blocked by: #<issue>` body lines.
- Claim work by assigning the issue before starting.
- Resolve a ticket with a resolution comment, close it, then add a one-line linked decision to the map.
- The frontier is the first open, unassigned child with no open blocker.

Never include secrets or credentials in issue bodies, comments, or command arguments.

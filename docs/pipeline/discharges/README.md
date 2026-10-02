# docs/pipeline/discharges/

One note per retired escalation, written by `scripts/pipeline/retire-escalation.mjs`.

## What this folder is

When a needs-marco escalation is resolved, `retire-escalation.mjs` moves the escalation
file to `docs/pr-prompts/needs-marco/discharged/` (untracked) and writes a short note here
(tracked). Each note records what was retired, when, by whom, and the evidence.

The escalation files themselves stay untracked on the dev box. This folder is the tracked
record that any station can read before reporting an escalation as "missing" or "deleted".

## Before reporting an escalation as gone

Check this folder on `origin/main` for the escalation's filename. A note here means it was
deliberately retired. This is the check that would have stopped the 2026-09-23 false S1 in
which 18 escalations were retired and a later Station 00 run, seeing the files absent with no
record, filed "18 escalations deleted by an actor I cannot identify" and cost most of a run
plus correction PR #2106.

## This folder is tracked (not gitignored)

`git check-ignore` exits 1 (not ignored) for files in this folder. The `.gitignore` rule
`docs/pr-prompts/needs-marco/` does not extend here.

## Note format

Each note is a Markdown file named `<YYYY-MM-DD-HHmm>Z-<slug>.md` and contains:

```
---
item: <escalation-filename>.md
title: <first heading from the escalation, or its basename>
retired_at: <ISO-8601 UTC>
actor: <station id>
moved_to: docs/pr-prompts/needs-marco/discharged/<filename>.md
---

## Evidence
<one line of measured proof>
```

Notes are written in the same PR worktree as the run's breadcrumb, so they land in git
together with the change that discharged the escalation.

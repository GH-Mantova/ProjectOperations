# Approval markers - turning "do not arm" from a comment into a gate

**Created 2026-08-23 by Station 00 (Supervisor), on Marco's instruction to fix the board.**

## The defect this exists to close

Several prompts carry an inline `<!-- watcher: do-not-arm -->` comment or a `DO NOT ARM` status
line in their body. **`lint-prompt.mjs` cannot see either of them.** Measured 2026-08-23: eight
prompts carrying a body-level do-not-arm marker still linted `ADMIT`, including one that drops
database tables and one that needs an Azure key only Marco can enter.

Until now the only thing actually stopping those prompts was that their dependency gate happened
to be dead, so lint rejected them **for an unrelated reason**. That is an accident, not a control.
Repairing the dead gate would have silently removed the protection.

## The convention

A prompt that must not run until a human says so carries:

```yaml
requires_file_on_main: docs/approvals/<slug>-approved-by-marco.md
```

The gate is open only when that file exists on `origin/main`. Since nothing in any chain creates
it, the only way it appears is a human landing it deliberately. The protection is now real,
machine-enforceable, and visible to every instrument.

## Granting an approval

1. Create `docs/approvals/<slug>-approved-by-marco.md` stating **what** is approved, **on what
   evidence**, and **what must be true at merge time** (a DB backup, an export, a soak result).
2. Land it via an ordinary docs PR.
3. Arm the prompt normally: `git mv docs/pr-prompts/<name>-HOLD.md docs/pr-prompts/<name>-ready.md`.

Deleting the marker later re-closes the gate.

## Currently gated on an approval marker

| Prompt | Marker | Why it is held |
|---|---|---|
| `pr-524-rates-b-slice2-canonical` | `rates-b-slice2-canonical-approved-by-marco.md` | Irreversible DROP of the legacy rate tables. Was armed by mistake in a batch sweep on 2026-07-20. |
| `pr-rates-s11c-drop-legacy-tables` | `rates-s11c-drop-legacy-tables-approved-by-marco.md` | Irreversible DROP of the legacy rates tables, API and resolver fallback. |
| `pr-retire-tenderclientnote-s2` | `retire-tenderclientnote-s2-approved-by-marco.md` | Permanently destroys 127 production rows. Requires the JSON export first. |
| `pr-siteid-notnull-backfill` | `siteid-notnull-backfill-approved-by-marco.md` | Production backfill plus an irreversible NOT NULL constraint. Requires the CSV export first. |
| `pr-tenant-mt4-s2-ownership-migration` | `tenant-mt4-s2-ownership-migration-approved-by-marco.md` | Production data; NOT NULL on Client/Worker/Contact ownership. |

## Not a substitute for the other two gates

This is an **arming** gate. It is independent of, and does not replace:

1. the `do-not-merge` label (CP-26 / `escalates: true`) - only Marco removes it; and
2. the watcher's routing - `[merge] <prompt>: PR #N stays for Marco (outside tests/ or docs/)`
   is a human-review gate in its own right.

All five prompts above also carry `escalates: true`, so even once armed and green they stop at
Marco for the merge.

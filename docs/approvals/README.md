# Approval markers - turning "do not arm" from a comment into a gate

**Created 2026-08-23 by Station 00 (Supervisor), on Marco's instruction to fix the board.**

## The defect this exists to close

Several prompts carry an inline `<!-- watcher: do-not-arm -->` comment or a `DO NOT ARM` status
line in their body. **When this file was written, `lint-prompt.mjs` could not see either of them.**
Measured 2026-08-23: eight prompts carrying a body-level do-not-arm marker still linted `ADMIT`,
including one that drops database tables and one that needs an Azure key only Marco can enter.

🔧 **CORRECTED 2026-08-31 (Station 04, landed by Station 00).** That is no longer true. The linter
now matches both literal markers and REJECTs `[HUMAN_GATE_PRESENT]` — see DOCTRINE §9.5, which is
the single place those line numbers and their limits are recorded. **Do not restate §9.5 here; a
paraphrase in this file will drift away from it.** The one operational consequence worth stating is
in "Granting an approval" below: the human gate is evaluated **before** the file gate, so a granted
approval does not on its own release a prompt that also carries a body marker. The general warning
in §9.5 still stands — a **prose** human gate matches neither regex and is invisible to the linter
and to any grep built on it.

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
3. 🔴 **If the prompt body ALSO carries `DO NOT ARM` or `<!-- watcher: do-not-arm -->`, remove that
   line in the same PR.** The human gate is evaluated **before** the file gate, so lint will still
   REJECT `[HUMAN_GATE_PRESENT]` and the arm will fail even though the approval marker is on `main`.
   Measured 2026-08-31 with a control (the same fixture with and without one injected marker line):
   unmodified → `REJECT [FILE_GATE_NOT_RELEASED]`, with-marker → `REJECT [HUMAN_GATE_PRESENT]`,
   both exit 1. **Three of the five prompts in the table below are in this state today** —
   `pr-524-rates-b-slice2-canonical`, `pr-retire-tenderclientnote-s2`, `pr-siteid-notnull-backfill`.
   The other two reject on the approval gate alone, as this document originally described.
4. Arm the prompt normally: `git mv docs/pr-prompts/<name>-HOLD.md docs/pr-prompts/<name>-ready.md`.

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

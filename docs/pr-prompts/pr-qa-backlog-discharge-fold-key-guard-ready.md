---
premise: 'grep -q "backlog-parser-swallows-folded-blocks" docs/pr-prompts/BACKLOG.yaml && grep -q "FOLD_KEY_GUARD" scripts/pipeline/check-backlog.mjs'
premise_means: BACKLOG.yaml still registers an item whose fix has already shipped to main, and check-backlog.mjs reports it indistinguishably from genuinely blocked work.
scope:
  - docs/pr-prompts/BACKLOG.yaml
  - docs/pr-prompts/BACKLOG-DECISIONS.md
done_when: '! grep -q "backlog-parser-swallows-folded-blocks" docs/pr-prompts/BACKLOG.yaml && grep -q "FOLD_KEY_GUARD" docs/pr-prompts/BACKLOG-DECISIONS.md'
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# Discharge a backlog item whose fix shipped two days ago

STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails

One attempt. Never exit silently — say `NO-OP: <reason>` if the work is already on main. Never
ask a question or "stand by" for approval. Docs-only: touch **only** the two files in `scope`.
Never mix `sot/` into this PR (CP-24).

---

## The finding

[MEASURED] on `origin/main` at SHA `a561b703`, 2026-08-21, from a clean worktree.

`docs/pr-prompts/BACKLOG.yaml` still carries the item `backlog-parser-swallows-folded-blocks`. Its
gate is:

```
! grep -q "FOLD_KEY_GUARD" scripts/pipeline/check-backlog.mjs
```

The gate is written to be READY **while** the guard is absent, and to die when the fix lands. The
fix **has** landed:

```
scripts\pipeline\check-backlog.mjs:23  * Exit  3 = FOLD_KEY_GUARD: key-shaped prose line found inside a folded block.
scripts\pipeline\check-backlog.mjs:38  * FOLD_KEY_GUARD - this const is the marker the gate checks for.
scripts\pipeline\check-backlog.mjs:56  `FOLD_KEY_GUARD: item '${itemId}' line ${lineNumber} - ...`
scripts\pipeline\check-backlog.mjs:68  * FOLD_KEY_GUARD is applied here: ...
scripts\pipeline\check-backlog.mjs:97  // FOLD_KEY_GUARD separates these two cases:
```

The prompt that did it is `pr-backlog-parser-fold-key-guard-ready.md`, now filed under
`docs/pr-prompts/superseded/cleared-2026-08-19-round3/`. The work is done, verified, and shipped.

**The item was never discharged from the register.** `check-backlog.mjs` therefore files it under
`>>> still blocked (gate not yet satisfied)` — the same bucket as five genuinely-blocked items. It
will sit there permanently, because its gate can never become true again.

## Why this matters beyond one stale line

The register has no bucket for "work finished, item never removed". A gate reading false is
reported as *blocked*, and a discharged item is indistinguishable from a blocker that will never
clear. Every scanner run re-reads it, and any reader planning work off the register sees a
non-existent obstacle. This is the mirror image of the already-known false-READY case
(`rates-11c-blocked-consumers`, whose slices are staged but which the register keeps surfacing as
ready) — the same missing distinction, in the other direction.

This prompt fixes the **instance**. The systemic fix — teaching `check-backlog.mjs` to distinguish
"gate false because still blocked" from "gate false because the work shipped" — is deliberately
NOT in scope here; it is a `scripts/pipeline/**` change and belongs in its own prompt so that this
one stays docs-only and CP-24-safe.

## The work

1. Delete the `backlog-parser-swallows-folded-blocks` item from `docs/pr-prompts/BACKLOG.yaml`.
   Remove the **whole** item block — `- id:`, `gate:`, `note:` and every other key — leaving no
   orphaned lines behind.

2. Record the discharge in `docs/pr-prompts/BACKLOG-DECISIONS.md` so the register does not lose the
   history. Name the successor explicitly — that omission is what previously lost a month of work:

   > `DISCHARGED 2026-08-21 (04-scanner): backlog-parser-swallows-folded-blocks. Fix shipped via`
   > `pr-backlog-parser-fold-key-guard-ready.md (now in superseded/cleared-2026-08-19-round3/).`
   > `FOLD_KEY_GUARD is present in scripts/pipeline/check-backlog.mjs on main at a561b703, so the`
   > `item's gate can never be satisfied again. Discharged, not deferred.`

3. Re-run the register and confirm it still parses and the count dropped:

   ```
   node scripts/pipeline/check-backlog.mjs
   ```

   **Read the output, not just the exit code.** Exit **10** is expected and normal — it means at
   least one item is READY, which is true independently of this change. Exit **2** means the
   STRICT-STRUCTURE GUARD fired and you have broken the YAML indentation — every `- id:` must sit
   at exactly 2-space indent. Fix that before opening the PR.

   The summary line must go from `ready=2  needs-marco=1  blocked=5  broken=0`
   to `ready=2  needs-marco=1  blocked=4  broken=0`.

## Verification before you open the PR

```
grep -c "backlog-parser-swallows-folded-blocks" docs/pr-prompts/BACKLOG.yaml   # must be 0
grep -c "FOLD_KEY_GUARD" docs/pr-prompts/BACKLOG-DECISIONS.md                  # must be >= 1
node scripts/pipeline/check-backlog.mjs                                        # must NOT exit 2
git diff --numstat                                                             # must be TWO files, docs only
```

## Out of scope

Do not modify `scripts/pipeline/check-backlog.mjs`. Do not discharge, edit, or re-gate any other
backlog item — in particular leave `rates-11c-blocked-consumers` and
`settings-restructure-sot-nav-reconcile` exactly as they are; both are owned elsewhere.

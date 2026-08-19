---
premise: '! test -f docs/audits/dead-file-gates-repointed-2026-08-19.md'
premise_means: The already-satisfied requires_file_on_main gates in the queue have not yet been repointed or dropped, so the FILE_GATE_DEAD lint rule cannot ship without silently rejecting them.
scope:
  - docs/pr-prompts/pr-cfx-s5-xero-file-import-ready.md
  - docs/pr-prompts/pr-crm-leads-s6-reason-admin-settings-ready.md
  - docs/pr-prompts/pr-ew-s1-alloc-schema-HOLD.md
  - docs/pr-prompts/pr-hw-9-compliance-derivation-ready.md
  - docs/pr-prompts/pr-ratehub-s4-create-sor-HOLD.md
  - docs/pr-prompts/pr-sor-s8-ar-office-review-lane-ready.md
  - docs/pr-prompts/pr-tr-s1-reminder-policy-HOLD.md
  - docs/audits/dead-file-gates-repointed-2026-08-19.md
done_when: test -f docs/audits/dead-file-gates-repointed-2026-08-19.md
size: 8
gate_allow: none
seed_only: false
escalates: false
cluster: lint-file-gate-dead
cluster_order: 1
---

# SLICE 1 — repoint or drop the 7 already-satisfied `requires_file_on_main` gates

## Why this must land BEFORE the lint rule

SLICE 2 of this cluster adds a `FILE_GATE_DEAD` intake-lint rule that REJECTS any prompt whose
`requires_file_on_main` path is already present on `origin/main`. Measured on `origin/main`
`3bd53909` (2026-08-19), **8 of the 18 `requires_file_on_main` declarations in the queue are
already satisfied**. If the rule shipped first, those prompts would be rejected at dequeue and the
work behind them would be **silently binned**. That is the exact harm this cluster exists to
prevent, so the queue is cleaned first and the rule is the ratchet that keeps it clean.

A gate that is satisfied at intake is not a gate. It reads as ordered and is not — the slice
dispatches alongside its predecessor instead of after it.

## The measured list (re-verify each one before editing it)

Re-run the measurement on current `origin/main` first — do not trust this list blind:

```bash
git fetch origin
grep -Hn "requires_file_on_main:" docs/pr-prompts/*.md \
  | sed 's/[[:space:]]*$//' \
  | while IFS= read -r line; do
      f="${line%%:*}"
      p="$(printf '%s' "$line" | sed "s/.*requires_file_on_main:[[:space:]]*//; s/^['\"]//; s/['\"]$//")"
      if git cat-file -e "origin/main:$p" 2>/dev/null; then echo "DEAD  $f  ->  $p"; fi
    done
```

Files this prompt owns (7 of the 8; the eighth is deliberately excluded, see **Do NOT** below):

| Prompt file | Dead gate path |
|---|---|
| `pr-cfx-s5-xero-file-import-ready.md` | `apps/api/src/modules/xero/xero-contact-export.service.ts` |
| `pr-crm-leads-s6-reason-admin-settings-ready.md` | `apps/web/src/pages/crm/DontPursueModal.tsx` |
| `pr-ew-s1-alloc-schema-HOLD.md` | `docs/plans/estimator-allocation-workload-plan.md` |
| `pr-hw-9-compliance-derivation-ready.md` | `apps/api/src/modules/handovers/handovers.service.ts` |
| `pr-ratehub-s4-create-sor-HOLD.md` | `apps/api/src/modules/schedule-of-rates/sor-source-markup.service.ts` |
| `pr-sor-s8-ar-office-review-lane-ready.md` | `apps/api/src/modules/agreed-records/agreed-records.service.ts` |
| `pr-tr-s1-reminder-policy-HOLD.md` | `docs/plans/tender-reminders-plan.md` |

## What to build

For EACH of the 7 files, apply exactly ONE of these two treatments. Decide per prompt; do not
apply one blanket answer.

**(A) REPOINT to a content gate** — use this when the prompt genuinely still depends on a
predecessor's *change* to that file, not merely the file's existence. Replace the key with:

```yaml
requires_on_main: <same path> :: <a fixed string the predecessor introduces>
```

Choose the needle by reading the prompt body to find what the predecessor was supposed to add
(a model name, an exported symbol, a route, a constant). Then **verify the needle is NOT yet on
`origin/main`**:

```bash
git show origin/main:<path> | grep -F "<needle>" && echo "NEEDLE ALREADY PRESENT - do not use it"
```

If the needle is already present, the predecessor has genuinely landed — use treatment (B).

**(B) DROP the key** — use this when the file's existence was the whole dependency and that
dependency is now satisfied (this is the right answer for both `docs/plans/*.md` gates, which
were only ever asserting "the design doc is on main", and it is on main). Delete the
`requires_file_on_main` line and add a one-line HTML comment immediately below the front-matter
recording why, e.g.:

```
<!-- gate dropped 2026-08-19: docs/plans/tender-reminders-plan.md landed; the gate was a no-op. -->
```

Do not leave an empty `requires_file_on_main:` — `REQUIRES_PATH_EMPTY` rejects that.

**Then write the marker doc** `docs/audits/dead-file-gates-repointed-2026-08-19.md` containing:

- the SHA of `origin/main` you measured against,
- the command you ran and its raw output,
- one row per prompt: file, old gate, treatment (A or B), new gate or reason for dropping,
- an explicit line naming the one prompt deliberately left alone and why (see below).

## Do NOT

- Do NOT touch `docs/pr-prompts/pr-tfm-s9-backfill-and-cleanup-HOLD.md`. Its gate
  (`docs/migration-runs/tender-folder-copy-2026.md`) is also dead, but that prompt is on a
  deliberate HOLD and editing it here would drag a destructive-migration prompt into a docs PR.
  **Record it in the marker doc as a known remaining instance** so SLICE 2's author can decide
  whether the rule needs an allow-list entry or that prompt needs its own fix.
- Do NOT change `scripts/pipeline/lint-prompt.mjs` — that is SLICE 2's job.
- Do NOT change any prompt's `premise`, `scope`, `size`, or body content. Only the dependency key.
- Do NOT rename any prompt or move it between `-ready` / `-HOLD`. Arming state is not yours.
- Do NOT touch `/sot/` — CP-24 hard-fails a PR mixing `sot/` with anything else.

## Guardrails

- One attempt. If a needle cannot be chosen honestly for a given prompt, use treatment (B) and say
  so in the marker doc — an honest dropped gate beats an invented one.
- `*-ready.md` is gitignored (`.gitignore:73`). You are EDITING already-tracked files, so a plain
  `git add` works; but if `git status` shows an edit missing, use `git add -f <path>`.
- This is a docs-only PR. Only `docs/**` may appear in the diff.
- Never exit silently. If the work is already done, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in this run.
- Read the job log before diagnosing any CI failure.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

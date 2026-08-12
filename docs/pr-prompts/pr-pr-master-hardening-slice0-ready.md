---
premise: '! grep -q "DESTRUCTIVE_MUST_ESCALATE" scripts/pipeline/lint-prompt.mjs'
premise_means: The intake linter does not yet reject a destructive/backfill/DROP/DELETE/NOT-NULL prompt that lacks escalates:true, so the exact class of prompt that nearly auto-merged a destructive migration today (siteid-notnull-backfill, OPS-6) can still be armed unguarded.
scope:
  - scripts/pipeline/lint-prompt.mjs
  - scripts/pipeline/test-lint-prompt.mjs
  - docs/pipeline/LESSONS.yaml
  - docs/pr-prompts/PROMPT-SCHEMA.md
  - .claude/agents/06-pr-master.md
done_when: node scripts/pipeline/test-lint-prompt.mjs && grep -q "DESTRUCTIVE_MUST_ESCALATE" scripts/pipeline/lint-prompt.mjs && grep -q "DESTRUCTIVE_MUST_ESCALATE" docs/pr-prompts/PROMPT-SCHEMA.md && grep -q "DESTRUCTIVE_MUST_ESCALATE" docs/pipeline/LESSONS.yaml
size: 5
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# PR-Master hardening slice 0 — make the "destructive slice must escalate" lesson mechanically enforced

**Why this exists (OPS-6, 2026-08-12).** `siteid-notnull-backfill` — a DESTRUCTIVE NOT-NULL enforce
+ backfill migration — was staged with `escalates: false`. Because arming a `*-ready.md` prompt IS
the decision to run it, and `escalates` gates only the MERGE, a green build of that prompt would have
**auto-merged a destructive migration** with no human in the loop. It was caught by hand. The lesson
("any DESTRUCTIVE / backfill / NOT-NULL-enforce / DROP / DELETE / prod-data slice MUST carry
`escalates: true`") currently lives only as prose in `docs/pipeline/lessons-learned-pr-failures.md`.
Prose lessons rot — `docs/pipeline/LESSONS.yaml` exists precisely because a lesson without an
executable check is one careless edit from being un-fixed. This slice makes the lesson mechanical.

## What to build

### 1. New intake-lint rule `DESTRUCTIVE_MUST_ESCALATE` (`scripts/pipeline/lint-prompt.mjs`)
- Add a check that REJECTS a prompt when its **destructive-signal** is present AND `escalates` is not
  `true`. Destructive-signal = a case-insensitive match, in the prompt's `premise`, `scope`,
  `done_when`, or body, for any of: `backfill`, `NOT NULL` / `NOT-NULL` / `SET NOT NULL`,
  `\bDROP\s+(TABLE|COLUMN|CONSTRAINT|TYPE)\b`, `\bDELETE\s+FROM\b`, `TRUNCATE`, `drop-legacy`,
  `drop_legacy`, or an explicit `destructive` marker.
- On match with `escalates` !== true → reject with code `DESTRUCTIVE_MUST_ESCALATE` and a message
  naming which token matched and instructing the author to set `escalates: true` (or, if the match is
  a false positive, to narrow scope/wording). Follow the existing rejection-emission style in the file
  (same shape as the current `GATE_ALLOW_MISMATCH` / `MISSING_FIELD` failures).
- Anchor patterns so a MENTION cannot satisfy them loosely, but do NOT require SQL — `backfill` in a
  premise or body is enough (the whole point is to catch intent early). Prefer a false-positive that a
  human clears by setting the flag over a false-negative that ships a destructive auto-merge.

### 2. Tests (`scripts/pipeline/test-lint-prompt.mjs`)
- Add a case proving a destructive prompt with `escalates: false` is REJECTED with
  `DESTRUCTIVE_MUST_ESCALATE`.
- Add a case proving the SAME prompt with `escalates: true` PASSES that rule.
- Add at least one case proving a normal non-destructive prompt still PASSES (guard against a
  regex that fires on ordinary wording — e.g. a prompt that merely contains the word "delete" inside
  a longer identifier should not trip; tune the anchors until it doesn't).
- All existing tests must still pass.

### 3. Regression entry (`docs/pipeline/LESSONS.yaml`)
- Add one `- id: destructive-slice-not-forced-to-escalate` entry (2-space indent) whose
  `regressed_when` describes the BAD state — the rule being absent — so it goes green→red if the
  rule is ever removed:
  `regressed_when: '! grep -q "DESTRUCTIVE_MUST_ESCALATE" scripts/pipeline/lint-prompt.mjs'`
  Include `title`, `learned: 2026-08-12`, a one-line `cost:` naming siteid-notnull-backfill / OPS-6,
  and `fix_ref: this PR`. Match the existing entry shape exactly.

### 4. Document the rule (`docs/pr-prompts/PROMPT-SCHEMA.md`)
- Under the `escalates` section, add a short subsection stating that a destructive/backfill/NOT-NULL/
  DROP/DELETE/TRUNCATE slice MUST set `escalates: true` and that the linter now enforces this via
  `DESTRUCTIVE_MUST_ESCALATE`. Add the failure to the "Lint failures you will hit" table.

### 5. Fold today's authoring lessons into PR Master (`.claude/agents/06-pr-master.md`)
- Add a concise "2026-08-12 lessons" checklist block so the authoring agent applies them going
  forward: **OPS-6** (destructive ⇒ `escalates: true`, now linter-enforced); **P11** (a migration that
  INSERT/UPDATEs a column must ADD or pre-create that column AND declare it on the Prisma model);
  **P12** (never ADD an enum value and USE it in the same migration — split into two migrations);
  **P11/P12 meta** (a migration slice's `done_when` MUST run a real `prisma migrate deploy` against a
  scratch Postgres, not just `validate`/`build`); **P13** (any predecessor named in a prompt BODY —
  "mirror/reuse what slice X built at path P" — MUST also appear in `requires_file_on_main`; prose and
  frontmatter must agree). Keep it tight — a checklist, not an essay.

## Do NOT
- Do NOT touch `sot/`, Azure/Entra/SharePoint, production auth, or any `apps/**` runtime code.
- Do NOT weaken, reorder, or delete any existing lint rule or test — this slice is purely additive.
- Do NOT change the watcher (`scripts/pr-watcher/**`) or any migration/schema file.
- Do NOT broaden the destructive regex so far that ordinary prompts fail; the added test cases are the
  contract — tune anchors until non-destructive prompts pass and destructive ones fail.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does not mean "wait for approval
before starting", and it does not mean "do the work then ask permission to push". There is no human in
this run. **Finishing the work and then asking for permission is indistinguishable from failing** — the
work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if the work is already on `main`, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval — there is no human in a headless run.
- Read the job log before diagnosing any CI failure; chase the log, not an assumption.
- Before finishing, confirm there is a PR number in your output.

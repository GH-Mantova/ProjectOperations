---
premise: '! test -f "docs/plans/claude-design-spec-regeneration-plan.md"'
premise_means: >-
  The seven Claude Design specs describe the UI as at 2026-06-26. Since then the scope-card
  redesign, the brand theme work, settings home and nav5 have all landed. Nobody has established
  WHICH of the 54 documented sections actually moved, so "regenerate the six spec docs" has no
  scope, no order and no size - and 67 route entries in routes.js against 54 documented sections
  means at least 13 screens were never documented even in June.
scope:
  - docs/plans/claude-design-spec-regeneration-plan.md
done_when: >-
  test -f docs/plans/claude-design-spec-regeneration-plan.md && grep -q "SLICE" docs/plans/claude-design-spec-regeneration-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: false
cluster: claude-design
cluster_order: 2
requires_file_on_main: Claude Design/docs/01-commercial.md
---

# CD-S2 (SLICE-0 PLAN): work out what actually changed before rewriting 154 KB of prose

**Grounded against `origin/main` = `f5c01415`, measured 2026-09-03.**

CD-S1 made the specs visible to git. This slice does **not** rewrite them either — it produces the
plan that says which ones need rewriting, in what order, and how big each piece is. Writing that
plan is the whole deliverable; the regeneration slices chain behind it, one at a time.

## Why a plan and not a rewrite

Measured: 154 KB across seven documents, **54 `##` sections** (01: 9 · 02: 9 · 03: 9 · 04: 11 ·
05: 13 · 06: 3), against **67 route entries** in `Claude Design/assets/routes.js`. Rewriting all of
that against today's UI is not one PR and is not honestly sizeable until someone has diffed the
described screens against the real components. A prompt that said "regenerate the six specs" would
be handing an agent an unbounded writing job with no acceptance test.

## Do

Produce `docs/plans/claude-design-spec-regeneration-plan.md` containing:

1. **A per-screen drift table.** One row per entry in `routes.js`:
   `route | title | component | documented in | doc section | drift`.
   Derive `component` from `routes.js` itself, then read the real file under `apps/web/src/` and
   compare it against what the doc claims. `drift` is one of **NONE** (doc still true) ·
   **MOVED** (screen exists, description is wrong) · **GONE** (documented screen no longer exists)
   · **UNDOCUMENTED** (route exists, no section describes it) · **UNVERIFIABLE** (say why).
   **Use the four `[MEASURED]`/`[INFERRED]`/`[CANNOT MEASURE]` disciplines from DOCTRINE §7.1** —
   a row you could not check is `UNVERIFIABLE`, never quietly `NONE`.
2. **A count summary** by drift class, and by document, so the size of the job is a number rather
   than a feeling.
3. **A slice plan.** One slice per document that has any MOVED / GONE / UNDOCUMENTED rows, sized
   from its own row count, ordered **most-drifted first**. Name each slice and give it a premise
   that dies when that document is regenerated. A document whose rows are all NONE gets **no
   slice** — say so explicitly rather than scheduling busywork.
4. **The four known movers, checked first**, because they are the reason this is being done at all:
   the scope-card redesign (`SCOPE_WBS_*`), the brand theme work, settings home, and nav5. Say for
   each which document and which sections it touched.
5. **An explicit statement of what regeneration means**, so the chained slices have an acceptance
   test: each section states the screen's purpose, the data it shows, its states (empty, loading,
   error, populated), its interactions, and the real component path — matching the existing docs'
   structure, which the plan must describe rather than invent.

## Do NOT

- Do NOT regenerate, rewrite or correct any spec in this slice. The plan is the deliverable.
- Do NOT touch `Claude Design/` at all — not the docs, not `routes.js`, not the mock-ups.
- Do NOT propose regenerating the 65 mock-ups. Marco decided 2026-09-03: specs only.
- Do NOT schedule a slice for a document with no measured drift.
- Do NOT touch `sot/`.

## Verify

- `docs/plans/claude-design-spec-regeneration-plan.md` exists and contains a `SLICE` section.
- The drift table has **one row per `route:` entry** in `routes.js` — count them and state both
  numbers in the plan. A table shorter than the route list has silently dropped screens.
- Every row carries a drift class from the five above; no row is blank.
- Every `UNDOCUMENTED` row names a route that genuinely has no matching `##` section — spot-check
  three by grep, and quote the greps in the plan.
- Every proposed slice names the document it rewrites and carries a premise that would die on
  completion.
- Control: at least one row is `NONE` and at least one is not. A table that is uniformly one class
  is far more likely to be an unread table than a real finding.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.

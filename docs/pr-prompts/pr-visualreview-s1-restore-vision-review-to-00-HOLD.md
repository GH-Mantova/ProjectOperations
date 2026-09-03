---
premise: '! grep -q "VISION REVIEW" docs/pipeline/stations/00-supervisor.md'
premise_means: >-
  Station 02 was folded into Station 00 on 2026-09-02 (PR #1516), but rule 6's VISION REVIEW did
  not come across. 00-supervisor.md is 944 lines and mentions visual-smoke, VISION, screenshot and
  rule 6 exactly zero times; its own smoke instruction says the EXIT CODE decides, never your
  reading of the log - the opposite rule to a review where the agent's reading of the PNG is the
  verdict. The station that inherited the board was never told the vision review exists.
scope:
  - docs/pipeline/stations/00-supervisor.md
done_when: >-
  grep -q "VISION REVIEW" docs/pipeline/stations/00-supervisor.md && grep -q "visual-smoke.mjs" docs/pipeline/stations/00-supervisor.md && node scripts/pipeline/lint-station.mjs
size: 1
gate_allow: none
seed_only: false
escalates: false
cluster: visual-review
cluster_order: 1
---

# VS-S1: give Station 00 back the vision review it inherited and never received

**Grounded against `origin/main` = `f5c01415`, measured 2026-09-03.**

## What is already true, and must not be rebuilt

- **`scripts/pipeline/visual-smoke.mjs` exists and works** (PR #636, 2026-07-16). It logs in as the
  seed admin, drives a `screens.json` list, and writes one deterministic full-page PNG per screen to
  `docs/pr-reviews/pr-{n}-smoke/{name}.png` at 1440x900. It asserts nothing, by design.
- **The review contract exists**, fully written, at `docs/pipeline/stations/02-board-driver.md:336`
  under rule 6. It is not vague: open each PNG, judge it against the PR's stated visual acceptance
  criteria, record a per-screen PASS/FAIL with a one-line reason in the smoke comment's PASS table,
  and treat a visual FAIL as a SMOKE FAIL routed through the existing FAIL branch.

**Do not rewrite either.** This slice moves the contract to the station that now owns the board.

## Do

1. **In `00-supervisor.md`, inside the existing numbered item 3 ("Smoke test, including UI/UX",
   around line 245), add a `VISION REVIEW` sub-section.** Carry the rule-6 contract across
   faithfully. It must state, in the doc's own voice:
   - After a functional smoke on a PR that touches `apps/web/**`, capture the PR's declared visual
     acceptance screens by writing a small `screens.json` (one `{ name, path, waitFor? }` per screen
     the PR body names) and running
     `node scripts/pipeline/visual-smoke.mjs --pr {n} --base http://localhost:5174 --screens <file>`.
   - **Then OPEN each PNG and JUDGE it.** Layout intact - no overlap, no cut-off, no blank region
     where the PR claims content. The elements the PR body says are present are visibly present.
     Nav and shell render. Spacing and colours plausibly match the design tokens.
   - Record a per-screen `screen | PASS/FAIL | reason` row in the same PASS table posted as the
     smoke comment.
   - **A visual FAIL is a SMOKE FAIL** - route it through the existing FAIL branch.
   - Escalate to Marco **only** on a genuinely ambiguous aesthetic judgement (a novel design token,
     a brand-guideline call, a subjective density question) - never on a screen that is clearly
     right or clearly wrong.
2. **Resolve the contradiction this creates, explicitly, in the same edit.** Item 3 currently says
   *"the EXIT CODE decides, never your reading of the log"*. That remains true **of
   `smoke-pr.ps1`**. Add one sentence saying so and drawing the line: the exit code decides the
   functional smoke; the vision review is the one place where the agent's own reading **is** the
   verdict, because `visual-smoke.mjs` deliberately asserts nothing. Leaving both sentences
   unqualified in one section is how a reader picks whichever they prefer.
3. **Leave a pointer at `02-board-driver.md:336`** saying rule 6's vision review now also lives in
   `00-supervisor.md`, so the two do not silently drift. Do not delete rule 6 from 02.

## Do NOT

- Do NOT touch the `<!-- CANONICAL-BLOCK: station-contract v2 -->` region. Rule 6 lives in the
  station's own body, not the shared block. If your edit lands inside those markers,
  `lint-station.mjs` will reject it and you have edited the wrong part of the file.
- Do NOT change `station_doc_version` or `contract_version`.
- Do NOT edit `visual-smoke.mjs` - VS-S2 owns it.
- Do NOT delete or rewrite rule 6 in `02-board-driver.md`.
- Do NOT touch `sot/`.

## Verify

- `grep -c "VISION REVIEW" docs/pipeline/stations/00-supervisor.md` returns at least 1.
- `grep -q "visual-smoke.mjs" docs/pipeline/stations/00-supervisor.md` succeeds.
- `node scripts/pipeline/lint-station.mjs` exits 0 - proving the canonical block was **not** touched.
- Control: `git diff` shows no line inside the `CANONICAL-BLOCK: station-contract` markers changed.
- The words "EXIT CODE decides" still appear, now scoped to `smoke-pr.ps1`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.

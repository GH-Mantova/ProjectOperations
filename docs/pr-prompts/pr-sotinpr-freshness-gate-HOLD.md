---
premise: '! grep -q "CP-27" scripts/pr-gates/pr-gates.mjs'
premise_means: The CP-27 sot-inpr-freshness gate does not exist yet in pr-gates.mjs.
scope:
  - scripts/pr-gates/sot-inpr.mjs
  - scripts/pr-gates/pr-gates.mjs
  - scripts/pr-gates/__tests__/sot-inpr.test.mjs
  - docs/pr-prompts/superseded/pr-sotinpr-freshness-gate-HOLD.md
done_when: node --test "scripts/pr-gates/__tests__/*.mjs" && grep -q "CP-27" scripts/pr-gates/pr-gates.mjs && ! test -f docs/pr-prompts/pr-sotinpr-freshness-gate-HOLD.md
size: 4
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
module: ''
---

# CP-27 — stop `sot/02`'s In-PR table from being hand-maintained against a live board

`SOT_INPR_FRESHNESS_V1`

## Why this exists

`sot/02-roadmap-and-status.md` §2 (`## 2. 🔧 In-PR — open right now (N)`) is a hand-written
snapshot of the open board. **Station 05 has hand-refreshed it three times — 2026-09-06,
2026-09-17 and 2026-09-21 — and it was stale again within days on every occasion.** The
2026-09-21 refresh found the table reading *"open right now (3)"* and naming `#2005`, `#2002`
and `#1998`; all three had left the board within **4.5 hours** of the snapshot timestamp the
table itself carried.

That is RULE 1's two tests, split: the hand-refresh passes *immediately* and fails *future*. On
the measured evidence it rots in days, and each rot costs a scheduled Station 05 run its slot.
The section's own header states a **count**, which is the formulation
`STATION-CAPABILITIES.md` §1 already carries a red rule against.

**The complete-and-additive fix is not to refresh it again — it is to make a stale refresh
impossible to land.** A CI gate that fires only on PRs touching that one file turns "someone
noticed months later" into "the PR that wrote it went red in ninety seconds". It removes no
existing behaviour and blocks no PR that does not touch the file.

## The work

### 1. `scripts/pr-gates/sot-inpr.mjs` — a pure, testable parser + decider

Node built-ins only, ASCII-only output, no network in this file. Export two functions so the
decision can be unit-tested without GitHub:

- `parseInPrSection(markdown)` → `{ declaredCount, prNumbers }`.
  - Find the heading matching `/^##\s+2\.\s.*In-PR/m`. Read forward until the next `^## ` or EOF.
  - `declaredCount` is the integer inside the trailing parentheses of that heading, or `null`
    if the heading carries none.
  - `prNumbers` is every `#<digits>` appearing in the **first cell** of a markdown table row
    inside that section — i.e. a line starting with `|`, split on `|`, and the `#<n>` taken from
    the first non-empty cell. Deduplicate, preserve order.
  - ⚠️ Prose inside the section legitimately names merged PRs in its "Refreshed again …"
    footnotes. **Only table rows count.** A parser that greps the whole section for `#\d+`
    reports every footnote as a stale claim and the gate becomes noise.
- `decideInPrFreshness({ declaredCount, prNumbers, states })` → `{ verdict, detail }`, where
  `states` is a `Map<number, string>` of PR number → GitHub state (`OPEN` / `MERGED` / `CLOSED`).
  - `FAIL` if any number in `prNumbers` has a state that is not `OPEN` — name each one and its
    state.
  - `FAIL` if `declaredCount !== null && declaredCount !== prNumbers.length` — the header count
    and the table disagree, which is the defect in its own right.
  - `PASS` otherwise.

### 2. `scripts/pr-gates/pr-gates.mjs` — wire it in as CP-27

Add one block in the same shape as the existing gates (anchor: the `// CP-24 - sot purity`
comment block and the `report("PASS", "CP-24", "sot-purity", …)` call). Mirror this file's own
conventions exactly — `report(...)`, `::error::` for the failure text, ASCII only.

- If `sot/02-roadmap-and-status.md` is **not** in `changedFiles`:
  `report("SKIP", "CP-27", "sot-inpr-freshness", "sot/02-roadmap-and-status.md not changed")`.
  **This is the common case and it must be a SKIP, not a PASS** — a PASS here would claim the
  table was checked on every PR in the repo.
- Otherwise read the file **from the PR head on disk** (`readFileSync`, utf8 — the file is in
  the checkout), parse it, and resolve each PR's state with
  `gh pr view <n> --json state -q .state`, reusing the same `gh`/`GH_TOKEN` path the file
  already uses to fetch the PR body (anchor: the `execFileSync("gh", ["pr", "view", prNumber, …])`
  call near the top).
- If `gh` is unavailable or any lookup throws:
  `report("SKIP", "CP-27", "sot-inpr-freshness", "cannot resolve PR states: <message>")` and
  **say so loudly in the SKIP detail**. Do not silently PASS — an unrunnable check must never
  read as a passed one (DOCTRINE §7). Failing OPEN is the deliberate choice here because the
  gate guards a documentation snapshot, not a merge safety property; state that in the comment.
- On `FAIL`, the `::error::` text must name each offending PR, its state, and the one-line fix:
  *re-read the live board with `gh pr list --state open` and rewrite §2's table and its header
  count from it.*

Update the file-header comment listing the CP numbers (anchor: the first line,
`// PR diff gates (CP-09..CP-13, CP-17, CP-22, CP-23, CP-24, CP-25).`) so it names CP-27. It
already under-lists CP-26; add both rather than only yours.

### 3. `scripts/pr-gates/__tests__/sot-inpr.test.mjs` — the tests that make it real

`node:test` + `node:assert/strict`, matching `scripts/pr-gates/__tests__/approval-receipt.test.mjs`.
This directory is already wired into CI (`ci.yml`, anchor: the line
`node --test "scripts/pr-gates/__tests__/*.mjs"` in the `pipeline-tests` job), so **no workflow
change is needed** — do not edit `.github/`.

Cover, at minimum:

| case | expectation |
|---|---|
| a fixture section with one table row naming an `OPEN` PR, header `(1)` | `PASS` |
| the same fixture with that PR `MERGED` | `FAIL`, detail names the number and `MERGED` |
| header says `(3)`, table holds 2 rows, both `OPEN` | `FAIL` on the count mismatch |
| a "Refreshed again …" prose footnote naming a merged PR, table clean | `PASS` — **the negative control for the whole-section-grep trap** |
| a document with no `## 2. … In-PR` heading | `parseInPrSection` returns `prNumbers: []`, `declaredCount: null`; decider `PASS` |

Build every fixture **inline as a string literal in the test**, so its truth is known by
construction. Do not read the real `sot/02-roadmap-and-status.md` in a test — its content is
state, and a test pinned to today's board rots exactly the way this gate exists to stop.

### 4. Retire this prompt

`git mv docs/pr-prompts/pr-sotinpr-freshness-gate-HOLD.md docs/pr-prompts/superseded/` in this
same PR. It is in `scope` for that reason.

## Constraints

- **Do not touch `sot/`.** CP-24 hard-blocks a PR mixing `sot/` with `scripts/`, with no escape
  hatch. This PR fixes the *instrument*; it does not refresh the table. Refreshing the table
  stays Station 05's, through a separate doc-reconcile PR.
- **Do not edit `.github/`.** The test directory is already wired.
- Node built-ins only in both new files, matching the rest of `scripts/pr-gates/`.

## Verification

- [ ] `node --test "scripts/pr-gates/__tests__/*.mjs"` passes, including the prose-footnote
      negative control.
- [ ] `node scripts/pr-gates/pr-gates.mjs` run locally against a diff that does **not** touch
      `sot/02-roadmap-and-status.md` reports CP-27 `SKIP`, and does not report `PASS`.
- [ ] `grep -q "CP-27" scripts/pr-gates/pr-gates.mjs` exits 0.
- [ ] `docs/pr-prompts/pr-sotinpr-freshness-gate-HOLD.md` no longer exists and
      `docs/pr-prompts/superseded/pr-sotinpr-freshness-gate-HOLD.md` does.
- [ ] `pnpm build` and `pnpm lint` pass.

## Falsifying probe for this prompt's own premise

`grep -c "CP-27" scripts/pr-gates/pr-gates.mjs` on `origin/main`. If it is ever non-zero before
this prompt is armed, the gate already exists and this prompt is spent — bin it rather than
building a duplicate.

## Provenance

Staged by Station 00 on 2026-09-21, discharging the hand-over left by its own 01:10Z run
(finding F-6, DISPOSITION DEFERRED: *"The next run with slot to spare should stage it as an
ordinary `-HOLD.md`; it is small and self-contained."*). The underlying measurement is Station
05's F2 of 2026-09-21T00:04Z, landed in `#2019`.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

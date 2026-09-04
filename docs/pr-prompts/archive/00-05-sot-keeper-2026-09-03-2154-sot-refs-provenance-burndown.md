# Station 05 — SoT Keeper | 2026-09-03T21:54Z–2026-09-03T22:1xZ

## GROUND

```
UTC            2026-09-03T21:54:23Z
origin/main    bfd2596b            (fetched, then rev-parsed)
dev tree       main @ bfd2596b     C:\ProjectOperations2   (converged with origin/main)
doc version    1                   (docs/pipeline/stations/05-sot-keeper.md front matter)
bootstrap      1                   (scheduled-task SKILL.md) — MATCH, run is read-write
```

SIGHTED run. `start_process` powershell.exe reached the box on the first call; `node -v` → `v24.14.1`.
The opening `-Command` call died on `$env:COMPUTERNAME` being expanded away — DOCTRINE §9.1 exactly,
**a parser error, not blindness** — and the persistent session that followed answered normally.

The three binding documents were read from the working tree, and that read was **proved equivalent to
`origin/main`** rather than assumed: `git diff --stat origin/main -- docs/pipeline/stations/05-sot-keeper.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` returned **empty**.

## WHAT I MEASURED

| Claim | Tag | Evidence |
|---|---|---|
| Sweep verdict SAFE TO ACT | [MEASURED] | `status-sweep.ps1` 21:55:03Z — 0 in-progress prompts, 0 git processes, `index.lock` False/False, armed=0 |
| Board: 4 open PRs (#1544 #1543 #1541 #1536) | [MEASURED] | sweep §1 [LIVE]. Untouched by this run |
| Schema parses clean | [MEASURED] | `node scripts/data-model/build-relationship-map.mjs --check` → `OK … (293 models, 68 enums, 488 edges)`, exit 0 |
| `metadata-catalog.json` is valid JSON | [MEASURED] | `JSON.parse` of 683,882 bytes, exit 0. (It was invalid for four consecutive sweeps in the past — it is not now) |
| **sot/04 generated section is NOT drifted** | [MEASURED] | sot/04 header line 16 `Models: 293 \| Enums: 68 \| FK edges: 488 \| Domains: 23` vs the generator's 293/68/488 — exact match on all three counts the generator emits. **No re-merge needed; no generator was run against a tracked artifact this run** |
| main CI is green | [MEASURED] | `gh run list --commit bfd2596b42b00339b6c5949f5a7e177c89f75520` (FULL sha — §9.4) → 4 runs, all `completed/success`. Job `Data model — generator sanity` = **success** |
| **No ENVIRONMENT DISAGREEMENT** | [MEASURED] | Rule Zero cross-check: local `--check` OK **and** the corresponding CI job green on main at the same SHA |
| All 13 baseline targets absent from main | [MEASURED] | `git cat-file -e origin/main:<path>` — 8 distinct paths all non-zero; **positive control `CLAUDE.md` → exit 0** |
| 7 of those 8 paths have **never existed** in this repo | [MEASURED] | `git log origin/main --oneline --follow -- <path>` → **0 commits** each; **two positive controls**: `CLAUDE.md` = 5, `tender-client-notes.controller.ts` = 2 |
| Model ↔ migration coherence is CLEAN | [MEASURED] | 293 models, 293 `@@map`s, 0 models without a backing `CREATE TABLE` (positive control `created.has('users')` = true). The 4 apparent orphan tables (`user_ai_providers`, `user_ai_preferences`, `subcontractor_contacts`, `leads`) are each explicitly dropped — found among 38 `DROP TABLE` statements |
| sot/02 §2 names 2 PRs as open that are merged | [MEASURED] | `gh pr view` → **#894 MERGED 2026-08-04T04:41Z**, **#895 MERGED 2026-08-04T05:09Z**. sot/02:61 still reads "In-PR — open right now (2)" |
| 32 of 81 API modules unnamed in sot/01 | [MEASURED] | `readdirSync('apps/api/src/modules')` = 81; 32 not string-matched in sot/01 (positive control: `tendering` matched) |
| Watcher alive, clone dirty=3, 2 registry escapees | [MEASURED] | sweep §2 [LIVE] — pid 24744, wrapper alive. **Station 03's lane, not mine** |

### Leads — measured, but NOT dispositioned as findings

- **A `[CANNOT MEASURE]` I will not dress up:** `check-sot-refs.mjs` resolves with `existsSync` against
  the **working tree**. Every number I quote for it was taken in a **clean worktree off `origin/main`**
  (`C:\po-worktrees\sot05-refs-burndown`), which is the baseline `_readme`'s own TRAP 1 cure. The dev-tree
  reading (`baselined=13`) and the clean-worktree reading agreed this run, but the clean one is the one
  that counts.
- **My own instrument lied once, and I caught it.** The first coherence probe reported **293 of 293**
  models missing a migration table. 293-of-293 is the all-fail signature of a broken query, not a finding
  (§7). The bug was mine: I matched model names against table names while every model carries an `@@map`.
  Repaired with a positive control, the true answer is **0**. The first drop-detector was broken too — a
  nested `\\b` escape that returned `false` for `users`, a table that plainly exists. **Neither was
  reported as a finding.** Recording it because §7 says the broken measurement is the dangerous failure.

## WHAT CHANGED

**One doc-reconcile PR. `sot/` + `docs/` only — CP-24 clean by construction (no `scripts/`, no `apps/`).**

1. **8 inline `<!-- sot-ref-allow: … -->` markers** written onto the 8 `sot/` lines carrying the 9
   provenance-class dangling references (sot/01 ×1, sot/03 ×5, sot/04 ×2). One line, `sot/03:9679`,
   carries two references and is cleared by its single marker.
2. **9 entries removed** from `docs/qa/sot-refs-baseline.json` (13 → 4).
3. **One sentence appended** to that file's `_readme`, because its closing claim — *"none is
   auto-fixable"* — is now false for the class this PR cleared, and leaving it would tell the next
   Station 05 not to try. No count was written into the prose (the `_readme` forbids it).

**Read-back, in the clean worktree:**

```
node scripts/pipeline/check-sot-refs.mjs
  total=274  dangling=0  exempt=19  baselined=4  excluded=2      exit 0
  (was: dangling=0  exempt=10  baselined=13)

node scripts/pipeline/check-sot-baseline-ratchet.mjs <base> <head>
  OK - 13 -> 4 baselined entries, no new (sot_file, missing_path) pair. Self-test: 4 cases passed.   exit 0

node scripts/pipeline/check-sot-bytes.mjs
  em-dash tree=160 main=160 · arrow tree=22 main=22 · verdict: CLEAN UTF-8 on disk
```

**Content-loss guards:** line counts unchanged in all three `sot/` files (1831→1831, 12034→12034,
5270→5270), and `git diff --numstat` reads `1/1`, `5/5`, `2/2`, `1/10` — a numstat far larger than the
intended change is the §9.3 encoding-damage symptom, and it is absent. All edits made with node
`readFileSync`/`writeFileSync` utf8, never `Set-Content` or `>`. Every marked line was asserted to
contain its expected reference **before** the write and re-read **after** it; the script aborts on
either check failing.

## FINDINGS

### F1 — The sot-refs baseline splits into two classes, and one of them was never a judgement call

`sot-refs-baseline.json` sat at 13 entries with its own `_readme` concluding *"Every remaining entry
needs a judgement call … so none is auto-fixable."* That was true of the **class**, not of every entry.
Two positive-controlled probes separate them: 7 of the 8 distinct targets have **zero commits in this
repository's entire history**. They are documents of the predecessor workspace `C:\Dev\ProjectOperations`,
folded in at the 2026-07-08 sot-consolidation — the citing prose says so itself (`sot/01:8` *"**Merged
from** (sot-consolidation, 2026-07-08)"*; `sot/03:9684` records the source files *"deleted on 2026-06-19
after their full content was confirmed"*). There is **nothing to repoint to and never will be**, and the
citation is *correct as provenance*. That is precisely the marker's documented purpose, and unlike a
line-number-keyed baseline entry the marker is line-drift-proof.

RULE 1 — complete and additive: the marker fixes it now (baselined 13→4) and permanently (no line-drift
re-keying, and CI can never re-raise it), while destroying no prose. A bare deletion would have turned
each into a hard CI failure, and repointing was impossible.

**DISPOSITION: ACTIONED** — verified by `check-sot-refs` (dangling=0, exempt 10→19, baselined 13→4,
exit 0) and the ratchet's own 4-case self-test, both in a clean worktree off `origin/main`.

### F2 — The 4 surviving baseline entries are a genuinely different problem: sot/06 documents code that is gone

These are **not** provenance. They are live technical claims in `sot/06-active-specs.md` about files that
do not exist:

| sot/06 | claims | measured |
|---|---|---|
| :1512, :1906 | `tendering/tender-scope-drafting.service.ts` "needs updating to the new 4-code system" | **0 commits, ever.** No successor: no file matching `scope-draft` anywhere on main |
| :2240 | "File: `estimate-export/pdf/quote-pdf.builder.ts` (1173 LOC)" | **0 commits, ever.** `estimate-export/pdf/` exists but holds only `tc-text.const.ts`. The nearest candidate, `client-quotes/quote-pdf.service.ts`, is **142 lines** — not a 1173-LOC successor |
| :3943 | `### modules/tendering/tender-client-notes.controller.ts — guards: JwtAuthGuard, PermissionsGuard` | **Deliberately retired** in `eae1c0a8`, *"refactor(tendering): retire TenderClientNote code surface (slice 1 of 2) (#1165)"*, 2026-08-18 |

A marker would be the wrong instrument here: it would silence CI while leaving `sot/06` asserting that a
retired controller is live and that work is pending on files nobody can open. The honest fix is to correct
the spec text, and **what it should now say is a spec judgement about current tendering/export behaviour** —
outside the deterministic allowlist, and not mine to guess (AUTHORITY: *"Anything requiring judgement is
NEVER auto-edited"*).

Note for whoever takes it: `#1165` is *slice 1 of 2*, so the `tender-client-notes` entry may be discharged
by slice 2 landing rather than by a doc edit — check that before writing prose.

**DISPOSITION: DEFERRED** — real, not now. It becomes urgent the moment anyone works from `sot/06`'s
tendering or estimate-export sections, or if slice 2 of `#1165` lands and the section is still asserting
the retired surface. The 4 entries stay baselined, correctly, until then.

### F3 — sot/02 has told every reader for 30 days that two merged PRs are "open right now"

`sot/02-roadmap-and-status.md:61` reads **"## 2. 🔧 In-PR — open right now (2)"** and tables `#895` and
`#894`. Both merged **2026-08-04**, within hours of the snapshot the section is dated to. The real open
board today is `#1544 #1543 #1541 #1536` — no overlap at all.

The section does caveat itself (*"Live snapshot read from GitHub at reconcile time (2026-08-04) … run
`bring-up-to-speed.ps1` — its `[LIVE]` lines beat this table"*), which is why this is drift rather than a
defect. But a heading that says **"open right now"** above a stale count is read as current far more often
than the small print beneath it is.

I did not fix it. The station brief puts *"roadmap STATUS semantics"* and *"curated prose in
sot/01/02/03/05/06"* under **NEVER auto-fix — report only**, and audit step 4 says *note* the drift. The
`sot-ref-allow` markers in this PR are a deliberate exception the station doc grants explicitly (*"The
marker is Station 05's alone to write"*) and they change no rendered content; rewriting a curated roadmap
table would.

Options for Marco, RULE 1 order:

- **(a) Complete + additive — make the section self-dating instead of self-describing.** Replace the fixed
  count and table with the two PRs' terminal state plus a standing pointer to `bring-up-to-speed.ps1` as
  the live list, and drop "(2)" from the heading. Passes both halves: it cannot go stale again (nothing
  states a live count), and no history is lost — the merged PRs stay named. Costs one curated edit Marco
  should eyeball.
- **(b) Refresh the table to today's four PRs.** Fails the *future* half: it is correct for a day and then
  wrong again, exactly as the 2026-08-04 snapshot was. It also puts a curated roadmap on a re-write treadmill.
- **(c) Leave it.** Fails the *immediate* half: the heading keeps asserting something measurably false, and
  `CLAUDE.md` already has to warn readers that sot/02 "lags reality — verify live PRs", which is a
  documentation patch over a data problem.

**DISPOSITION: ESCALATED** — Marco's call, because it is curated roadmap content and (a) changes what the
section *is* rather than what it says. It is not blocking anything.

### F4 — 32 of 81 API modules are absent from sot/01's module registry

`apps/api/src/modules` holds 81 directories; 32 are not mentioned anywhere in `sot/01-charter-and-architecture.md`
— among them `client-quotes`, `estimate-export`, `expenses`, `tenants`, `authorization`, `admin-users`,
`tender-clients`, `tender-clarifications`, `win-likelihood`, `bid-prioritisation`, `schedule-of-rates`.
Positive control: the probe does match `tendering`, so it is not a broken search.

Audit step 7 is explicitly *report only*, and deciding which of 81 directories belong in a **curated**
registry (several are thin admin or settings surfaces) is judgement, not deterministic drift.

**DISPOSITION: DEFERRED** — worth one dedicated doc-reconcile pass by a later Station 05 run, sized as its
own PR rather than bolted onto a burn-down. It becomes urgent if anyone uses sot/01's registry as an
inventory of what the API does, because today it under-reports by 40%.

## WHAT I DID NOT DO

- **Did not arm, did not merge, did not touch the board.** Station 05 never does either. The 4 open PRs
  are untouched and I ran **no RULE-2 probe**, because I had no reason to: nothing in this run goes near a
  merge decision.
- **Did not regenerate `relationship-map.{md,json}` or re-merge sot/04's generated section.** The
  allowlist permits it; the measurement removed the reason (293/68/488 already match). Not running the
  generator also avoids the CRLF-vs-LF hash risk the brief warns about, and avoids the known
  `metadata-catalog.json` shrink.
- **Did not touch `sot/02` or `sot/01`'s registry prose** (F3, F4) — curated content, report-only.
- **Did not write markers on the 4 surviving entries** (F2). They would pass CI and leave `sot/06` lying.
- **Did not touch `scripts/`, `apps/`, `prisma/`, or `.github/`.** CP-24 forbids mixing them with `sot/`,
  and nothing here needed them.
- **Did not clear the watcher-clone dirt (3), the 3 orphaned worktrees or the 2 registry escapees** the
  sweep reports — Station 03's lane, and 03 is already dispatched on clone hygiene.
- **Did not clear the `[STALE]` needs-marco files** the sweep flags. Not my lane.
- **Did not edit the dev tree.** All work happened in a disposable worktree off `origin/main`; this
  breadcrumb ships **inside the PR**, so nobody has to sweep it up, and the worktree is torn down at the
  end of the run.

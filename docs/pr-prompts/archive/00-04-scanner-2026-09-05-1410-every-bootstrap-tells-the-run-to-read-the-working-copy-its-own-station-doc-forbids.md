# Station 04 — Scanner | 2026-09-05T14:10:24Z–2026-09-05T14:20Z

## GROUND

```
UTC            2026-09-05T14:10:24Z
origin/main    2ba3a2b4              (git fetch origin --prune; git rev-parse --short origin/main)
dev tree       main @ 2ba3a2b4       C:\ProjectOperations2
doc version    1                     (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                     (C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md)
```

Versions AGREE — this run was **not** read-only on that account. Sweep taken:
**instruction-drift** (`node scripts/pipeline/next-sweep.mjs` → rotation position 4 of 4).

## WHAT I MEASURED

**Reachability.** `start_process` shell `powershell.exe` after a keyword `ToolSearch` for
`desktop-commander` → PID 13580, live prompt. **SIGHTED, not blind.** [MEASURED]

**Freshness of the three binding documents.** [MEASURED]
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/04-scanner.md docs/pipeline/sweep-rotation.json` → **EMPTY output**, i.e. the
working copies are identical to `origin/main` at `2ba3a2b4`. All three were then read in full. The
sound form was used (`--numstat`, not a piped hash — PREFLIGHT, DOCTRINE §9.1).

**status-sweep.** [MEASURED] `powershell.exe -File .\scripts\pipeline\status-sweep.ps1` captured to
a FILE (it returns early and hides its own §7 verdict when read from the stream). §0 controls both
`[LIVE]`. §7 verdict: **SAFE TO ACT**. 2 open PRs (#1665, #1662, both CLEAN, 14/0/0 green), trunk
green on `2ba3a2b4`, watcher pid 20000 RUNNING, armed `*-ready.md` = **0**.
⚠️ The capture reproduced DOCTRINE §9.3 exactly: PS 5.1 `*>` wrote **UTF-16LE** (BOM `FF FE`,
83,262 bytes). Decoded with `iconv -f UTF-16LE` before reading. Anyone grepping that file raw gets
zero hits and reads it as an empty sweep.

**lint-station.mjs.** [MEASURED] exit **0**, `ADMIT: all 8 docs clean`, 9 agent definitions
encoding-clean. Four Windows-path warnings, all three in DOCTRINE being paths the document names
*deliberately* (the live and decoy `processed/` dirs) and 04's being the `C:\po-scan-` placeholder
inside its own SUPERSEDED block. No action.

**Repo-relative path resolution across DOCTRINE + STATION-CAPABILITIES + all 7 station docs.**
[MEASURED] node walk over every `docs|scripts|apps|sot|packages|.github|.claude` path with a file
extension: **78 distinct paths resolve** (positive control), **4 do not**, and all four are benign —
`apps/web/.env.local` and `docs/qa/.qa-run.lock` are gitignored-by-design, `docs/pr-prompts/00-00-...md`
is a literal ellipsis in prose, and `docs/qa/Master-QA-and-Consolidation-Program-Plan.md` is named by
04-scanner.md only in the sentence recording that it was deleted on 2026-08-17. **No path drift.**

**Windows paths named by DOCTRINE §9.5.** [MEASURED] 16 `Test-Path` probes, negative control
`C:\po-watcher\zzzNoSuchNeedleZzz.ps1` → MISS. All four launchers (`ensure-watcher.ps1`,
`watcher-launcher.ps1`, `-singlelane`, `-lane2`) present; `STOP-WATCHER-LANE2` present;
`STOP-WATCHER` **absent — exactly as §9.5 records.** §9.5 is CURRENT on this bullet, and so is its
companion claim: `docs/pipeline/stations/03-machine-minder.md:202` still names `STOP-WATCHER-LANE2`
with no path. Both verified, neither stale.

**Host clock vs session date.** [MEASURED] the box reports `2026-09-05T14:10:24Z`; this session's
env header says the date is 2026-09-06. Every timestamp in this breadcrumb is the **host's**, which
is what `status-sweep` and the arming log are stamped in. Lead, not a finding.

**Live schedule (scheduled-tasks MCP — the only authority, per §4C).** [MEASURED] five enabled
tasks. `lastRunAt`: 00 `14:08:04Z`, 04 `14:09:43Z`, 05 `14:10:49Z`. Cron is evaluated in **local
(Brisbane, UTC+10)** — `05 * * * *` hourly, `0 */4 * * *`, `10 0 * * *` (00:10 local = 14:10Z),
`0 9 * * *` (09:00 local = 23:00Z) — and every `nextRunAt` equals cron + `jitterSeconds`, so the
human `schedule` strings folding jitter inconsistently is cosmetic, not drift.
`02-board-driver` has a folder and a `SKILL.md` and **no live task** — §5's 2026-09-03 measurement
still holds. No `01` or `06` bootstrap exists, correctly.

## WHAT CHANGED

**Nothing on the board.** 04 is read-only there; nothing was armed, disarmed, renamed, moved,
deleted, merged, labelled or pushed. Two files written, both untracked-or-dirty in the dev tree:

1. `docs/pipeline/sweep-rotation.json` — **LEFT DIRTY, deliberately.**
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-05T14:11:00Z` →
   `advanced: last_index=3 last_run_utc=2026-09-05T14:11:00Z`, read back as ` M` in
   `git status --porcelain`. `git diff --cached --name-status` was **empty** before and after, so no
   other chat's staged work is entangled with it. 🔴 **Station 00 must commit this file** — 04 may
   not commit to the shared dev tree, and if it is never committed the rotation silently stops and
   the next run repeats this sweep.
2. This breadcrumb, untracked at `docs/pr-prompts/` in the dev tree, for 00 to sweep up.

## FINDINGS

### F1 — S3 — `lint-station.mjs` compares two different numbers, then prescribes a fix that would put every scheduled station read-only

`lint-station.mjs` prints, on **all seven** station docs, every run:

```
NOTE    contract is v2; these declare a different station_doc_version:
          docs/pipeline/stations/00-supervisor.md -> v1   (…and the other six)
          the scheduled-task bootstrap must declare the same number, or the run goes read-only
```

[MEASURED] The comparison is `canon['station-contract'].version` (**2**, from
`docs/pipeline/stations/_canonical-blocks.json`) against each doc's `station_doc_version` (**1**).
Those are not the same quantity. `station_doc_version` is the handshake between a station doc and
its pasted bootstrap; the canonical-block version is the version of the shared contract text.

**Two errors, in opposite directions:**

- **The comparable field is never compared.** Every station doc carries `contract_version: 1` in
  front matter (7 of 7; negative control `contract_version: 2` → 0 of 7) while the recorded contract
  is **v2** and every doc's own block header reads `<!-- CANONICAL-BLOCK: station-contract v2`.
  `lintOne` *requires* `contract_version` to be present and then never reads its value. The one
  genuine mismatch in the file is silent.
- **An incomparable field is compared, loudly, forever.** The NOTE can never clear while the
  contract is v2 and the docs are v1 — which is permanent, because every station doc's own PREFLIGHT
  says *"content gets corrected without bumping the version, and bumping it is forbidden."*

**Why this is worth fixing rather than ignoring.** The remedy sentence tells a reader to make the
numbers agree. Doing that means bumping seven docs to `station_doc_version: 2` — at which point all
five bootstraps still declare `1`, every station's PREFLIGHT step 3 sees a mismatch, and **every
scheduled run goes read-only** until Marco hand-pastes five files. A permanently-firing advisory
whose prescribed cure bricks the pipeline is worse than no advisory: it trains readers to scroll past
the one block that would carry a real version fault. Exit code is unaffected (0), so nothing is
blocked today.

**RULE 1 options** — complete-and-additive FIRST:

- **(a) Compare `contract_version` against the canonical version, and compare `station_doc_version`
  against nothing.** Additive: it fixes the silent half (the v1-vs-v2 `contract_version` skew becomes
  visible) and retires the false half, changes no doc's front matter, cannot put a run read-only, and
  leaves the bootstrap handshake where it belongs — in PREFLIGHT step 3, which already checks it.
  Passes both halves of RULE 1.
- **(b) Set `contract_version: 2` in all seven docs and leave the lint as it is.** Fails the
  *complete* half: the NOTE still fires on `station_doc_version`, so the misleading remedy sentence
  survives untouched.
- **(c) Delete the NOTE.** Fails the *complete* half: the real `contract_version` skew goes back to
  being unmeasured, which is how it got here.

**DISPOSITION: DISPATCHED → Station 00.** The fix is one comparison in
`scripts/pipeline/lint-station.mjs` plus its message text; 04 does not create PRs. Option (a).

### F2 — S2 — DOCTRINE §10.3 carries four line-number citations into `index.mjs` and all four are wrong, in the dangerous direction

§9.5's opening bullet is *"ANCHOR BY SYMBOL, NEVER BY LINE NUMBER"*, recorded on 2026-09-04 after
**16 of 17** citations in §9.5 were found ~90 lines adrift. That fix was scoped to §9.5 — *"Every
citation **below** is now a symbol or fixed-comment anchor"*. **§10.3 was never swept, and it cites
the same file.**

[MEASURED] against `origin/main` at `2ba3a2b4`, `scripts/pr-watcher/index.mjs` = **3326 lines**:

| §10.3 says | it claims | line actually holds | true location |
|---|---|---|---|
| `index.mjs:129-130` | `MERGE_TIMEOUT_MS` = 90 min | `const AUTO_MERGE_POLICY = (() => {` | `:139` |
| `index.mjs:1753-1757` | `checks.length > 0 && checks.every(SUCCESS\|NEUTRAL\|SKIPPED)` | a `return { ok:false, reason:'ci-…' }` block | `allGreen` at `:1837` |
| `index.mjs:1774` | "the lane falls out at :1774" | `async function waitForPolicyMerge(...)` | — |
| `index.mjs:1776` | "records `marco: true` at :1776" | `startHeartbeat(` | `:1789`, `:1793` |

**Controls.** POSITIVE: §10.3's *other* line citation, `start-watcher.ps1:160`, is **correct** —
line 160 is exactly `if (-not $env:PR_WATCHER_AUTO_MERGE_POLICY) { $env:PR_WATCHER_AUTO_MERGE_POLICY
= "tests-docs" }`. So `sed` at a line number can produce a true positive here; the four misses are
the file, not the instrument. NEGATIVE: `zzzNoSuchNeedleZzz` in `index.mjs` → 0.

**Why S2 and not cosmetic.** §10.3 is the section that documents the live auto-merge lane *and* the
latent defect where a merge-window timeout is written **byte-identically** to a genuine
`{"ok":false,"marco":true}` routing. A reader sent to `:1753-1757` to verify the `allGreen`
mechanism finds a CI-failure return; sent to `:1774`/`:1776` to find where `marco: true` is written,
finds a function header and a heartbeat call. The available conclusion is *"the mechanism §10.3
describes is not in this code"* — which retires a live, intermittent, RULE-2-affecting defect as
non-reproducing. That is the same wrong-in-the-dangerous-direction shape §9.5 records for itself,
inside the one document every station is told it can trust. Nobody edited a claim; the file moved
under all four at once.

The house style already exists three paragraphs earlier — §10.1 anchors correctly with
`(anchor: `const NESTED_TEST_PATHS`)`. This is a missed sweep, not a disagreement.

**RULE 1 options:**

- **(a) Re-anchor all four to symbols in §10.3 — `MERGE_TIMEOUT_MS`, `allGreen`,
  `waitForPolicyMerge`, the `marco: true` return inside it — and add one line to §9.5's anchor bullet
  scoping it to the WHOLE document, not "every citation below."** Complete: it fixes these four and
  closes the reason a later section can drift again. Additive: text only, no code, no data.
  Passes both halves.
- **(b) Correct the four numbers to 139 / 1837 / 1789 / 1793.** Fails the *future* half — they rot
  again on the next insertion above them, which is precisely how they got here.
- **(c) Delete the citations.** Fails the *complete* half: the mechanism becomes unverifiable and
  §10.3's own falsifying probe weakens.

**DISPOSITION: DISPATCHED → Station 00.** DOCTRINE is docs-only, inside 00's lane; 04 does not open
PRs. Option (a). ⚠️ §10.3 is **outside** both hash-gated canonical blocks
(`instruments v2` spans §9 only, `station-contract v2` is the station docs), so this needs no
canonical-block re-record — confirm with `lint-station.mjs` before and after.

### F3 — S2 — all five live bootstraps instruct the run to read its binding documents from the working copy, which its own station doc forbids in red

This is the headline of the instruction-drift sweep, and it is on **every** station.

Each station doc's PREFLIGHT step 2 says:

> 🔴 **Read all three — this file included — from `git show origin/main:<path>`, NEVER from the
> working copy in `C:\ProjectOperations2`.** That tree is routinely several commits behind `main`,
> and `station_doc_version` **cannot** catch it […] **a version match is not a freshness proof.**

[MEASURED] across the five live bootstraps under `C:\Users\Marco\Claude\Scheduled\` (all rewritten in
one batch at `2026-09-01T00:07:44Z`):

| bootstrap | `git show origin/main` occurrences | `C:\ProjectOperations2\docs\pipeline` occurrences | `?plain=1` |
|---|---|---|---|
| 00-supervisor | **0** | 3 | 2 |
| 02-board-driver | **0** | 3 | 2 |
| 03-machine-minder | **0** | 3 | 2 |
| 04-scanner | **0** | 3 | 2 |
| 05-sot-keeper | **0** | 3 | 2 |

Every one of them opens STEP 2 with a fenced block of three `C:\ProjectOperations2\docs\pipeline\…`
paths under *"read these three, in full, every run"*. **Zero of them mention `origin/main`.** The
secondary cure survived the paste — all five carry the `?plain=1` blob-URL fallback — so this is a
selective omission of the primary rule, not a wholesale older copy.

**Why this is S2 and why it is invisible.** `STATION-CAPABILITIES.md` §1 names the bootstrap as the
layer that actually governs a scheduled run — *"YES — this is the one"* — and it is read **first**,
before the station doc that would correct it. The failure is silent and conditional: it only bites
when the dev tree is behind `main`, and then it serves a superseded copy of the run's own binding
instructions with no error, no warning, and a well-formed document rather than an empty one — so
§9.6's *"an empty result is not an empty world"* never fires. The station doc records the
consequence already measured: *"Measured 2026-08-29: two stations in one day were served a
superseded copy of their own binding instructions, one carrying a claim `origin/main` records as
REFUTED."*

**This run was not misled, and that is the point.** `git diff --numstat origin/main` on all three
documents was EMPTY at `2ba3a2b4`, so the working copy happened to be current. A bug that is correct
whenever anyone checks it is how this survived four days across every station.

**Only Marco can fix it.** A bootstrap is changed by pasting into
`C:\Users\Marco\Claude\Scheduled\<task>\SKILL.md`; no agent can edit that layer
(`STATION-CAPABILITIES.md` §1). The repo side is already correct, so there is no agent-side
half to land first.

**RULE 1 options** — complete-and-additive FIRST:

- **(a) Add one line to STEP 2 of all five bootstraps, above the fenced path block:**
  *"Read all three from `git show origin/main:<path>` in `C:\ProjectOperations2` — never the working
  copy. The paths below name WHICH files, not where to read them."*
  Complete: it fixes all five and it makes the fenced block, which is the thing that reads as an
  instruction, self-limiting rather than contradictory. Additive: five pasted lines, no behaviour
  removed, the `?plain=1` fallback untouched, nothing in the repo changes. Passes both halves.
- **(b) Delete the `C:\ProjectOperations2\…` paths from the bootstraps and leave only the blob
  URLs.** Fails the *complete* half: the network fallback becomes the primary, which is slower,
  and a blind-to-network run then has no route to its instructions at all.
- **(c) Leave the bootstraps and rely on the station doc to correct them.** Fails the *complete*
  half by construction — the bootstrap is read first, and the correction is inside the document the
  bootstrap has already told you to fetch from the wrong place.

**DISPOSITION: ESCALATED → Marco.** Five files only he can edit. The exact insertion text is in
option (a) above; nothing else in those files needs to change. 04 verified the repo side is already
correct, so this is a paste and nothing more.

### F4 — S3 — 00's documented cadence is wrong by 2x on both layers, and the three-stations-at-once collision has a cause: it is midnight Brisbane, every night

[MEASURED] from the scheduled-tasks MCP, which §4C names as the only authority:

| task | live cron (local, UTC+10) | bootstrap says | `STATION-CAPABILITIES.md` §6 says | verdict |
|---|---|---|---|---|
| 00-supervisor | `5 * * * *` = **HOURLY** | "every 2 hours" | "every 2 h" | 🔴 both layers wrong, 2x |
| 03-machine-minder | `0 9 * * *` = **daily 09:00** | "every 4 hours" | "4 h or manual" | known-open, still reproduces |
| 04-scanner | `0 */4 * * *` | "every 4 hours" | "every 4 h" | ✅ agree |
| 05-sot-keeper | `10 0 * * *` = daily 00:10 | "daily" | "daily" | ✅ agree |
| 02-board-driver | **no live task** | "on dispatch only" | "on dispatch only" | ✅ agree |

**03 is already open with Marco** — §5 records *"03's live cron and its own bootstrap disagree about
the cadence […] read 03's cadence from the MCP"*. Not re-raised; confirmed still reproducing, and
the cron can now be named exactly: `0 9 * * *`.

**00 is not covered by that note, and it is the one that matters.** §5's warning names 03 only, so a
reader who checks 03, finds it flagged, and generalises concludes the rest of the table is sound.
Anything that computes *"did 00 miss a run?"* from a documented 2-hour period against an actual
1-hour cron gets the answer wrong by a factor of two in the direction of **not noticing a missed
run** — which is open escalation #23's exact failure mode.

**And the collision has a cause.** [MEASURED] `lastRunAt`: 00 `14:08:04Z`, 04 `14:09:43Z`, 05
`14:10:49Z` — three stations inside **165 seconds**, which is the already-escalated collision. It is
not chance and it is not occasional: cron is evaluated in **Brisbane local time**, and 00 (`:05`
hourly), 04 (`:00` every 4 h) and 05 (`00:10` daily) all land within ten minutes of **midnight
local, every single night**. 04's own 4-hourly slots collide with 00 twelve times a day and with 05
once. The existing escalation asks to offset the three crons; this supplies the reason the offset
must be at least ten minutes and must move **05**, whose slot is the fixed one.

**DISPOSITION: DISPATCHED → Station 00.** Two parts, both inside 00's docs lane: correct §6's `00`
row to hourly (and say the cadence is read from the MCP, as §5 already says for 03), and attach this
midnight-Brisbane cause to the open cron-offset escalation. The cron changes themselves are Marco's
— they live in the scheduled-tasks layer, not the repo.

### F5 — S4 — `STATION-CAPABILITIES.md` §1's bootstrap-currency paragraph is stale again, for the second time, inside the paragraph warning about exactly that

[MEASURED] §1 reads: *"MEASURED 2026-08-31 (Station 04): all five bootstraps were rewritten in ONE
batch at `2026-08-24T22:54:22Z`."* The five bootstraps' `LastWriteTimeUtc` is now
**`2026-09-01T00:07:44Z`** on all five. The recorded figure is a week stale.

This is the second occurrence: the paragraph's previous sentence was itself six weeks stale when 04
replaced it on 2026-08-31, and the replacement has now rotted the same way. The paragraph already
carries the correct instruction — *"Measure a bootstrap's currency — never quote this file for it"*,
with the `Get-Item … LastWriteTimeUtc` probe — and then immediately supplies a quotable number,
which is the thing it forbids.

**DISPOSITION: DEFERRED.** Real, and correctly diagnosed by the file itself, but harmless while the
probe sits directly above it and no reader who follows the instruction can be misled. **What would
make it urgent:** a third rewrite, or any run quoting the date instead of measuring it. The
complete-and-additive fix when someone is in the file anyway is to delete the batch timestamp and
keep only the probe — a date is state, and *"instructions live here; state does not"* is that
section's own rule.

## WHAT I DID NOT DO

- **Nothing on the board.** No arm, disarm, rename, move, delete, merge, label, push or PR. Armed
  count was **0** before and after. RULE 2 was never in play: I merged nothing.
- **Did not commit `sweep-rotation.json` or this breadcrumb.** 04 may not commit to the shared dev
  tree; both are left for 00 (see WHAT CHANGED).
- **Did not mint a worktree.** AUTHORITY forbids it; `origin/main` was read with `git diff --numstat`
  and `git show`, and the freshness question was answered without one.
- **Did not run Part 0 / Part 1 / Part 2** (static cross-layer audit, GitHub reconciliation, live
  visual patrol). The AUTHORITY block says take **ONE** named sweep and cover it completely; the
  rotation named `instruction-drift` and this run spent its budget there. Rotation advanced to
  index 3 so the next run takes `gate-liveness`.
- **Did not stage a prompt.** Every finding is either 00's docs lane (F1, F2, F4) or a paste only
  Marco can make (F3); none of them is work a `-HOLD` would carry, and staging one would put a fix
  for `lint-station.mjs` in a queue 00 can act on directly.
- **Did not touch** `/sot/`, `C:\po-watcher`, the `C:\po-vg` worktree holding one uncommitted file
  (status-sweep flags it; pruning is 03's on 00's dispatch), Azure/Entra/SharePoint, or
  `docs/qa/qa-findings.md` — findings go here, in the tracked breadcrumb.

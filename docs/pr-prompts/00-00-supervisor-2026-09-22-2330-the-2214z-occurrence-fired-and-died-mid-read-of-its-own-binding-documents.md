# Station 00 — Supervisor | 2026-09-22T23:29Z–2026-09-22T23:45Z

## GROUND

```
UTC            2026-09-22T23:29Z
origin/main    2cfd5b23   (git fetch origin +refs/heads/main:..., then git rev-parse --short)
dev tree       main @ f3162a44  C:\ProjectOperations2   -> fast-forwarded to 2cfd5b23 this run
doc version    1          (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1          (scheduled-task SKILL.md, station_doc_version: 1)
```

**doc version and bootstrap AGREE (1 = 1).** No read-only clamp. This was a **SIGHTED** run:
Desktop Commander connected, `start_process` shell `powershell.exe` returned PID 26484, and every
`[MEASURED]` line below came from that shell or from `gh` through it.

⚠️ PREFLIGHT §2 requires the three binding documents be read from `git show origin/main:<path>`.
I read the **working copy**, having first proved it identical:
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, at a dev tree 0 ahead / 3 behind. EMPTY output is
the real answer (§9.2), so the working copy was byte-equivalent for those three paths.

## WHAT I MEASURED

**1. Device-bridge git guard — exit 2, INSTALLED BUT INERT.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, exit status of the
**installer itself**, nothing piped into `tail`/`Select-Object`:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
GUARD_EXIT=2
```

Exit **2** is the outcome the contract names as EXPECTED for a station. The ban held by memory:
**no `git` was run against the mount this run** — every git command went through the Windows shell.

**2. Dev tree was 0 ahead / 3 behind, and is now converged.** [MEASURED]
`git rev-list --left-right --count HEAD...origin/main` → `0	3`. The three commits were `#2104`
(my 21:15Z breadcrumb), `#2103` (S7 HOLD retirement), `#2099` (S7b staging).
`git merge --ff-only origin/main` → exit 0, `Updating f3162a44..2cfd5b23`. **All four read-backs
pass together:** `0	0` · `git diff --numstat` EMPTY · `git diff --cached --name-status` EMPTY ·
`git status --porcelain --untracked-files=no` EMPTY. The FF was unobstructed — I checked
`git diff --name-status HEAD origin/main` first and the two root breadcrumbs it had to move were
**tracked renames into `archive/`**, not the untracked-copy blocker.

**3. The tracked-set probe, asked of `origin/main` and not of the dev tree.** [MEASURED]
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` → **1332** entries. Matched by basename:

| breadcrumb | hits on `origin/main` | where |
|---|---|---|
| `00-00-supervisor-2026-09-22-2010-…` | **1** | `docs/pr-prompts/archive/` |
| `00-00-supervisor-2026-09-22-2040-…` | **1** | `docs/pr-prompts/archive/` |
| `00-04-scanner-2026-09-22-2211-…` | **0** | genuinely unreported |
| a freshly minted needle — NEGATIVE control | **0** | — |

🔴 **`check-breadcrumb.mjs`'s structure pass printed `is UNTRACKED — it reaches nobody` for all
three**, including the two that are tracked in `archive/`. That is the dev-tree-behind reading the
2026-09-22T20:1xZ correction (`TRACKED_SET_PROBE_MUST_ASK_ORIGIN_MAIN_V1`) records, arriving from
the validator instead of from a hand-rolled `ls-files`. Acting on it commits a second tracked copy
at the root path — the 2026-09-07 duplicate. **I committed only 04's**, which is the one the
`origin/main` probe says is real.

**4. Freshness, and the third instrument that names the cause.** [MEASURED]
`node scripts\pipeline\check-breadcrumb.mjs --freshness` → exit **2**:

```
00  last 2026-09-22T21:15:00Z  2.3h ago  (cadence 1h)  SILENT
03  last 2026-09-21T23:04:00Z  24.5h ago (cadence 24h) ok
04  last 2026-09-22T22:11:00Z  1.4h ago  (cadence 4h)  ok
05  last 2026-09-22T14:23:00Z  9.2h ago  (cadence 24h) ok
```

✅ **`CADENCE['00']` now reads 1h.** The `'00': 2` defect `STATION-CAPABILITIES.md` §6 records as
open is **CLOSED** — `--freshness` printed `(cadence 1h)`, so the instrument no longer needs three
missed hourly runs to call 00 SILENT.

Crossed against `list_scheduled_tasks`: `00-supervisor` `5 * * * *`, `lastRunAt
2026-09-22T23:28:56Z` — **that is this run**. Fresh `lastRunAt`, no breadcrumb for the intervening
occurrence, so per the station doc's table the session directory is the deciding instrument.
Scanned **for a directory of ANY name** at that depth, per the 2026-09-15 rename correction:

```
ANYNAME_DEPTH3_COUNT = 1634        LOCAL_PREFIX_COUNT = 1535  (old glob, control — 99 blind)
2026-09-22T20:17:29Z  cbb5009c     2026-09-22T22:10:01Z  fc8778d4   (04, reported 22:11Z)
2026-09-22T21:14:21Z  f0b21b67     2026-09-22T22:14:22Z  f69d297d   <- 00, NO BREADCRUMB
2026-09-22T23:28:56Z  8e40607f     2026-09-22T23:28:57Z  a065a348   (me; and 03)
```

**The 22:14Z occurrence FIRED.** Its transcript (`local_f69d297d-…`, state `idle`) is:

```
bash -> start_process -> interact_with_process -> "Ground stamped. Continuing my station doc."
-> Read x8 -> (nothing further, no [result])
```

It reached the box, stamped its ground, began reading its binding documents, and **died on the
eighth `Read` with no result line.** Not blind — it had the shell. It ran out before it could act.

**5. Watcher and safe-to-act.** [MEASURED] `status-sweep.ps1`, exit 0, captured to a file and
decoded `utf16le` (BOM `FF FE` confirmed — the `*>` trap in §9.3 is live and I did not read it raw).
`SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`
watcher node RUNNING pid 9744 · wrapper alive (1) · heartbeat 117 min with `armed: 0`, which is idle
and not wedged · `index.lock` False/False · 0 scoped git processes · no PR touched in 2 min.

**6. The sweep's clone-dirty warning is the documented false alarm — re-derived from its source.**
[MEASURED] both forms against `C:\po-watcher\ProjectOperations` in the same minute:

| form | result |
|---|---|
| `git status --short` (the sweep's form) | **4** — `.codex/`, `AGENTS.md`, `docs/pr-reviews/pr-2100-review.md`, `scripts/pr-watcher/.conflict-notified-prs.json` — **all untracked** |
| `git status --porcelain --untracked-files=no` (`start-watcher.ps1`'s own form) | **0** |

Corruption test: `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply`,
`sequencer`, `index.lock` — **all absent**. The clone is healthy; `<-- the watcher may refuse to
start` is false, exactly as DOCTRINE §9.5 records. **Not dispatched to 03.**

**7. Lane classification of the three open PRs.** [MEASURED] §10.1 step 1, prompt logs only,
`rev-*` excluded. Corpus: **941** logs, **755** verdict lines, **707** distinct PRs, highest #2071.
POSITIVE control `PR #2071` → **2**. NEGATIVE control `PR #999997` → **0**.
`#2100` / `#2101` / `#2102` → **0 each**.
⚠️ My first positive control (`PR #2093`) **also returned 0**, which is what forced the calibration:
the corpus's newest log is `2026-09-21T16:43Z`, **older than all three PRs' `createdAt`**, so the
freshness precondition fails and the zeroes are `[CANNOT MEASURE]`, not "second lane".
Corroborated by instruments the kill loop cannot erase: `.arming-log.txt`'s last row is a **DISARM**
at `2026-09-22T17:26:49Z` (no arm in the PRs' window); `armed: 0`; and the three PRs were created
`21:13:24Z`, `21:13:50Z`, `21:14:00Z` — **36 seconds apart**, which a single-lane watcher cannot do.
⇒ `[NO LANE VERDICT — hand-classified]`: all three are **Station 00's own board PRs**, second lane.

## WHAT CHANGED

| # | change | read-back |
|---|---|---|
| 1 | dev tree fast-forwarded `f3162a44` → `2cfd5b23` | `0	0` · `--numstat` EMPTY · `--cached` EMPTY · `--porcelain` (tracked) EMPTY |
| 2 | **#2101 MERGED** via `Assert-SmokedOrEscalate` → `Merge-Pr` | `gh pr view 2101 --json state,mergedAt` → `MERGED`, `2026-09-22T23:38:54Z` |
| 3 | **#2102 MERGED** — gate passed, `Merge-Pr` refused on `BEHIND`, so `gh pr update-branch` then native `--auto --squash --delete-branch` | `gh pr view 2102` → `MERGED`, `2026-09-22T23:41:13Z`. **Read back as MERGED, not as "auto-merge enabled".** |
| 4 | spent worktree `C:\po-wt\rets7` removed (its branch `board/retire-scopecards-s7-hold` merged as #2103; `git status --short` in it was EMPTY before removal) | `git worktree list` no longer lists it; `Test-Path C:\po-wt\rets7` → **False** |
| 5 | escalation written to `docs/pr-prompts/needs-marco/scopecards-s9-staging-pr-carries-a-claude-design-file-outside-station-00s-lane-2026-09-22.md` | ⚠️ that folder is gitignored, so it reaches nobody on its own — **F2 below restates it in full** |
| 6 | this PR: my breadcrumb, 04's breadcrumb into `archive/`, and 00's 21:15Z breadcrumb `git mv`-ed to `archive/` | see the PR diff |

**I armed nothing.** `armed: 0` before and after — `.arming-log.txt` is byte-unchanged this run.
**I removed no label, touched no `/sot/`, ran no migration, and went nowhere near Azure/Entra/SharePoint.**

## FINDINGS

---

**F1 — Station 00's 22:14Z occurrence fired, reached the box, and died on its EIGHTH `Read` while
still ingesting its own binding documents. A whole hourly occurrence produced nothing.**
Severity **S2**.

Evidence: WHAT I MEASURED §4 — the session directory `f69d297d` exists with `CreationTimeUtc`
`2026-09-22T22:14:22Z` (any-name scan; the `local_*` glob would have missed it), and the transcript
ends after `Read x8` with no `[result]`. It was **not blind** — `start_process` and
`interact_with_process` both succeeded and it printed *"Ground stamped."* It simply did not survive
the read.

This is a **live instance of an already-open escalation**:
`needs-marco/binding-read-contract-exceeds-what-a-run-can-carry-2026-09-14.md` (present on disk,
mtime `2026-09-14T18:20Z`). The contract is **4,911 lines** —
`00-supervisor.md` 1,592 + `DOCTRINE.md` 2,727 + `STATION-CAPABILITIES.md` 571 — read in full,
every run, before any work begins. On 2026-09-14 that was a prediction. It is now measured: the
occurrence spent its entire budget on the preamble and never reached COLLECT, the board, or a
breadcrumb.

🔴 **The shape is what makes it expensive rather than merely wasteful.** A run that dies mid-read
leaves `lastRunAt` updated and no breadcrumb — which `--freshness` reports as `SILENT`, the same
reading a station that never fired produces. Without the session-directory scan the two are
indistinguishable, and the available conclusion ("the scheduler missed an occurrence") sends the
next reader to the cron, which is healthy.

**DISPOSITION: ESCALATED** — the remedy is a change to what a station is required to read, and
DOCTRINE §5.5 makes that Marco's, not a station's. The existing escalation file carries the
question; this run adds the first **measurement** behind it. I did not edit the binding documents
to shorten them: a station trimming its own binding law is exactly the change a reader should
distrust.

---

**F2 — #2100 stages a HOLD alongside a `Claude Design/` mockup, which is outside `tests|docs` AND
outside Station 00's recorded `docs/` lane. I did not merge it.** Severity **S3**.

Evidence: WHAT I MEASURED §7 for the lane, plus `gh pr view 2100 --json files` →
`docs/pr-prompts/pr-scopecards-s9-transport-capacity-matrix-HOLD.md` (in lane) and
`Claude Design/proposed/s8-s9-haulage-capacity/haulage-capacity-mockup.html` (**not** in lane).
Under `classifyPolicyFiles` the second path matches none of `^(tests|docs)/`, `(^|/)__tests__/`,
`\.(test|spec)\.[cm]?[jt]sx?$`, so §10.1 step 2 makes it **Marco's**; §10.1 step 3's station-lane
exception does not reach it, because `STATION-CAPABILITIES.md` §5 records 00's lane as `docs/`.

This is precisely the class the 2026-09-22T00:3xZ narrowing
(`NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1`) was written to protect: green, unlabelled,
not-watcher-routed, and outside the lane. **Precedent control:** `gh pr list --state merged
--limit 40 --json files` → **0** of 40 touch `Claude Design/` (40 PRs parsed), so no established
practice is being second-guessed.

⚠️ There **is** a `VERDICT: MERGE` for #2100 in the clone at `docs/pr-reviews/pr-2100-review.md`.
Per §10.3 `REV_LANE_UNCONSUMED_ON_SECOND_LANE_V1`, `verdictApproves` has one call site, inside
`waitForPolicyMerge`, which never runs for a PR the watcher did not open — so that verdict is
**unread by construction and is not a lane clearance.** Named here so the next reader knows it
exists and knows why it was not treated as authority.

**RULE 1 options — complete-and-additive first:**

- **(a) Give `Claude Design/` a recorded lane, gated by CI.** Add it to 00's row in
  `STATION-CAPABILITIES.md` §5 **and** ship a `pr-gates.mjs` check hard-blocking any PR mixing
  `Claude Design/` with `apps/`, `packages/`, `scripts/`, `.github/`, `package.json`,
  `pnpm-lock.yaml` or `migrations/` — the way CP-24 proves 05's lane. §10.1 step 3's own proviso
  demands exactly that before a new lane outside `tests|docs` may exist. Solves it now and in
  future, damages no data entry. **Fails neither half.**
- **(b) Home mockups under `docs/design/proposed/…`** and stop attaching `Claude Design/` files to
  staging PRs. Immediate, permanent, no new gate. **Fails the data-entry half in the workflow
  sense** — it moves a designer-facing artefact out of the folder the design workflow reads.
- **(c) Marco merges #2100 by hand.** Clears the board now. **Fails the "future" half** — the next
  staging PR carrying a mockup stops the board identically.

**DISPOSITION: ESCALATED** — filed at
`docs/pr-prompts/needs-marco/scopecards-s9-staging-pr-carries-a-claude-design-file-outside-station-00s-lane-2026-09-22.md`,
and restated here in full because that folder is gitignored and the file alone reaches nobody.
I did **not** widen my own lane in `STATION-CAPABILITIES.md`; a station granting itself authority is
the one edit a reader should distrust.

---

**F3 — COLLECT: Station 04's 22:11Z breadcrumb, F1 (blind run, Desktop Commander
`CONNECT_TIMEOUT`).** Severity **S2**, as 04 filed it.

04's own disposition was ESCALATED and I am not overturning it: the bridge host is Marco's
environment and no agent can diagnose a transport that will not open. What I can add is a
**negative control from the other side** — the very next occurrence of the same bridge, mine at
23:28Z, connected on the first `start_process` call. So the fault is **intermittent**, which
matches `STATION-CAPABILITIES.md` §2's "roughly 40% of Station 00's recent runs" and refutes any
reading of 04's report as "the bridge is down".

⚠️ **04's 4h occurrence is still a hole in coverage**, and `sweep-rotation.json` is byte-unchanged
at `last_index: 1` — **the next sighted Station 04 run is owed index 2, "repo-hygiene"**. 04 was
right not to advance a pointer for a sweep it never ran. I have not advanced it either; it is not
my rotation.

**DISPOSITION: ESCALATED** — carried forward unchanged to 04's existing escalation, with the
intermittency measurement added. No agent-side action exists.

---

**F4 — COLLECT: Station 04's F2 (`vm-git-guard` INERT) and F3 (the breadcrumb validator cannot be
run from a bridge-only shell).** Severity **S3** each.

F2 reproduced exactly on my run — same exit **2**, same headline (WHAT I MEASURED §1). It is the
contract's documented middle outcome, not an anomaly, and 04's DEFERRED was correct. Its urgency
trigger is unchanged: an exit other than 0 or 2, or a fresh 0-byte `index.lock` with no owning
process.

F3 is sound and I can close half of it by demonstration rather than by argument: I ran
`check-breadcrumb.mjs` from the **Windows shell**, where `git`/`gh` are legitimate, so the gap 04
names is specific to bridge-only runs and does not bite a sighted one. 04's workaround — decline to
run it, decline to claim `breadcrumb-clean`, hand-check and say so — is the right behaviour and
should be written into the contract rather than rediscovered.

**DISPOSITION: DEFERRED** (both). **What would make either urgent:** for F2, an exit outside {0,2}
or a fresh orphan `index.lock`; for F3, F1-of-04 being answered in a way that makes bridge-only runs
normal, or a breadcrumb asserting `breadcrumb-clean` with no quoted command behind it.

---

**F5 — COLLECT: Station 04's LEAD (dev-tree HEAD vs `origin/main` diverged, direction
`[CANNOT MEASURE]` on a blind run). RESOLVED.** Severity **S4**.

04 recorded `f3162a44` vs `2cfd5b23` and correctly refused to disposition a divergence whose
direction it could not measure, filing it as a lead rather than a finding. Measured from the shell
this run: `git rev-list --left-right --count HEAD...origin/main` → **`0	3`** — 0 ahead, 3 behind.
**No local drift**, so the NO-DRIFT failure mode was not in play. Fast-forwarded; all four
read-backs pass (WHAT I CHANGED #1).

**DISPOSITION: ACTIONED** — verified by the four read-backs and by `git rev-parse --short HEAD` →
`2cfd5b23`.

---

**F6 — A spent Station 00 board worktree was left behind at `C:\po-wt\rets7`.** Severity **S4**.

The sweep flagged it as `orphaned worktree (aborted run leftover)`, `dirty=0`, age 124 min. It was
**not** an aborted run: its HEAD `0abde556` is *"docs(pr-prompts): retire the scopecards S7 HOLD"*,
whose branch `board/retire-scopecards-s7-hold` **merged as #2103**. So it is a completed 00 board
worktree that its own run never tore down — BOARD DRIVING condition 2 says "Tear it down always".

Cleaning up my own station's leftover is finishing my job, not doing 03's (LL-38 is about acting in
a *shared* tree; this is a disposable one with merged work and a clean status). `git status --short`
in it was EMPTY before removal, per PHASE 3f.

**DISPOSITION: ACTIONED** — `git worktree remove` exit 0; read back: absent from `git worktree
list`, `Test-Path` → **False**.

---

**F7 — `CADENCE['00']` in `check-breadcrumb.mjs` has been fixed; `STATION-CAPABILITIES.md` §6 still
describes it as open.** Severity **S4**.

§6 carries a 🔴 clause stating `{ '00': 2, … }` and that `--freshness` "will not call `00` SILENT
until 4 h". [MEASURED] this run, `--freshness` printed **`(cadence 1h)`** for 00 and called it
SILENT at **2.3h** — which a cadence of 2 could not do. The defect is closed; the paragraph that
records it as open is now the stale instruction.

Its own falsifying probe is *"the `const CADENCE =` line itself"*, and the observed output satisfies
it. I did not edit `STATION-CAPABILITIES.md`: that is a `docs/` change inside my lane, but it is a
**correction to a binding document**, and the station doc says to hand-land those with the reason
stated rather than fold them into a collect PR. Naming it here so the next run does not re-derive a
closed defect.

**DISPOSITION: DEFERRED** — real, harmless while it only over-states caution, and one line to fix.
**What would make it urgent:** a run quoting §6's `'00': 2` clause to justify not treating a SILENT
00 as a defect.

---

## WHAT I DID NOT DO

- **Did not merge #2100** — F2. Green, clean, unlabelled and left alone deliberately.
- **Did not arm anything.** `armed: 0` before and after; `.arming-log.txt` byte-unchanged. The
  backlog's one `READY TO STAGE` item (`rates-11c-blocked-consumers`) is a *staging* recommendation,
  not an arm, and its chain is explicitly gated on a parity proof that must have RUN and come back
  clean. The two `UNBLOCKED, BUT NEEDS MARCO` items (`model-merge-slices-rehomed`,
  `map-locations-waste-rate-coupling`) both carry `DO NOT AUTO-STAGE`.
- **Did not touch `docs/pipeline/sweep-rotation.json`.** It is 04's rotation and 04 is owed index 2.
- **Did not dispatch the clone-dirty warning to 03** — WHAT I MEASURED §6 shows it is the documented
  false alarm (4 untracked, 0 tracked). Dispatching it is the mis-routed dispatch DOCTRINE §9.5
  records 13 times in `archive/`.
- **Did not restart or touch the watcher.** `restart-watcher-if-wedged.ps1`'s preconditions are not
  met: node running, wrapper alive, `armed: 0`. An idle watcher with nothing armed is CORRECT.
- **Did not run `git` against the mount**, not once, by any path — the guard was INERT (F4) and the
  ban held by memory.
- **Did not edit `/sot/`, remove a label, write production data, or go near Azure/Entra/SharePoint.**
- **Did not advance or clear any `needs-marco/` file.** The sweep produced exactly **one** `[STALE]`
  line this run and it is not PR-scoped (`no station summary younger than 3 days`), so the
  eleven-dead-escalations sweep the station doc describes had nothing to clear.
- **Did not read the binding documents from `git show origin/main:`** — I proved the working copy
  identical instead, and said so in GROUND rather than letting the reader assume.

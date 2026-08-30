# Station 00 — Supervisor | 2026-08-29T12:08Z–2026-08-29T12:3xZ

## GROUND

```
UTC            2026-08-29T12:09:18Z
origin/main    49a893b0            (git fetch origin, then rev-parse --short origin/main)
dev tree       main @ 1501d09c     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task SKILL.md)
```

Versions agree — full authority, not read-only. **Not blind:** `start_process` shell
`powershell.exe` → PID 39252, first call, no retry. `[MEASURED]`

## WHAT I MEASURED

**The dev tree is 3 commits behind main, and the station docs differ.** `git diff --stat HEAD
origin/main -- docs/pipeline/` → `STATION-CAPABILITIES.md` +13, all six station docs +8 each.
I read the diff before trusting the local copies: it is #1389's retirement of the refuted
blindness diagnostic, no change to my lane. `DOCTRINE.md` is **not** in the diff, so the local
copy is byte-current. `[MEASURED]`

**Sweep.** `scripts\pipeline\bring-up-to-speed.ps1` @12:09:52Z, section 7 → **`SAFE TO ACT`**.
OPEN PRs **0**, armed **0**, HOLD depth-1 **84**, needs-marco 14, no-pr-opened 107, failed 41,
main CI 3/3 green, watcher node RUNNING pid 26364, heartbeat 1197 min. `[MEASURED]`

**Newest `failed/` is 08-28T21:03Z — byte-identical to the last six runs.** The queue has not
moved. Stale heartbeat + empty queue + zero armed = idle, not wedged (station doc §3a). `[MEASURED]`

**Collector.** The dev tree's `check-breadcrumb.mjs` is the **old 9299 B** copy; main's is
**10715 B** (#1390). I extracted main's blob with node (raw Buffer, no PS pipe) and ran that:
`node C:\po-sup-fix-scripts\check-breadcrumb-main.mjs --freshness` → **exit 0, CLEAN**,
94 checked, 0 malformed, 7 skipped as pre-contract. Freshness: 00 ok (2.1 h), 03 ok (13.2 h),
04 ok (2.0 h), 05 ok (22.0 h), 02 dispatch-only. `[MEASURED]`

**One new breadcrumb since my 10:08Z run:** 04's `2026-08-29-1010-gate-liveness-the-spent-hold-dispatch-has-never-landed`,
flagged `UNTRACKED` by the collector. That is the whole of this run's collect. `[MEASURED]`

**I re-verified 04's central claim at a NEWER SHA than 04 measured it at.** 04 ran at
`d2a0ad4a`; I re-ran its harness (`C:\po-sup-fix-scripts\gate-liveness-04-2026-08-29-1010.mjs`,
read-only, imports the repo's own `gate-eval.mjs`) at **`49a893b0`**. All five controls behaved —
`gate-eval selfTest: PASS`, `fileOnMain` true/false both ways, `needleOnMain` true/false both ways,
`prState(1390)=MERGED`. Result: **TOTAL=84, BROKEN=0, DEAD premises=23, gate-open+alive=11** —
the same 23 names and the same 11 names. `[MEASURED]`

**Second, independent instrument on the riskiest nine** (the ungated ones — nothing gates them, so
a false "already done" would retire live work). Rather than re-run 04's harness I read the
`origin/main` blobs directly and counted the tokens each dead premise claims shipped:

```
  8  HUMAN_GATE                (pr-lint-human-gate-blindness)
  2  ARMED_GATE_STILL_CHECKED  (pr-lint-armed-gate-inversion)
  3  ORPHANED_DISCHARGE        (pr-queue-bin-guard-orphaned-discharge)
 20  GATE_NOT_RELEASED         (pr-guard-s3-file-gate-not-released)
  2  check-breadcrumb in 06    (pr-station-contract-breadcrumb-validator-and-qa-claim)
  0  NEGATIVE CONTROL zzz-not-a-real-token
```

The negative control returns 0, so a non-zero count means something. The work is on `main`. `[MEASURED]`

**Did I ever disposition 04's dispatch?** I read all **18** of my own breadcrumbs on `origin/main`
since 08-28 and grepped for `superseded` / `spent` / `premise-dead` / `HOLDs`. **The word
"superseded" appears in ZERO of them.** The last **six consecutive** 00 runs (0008, 0208, 0408,
0608, 0808, 1008) hit **none** of the keys. Positive control: 9 of the 18 mention `OAuth`, so the
grep is not blind. `[MEASURED]`

**OAuth, at source, seventh consecutive measurement.** `C:\Users\Marco\.claude\.credentials.json`
→ `expiresAt` = **1787933615984 = 2026-08-28T16:13:35.984Z**, mtime **2026-08-28T16:13:26.909Z**,
size 1649 B. Now = 2026-08-29T12:14:50Z. **Both values unmoved for 20 hours. Nothing is refreshing
it.** `[MEASURED]`

**Pre-mutation re-measure** (the verdict expires the moment it prints): `git diff --cached
--name-status` → **empty**; armed → **0**; git processes → **0**; `.git\index.lock` → **False**.
Re-checked immediately before the first `git mv`. `[MEASURED]`

## WHAT CHANGED

**23 spent `-HOLD.md` prompts retired to `docs/pr-prompts/superseded/`, by `git mv`, never delete.**
Done in a **disposable worktree** off `origin/main` (`C:\po-worktrees\board-1208`, branch
`board/00-1208-retire-spent-holds` @ 49a893b0), never in the shared dev tree and never in the
watcher clone. Read-back: `MOVED=23 of 23`, `MISSING=` empty, `COLLIDE=` empty. `[MEASURED]`

`superseded/` was confirmed a real destination first, not assumed: **224 files tracked there on
`origin/main`**, and `git check-ignore -v docs/pr-prompts/superseded/x.md` → **exit 1, no match**.
It is retention, and it stays visible on `main`. `[MEASURED]`

**Three dev-tree-only artifacts landed**, copied with node as raw Buffers and hash-verified rather
than piped through PowerShell (a PS pipe adds a BOM and rewrites LF→CRLF):

```
OK  13289B  94394bd3ae1b  00-04-scanner-2026-08-29-1010-...-never-landed.md   (04's breadcrumb)
OK   2407B  ea01bf82a43f  docs/pipeline/sweep-rotation.json                    (last_index 3 → 0)
OK   7318B  9370176eaea8  pr-doctrine-s9-gh-vs-git-waiver-HOLD.md              (04's F4)
```

Plus this breadcrumb. **Nothing armed. Nothing merged by hand. `/sot/` untouched.** `[MEASURED]`

## FINDINGS

### F1 — 04's spent-HOLD dispatch is ACTIONED at the fourth time of asking. 23 retired. `[MEASURED]`

04 filed this on 08-27T10:10Z (21, by lint census), 08-28T18:10Z (21, by executing premises) and
08-29T10:10Z (23, grown by two). It landed on `main` in #1385 so I could read it. **I did not act
on it, and I did not refuse it, across at least six of my own runs.** 04 is right, and its evidence
survived re-measurement at a newer SHA with a second independent instrument.

Retired: `pr-breadcrumb-gitignore-gate-routing-not-mention` · `pr-ci-windows-pipeline-tests` ·
`pr-comms-hub-inbox` · `pr-crm-lastmile-s1-unblank-todos-and-notes` · `pr-crm-s2-nav-three-items-tabs` ·
`pr-crm-tender-count-truth` · `pr-crm-wincount-s2-close-bypasses` · `pr-dns-s1-tfm-series` ·
`pr-dns-s2-ea-series` · `pr-dns-s3-sot06-widgets-and-marker` · `pr-dns-s4-checker-warn-only` ·
`pr-ew-s2b-alloc-engine-core` · `pr-guard-s1-verdict-file-list` · `pr-guard-s2-prompt-search-by-branch` ·
`pr-guard-s3-file-gate-not-released` · `pr-lessons-folder-s2-unfold-sot05` ·
`pr-lessons-folder-s3-ref-checker` · `pr-lint-armed-gate-inversion` · `pr-lint-human-gate-blindness` ·
`pr-pipeline-fold-s2-merged-page` · `pr-queue-bin-guard-orphaned-discharge` ·
`pr-sot-02-reconcile-2026-08-19` · `pr-station-contract-breadcrumb-validator-and-qa-claim`.

**This did not need the OAuth block to clear.** A `-HOLD.md` matches no watcher glob at any point
during a rename, so retiring one arms nothing. Depth-1 HOLDs: **84 → 61**. The standing
"arm nothing" block is untouched and still stands.

**DISPOSITION: ACTIONED.** Verified by `MOVED=23 of 23` plus a `git status --short` read-back of
23 `R` entries in the worktree, and by the PR's own file list.

### F2 — 04 inferred WHY I dropped it. The record does not support that inference, and the truth is worse. `[MEASURED]`

04 offered, explicitly so I could confirm or refute rather than re-derive: *"the standing OAuth
block reads ARM NOTHING, and a queue mutation during a hold looks like it is covered by that."*

**Refuted as stated — because there is no reasoning to refute.** I read all 18 of my breadcrumbs
since 08-28. Not one of them declines the dispatch, defers it, or names the OAuth block in
connection with it. Not one of them mentions `superseded` at all. The dispatch was not
mis-reasoned; it was **never reasoned about**. A wrong disposition would at least be visible and
correctable. Silence is neither.

The mechanism is now measurable: **`check-breadcrumb.mjs --freshness` proves a breadcrumb EXISTS
and is well-formed. Nothing anywhere proves its FINDINGS were dispositioned.** My run reports the
four dispositions honestly for findings I generate, and drops on the floor, without trace, any
finding handed to me. The collector reported `CLEAN` on all six runs that dropped this.

**DISPOSITION: ESCALATED → Marco.** 04 escalated the authority question; I am forwarding it with
the inference corrected and one option added, because the measured cause is a missing instrument,
not a missing permission. **RULE 1** — *solves it completely, immediately and in future, without
damaging existing or future data entry*:

- **(D) — complete and additive, and it is mine to build, put first: teach the collector to track
  dispositions.** A `DISPATCHED → Station NN` line already has a fixed grammar in the report
  contract. `check-breadcrumb.mjs` gains a `--dispatches` mode that lists every DISPATCHED finding
  on `main` with no later breadcrumb naming it as ACTIONED / DEFERRED / ESCALATED, and **exits
  non-zero past 2× the receiving station's cadence** — exactly the ratchet `--freshness` already
  applies to silence. Additive: a new mode on an existing validator, no schema change, no prompt
  touched, nothing armed, no data entry affected. It closes the loop for **every** station pair,
  not just 04→00, and it would have caught this on 08-27. Both halves pass. **It also makes 04's
  (C) safe rather than competing with it** — grant 04 the narrow `git mv` authority *and* keep the
  ledger, and the actor that proves a prompt spent files it while the loop stays auditable.
- **(C) — 04's own proposal: grant Station 04 narrow authority to `git mv` a premise-dead HOLD into
  `superseded/`, and nothing else.** Passes the no-damage half cleanly. Passes *complete* only for
  this one dispatch type: every other 04→00, 03→00 and 05→00 dispatch still has no ledger and can
  still vanish silently. Strictly better than (A), and strictly better again when paired with (D).
- **(A) — 00 keeps it, collector gains a report line only.** Fails *complete*: a report line that
  does not fail the exit code is advice, and the last six runs are the measurement of how much
  advice is worth here.
- **(B) — leave it.** Fails both halves. The list grew 21 → 23 in two days while sitting unactioned.

I have **not** built (D) this run. It is a change to a CI-gated instrument, and the honest sequence
is Marco's answer first — (C) and (D) are not exclusive and the choice between "grant" and "build"
is his, not mine.

### F3 — the 11 arm-candidates are unchanged, and that is a held brake, not a stall. `[MEASURED]`

Same 11 names as 04's 08-28T18:10Z and 08-29T10:10Z tables, re-measured by me at `49a893b0`.
`armed = 0` because the OAuth block correctly holds the agent lane; `failed/` newest is unmoved at
08-28T21:03Z. 🔴 `pr-dns-s5-checker-flip-to-fail-HOLD` remains on the standing **must-NOT-arm**
list despite satisfying every mechanical gate — its presence in this list is not a recommendation.

**DISPOSITION: DEFERRED.** Becomes actionable the moment OAuth is re-authenticated. Arming stays
one at a time, on Marco's authority.

### F4 — 04's untracked HOLD is landed. `[MEASURED]`

`pr-doctrine-s9-gh-vs-git-waiver-HOLD.md` (the fix for DOCTRINE §9.5 naming `gh` where the silent
gate-waiver is actually `git`) was `??` in the dev tree and absent from `origin/main` for 10 hours.
Copied in byte-identical (sha 9370176eaea8, read back equal) and committed. It is a `-HOLD`, so
landing it arms nothing.

**DISPOSITION: ACTIONED.**

### F5 — OAuth has now been dead for 20 hours across seven measured runs, and no one owns the fix. `[MEASURED]`

`expiresAt` and mtime are byte-identical to the readings taken at 20:09Z, 22:09Z, 00:08Z, 02:08Z,
04:08Z, 06:08Z, 08:08Z and 10:08Z. Nothing in the system refreshes this token; it burned a real
feature prompt (`pr-crm-s3-account-on-client-create`) into `failed/` at 08-28T21:03Z. Re-authentication
needs a real human identity, which is a DOCTRINE §5 hard stop for every station.

**DISPOSITION: ESCALATED → Marco.** Already open; re-stated with a seventh measurement rather than
re-raised as new. The single most important thing blocking the board is this, and it is one
re-authentication.

## WHAT I DID NOT DO

- **Armed nothing.** The OAuth block stands. F3's 11 candidates stay HOLD.
- **Merged nothing that was watcher-routed**, and removed no `do-not-merge` label. There were zero
  open PRs to consider — RULE 2 had nothing to bite on this run.
- **Did not delete a single prompt.** All 23 were `git mv`-ed; a delete is re-armable by a checkout
  and is the board trap.
- **Did not touch the shared dev-tree index.** Every mutation happened in a disposable worktree off
  `origin/main`; `git diff --cached` in `C:\ProjectOperations2` was empty before and after.
- **Did not build the collector change in F2(D).** It gates CI and the authority question is Marco's.
- **Did not run the five-bootstrap fix** (`C:\po-sup-fix-scripts\fix-station-bootstraps.mjs`,
  dry-run-proven). Still ESCALATED and unanswered from my 10:08Z run.
- **Did not fast-forward the watcher clone.** Proven safe, still forbidden to 00, still nobody's.
- **Did not run `status-sweep.ps1` §3b ENSURE-UP** — recorded dead code that would start a fourth launcher.
- **Did not touch Azure / Entra / SharePoint, production data, or `/sot/`.** Four `/sot/` and
  data-model files remain ` M` in the shared dev tree; that is Station 05's, already dispatched.

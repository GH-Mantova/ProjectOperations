# Station 04 — Scanner | 2026-09-16T18:10:38Z–2026-09-16T18:5xZ

## GROUND

```
UTC            2026-09-16T18:10:38Z
origin/main    bdc5d05b            (fetch first, then rev-parse)
dev tree       main @ bdc5d05b     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE. Run is not forced read-only by a version mismatch — but 04 is
read-only on the board by authority in any case, and nothing on the board was mutated.

**Sighted run.** Desktop Commander reached the host on the first call after the schema load.
Recorded because the three preceding 04 runs (09-16 1011Z, 09-16 1410Z, 09-15 0000Z) were BLIND —
blindness remains intermittent and its cause remains unknown (`STATION-CAPABILITIES.md` §2).

**Sweep this run: `gate-liveness`** (rotation position 1 of 4, assigned by
`node scripts/pipeline/next-sweep.mjs`; previous run 2026-09-15T02:10:31Z).

🔴 **`docs/pipeline/sweep-rotation.json` IS LEFT DIRTY IN THE DEV TREE and Station 00 must commit
it.** `--advance --utc 2026-09-16T18:10:38Z` exited 0 (`last_index=0`,
`last_run_utc=2026-09-16T18:10:38Z`); `git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json`
→ `2 2`. 04 may not commit to the shared dev tree. **See F1 — the actor that commits it has not run
in 37 hours, and four earlier advances are already uncommitted behind this one.**

## WHAT I MEASURED

**Binding documents read in full this run**, from the working copy, which is sound here because the
uncommitted-work probe says the working copy IS `origin/main` for all three:
`git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
→ **EMPTY output** [MEASURED]. Per DOCTRINE §9.1 the piped-hash form is unsound in PowerShell and was
not used; EMPTY `--numstat` is the real answer (§9.2, §9.3).

**Device-bridge git guard installed FIRST, before any VM-side call**, as PREFLIGHT requires.
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` last line, quoted verbatim
[MEASURED]: `persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
— preceded by `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and
mounted cwd, allows everything else (three controls passed)`. **PASS.** No `git` was run through the
device bridge against the Windows `.git` at any point.

**`status-sweep.ps1` verdict § 7** [MEASURED], captured to a file and decoded `utf16le` per §9.3
(the `*>` redirection writes UTF-16LE; a naive `utf8` read of it produces a structureless report):

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

Board state from the same capture [MEASURED]: open PRs **2** — `#1987` CLEAN, CI 10/0/0 green;
`#1986` BLOCKED, CI 13 pass / **2 fail**. `main` CI on `bdc5d05b`: 4 success / 0 failed, **trunk
green** (the sweep correctly excluded 2 non-trunk runs — the scoped-trunk-verdict fix DOCTRINE §9.5
predicted would land is behaving). Queue: **armed `*-ready.md` = 0**, needs-marco 60, no-pr-opened
109, failed 52, blocked 138. Watcher node RUNNING pid 30248, heartbeat age 219 min with an empty
queue — idle, not wedged.

### The gate-liveness sweep proper — `triage-holds.ps1`, read-only

**Both of the script's own controls PASSED** [MEASURED], quoted verbatim, which is what licenses
every negative reading below (§7: prove the instrument can produce a positive first):

```
GIT control: PASS -- git read origin/main:docs/pipeline/DOCTRINE.md (201130 chars), so gate probes can actually run.
SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture, so the SPENT bucket is measurable.
```

Corpus: **36 prompts at depth 1** of `docs/pr-prompts` — HOLD=36, ready=0, LOOPING=0, `rev-*`
excluded. Totals [MEASURED]: `spent=7  gates-satisfied=3  still-gated=26  unreadable=0`, and
**`0 spent behind a REJECT`** across all 26 rejects — the script re-probed every one directly rather
than inferring from exit 1, and its fixture control proves that instrument CAN emit the bucket, so
that `0` means none rather than "cannot say".

**Independent cross-check of the SPENT bucket, not a re-quote of the tool.** For the three spent
prompts whose premise carries a `_V<n>` marker, I counted the marker in the premise's own file at
`origin/main` via `git show origin/main:<path>` [MEASURED]:

| prompt | marker | occurrences at `origin/main` | premise `! grep -q …` |
|---|---|---|---|
| `pr-crmvis-s2-relationships-HOLD.md` | `CRM_PARITY_RELATIONSHIPS_V1` | **2** | FALSE ⇒ spent |
| `pr-crmvis-s3-account-360-HOLD.md` | `CRM_PARITY_ACCOUNT360_V1` | **2** | FALSE ⇒ spent |
| `pr-crmvis-s4-register-HOLD.md` | `CRM_PARITY_REGISTER_V1` | **11** | FALSE ⇒ spent |
| `pr-crmvis-s5-followups-HOLD.md` — **NEGATIVE CONTROL**, lint ADMIT, *not* in the spent bucket | `CRM_PARITY_FOLLOWUPS_V1` | **0** | TRUE ⇒ not spent |

The negative control is the load-bearing row: the probe discriminates in **both** directions on the
same corpus and the same instrument, so the three positives are not a blind grep agreeing with
itself. The remaining four spent prompts (`pr-ratescol-s3-add-in-grid`,
`pr-ratescol-s4-import-creates-columns`, `pr-scopecards-s1-operational-costs-priced`,
`pr-scopecards-s2a-quote-destination-api`) carry no `_V<n>` marker in their premise, so for those the
spent reading is **[INFERRED]** from `lint-prompt.mjs` exit 3 alone and was not independently
re-measured here. That 4-of-7 marker coverage is the same shortfall DOCTRINE §10.6 records as 4 of 40
board-wide.

### Every-cycle checkers

| script | exit | reading |
|---|---|---|
| `check-lessons.mjs` | **0** | `holding=5  regressed=0  broken=0` — CLEAN, no lesson has regressed |
| `check-escalations.mjs` | **0** | `open=0  resolved=3  broken=0` — all three registered escalations verified fixed on main |
| `check-backlog.mjs` | **10** | `ready=1  needs-marco=2  blocked=4  broken=0` — a blocker has cleared |

`check-backlog.mjs` exit 10 names **`[P2] rates-11c-blocked-consumers`** as READY TO STAGE. Its own
note records that this item *"STAYS until its gate dies, because the consumers are staged but not yet
merged"* — so exit 10 here is the register working as designed, **not** news of a newly-cleared
blocker. Reported, not dispositioned as a finding: staging is 06's and arming is 00's.

### `[LIVE]` lines re-derived from their own source before being acted on

DOCTRINE §9.5 `SWEEP_LIVE_LINES_ARE_NOT_EXEMPT_V1` requires this. Run against the clone in the same
minute [MEASURED]:

| form | anchor | result |
|---|---|---|
| `git -C C:\po-watcher\ProjectOperations status --short` | the sweep's `$cdirty` | **3** |
| `git -C C:\po-watcher\ProjectOperations status --porcelain --untracked-files=no` | `start-watcher.ps1` preflight | **0** |

The sweep's `watcher clone: branch=main dirty=3  <-- NOT clean-on-main; the watcher may refuse to
start` is **FALSE**, exactly as §9.5 records. The two forms did not agree, so that bullet's
falsifying probe did not fire and the bullet **stands**. See F4 for the one thing this run adds.

## WHAT CHANGED

**Nothing on the board.** No prompt was armed, disarmed, renamed, moved, staged or deleted; no PR was
opened, labelled, merged or commented on; no tracked file was written except this breadcrumb; `/sot/`
was not touched; no `git` ran through the device bridge; no worktree was created or pruned.

One file was deliberately left dirty in the dev tree, as the station contract requires:
**`docs/pipeline/sweep-rotation.json`** (`2 2` against `origin/main`). Station 00 commits it.

This breadcrumb is **untracked** until a board PR commits it.

## FINDINGS

### F1 — The only `needs-marco/` file that names the live Station 00 outage is annotated **REFUTED** at its head. The recurrence has no live home, and twelve breadcrumbs from five stations have been stranded for 37 hours.

`ESCALATION_ANNOTATED_REFUTED_WHILE_CONDITION_IS_LIVE_V1`

**The condition, re-verified live this run** [MEASURED], scheduled-tasks MCP:
`00-supervisor` `enabled: false`, **no `nextRunAt`**, `lastRunAt` **2026-09-15T05:08:34Z** — **37.0
hours** before this run. POSITIVE control, three rows in the same payload reading `enabled: true`
with live `nextRunAt` values: `04-scanner`, `05-sot-keeper`, `03-machine-minder`. The live enabled
count is **THREE**.

**This is the third occurrence**, not the first: `needs-marco/all-stations-disabled-16h-and-the-only-detector-was-disabled-too-2026-09-03.md`,
then `needs-marco/station-00-is-disabled-and-nothing-collects-2026-09-08.md`, and now.

🔴 **What is NEW, and is the finding — the 09-08 file was correctly REFUTED on 09-10 and never
re-armed, so today it actively tells its reader the condition is not real.** [MEASURED] that file's
`LastWriteTimeUtc` is `2026-09-10T06:29:46Z` and its first line reads, verbatim:

> `🔴 **SPLIT 2026-09-10 — THIS FILE BUNDLES A DEAD FINDING WITH A LIVE ONE, AND THE TITLE IS THE DEAD ONE.**`
> `- **F1 (Station 00 is DISABLED) is REFUTED.**`

That annotation was **true when written** — 00 was re-enabled on 09-10. It is false now. So the one
file in `needs-marco/` whose *title* names today's exact condition opens by telling its reader that
condition is refuted, and the live half it points to
(`bootstrap-preflight-omits-four-preconditions-2026-09-10.md`) is a different subject. This is
precisely the shape DOCTRINE §9.5 records and §7 exists for: **a true statement of state that
outlived its truth, inside the document a reader would consult to catch the recurrence.**

🔴 **And the escalation channel for this particular finding runs through the actor that is off.**
Station 04's own 06:10Z run today found the outage, wrote a full RULE-1 question, and dispositioned
it **ESCALATED** — into a breadcrumb. `STATION-CAPABILITIES.md` §7 makes 00 the collector: *"Station
00 collects, every run"*, and a breadcrumb reaches Marco only when 00 sweeps it. **No `needs-marco/`
file was created for it** [MEASURED]: the newest entries there are `scopecards-s2b-runtime-truncation-2026-09-16.md`
(09-16 09:50Z), `pr-1982-review-block.md`, `pr-1979-review-fix.md` — none about 00. So an ESCALATED
finding about the collector being down was filed in the channel the collector drains. That is why
this run reports it in **chat** as well, which is the one channel that does not route through 00.

**Measured cost, now** [MEASURED] — `00-*.md` at depth 1 of `docs/pr-prompts` with
`LastWriteTimeUtc` after `2026-09-15T05:08:34Z`: **12 breadcrumbs**, from **five** stations, none
dispositioned:

```
09-15 05:10Z  00-00-supervisor-2026-09-15-blind-no-shell.md
09-15 06:11Z  00-04-scanner-2026-09-15-0000-blind-run-no-windows-shell.md
09-15 07:05Z  00-00-supervisor-2026-09-15-0640-the-escapee-scan-could-not-see-a-tree-at-the-drive-root.md
09-15 10:46Z  00-04-scanner-2026-09-15-1010-a-file-gate-outlived-the-prompt-that-was-retired-for-being-stale.md
09-15 22:35Z  00-04-scanner-2026-09-15-2222-every-section-9-trap-probed-still-reproduces...
09-15 23:13Z  00-03-machine-minder-2026-09-15-2303-a-plain-logoff-killed-the-watcher-for-nine-hours...
09-16 02:21Z  00-04-scanner-2026-09-16-0219-the-sweeps-preserve-warning-parked-an-orphan-for-twelve-days...
09-16 03:48Z  00-05-sot-keeper-2026-09-15-2222-the-heartbeat-alarms-on-a-station-that-did-report...
09-16 06:18Z  00-04-scanner-2026-09-16-0610-station-00-is-disabled-and-the-bootstrap-layer-no-linter-reads-has-rotted-twice.md
09-16 09:47Z  00-06-pr-master-2026-09-16-0456-a-prompt-that-held-was-resolved-to-another-stations-pr-and-binned-as-spent.md
09-16 10:16Z  00-04-scanner-2026-09-16-1011-blind-run-and-the-watcher-reset-destroys-the-uncommitted-rotation-advance.md
09-16 14:12Z  00-04-scanner-2026-09-16-1410-blind-again-and-the-dev-tree-has-not-fetched-origin-in-four-hours.md
```

This breadcrumb is the thirteenth. Five sweep-rotation advances are now uncommitted behind it.

**Question for Marco (RULE 1 — complete-and-additive first).** The 06:10Z run already put the
re-enable question to you and it is not re-asked here. **What this run adds is a second, separable
question that survives whichever way you answer that one:**

**(a) Re-arm the `needs-marco/` file so the recurrence has a live home — append a dated
`RE-OPENED 2026-09-16` block to `station-00-is-disabled-and-nothing-collects-2026-09-08.md` recording
that F1 has recurred, and move the `REFUTED` banner below it.** *Complete*: it fixes today (the file
stops contradicting the live board) **and** the future (the next recurrence lands in a file that is
already the right home, instead of costing another run the re-derivation this one paid for — the
fourth time this pipeline has re-derived a 00 outage from first principles). *Additive*: nothing is
deleted, the 09-10 refutation stays on the record where it is still true of 09-10, and no task is
enabled on a guess. **Passes both halves.**

**(b) Leave the file as it is and rely on each station noticing.** Fails *complete* on the future
half: today's 06:10Z run and this one both re-derived the same outage independently, four hours
apart, and neither could reach you through the channel it was told to use. Passes *additive*.

**(c) Close the 09-08 file entirely and file a fresh one per occurrence.** Fails *complete* on the
immediately half — the recurrence history is what makes the third occurrence legible as a pattern
rather than an incident, and splitting it across three files is how it stopped being legible the
first time. Passes *additive*.

⚠️ **Whether 00 was switched off deliberately is still unanswered from 09-08, and no agent may
re-enable it on a guess** (DOCTRINE §5.3 authorization grants, §5.5 design intent). The
scheduled-tasks layer records no actor. Separately,
`needs-marco/weekly-security-audit-is-off-and-the-task-store-reverts-verified-writes-2026-09-14.md`
records that **the task store reverts verified writes**, so even an authorized re-enable needs its
read-back checked on a later run rather than trusted at the moment it is made.

**Falsifying probe:** read `enabled` for `00-supervisor` from the scheduled-tasks MCP, and read the
first line of `needs-marco/station-00-is-disabled-and-nothing-collects-2026-09-08.md`. If `enabled`
is `true`, F1's condition is dead. If the first line no longer says `REFUTED`, this finding is
closed.

**DISPOSITION: ESCALATED.**

### F2 — Seven HOLD prompts on the board are SPENT — the work merged in the last fourteen hours — and none has ever been reported.

`SEVEN_SPENT_HOLDS_UNREPORTED_V1`

This is the gate-liveness sweep's primary product. `lint-prompt.mjs` exit 3 on each, via
`triage-holds.ps1`, with the fixture SPENT control passing; three of the seven independently
re-measured at `origin/main` with a negative control, per the table under WHAT I MEASURED.

```
pr-crmvis-s2-relationships-HOLD.md
pr-crmvis-s3-account-360-HOLD.md
pr-crmvis-s4-register-HOLD.md
pr-ratescol-s3-add-in-grid-HOLD.md
pr-ratescol-s4-import-creates-columns-HOLD.md
pr-scopecards-s1-operational-costs-priced-HOLD.md
pr-scopecards-s2a-quote-destination-api-HOLD.md
```

**They went spent inside the last fourteen hours**, which is why this is fresh rather than rot: the
merges that killed their premises are `#1979` (09-16 04:24Z, rates S3), `#1980` (06:03Z, scopecards
S2a), `#1981` (06:38Z, CRM S3), `#1983` (08:04Z, rates S4) and `#1984` (08:21Z, CRM S4) — all after
`#1977` (09-16 00:43Z) retired the previous batch of consumed HOLDs.

**No prior coverage** [MEASURED] — `Select-String -SimpleMatch` for each slug across
`docs/pr-prompts/needs-marco/*.md` and `docs/pr-prompts/archive/*.md` returned **0 for all seven**,
against POSITIVE control `CP-24` → **169** and a freshly minted NEGATIVE control → **0**. (That
needle is spent by appearing here; the next run mints its own.)

**Why it matters rather than being tidy-up:** DOCTRINE §10.6 — a spent prompt sitting at depth 1 is
what an arming decision goes looking at, and `triage-holds.ps1` will keep listing these every run
until they are retired. None of the seven is destructive and none carries `gate_allow: migrations`,
so retiring them removes no protection — which is the check the sweep brief demands before touching
any gate.

**Retirement is a board mutation: 04 may not do it, and the station that may has not run in 37
hours (F1).** Retire to `docs/pr-prompts/superseded/` in a board PR.

**Falsifying probe:** re-run `triage-holds.ps1` and read the SPENT bucket. If any of the seven has
left it, that one's premise is alive again and must be re-measured before retirement.

**DISPOSITION: DISPATCHED** — to Station 00, to retire in a board PR. ⚠️ Blocked behind F1.

### F3 — The single POSSIBLE DUPLICATE flag on the board is NOT a duplicate. Settled on both instruments, so nothing is left for the next run to re-derive.

`S5_FOLLOWUPS_NOT_A_DUPLICATE_OF_1986_V1`

`triage-holds.ps1` flagged `pr-crmvis-s5-followups-HOLD.md` as a POSSIBLE DUPLICATE of open `#1986`,
overlap **1 of 3**, on the single shared scope entry
`apps/web/src/pages/crm/TendersRegisterPage.tsx`. DOCTRINE §10.6 is explicit that over a one-entry
scope this test's precision is **zero by construction**, so the flag is a question, never a verdict.

Both prescribed instruments were run, marker test first as §10.6 requires [MEASURED]:

| test | result | reading |
|---|---|---|
| **Marker** — `CRM_PARITY_FOLLOWUPS_V1` / `CRM_FOLLOWUPS_V2` in `#1986` title+body (`gh pr view 1986 -R GH-Mantova/ProjectOperations --json title,body`, `$LASTEXITCODE`=0) | **0 / 0** | not this PR's work |
| POSITIVE control — `CRM_REGISTER_RESIDUAL_V1` in the same title+body | **1 / 1** | the probe can find a marker |
| **Premise at head** — `CRM_PARITY_FOLLOWUPS_V1` in `TendersRegisterPage.tsx` at `#1986` head `ab4a2c96` (`gh api …/contents/…?ref=<full sha>`) | **0** | premise `! grep -q …` still TRUE ⇒ work not done |
| POSITIVE control — `CRM_PARITY_REGISTER_V1` at the same head | **11** | the file and the probe are live |
| NEGATIVE control — a freshly minted needle at the same head | **0** | the probe is not matching everything |

Both agree. `pr-crmvis-s5-followups-HOLD.md` is **NOT** a duplicate of `#1986` and remains a genuine
arming candidate on its gates — which is a statement about gates only, and 00 arms, not 04.

⚠️ `#1986` is **RED** (CI 13 pass / **2 fail**) and is `escalates: true` work; it is 00's to
root-cause from the job log, not 04's to diagnose from the diff (§3).

**DISPOSITION: ACTIONED** — the flag is settled and closed this run; verified by the two-instrument
table above, with positive and negative controls on both. Nothing is handed on.

### F4 — The clone-dirty false warning recurs, and the untracked class that inflates it is wider than DOCTRINE's worked example says.

`CLONE_DIRTY_UNTRACKED_CLASS_IS_WIDER_V1`

DOCTRINE §9.5 records that `status-sweep.ps1`'s `dirty=` counts untracked files while
`start-watcher.ps1` does not, and names the inflating files as *"review verdicts the `rev-<N>` job
writes into the clone by design"*. Re-derived this run [MEASURED], both forms in the same minute:
sweep form **3**, watcher form **0** — the bullet's falsifying probe did not fire, so **the bullet
stands** and the warning is false again.

**What this run adds is the third file.** The three are:

```
?? docs/pr-reviews/pr-1986-review.md            <- a rev-<N> verdict, the documented class
?? docs/pr-reviews/pr-1987-review.md            <- a rev-<N> verdict, the documented class
?? scripts/pr-watcher/.conflict-notified-prs.json   <- NOT a review verdict
```

`.conflict-notified-prs.json` is watcher **runtime state**, not a review artefact. A reader applying
§9.5's worked example literally — *"the two files counted are review verdicts"* — meets a count of
three, finds one file the example does not explain, and has no stated reason to treat it as benign.
The bullet's own rule (read the clone's health from `--untracked-files=no`) covers it correctly; only
the illustration is narrow. This is the same failure mode §9.2 records for its `ls-tree` bullet: *"The
headline rule was never wrong; its illustration was."*

**Falsifying probe:** run both forms against the clone in the same minute and list the untracked
files. If every one is a `docs/pr-reviews/pr-<N>-review.md`, this finding is wrong and the example is
complete as written.

**DISPOSITION: DEFERRED** — real, not now. The rule protects a careful reader today, and widening the
illustration is a one-line edit to a hash-gated canonical block, which needs the re-record ceremony
and belongs with the next edit to that block rather than alone. It becomes urgent if a run is ever
measured mis-dispatching the clone-dirty warning on a non-review untracked file.

### F5 — Two worktree registry escapees and two supervisor worktrees have no `needs-marco/` coverage; the two that do have coverage are twelve and eleven days unresolved.

`WORKTREE_ESCAPEES_UNCOVERED_V1`

From the sweep's §2 [MEASURED], four non-main worktrees plus two registry escapees. Cross-checked
against `needs-marco/*.md` by `Select-String -SimpleMatch` [MEASURED]:

| worktree | age | dirty | `needs-marco` hits |
|---|---|---|---|
| `C:/PR-Master/worktrees/po-vg` `[fix/no-rebase-while-checks-run]` | 17898 min (**12.4 d**) | **1 file** | **10** — covered |
| `C:/PR-Master/worktrees/pr1823` `[feat/ea-gate-reporting-team-permission]` | 9840 min (6.8 d) | 0 | **3** — covered |
| `C:/PR-Master/worktrees/sup-0003-esc06-held-prompt-binned-as-spent` | 737 min | 0 | **0** |
| `C:/PR-Master/worktrees/sup-0003-stage-crmvis-register-residual` | 519 min | 0 | **0** |
| `C:\PR-Master\worktrees\s2afix` REGISTRY-ESCAPEE | 812 min | size 0KB, `.lock=False` | **0** |
| `C:\PR-Master\worktrees\s3hex` REGISTRY-ESCAPEE | 884 min | size 0KB, `.lock=False` | **0** |

The two `sup-0003-*` trees are clean leftovers of recent supervisor runs (`#1982` and `#1985`), so
they are prunable rather than alarming. The two escapees are 0KB with no lock — a lock with no
holding process by construction (§9.6), and 03's to confirm and prune.

⚠️ `po-vg` **holds one uncommitted file at 12.4 days** and is already an open escalation
(`needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`, plus
`two-orphaned-worktrees-hold-eighteen-unpushed-commits-2026-09-14.md`). Not re-filed. Recorded here
only because 04's own 09-16 02:19Z breadcrumb reports the sweep's PRESERVE warning *"parked an orphan
for twelve days over a file already rescued"* — that breadcrumb is among the twelve stranded by F1,
so its disposition is still pending and I am not pre-empting it.

**DISPOSITION: DISPATCHED** — to Station 03, for the four uncovered trees only (`sup-0003-*` ×2,
`s2afix`, `s3hex`). Repairs are 03's; 04 reports and prunes nothing.

## WHAT I DID NOT DO

- **Mutated nothing on the board.** 04 is read-only: no arm, no disarm, no rename, no move, no
  delete, no merge, no label, no PR. The `-HOLD` staging right was not exercised — this run's sweep
  produced retirements and questions, not stageable work.
- **Did not retire the seven SPENT prompts (F2)**, did not clear the sweep's stale clone-dirty
  warning (F4), and did not prune any worktree (F5). All are board or machine mutations belonging to
  00 and 03.
- **Did not re-enable `00-supervisor`.** An authorization grant and a guess at Marco's intent —
  DOCTRINE §5.3 and §5.5, both absolute. Reported instead.
- **Did not edit or re-arm `needs-marco/station-00-is-disabled-and-nothing-collects-2026-09-08.md`.**
  F1(a) proposes it; deciding it is Marco's, and rewriting another actor's escalation on my own
  authority is the ADVERSARIAL PROMPT CRITIQUE report-not-run rule applied one folder over.
- **Did not commit `docs/pipeline/sweep-rotation.json`.** Left dirty by contract; 00 commits it. Nor
  did I commit this breadcrumb — it is untracked.
- **Did not mint a throwaway worktree** to get a clean read. `origin/main` was read with `git show`
  and `git diff --numstat` at a named SHA, per the station's AUTHORITY block.
- **Did not run `git` through the device bridge**, and did not run `checkout` / `reset --hard` /
  `stash` / `clean` anywhere (§9.2).
- **Did not touch `/sot/`** (05's, CP-24), Azure, Entra or SharePoint (absolute), or production data.
- **No Part 2 live-site pass.** The rotation assigned `gate-liveness`, which is a static sweep, and
  the station doc's one-named-sweep rule forbids a shallow pass over everything. Not attempted, so
  not reported as covered.
- **Four of the seven SPENT prompts were not independently re-measured** (no `_V<n>` marker in their
  premise) — stated as `[INFERRED]` in F2 rather than dressed as measurement.

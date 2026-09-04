# Station 00 — Supervisor | 2026-09-04T23:08Z–2026-09-04T23:4xZ

## GROUND

```
UTC            2026-09-04T23:08:19Z
origin/main    f9961700              (fetch --prune, then rev-parse)
dev tree       main @ d7a6f055       C:\ProjectOperations2   (0 ahead / 6 behind)
doc version    1                     (docs/pipeline/stations/00-supervisor.md)
bootstrap      1                     (scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** — this run was not read-only-gated.

**Sighted run.** `start_process` shell `powershell.exe` → PID 19624, local clock
`2026-09-05T09:08:19+10:00` = `2026-09-04T23:08:19Z` (Brisbane, UTC+10). Desktop Commander schema was
loaded by keyword `ToolSearch` **before** any device tool was called, per PREFLIGHT step 1.

All three binding documents were read **in the dev tree** and proved current against `origin/main`
by the sanctioned form — no piped hash was taken:
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**. Empty numstat = not different.

Work was done in a **disposable worktree**, `C:\po-00-collect` off `origin/main f9961700`
(`porcelain-lines=0` at creation). The shared dev-tree index was never staged to or committed from.

---

## WHAT I MEASURED

**[MEASURED] `status-sweep.ps1` 23:08:58Z — instrument controls both PASS** (`gh` reached GitHub,
saw merged #1613; `node` runs). Verdict **CAUTION**: 1 live-classified station worktree (`C:/po-vg`).
Open PRs **3** · armed **3** (all `rev-*`, i.e. auto-generated REVIEW JOBS, not prompts — DOCTRINE
§9.5) · watcher node RUNNING pid 20000 · wrapper alive · heartbeat 0 min · in-progress prompts **0** ·
`index.lock` false/false · git processes **0** · no PR touched in the last 2 min · main CI on
`f9961700` **4 success / 0 failed** (trunk green).

**[MEASURED] The three open PRs, at 23:1xZ, before I acted:**

| PR | created | author | auto-merge | labels | files |
|---|---|---|---|---|---|
| #1614 | 22:59:59Z | GH-Mantova | **ARMED (SQUASH) by GH-Mantova** | none | 6, incl. `apps/web/src/components/ShellLayout.tsx` |
| #1615 | 23:00:57Z | GH-Mantova | **ARMED (SQUASH) by GH-Mantova** | none | 2, incl. `apps/web/src/pages/crm/CommsHubPage.tsx` |
| #1616 | 23:01:56Z | GH-Mantova | **ARMED (SQUASH) by GH-Mantova** | none | 2, incl. `apps/web/src/pages/crm/RelationshipsPage.tsx` |

All three `mergeStateStatus=BLOCKED` on **one pending check apiece**, 13 pass / 0 fail.

**[MEASURED] RULE 2 probe, pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed`.**
1913 logs; newest `2026-09-04T23:10:23Z` — **younger than every open PR**, which is the control that
separates the live directory from the `C:\po-watcher` decoy (DOCTRINE §9.5). POSITIVE
`marco.:true` → **612** (written without a quote character, per the standing rule). NEGATIVE
`zzzNoSuchZzz` → **0**. Per-PR discriminator over `pr-*.log` only, excluding `rev-*` per §9.5:
**#1614 → 0 · #1615 → 0 · #1616 → 0**, NEGATIVE control `PR #999999` → **0**.

**[MEASURED] Those three zeroes are SECOND LANE, not a broken probe.** Four independent instruments
agree:

1. `docs/pr-prompts/.arming-log.txt` ends `2026-09-04T22:03:13Z ARMED pr-crmui-account360-s1-…` —
   **no arm exists for any of the three**.
2. Their prompts are **still `-HOLD` and unconsumed on disk**:
   `pr-crmui-chrome-s1-counts-badges-and-inbox-actions-HOLD.md`,
   `pr-crmui-comms-s1-threads-rail-and-todos-HOLD.md`,
   `pr-crmui-relationships-s1-four-panels-HOLD.md`.
3. `C:\po-watcher\watcher-launch.log` meets all three only as
   `[review] enqueued review for PR #1614 (…) → rev-1614-ready.md` at `23:02:53Z` — the review lane
   **discovering** a board PR. There is no `[queue]`/`[start]` line for any `pr-crmui-*` prompt.
4. `git fetch origin --prune` this run reported **three new remote branches**
   (`pr-crmui-chrome-s1-…`, `pr-crmui-comms-s1-…`, `pr-crmui-relationships-s1-…`) that no arm created.

**[MEASURED] Hand-classification under DOCTRINE §10.1 step 2.** Each PR's file list contains
non-test `apps/web/src/**` paths, which match **none** of the three `NESTED_TEST_PATHS` forms
(`^(tests|docs)/`, `(^|/)__tests__/`, `\.(test|spec)\.[cm]?[jt]sx?$`). `classifyPolicyFiles` refuses
the first such path. **[NO LANE VERDICT — hand-classified] — all three are MARCO'S.**

**[MEASURED] Two more of Marco's merged since the 21:08Z run, one with a live verdict.**

| PR | merged | mergedBy | verdict |
|---|---|---|---|
| #1609 | 2026-09-04T22:03:04Z | GH-Mantova | **`{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/crm/accounts/accounts.service.ts"}`** (2 prompt-log hits) |
| #1613 | 2026-09-04T22:47:55Z | GH-Mantova | 0 prompt-log hits — hand-classified Marco's (`apps/web/src/pages/crm/**`) |

Both were watcher-built (armed `20:24:20Z` and `22:03:13Z`). **#1609 carried an explicit `marco:true`
verdict and merged anyway.** With #1589, #1606 and #1593 from the 21:08Z run, that is **five in one
evening**, three of them against a live verdict.

**[MEASURED] Station freshness — CLEAN, exit 0, no station SILENT.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness`: structure 8 checked / 0 malformed;
`00` 1.1 h (cadence 2 h) ok · `02` dispatch-only · `03` 0.2 h (24 h) ok · `04` 1.0 h (4 h) ok ·
`05` 9.0 h (24 h) ok. Three breadcrumbs flagged `UNTRACKED — it reaches nobody until a board PR
commits it`; this PR commits all three.

**[MEASURED] Queue.** armed `rev-1615-ready.md`, `rev-1616-ready.md` (review jobs, not prompts) ·
`needs-marco/` 16 · `no-pr-opened/` 109 (newest `2026-09-02`) · `failed/` 41 (newest `2026-08-28`) ·
`blocked/` 117. **No new silent no-op and no new hard failure since the last run** — the newest entry
in either folder predates it by days, so §3e and Q5 have nothing new to triage.

**[MEASURED] Dev-tree working state, read without `.trim()` on the porcelain** (the leading space of
the XY field is the whole signal): `git diff --cached --name-status` **EMPTY** — nothing staged by
another chat. Unstaged: `sweep-rotation.json` (2/2), `.arming-log.txt` (2/0),
`needs-marco/agent-authored-rule-2-clearance-2026-09-04.md` (79/0), and ` D` on three consumed
`-HOLD.md`. `docs/data-model/metadata-catalog.json` shows ` M` in porcelain but **empty numstat** —
line endings only, exactly as Station 03 measured in the clone.

**[MEASURED] `pr-wbsshift-s1-web-rate-follows-shift-HOLD.md` is already deleted on `origin/main`**
(`git rm` → `fatal: pathspec … did not match any files` in a clean worktree at `f9961700`). The dev
tree's ` D` for it is a stale local echo of #1610, not work outstanding.

**[MEASURED] `C:/po-vg`'s untracked file is preserved.** `check-pipeline-heartbeat.mjs`, 6144 B,
copied to `C:\po-sup-fix-scripts\preserved-from-po-vg\`; SHA-256 identical both sides
(`7427A6D0…B6719`). It does not exist on `origin/main`.

**[MEASURED] Not a finding, recorded so the next run does not re-derive it:**
`docs/pr-prompts/pr-watcher-merge-policy-nested-test-paths-LOOPING.md` exists untracked in the dev
tree — that prompt (armed `06:19:49Z`, `escalates=true`) has been renamed `-LOOPING` by an earlier
actor, which is the sanctioned §3c handling. I did not rename it and I did not undo it.

---

## WHAT CHANGED

**On the board — three PRs, protective and fully reversible, read back on all three:**

```
gh pr merge <N> --disable-auto      # N = 1614, 1615, 1616
gh pr edit  <N> --add-label do-not-merge
```

Read-back, immediately after:

```
#1614 state=OPEN mergeState=BLOCKED auto=DISABLED labels=do-not-merge
#1615 state=OPEN mergeState=BLOCKED auto=DISABLED labels=do-not-merge
#1616 state=OPEN mergeState=BLOCKED auto=DISABLED labels=do-not-merge
```

Before-state on all three was `auto=ARMED`, `labels=` (empty), re-measured seconds before the change
per the `[LIVE]` rule. **I merged nothing, reverted nothing, and removed no label.** The label
`do-not-merge` already existed in the repo (`escalates:true - Marco merges this, not automation
(DOCTRINE 5b)`); adding it is the handling DOCTRINE §5b prescribes for a PR classified Marco's, and
only Marco removes it.

**In this PR:**

- committed the three untracked breadcrumbs written since the last run (00's blind 22:08Z run, 04's
  22:10Z instruction-drift sweep, 03's 23:01Z machine round) — they reach nobody until this lands;
- committed `docs/pipeline/sweep-rotation.json`, which Station 04 **deliberately left dirty** for 00.
  Uncommitted, the next 04 run repeats `instruction-drift` and the rotation stops turning;
- committed `docs/pr-prompts/.arming-log.txt` (+2 rows), per DOCTRINE §9.5 — nothing commits it on
  purpose, so an arm history read from `origin/main` is otherwise a lower bound;
- deleted the two consumed `-HOLD.md` whose PRs have merged
  (`pr-crmui-account360-s1-…` → #1613, `pr-crmui-accounts-list-s1-…` → #1609). Left armable, a
  consumed prompt re-arms into a duplicate PR;
- **amended** `needs-marco/agent-authored-rule-2-clearance-2026-09-04.md` with Addendum 2. Appended
  by concatenation in node, never a `String.replace` replacement string (DOCTRINE §9.3), with the
  byte-delta assertion that trap requires: `before_chars=9470 after_chars=14668 expected_delta=5198
  actual_delta=5198 DELTA_MATCH=true`, original tail intact, NEG control absent. **Amended, not
  discharged** — see F3;
- **opened** `needs-marco/watcher-launcher-chain-unversioned-2026-09-04.md`, carrying Station 04's F1
  and F3 with their RULE 1 options.

**Nothing else.** No prompt armed, disarmed, renamed or moved. No `sot/` file touched. No watcher
restarted. No worktree pruned. No commit to `main`. No Azure, Entra or SharePoint.

---

## FINDINGS

### F1 — 🔴 S1 · Three second-lane PRs classified as Marco's were opened with auto-merge already armed, and would have merged themselves within the hour

The evidence is under WHAT I MEASURED: no arm, prompts still `-HOLD`, watcher meeting them only via
the review lane, three unexplained remote branches, zero RULE 2 verdicts with every control passing.
`apps/web/src/**` non-test files put all three outside `classifyPolicyFiles`. This is DOCTRINE §10.1
in its exact dangerous form — an empty probe result that reads as *"checked, and not Marco's"* — with
a merge button already pressed and only a pending check standing in front of it.

I chose the protective action over waiting because the asymmetry is total: a disabled auto-merge is
undone with one command, and a squash-merge to `main` is not. DOCTRINE's own handling for a PR
classified Marco's is *open it, drive it green, label it `do-not-merge`, leave the merge to him* —
so this is not a new policy, it is the written one being applied to a lane that had bypassed it.

**DISPOSITION: ACTIONED** — auto-merge disabled and `do-not-merge` applied on #1614, #1615, #1616;
read back on all three (quoted above). The PRs remain OPEN and CI keeps running, so nothing is lost
and Marco can merge or re-arm at will. **ESCALATED in the same breath** via Addendum 2 (F3), because
*whether this lane is his* is a question only he can answer.

### F2 — 🔴 S1 · #1609 merged carrying a live watcher `marco:true` verdict

`{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/crm/accounts/accounts.service.ts"}`
sits in `docs/pr-prompts/processed/pr-crmui-accounts-list-s1-columns-tiles-and-filters-ready.md.log`,
and the PR merged at `2026-09-04T22:03:04Z` as `GH-Mantova`. RULE 2 is not overridden by green, by an
absent label, or by a verified diff — only by Marco in chat, for that batch. #1613 merged 44 minutes
later on the same shape without a verdict at all.

**This is not a new escalation and must not become one.** It is the fourth and fifth instance of the
thread already open in `needs-marco/agent-authored-rule-2-clearance-2026-09-04.md`.

**DISPOSITION: ESCALATED** — existing escalation amended with Addendum 2 (measurements, controls and
RULE 1 options A/B/C). **Do NOT clear that file.** `status-sweep.ps1` §5 prints ten `[STALE] …
escalation is DEAD, clear it` lines about it *because it cites those merged PRs as its subject, not
as dependencies* — obeying the sweep literally deletes the record of the incident. That defect is
already written up with a cure in the 21:08Z breadcrumb.

### F3 — 🟠 S2 · Collected from Station 00's own 22:08Z run: it was BLIND, and the board went unwatched for exactly the hour this happened in

`00-00-supervisor-2026-09-04-2208-blind-run-desktop-commander-connect-timeout.md`. The schema was
loaded first, four times, and `desktop-commander` still returned `CONNECT_TIMEOUT` after 30000 ms —
blindness after a successful load, which the preflight defines as blindness. That run correctly
took no board action and substituted no GitHub-side reads.

The timing is the finding, not the outage: **#1613 merged at 22:47Z and #1614/#1615/#1616 opened at
22:59–23:01Z, entirely inside the window a blind 00 could not see.** Escalation #17 already carries
options (A) raise timeout + pre-warm and (B) retry after 60 s, recorded as **not mutually
exclusive**, with 06's soak mid-flight; standing guidance is that one blind run is not grounds to
re-escalate.

**DISPOSITION: DEFERRED** — added as one more measured instance to open escalation #17
(`2026-09-04T22:07Z`, `CONNECT_TIMEOUT` at 30000 ms). It becomes urgent, and #17 should be amended
and re-put to Marco, if blindness recurs across consecutive 00 runs — because the freshness detector
(escalation #23) cannot distinguish *"00 fired and was blind"* from *"00 fired and found nothing"*,
so a run of blind runs is indistinguishable from a healthy quiet board. Its own handover — *sweep
this breadcrumb up and commit it* — is **ACTIONED**: it is in this PR.

### F4 — 🟠 S2 · Collected from Station 04 (F1, F3): the live watcher's top two links are not in the repository, and the concern had no file-backed stop

04 measured that `watcher-launcher-singlelane.ps1` (pid 35328, running) and `ensure-watcher.ps1` are
both absent from the repo, while `03-machine-minder.md:312` cites `ensure-watcher.ps1:10` as a source
of truth — a line number into a file no PR can review and no CI can gate. It also measured, with
passing controls, that the concern appeared in **0 of 16** open `needs-marco/` files: it lived only
in the project-memory index, which Station 03 — the station whose lane this is — has no tool to read.

**DISPOSITION: ESCALATED** — `needs-marco/watcher-launcher-chain-unversioned-2026-09-04.md` opened
this run with 04's measurements and its RULE 1 options, (a) move both files into
`scripts/pr-watcher/` and repoint the task, keeping the old copies until a supervised restart proves
the new path — complete and additive — against (b) commit copies but keep running the off-repo ones,
which manufactures a decoy, and (c) leave it, which is now the floor rather than nothing. 04's F3
(the `pr-gates.mjs:327` citation landing on a bare `{`) is folded into the same file as item 3, with
replacement text, since both need one bootstrap repaste and only Marco repastes those.

### F5 — 🟡 S3 · Collected from Station 04 (F2): DOCTRINE §9.2 forbids a transport that STATION-CAPABILITIES §3 records as non-existent, and the correction is in the file read second

Real, measured, and a one-clause fix — but it sits inside the hash-gated `instruments v2` canonical
block, so it needs `lint-station.mjs --write-canonical` and must ship to all seven station docs in
one PR. That is more than a collect run should carry on a night whose board incident is still open,
and mixing it into this docs PR would put a canonical-block re-record behind an unrelated review.

**DISPOSITION: DEFERRED** — to the next 00 run whose purpose is a canonical-block edit. It becomes
urgent the moment a station reports having *looked for* the device bridge because §9.2 implied one
exists; that is the failure mode STATION-CAPABILITIES §3 names as presenting no-coverage as coverage.
The bootstrap half of the same clause is already in the new `needs-marco/` file for Marco's repaste.

### F6 — 🟡 S3 · Collected from Station 03 (F1): one untracked file pins a dead worktree LIVE forever, and it holds the whole board at CAUTION

`status-sweep.ps1:177` reads `$isLive = ($dirtyCount -gt 0) -or ($ageMinutes -ge 0 -and $ageMinutes
-lt 30)`. Dirtiness alone pins LIVE **with no expiry**, so the 30-minute recency test is reachable
only for a clean tree and can never rescue a dirty one. `C:/po-vg` holds exactly one untracked file
after **15.2 h of zero filesystem activity**, and every sweep therefore returns
`CAUTION: 1 LIVE STATION WORKTREE` instead of `SAFE TO ACT` — including this run's. It is DOCTRINE
§9.5's `list_sessions` failure rebuilt inside the instrument §9.5 names as its cure.

03's complete-and-additive fix is right: make the test **conjunctive** (`dirty AND recent`), applying
the recency window to both branches. Cleaning `po-vg` by hand fails the future half — the next
aborted dirty worktree re-creates the freeze.

**DISPOSITION: DEFERRED** — the fix touches `scripts/pipeline/status-sweep.ps1`, so its PR is
classified Marco's under §10.1 and would become a **fourth** Marco-gated PR opened on the same night
I have just gated three and asked him an unanswered question about the first five. Sequencing it
behind his answer is the honest call, not a scope dodge. It becomes urgent the moment a run stands
down on this CAUTION and skips a board action it should have taken.

**One half is ACTIONED now, so the deferral costs nothing later:** 03 warned that `po-vg`'s untracked
`check-pipeline-heartbeat.mjs` is *work, not litter* and must never be discarded by whoever prunes.
It is preserved at `C:\po-sup-fix-scripts\preserved-from-po-vg\`, SHA-256 verified identical
(`7427A6D0…B6719`, 6144 B). Pruning `po-vg` is now safe whenever it is authorised.

### F7 — 🟡 S3 · Collected from Station 03 (F2, F3, F5, F7): four clean orphaned worktrees, two dead registry escapees, 66 stashes, disk at 18.3%

All dispatched to 00 for repair, all measured with controls, none urgent, none at risk:
`po-guard` 23.0 h · `po-sa-fix` 41.5 h · `po-1483-fix` 68.6 h · `po-work/s2-e2e` 70.6 h, **all
`dirty=0`** so pruning loses nothing; the two escapees under `C:\po-worktrees` are **6215 directories
and 0 files** each (POSITIVE CONTROL `scripts\pipeline` → 74 files), unknown to `git worktree list`
in both trees; the clone's preflight stash loop sits at **66** and did not grow in 24 h (03 corrected
its own earlier "two per day" rate figure); disk `C:` 174.1 GB free of 952.4 GB.

**DISPOSITION: DEFERRED** — this is disk and sweep noise, it is on its second and third run without
action, and tonight's run was spent on a live board incident. It becomes a finding rather than
housekeeping below roughly 10% free disk, which is 03's own threshold and is a long way off.
03's F4 (clone `dirty=2` is one CRLF touch plus the watcher's own runtime-state file, `numstat`
EMPTY) is **ACTIONED as verified-not-a-defect**: do not dispatch a restart on the sweep's
`<-- NOT clean-on-main` line; the watcher has been up 13.4 h through it.

### F8 — 🟡 S3 · Collected from Station 03 (F6): 03's real cadence measured at 23 h 59 m, against a bootstrap that says 4 h

03's last two runs began `2026-09-03T23:02Z` and `2026-09-04T23:01Z` with no run between — an
interval measurement, not a schedule reading, and it settles the direction: **four-hourly is not what
is happening.** Already open as
`needs-marco/station-03-cadence-bootstrap-says-4h-cron-says-daily-2026-09-03.md`, and
STATION-CAPABILITIES §5 flags the same disagreement.

**DISPOSITION: ESCALATED** — existing escalation, evidence added, no second file opened. RULE 1
favours **setting the cron to 4 h and leaving the docs alone**: it satisfies the documented contract
immediately, it is additive (more frequent measurement by a report-only station cannot damage data
entry), and it removes the disagreement permanently. Editing the docs down to daily is also
complete but fails the *immediate* half for machine health — a crash at 23:05Z currently goes unseen
for a full day, and "manually after any crash" is only reachable by a human who already knows.

### F9 — 🟡 S3 · The review lane wrote a verdict it then could not find

`watcher-launch.log` at `23:10:23Z`: `[review] verdict mirror skipped: docs/pr-reviews/pr-1614-review.md
not found`, immediately after the review agent's own line *"MERGE verdict written to
`docs/pr-reviews/pr-1614-review.md`"*. [MEASURED] the file **does exist**, untracked, in the dev tree.
So the verdict was not lost — the mirror step looked in a tree or at a moment where it was not yet
visible, and reported a skip that reads exactly like a lost verdict. It matters because
`verdictApproves` needs `docs/pr-reviews/pr-<N>-review.md`, so a skipped mirror can silently withhold
an approval nobody knows was written.

**DISPOSITION: DEFERRED** — one observation, no cause established, and diagnosing it means reading
the mirror step's code, which is watcher internals and not this run's lane. It becomes urgent if a PR
is ever held for a missing review verdict whose file exists on disk. Recorded here so the next reader
starts from a measurement instead of the log line.

---

## WHAT I DID NOT DO

- **Did not merge anything, and did not remove any label.** Five PRs classified as Marco's merged
  this evening; none of them merged through me, and I reverted none of them — reverting is
  destructive and the escalation explicitly asks him for one sentence, not for an undo.
- **Did not honour the agent-authored clearance in #1608, and did not revert it.** No agent may
  author an approval file; a self-granted clearance does not clear RULE 2. Neither does obeying it
  become correct because it is on `main`.
- **Did not clear `agent-authored-rule-2-clearance-2026-09-04.md`**, despite `status-sweep.ps1` §5
  printing ten `[STALE] … escalation is DEAD, clear it` lines about it. Every PR it cites is its
  **subject**, not a dependency.
- **Did not arm anything.** Nothing was armed this run, and in particular not the three
  `pr-crmui-*-HOLD.md` whose work #1614/#1615/#1616 already carry — arming any of them now opens a
  second PR for work already on the board. Nor `pr-cardui-s2-wbs-table-shell-HOLD.md` or
  `pr-tr-s1-reminder-policy-HOLD.md` (a schema migration; Marco's to authorise).
- **Did not fast-forward the dev tree** (0 ahead / 6 behind). It holds three untracked breadcrumbs at
  paths this PR will create on `main`, so the FF must wait until the PR lands and the disk copies are
  proved byte-identical and removed — the cure the station doc records, and the reason four earlier
  runs re-diagnosed the same refusal from first principles. Nothing this run depended on a current
  working tree: nothing was armed, and the three binding docs were proved identical to `origin/main`
  by `--numstat`.
- **Did not stage or commit from the shared dev-tree index.** All work was done in the disposable
  worktree `C:\po-00-collect`; `git diff --cached --name-status` in the dev tree was EMPTY before and
  is EMPTY after.
- **Did not prune `po-vg`, the four orphaned worktrees, or the two registry escapees**, and did not
  drop a stash or restart the watcher. The sweep verdict was CAUTION, the watcher is healthy at
  13.4 h uptime, and F6 explains why the classifier — not the worktree — is the thing to fix.
- **Did not run `git` through any device bridge against the Windows `.git`**, and did not
  `git checkout .` / `reset --hard` / `stash pop` / `git clean` anywhere.
- **Did not touch `/sot/`** (05's alone), **Azure, Entra or SharePoint** (absolute, all stations), or
  any production data.
- **Did not re-triage `failed/` or `no-pr-opened/`.** Newest entries are `2026-08-28` and
  `2026-09-02`; both were dispositioned in earlier breadcrumbs, and re-diagnosing a solved problem is
  what the brief forbids.

---

**Q6 — the one thing most blocking progress right now:** an unidentified lane is opening `feat(crm)`
PRs against `apps/web/**` with auto-merge armed on open, and RULE 2's only probe is structurally
blind to it — so every such PR either merges without Marco or has to be caught by hand, one run at a
time, by a station that is blind roughly 40% of the time.

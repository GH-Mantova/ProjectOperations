# Station 00 — Supervisor | 2026-09-21T13:08Z–2026-09-21T13:30Z

## GROUND

```
UTC            2026-09-21T13:08:17Z
origin/main    5cb976c6            (fetched, then rev-parse)
dev tree       main @ 76ed975a     C:\ProjectOperations2   (0 ahead / 9 behind at open; fast-forwarded to 5cb976c6 during the run)
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** (both `1`). Full authority this run; no read-only downgrade.

**NOT BLIND.** Stated loudly, because a blind run and a healthy quiet run produce the same "no
news": Desktop Commander answered on the **first** call and every measurement below was taken
through a real Windows PowerShell shell on the box.

## WHAT I MEASURED

**Reachability.** `[MEASURED]` `start_process`, shell `powershell.exe` → PID 13024, first call,
`SHELL-OK` plus `git rev-parse` output. Every chain echoed a literal `MARKER_*` after each
statement (DOCTRINE §9.1 guard 1).

**VM git guard.** `[MEASURED]` `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`.
Last line quoted verbatim, as the contract requires:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
(preceded by `vm-git-guard installed at /sessions/pensive-fervent-goodall/.local/bin/git - refuses
mounted paths and mounted cwd, allows everything else (three controls passed)`). **Install PASSED.**
No `git` was run through the device bridge against the Windows `.git` at any point.

**Binding-document freshness.** `[MEASURED]` in the DEV TREE after `git fetch`, using the sound form
only — `git diff --numstat origin/main -- <path>`, never the piped-hash form §9.1 records as unsound
under `powershell.exe`. All three of `docs/pipeline/stations/00-supervisor.md`,
`docs/pipeline/DOCTRINE.md` and `docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY** = not
different from `origin/main`, so reading the working copies was safe. **All three read in full.**

**Sweep.** `[MEASURED]` `status-sweep.ps1` captured to a file and decoded with node — the capture is
`FF FE` UTF-16LE, **156,866 B** (§9.3's `*>` trap; decoded, never read raw). Section 0 instrument
controls both PASS. Section 7 verdict: **`SAFE TO ACT`**.

🔴 **Section 5 held ZERO `[STALE]` escalation rows** — `[MEASURED]` over lines 112–426 of the decoded
capture: `SEC5_LINES=316 STALE_LINES=0`. The 12:09Z run discharged the one that existed
(`pr-2038-review-fix.md`) and nothing has replaced it. **There was no discharge work this run.**

**Watcher — the only sanctioned liveness probe, plus the parent chain.** `[MEASURED]`
`restart-watcher-if-wedged.ps1` (no `-Fix`) at 23:17:17 local:

```
armed prompts waiting: 0
watcher process:       ALIVE (pid 9744)
restart churn:         0 cycle(s) in 20 min  (starts=0 exits=0, threshold 4)
VERDICT: OK - nothing armed and the watcher is alive. An idle watcher is correct, not wedged.
```

ENSURE-UP by **parent chain**, not by a command-line name probe (the station doc records that a
supervisor invoked with `&` is invisible to the name probe): `node index.mjs` pid **9744** →
parent **17688** `powershell.exe -File C:\po-watcher\ProjectOperatio…` → parent **30116**
`powershell.exe … -File "C:\po-watcher\watcher-launcher-singlelane.ps1"`. **Supervised three deep.
No relaunch, no restart, no `-Fix`.**

**COLLECT — breadcrumb freshness, then the `lastRunAt` cross-check.** `[MEASURED]`
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `structure: 11 checked, 0
malformed`, `CLEAN`. Crossed against `list_scheduled_tasks`, because the breadcrumb is one
instrument and cannot name a cause:

| station | live cron | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|---|
| `00-supervisor` | `5 * * * *` | 2026-09-21T13:07:55Z (this run) | 12:09Z | aligned, healthy |
| `03-machine-minder` | `0 9 * * *` | 2026-09-21T00:20:35Z | 00:21Z | aligned, healthy |
| `04-scanner` | `0 */4 * * *` | 2026-09-21T10:09:32Z | 10:10Z | aligned, healthy |
| `05-sot-keeper` | `10 0 * * *` | 2026-09-21T00:04:02Z | 00:45Z | aligned (breadcrumb 41 min into the run) |

Four ENABLED tasks; `weekly-security-audit` remains `enabled: false`. **No station is SILENT and no
occurrence is missing** — every row is the healthy "both fresh and aligned" case, not either of the
two failure shapes that also print `ok`. ⚠️ `check-breadcrumb.mjs`'s own `CADENCE` map still carries
`'00': 2` against a live hourly cron, so `ok` is a weaker statement about `00` than about any other
station — which is exactly why this table exists and is not optional.

**COLLECT — nothing new to collect.** `[MEASURED]` The newest breadcrumb in the corpus is my own
predecessor's **12:09Z**. 03's is 00:21Z, 04's is 10:10Z, 05's is 00:45Z — **all older than the
12:09Z collect**. I re-read 04's 10:10Z breadcrumb finding-by-finding and traced each to a
disposition already given, rather than assuming the previous run covered it:

| 04's 10:10Z finding | dispositioned by | verified here |
|---|---|---|
| F1 fv2 dead file gate | 11:08Z F3 + 12:09Z F5 — **ESCALATED** | carried forward below as F4 |
| F2 scopecards S5/S6 gates alive | **DEFERRED** ("nothing to fix while #2042 is open") | #2042 still open — correctly deferred |
| F3 two blind-run breadcrumbs untracked | 11:08Z F1 — **ACTIONED** (swept in #2046, rotation in #2045) | all 17 depth-1 breadcrumbs now tracked |
| F4 one SPENT prompt on the board | 11:08Z F2 — **ACTIONED** (already discharged by #2043) | this run's fast-forward shows `rename docs/pr-prompts/{ => superseded}/pr-crmvis-s6-bulk-link-HOLD.md` |

**The board — four open PRs, and the lane of every one of them.** `[MEASURED]` `gh pr view <n> -R
<owner>/<repo> --json …`, `-R` on every call and `$LASTEXITCODE` tested before parsing (§9.4's CWD
bullet). Lane re-taken this run, never carried forward from a breadcrumb (§10.1 — a lane verdict is
non-monotonic and is only as of the minute it was taken):

| PR | created | merge state | labels | lane, re-measured |
|---|---|---|---|---|
| **#2049** `fix/lintstation-contract-version-compare` | 12:31:42Z | UNKNOWN, **15 pass / 0 fail** | none | watcher `marco:true` — *"outside tests/ or docs/: scripts/pipeline/lint-station.mjs"* |
| **#2047** `feat/role-grant-registry-v1` | 11:46:34Z | BLOCKED | **`do-not-merge`** | watcher-opened; label binds |
| **#2044** `feat/crmvis-s8-comms-threads` | 11:09:14Z | BLOCKED | **`do-not-merge`** | watcher-opened; label binds |
| **#2042** `feat/scopecards-s4b-push-panel-ui` | 10:02:39Z | **CLEAN, 15 pass / 0 fail** | none | watcher `marco:true` — *"outside tests/ or docs/: apps/web/src/pages/tendering/ClientQuotesPanel.tsx"* |

Lane probe = the PROMPT logs alone, `rev-*` excluded (§10.1 step 1):
`Select-String -Path docs\pr-prompts\processed\pr-*.log -Pattern 'PR #<n>\b'` →
**#2049 → 1**, **#2047 → 2**, **#2044 → 2**, **#2042 → 3**. POSITIVE control `PR #2040` → **1**;
NEGATIVE control `PR #999931` → **0**. Each verdict was cross-checked against the log's OWN prompt
per the prose-scrape bullet — `pr-lintstation-contract-version-compare-ready.md.log` carries #2049,
`pr-permission-role-reconciler-ready.md.log` carries #2047, and so on — so none of the four is a
number scraped out of an agent's prose.

**So the supervisor merge lane is EMPTY again: all four open PRs are Marco's** — two by label, two
by a real watcher routing verdict. RULE 2 binds on #2049 and #2042; only Marco removes a label.

**Queue.** `[MEASURED]` `triage-holds.ps1`: `HOLD=21, ready=0, LOOPING=0`, `spent=0 of 21 evaluated
gates-satisfied=5 still-gated=16 unreadable=0`. The SPENT bucket was proved reachable by the
script's own fixture control, so `spent=0` is a measurement and not an unexercised path.

**Three of the five ADMITs are duplicates of work already open** — §10.6's exact shape, the premise
dying on MERGE and not on OPEN:

| ADMIT prompt | overlap | open PR | confirmation |
|---|---|---|---|
| `pr-crmvis-s8-comms-threads-HOLD.md` | **3 of 3** | #2044 | PR title carries `CRM_PARITY_THREADS_V1`, the prompt's own marker |
| `pr-lintstation-contract-version-compare-HOLD.md` | **9 of 9** | #2049 | **#2049's own diff retires this prompt** — `docs/pr-prompts/superseded/pr-lintstation-contract-version-compare-HOLD.md` is one of the nine matched scope entries |
| `pr-permission-role-reconciler-HOLD.md` | **7 of 7** | #2047 | `processed/pr-permission-role-reconciler-ready.md.log` carries `PR #2047` |

The remaining two ADMITs — `pr-ops-m2b-tipping-tab-reminder-HOLD.md` and
`pr-queue-layout-sot-entry-HOLD.md` — are genuine arming candidates. Neither was armed; see F2.

**THE ARMING LOG HAS LOST TWO ROWS.** `[MEASURED]` — this is the run's headline and it is developed
under F1.

**Tracked-set check before treating anything as unreported.** `[MEASURED]` All 17 depth-1
`00-*.md` breadcrumbs match a tracked path by basename after the fast-forward, so nothing was
committed a second time as "unreported" (the duplicated-basename trap).

## WHAT CHANGED

**Two mutations, both additive, neither touching the shared dev-tree index.**

1. **Fast-forwarded the dev tree** `76ed975a` → `5cb976c6`, 9 commits. It was clean of tracked
   modifications before the merge (`git status --porcelain` showed untracked files only, `git diff
   --cached --name-status` EMPTY), so this was a plain `git merge --ff-only origin/main` with no
   restore step and no `git checkout` of any kind. **All three read-backs pass:**
   `git rev-list --left-right --count HEAD...origin/main` → `0	0`, `git diff --numstat` → **EMPTY**,
   `git diff --cached --name-status` → **EMPTY**. Nothing was committed on `main`.
2. **This breadcrumb and the archive move**, inside an isolated worktree off `origin/main`
   (`C:\po-worktrees\po-sup-00-20260921-1320`, BOARD DRIVING condition 2), written there rather than
   into the dev tree — cure 1 of the station doc's post-merge fast-forward section, so no loose
   untracked copy is left behind to block the next run's fast-forward.

**Nothing else. No PR was merged, labelled, unlabelled, rebased or pushed to. No prompt was armed,
disarmed, renamed or moved. No `do-not-merge` label was removed. No `sot/` file was touched. The
watcher was not restarted. No arming-log row was written or rewritten.**

## FINDINGS

### F1 — Two arming rows have vanished from an append-only audit log, and the loss is silent in both directions

`[MEASURED]` `docs/pr-prompts/.arming-log.txt` — **139 lines, 22,911 B**, identical on disk and on
`origin/main`. Its newest row is **`2026-09-21T10:33:00Z ARMED pr-crmvis-s8-comms-threads`**. Every
row for 2026-09-21 (six of them) is listed in full above the 10:33Z line and **no row exists for any
arm after it.** `git log -1 -- docs/pr-prompts/.arming-log.txt` → last committed by **#2043**
(`eff2af48`, 10:55Z), consistent with a file whose newest row is 10:33Z.

**But two arms demonstrably happened after 10:33Z:**

| arm | proof it happened | row present? |
|---|---|---|
| `pr-permission-role-reconciler` | `processed/pr-permission-role-reconciler-ready.md` **and** its `.log` exist, and that log carries **`PR #2047`** (2 hits). #2047 was created **11:46:34Z**. | **NO** |
| `pr-lintstation-contract-version-compare` | `processed/pr-lintstation-contract-version-compare-ready.md.log` carries the watcher verdict for **`PR #2049`**. #2049 was created **12:31:42Z**. | **NO** |

🔴 **The first row EXISTED and has since been destroyed, and the evidence for that is tracked on
`main`.** The 12:09Z breadcrumb — merged as **#2048** at 12:28Z — quotes it verbatim in its own
WHAT I MEASURED section: *"`2026-09-21T11:25:01Z ARMED pr-permission-role-reconciler … actor=
station-00.interactive-0004 … pid=28272`"*. `[MEASURED]` `Select-String` over that tracked
breadcrumb returns the quotation; the same needle over `.arming-log.txt` returns **0 hits**, on
disk **and** at `origin/main`. POSITIVE control, `scopecards-s4b` over the same file → **1**;
NEGATIVE control, a freshly minted needle → **0**. **So the probe works and the row is gone.**

🔴 **It was not this run.** The file was **not locally modified** when I found it: `git status
--porcelain` listed only untracked paths, and `git merge --ff-only` — which refuses outright when a
tracked file the merge must update is locally modified, and which is precisely the blocker the
station doc's own fast-forward section documents for this very file — **succeeded**. A working copy
that already equals the committed blob is a working copy whose extra rows are already gone. The
truncation therefore happened between **~12:1xZ** (when the 12:09Z run read the row) and **13:08Z**
(when this run opened), by an actor that is not me.

**WHICH actor, and by what step, is `[CANNOT MEASURE]`** — an append-only file that loses a line
leaves no trace of who removed it, which is the property that makes this worth a finding rather than
a note. The mechanism, though, is documented and specific: `00-supervisor.md`'s post-merge
fast-forward cure says to restore the file with `git show HEAD:<path>` piped to a write, and its own
🔴 block records that **on `.arming-log.txt` that step silently deletes any row another actor
appended since the last commit, while every prescribed read-back still passes.** A board PR merged
at 11:18Z, another at 12:28Z; either merge arms that cure for whoever fast-forwards next.

⚠️ **I did not reconstruct the rows, and that is deliberate.** The 12:09Z quotation is elided (`…`)
rather than byte-exact, and the lintstation arm has no recorded timestamp at all. Writing rows I did
not observe into an audit log would convert a visible gap into an invisible fabrication — strictly
worse, because the next reader could not tell the forged row from a real one. The durable record of
both arms is this breadcrumb and #2048's, both tracked.

⚠️ **The operational cost is exact.** `.arming-log.txt` is *"the only clock that dates an arm"*
(§9.5). With these rows gone, **#2047 and #2049 now have no arm age at all** — not a stale one, none
— so the `.arming-log.txt` half of §10.3's lane corroboration and of §9.5's kill-loop discriminator
cannot be run on either PR. Both were classified this run from the prompt logs, which survived.

⚠️ **Falsifying probe, stated so this can be killed rather than repeated:** re-run
`Select-String -Path docs\pr-prompts\.arming-log.txt -Pattern 'permission-role-reconciler'` with the
`scopecards-s4b` positive control. If the row ever returns, this finding is wrong and the file was
merely being read mid-write.

**DISPOSITION: ESCALATED** — Marco. The question is not *"did a row go missing"* (measured) but
**which half of the loop do you want closed**, because the two arms above are the second and third
instances this week of the same shape. Options, complete-and-additive first per RULE 1:

- **(A) Make `arm-prompt.ps1` commit its own row on a branch and open (or append to) a board PR, so
  a row is durable the moment it is written.** *Complete and additive*: the row can never exist only
  in an uncommitted working copy, so the restore-to-HEAD step has nothing to destroy, and no
  existing row is touched or rewritten. Passes both halves. It is a `scripts/` change and therefore
  **yours to merge**, not a station's. **Recommended.**
- **(B) Make the fast-forward cure append-aware for this one file** — save, restore, fast-forward,
  re-append. Complete for the *future* half only; it fails the *immediate* half, because it is a
  discipline in a document rather than a guard, and the two arms above were lost by an actor that
  had already read that document.
- **(C) Accept the gap and rely on `processed/*.log` for arm provenance.** Cheapest, and it fails
  the *future* half outright: the processed log records that a prompt ran, never **when it was armed
  or by which lane** — which is the whole question the actor fields were added to answer.

### F2 — I armed nothing, and the reason is a measured second actor, not caution

Two of the five ADMIT prompts are genuine candidates (`pr-ops-m2b-tipping-tab-reminder-HOLD.md`,
`pr-queue-layout-sot-entry-HOLD.md`). I armed neither.

**BOARD DRIVING condition 3 — "first confirm nothing else is mid-mutation; if something else is
acting, STOP" — is not satisfied, and this run has the strongest evidence of it yet.** `[MEASURED]`
three independent signals, all inside the hour before this run opened:

1. `station-00.interactive-0004` armed **six** prompts today, the last at **10:33:00Z**.
2. **#2049 was created at 12:31:42Z** — 36 minutes before this run's first shell call — from an arm
   that left no row (F1), so that lane armed again after 10:33Z.
3. **The arming log was truncated between ~12:1xZ and 13:08Z** (F1). That is a *write to a shared
   dev-tree file* by another actor, bracketed to the last hour.

⚠️ **And the sweep said `SAFE TO ACT` the whole time.** That verdict is computed from in-flight
mutation signals — index locks, running `git`, a PR touched in the last two minutes — none of which
fire in the gaps between another lane's actions. This is the open escalation
`two-station-00s-on-one-board-and-the-safe-to-act-gate-reads-safe-between-arms-2026-09-14.md`
reproducing for the third consecutive run, and F1 is the first time it has cost something
**measurable rather than hypothetical**: a shared file lost data between two runs that both read
`SAFE TO ACT`.

⚠️ **The second reason is that arming cannot help today even if it were safe.** All four open PRs
are Marco's. The 11:08Z run already stated this as F4: the board is human-gated end to end, so
arming a fifth prompt lengthens the queue rather than shortening it.

**DISPOSITION: DEFERRED** — real, not now. **What makes it urgent:** the moment the
`station-00.interactive-0004` lane goes quiet for a full cadence (no new arm, no new PR, no
shared-file write between two consecutive 00 runs) **and** at least one of the four open PRs has
merged, `pr-queue-layout-sot-entry-HOLD.md` is the one to arm first — it is a `docs/pr-prompts/`
change, inside 00's own recorded lane, and so it can also land through the `tests-docs` gate without
consuming Marco.

### F3 — The 12:09Z dispatch on #2042 is CLOSED: the interactive lane fixed it and the PR is green

`[MEASURED]` `gh pr checks 2042 -R <owner>/<repo>` filtered for `fail` and `pending` → **no rows**,
exit 0; the sweep's `[LIVE]` line agrees at **15 pass / 0 fail**, `mergeStateStatus` **CLEAN**.

The 12:09Z run's F2 dispatched a real, deterministic regression on that branch —
`batch4-quotes.spec.ts:183`, failing at
`expect(page.getByText(/alternative pricing scenarios/)).toBeVisible()` on **all seven** runs across
seven SHAs, with sibling #2044 green as the positive control. It was dispatched to
`station-00.interactive-0004` rather than fixed, because that lane owned the branch. **That was the
right call and it worked**: the lane fixed it inside the hour and the PR is now green.

Recorded positively because the dispatch channel is the one thing in this pipeline that usually
*doesn't* close, and a dispatch that lands ought to be written down as plainly as one that rots.
#2042 remains **Marco's** — its watcher `marco:true` verdict was re-taken this run and still binds;
green is not release.

**DISPOSITION: ACTIONED** — verified closed by re-running the instrument that raised it. Nothing
further; the merge decision is Marco's.

### F4 — The fv2 cluster question is now SEVEN days old and is still the oldest unanswered thing on this board

Carried forward, not re-derived — 04 raised it on 2026-09-15 and again at 10:10Z today; the 11:08Z
and 12:09Z runs both escalated it. `pr-fv2-ai-digests-HOLD.md` is gated on
`apps/api/src/modules/forms/ai-form-import.service.ts`, which is absent from `origin/main`, and every
prompt that could produce that file sits in `superseded/`. The gate cannot release, and it masks
`pr-fv2-output-channels-HOLD.md` behind it. `[MEASURED]` this run only to the extent that both
prompts are still in the `still-gated (lint exit 1)` bucket of 16 — i.e. nothing has changed.

I did not repair the gate, for the reason 04 and both prior runs gave: the dead file gate is the
**only** gate on `pr-fv2-ai-digests`, so repairing it would immediately arm a prompt whose cluster
Marco has not confirmed is wanted.

**DISPOSITION: ESCALATED** — Marco. One question, unchanged since 2026-09-15: **is the fv2
AI-import / digests / output-channels cluster still wanted?** Options, complete-and-additive first:

- **(A) Retire all three to `superseded/` in a board PR.** *Complete and additive*: removes two
  permanently-parked prompts and the dead gate together, ends the masking, and destroys nothing —
  `superseded/` is recoverable and the prompts stay readable on `main`. Passes both halves.
  **Recommended.**
- **(B) Re-stage a replacement producer for `ai-form-import.service.ts` and leave both gates.**
  Complete only if the cluster is genuinely still wanted; fails the *immediate* half — the board
  carries two dead prompts until the producer ships.
- **(C) Repoint the gate at a file that exists.** Fails the *future* half: it arms a prompt on the
  strength of an edit nobody asked for, against a cluster whose status is the open question.
  **Not recommended.**

### F5 — Sixteen dispositioned breadcrumbs archived; the current cycle left in the queue root

The queue root held **17** depth-1 breadcrumbs, every finding in all of them dispositioned by an
earlier collect (the table under WHAT I MEASURED traces 04's 10:10Z findings one by one). The
station doc requires archiving what has been collected, in the same board PR.

`git mv`'d **16** into `docs/pr-prompts/archive/` in this PR — thirteen `00-00-supervisor-*`
(02:08Z through 12:09Z), `00-04-scanner-0210`, `00-04-scanner-0611`, `00-05-sot-keeper-0045`.
**Left in the root:** `00-04-scanner-2026-09-21-1010-*`, the newest non-00 station report and the
current cycle's, plus this breadcrumb.

⚠️ **This is safe for freshness and it was proved, not assumed** — `check-breadcrumb.mjs` builds its
tracked set with `git ls-tree -r` and matches by trailing path segment, so an archived breadcrumb
still counts. Read-back under WHAT I DID NOT DO.

**DISPOSITION: ACTIONED** — moved in this PR, with `--freshness` re-run after the move as the
falsifying probe.

## WHAT I DID NOT DO

- **Merged nothing, and there was nothing I was permitted to merge.** All four open PRs are Marco's:
  #2047 and #2044 by `do-not-merge` label, #2049 and #2042 by real watcher `marco:true` verdicts
  re-taken this run. I did not call `Assert-SmokedOrEscalate` / `Merge-Pr` against any of them, did
  not enable auto-merge, and did not add or remove a label. **#2042 being green is not release.**
- **Armed nothing** (F2), and disarmed, renamed and moved no prompt. Real armed count **0**.
- **Did not arm the three ADMIT prompts whose work is already open** (#2044, #2047, #2049). Each was
  confirmed on the prompt's own marker or on the PR's diff, never on the head branch, which a prompt
  asserts nowhere.
- **Did not reconstruct the two missing arming-log rows** (F1). Forging an audit row I did not
  observe is worse than the gap it hides.
- **Did not restart or touch the watcher** — `VERDICT: OK`, pid 9744, supervised three deep, 0 armed.
  Restarting on anything short of WEDGED/DOWN is the LL-25 failure, and an idle watcher with nothing
  armed is correct.
- **Did not re-run any CI hoping for green** (§2), and did not diagnose any red from a diff or a PR
  page. The only reds on the board are the four CP-26 `[LABEL_PRESENT]` parks on #2047 and #2044 —
  one cause apiece, shown twice each because the same check runs as the required check and as a step
  inside `PR gates`. **Parked by design; there is no agent-side action behind `[LABEL_PRESENT]`.**
- **Ran no `git` through the device bridge against the Windows `.git`**, and used no
  `git checkout .`, `checkout -- <path>`, `reset --hard`, `stash pop` or `git clean` anywhere. The
  fast-forward was plain and needed no restore step.
- **Committed nothing on `main`** and staged nothing in the shared dev-tree index —
  `git diff --cached --name-status` was EMPTY before and after. This PR was built in a disposable
  worktree off `origin/main` and the breadcrumb was written inside it, so no untracked copy is left
  in the dev tree to block the next fast-forward.
- **Did not touch the orphaned worktree** `C:/PR-Master/worktrees/po-vg` (1 uncommitted file, ~17
  days old — the sweep warns `--force` would discard it) or the registry escapee
  `C:\po-worktrees\po-fix-2005`. Both are **Station 03's**, and 03 runs next at 23:00Z.
- **Did not do 03/04/05's work.** No local-tree cleanup, no audit, no `sot/` edit.
- **Left the backlog's one `READY TO STAGE` item unstaged** (`rates-11c-blocked-consumers`): its own
  note records that the parity proof must have RUN clean first, and existing is not passing.
- **Touched no Azure / Entra / SharePoint surface, and wrote no production data.**
- **Wrote to no gitignored sink.** Nothing went to `docs/qa/qa-findings.md`, `qa-checklist.md`,
  `qa-test-data-registry.md`, `.qa-run.lock` or `qa-run-*.md`. The only files written outside this PR
  were two scratch captures under `C:\po-sup-fix-scripts\`, which carry no findings.

---

## ADDENDUM 2026-09-21T13:24Z — the other lane armed mid-run, F2 is vindicated by measurement, and I have landed the row F1 predicts will die

Same station, same run, later measurement. The mandatory re-sweep **immediately before the merge**
is what caught this — the verdict expires the moment it prints, and this run is now the worked
example of why that rule exists.

**`[MEASURED]` the re-sweep's section 3, at 13:2xZ:**
`[LIVE] watcher build … BUILD IN FLIGHT: pr-ops-m2b-tipping-tab-reminder-ready.md (tick 0.5 min old)`
— against the 13:09Z sweep's `armed (*-ready.md): 0`.

**`[MEASURED]` the queue and the arming log, immediately after:**

```
armed now:  pr-ops-m2b-tipping-tab-reminder-ready.md   (+ rev-2050-ready.md, an auto-generated review job, not a prompt)
newest row: 2026-09-21T13:19:01Z  ARMED  pr-ops-m2b-tipping-tab-reminder  escalates=true
            actor=station-00.interactive-0004  by=Marco@LAPTOP-E6NHU4E4  pid=13084  caller=powershell.exe:2696
git status --porcelain -- docs/pr-prompts/.arming-log.txt  ->   M      (modified, UNCOMMITTED)
```

🔴 **Three things follow, and none of them is an inference.**

**1. F2 was right, and for the exact reason it gave.** `pr-ops-m2b-tipping-tab-reminder` is **one of
the two prompts F2 named as genuine arming candidates and declined to arm.** The
`station-00.interactive-0004` lane armed it **13:19:01Z — eleven minutes after this run opened**,
while the 13:09Z sweep still read `SAFE TO ACT`. Had this run armed on that verdict, both lanes
would have armed inside the same ten minutes. **BOARD DRIVING condition 3 is not a formality and
the sweep's safe-to-act gate cannot substitute for it** — this is the third consecutive run to say
so and the first to be able to point at the collision it prevented.

**2. F1's mechanism is CONFIRMED and narrowed: `arm-prompt.ps1` is not the leak.** The 13:19:01Z arm
wrote a complete, well-formed row carrying every actor field. So the two rows missing under F1 were
**written and later removed**, not never-written. That eliminates the benign reading — *"the lane
armed by some path that does not log"* — and leaves the restore-to-HEAD step named in F1.

**3. That row was sitting in exactly the state F1 says is fatal**, uncommitted in the shared dev
tree, one board-PR merge away from the fast-forward whose cure deletes it. So I have landed it.

### WHAT CHANGED — one addition to this PR, after the fact

**Committed `docs/pr-prompts/.arming-log.txt` into this board PR**, as DOCTRINE §9.5 requires of any
run whose cycle includes an arm. I did not arm it; the row is another lane's, and landing it is how
it survives.

**Every safety condition was measured before the copy, not assumed:**

- `[MEASURED]` §9.5's strict-superset discriminator — `git diff --numstat origin/main -- <path>` →
  **`1	0`**: one insertion, **zero deletions**. A working copy that is a strict superset of `main`
  is a file with something in it that has not landed, and restoring it to HEAD would be a deletion
  rather than a repair.
- `[MEASURED]` row-by-row, in node: `origin/main rows=139  local rows=140`; **rows on main but not
  local = 0**; rows local but not on main = **1**, and it is the 13:19:01Z row quoted above. So
  nothing on `main` is being dropped.
- `[MEASURED]` the copy itself was byte-exact and read back — **23,089 bytes in, 23,089 out,
  `Buffer.compare === 0`** — written with node, never `>`, `Out-File` or `Set-Content` (§9.3).
- `[MEASURED]` after `git add`: `git diff --cached --numstat` → **`1	0`**. The staged change is the
  one row and nothing else.
- The copy was made **into the isolated worktree**. Nothing was staged or committed in the shared
  dev-tree index (§9.2), and the dev tree's own copy is untouched.

**DISPOSITION (F1, revised): ESCALATED — unchanged, and now better evidenced.** The escalation is
about the *loop*, which is still open: this run landed one row by hand, and the next lane to arm
between two board PRs will lose the next one the same way. Option **(A)** — make `arm-prompt.ps1`
land its own row — is the one that ends it, and it is a `scripts/` change and therefore Marco's.

**DISPOSITION (F2, revised): DEFERRED — unchanged, and vindicated.** The other lane is not merely
"recently active"; it armed a prompt this run was weighing, eleven minutes into the run.

⚠️ **What I did NOT do here, and it is the same line F1 draws:** I copied a row that
`arm-prompt.ps1` wrote and that I read byte-exact off disk. I still did not reconstruct either of
the two rows F1 reports missing, because I never observed those bytes. Landing an observed row and
forging an unobserved one are not the same act.

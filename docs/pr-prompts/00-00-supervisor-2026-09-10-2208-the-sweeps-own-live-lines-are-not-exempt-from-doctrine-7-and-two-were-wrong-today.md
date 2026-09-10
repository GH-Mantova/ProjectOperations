# Station 00 — Supervisor | 2026-09-10T22:08:16Z–2026-09-10T22:4xZ

**SIGHTED RUN.** The sweep's headline `TRUNK IS RED` was **false** and is firing right now; the fix
for it is open, green and Marco's. Inside that false alarm sat a real one nobody was reporting —
Dependabot's updater has failed **9 consecutive times** and **15 security alerts (9 HIGH)** are open
behind it. One board PR: the general rule landed in DOCTRINE, one breadcrumb collected and archived.
Nothing armed, nothing merged but this run's own docs PR, no label touched.

Fresh negative-control needle minted this run: `zzQq00Nx26091022h`. It is written down here and is
therefore **SPENT** — mint a new one.

## GROUND

```
UTC            2026-09-10T22:08:16Z
origin/main    6e63dc72              (git fetch origin --prune, then git rev-parse --short)
dev tree       main @ 6e63dc72       C:\ProjectOperations2
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** — this run was not read-only-gated.

`git diff --numstat origin/main` on all three binding documents returned **EMPTY**, and
`git rev-list --left-right --count HEAD...origin/main` returned `0 0`, so reading the working copy
was sound. All three read in full: DOCTRINE **2064** lines, STATION-CAPABILITIES **514**, this
station's doc **1318**.

⚠️ The host is Brisbane (UTC+10) and the session declares "September 11"; UTC is `2026-09-10T22:08Z`.
Every timestamp here is UTC and the file is named `2026-09-10-2208`.

## WHAT I MEASURED

**[MEASURED] Host reachable — NOT blind.** Schemas loaded via `ToolSearch` first (a validation error
is not blindness), then `start_process` shell `powershell.exe` → PID **5560**, which answered
`2026-09-10T22:08:40Z`.

**[CANNOT MEASURE] `vm-git-guard.sh` was NOT installed — ninth consecutive station run.** The Cowork
Linux workspace refused to start, verbatim: `bash failed on resume, create, and re-resume … source
path … is under Plan9 share "c" which is not mounted; create: RPC error -1: ensure user: user
youthful-eloquent-cori already exists unexpectedly`. **Exposure nil** — with no VM there was no
VM-side `git` to guard, and every probe below ran through Desktop Commander on the Windows host.

**[MEASURED] `status-sweep.ps1`, captured to a FILE and decoded from UTF-16LE.** Raw **131,206**
bytes → **385** lines; the `*>` capture opened `FF FE`, so §9.3's trap reproduced exactly as
written. Section 0 controls `[LIVE]` PASS (`gh` saw merged `#1861`; `node` runs) — no `[BROKEN]`.
**Section 7: `SAFE TO ACT`.** `index.lock` interactive/clone **False / False**, git processes **0**,
no PR touched in the last 2 min.

**[MEASURED] Section 5 holds ZERO `[STALE]` rows** — `Select-String '[STALE]' -SimpleMatch` over the
decoded report → **0**, and `needs-marco/` reads **46**. That is the falsifying probe for my
predecessor's F1, run one hour later: the eleven dead escalations it discharged have not returned.

**[MEASURED] Q1 — the open board, verbatim. Five PRs, all CLEAN, all green, and all Marco's.**
`gh` called with `-R` and `$LASTEXITCODE` tested before parsing (§9.4's CWD trap).

| PR | created | mergeState | CI | labels | files | lane verdict |
|---|---|---|---|---|---|---|
| `#1852` | 09-10T13:21:20Z | CLEAN | 15/0/0 | `[]` | 1 | **`NO LOG` — `[NO LANE VERDICT — hand-classified]` MARCO'S** |
| `#1850` | 09-10T12:02:05Z | CLEAN | 15/0/0 | `[]` | 1 | `marco:true` — `outside tests/ or docs/: scripts/pipeline/triage-holds.ps1` |
| `#1845` | 09-10T09:37:57Z | CLEAN | 15/0/0 | `[]` | 1 | `marco:true` — `outside tests/ or docs/: scripts/pipeline/status-sweep.ps1` |
| `#1832` | 09-10T00:12:33Z | CLEAN | 15/0/0 | `[]` | 1 | `marco:true` — `outside tests/ or docs/: scripts/pipeline/vm-git-guard.sh` |
| `#1823` | 09-09T00:05:42Z | CLEAN | 15/0/0 | `[]` | 6 | `marco:true` — `escalates:true - held for Marco, labelled do-not-merge` |

**Q1 answer: ZERO are DIRTY.** No PR on this board has frozen CI. Q2: no conflict exists, so there
is nothing to resolve and nothing to escalate as one.

**RULE 2 probe, with every control the standing rule requires.** Pinned to the LIVE tree
`C:\ProjectOperations2\docs\pr-prompts\processed`, never the clone: **2121** logs, newest
**2026-09-10T21:29:42Z**. **Freshness precondition asserted** — that is younger than the OLDEST open
PR (`#1823`, 09-09T00:05Z), which is the only control separating the live tree from the 08-17 decoy.
`-Pattern 'marco.:true'` (regex; the `-SimpleMatch` form returns 0 **and so does its negative
control**) → **POSITIVE 629**; NEGATIVE, this run's minted needle → **0**. Per-PR on `PR #<n>` in the
BODY of `pr-*.log` only, `rev-*.log` excluded: `#1850` → 2, `#1845` → 2, `#1832` → 2, `#1823` → 2,
**`#1852` → 0**; NEGATIVE control `PR #999999` → **0**.

**`#1852` hand-classified under §10.1 step 2, and corroborated by an instrument the kill loop cannot
erase.** One file, `scripts/pipeline/status-sweep.ps1` — no `(^|/)migrations/` path and outside all
three `NESTED_TEST_PATHS` forms ⇒ **MARCO'S**. The daily clone log (selected by NAME SHAPE
`^\d{4}-\d{2}-\d{2}$` then newest mtime, never by constructing a date — `2026-09-10.log`, mtime
22:09:51Z; POSITIVE controls `[merge]` → 8 and `opened PR #` → 4; NEGATIVE → 0) carries **no**
`opened PR #1852` line, which under the one-directional rule is `[CANNOT MEASURE]`, never "second
lane". `.arming-log.txt` settles it: its last two arms are 09:12:30Z and 11:50:44Z, and **no arm
corresponds to `#1852`** (created 13:21Z) ⇒ second lane, and Marco's either way.
⚠️ `#1823` likewise has no `opened PR #` line **yet does carry a watcher verdict** — a clean
confirming instance of that rule's one-directionality.

**[MEASURED] Q3 — armed prompts counted by hand.** `Get-ChildItem docs\pr-prompts -Filter
*-ready.md` → **0**. `-HOLD.md` at depth 1 → **40**. `triage-holds.ps1`: `spent=0
gates-satisfied=9 still-gated=31 unreadable=0 of 40`, and the nine names are **identical** to the
21:09Z set, so 0-of-9 `tests-docs` eligibility carries over by identity rather than by assumption.

**[MEASURED] The one `POSSIBLE DUPLICATE` flag is already settled and is NOT a duplicate.**
`pr-company-manage-s1-permission-and-grant-HOLD.md` vs open `#1823`, overlap 1 of 4 on a shared
permission registry — resolved at 17:3xZ today by the premise-at-head probe now in §10.6
(`company.manage` → 0 at `#1823`'s head ⇒ premise still TRUE ⇒ not that PR's work).

**[MEASURED] `pr-vmgitguard-selftest-and-recursion-HOLD.md` is on disk AND tracked on `origin/main`
while `#1832` is open — and it is correctly defused, not a live re-arm hazard.** `lint-prompt.mjs`
→ **exit 1, `[HUMAN_GATE_PRESENT]`, line 3 `<!-- watcher: do-not-arm -->`**. That is precisely the
cure §9.5 prescribes for a never-arm prompt, working. `#1832`'s diff does not delete it
(one file, `scripts/pipeline/vm-git-guard.sh`), so the marker is the only thing standing between
this and a duplicate — worth knowing, not worth filing.

**[MEASURED] Watcher healthy, from the one sanctioned probe.**
`restart-watcher-if-wedged.ps1` (no `-Fix`) → **`VERDICT: OK - nothing armed and the watcher is
alive. An idle watcher is correct, not wedged.`** — pid **18228**, wrapper alive, `restart churn: 0
cycle(s) in 20 min`, heartbeat 41 min (ticks only mid-run; stale + empty queue = idle).

**[MEASURED] The clone is NOT corrupt and its `dirty=2` is the false flag again.**
`git status --short` → **2**, both untracked `docs/pr-reviews/pr-1850-review.md` and
`pr-1852-review.md`; `git status --porcelain --untracked-files=no` → **0**. No `MERGE_HEAD`, no
unmerged paths. Second consecutive run to meet it, on two brand-new files — see F1.

**[MEASURED] Q5 — silent no-ops.** `no-pr-opened/` **109**, newest `2026-09-02T03:47Z`; `failed/`
**45**, newest a `rev-*` REVIEW JOB. **No NEW silent no-op since the last collect.** None waved away.

**[MEASURED] COLLECT corpus and the freshness cross-check.** `check-breadcrumb.mjs --freshness`:
`structure: 1 checked, 0 malformed`, **`CLEAN`, exit 0**. The only uncollected breadcrumb was my
predecessor's 21:08Z report, and I asked the TRACKED SET rather than the dev tree before treating it
as anything. Crossed against `lastRunAt` from the scheduled-tasks MCP, which the `00` row needs
because `check-breadcrumb.mjs`'s `CADENCE` map still reads `'00': 2` against a live cron of
`5 * * * *`:

| station | live cron | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|---|
| `00` | `5 * * * *` | 2026-09-10T22:08:16Z (this run) | 21:08Z | aligned, hourly |
| `03` | `0 9 * * *` | 2026-09-09T23:01:42Z | 09-09T23:01Z | 23.2h (cadence 24h) ok; next fires 23:00Z |
| `04` | `0 */4 * * *` | **2026-09-10T22:09:55Z** | 18:10Z | **fired 99 s after me — mid-run now** |
| `05` | `10 0 * * *` | 2026-09-10T14:10:55Z | 14:11Z | aligned |
| `weekly-security-audit` | `30 7 * * 1` | 2026-09-06T21:32:44Z | n/a | next 09-13T21:32Z — see F2 |

**None SILENT.** `04`'s 22:09Z run has not written its breadcrumb yet; it is the next collect's, not
mine, and I did not wait for it.

## WHAT CHANGED

**One board PR. Nothing armed, nothing merged but my own docs PR, no label touched, no watcher
restart, nothing deleted.**

1. **Board PR from a disposable worktree at `C:\po-wt\00-collect-2208` off `origin/main`:**

   | file | change | what |
   |---|---|---|
   | `docs/pipeline/DOCTRINE.md` | `42 0` | F1's rule added to §9.5 |
   | `docs/pipeline/stations/_canonical-blocks.json` | `1 1` | `instruments v2` hash re-recorded |
   | `docs/pr-prompts/00-00-supervisor-…-2108-….md` | `git mv` | collected → `archive/` |

   The DOCTRINE edit was made **in node by pure concatenation with a byte-delta assertion** — never a
   `String.replace` replacement string, which §9.3 records injecting an entire file into itself:
   `BEFORE=162486`, `AFTER=166362`, `EXPECTED_DELTA=3876`, `ACTUAL_DELTA=3876`, **equal**; anchor
   unique before and after; marker count **1**; `U+FFFD` count **0**; negative control absent. The
   insert was CRLF-normalised to match the file, and `--numstat` reads `42 0` — a pure insert with
   **zero deletions**, so no whole-file renormalise.

   The edit sits INSIDE the `instruments v2` canonical block, so `lint-station.mjs` read
   **`REJECT: 1 of 8`** first — confirming that block is DOCTRINE-only and costs ONE re-record, not
   seven — then `--write-canonical`, then a read-back of **`ADMIT: all 8 docs clean`, exit 0**.

2. **This breadcrumb was written INSIDE the worktree**, which is cure 1 of the post-merge
   fast-forward rule: no loose untracked copy is left in the dev tree to block the next FF.

3. **One new `needs-marco/` file** (F2). That folder is gitignored and lives in the dev tree only,
   so naming it here is the only way it reaches anyone:
   `dependabot-updater-has-failed-nine-times-and-fifteen-alerts-are-open-2026-09-10.md`.

`git diff --cached --name-status` in the dev tree was **EMPTY** before I started, so no other chat's
staged work could be swept into my commit — which mattered this run, because `04` was executing
concurrently.

## FINDINGS

### F1 — S2 · THE SWEEP'S OWN `[LIVE]` LINES ARE NOT EXEMPT FROM §7, AND TWO OF THEM WERE MEASURED WRONG TODAY — ONE IS FIRING RIGHT NOW

The sweep's HOW TO READ block instructs every station *"Report ONLY from `[LIVE]` lines"*. That is
right about **provenance** and is read as a claim about **correctness**, which it is not: several
`[LIVE]` lines are *derived verdicts over* live data, and a derivation can be wrong while every
input is fresh. Nothing is empty and nothing warns, so §9.6 never fires.

**Instance 1 — `TRUNK IS RED`, new this hour, and false.** At 21:09Z the sweep read
`main CI on 72684fb0: 5 success / 0 failed (trunk green)`. At 22:10Z it reads
`main CI on 6e63dc72: 4 success / 1 failed  <-- TRUNK IS RED`. **No commit sits between those two
readings.** [MEASURED] `gh run list --commit <full 40-char sha> --json
conclusion,name,event,workflowName` → **6** runs: `Dependabot Updates`/`dynamic`/**`failure`**,
`Claude Code`/`issue_comment`/`skipped`, and `Deploy` · `CI` · `CodeQL` · `Tendering Browser Smoke`,
**every one `success`**. The verdict counts every run *attributed* to main's head; one Dependabot run
flipped the headline.

🔴 **The cost is directional and this station's own doc names it:** rule 5 reads a red trunk under a
docs diff as *"instant proof of a MAIN regression"*, so a run that believes the line hunts — or
authors a `fixes_pr` against — a regression that does not exist.

**Instance 2 — `clone dirty=2 … the watcher may refuse to start`**, measured at 20:2xZ and met again
this run on two brand-new files. `--untracked-files=no` → **0**.

**The fix for instance 1 is already on the board and is Marco's.** `#1852`
(`TRUNK_VERDICT_SCOPED_V1`) is CLEAN and green. **I verified it against the PR's DIFF, not its
title:** applying its denylist (`workflowName -eq "Dependabot Updates" -or event -eq "schedule"`) to
this same commit gives `trunkRuns=5, otherRuns=1` → **4 success / 0 failed → `(trunk green)`**.
⚠️ Its denylist-not-allowlist choice is load-bearing and I confirmed why: **`CodeQL` runs as event
`dynamic`**, so an `event -eq push` allowlist would silently drop a real trunk check.

**DISPOSITION: ACTIONED.** The general rule — *report from `[LIVE]`, but re-derive any `[LIVE]` line
from its own source before you ACT on it* — is landed in DOCTRINE §9.5 in this run's board PR, with
both instances, both costs, and a per-row falsifying probe. It is written so it dies cleanly when
`#1852` merges rather than outliving its own truth, which is the failure §9.5's opening bullets
record. **I did not merge `#1852` and did not push to it** — it is Marco's, and changing an open PR's
contents changes what he is approving.

### F2 — S1 · A REAL ALARM WAS HIDING INSIDE THE FALSE ONE: DEPENDABOT'S UPDATER HAS FAILED 9 TIMES RUNNING AND 15 SECURITY ALERTS ARE OPEN BEHIND IT

The aggregate that produced F1's false `TRUNK IS RED` also told nobody the actual news.

**[MEASURED] 9 consecutive `Dependabot Updates` failures**, `2026-09-09T01:20:55Z` →
`2026-09-10T21:40:38Z`; last success **`2026-09-04T05:02:22Z`**. The failure is inside Dependabot's
own updater container — `Command failed with exit code 1: … bin/run update_files`, `Dependabot
encountered '4' error(s)` — **not** in this repo's CI.

**[MEASURED] 15 open alerts: 9 HIGH, 6 medium** (`gh api …/dependabot/alerts?state=open`), several
created *while the updater was already failing* — `@xmldom/xmldom` ×5 and `vitest`, all today.
**So the backlog is growing and the mechanism that would clear it is down.**

**[CANNOT MEASURE] the four underlying errors.** Two honest attempts — the 5113-line Actions job log
read via column 3 per §9.1 (POSITIVE control `updater` → 183; NEGATIVE → 0) and the
`actions/runs/<id>/jobs` API — both return only the container-level failure. The log itself says the
detail needs repository **write access**, at `…/network/updates/1569666717`. Marco has it; I do not.

**[MEASURED] Nothing is scheduled to notice.** `weekly-security-audit` last ran `2026-09-06T21:32Z`
— **before this streak began** — next runs `2026-09-13T21:32Z`, and is read-only by its own
bootstrap, so it will re-report rather than fix.

**DISPOSITION: ESCALATED.** Dependabot configuration and repository security settings are a GitHub
settings surface and are not a scheduled station's to change, and my measurement is genuinely
exhausted at the gate GitHub puts in front of the updater log. Written to
`needs-marco/dependabot-updater-has-failed-nine-times-and-fifteen-alerts-are-open-2026-09-10.md`
with RULE 1 applied: **(a) complete-and-additive FIRST** — read the updater log, fix the cause, which
clears the alerts *and* restores the automation; **(b)** hand-bumping the four packages fails the
FUTURE half, since the updater stays broken and the next advisory accrues just as invisibly;
**(c)** waiting for 09-13 fails BOTH halves. It carries its own falsifying probe.

### F3 — S3 · THE BOARD IS UNCHANGED IN AN HOUR, AND A SCHEDULED RUN'S ONLY LEVER IS STILL ITS OWN DOCS PR

Re-derived, not inherited. Five PRs open, all five green, all five Marco's — four with a live
`marco:true` verdict and `#1852` hand-classified. **Nine gate-satisfied HOLDs, 0 of 9 able to enter
the `tests-docs` lane**, the nine names identical to the 21:09Z set. So the only arm available today
opens a **sixth** PR Marco must also merge. The lane is not broken; it is **starved of eligible
work**, which is a different problem with a different owner.

🔴 **What is new is that the wait now has a measured cost.** Until this hour, "the queue grows
monotonically" was an inefficiency. As of 21:40Z one of the five waiting PRs is the fix for an
instrument that is **actively lying to every station on every run** (F1), and a second (`#1845`)
also repairs the same script. The oldest, `#1823`, has waited **46 hours**.

**DISPOSITION: DEFERRED.** Not re-escalated as a new file: nothing here is a question, and the queue
was just cut from 57 to 46 by discharging dead escalations — a 47th saying "please merge" would be
noise against a board Marco can already see. It becomes urgent the moment the board holds a PR that
is **not** Marco's and is not moving, or a gate-satisfied HOLD appears whose scope is `tests/` or
`docs/` only, at which point arming resumes with no further question. ⚠️ **These are counts, i.e.
state — re-measure, never quote.**

### F4 — S3 · TWO KNOWN ENVIRONMENT FAULTS REPRODUCED EXACTLY; NEITHER RE-ESCALATED

**The `00`×`04` collision fired at 99 seconds** — `00` `22:08:16Z`, `04` `22:09:55Z` — at 08:08
LOCAL, as far from midnight as this schedule allows. That is the same 99-second figure measured on
09-07, and it confirms the correction in STATION-CAPABILITIES §6: the overlap is **by construction**
on every one of `04`'s six daily runs, so moving `05` de-collides the three-station case only and
Marco needs **two** cron offsets, not one. `04` is read-only and cannot mutate the board, and my
dev-tree index was verified EMPTY before committing, so no LL-38 collision was possible this run.

**The Cowork Linux workspace failed for the ninth consecutive station run**, same Plan9-share RPC
error under a new session name — so the failure follows the workspace, not the session. Cost this
run: nil.

**DISPOSITION: DEFERRED, neither re-escalated.** Both already have homes — the open cron-offset
escalation for the first, and three files for the second
(`linux-sandbox-fails-to-start-four-consecutive-runs-2026-09-10.md`,
`cowork-vm-mount-unreachable-two-stations-2026-09-10.md`,
`station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`). A fourth would split one
question across four homes. ⚠️ **Both consecutive-run counts are STATE — re-measure, never quote.**

## WHAT I DID NOT DO

- **Merged nothing but my own docs-only board PR, and cleared no RULE 2 verdict.** Four of the five
  open PRs carry a live `marco:true` line and the fifth hand-classifies as Marco's on a one-file
  `scripts/` diff. `labels=[]` on all five is **not** a clearance — `#1823`'s own verdict records the
  `do-not-merge` label it once carried, and Marco removing a label does not clear RULE 2.
- **Did not merge or push to `#1852`** even though it repairs an instrument that is misleading me
  right now. It is Marco's; I documented the trap instead, which is the lever I actually have.
- **Removed no `do-not-merge` label and authored no `merge-approvals/<N>.md` receipt.** A scheduled
  run never may; Marco's 2026-09-07 ruling covers the supervised cloud lane only, and this is the
  scheduled one.
- **Armed nothing**, and did not treat the `POSSIBLE DUPLICATE` flag as a verdict in either
  direction — it was settled against `#1823`'s head, and separately I left
  `pr-vmgitguard-selftest-and-recursion-HOLD.md` alone because its `do-not-arm` marker is doing
  exactly its job.
- **Changed no Dependabot setting, no workflow, no manifest and no lockfile, and dismissed no
  security alert.** F2 is a GitHub settings surface and is Marco's.
- **Deleted nothing.** The collected breadcrumb was `git mv`-ed into `archive/`, not removed.
- **Did not touch `scripts/`, did not edit `/sot/`, and did not go near Azure, Entra or SharePoint.**
- **Did not restart the watcher, run `rescue-watcher-repo.ps1`, prune a worktree, drop a stash or
  delete a branch.** The clone is on `main` and not corrupt. Two orphaned worktrees remain —
  `C:/po-vg` at **9497** min holding one uncommitted file, and `C:/po-worktrees/pr1823` at **1439**
  min clean — both already dispatched to `03` and neither touched.
- **Did not diagnose the Dependabot failure from the run's title or the PR page** — I read the job
  log, twice, and reported `[CANNOT MEASURE]` for the part GitHub gates rather than inferring it.
- **Did not wait for `04`'s concurrent run** or read its unfinished output; its breadcrumb is the
  next collect's.
- **Did not run `git` against any mount** — there was no mount — and did not run `git checkout .`,
  `reset --hard`, `stash pop` or `git clean` anywhere, in any tree.

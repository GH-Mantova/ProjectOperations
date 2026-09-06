# Station 00 — Supervisor | 2026-09-06T12:08:44Z–2026-09-06T13:0xZ

## GROUND

```
UTC            2026-09-06T12:08:44Z
origin/main    e3669163            (git fetch origin +refs/heads/main:..., then git rev-parse --short origin/main)
dev tree       main @ e3669163     C:\ProjectOperations2   (was 16ddb58b; fast-forwarded 12:09Z this run)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1) — MATCH
```

**SIGHTED.** Desktop Commander schemas were loaded with `ToolSearch` FIRST (keyword `desktop-commander`,
then `select:` by the ids that search reported), then `start_process` shell `powershell.exe` → pid 28236,
first attempt, no retry. The previous run at 11:08Z was blind (`CONNECT_TIMEOUT`); this one is not.

The three binding documents were read from the dev tree, which is byte-identical to `origin/main` for
all three: `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY** (§9.3's sound form — no
piped hash, no length comparison).

`status-sweep.ps1` at 12:09:53Z: **§7 VERDICT — SAFE TO ACT.** Section 0 controls both PASS
(`gh` saw merged #1714; `node` runs). Re-run immediately before the board mutation — see WHAT CHANGED.

## WHAT I MEASURED

**COLLECT — every breadcrumb since the last run, and its freshness.** [MEASURED]
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → **CLEAN**, exit 0, `structure: 6 checked,
0 malformed`. No station SILENT: 00 `0.9h` · 03 `13.2h` (cadence 24h) · 04 `2.0h` · 05 `22.0h`.
⚠️ The `--freshness` verdict for **00** is weaker than for any other station — `check-breadcrumb.mjs`'s
own `CADENCE` map still reads `'00': 2` against a live cron of `5 * * * *`, so 00 cannot read SILENT
until three consecutive hourly runs are missed. Already recorded in STATION-CAPABILITIES §6; not
re-raised. Two breadcrumbs were flagged `UNTRACKED` and are swept into this run's PR (below).

**Board, all `[LIVE]` from the 12:09:53Z sweep and re-read per PR with `gh`.** 4 open PRs, all
`BEHIND`, all authored `GH-Mantova`, **none carrying any label**:

| PR | created | checks at 12:1xZ | files |
|---|---|---|---|
| #1715 rates-11b3 sortOrder | 12:05:15Z | 13 pass / 0 fail / 2 pending | 3 (`rate-resolver.service.ts` + 2 specs) |
| #1713 linefields s1 | 11:46:21Z | 14 pass / 0 fail / 1 pending | 12, incl. `prisma/migrations/` |
| #1709 tender-lifecycle bidStatus | 10:44:19Z | 14 pass / 0 fail / 1 pending | 6, incl. `prisma/migrations/` |
| #1699 rates value-column units | 08:44:40Z | 12 pass / **2 fail** / 1 pending | 3, incl. `prisma/migrations/` |

**RULE 2 — the probe is WORKING and FRESH, and it is silent on all four.** [MEASURED] in the LIVE
tree `C:\ProjectOperations2\docs\pr-prompts\processed` (the `C:\po-watcher` decoy was not read):
**1997** logs · newest **12:12:50Z** — younger than every open PR, which is the control that
separates the live directory from the 17-day-stale clone copy · POSITIVE `marco.:true` → **617** ·
NEGATIVE, freshly minted `zzQq00Needle20260906T1215` → **0**. Per-PR, over `pr-*.log` only (excluding
`rev-*`, DOCTRINE §9.5): **#1715 → 0 · #1713 → 0 · #1709 → 0 · #1699 → 0**; negative control
`PR #999999` → **0**.

**Which absence — the launch-log discriminator, with its positive control.** [MEASURED] over every
`*.log` under `C:\po-watcher` recursively: `opened PR #1715|#1713|#1709|#1699` → **0, 0, 0, 0**;
POSITIVE control `opened PR #` → non-zero, newest three being
`08:34:54Z … opened PR #1698, policy=tests-docs, waiting.`,
`08:56:57Z … opened PR #1700`, `10:33:20Z … opened PR #1707`. So the watcher opened none of the four:
they are **SECOND LANE**, not watcher PRs inside a waiting window and not crashed verdicts.

**Hand classification, `[NO LANE VERDICT — hand-classified]` for all four** (§10.1 step 2,
`classifyPolicyFiles`): #1713, #1709 and #1699 each contain a `(^|/)migrations/` path → refused on
that clause alone. #1715's two spec files match `NESTED_TEST_PATHS`, but
`apps/api/src/modules/rates/rate-resolver.service.ts` matches none of the three forms → refused on the
first non-test path. **All four are MARCO'S. None may be merged by this station.**

**#1699's two reds are ONE cause, and it is the coupling already on file.** [MEASURED] — read from
the job logs, never from the PR page. `gh run view … --log` refused (`run is still in progress`), so
the per-job endpoint was used instead: `gh api repos/GH-Mantova/ProjectOperations/actions/jobs/101485099792/logs`
→ `FAIL - CP-26 approval-receipt [RELEASED_NO_RECEIPT] PR #1699 was labelled do-not-merge and
released, but docs/decisions/merge-approvals/1699.md is not in this PR's diff against merge-base with
origin/main.` And job `101485099854` (`PR gates — diff checks`) →
`ALLOWED - CP-11 migrations`, `PASS - CP-12`, `CP-13`, `CP-17`, `CP-23`, `CP-24`, `CP-25`,
`SKIP - CP-09/10`, `SKIP - CP-22`, then `FAIL - CP-26 do-not-merge [...]`. **Every gate on #1699
passes except CP-26, and CP-26 takes the diff-checks job down with it — one cause, two reds.**
There is no code defect here to fix.

**Machinery.** [MEASURED] Sweep: watcher node **RUNNING pid 27236**, heartbeat age **0 min**,
`index.lock` False/False, 0 git processes, 0 in-progress prompts, armed = **1** — and that one is
`rev-1715-ready.md`, an auto-generated REVIEW JOB, not a prompt (§9.5), so the **real armed count is
0**. `ensure-watcher.log`: `RELAUNCHED` at `09:25:04Z`, `09:35:06Z`, `09:49:32Z` and **none since** —
the 09:2x–09:5x kill loop is over. The node changed pid `15336 → 27236` between the `11:45:03Z` and
`11:55:03Z` heartbeat lines with **no** `RELAUNCHED` line, i.e. the wrapper restarted it, not
`ensure-watcher.ps1`. One restart in two hours is not a loop.

**Clone and running code.** [MEASURED] read-only git in the clone (permitted; no write of any kind):
`git -C C:\po-watcher\ProjectOperations rev-parse --short HEAD` → **`16ddb58b`**, against
`origin/main` = **`e3669163`**. The live node's command line is
`node --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs`, and its parent
is `powershell … -File C:\po-watcher\ProjectOperations\scripts\pr-watcher\supervise-watcher.ps1`.
Both files are therefore served from the clone at `16ddb58b`.
`Select-String -Pattern 'WATCHDOG_RESTART_GRACE|CreationDate'`: dev-tree copy → **15** hits
(mtime `2026-09-06 12:09:14Z`, i.e. the fix); clone copy → **0** hits (mtime `2026-08-24 05:24:03Z`).
Fresh negative needle over the same file → 0.

**Wrapper families.** [MEASURED] `Get-CimInstance Win32_Process` by COMMAND LINE (never by image
name): **five** `watcher-launcher-singlelane.ps1` (pids 35328, 24952, 23740, 25664, 34940) and
**three** `supervise-watcher.ps1` (pids 28632, 23680, 28392). Start times are host-local (UTC+10):
pid 35328 started **2026-09-04 09:37Z** — two days old. Only pid 28392 is the live node's parent.
The sweep's own count is `auto-restart wrapper: alive (7)`.
⚠️ Times reported by `Win32_Process.CreationDate` here are **local**; `[Management.ManagementDateTimeConverter]::ToDateTime`
threw `ArgumentOutOfRangeException` on this box, so the raw values were used and converted by hand.

**The launch path's git operations, read from source.** [MEASURED]
`Select-String -Pattern 'git (pull|fetch|reset|merge|checkout)'` over the four scripts in the launch
chain: `ensure-watcher.ps1` → **0**; `watcher-launcher-singlelane.ps1` → **1**, and it is
`git fetch origin --prune` (remote-tracking refs only); `start-watcher.ps1` → `git checkout main`
(plus two comments and one log line); `supervise-watcher.ps1` → **0**. Fresh negative needle → 0.
**Nothing in the launch path advances the clone's `main`.** `git checkout main` moves onto the branch
the clone is already on; it does not merge. That is why the clone can sit at `16ddb58b` while
`origin/main` is `e3669163`, and it is why a restart alone deploys nothing.

## WHAT CHANGED

`status-sweep.ps1` was re-run immediately before the mutation (§7 `[LIVE]` expires); verdict
**SAFE TO ACT** both times. `git diff --cached --name-status` was **EMPTY** before staging, so no
other chat's work was carried (§9.2, shared index).

- **Fast-forwarded the dev tree** `16ddb58b → e3669163` (12:09Z). Read back: `git rev-parse --short
  HEAD` = `e3669163`, `git diff --cached --name-status` EMPTY.
- **Committed `docs/pipeline/sweep-rotation.json`**, which Station 04 advanced and left dirty for 00
  by its own station doc's instruction (`last_index=0`, `last_run_utc=2026-09-06T10:10:36Z`).
- **Swept up two UNTRACKED breadcrumbs** — `00-04-scanner-2026-09-06-1010-…` and
  `00-00-supervisor-2026-09-06-1116-…`. Until this PR they reached nobody.
- **Edited `docs/pr-prompts/pr-rates-s11c-drop-legacy-tables-HOLD.md`** — see F5. Two additive
  changes, `+12 / -0` per `git diff --numstat`: a sixth `## Do` step writing the landed marker, and
  one clause appended to `done_when`. Edited with **node** (`readFileSync`/`writeFileSync`, utf8) by
  line-index splice, never PowerShell and never `String.replace` with a `$`-bearing replacement
  (§9.3). Byte delta asserted: 6075 B → 7173 B, `+1098` against `+1094` of intended text; the extra
  4 B are four lone-LF lines normalised to CRLF by the rejoin, invisible to git (`--numstat` shows
  exactly the 12 inserted lines and no deletions).
- **Edited `docs/pipeline/STATION-CAPABILITIES.md` §3** — see F4. One paragraph, `+13 / -0`. Byte
  delta asserted: 26390 B → 27412 B, `+1022` against `+1008` of intended text, the 14 B difference
  being the 14 CRLF conversions. Anchor uniqueness was asserted before writing.
- **This breadcrumb.**
- **Read-backs run before the PR:** `node scripts/pipeline/check-breadcrumb.mjs` → **CLEAN**, exit 0.
  `node scripts/pipeline/lint-station.mjs` → `ADMIT: all 8 docs clean`, exit 0.
  `node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-rates-s11c-drop-legacy-tables-HOLD.md` →
  `REJECT [FILE_GATE_NOT_RELEASED]`, exit 1 — which is the **pre-existing and correct** never-arm
  gate (`docs/approvals/rates-s11c-drop-legacy-tables-approved-by-marco.md` is not on main), and
  reaching the gate check at all proves the front matter still parses after the `done_when` edit.
- **Nothing else.** No prompt armed, disarmed, renamed or moved. No PR merged, labelled, closed or
  commented. No `/sot/` edit. No process killed or started. No `git` write of any kind in
  `C:\po-watcher`. No `git checkout .` / `reset --hard` / `stash pop` / `clean` anywhere (§9.2).
  No Azure / Entra / SharePoint contact.
- Scratch only, outside the repo: `C:\po-sup-fix-scripts\sweep-1208.txt`,
  `edit-00-20260906-1240.mjs`, `edit2-00-20260906-1245.mjs`.

## FINDINGS

### F1 — S1 — Both watcher fixes that merged this morning are undeployed, and NOTHING in the launch path can ever deploy them

Two `scripts/pr-watcher/**` PRs merged today: **#1712** `WATCHDOG_RESTART_GRACE_V1` (11:25Z), the fix
for the 09:2x kill loop, and **#1704** `VERDICT_HOME_RESOLVER_V1` (11:41Z). Measured above: the live
node runs `index.mjs` and `supervise-watcher.ps1` **from the clone**, the clone's `main` is
`16ddb58b` — before both merges — and the clone's `supervise-watcher.ps1` carries **0** grace-fix
tokens against **15** in the dev-tree copy.

DOCTRINE §9.5 already says *"a restart adopts nothing … the clone must be fast-forwarded before a
restart changes any behaviour."* **What is new is that no actor in the launch chain does it.**
`watcher-launcher-singlelane.ps1` fetches (refs only); `start-watcher.ps1` runs `git checkout main`,
which on a clone already on `main` is a no-op with respect to content; `ensure-watcher.ps1` and
`supervise-watcher.ps1` touch git not at all. So the clone advances **only** when a human or a
station fast-forwards it by hand, and until that happens every merged watcher fix is inert — while
the board, CI and `origin/main` all read as though it shipped.

**This is why the fix landing does not close the exposure.** The 11:16Z run's F3 deferred "every
restart until 03 runs re-enters the kill loop" on the reasoning that the fix was not yet merged. It
is merged now, and the exposure is unchanged.

**Falsifying probe:** `git -C C:\po-watcher\ProjectOperations rev-parse --short HEAD` — if it ever
equals `origin/main` without a human having FF'd it, something in the chain does advance the clone
and this finding is dead.

**DISPOSITION: DISPATCHED → Station 03 (Machine Minder)**, as ONE piece of work in this order:
(1) fast-forward `C:\po-watcher\ProjectOperations` to `origin/main`, dealing with the 3 untracked
`docs/pr-reviews/pr-{1709,1713,1715}-review.md` first — they are review artefacts, not drift, and
`git stash drop`, never `pop` (§9.2); (2) then, in an idle window with `armed`-of-real-prompts at 0,
restart so the new `index.mjs` and `supervise-watcher.ps1` take effect. **00 may not do step 1** —
"never run `git checkout`/`merge`/`rebase`/`commit`/`push`/`pull` in `C:\po-watcher\ProjectOperations`"
is an absolute hard stop in this station's own doc — and step 2 without step 1 deploys nothing.
**03's next run is `2026-09-06T23:00:45Z`**, so this sits ~11 h. That is the third measured cost of
the already-open 03-cadence escalation (bootstrap 4 h vs live cron daily) and of the already-open
"who may FF the watcher clone" question; **cite them, do not re-raise them as new.**

### F2 — S2 — Every relaunch leaks a supervisor family, the count has gone 1 → 3 → 7 in 31 hours, and eighteen runs quoted it without reading it

Measured above: **8 launcher/supervisor processes** are alive (5 `watcher-launcher-singlelane.ps1`,
3 `supervise-watcher.ps1`); the sweep counts **7**. Exactly **one** — `supervise-watcher.ps1` pid
28392 — is the live node's parent. The oldest, launcher pid 35328, started **2026-09-04 09:37Z**.

**The trend is in this station's own breadcrumbs and nobody has read it.** [MEASURED]
`Select-String` over the 93 `00-*.md` breadcrumbs dated 09-04..09-06 (POSITIVE control: 20 files
match `watchdog`; NEGATIVE, fresh needle: 0):

| when | reported |
|---|---|
| 2026-09-05, all runs 05:08Z → 23:08Z, **twelve consecutive** | `wrapper alive (1)` |
| 2026-09-06 05:40Z, immediately after `restart-watcher-if-wedged.ps1 -Fix` | `wrapper alive (3)` |
| 2026-09-06 07:08Z, and 04's 06:10Z | `wrapper alive (3)` |
| 2026-09-06 12:09Z (this run), after three kill-loop `RELAUNCHED` events | **`alive (7)`** |

Every one of those readings sits inside a health line — *"watcher node RUNNING pid N, auto-restart
wrapper alive (K), heartbeat …"* — copied from the sweep as evidence the machine is **fine**. It is
a correct reading of a quantity nobody was watching: §7's shape, with the number in plain sight for
thirty-one hours. `restart-watcher-if-wedged.ps1 -Fix` and the `ensure-watcher.ps1` RELAUNCH path
each start a new family and neither retires the old one.

**Why it matters, stated without overclaiming.** It has caused no outage: `start-watcher.ps1`'s
single-instance guard means the extra supervisors cannot produce a second node, and
`supervise-watcher.ps1` ADOPTS a running node rather than exiting. What it does mean is that when the
node next exits, **seven** supervisors race to restart it, six of them then polling a node they did
not start — and, until F1 is deployed, all of them running the pre-#1712 kill logic. This is also the
process-layer twin of the open "two Station 00s can drive one board and nothing guards it"
escalation.

**Falsifying probe:** the count itself — if `alive (K)` returns to 1 after a restart without anyone
killing processes by hand, the relaunch path does retire its predecessor and this finding is dead.

**DISPOSITION: DISPATCHED → Station 03**, folded into F1 so it is one visit to the machine: before
the restart in F1 step 2, enumerate every launcher/supervisor process **by command line** (never by
image name, §9.5), **report each PID and its command line before killing anything** (00-supervisor
LIMITS 5, and it binds 03 too), then leave exactly one family. Repairing the leak itself — making
the relaunch path retire its predecessor — is a `scripts/pr-watcher/**` change and therefore a
prompt, not a hand-fix; it should be staged only after F1 is deployed, so the fix is not written
against code the machine is not running.

### F3 — S2 — All four open PRs are second lane, three carry migrations, none carries a label, and #1699's red is a receipt no agent may write

Measured above with controls. The **probe is silent on all four** and the launch-log discriminator
says why: the watcher opened none of them. `[NO LANE VERDICT — hand-classified]` → **all four are
Marco's**, three of them because they contain `prisma/migrations/` paths.

**None of the four carries `do-not-merge`.** That is the already-filed finding of the 09:08Z run
(*"an escalating second-lane PR carries no `do-not-merge` label because only the watcher applies
it"*), and of the standing note that **CP-26 is armed by LABELLING, not by the DIFF** — so CP-26
passes vacuously on an unlabelled destructive migration. Recorded here as corroboration that it now
holds for **four** PRs at once, including two opened since that run (#1709, #1713). **Not re-filed.**

**#1699 is the inverse case and it is stuck.** It *was* labelled and released, so CP-26 correctly
demands `docs/decisions/merge-approvals/1699.md`, and both reds trace to that single check. The
standing rule is absolute: **no agent may author a `merge-approvals/<N>.md` or any approval file.**
So this red is not fixable by any station — it clears when Marco either commits the receipt on the
branch or re-applies the label. It has been open since 08:44Z and was already escalated by the
10:08Z and 11:16Z runs.

**DISPOSITION: ACTIONED as a measurement** — lane established for four PRs with both controls, the
red root-caused from the job log rather than the PR page, and nothing merged. The underlying gaps
are the two open escalations named above; **cited, not re-raised.**

### F4 — S2 — Mount mtimes are host-local: the blind-run clause is now on main

The 11:16Z blind run's F5 dispatched a one-clause docs edit to "the next sighted Station 00". This is
that run. [MEASURED] the clone's `heartbeat.log` mtime printed `2026-09-06T21:15` under `TZ=UTC`
while its content, `ensure-watcher.log` and the VM clock all read `11:15Z` — a ten-hour error, in the
future, with no error and no empty result, so §9.6 never fires.

**DISPOSITION: ACTIONED.** The clause is added to `STATION-CAPABILITIES.md` §3, in the blind-run
ceiling block that tells a blind run to read exactly those files, with the measurement and the cure
(*take times from log content, never from a mount `stat`*). Byte delta asserted; `lint-station.mjs`
exit 0. **Hand-landed rather than armed** — DOCTRINE §10.3 permits that for binding law that must be
exact, and this is a safety clause in the one document a blind run is told to trust. Delivered in
this run's board PR, so it is reviewable there.

### F5 — S2 — Station 04's dead-gate finding is fixed in the prompt, not routed onward

04's 10:10Z **F1**: `pr-tipid-s3-…-HOLD.md` gates on
`docs/data-model/rates-migration/STEP-11C-DONE.md :: ESTIMATE_WASTE_RATES_DROPPED`, and nothing in
the repository was told to write it, so s3 is parked permanently — gates run before the premise, so
it can never surface as SPENT or as a CANDIDATE.

**Confirmed independently, and sharpened.** [MEASURED] `git grep -l -I --fixed-strings` on
`origin/main -- docs/` (negative control, fresh needle → exit 1, no output):

- `STEP-11A-DONE` → `docs/plans/rates-migration-plan.md` and the **consumed** `pr-rates-s11a-…-ready.md`
- `STEP-11B-DONE` → the plan, `BACKLOG.yaml`, the consumed `pr-rates-s11b-…-ready.md`, the consumed
  `pr-rates-11b2-c-parity-proof-ready.md`, **and `pr-rates-s11c-…-HOLD.md`** — which names 11B as its
  own *gate* and never names 11C as its *output*
- `STEP-11C-DONE` → only the consumer `pr-tipid-s3-…-HOLD.md` and an archived 04 breadcrumb

So the convention is real and each slice writes its own marker; 11c is simply the one slice never
told to. One further measurement 04 did not have: `git show
origin/main:docs/data-model/rates-migration/STEP-11B-DONE.md` is the single line `11b landed` — **no
token**. s3's gate wants a token, so 11c's marker is the first in the series that has to be
greppable, and the prompt now says so explicitly.

**DISPOSITION: ACTIONED, and deliberately NOT routed to Station 06.** 04 recommended routing it to
06 as chain owner. **06 has no cadence and no consumer** — that is the measured failure the record
already carries (dispatches naming 02 went unread for seven weeks; the 09-05 21:08Z breadcrumb is
titled *"a dispatch to a station with no schedule is a finding with no consumer"*). Re-dispatching
would be the third hop for a finding whose fix 04 had already specified exactly. The edit is
additive, inside `docs/pr-prompts/` which is 00's lane, and reviewable in this PR: a sixth `## Do`
step and one `done_when` clause. `docs/data-model/**` was already in the prompt's `scope`. The prompt
remains correctly un-armable — `lint-prompt.mjs` still `REJECT [FILE_GATE_NOT_RELEASED]`.

### F6 — S3 — Station 04's F2 is REFUTED by the text of the prompt it critiques

04's **F2** asked for `docs/audits/waste-map-location-backfill.md` to be added to
`pr-tipid-s2-…-HOLD.md`'s `scope:` and for `grep -q BACKFILL_UNMATCHED …` to be added to its
`done_when`, on the reasoning that s2 "can pass its own completion test having skipped the one output
its successor's gate depends on."

[MEASURED] The same prompt, ~10 lines below the two lines 04 quoted, says:

> **Do NOT create the receipt file in this PR**, and do not ship a template of it. It is written by a
> real `--apply` run against a real database. A stub receipt containing the token would release S3's
> gate while nothing had actually been backfilled — the exact defect the `STEP-*-DONE.md` convention
> has already produced once.

So both halves of the proposed fix would break the prompt: a `done_when` grep for a file the build is
forbidden to create fails every time, and putting the path in `scope` invites the stub the prompt
exists to prevent. **s2 not producing the receipt is the design, not an omission** — the receipt comes
from a human `--apply` against a real database, exactly like the five `docs/approvals/` gates in 04's
own F3. The residue of F2 is therefore not a scope bug but F3's theme: a gate whose release condition
is a human act that nothing surfaces to that human.

**DISPOSITION: ACTIONED as a refutation** — recorded here with the quotation so it is not re-derived,
and `pr-tipid-s2-…-HOLD.md` was **not** edited. The surviving concern folds into 04's F3, which 04
itself DEFERRED with a written trigger (*the moment the rates-11b2-c parity proof lands, five approvals
are waiting on Marco alone*). That deferral stands unchanged. This is also worth noting as a general
point: an adversarial critique that quotes two lines of a prompt can be refuted by a third, and 04's
own station rule forbids it from editing the prompt — so the check belongs at the collect step, here.

### F7 — S3 — `packed-refs` is still stale, unchanged

[MEASURED] `.git/packed-refs` still reads `refs/heads/main 4ea28d6d` / `refs/remotes/origin/main
66194af6` while the loose refs read `e3669163`. Nothing this run read a ref through `packed-refs`;
every value above came from `git rev-parse`, which prefers the loose ref.

**DISPOSITION: DEFERRED**, unchanged from the 11:16Z run. What would make it urgent: any tool that
resolves `origin/main` through `packed-refs`, which would silently read an August tree.

## WHAT I DID NOT DO

- **Did not merge anything.** All four open PRs hand-classify as Marco's (F3); three carry
  migrations. RULE 2 and §10.1 both bind, and an absent verdict is not a clearance.
- **Did not remove or apply a label,** and **did not write a `merge-approvals/<N>.md` receipt** for
  #1699 or any other PR. Only Marco removes `do-not-merge`; no agent authors an approval file. That
  is why #1699's red is reported and not fixed.
- **Did not fast-forward or otherwise `git`-write in `C:\po-watcher\ProjectOperations`.** Absolute
  hard stop. Read-only `rev-parse` / `status` only. This is precisely what blocks F1 and is why it
  went to 03.
- **Did not restart the watcher and did not kill any wrapper.** The sanctioned verdict is HEALTHY —
  node running, heartbeat 0 min, real armed count 0 — and 00's fix set covers WEDGED/DOWN only.
  A restart without the clone fast-forward would deploy nothing (F1) while re-entering the
  still-undeployed pre-#1712 kill path, so it fails RULE 1's "does not damage" half.
- **Did not arm anything.** Deliberate: the real armed count is 0, the machine is one node-exit away
  from the old kill logic until F1 is deployed, and arming re-arms that exposure for no gain. The
  only `-ready.md` on disk is `rev-1715-ready.md`, a watcher-generated review job.
- **Did not edit `pr-tipid-s2-…-HOLD.md`** — F6 refutes the change that was asked for.
- **Did not route F5/F6 to Station 06.** Reasoning in F5; 06 has no cadence and no consumer.
- **Did not touch `/sot/`** (05's lane), **did not clear any `[STALE]` line** in the sweep's §5
  — including the sixteen against `agent-authored-rule-2-clearance-2026-09-04.md`, which no agent
  may clear — and **did not touch `C:\po-vg`**, the orphaned worktree holding 1 uncommitted file
  (age 3136 min), which is named in an existing needs-marco file and is 03's.
- **Did not clean up the untracked residue in the queue root** — `pr-watcher-verdict-home-resolver-LOOPING.md`
  (its fix shipped as #1704, so the file is spent), `superseded/pr-doctrine-s9-four-false-traps-LOOPING.md`,
  `queue-watch-state.md`, `.queue-sync-ledger.txt` and 46 untracked `docs/pr-reviews/pr-*.md`.
  A `-LOOPING.md` matches no watcher glob so it arms nothing, and the review files are the dev-tree
  home of the three-home verdict problem (§9.5) — moving them is 03's clone-hygiene work, already
  dispatched.
- **Did not re-file the duplicate-PR, dark-launch-log, unlabelled-second-lane, CP-26-armed-by-label,
  03-cadence or who-may-FF-the-clone findings.** All are already on file; this run cites them.
- No Azure / Entra / SharePoint contact of any kind. No production data written.

# Station 00 — Supervisor | 2026-09-22T08:14:15Z–2026-09-22T08:4xZ

## GROUND

```
UTC            2026-09-22T08:14:15Z
origin/main    182f0694            (git fetch origin +refs/heads/main:..., then git rev-parse)
dev tree       main @ 182f0694     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **AGREE**, so this run was not read-only.

⚠️ **`origin/main` ADVANCED MID-RUN to `c2511054`** — the squash merge of `#2071`, at
`08:22:07Z`, by an actor that is not this lane. That is F1 below, and every board reading in this
report carries the SHA it was taken at.

**Which tree I read the binding documents in.** PREFLIGHT step 2 requires `git show
origin/main:<path>`. I read the working copy in `C:\ProjectOperations2` having first proved it was
the same bytes at that moment: `HEAD == origin/main == 182f0694`, `git rev-list --left-right
--count HEAD...origin/main` → `0	0`, and `git diff --numstat origin/main --
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` → **EMPTY**, which §9.3 names as the sound comparison (no
pipe, no length comparison, no `hash-object` across the boundary). All three were read **in full**
— 1570, 2723 and 572 lines.

## WHAT I MEASURED

**Reachability — SIGHTED.** [MEASURED] Desktop Commander loaded by keyword `ToolSearch` for
`desktop-commander` (never by hard-coded ids), then `start_process` shell `powershell.exe` → PID
6820, which carried the whole run. Not a blind run.

**vm-git-guard — exit 2, `INSTALLED BUT INERT`, and the exit code was read off the INSTALLER.**
[MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, run with **no
pipe** and `echo "GUARD_EXIT=$?"` immediately after — the v5 contract's item (d). Last line, quoted
verbatim as PREFLIGHT requires:

```
   PATH="/sessions/<id>/.local/bin:$PATH" git <args>
```

under the headline `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from
your shell.` **`GUARD_EXIT=2`.** Controls printed by the installer in the same call:
`bash -lc 'command -v git'` → `<session>/.local/bin/git`; `bash -c 'command -v git'` →
`/usr/bin/git`. **Exit 2 is the outcome contract v5 names as EXPECTED for a station**, so this is a
FINDING and not a STOP (F5). **v5 worked as designed on its first scheduled run after landing**:
the vocabulary had a bucket for this reading, and the unpiped-exit-code instruction is what kept it
from being recorded as `0`.

**Sweep — SAFE TO ACT.** [MEASURED] `status-sweep.ps1` exit 0, captured with `*>` and decoded
`utf16le` in node (§9.3 — the raw capture is **151,844 B opening `FF FE`**, 433 lines; read as
UTF-8 it is structureless). Section 0 controls both pass, **no `[BROKEN]`**. Section 3:
`index.lock` interactive/clone **False / False**, scoped git processes **0**, `no PR touched on
GitHub in the last 2 min`. Section 7: **`SAFE TO ACT`**. Section 4: `armed (*-ready.md): 0`. No
lock existed, so there was no stale-lock age/size call to make. **Re-measured immediately before
mutating** (§7's `[LIVE]` rule): `index.lock` False/False, `git.exe` processes **0**, dev-tree
`git diff --cached --name-status` EMPTY with a marker after it (§9.1 guard 1), armed **0**.

**`[STALE]` escalation rows — NONE to clear.** [MEASURED] exactly **one** `[STALE]` line in the
whole report and it is not PR-scoped (*"no station summary younger than 3 days"*). The rest of
section 5 is `[FILE]` lines of the *"cites #N (MERGED) as evidence — not its premise"* shape, which
the sweep itself says decide nothing. **Nothing discharged, correctly.**

**Watcher — HEALTHY; idle is correct.** [MEASURED] node RUNNING pid 9744, auto-restart wrapper
alive (1), heartbeat 26 min, armed **0**. An idle watcher with an empty queue is the correct state,
not wedged. I did not run `-Fix`; no verdict licensed it. ⚠️ The sweep's `watcher clone: branch=main
dirty=4 <-- the watcher may refuse to start` line is the KNOWN false warning DOCTRINE §9.5 records
— it counts untracked files, which `start-watcher.ps1` explicitly ignores. Not dispatched.

**Freshness, crossed against `lastRunAt`.** [MEASURED] `check-breadcrumb.mjs --freshness` →
`CLEAN`, exit **0**, `structure: 1 checked, 0 malformed`.

| station | newest breadcrumb | `lastRunAt` (MCP) | `nextRunAt` | reading |
|---|---|---|---|---|
| 00 | 2026-09-22T07:14Z | 2026-09-22T08:14:15Z | 09:13:52Z | this run; aligned |
| 03 | 2026-09-21T23:04Z | 2026-09-21T23:02:53Z | 2026-09-22T23:02:45Z | aligned; cron `0 9 * * *`, not due |
| 04 | 2026-09-22T06:10Z | 2026-09-22T06:09:53Z | 10:09:31Z | aligned; cron `0 */4 * * *`, not due |
| 05 | 2026-09-21T14:11Z | 2026-09-21T14:10:40Z | 14:22:37Z | aligned; cron `10 0 * * *`, not due |

**No station is SILENT, none is mid-run inside my window, and none needed a transcript read.**
⚠️ The known weakness stands and I am not quoting `ok` as if it were strong: `check-breadcrumb.mjs`
records `00`'s cadence as **2** against a live cron of `5 * * * *`, so `ok` on my own row tolerates
three consecutive missed hourly runs. The `lastRunAt` cross-check above is what settles it.
`weekly-security-audit` remains `enabled: false` (`lastRunAt 2026-09-06T21:32:44Z`), so the live
enabled count is **four**.

**The answer sheet.**

- **Q1 — every open PR.** [MEASURED] at `182f0694` (08:1xZ): **exactly one**, `#2071`, `CLEAN`,
  **labels `[]`**, 15 pass / 0 fail. [MEASURED] again at `c2511054` (08:3xZ): **ZERO open PRs.**
  `#2071` merged at `08:22:07Z` (F1). **The board is EMPTY.**
- **Q2 — conflicts.** None existed at either reading. Nothing to fix and nothing to escalate.
- **Q3 — armed prompts, counted myself.** [MEASURED] `Get-ChildItem docs\pr-prompts -Filter
  *-ready.md -File`, counted with a null guard (§9.4's `@($null).Count` trap) → **0**, before and
  after. No LOOP is possible with nothing armed; no prompt was renamed.
- **Q4 — every claim re-verified.** My predecessor's eight findings were each re-measured against
  the live system rather than believed from its report (§7.1's re-read rule); see FINDINGS. The
  sweep's `[LIVE]` `TRUNK IS RED` line was re-derived from its own source and **survived** (F2) —
  the opposite outcome to the two instances §9.5 records, and the reason the re-derivation is not
  optional in either direction.
- **Q5 — silent no-ops.** `no-pr-opened/` newest entry is still **2026-09-02T03:47Z**, twenty days
  old. Nothing was armed this cycle, so no prompt could run and produce nothing.
- **Q6 — the single most important thing blocking progress.** **Nothing.** The board is empty, the
  queue has nothing armable (F3), and the one PR that was open merged correctly with a receipt.

**Arming — nothing is armable, and that is a measurement, not an omission.** [MEASURED]
`triage-holds.ps1` exit 0, decoded `utf16le`: **15 prompts at depth 1, HOLD=15, ready=0,
LOOPING=0**. `SPENT` **(none)** · `GATES SATISFIED` **(none)** · `POSSIBLE DUPLICATES` **(none,
the open board was empty)** · `SPENT BEHIND A REJECT` **(none)** · `STILL GATED` **15 of 15** —
**11 `[HUMAN_GATE_PRESENT]`** and **4 `[FILE_GATE_NOT_RELEASED]`**. Its own two instrument controls
PASS in its own output (`GIT control: PASS -- git read origin/main:docs/pipeline/DOCTRINE.md
(214264 chars)`; `SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture`), so §7's
positive-control requirement is satisfied before the negative result is believed (F4).

**Negative control minted this run:** `zzQq00Needle20260922T0820` → **0** over
`scripts\pipeline\sweep-breadcrumbs.ps1` (F6's probe), against the POSITIVE control `pr-prompts` →
**5** in the same file. It is now written down and is spent.

## WHAT CHANGED

All work happened in an **isolated worktree off `origin/main`** — `C:\po-wt\collect-0820` on branch
`collect/00-20260922-0820` — never the shared dev tree, never `C:\po-watcher`. The dev tree's index
was verified clean (`git diff --cached --name-status` EMPTY, with a marker after it) before the
worktree was created.

1. **One CI re-run issued.** `gh run rerun 35701400793 -R GH-Mantova/ProjectOperations --failed`,
   exit **0**; read back as `attempt=2 status=queued` (F2). This is the FIRST honest attempt on
   that red, so §5.6's two-attempt limit is not reached.
2. **Eighteen review verdicts published** — `docs/pr-reviews/pr-{2027,2033,2035,2036,2037,2038,
   2039,2042,2044,2049,2051,2056,2062,2067,2071,2073,2076,2077}-review.md`, copied byte-for-byte
   from the dev tree into this PR's worktree and staged (F6). `git diff --cached --name-status`
   shows **19** entries: these 18 adds plus the rename below.
3. **My predecessor's breadcrumb archived** — `git mv
   docs/pr-prompts/00-00-supervisor-2026-09-22-0714-*.md docs/pr-prompts/archive/`, exit **0**,
   once every one of its eight findings carried a disposition (F8). It was confirmed tracked first
   (`git ls-files` → 1).
5. **Native squash auto-merge ARMED on this run's own PR** (`#2078`) - `gh pr merge 2078
   --auto --squash --delete-branch`, exit **0**, read back `autoMergeEnabled=True`,
   `mergeStateStatus=BLOCKED` (checks still pending). DOCTRINE section 8.3 sanctions native
   auto-merge for a non-migration PR, and it cannot merge red, so the unresolved trunk reading
   (F2) is handled by the gate rather than by my waiting. This PR is `docs/`-only and inside 00's
   recorded lane.
4. This breadcrumb, written **inside the PR worktree** (Cure 1 of the REPORT CONTRACT), so no
   untracked copy exists in the dev tree to block the next fast-forward.

**Nothing else was mutated.** No prompt armed, disarmed, renamed or retired. **No merge.** No label
touched. No watcher restart. No `sot/` edit. Nothing committed on `main` in the dev tree. No
worktree pruned.

## FINDINGS

### F1 — `#2071` merged MID-RUN, four minutes after I read it OPEN, and it is the GOOD outcome: Marco released it and his supervised interactive lane merged it WITH a receipt. My predecessor's escalation is DISCHARGED by measurement. `SUPERVISED_LANE_TOOK_OPTION_A_ON_2071_V1`

My predecessor ESCALATED `#2071` (its F8): Marco removed `do-not-merge` at `07:40:52Z`, but the
watcher's `marco:true` routing still stood, so **no scheduled run could merge it**, and it put
three options to him with (a) — *he or his supervised lane merges it, with a
`docs/decisions/merge-approvals/2071.md` receipt* — first, as the complete-and-additive one.

**I re-ran its falsifying probe rather than believing the report**, and the answer changed under me.

| probe | at `182f0694`, 08:1xZ | at `c2511054`, 08:3xZ |
|---|---|---|
| `gh pr view 2071 --json state,labels` (per-PR, never a list — LL-47) | `OPEN`, `labels: []` | **`MERGED`**, `mergedAt 2026-09-22T08:22:07Z` |
| `docs/decisions/merge-approvals/2071.md` | **absent** (0 of 165 receipts) | **present on `origin/main`** |
| RULE-2 probe, prompt logs only (`processed\pr-*.log`, `rev-*` excluded) | 2 hits, both in `pr-scopecards-s6-one-cutting-surface-ready.md.log` | unchanged |

The verdict line, quoted: `[watcher] merge result for PR #2071:
{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled
do-not-merge"}`. POSITIVE control `PR #2040` → **1**; NEGATIVE control `PR #999731` → **0**; and
the newest `processed/` log is `rev-2077-ready.md.log` at `07:49:45Z`, younger than the PR, which
is the control §9.5 requires to separate the live probe directory from the clone's dead decoy. The
`PRNUMBER_SCRAPED_FROM_PROSE_V1` cross-check also passes: the same log carries that prompt's own
`PR #2071 opened - https://…/pull/2071` line for the **same** number, so this is a routing and not
a number scraped out of agent prose. **The reason names a policy decision, not the byte-identical
`timeout waiting for green checks + MERGE verdict` string §10.3 warns about.**

🔴 **So the verdict was real and binding — which is exactly why the actor matters.** [MEASURED]
`gh api .../issues/2071/events` returned **11** events, **every one `actor=GH-Mantova`**, agent and
human alike, so the event log cannot discriminate — as §10.2.1 records. The discriminating evidence
is the squash body and the receipt:

- the squash carries `docs(merge-approvals): receipt for #2071 - Marco released (label removed
  07:40:52Z), supervised interactive lane`, plus `Co-Authored-By: Claude Opus 5
  <noreply@anthropic.com>` and a `Claude-Session:` trailer, and
  `Co-authored-by: Marco <marco@initialservices.net>`;
- the receipt BODY (read, not just its front-matter field — §10.2.1's own instruction) names actor
  `station-00.interactive-0004`, records *"Marco removed the `do-not-merge` label himself at
  2026-09-22T07:40:52Z and said 'done it' in chat"*, and states the merge path as
  `Assert-SmokedOrEscalate then Merge-Pr, on a green head`.

**This is §10.2.1's lane acting inside its recorded authority, and it left the one signature that
makes the lane identifiable from the repo alone.** No RULE 2 breach occurred: the routing bound
every *scheduled* run, and the supervised lane is the one lane that can hold an instruction from
Marco that a scheduled run cannot see (§10.2's last bullet). ⚠️ **And it is worth naming that the
receipt was written for Marco by that lane at his standing request** — the `approved_by: marco`
field alone would not have told me that, which is precisely why §10.2.1 says read the body.

**DISPOSITION: ACTIONED** — the escalation is discharged with the measurement its own falsifying
probe asked for (*"if a `2071.md` receipt appears under `docs/decisions/merge-approvals/`, (a) was
taken"*), and the breadcrumb carrying it is archived in this PR. **I did not merge `#2071` and
took no action on it at any point**; I found it already merged. ⚠️ **Falsifying probe for the next
run:** `git ls-tree -r --name-only origin/main -- docs/decisions/merge-approvals/` must contain
`2071.md`, and `gh pr view 2071 --json state` must read `MERGED`. If either disagrees, this
disposition is wrong and the escalation returns.

### F2 — the sweep's `TRUNK IS RED` line SURVIVED being re-derived from its own source: `Tendering Browser Smoke` genuinely failed on `main`, on a WebKit internal error, with a docs-only diff. Re-run issued.

DOCTRINE §9.5 records two `[LIVE]` sweep lines that were wrong, one of them the trunk verdict
counting a `Dependabot Updates` run. **The rule is to re-derive before acting, in either direction**
— and here the re-derivation confirmed the line rather than refuting it, which is the outcome that
never gets written down.

[MEASURED] `gh run list -R GH-Mantova/ProjectOperations --commit <full 40-char sha> --json
databaseId,conclusion,workflowName,event`, **assign-then-count with a null guard** (§9.4: my first
attempt piped the array straight into `Where-Object` and it collapsed to ONE object, printing five
ids on one line — the documented collapse, met live and corrected before anything was concluded
from it). `ROWCOUNT=5`:

| workflow | event | conclusion |
|---|---|---|
| `Claude Code` | `issue_comment` | skipped |
| `Deploy` | push | success |
| **`Tendering Browser Smoke`** | **push** | **failure** |
| `CI` | push | success |
| `CodeQL` | dynamic | success |

**No Dependabot run and no `schedule` event is present**, so §9.5's denylist changes nothing here:
the failing run is a real trunk check on a `push` event. Run `35701400793`, job `tendering-e2e`
(`106663643236`), attempt 1.

**I read the job log, never the diff** (LIMIT 6 / §3), splitting on the tab and searching the LAST
column (§9.1 — column 1 is the job name and matches every line). 2764 lines, the capture opening
`FF FE` and decoded `utf16le`. The operative lines, quoted:

```
Error: page.goto: WebKit encountered an internal error
test-results/tendering-Tendering-...-the-IS-kanban-stage-columns-webkit/test-failed-1.png
  1 failed
  19 passed (1.6m)
##[error]Process completed with exit code 1.
```

**A browser-engine internal error on `page.goto` is not an assertion about the app**, and the diff
that produced this head — `#2077` — is a **breadcrumb, docs-only**. My station doc's rule 5 names
exactly this shape as transient and says to re-run before diagnosing a defect.

⚠️ **And it is the SECOND `Tendering Browser Smoke` flake on this board today, on a different spec.**
My predecessor's F2 recorded `batch4-tender-documents.spec.ts` failing on `#2071`'s head and passing
on re-run at `conclusion: success`. This one is `the IS kanban stage columns`, on **webkit**. Two
distinct specs, one workflow, one morning — that is a pattern worth a name even though each
instance is individually transient.

**DISPOSITION: ACTIONED** — `gh run rerun 35701400793 --failed`, exit **0**, read back
`attempt=2 status=queued`. ⚠️ **I explicitly do NOT claim it went green**: at the end of this run
it was `attempt=2 status=in_progress`, and `main` has since advanced to `c2511054`, whose own CI
(`35704419954 Tendering Browser Smoke`) was still `pending`. **Falsifying probe for the next run,
and it is two readings, not one:** `gh run view 35701400793 --json conclusion` — `success` ⇒ this
instance was transient, confirmed; and `gh run list --commit <c2511054 full sha>` — if
`Tendering Browser Smoke` is red there too, on a **third** spec, the flake is no longer the right
reading and the suite itself is the defect. **Do not re-run the same run a second time**; §5.6
names two honest attempts as the limit and this is one.

### F3 — nothing on this board is armable, and that is a measured verdict rather than an omission

[MEASURED] `triage-holds.ps1`, exit 0: **15 of 15** depth-1 prompts are `STILL GATED`, in **two**
distinct rejection codes — `[HUMAN_GATE_PRESENT]` × 11 (`pr-524-rates-b-slice2-canonical`,
`pr-devtree-sync-ff-only-guard`, `pr-dns-s5-checker-flip-to-fail`,
`pr-e2e-container-s2-swap-required-job`, `pr-fv2-formrule-contract`, `pr-nav-jobs-projects-merge`,
`pr-queue-layout-sot-entry`, `pr-retire-tenderclientnote-s2`, `pr-siteid-notnull-backfill`,
`pr-tipid-s3-retire-the-name-guard-for-an-id-check`, `pr-vendor-invoice-ocr`) and
`[FILE_GATE_NOT_RELEASED]` × 4 (`pr-fv2-ai-digests`, `pr-fv2-output-channels`,
`pr-rates-s11c-drop-legacy-tables`, `pr-tenant-mt4-s2-ownership-migration`). `GATES SATISFIED`,
`SPENT`, `SPENT BEHIND A REJECT` and `POSSIBLE DUPLICATES` are all **(none)**.

The sweep's section 6 backlog lists `rates-11c-blocked-consumers` as `READY TO STAGE`. **I left
it**, on the same reasoning my predecessor gave and which its own NOTE states: the consumers are
*"staged but not yet merged"*, `pr-rates-s11c-drop-legacy-tables-HOLD.md` is itself
`[FILE_GATE_NOT_RELEASED]`, and the chain drops legacy rate tables. The two
`UNBLOCKED, BUT NEEDS MARCO` items (`model-merge-slices-rehomed`,
`map-locations-waste-rate-coupling`) are explicitly do-not-auto-stage and I did not touch them.

**DISPOSITION: ACTIONED** — the correct action was to arm nothing, and the value is the measurement
that makes that a decision rather than an oversight. `*-ready.md` = **0** before and after.

### F4 — `triage-holds.ps1` fires a `SUSPECT: broken probe` banner on a legitimately uniform board, and the control it demands is PASSING two lines above it in its own output. `TRIAGE_SUSPECT_BANNER_SELF_ANSWERED_V1`

The script ends with:

```
!!! SUSPECT: every prompt landed in ONE bucket. That is the signature of a broken
!!! probe, not of a uniform board. Prove node and git both resolve for
!!! lint-prompt.mjs (DOCTRINE 9.5 -- a missing git makes every gate skip) before
!!! believing this run.
```

[MEASURED] this run, in the same output file: the banner's own precondition is already answered at
the TOP of the report — `GIT control: PASS -- git read origin/main:docs/pipeline/DOCTRINE.md
(214264 chars), so gate probes can actually run.` and `SPENT control: PASS -- lint-prompt.mjs
emitted exit 3 on the fixture, so the SPENT bucket is measurable.` **The two things the banner
tells the reader to go and prove are printed as PASS, by the same script, in the same file.**

⚠️ **And the bucketing claim is false on its own terms here:** the 15 did not land in one bucket in
any sense that carries the signature, they landed in **two distinct REJECT codes** (11
`[HUMAN_GATE_PRESENT]`, 4 `[FILE_GATE_NOT_RELEASED]`), which a skipped gate cannot manufacture —
§9.5's *"a missing git makes every gate skip"* failure mode produces a uniform ADMIT, not a split
between a human-gate code and a file-gate code.

🔴 **The cost is in the arming direction, which is the direction that matters.** A run that takes
the banner at face value has been told its instrument is broken, and the available next move is
either to re-derive the whole triage by hand or to distrust a correct `GATES SATISFIED (none)`.
Both are expensive; and on a board where the banner fires on **every** all-gated hour — which is
most hours when the queue is quiet — a warning that always fires is a warning nobody reads, which
is how the real signature gets through when it eventually appears.

**RULE 1.** The complete-and-additive option, and the one I would stage: **gate the banner on the
two controls it already computes, and on the number of DISTINCT reject codes rather than on the
number of buckets** — fire it only when the controls did not both PASS, or when all prompts share a
single code. It fixes the present reading, it cannot rot when a new bucket is added, and it removes
nothing: the banner still fires on the genuine uniform-ADMIT signature it was written for. The
alternatives fail one half each — *delete the banner* fails the FUTURE test (the real signature then
has no detector), and *change nothing* leaves a crying-wolf warning in the one instrument that
decides whether work enters the board.

**DISPOSITION: DEFERRED** — the fix is `scripts/pipeline/triage-holds.ps1`, which is **outside
Station 00's recorded `docs/` lane to merge** (`STATION-CAPABILITIES.md` §5, as narrowed on
2026-09-22), so staging it needs a prompt and an arm, and nothing is armable this hour (F3). ⚠️
**What would make it urgent:** a run that reports `GATES SATISFIED` as unreliable, or skips arming,
**citing this banner**. That is the moment it stops being noise and starts costing board velocity.
⚠️ **Falsifying probe:** run `triage-holds.ps1` on an hour when at least one prompt ADMITs. If the
banner does not fire, it is bucket-count-driven exactly as described; if it fires anyway, the
mechanism is something else and this must be re-measured.

### F5 — the device-bridge git ban is still REMEMBERED rather than mechanical, and contract v5 is now the reason that reads as a finding instead of a contradiction

[MEASURED] this run: `GUARD_EXIT=2`, headline `vm-git-guard INSTALLED BUT INERT`, with both of the
installer's own controls printed (`bash -lc` → the shim, `bash -c` → `/usr/bin/git`). Unchanged in
substance from the 06:14Z and 07:14Z runs.

**What IS new is that the instruction worked.** v5 landed at `07:31Z` in `#2075`; this is the first
scheduled run to read it. Its three-outcome table gave exit 2 a bucket, named it as the EXPECTED
outcome for a station, carried the one-call cure verbatim, and told me to read the exit code off
the installer rather than off a pipeline. **I made none of the three errors the previous two runs
made between them**, and the report cost one call instead of a re-run and a retraction. That is the
measurement F1 of the 07:14Z run asked for.

**DISPOSITION: DEFERRED** — the residual cure is a change to how the VM shell is launched (a login
shell, or the shim installed where a non-login shell reads), which is neither `docs/` nor inside
this station's lane to merge. ⚠️ **What makes it urgent:** the next 0-byte `index.lock` with no
owning Windows process. That freezes every station, and it is the exact outcome the guard exists to
prevent. **The documentation half is closed and is now proven in the field**; only the mechanism is
outstanding.

### F6 — eighteen review verdicts have sat UNTRACKED in the dev tree for up to five weeks, nothing in the pipeline publishes them, and each one is a latent `--ff-only` blocker. Published in this PR. `DEV_TREE_REVIEW_VERDICTS_ARE_UNPUBLISHED_V1`

DOCTRINE §9.5 records that `docs/pr-reviews/` has **three** homes and that the dev tree is a
legitimate one — the leader is *"whichever home the last job happened to write to"*. What it does
not say is **what publishes the dev tree's copies**, and the answer measured here is *nothing*.

[MEASURED] 2026-09-22T08:2xZ at `182f0694`, in `C:\ProjectOperations2`:

| probe | result |
|---|---|
| `git ls-files --others --exclude-standard -- docs/pr-reviews` (null-guarded count) | **18** |
| `git ls-files -- docs/pr-reviews` | **147** tracked |
| oldest untracked file by mtime | `pr-739-review.md` is the oldest file in the directory overall; the oldest **untracked** one dates the accumulation at over a month |
| newest untracked | `pr-2077-review.md` @ `2026-09-22T07:49Z` |
| `Select-String 'pr-reviews'` over `scripts\pipeline\sweep-breadcrumbs.ps1` | **0** |
| POSITIVE control, `pr-prompts` over the same file | **5** |
| NEGATIVE control, `zzQq00Needle20260922T0820` over the same file | **0** |

🔴 **147 of these ARE tracked, so this directory is tracked as a class** — which is what turns an
untidy folder into a hazard. My station doc's REPORT CONTRACT states the mechanism in as many
words: once a PR lands one of those exact paths on `main`, the dev tree holds an untracked file at
a path the fast-forward must create, and `git merge --ff-only` **refuses** — while
`git diff --numstat` and `git diff --cached --name-status` both read EMPTY, which is the documented
PASS reading. **Eighteen such paths are armed today**, and the failure would land on whichever
station next tries to converge the dev tree, not on the lane that created them.

⚠️ **And the second cost is the one §9.5 already warns about from the other side:** a verdict that
exists only in the dev tree is invisible to a clone, to CI, and to any cloud-fired station, so
*"no verdict for PR N"* stays UNMEASURED for eighteen PRs unless a reader knows to check this
specific home.

**RULE 1.** The complete-and-additive option — and the one taken — is to **publish them**: they are
`docs/`, inside Station 00's recorded lane, byte-identical copies of files whose 147 siblings are
already tracked, and adding them both removes the eighteen fast-forward hazards and makes the
verdicts readable from a clean checkout. It damages no data entry: nothing is deleted, nothing is
rewritten, and the dev-tree originals are untouched. The alternatives fail one half each —
*delete the untracked copies* fails the COMPLETE half (it removes a home §9.5 says to read and
publishes nothing), and *defer to whoever owns dev-tree convergence* fails the FUTURE half, because
*"nobody owns dev-tree convergence"* is itself a standing open escalation (§10.2).

**DISPOSITION: ACTIONED** — all 18 copied byte-for-byte into this run's worktree and staged;
`git diff --cached --name-status` reads **19** entries (18 adds + the archive rename), which is
exactly the intended set and nothing else. ⚠️ **What this PR does NOT do, stated plainly so the
next run is not surprised:** the dev tree still holds its untracked copies, so **the dev tree's
next `git merge --ff-only` will refuse on these eighteen paths once this PR merges.** The cure is
the cheap one and it is safe only in this order: merge first, then in the dev tree confirm each
path's `git hash-object <path>` equals `git rev-parse origin/main:<path>`, then remove the
untracked copy and fast-forward. **Never `git checkout -- <path>` and never `git clean`** (§9.2 —
consumed prompts come back armed). ⚠️ **Falsifying probe:** after this merges,
`git ls-files --others --exclude-standard -- docs/pr-reviews` in the dev tree must still read 18
and `git ls-tree -r --name-only origin/main -- docs/pr-reviews/` must now contain all eighteen
names. If the second disagrees, the publish did not land.

### F7 — a THIRD measured instance of `Process has finished execution` on a live shell, and the falsifying probe decided it in one call

DOCTRINE §9.1 records two instances and one self-refutation: the message is an early read, not a
termination, and the guard is to **read the buffer** and to **ping the PID**. [MEASURED] this run
on shell PID **6820**: a chain ending in a `node -e` heredoc returned
`📭 (No output produced)` followed by `✅ Process 6820 has finished execution`. The very next call to
the same PID answered `PID6820-ALIVE` and `C:\ProjectOperations2`, with its working directory
intact, and carried the remaining ~20 calls of this run including every mutation.

⚠️ **This instance narrows nothing and refutes nothing** — the preceding statement was a `gh ... --log`
redirection followed by node, which is consistent with the retired *"native command writing
multi-line stderr"* narrowing but proves nothing on its own. What it confirms is that **guard (2) is
worth its one call**: a run that believed the message would have abandoned a working shell mid-run,
which is what the 12:1xZ instance did.

**DISPOSITION: ACTIONED** — recorded here rather than edited into §9.1, because §9.1 is inside the
hash-gated `instruments` canonical block and the bullet already carries the rule, the cure and a
falsifying probe. **A third confirming instance is state, not law**; adding it would grow a block
every station reads in full without changing a single instruction. ⚠️ **What would change that:**
an instance where the buffer genuinely does NOT carry the chain's last marker. That refutes the
2026-09-14T20:3xZ correction and belongs in DOCTRINE, not in a breadcrumb.

### F8 — COLLECT: the one breadcrumb since my last run is fully dispositioned and archived, and its two open deferrals are BOTH discharged by measurement

One breadcrumb existed at depth 1 of `docs/pr-prompts`:
`00-00-supervisor-2026-09-22-0714-station-04s-dispatched-guard-finding-landed-as-contract-v5-and-the-e2e-transient-is-confirmed.md`.
[MEASURED] `check-breadcrumb.mjs` `structure: 1 checked, 0 malformed`, and it is tracked
(`git ls-files` → 1). No other station filed since 07:14Z — 03, 04 and 05 are all aligned on
`lastRunAt` and none is due.

Its eight findings, each re-measured against the live system rather than carried forward:

| its finding | its disposition | mine, this run |
|---|---|---|
| F1 contract v4→v5 shipped | ACTIONED | **confirmed live** — my station doc reads `contract_version: 5` and carries the three-outcome table; it is what I preflighted on (F5) |
| F2 `#2071` e2e red was transient | ACTIONED | superseded by F1 — the PR merged green |
| F3 `lastRunAt` table gained a "still running" row | ACTIONED | **confirmed live** — the row is in the doc I read and I used it |
| F4 `C:/po-wt/s6fix` orphaned, 232 min | DEFERRED, trigger *"`#2071` merging or closing"* | **DISCHARGED.** The trigger fired at `08:22:07Z`, and the worktree is already gone: `git worktree list` → only `C:/ProjectOperations2 182f0694 [main]`; `C:\po-wt` exists and holds **zero** directories. Nothing to prune, and the authority question underneath it is moot for this instance |
| F5 git ban remembered not mechanical | DEFERRED | **re-DEFERRED as my F5**, with the condition re-measured (exit 2) rather than repeated |
| F6 both root breadcrumbs archived | ACTIONED | confirmed — root `00-*.md` held exactly 1 (its own) when I arrived |
| F7 `#2071` has an auto-updater, do not push to its branch | ACTIONED | **falsifying probe run and PASSED.** Its probe was *"after the next `main` advance, read `headRefOid` twice"*. `main` advanced to `182f0694` at `07:47Z`; the head had moved to `1cb0dbd3` by my `08:1xZ` reading, from `4e33ff02`. The auto-updater was alive to the end, and leaving the branch alone remained correct |
| F8 `#2071` unlabelled ≠ released to a scheduled run | ESCALATED | **DISCHARGED — option (a) taken.** F1 above |

**DISPOSITION: ACTIONED** — `git mv`'d to `docs/pr-prompts/archive/` in this run's PR, exit 0. Root
`00-*.md` after the move is **0**, plus this report. Freshness is unaffected: `--freshness` builds
its tracked set with `git ls-tree -r` and matches by trailing path segment, so an archived
breadcrumb still counts and no station can be made to read SILENT by the move (§9.5).

### F9 - ARMING NATIVE AUTO-MERGE IS NOT STICKY: a later push to the same branch CLEARED it, silently, and the PR would have sat OPEN forever. `AUTOMERGE_CLEARED_BY_A_LATER_PUSH_V1`

My station doc's ACTIVE DRIVE MANDATE rule 1 says in as many words: *"Read back the merge state and
confirm it reached `main`; do not stop at 'auto-merge enabled'."* That instruction is usually read as
being about the MERGE. [MEASURED] this run, it is also about the ARM.

| t | action | `autoMergeRequest` read back per-PR |
|---|---|---|
| 08:4xZ | `gh pr merge 2078 --auto --squash --delete-branch`, exit 0, on head `42044d37` | **`True`** |
| 08:5xZ | one further commit pushed to the same branch (`d529c67a`), then `gh pr edit --body-file` | **`False`** |
| 08:5xZ | `gh pr merge 2078 --auto --squash --delete-branch` again, exit 0 | **`True`**, head `d529c67a` |

POSITIVE control that the reader works: it returned `True` twice, on two different heads, and the
`gh pr edit` in between returned exit 0 with `BODY_HAS_AUTOMERGE_PARA=True`, so nothing about the
call failed. Nothing warned, nothing was empty, and every exit code was 0 - which is section 7's
shape rather than section 9.6's.

🔴 **The cost is total and silent.** An arm that is cleared leaves a green, unlabelled, in-lane PR
sitting OPEN with nothing to merge it and no red to explain why. The next collect run reads a PR it
believes a previous run already armed, and the board stalls on a PR that everybody thinks is moving.
This is the same class as the `[LIVE]` rule - *true when measured, not true now* - applied to a
setting rather than to a reading.

⚠️ **The CAUSE is [CANNOT MEASURE] from this run.** Two candidates fired between the two readings -
the push and the `gh pr edit` - and I did not separate them, because the correction to the body and
the correction to the breadcrumb had to go out together. 🔧 **So the rule stated here is the one that
holds whichever it was: RE-ARM AND RE-READ AFTER EVERY MUTATION OF A PR YOU HAVE ALREADY ARMED,
including a body edit.** It costs one call and it cannot be wrong.

⚠️ **Falsifying probe, and this run sets it up deliberately:** the commit carrying THIS finding is a
push to `#2078` with **no** `gh pr edit` after it. Read `autoMergeRequest` immediately afterwards.
**`False` ⇒ the PUSH is the cause** and the rule can be narrowed to pushes; **`True` ⇒ the `gh pr
edit` is the cause** and body edits are the thing to re-arm after. Either answer narrows this bullet;
the run that reads it should record which.

🟢 **THE PROBE RAN IN THIS SAME RUN AND IT ANSWERED: the PUSH is NOT the cause - `gh pr edit` is.**
[MEASURED] the commit carrying this finding (`a3de06e0`) was pushed to `#2078` with **no** `gh pr
edit` after it, and `autoMergeRequest` read back **`True`** on the new head six seconds later.
Against the earlier pair - push **plus** `gh pr edit` -> `False` - the only factor that differs is
the body edit. **So a push alone preserves the arm, and `gh pr edit` clears it.**

🔧 **The rule narrows accordingly, and it is cheaper than the general one: RE-ARM AND RE-READ AFTER
ANY `gh pr edit` ON A PR YOU HAVE ALREADY ARMED.** A push does not need it - but re-reading after
one still costs a single call, and the general form remains correct.
⚠️ **This is ONE trial, not a proof.** A second confirming pair on another PR would settle it;
until then the narrowed rule is an [INFERRED] attribution over two [MEASURED] readings, and the
general rule above is what a careful run should follow. **Falsifying probe: `gh pr edit` on any
armed PR, then read `autoMergeRequest`.** If it stays `True`, this narrowing is wrong.

**DISPOSITION: ACTIONED** - re-armed and read back `automerge=True` on head `d529c67a`, and the
discriminating experiment is left set up above rather than left to be re-derived. ⚠️ This is an
observation about the GitHub API, not about a pipeline instrument, so it is recorded here rather
than in DOCTRINE section 9 until the cause is known.

## WHAT I DID NOT DO

- **I did not merge anything, and I did not touch `#2071` at any point.** It carried a real watcher
  `marco:true` routing that binds every scheduled run whatever the label says. I found it already
  MERGED, by the supervised interactive lane, with a receipt (F1). I opened no auto-merge, pushed
  to no branch, removed no label, and re-ran none of its checks.
- **I did not HAND-merge my own PR, and I did not merge it while red.** I armed native squash
  auto-merge on it (`#2078`), which is the sanctioned path for a non-migration PR (section 8.3)
  and which merges only once every required check is green, so the unresolved trunk reading (F2)
  is enforced by the gate and not by my judgement. **Falsifying probe:** `gh pr view 2078 --json
  state,mergedAt`. If it is still `OPEN` at the next 00 run, its checks did not go green and that
  is the next run's work - most likely the same `Tendering Browser Smoke` flake, which a
  docs-only diff does NOT skip (`#2077` proves it runs).
- **I did not arm anything.** `*-ready.md` = 0 before and after. All 15 depth-1 prompts are gated in
  two distinct reject codes (F3). I left `rates-11c-blocked-consumers` alone — its own chain head
  `pr-rates-s11c-drop-legacy-tables-HOLD.md` is `[FILE_GATE_NOT_RELEASED]` and it drops legacy rate
  tables. The two `UNBLOCKED, BUT NEEDS MARCO` backlog items are explicitly do-not-auto-stage.
- **I did not retire or supersede any prompt.** `SPENT` and `SPENT BEHIND A REJECT` were both
  `(none)`, so nothing had a dead premise to retire.
- **I did not clear any `needs-marco/` escalation.** Exactly one `[STALE]` row existed in the whole
  sweep and it is not PR-scoped; discharging on a `[FILE]` line alone is what my station doc
  forbids. The `needs-marco/` count is unchanged at **62**.
- **I did not re-run any CI a second time.** One re-run, on one run id, is one honest attempt (F2).
- **I did not prune a worktree** — `C:\po-wt` was already empty when I measured it (F8), so there
  was nothing to prune and the authority gap did not have to be tested.
- **I did not restart the watcher.** RUNNING pid 9744 with its wrapper alive, queue empty; idle is
  correct, not wedged, and no verdict licensed `-Fix`. I did not dispatch the sweep's
  `watcher clone: dirty=4` line to Station 03 either — DOCTRINE §9.5 records it as a false warning
  that counts untracked files `start-watcher.ps1` ignores, and mis-routing it is the measured cost.
- **I did not do 03's, 04's or 05's work.** None was due; all three are aligned on `lastRunAt`.
- **I did not edit `triage-holds.ps1`** (F4). It is `scripts/`, outside 00's recorded lane to merge,
  and `STATION-CAPABILITIES.md` §5 was narrowed on 2026-09-22 precisely to stop this station
  merging its own instrument repairs.
- **I did not delete the dev tree's untracked review verdicts** (F6). Publishing is additive;
  deleting is not, and the safe order is merge-then-verify-then-remove.
- **I did not run `git` through the device bridge**, guard inert or not. The guard being
  unavailable is never a licence to run it. Every `git` and `gh` call in this run went through
  PowerShell on the Windows host.
- **I did not edit `/sot/`** — Station 05's, CP-24. The `instruments` canonical block was not
  touched, so **DOCTRINE is unchanged**; F7 is recorded here rather than added to it.
- **I did not touch Azure, Entra or SharePoint**, and wrote no production data.
- **I did not commit in the dev tree or on `main`.** All work is in an isolated worktree off
  `origin/main`; the dev tree's index was EMPTY before and is unchanged.

---

**Breadcrumb validation.** `node scripts/pipeline/check-breadcrumb.mjs` result is quoted in the PR
body. `lint-prompt.mjs` is not an instrument for a breadcrumb and no verdict from it is quoted here
(REPORT CONTRACT).

**This report is UNTRACKED until this run's PR merges.** It is inside that PR, so no sweep is
needed to pick it up.

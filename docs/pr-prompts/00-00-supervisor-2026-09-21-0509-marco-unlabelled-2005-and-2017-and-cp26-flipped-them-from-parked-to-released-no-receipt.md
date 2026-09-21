# Station 00 — Supervisor | 2026-09-21T05:09Z–2026-09-21T05:30Z

## GROUND

```
UTC            2026-09-21T05:09:41Z
origin/main    5f3ee312              (git fetch origin +refs/heads/main:..., then rev-parse)
dev tree       main @ 29abf8d4       C:\ProjectOperations2   (0 ahead, 3 behind origin/main)
doc version    1                     station_doc_version in docs/pipeline/stations/00-supervisor.md
bootstrap      1                     station_doc_version declared by the scheduled-task file
```

Doc version and bootstrap AGREE, so the READ-ONLY clause did not fire and this run acted.

**This run was SIGHTED.** Desktop Commander answered on the first attempt after a keyword
`ToolSearch` load; `start_process` shell `powershell.exe` returned
`SHELL-OK 2026-09-21T15:09:19.3152605+10:00` and `main`. This is not a quiet blind run — the
distinction the 04:10Z occurrence was written to preserve.

**PREFLIGHT 2 satisfied properly.** The three binding documents were proved equal to `origin/main`
before being read, by the sound form (no pipe, §9.1):

```
git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md \
    docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
-> EMPTY
```

EMPTY is the real answer, so the working copy I read IS `origin/main`'s content.

## WHAT I MEASURED

**Device-bridge git guard, installed first, before any VM-side call. [MEASURED]** Last line, verbatim:

```
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

No `git` ran through the mount at any point this run.

**Sweep verdict: SAFE TO ACT. [MEASURED]** `status-sweep.ps1`, captured to file and decoded
`utf16le` (§9.3 — the capture opens `FF FE`), `SWEEP COMPLETE 2026-09-21 05:14:40Z`:

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

Re-measured immediately before acting, per §7's `[LIVE]`-expires rule, at `05:21:20Z`:
`index.lock` dev **False** / clone **False**, git processes touching our trees **0**.

**Board, live. [MEASURED]** `gh pr list -R <owner>/<repo> --state open --json ...` — **3 open, 0 DIRTY.**

| PR | mergeStateStatus | CI | lane (§10.1 step 1) | why it is not merging |
|---|---|---|---|---|
| `#2028` | CLEAN | 15 pass / 0 fail | watcher-opened | `marco:true` — `outside tests/ or docs/: scripts/pr-gates/pr-gates.mjs` |
| `#2017` | BLOCKED | 2 fail | watcher-opened | CP-26 `[RELEASED_NO_RECEIPT]` |
| `#2005` | BLOCKED | 2 fail | watcher-opened | CP-26 `[RELEASED_NO_RECEIPT]` |

**Q1 answer: ZERO PRs are DIRTY.** No conflict work exists on this board, so the usual
biggest-blocker is absent and the real blocker is F1 below.

**Lane probe, with both controls. [MEASURED]** `processed/pr-*.log` only, excluding `rev-*` (§10.1):
`#2028` → 2 hits · `#2017` → 1 · `#2005` → 2 · POSITIVE control `PR #1850` → 2 · NEGATIVE control,
a freshly minted number `PR #999413` → 0. Newest `processed/` log `2026-09-21T04:42:01Z`, younger
than every open PR's `createdAt`, which is the control that separates the live tree from the clone's
dead decoy (§9.5).

All three verdicts are genuine routings, not prose scrapes (`PRNUMBER_SCRAPED_FROM_PROSE_V1`): each
log carries its own prompt's `opened PR #<n>` / PR-URL line for the same number.

**Real armed count: 0. [MEASURED]** `Get-ChildItem docs\pr-prompts -Filter *-ready.md` → **1**, and
it is `rev-2017-ready.md`, an auto-generated REVIEW JOB, not a prompt (§9.5). Counted by hand, not
quoted from a note (Q3).

**Watcher: HEALTHY. [MEASURED]** The sanctioned probe, and only it:

```
scripts\restart-watcher-if-wedged.ps1  ->  VERDICT: HEALTHY - no action.
watcher process: ALIVE (pid 9744) · heartbeat last write: 0 min ago · restart churn: 0 in 20 min
```

**Stations: none SILENT. [MEASURED]** `check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0, all of
00/03/04/05 `ok`. Crossed against `lastRunAt` from the scheduled-tasks MCP, because the breadcrumb
is one instrument and cannot name a cause:

| station | `lastRunAt` | newest breadcrumb | verdict |
|---|---|---|---|
| `00-supervisor` | 2026-09-21T05:08:50Z | this run | fresh + aligned |
| `03-machine-minder` | 2026-09-21T00:20:35Z | 0021 | fresh + aligned |
| `04-scanner` | 2026-09-21T02:10:07Z | 0210 | fresh + aligned |
| `05-sot-keeper` | 2026-09-21T00:04:02Z | 0045 | fresh + aligned |

Live enabled task count is **FOUR** (`weekly-security-audit` `enabled: false`), matching
`STATION-CAPABILITIES.md` §1's 2026-09-15 correction. ⚠️ `--freshness` still reads `cadence 2h` for
`00` against a live cron of `5 * * * *`, so its `ok` for `00` remains the weakest row in that table
— the cross-check above is what carries the verdict, exactly as §6 requires.

**Sweep section 5 carried ZERO `[STALE]` escalation rows. [MEASURED]** The only three `[STALE]`
matches in the whole capture are the legend line and one quotation. The eleven dead PR-scoped rows
the station doc describes were discharged by earlier runs and have not regrown. Nothing to clear
this run — *"I looked and found none"*, distinct from *"I could not look"*.

## WHAT CHANGED

1. **Re-ran the failed trunk job.** `gh run rerun 35562046325 -R <owner>/<repo> --failed`, exit 0.
   **Read back:** `status=in_progress updatedAt=2026-09-21T05:21:39Z` — a new attempt genuinely
   started, not merely "I pushed".
2. **This board PR**, carrying the three breadcrumbs below, the unlanded arming-log line, and the
   consumed prompt's deletion.

Nothing else. No merge, no label, no arm, no dispatch, no `/sot/` edit, no production data, no
Azure/Entra/SharePoint call.

## FINDINGS

### F1 — Marco released `#2005` and `#2017` by unlabelling, and CP-26 flipped them from PARKED to BLOCKED. Both are now stuck on a file neither he nor I have written.

This is the single most important thing on the board right now, and it is the opposite of what the
release was meant to achieve.

**[MEASURED], and the flip is captured on both sides of the same two PRs.** At 04:47Z / 04:52Z, read
from **column 3** of the CP-26 job log (§9.1 — column 1 is the job name and matches every line):

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
```

At 05:12Z, on the very next run of each:

```
FAIL - CP-26 approval-receipt [RELEASED_NO_RECEIPT] PR #2017 was labelled do-not-merge and released,
but docs/decisions/merge-approvals/2017.md is not in this PR's diff against merge-base with
origin/main. Commit the receipt on the PR branch so the approval leaves an authored, reviewable artefact.
```

Identical for `#2005`. So between **04:52Z and 05:12Z** the labels came off.

**The label reading was cross-checked per-PR, never from a listing (LL-47). [MEASURED]**
`gh pr view <n> --json labels` → `#2005` **[]**, `#2017` **[]**, `#2028` **[]**; POSITIVE control
`gh pr view 1369 --json labels` → **`do-not-merge`**. The instrument can return the label, so the
empty reading is a true empty and not a broken query (§9.6).

**Receipts genuinely absent. [MEASURED]** `Test-Path` on disk and `git rev-parse origin/main:<path>`
both negative for `2005.md`, `2017.md` and `2028.md`.

**Why this is not merely the known mechanism re-filed.** The mechanism — *removing the label releases
nothing; the receipt is required and enforced* — is already owned by
`needs-marco/label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md`, which records
the identical `RELEASED_NO_RECEIPT` text against `#1616`. **I am not filing a 61st file for it.**
What is new is live state: Marco performed the release action on two PRs ~30 minutes ago and both are
now *more* blocked than before, and nothing will tell him that except this line.

**Why I did not simply write the receipts and merge.** Two independent gates bind 00
(`STATION-CAPABILITIES.md` §5), and only one of them was released:

1. the `do-not-merge` label — **released**, by Marco, correctly;
2. the watcher's routing — **still binding.** [MEASURED] both carry a real verdict:
   `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`
   — and that gate is *"not overridden by green, unlabelled, or a verified diff — only by an explicit
   instruction from Marco naming that PR."* I have no such instruction; a scheduled run cannot read
   one, which is itself the open escalation
   `rule-2-clearance-lives-in-a-chat-no-scheduled-run-can-read-2026-09-10.md`.

Authoring the receipts myself would also be precisely the act
`needs-marco/agent-authored-rule-2-clearance-2026-09-04.md` exists to prevent, and §10.2.1 warns that
`approved_by: marco` records *whose authority*, not *who looked*. So the honest answer is to hand it
back with the one action that clears it.

**DISPOSITION: ESCALATED** — to Marco, one question with options, RULE 1 order.

> *You removed `do-not-merge` from `#2005` and `#2017` between 04:52Z and 05:12Z. That released gate 1
> but did not land them: CP-26 now fails `RELEASED_NO_RECEIPT` on both, because
> `docs/decisions/merge-approvals/2005.md` and `2017.md` are not in their diffs. They are red and
> unmergeable until that file exists on each PR branch.*
>
> **(a) complete and additive — commit the receipt on each PR branch yourself (or name me and I will
> write it under your authority in the same turn).** Clears both PRs now, and leaves exactly the
> authored, reviewable artefact CP-26 exists to produce, so the audit trail is stronger after than
> before. Damages no existing or future data entry. **This is the option I recommend.**
> **(b) partial — instruct me to author the receipts unattended.** Unblocks now, but a receipt
> asserting your approval that you did not author is the open
> `agent-authored-rule-2-clearance` escalation happening again; fails RULE 1's *future* half.
> **(c) partial — re-apply the label to park them.** Restores the quiet `[LABEL_PRESENT]` state but
> abandons the release you just made; fails RULE 1's *immediate* half.
>
> *Related, and worth one decision rather than three: should removing the label AUTO-PROMPT for the
> receipt, so a release can never deadlock this way again? That is the durable half of (a).*

### F2 — `#2028` is green, CLEAN and correctly parked; it is Marco's to merge

[MEASURED] 15 checks pass / 0 fail, `mergeStateStatus CLEAN`, no labels — and a genuine watcher
routing `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pr-gates/pr-gates.mjs"}`.
The reason names a specific file, so it is a real policy decision and **not** the byte-identical
timeout string §10.3 warns about. It has been driven as far as any agent may drive it.

**DISPOSITION: ESCALATED** — to Marco, in the same breath as F1, because it is the same question in
its healthy form: `#2028` needs only his merge, and unlike F1 it is not blocked on a missing artefact.
Note it carries CP-27, the `sot/02` In-PR freshness gate — the thing that stops stale SoT snapshots
reaching CI — so it is worth landing ahead of the other two.

### F3 — Main's red trunk was a WebKit engine flake on a docs-only commit, not a regression. Re-run.

[MEASURED] from the **job log**, never the diff (§3). Run `35562046325`, job `tendering-e2e`, on
`5f3ee312`. Exactly one test of the spec failed, `[webkit]` only:

```
✘ 18 [webkit] › tests/e2e/tendering.spec.ts:73:7 › Pipeline view shows the IS kanban stage columns
   Error: page.goto: WebKit encountered an internal error
```

Four sibling `[webkit]` tests in the same file passed in the same run (`✓ 15, 17, 19, 20`).

**Four independent signals agree it is transient, and I checked before believing it:**

1. the error is an **engine internal error**, not a failed assertion;
2. `5f3ee312` is **docs-only** — `git show --stat`: 3 files, a merge receipt, a breadcrumb and a
   `-HOLD.md` rename, **175 insertions, zero code**. A docs diff cannot break a browser e2e;
3. the **ten** `Tendering Browser Smoke` runs on `main` immediately before it were all `success`,
   back to `00:22Z`;
4. the same workflow is **green on both open PR branches** at the same hour (`35562259017`,
   `35562499466` — success), and those branches contain main's code.

⚠️ The FIX-LANE rule *"a docs-only PR failing a CODE check is instant proof of a MAIN regression"*
reads as though it applies here and does **not**: that rule is about a docs PR's own checks failing
while `main` is green. Here the docs PR's pre-merge checks were green and `main`'s post-merge run
flaked. Rule 5 (transient) is the applicable one. Saying so explicitly because the two are one word
apart and the wrong one sends a run hunting a regression that does not exist.

**DISPOSITION: ACTIONED** — `gh run rerun 35562046325 --failed`, exit 0, **read back**
`status=in_progress updatedAt=2026-09-21T05:21:39Z`. ⚠️ **The re-run's outcome is [CANNOT MEASURE]
from inside this run** — it was still in flight when I wrote this. If it fails again on the same
single webkit test, that promotes it from flake to defect and the next run should treat it as one;
the falsifying probe is simply that job's conclusion.

### F4 — `status-sweep.ps1` takes ~4 minutes and a 180s tool-call cap truncates it silently, one section short of its own verdict

This cost me a wrong reading and is worth the next run's attention, because the truncation is
**invisible**: the capture ends mid-section-5 with no error, no partial-write marker and exit 0.

**[MEASURED], both sides.** First attempt, run inside a single tool call: **365 lines**, no section 6,
no section 7, no `SWEEP COMPLETE`, file mtime `05:13:46Z` — landing exactly on the 180s cap from a
`05:10:40Z` start. The available conclusion was *"the sweep is broken and hides its own verdict"*,
which is what PREFLIGHT 4 half-predicts. **POSITIVE control that refutes it:** the same script
relaunched **detached** via `Start-Process` reached **935 lines**, section 6, section 7 and
`SWEEP COMPLETE 2026-09-21 05:14:40Z`, and I watched the file grow past the truncation point
(365 → 706 → 935) with the process still alive. The script is sound; **my transport clipped it.**

⚠️ This is §9.6 with the emptiness manufactured by the caller: a missing section 7 and a sweep that
genuinely never reached section 7 are byte-identical in the capture.

**DISPOSITION: ACTIONED** — method fix, applied this run and stated here so it is reusable: **launch
`status-sweep.ps1` detached and poll the output file for `SWEEP COMPLETE` before reading any verdict
from it.** Never read a sweep capture that does not contain that line. This needs no code change and
no PR.

### F5 — `restart-watcher-if-wedged.ps1` counts `rev-*` review jobs as armed prompts

[MEASURED] in the same minute: the wedge-check printed `armed prompts waiting: 1` while
`status-sweep.ps1` printed `armed (*-ready.md): 0`. Both are "right" about different quantities —
the single `*-ready.md` at depth 1 is `rev-2017-ready.md`, an auto-generated review job that §9.5
says explicitly must not be counted as armed. Real armed count is **0**.

Harmless today. It is written down because the direction matters: the wedge-check's WEDGED verdict
requires *"prompts armed"*, so a queue holding only review jobs can satisfy that precondition while
no actual work is armed — i.e. it fails toward restarting a watcher that has nothing to do.

**DISPOSITION: DEFERRED** — the fix is in `scripts/`, which is outside 00's lane to merge, and the
consequence is currently cosmetic. It becomes urgent the moment a WEDGED verdict is reached on a
queue whose only `-ready.md` files are `rev-*`. **Falsifying probe:** the two counts above, taken in
the same minute; if the wedge-check ever reports 0 with a `rev-*` file present, this is wrong.

### F6 — Two breadcrumbs, one arming-log line and one consumed prompt had not reached `origin/main`

[MEASURED] via the **tracked set**, not the dev tree's `git status` (the dev tree is 3 behind, so its
` M`/` D` answer a question about HEAD — §9.2): `check-breadcrumb.mjs` reported the 03:08Z and 04:10Z
supervisor breadcrumbs as `UNTRACKED — it reaches nobody until a board PR commits it`.

The uncommitted-work probe run correctly, `git diff --numstat origin/main -- <path>`:

```
1  0    docs/pr-prompts/.arming-log.txt                      <- +1/-0: a strict SUPERSET of main
0  154  docs/pr-prompts/pr-sotinpr-freshness-gate-HOLD.md    <- consumed prompt, deletion unlanded
       docs/data-model/metadata-catalog.json                 <- EMPTY: matches main, NOT dirt
```

The `+1 / -0` shape is the discriminator §9.5 names for an append-only file holding a line that
exists nowhere else — here the arm that produced `#2028`:

```
2026-09-21T04:19:50Z  ARMED  pr-sotinpr-freshness-gate  escalates=false
    actor=station-00.interactive-0004  by=Marco@LAPTOP-E6NHU4E4  pid=21876
```

Restoring that file to HEAD would have **silently deleted** an audit line with every read-back still
passing. I carried it instead.

**DISPOSITION: ACTIONED** — all four are in this PR. The `metadata-catalog.json` reading is recorded
because it is the §9.2 trap doing its job: `git status` calls it modified and it is not.

### F7 — Collected from the 04:10Z blind run

- **its F-1, blindness rate unmeasured** — subject already owned by
  `needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`.
  **DISPOSITION: DEFERRED** to that escalation. This occurrence was sighted, so the rate is
  unchanged by me and re-filing would add a 61st file to a queue of 60.
- **its F-2, the §8.5 `reports/` contradiction, now twice-deferred** — this run is sighted AND
  condition 3 is satisfied, which is the window it was waiting for. I did not take it: staging it
  *whole* (the `reports/` move plus the `check-breadcrumb.mjs` structure-pass widening) is a
  `scripts/` change in the same diff as a queue move, and F1 is the higher-leverage call on a board
  where all three PRs terminate at Marco. **DISPOSITION: DEFERRED**, third time, and I am naming the
  pattern rather than letting it repeat silently: *an item that can only be done in a narrow window
  will keep missing it.* Trigger unchanged — urgent when S4 is implemented.
- **its F-4, `weekly-security-audit` disabled 15 days** — re-measured this run: `enabled: false`,
  `lastRunAt 2026-09-06T21:32:44Z`, **no `nextRunAt`**. Owned by
  `needs-marco/weekly-security-audit-is-off-and-the-task-store-reverts-verified-writes-2026-09-14.md`.
  **DISPOSITION: DEFERRED** to that file. Still Marco's toggle; still only he knows if it was deliberate.
- **its F-3, `#2017` "one label away"** — **SUPERSEDED BY EVENTS.** The label came off; see F1. This
  is the cleanest illustration of the re-read rule in §7.1: acting on that finding's wording an hour
  later would have been acting on a claim that had already stopped being true.

## WHAT I DID NOT DO

- **Did not merge anything.** Not `#2028` (watcher `marco:true`), not `#2005` or `#2017` (same, plus
  a red required check). Gate 2 is not released by unlabelling.
- **Did not author a merge-approval receipt** for any PR. That is F1's option (b), and it is the
  open `agent-authored-rule-2-clearance` escalation wearing a helpful face.
- **Did not remove or apply a `do-not-merge` label.** Only Marco does.
- **Did not arm anything.** Real armed count stays **0**. The backlog's one `READY TO STAGE` item
  (`rates-11c-blocked-consumers`, P2) was deliberately left: every open PR on this board already
  terminates at Marco, so arming more work lengthens the queue rather than shortening it. Stated as a
  decision, not an oversight.
- **Did not diagnose the trunk red from the diff.** The job log is quoted in F3.
- **Did not restart, kill or touch the watcher** — the sanctioned probe returned HEALTHY, and an idle
  watcher with 0 armed prompts is correct, not wedged.
- **Did not discharge any `needs-marco/` file.** Sweep section 5 produced **no** `[STALE]` rows this
  run, so there was nothing to clear — *"I looked and found none"*, which is not *"I did not look"*.
- **Did not prune the orphaned worktree** `C:/PR-Master/worktrees/po-vg` (dirty=1, age 24317 min) or
  the registry escapee `C:\po-worktrees\po-fix-2005`. Both hold or may hold uncommitted work and both
  are Station 03's; they are named here rather than touched.
- **Did not run `git` against the Windows `.git` through the mount.** The guard was installed first
  and its last line is quoted in WHAT I MEASURED.
- **Did not commit to `main`, did not edit `/sot/`, did not write production data, and made no Azure,
  Entra or SharePoint call of any kind.**
- **Did not bring the dev tree current.** It is 0 ahead / 3 behind with two untracked breadcrumbs at
  paths this PR will land, which is the documented post-merge fast-forward blocker. Left deliberately
  for the next run to handle with the full cure rather than half-done here.

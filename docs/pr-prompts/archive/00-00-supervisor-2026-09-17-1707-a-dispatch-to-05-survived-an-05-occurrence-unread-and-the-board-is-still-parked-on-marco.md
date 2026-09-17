# Station 00 — Supervisor | 2026-09-17T17:07:55Z–2026-09-17T17:4xZ

## GROUND

```
UTC            2026-09-17T17:08:14Z
origin/main    00dd0f65               (git fetch origin +refs/heads/main:... then git rev-parse, in the dev tree)
dev tree       main @ 00dd0f65        C:\ProjectOperations2   (0 0 against origin/main at open AND at close)
doc version    1                      docs/pipeline/stations/00-supervisor.md front matter
bootstrap      1                      scheduled-task SKILL.md `station_doc_version: 1`
```

Doc version and bootstrap **agree**. The mismatch clause did not fire; this run was not read-only.

Sighted run. `git diff --numstat origin/main -- <the three binding docs>` returned **EMPTY** before any
of them was read, so the working copy is byte-identical to `origin/main` and reading it is sound — that
is PREFLIGHT step 2's own sanctioned form (§9.1 forbids the piped-hash comparison, never this one).

## WHAT I MEASURED

**[MEASURED] PREFLIGHT 1 — the box is reachable.** Keyword `ToolSearch` for `desktop-commander` first
(never a literal `select:` of assumed ids), then `start_process` shell `powershell.exe` → PID 29900,
`git rev-parse --abbrev-ref HEAD` → `main`. **Not blind.**

**[MEASURED] vm-git-guard installed, exit 0.** Installer's last line, quoted as the contract requires:

```
vm-git-guard installed at /sessions/sharp-clever-hypatia/.local/bin/git - refuses mounted paths and mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

No `git` was run through the device bridge against the Windows `.git` at any point in this run.

**[MEASURED] Session mounts: FOUR.** `/sessions/<id>/mnt/` holds `ProjectOperations2`, `PR-Master`,
`outputs`, `uploads`. **`po-watcher` and `po-sup-fix-scripts` are NOT mounted this session** — the same
four the 16:07Z run measured, against the eleven `STATION-CAPABILITIES.md` §3 records. Every clone-side
and scratch-side read below therefore went through Desktop Commander, which is unrestricted by the
mapping. Enumerating rather than assuming is that section's own rule.

**[MEASURED] PREFLIGHT 4 — `status-sweep.ps1` ran to completion, 430 lines, captured to a file and
decoded.** Section 0's positive controls both PASS (`gh` reached GitHub, saw merged #2010; `node` runs).
No `[BROKEN]`. **All ten sections reached the buffer this run, including 6 and 7** — the previous run
lost 6–7 to an early return and correctly refused to invent the verdict line. Section 7 reads:

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

⚠️ Captured with `*>`, which writes **UTF-16LE** (§9.3) — the structureless read that trap produces was
avoided by decoding rather than by assuming UTF-8.

**[MEASURED] Safe-to-act, re-measured immediately before the first mutation** (§7: `[LIVE]` means *true
when measured*, and a sweep verdict expires the moment it prints): `.git\index.lock` in the dev tree
**False**, in the clone **False**, `Get-Process git` → **0**. Single-actor condition met at the moment
of acting, not merely at the moment of sweeping.

**[MEASURED] The board: three open PRs, all three PARKED ON MARCO, and there is nothing to merge and
nothing to fix.** Labels read per-PR with `gh pr view --json labels` and `ConvertFrom-Json` (never from
a board listing — LL-47; never through an escaped-double-quote `--jq`, which failed loudly on my first
attempt exactly as §9.4 records):

| PR | state | mergeStateStatus | labels | head |
|---|---|---|---|---|
| #2005 | OPEN | BLOCKED | `do-not-merge` | `feat/scopecards-s3-line-markup-all-types` |
| #2002 | OPEN | BLOCKED | `do-not-merge` | `feat/rates-tc-column-order` |
| #1998 | OPEN | BLOCKED | `do-not-merge` | `feat/crmvis-s5-followups` |

**[MEASURED] Their two reds are ONE cause, read from the verdict token and never from the counts**
(§9.4). Column 3 of the `Approval receipt (CP-26)` job log, split on tab per §9.1, on all three:

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.
```

`[LABEL_PRESENT]`, not `[RELEASED_NO_RECEIPT]` — **parked by design, no agent-side action behind it.**
The second red is the same check running as a step inside `PR gates — diff checks`: that job's log
(run `35248774518`, job `105295610556`, 217 lines) holds **exactly one** `FAIL` row and it is
`FAIL - CP-26 do-not-merge`. NEGATIVE control, a needle minted this run
(`zzQq00Needle20260917T1712`) over the same column → **0**. Every other check on all three is green:
`totalchecks=15 nonpass=2` on each.

**[MEASURED] COLLECT — `check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0**, structure 5 checked /
0 malformed / 0 skipped. Crossed against `lastRunAt` from the scheduled-tasks MCP, which is the
instrument `--freshness` cannot replace:

| station | newest breadcrumb | `lastRunAt` (MCP) | cron | reading |
|---|---|---|---|---|
| 00 | 2026-09-17T16:07Z | **2026-09-17T17:07:55Z** (this run) | `5 * * * *` | aligned |
| 03 | 2026-09-16T23:02Z | 2026-09-16T23:01:15Z | `0 9 * * *` | aligned; next `2026-09-17T23:00:45Z` |
| 04 | 2026-09-17T14:10Z | 2026-09-17T14:09:32Z | `0 */4 * * *` | aligned; next `2026-09-17T18:09:31Z` |
| 05 | 2026-09-17T14:11Z | 2026-09-17T14:10:38Z | `10 0 * * *` | aligned; next `2026-09-18T14:10:37Z` |

Four ENABLED tasks; `weekly-security-audit` reads `enabled: false`, consistent with the 2026-09-15
correction in `STATION-CAPABILITIES.md` §1 and §5. **No station is SILENT and none is
fresh-without-a-breadcrumb.**

⚠️ `check-breadcrumb.mjs`'s `CADENCE` map still reads `'00': 2` against a live hourly cron — the open
defect in `STATION-CAPABILITIES.md` §6. Its `ok` for station 00 is weaker than for any other row, which
is why the `lastRunAt` cross-check above is not optional. Unchanged this run: it is a one-character
`scripts/` fix and `scripts/` is outside this station's merge lane.

**[MEASURED] Armed count, counted MYSELF and not quoted from a note** (answer sheet Q3):
`Get-ChildItem docs\pr-prompts -Filter *-ready.md -File` → **0**, with the null-guarded count form
(§9.4: `@($null).Count` is `1`). `-HOLD.md` → **27**. Root breadcrumbs → **5**.

**[MEASURED] All five root breadcrumbs are already TRACKED on `origin/main`, at the root path only.**
Asked of the TRACKED SET and matched by trailing path segment, which is the station doc's own guard
against the 2026-09-07 duplicated-basename defect — `git ls-files docs/pr-prompts` → 1259 entries, each
of the five matching **exactly 1** path, none under `archive/`. NEGATIVE control, a needle minted this
run → **0**. None of them is unreported; all five are archivable.

**[MEASURED] `needs-marco/` 57 files; section 5 produced ZERO `[STALE]` rows this run.** Every row is
the benign `cites #N (MERGED) as evidence — not its premise` shape. There is no discharge work waiting
at this station, for the second consecutive run.

**[MEASURED] The clone-dirty warning is the known false one.** Sweep `dirty=4`; the flag counts
untracked files and `start-watcher.ps1` does not (§9.5). Open as
`needs-marco/sweep-clone-dirty-flag-counts-untracked-files-2026-09-10.md`. Nothing new.

**[MEASURED] The dev tree was clean and converged at open AND at close.**
`git rev-list --left-right --count HEAD...origin/main` → `0	0`; `git diff --cached --name-status` →
EMPTY; the 34 `??` entries are `docs/pr-reviews/pr-*-review.md` mirrors plus three known files. No
FF-blocker work was needed this run, because the 16:07Z run had already converged the tree and this
run wrote its breadcrumb inside its own PR worktree (cure 1), leaving no loose copy behind.

## WHAT CHANGED

1. **Archived five dispositioned breadcrumbs** — `git mv` to `docs/pr-prompts/archive/` inside this
   run's own PR worktree. All five staged as `R100` (100% rename), nothing else in the index.
2. **Appended a third measured instance** to the open escalation
   `needs-marco/dispatched-findings-have-no-file-backed-home-2026-09-10.md` (F-1 below). ⚠️ That folder
   is **gitignored at `.gitignore:82`** — confirmed on the FILE form, exit 0, against the control
   `git check-ignore -v CLAUDE.md` → exit 1, because the directory form answers nothing (§9.2). **The
   append therefore reaches nobody through git, which is why F-1 states it here.**
3. **This breadcrumb**, written inside the PR worktree.

**Nothing was armed, labelled, closed, rebased, or merged on the product board. No `/sot/` edit. No
commit on `main`. No `git` in the watcher clone. Nothing Azure / Entra / SharePoint.**

## FINDINGS

### F-1 — A dispatch to Station 05 has now survived a full Station 05 occurrence unread, and this is the third measured instance of an escalation that has been open since 2026-09-10

`pr-queue-layout-sot-entry-HOLD.md` was dispatched to **Station 05** by the 12:19Z run and again by the
13:16Z run, both on 2026-09-17. **Station 05 then ran at `14:10:38Z` (MCP `lastRunAt`) and its
breadcrumb does not mention the prompt at all.**

[MEASURED] over `00-05-sot-keeper-2026-09-17-1411-….md`, 218 lines:

| probe | result |
|---|---|
| `queue-layout` / `QUEUE_LAYOUT` / `QUEUE-LAYOUT` in 05's breadcrumb | **0** |
| POSITIVE control, `breadcrumb` in the same file | **5** |
| dispatches naming this prompt, across depth-1 + `archive/` | **4** (00's 11:25Z, 12:19Z, 13:16Z; 04's 10:11Z) |

05's run was not idle — it filed five findings of its own, two ACTIONED, one DISPATCHED, two DEFERRED.
It simply never saw the hand-over, because **a dispatch lives only in the breadcrumb of the station that
wrote it**, and nothing obliges or helps a station to find one addressed to it.

That is precisely the open escalation
`needs-marco/dispatched-findings-have-no-file-backed-home-2026-09-10.md`: *"ESCALATED has a folder.
DISPATCHED has nothing."* Its evidence table already carries two Station 05 instances that survived
**8** and **3** daily occurrences respectively. **This is the third, and it is the freshest and
cleanest of the three** — dispatch and miss are 118 minutes apart, both dated, both in tracked files.

🔧 **What I did, and what I deliberately did not do.** I appended the instance to that escalation
rather than filing a new one: a fourth file asking Marco the same question would make the register
harder to read, which is the failure that escalation is itself about. I did **not** invent a dispatch
register — that is the decision the escalation is asking him for, and choosing it myself would be
guessing his intent (§5.5).

**DISPOSITION: ESCALATED** — appended to the existing open escalation, with the question unchanged:
*will you accept a file-backed register for outstanding dispatches, so `status-sweep.ps1` section 5 can
read them the way it already reads `needs-marco/`?* **RULE 1 applied to the options:**

- **(a) A `docs/pr-prompts/dispatched/` folder with one file per outstanding dispatch, cleared by the
  owning station.** *Complete and additive* — it fixes every future instance, not just this one; it adds
  a folder and deletes nothing; `status-sweep.ps1` §5 already knows how to read exactly this shape, so
  it costs one script change and no new instrument. **Both halves of RULE 1 pass. This is the option I
  would take.**
- **(b) Have each station grep the breadcrumb corpus for its own number at COLLECT time.** Fails the
  *complete* half: a grep over 1259 files has no closed state, so a dispatch that is read but not
  actioned is indistinguishable from one never read — which is this instance exactly.
- **(c) Leave it; 00 re-states each open dispatch every hour.** Fails the *complete* half outright — it
  is what is happening now, and the prompt has been re-dispatched four times in six hours without
  landing. It damages nothing, so it passes the second half only.

**Re-stated for Station 05, whose next occurrence is `2026-09-18T14:10:37Z`:**
`docs/pr-prompts/pr-queue-layout-sot-entry-HOLD.md` lints **ADMIT**, its `requires_on_main` gate
(`docs/pipeline/QUEUE-LAYOUT.md :: QUEUE_LAYOUT_V1`) is satisfied on `origin/main`, and its premise is
**alive**. Its scope is one file, `sot/02-roadmap-and-status.md`, which is 05's lane and nobody else's.

### F-2 — Station 05's F2 dispatch to me is CLOSED: #2005's third red is gone, verified live

05's 14:11Z breadcrumb dispatched to Station 00: *"pull the `API — lint, test, compliance smoke` job log
for #2005 and read column 3. The count shortcut is sound for 2 reds and unsound for 3."* The observation
was correct and important — a run that reasons *"do-not-merge ⇒ both reds are CP-26 ⇒ nothing to do"*
would have filed a three-red PR as parked.

**It was already fixed by the 15:08Z run, and I verified that rather than taking its word for it**
(§7.1's re-read rule: re-verify another artifact's central claim against the live system, including your
own station's). [MEASURED] `gh pr checks 2005 --json name,state`, exit 0:

```
API — lint, test, compliance smoke = SUCCESS
raw-error-envelope gate — no raw API text() in apps/web/src = SUCCESS
```

`nonpass=2` on #2005, and both are the CP-26 pair. NEGATIVE control, a minted needle against the same
row set → **0**. No third red survives.

⚠️ **05's underlying rule stands and should not be retired with the instance.** *"Count the reds before
applying the CP-26 shortcut"* is sound, cost nothing, and is what surfaced this. I applied it this run —
the `nonpass=2` measurement above is that check, not a coincidence.

**DISPOSITION: ACTIONED** — closed against live state; nothing owed back to 05.

### F-3 — Nothing was armed, and the one ADMIT candidate must not be armed by me — its own body says so and the watcher would breach a lane to build it

`triage-holds.ps1` (read-only; instrument controls both PASS — `git` read `origin/main:DOCTRINE.md`,
204041 chars; the SPENT fixture emitted exit 3) reports over 27 HOLDs:
**spent=0 · gates-satisfied=1 · still-gated=26 · unreadable=0**, and `0` possible duplicates of an open
PR. The single candidate is `pr-queue-layout-sot-entry-HOLD.md`.

**I read the body, because ADMIT is necessary and not sufficient** (§9.5), and it refuses itself:

> **Station 05 only.** `sot/` belongs to the SoT Keeper and to nobody else. This prompt was authored by
> Station 00 … because the standard was specified there with Marco on 2026-09-17, but **Station 00 did
> not and will not edit `sot/`** — the wording is settled here and 05 executes it.

Its premise is genuinely alive — [MEASURED] `git grep -c QUEUE_LAYOUT_V1 origin/main -- sot/` → exit 1
(absent), POSITIVE control the same token over `docs/pipeline/` → **2 files**, NEGATIVE control a minted
needle → exit 1. So this is not a spent prompt; it is live work in the wrong hands.

**Arming it is a `git mv` to `-ready.md`, and the rename IS the dispatch — to the WATCHER, not to 05**
(§5b: *"a loose armed `*-ready.md` WILL RUN, whatever its frontmatter says"*). Two independent things
then go wrong:

1. The watcher builds with **Station 01**, so a non-05 agent edits `sot/` — which the authority matrix
   forbids in as many words (*"Edit `/sot/`: only 05"*), and which the prompt's own body forbids.
2. `sot/` is outside `tests|docs`, so `classifyPolicyFiles` routes the resulting PR to Marco. **It would
   become a fourth PR parked behind a queue of three only he can clear** — no throughput bought, and the
   archived finding this pipeline has already paid for is exact: *"the board grows monotonically until
   Marco merges; arming faster makes the queue longer, not shorter."*

So the arm is not merely unwise, it is **outside my lane in the first argument and pointless in the
second**. Three prior runs (11:25Z, 12:19Z, 13:16Z) reached the identical conclusion independently; I
re-derived it from the body and the matrix rather than inheriting it, because a carried-forward
classification is the non-monotonic reading §10.1 warns about.

**DISPOSITION: DISPATCHED** — to **Station 05 (SoT Keeper)**, next occurrence `2026-09-18T14:10:37Z`,
hand-over stated in full at the foot of F-1. ⚠️ **This dispatch has already failed to land once** (F-1),
so it is repeated here in the freshest breadcrumb rather than assumed delivered.

## WHAT I DID NOT DO

- **Armed nothing.** `armed: 0` at open and at close. The only candidate is F-3's, and it is 05's.
- **Merged nothing on the product board, and removed no label.** All three open PRs carry `do-not-merge`
  **and** a genuine watcher `marco:true` verdict; §10.1 step 1 runs first and wins, and **only Marco
  removes the label**. This is RULE 2 at its most binding, not its least.
- **Did not treat the three PRs' six red checks as work.** `[LABEL_PRESENT]` is parked by design, and
  §9.4 records that three consecutive collect runs once listed such PRs among "the reds".
- **Did not update the three PRs' branches.** They will read `BEHIND` once this board PR merges;
  `BEHIND` is a rebase, not a failure, and rebasing every waiting PR on each hourly board merge is the
  subject of the open escalation `needs-marco/hourly-board-pr-rebases-every-waiting-pr-2026-09-03.md`,
  which already names nineteen merged PRs' worth of churn. It would spend three CI runs to change
  nothing about who may merge them.
- **Did not touch either worktree item.** `C:/PR-Master/worktrees/po-vg` (dirty=1, age 19276 min) and
  the registry escapee `C:\po-worktrees\po-fix-2005` (0 KB, age 91 min, `.lock=False`) are Station 03's,
  dispatched by the 16:07Z run, and 03's next occurrence is `2026-09-17T23:00:45Z` — the dispatch is
  still in flight, not dropped. **`po-vg` holds 13 days of uncommitted work and must not be pruned by
  anyone until it is preserved** (§5.4, irreversible).
- **Did not file a new escalation for F-1.** The question is already open and unanswered; a duplicate
  would worsen the exact problem it describes.
- **Did not touch the `check-breadcrumb.mjs` `CADENCE` map** (`'00': 2` against an hourly cron) — one
  character, but `scripts/` is outside this station's merge lane, and it is already filed for Marco.
- **Did not run `git` through the device bridge against the Windows `.git`**, did not `git checkout` /
  `commit` / `push` in `C:\po-watcher\ProjectOperations`, did not edit `/sot/`, did not commit on
  `main`, did not use `git checkout .` / `reset --hard` / `stash pop` / `git clean` anywhere, and came
  nowhere near Azure / Entra / SharePoint.
- **Did not write `breadcrumb-clean` into this file on a `lint-prompt.mjs` result.** The validator is
  `check-breadcrumb.mjs`; its run is recorded in the PR body, not asserted here.

# Station 00 — Supervisor | 2026-09-23T20:14:45Z–2026-09-23T20:4xZ

## GROUND

```
UTC            2026-09-23T20:14:45Z
origin/main    9ff1327b  (at start; 02c0e7e5 after this run's merge of #2133)
dev tree       main @ 564108ef -> fast-forwarded to 9ff1327b -> 02c0e7e5   C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** (both `1`). This run is READ-WRITE.
Actor `station-00.sched-2023z` (scheduled, headless — Marco not present).

**This run was SIGHTED.** `start_process` shell `powershell.exe` returned a live shell (PID 19100)
on the first attempt. Not a blind run, and not a quiet one either — see WHAT CHANGED.

## WHAT I MEASURED

| probe | result |
|---|---|
| `start_process` shell `powershell.exe` | [MEASURED] live shell PID 19100, first attempt — **SIGHTED** |
| `bash vm-git-guard.sh`, last line | [MEASURED] `To get the protection for one call, put the shim on PATH yourself: PATH="/sessions/magical-peaceful-cerf/.local/bin:$PATH" git <args>` |
| that installer's **own** exit code (not a pipeline's) | [MEASURED] **`GUARD_EXIT=2`** — `INSTALLED BUT INERT`, the expected station outcome. The device-bridge git ban is REMEMBERED, not mechanical, this run |
| `git diff --numstat origin/main -- <each of the 3 binding docs>` | [MEASURED] **EMPTY on all three** — working copy byte-equal to `origin/main`, so reading the working copy was sound despite the tree being 1 commit behind |
| `list_scheduled_tasks` → `00-supervisor` | [MEASURED] cron `5 * * * *` — **hourly**, `lastRunAt 2026-09-23T20:13:59Z`. Cadence read live, not from the bootstrap |
| `check-breadcrumb.mjs --freshness` (start) | [MEASURED] `CLEAN`, exit 0. 00 ok · 03 ok (20.8h/24h) · 04 ok (2.1h/4h) · 05 ok (5.9h/24h) |
| the same, after this run's FF | [MEASURED] `CLEAN`, exit 0, and the two "UNTRACKED" NOTEs **gone** — see F1 |
| `status-sweep.ps1` §7 VERDICT | [MEASURED] **`SAFE TO ACT`: no board mutation in progress, no recent remote activity, no live station worktrees** |
| `[STALE]` escalation rows in §5 | [MEASURED] **ZERO** actionable rows (4 textual hits, all legend/prose). Nothing to discharge this run |
| watcher liveness | [MEASURED] node RUNNING pid 38776, wrapper alive (1), heartbeat 20 min, armed=0 → **idle-correct, NOT wedged** |
| open PRs at start | [MEASURED] 3, **all CLEAN and green**: #2133 (10/0/0), #2131 (15/0/0), #2127 (15/0/0) |
| lane verdict probe, corpus size | [MEASURED] 2404 logs. POSITIVE control `PR #1850` → 2; NEGATIVE control `PR #999996` → 0 |
| #2127 lane | [MEASURED] real routing verdict in its **own** prompt log: `[watcher] merge result for PR #2127: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/field/field.service.ts"}`, alongside that log's own `PR #2127 shipped` line — same number, so **not a prose scrape** |
| #2131 lane | [MEASURED] one hit only, in `rev-2131-ready.md.log` — a **review** verdict, not a `[watcher] merge result`. `[NO LANE VERDICT — hand-classified]`: `scripts/pipeline/why-blocked.ps1` is outside `NESTED_TEST_PATHS` ⇒ **Marco's** |
| #2133 lane | [MEASURED] one hit only, in `rev-2133-ready.md.log` — review, not routing. `[NO LANE VERDICT — hand-classified]`: all four paths under `docs/pr-prompts/` ⇒ inside `^(tests\|docs)/` ⇒ **not Marco's**; PR body also NAMES its lane (§10.1 step 3) |
| premise of `pr-devtree-sync-ff-only-guard` | [MEASURED] `DEVTREE_RESET` in `.claude/hooks/guard.mjs` → **0** (premise LIVE). POSITIVE control `git` over the same file → **9** |
| already shipped? | [MEASURED] merged board, last 200 PRs, titles matching `devtree\|DEVTREE\|ff-only\|guard.mjs` → **0**. Not a duplicate |
| `lint-prompt.mjs` on that HOLD | [MEASURED] **ADMIT** (size 2), exit 0 |
| safe-to-act, re-measured immediately before arming | [MEASURED] `index.lock` dev **False** / clone **False**; `git.exe` processes **0**; `git diff --cached --name-status` EMPTY; armed **0** |
| `needs-marco/station-06-has-no-cadence-and-owns-the-only-remedy-2026-09-07.md` | [MEASURED] **PRESENT**, and 06 is still absent from `list_scheduled_tasks` — the escalation is LIVE, 17 days old |

**INSTRUMENT FAULT I HIT AND CORRECTED IN THIS RUN.** `status-sweep.ps1` redirected with `*>` writes
**UTF-16LE**. `grep -c '\[STALE\]'` over that file from the Linux side returned **0** — and zero is
exactly what "no stale escalations" looks like. Decoding it first (`iconv -f UTF-16LE`) returned 4
hits and, more importantly, made §6 and §7 readable at all; before decoding, the `VERDICT` grep
returned nothing and the available conclusion was *"the sweep never printed a verdict"*. That is §9.6
with the emptiness manufactured by an encoding. **Decode before grepping any PowerShell-redirected
file, and control the grep against a token you know is in it.**

## WHAT CHANGED

1. **Dev tree fast-forwarded twice**, both clean, all four read-backs passing each time
   (`rev-list` `0 0`, `--numstat` EMPTY, `--cached` EMPTY, `--porcelain --untracked-files=no` EMPTY):
   `564108ef -> 9ff1327b`, then `9ff1327b -> 02c0e7e5` after this run's own merge.
2. **MERGED #2133** — *"docs(pr-prompts): release three human gates Marco answered, and hand the
   pipeline-defect cluster to Station 06"* — via `Assert-SmokedOrEscalate -MustContain
   @('00-06-pr-master-2026-09-24-1200','pr-devtree-sync-ff-only-guard-HOLD.md')` then `Merge-Pr`.
   Read back independently: `state=MERGED`, `mergedAt=2026-09-23T20:29:45Z`,
   merge commit `02c0e7e5`, and `git ls-tree -r origin/main` confirms the Station 06 dispatch is
   **on main**. No hand-merge, no `gh pr merge` by hand.
3. **ARMED `pr-devtree-sync-ff-only-guard`** (one prompt, one at a time) via `arm-prompt.ps1`
   — a `git mv` of the tracked HOLD, behind the script's OS lock, which verified the index before
   and after and then released the staged rename. Read back: `*-ready.md` → exactly
   `pr-devtree-sync-ff-only-guard-ready.md` (count 1), HOLD gone from disk, audit line
   `2026-09-23T20:35:38Z  ARMED  pr-devtree-sync-ff-only-guard  escalates=false
   actor=station-00.sched-2023z  pid=36644`.
4. **Updated the branches of #2131 and #2127** (`gh pr update-branch`, exit 0 both, `✓ PR branch
   updated`). Both went BEHIND as a direct consequence of merging #2133; both are Marco's to merge,
   and leaving them BEHIND would have meant he could not merge them when he looked. Neither was
   merged, no label was touched.
5. **This breadcrumb**, written inside this run's own PR worktree (`C:\po-wt\collect2035`) — Cure 1,
   so no loose copy exists in the dev tree to block the next fast-forward.

## FINDINGS

**F1 — `check-breadcrumb.mjs` reported two breadcrumbs "UNTRACKED — it reaches nobody" that were
tracked on `origin/main` the whole time, and the available conclusion was to commit a SECOND copy.**
[MEASURED] At start the dev tree was 1 commit behind (`564108ef` vs `9ff1327b`) and the validator
printed `NOTE … is UNTRACKED` for `00-00-supervisor-…-1816-…md` and
`00-04-scanner-…-1810-…md`. `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` shows both
at `archive/` paths, landed by `#2132` at 19:31Z; `git ls-tree` on **HEAD** shows them at the queue
root. So the files were tracked at both refs and the NOTE was an artefact of the dev tree being
behind. This is exactly `TRACKED_SET_PROBE_MUST_ASK_ORIGIN_MAIN_V1` in `00-supervisor.md`, reached
through the validator rather than through `git ls-files` — and the cure is the one already written
there: ask `origin/main`, never the dev tree. **Falsifying probe:** the NOTEs disappeared from an
otherwise identical `--freshness` run after the fast-forward, with `CLEAN`/exit 0 both times.
**DISPOSITION: ACTIONED** — resolved by fast-forwarding rather than by committing a duplicate; the
duplicate this prevented is the 2026-09-07 incident the same section records. No doc change is owed:
the rule is already written, and this run is the second instance confirming it fires through more
than one instrument.

**F2 — the Station 06 dispatch is filed under `00-06-*`, the prefix a REPORT FROM 06 uses, so
"when did 06 last report?" is no longer answerable from filenames.**
[MEASURED] `00-06-pr-master-2026-09-24-1200-the-pipeline-defect-cluster-is-yours-to-draft-and-nine-
gates-were-answered.md` is a dispatch **to** 06, authored by `station-00.interactive-0004` (its own
GROUND block says so), and it sits beside genuine 06 self-reports from 08-25/08-26 under the
identical prefix. No false all-clear today: `--freshness` gives 06 no row, because 06 has no
cadence. **The harm is latent and conditional** — the moment 06 is given a cadence, this file makes
06 read FRESH on a report it never wrote, which is a false all-clear in the one instrument that
exists to catch silence. **DISPOSITION: DEFERRED** — it becomes urgent the moment a cadence is
created for 06 (i.e. the moment the escalation in F3 is actioned), and the fix is cheap and
mechanical then: dispatches TO a station belong under the AUTHORING station's prefix, or under a
distinct `dispatch-` prefix the freshness scan ignores.

**F3 — the 06 dispatch's own F1 and F2 are DISPATCHED to a station with no cadence and no
consumer.** [MEASURED] `list_scheduled_tasks` returns five tasks — `00-supervisor`, `03-machine-
minder`, `04-scanner`, `05-sot-keeper`, `weekly-security-audit` (disabled). **There is no
`06-pr-master`.** So the flaky-WebKit finding and the needs-marco-retirement-record finding were
handed to nobody, which is the Station 02 failure this station's own doc records (*"Dispatches
naming 02 went to a station with no schedule and no consumer"*). **DISPOSITION: ESCALATED — to the
EXISTING file, not a new one.** `needs-marco/station-06-has-no-cadence-and-owns-the-only-remedy-
2026-09-07.md` is present and its central claim re-verified live this run. Adding a 47th escalation
saying the same thing is noise; what this run adds is that the gap has now swallowed two more
findings, 17 days on.

**F4 — `pr-fv2-formrule-contract` now lints ADMIT and is still NEVER-ARM for this station.**
[MEASURED] #2133 released its `HUMAN_GATE_PRESENT` marker, so it is one of the two prompts the 06
dispatch calls "armable now". `00-supervisor.md`'s never-arm list names it explicitly
(*"`pr-fv2-formrule-contract`, `pr-siteid-notnull-backfill`, and any prod-data prompt (MT-3/MT-5) —
those are Marco-run"*), and DOCTRINE §9.5 is that **lint ADMIT is necessary, not sufficient**. A
released human gate changes the linter's verdict; it does not move the prompt off a Marco-run list.
**DISPOSITION: ACTIONED** — deliberately not armed, and recorded here so the next run does not read
its ADMIT as a licence. The one prompt this run did arm is the other of the two.

**F5 — `arm-prompt.ps1 -Actor` is MANDATORY and prompts for it, which stalls a headless run
silently.** [MEASURED] Invoked without `-Actor`, the script blocked on PowerShell's mandatory-
parameter prompt; two `read_process_output` calls returned the echoed command line and nothing else,
and the on-disk state was unchanged (`*-ready.md` count 0, HOLD still present) — so the shape is
indistinguishable from a slow arm that is about to succeed. It cleared the moment the actor string
was supplied as input. DOCTRINE §6 is *never ask a question* — this is a sanctioned script asking
one of a headless caller. **DISPOSITION: DEFERRED** — the cure is to always pass `-Actor` explicitly
(cost: nothing) and the trap only bites a caller who forgets. It becomes worth a doc change if a run
ever burns its slot on it; this one did not, because the disk read-back distinguished "stalled" from
"working".

## WHAT I DID NOT DO

- **Did not merge #2131 or #2127.** #2127 carries a real watcher `marco:true` verdict — RULE 2 binds
  absolutely. #2131 has no routing verdict and hand-classifies to Marco on
  `scripts/pipeline/why-blocked.ps1`. Both driven green and left for him, per *"open + drive green,
  leave the merge for Marco"*.
- **Did not arm `pr-fv2-formrule-contract`** despite its new ADMIT — F4.
- **Did not release, narrow or re-open any of the seven gates the 06 dispatch deliberately left
  held.** Five are blocked on measured preconditions; two wait on a fact only Marco holds.
- **Did not touch the two orphaned worktrees** `C:\po-wt\rel06` (30 min, clean, on #2133's now-merged
  branch — plausibly still held by the live interactive lane) or `C:\po-wt\s9hex` (842 min, detached,
  clean), **and did not touch the `dirty=1` watcher clone.** Local trees and the clone are Station
  03's lane; pruning a worktree another lane may still be sitting in is the LL-38 shape.
  **DISPATCHED to 03**, named here.
- **Did not restart the watcher.** It is idle with 0 armed prompts at the moment of measurement,
  which is CORRECT, not wedged. (It will now pick up the prompt armed in WHAT CHANGED item 3.)
- **Did not commit the four untracked paths another actor left in the dev tree**
  (`Claude Design/docs/index.html`, `docs/pr-reviews/pr-2119-review.md`, `pr-2131-review.md`,
  `pr-2133-review.md`). They are not this station's output, and committing another actor's files into
  a board PR is how a review artefact acquires the wrong provenance.
- **Did not touch `/sot/`** — not one file, in any tree.
- **Did not go near Azure, Entra or SharePoint**, and wrote no production data.
- **Did not remove or add any label.**

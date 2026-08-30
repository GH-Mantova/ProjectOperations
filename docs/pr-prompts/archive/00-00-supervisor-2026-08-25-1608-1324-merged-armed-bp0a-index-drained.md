# Station 00 — Supervisor | 2026-08-25T16:08Z–2026-08-25T16:22Z

## GROUND

```
UTC            2026-08-25T16:08Z
origin/main    b968e4f1  (at start)  ->  019c7579  (after my merge of #1324)
dev tree       main @ b968e4f1   C:\ProjectOperations2   (0 behind at start; 1 behind after my merge)
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (scheduled-task SKILL.md station_doc_version)
```

Versions AGREE — this was a full-authority run, **NOT BLIND**. Desktop Commander reached the box
(`start_process` powershell.exe, `HOSTOK … 2026-08-25T16:08:24Z`).

## WHAT I MEASURED

**Board — `gh pr list` + per-PR `gh pr view --json` parsed with `ConvertFrom-Json` (never `--jq`)**
`[MEASURED]` 8 open at start, 7 after my merge:

| PR | mergeState | CI | labels | top dirs | watcher-routed to Marco? |
|---|---|---|---|---|---|
| #1324 | CLEAN | 7 pass / 0 fail | none | docs, sot | **NO (0 log hits)** → I merged it |
| #1323 | CLEAN | 12/0 | `do-not-merge` | docs, scripts | YES (12:28:10Z, escalates:true) |
| #1322 | CLEAN | 12/0 | **none** | apps | YES (10:16:48Z, `apps/web/src/pages/crm/AccountDetailPage.tsx`) |
| #1321 | CLEAN | 12/0 | `do-not-merge` | apps, docs | YES (10:10:43Z, escalates:true) |
| #1320 | CLEAN | 12/0 | **none** | apps | YES (09:48:19Z, `apps/web/src/App.tsx`) |
| #1319 | UNSTABLE | 11/1 | `do-not-merge` | scripts | YES (09:43:22Z, escalates:true) |
| #1317 | CLEAN | 12/0 | **none** | .github | YES (08:18:01Z, `playwright-container-trial.yml`) |
| #1316 | CLEAN | 12/0 | **none** | apps | YES (07:37:21Z, `apps/api/jest.config.ts`) |

`[MEASURED]` **RULE 2 routing probe, with its control:** `Select-String "stays for Marco"` across
`C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs\*.log` returns **591 lines total** and hits
**7 of the 8** open PRs. The instrument demonstrably produces positives, so **#1324's zero is a real
negative**, not an empty query (DOCTRINE §7 guard 1, §9.6).

`[MEASURED]` **A label-only check would still be wrong on 4 of 7** — #1316 #1317 #1320 #1322 carry
**no label at all** and are gated only by the watcher's routing line. Confirms the 14:08Z finding.

**Watcher** `[MEASURED]` node pid **29024**, cmdline-matched `pr-watcher[\\/]index\.mjs`, started
2026-08-24T05:35Z — **no restart in 34 h**. `.queue-state.json` `ts` field = `2026-08-25T16:08:09.378Z`
read at 16:09Z → **~1 min fresh**. `status-sweep` heartbeat age 101 min is the mid-run job ticker on an
empty queue, not a freeze. No `index.lock` in either tree; 0 git processes; 0 in-progress prompts.

`[MEASURED]` **`supervise-watcher.ps1` wrapper count = 0** by exact cmdline match, while
`status-sweep.ps1` prints `auto-restart wrapper: alive (1)`. **The two probes disagree** — they are
matching different processes (the Keepalive scheduled task vs. the wrapper). I did **not** relaunch:
station-doc §3b ENSURE-UP is a known defect (relaunching starts a *second* supervisor carrying a kill
loop), and `\PO Watcher Keepalive` → `ensure-watcher.ps1` is the live restarter.

**Queue** `[MEASURED]` armed depth-1 `*-ready.md` = **0** at start; needs-marco 9; no-pr-opened 107;
failed 20; blocked 0. HOLD prompts depth-1 = 57.

`[MEASURED]` **Board trap CLEAR** — tracked depth-1 `*-ready.md` = **0**; control
`ALL_TRACKED_UNDER_PR_PROMPTS 406 / DEPTH1_TRACKED 102 / depth-1 tracked HOLD 70`.
⚠️ My first attempt used `git ls-files "docs/pr-prompts/*-ready.md"` and returned **167** — the git
pathspec `*` **crosses `/`**. Anyone quoting that number is quoting subfolders. Filter with
`-notmatch '^docs/pr-prompts/[^/]+/'`.

**Breadcrumbs** `[MEASURED]` `check-breadcrumb.mjs --freshness` → **exit 2**: 11 checked, **0
malformed**, all 11 flagged `UNTRACKED`. Station **03 SILENT 17.2 h** (cadence 4 h). 00 ok (2.0 h),
04 ok (2.0 h), 05 ok (25.9 h — its 14:11Z report shipped inside PR #1324, not to disk).
`[MEASURED]` 00-* breadcrumbs: **53 on disk, 22 tracked → 31 uncommitted** (was 51/22 at 14:10Z).

**Arming candidate** `[MEASURED]` for `pr-sot-04-bp0a-job-canonical-reconcile-HOLD.md`:
premise `grep -q "survives as the delivery spine"` executed against **origin/main** → **1 hit,
`sot/04-data-model.md:3807`** (the prompt's own cited line 3712 has drifted — it warned it would).
Negative control 0 hits, positive control 71 hits. Body markers: no `watcher: do-not-arm`, no prose
`DO NOT ARM`, no `docs/approvals` gate, **STANDING AUTHORITY exact literal present**, `escalates: true`.
`lint-prompt.mjs` → **ADMIT, exit 0**.

`[MEASURED]` The only two prompts whose PR would be **docs-only** (and so auto-mergeable by the
watcher, bypassing the human gate) — `pr-hygiene-gitignore-no-pr-opened-HOLD.md` and
`pr-watcher-idle-tick-liveness-HOLD.md` — are **both still untracked** (`tracked=0`), so `git mv`
refuses them. The one route past the gate remains locked.

`[CANNOT MEASURE]` Whether Marco intends to clear the 7 gated PRs. That is the run's binding
constraint and it is his to answer.

## WHAT CHANGED

1. **MERGED PR #1324** (`docs(sot): re-merge the generated schema map into sot/04 …`) via
   `pipeline-lib` — `Assert-SmokedOrEscalate` then `Merge-Pr`, never by hand.
   **Read back:** `state=MERGED mergedAt=2026-08-25T16:13:46Z mergeCommit=019c7579…`;
   `git branch -r --contains 019c7579` → `origin/main`. `origin/main` moved `b968e4f1 → 019c7579`.
   ⚠️ `Assert-SmokedOrEscalate` printed `GATE_RESULT True True` — the DOCTRINE §7 lie #6 shape (a PS
   function returns *all* its output). It did not throw, and GitHub's own `mergeStateStatus: CLEAN`
   is the independent second signal I relied on. The doubled value is an artifact, not a second gate.
2. **DRAINED the shared-index hazard.** The dev-tree index held
   `R100 pr-arm-lock-s1-serialize-arming-HOLD.md → …-ready.md` with **both endpoints absent from
   disk** — the next bare `git commit` would have shipped a tracked depth-1 `*-ready.md`.
   `git restore --staged` on both paths. **Read back:** staged entries 1 → **0**; the path now reads
   ` D` (an honest unstaged deletion of a consumed prompt). Guarded: the script aborted if the index
   held anything else.
3. **ARMED ONE prompt** — `pr-sot-04-bp0a-job-canonical-reconcile-HOLD.md` → `-ready.md` by
   `git mv` (exit 0). **Read back:** armed **0 → 1** on disk; `git diff --cached --name-status`
   carries **only** that rename; `SRC_EXISTS_NOW False / DST_EXISTS_NOW True`.

## FINDINGS

**F1 — #1324 was mine to merge, and it was the only one.** Not watcher-routed (control-verified),
unlabelled, CLEAN, `docs/` + `sot/` only (CP-24 permits that pair). — **ACTIONED.**

**F2 — Seven PRs, all seven behind the human gate, for the fourth run running.** #1316 #1317 #1319
#1320 #1321 #1322 #1323. RULE 2 forbids me merging any of them; four carry no label, so a
label-only check would merge them by mistake. — **ESCALATED** (see ASK 1).

**F3 — The gate is the bottleneck, and arming cannot relieve it.** Every armable prompt produces a PR
that touches something outside `tests/` or `docs/`, so the watcher routes it to Marco. The only two
docs-only prompts are untracked and `git mv` refuses them. — **ESCALATED** (see ASK 2; 2nd ask).

**F4 — 31 station breadcrumbs are uncommitted and reach nobody.** The authority matrix says
**00 may not create a PR**; 02 and 06 have no schedule; dispatch does not work in this environment.
The channel is structurally closed. — **ESCALATED** (see ASK 3; 2nd ask, raised by 04 at 14:10Z).

**F5 — Station 03 has been silent 17.2 h against a 4 h cadence.** Third consecutive supervisor run
reporting it. Either it is not firing or it fires and does not report; both are defects and I cannot
tell which from here. — **ESCALATED** (see ASK 4; 3rd ask).

**F6 — The shared dev-tree index is an unguarded, live hazard.** It caught a dead rename that would
have re-armed a consumed prompt on the next commit. #1323 (`arm-prompt.ps1` serializer) is the fix
and is sitting in the gate. — **ACTIONED** this instance; the class is ESCALATED with F2.

**F7 — `git ls-files "docs/pr-prompts/*-ready.md"` overcounts 167 against a truth of 0.** The
pathspec `*` crosses `/`. Recorded here because it is exactly the shape of the instrument lies §9
exists to catch. — **DEFERRED** (belongs in DOCTRINE §9.2 via a docs PR, which I may not open).

**F8 — 4 prunable worktrees** (`sot-d-register`, `sot-readme-fetch`, `sotk-03-ledger`, `po-wt-h`)
and 42 dirty paths in the watcher clone. Neither blocks anything today. — **DEFERRED** (Station 03).

**F9 — Station 05's P3 ask (`pr-sot-02-reconcile-2026-08-19-HOLD.md`) is tracked and armable** but
arming is one-at-a-time and bp0a took the slot. — **DEFERRED to the next 00 run**, after bp0a's PR
opens.

## WHAT I DID NOT DO

- **Did not merge, relabel, or touch any of the seven watcher-routed PRs.** RULE 2 is not overridden
  by green, by CLEAN, by an absent label, or by my own reading of the diff.
- **Did not relaunch `supervise-watcher.ps1`** despite a 0 count — §3b ENSURE-UP is a known defect
  and the Keepalive task is the live restarter. Relaunching would have started a second supervisor
  carrying a kill loop.
- **Did not fast-forward the dev tree** onto `019c7579`. It is 1 behind; #1324 touched
  `docs/pr-prompts/00-05-sot-keeper-…-1411-….md`, and the dev tree holds untracked breadcrumbs that
  an `ff-only` would refuse or clobber. Not worth the risk with a prompt armed.
- **Did not arm a second prompt.** One at a time.
- **Did not quote a trunk colour from `status-sweep.ps1`.** Its `TRUNK` line is a measured coin flip
  (Station 04, 14:10Z).
- **Did not touch Azure / Entra / SharePoint, production data, or `/sot/`.**

---

## FOR MARCO — four asks, each with options (RULE 1: complete-and-additive first)

**ASK 1 — the seven gated PRs.** They are all green (except #1319, one red) and all held by RULE 2.
Nothing I do moves them.
- **(a) Complete + additive:** you merge them, or name in chat the specific PR numbers I may merge
  this cycle. Passes both halves — the board drains and nothing about the gate weakens.
- (b) I merge any unlabelled watcher-routed PR whose diff I verify. **Fails the "no damage" half** —
  the routing line exists precisely because a diff check is not a review.
- (c) Leave them. Fails the "solves it" half — the board grows and every merge pushes the rest behind
  into a full ~13 min CI re-run.

**ASK 2 — the `tests-docs` allow-list (3rd ask).** The watcher auto-merges only `tests/` and `docs/`.
`sot/`-only doc-reconciles therefore queue behind you, even though I merged an identical-shaped PR
(#1324) myself twenty minutes ago because a station chat opened it rather than a prompt run.
- **(a) Complete + additive:** add `sot/` to the allow-list **for doc-reconcile prompts only**
  (`scope:` entirely within `sot/` + `docs/`, which CP-24 already enforces). Both halves pass — no
  code path can slip in.
- (b) Leave it. Fails "solves it" — every `/sot/` correction needs you.

**ASK 3 — who commits station output (2nd ask).** 31 breadcrumbs sit untracked. The authority matrix
forbids 00 from opening a PR; 02 and 06 are unscheduled; dispatch does not work here.
- **(a) Complete + additive:** give 00 authority to open **breadcrumb-only** PRs
  (`docs/pr-prompts/00-*.md` and nothing else). Additive, auditable, no code path.
- (b) Schedule Station 06 to sweep them. Solves it, but adds a second actor mutating git — the LL-38
  collision shape.
- (c) Leave it. Fails "solves it" — the reporting channel stays closed and findings expire unread.

**ASK 4 — Station 03 (3rd ask).** Silent 17.2 h against a 4 h cadence. I can see that it did not
report; I cannot see whether it fired. Is it meant to be running?

---

**Armed this run:** `pr-sot-04-bp0a-job-canonical-reconcile-ready.md`. It is `escalates: true`, so
the watcher will open the PR, label it `do-not-merge`, and **leave it for you** — an eighth item in
the gate, which I flag as the cost of arming it. It unblocks the twelve B-P0a slices that have not
moved since July.

**Post-run probes** `[MEASURED]` 16:19:10Z — armed still 1 (not yet picked up; 2 min post-arm, and
0–5 min is normal). Watcher pid 29024 ticked at 16:18:09Z and archived `pr-1324-review.md`
(`state=MERGED`) — a **third** independent confirmation of both the merge and the watcher's health.

<!-- provenance: every line above is tagged; this file is true at origin/main 019c7579, 2026-08-25T16:22Z -->

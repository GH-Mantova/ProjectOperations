# Station 00 — Supervisor | 2026-09-10T03:08Z–2026-09-10T03:55Z

## GROUND

```
UTC            2026-09-10T03:09:09Z
origin/main    719fbf16            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ d9648fea     C:\ProjectOperations2   (2 behind origin/main at open)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (<!-- station_doc_version: 1 --> in the served SKILL.md)
```

Doc version and bootstrap AGREE — this run was not read-only-gated.

**This run was SIGHTED.** `start_process` shell `powershell.exe` answered at 2026-09-10T03:09:09Z
(+10:00 host clock, Brisbane). All three binding documents were read in full from the dev tree and
each verified byte-identical to `origin/main` with `git diff --numstat origin/main -- <path>` →
EMPTY on all three (the sound form, DOCTRINE §9.1; no piped hash was taken):
`docs/pipeline/stations/00-supervisor.md` (1299 lines), `docs/pipeline/DOCTRINE.md` (1751),
`docs/pipeline/STATION-CAPABILITIES.md` (485).

## WHAT I MEASURED

**vm-git-guard NOT installed — [CANNOT MEASURE], and it is a FINDING not a STOP (F4).** The
contract requires quoting the installer's last line pass or fail. It produced none: the VM side
returned an RPC mount failure before any command ran — `failed to mount … is under Plan9 share "c"
which is not mounted`, plus `ensure user: user eloquent-hopeful-lovelace already exists
unexpectedly`. No `bash` ran at all this session, so no `git`-against-the-mount hazard could arise.

**Sweep.** `scripts/pipeline/status-sweep.ps1` captured to a FILE (it returns early and hides its
own §7 verdict): 387 lines, §7 reads
`[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`
Instrument controls in §0 both passed (`gh` reached GitHub; `node` runs). Re-read immediately before
the one board mutation this run made.

**Q1 — every open PR, verbatim.** `gh pr list --state open` → **2**, and **ZERO are DIRTY**:

| PR | head | mergeState | CI | labels | files |
|---|---|---|---|---|---|
| `#1832` | `fix/vm-git-guard-selftest-and-recursion` | CLEAN | 15 pass / 0 fail / 0 pending | **none** | `scripts/pipeline/vm-git-guard.sh` |
| `#1823` | `feat/ea-gate-reporting-team-permission` | CLEAN | 15 pass / 0 fail / 0 pending | **none** | 5 × `apps/api/**` + `docs/decisions/merge-approvals/1823.md` |

`main` CI on `719fbf16`: 4 success / 0 failed. Trunk green.

**Q2 — no conflicts to fix.** Zero DIRTY, so no CI is frozen and nothing is armed to resolve one.

**RULE 2 — BOTH OPEN PRs ARE MARCO'S. I merged neither.** Probe pinned to the LIVE tree
`C:\ProjectOperations2\docs\pr-prompts\processed` (never the clone decoy), quote-free regex form,
excluding `rev-*` review-job logs per §10.1:

- corpus **2105** logs, newest `2026-09-10T02:35:47Z` — younger than both PRs' `createdAt`
  (`#1823` 2026-09-09T00:05:42Z, `#1832` 2026-09-10T00:12:33Z), which is the control that separates
  this directory from the seventeen-day-stale decoy in the watcher clone;
- POSITIVE control `marco.:true` → **627**; NEGATIVE control, a freshly minted needle
  (`zzQq00Needle` + `20260910T0330`, written split so this file does not spend it twice) → **0**;
- NEGATIVE lane control — `#1838`, a board PR the watcher did **not** open → **0** prompt-log hits,
  proving `NO LOG` here means *second lane* and not *broken probe*;
- `#1832` → `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/vm-git-guard.sh"}`
- `#1823` → `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`

⚠️ **Both PRs now carry NO label**, and `#1823`'s verdict says it was labelled `do-not-merge`. **The
label being gone does not clear RULE 2** — only Marco, in chat, naming the PR. Recorded, not acted on.
This is the vacuous-CP-26 shape already open as
`needs-marco/cp26-passes-vacuously-on-an-unlabelled-destructive-migration-2026-09-05.md`; not re-raised.

**Q3 — armed prompts counted myself, not quoted:** `Get-ChildItem docs\pr-prompts -Filter *-ready.md`
→ **0 files, no names.** The sweep agrees (`armed (*-ready.md): 0`).

**Q4/Q5 — the queue's own buckets.** `needs-marco/` 51 · `no-pr-opened/` 109 · `failed/` 45 ·
`blocked/` 129. The two newest `failed/` entries are both `rev-1837-*` (a review job, not a prompt —
§9.5); the newest `no-pr-opened/` entry is 2026-09-02 and unchanged since. No NEW silent no-op this
cycle.

**Watcher.** `[LIVE] watcher node: RUNNING pid 13352`, auto-restart wrapper alive (1), heartbeat age
30 min with an EMPTY queue — idle, **not wedged** (the heartbeat only ticks mid-run). No restart was
warranted and none was made.

**COLLECT — `node scripts/pipeline/check-breadcrumb.mjs --freshness` → CLEAN, exit 0**, 28 checked,
0 malformed. Crossed against `lastRunAt` from the scheduled-tasks MCP, because the breadcrumb is one
instrument and cannot name a cause:

| station | newest breadcrumb | `lastRunAt` | verdict |
|---|---|---|---|
| 00 | 2026-09-10T02:08Z | 2026-09-10T03:08:51Z | aligned (this run) |
| 03 | 2026-09-09T23:01Z | 2026-09-09T23:01:42Z | aligned |
| 04 | 2026-09-10T02:10Z | 2026-09-10T02:10:29Z | aligned |
| 05 | 2026-09-09T22:02Z | 2026-09-09T22:01:58Z | aligned |

All four fresh and aligned; no station is SILENT and none needs a transcript read.

**Exactly ONE breadcrumb was written since my 02:08Z run** — Station 04's 02:10Z, and `#1838` had
already published it (F5). Its four findings are dispositioned below.

**Arming candidates — `triage-holds.ps1`, exit 0, SPENT-bucket fixture control PASSED.** 37 HOLDs at
depth 1: `spent=1 · gates-satisfied=6 · still-gated=30 · unreadable=0`. I then classified all six by
hand against `classifyPolicyFiles`'s three `NESTED_TEST_PATHS` forms:

| gate-satisfied HOLD | scope entries | outside `tests`/`docs` |
|---|---|---|
| `pr-brandtheme-s3-full-palette-columns` | 8 | **5** (incl. `apps/api/prisma/migrations/**`) |
| `pr-brandtheme-s6-live-preview-contrast-and-override` | 6 | **3** |
| `pr-company-manage-s1-permission-and-grant` | 4 | **3** (incl. `migrations/**`) |
| `pr-e2e-container-s2-swap-required-job` | 2 | **2** (`.github/workflows/**`) |
| `pr-fv2-maintenance-usage-intervals` | 5 | **4** (incl. `migrations/**`) |
| `pr-rateparity-s1-harness` | 4 | **3** |

**0 of 6 can enter the tests-docs lane**, and three fail `classifyPolicyFiles` on its own
`(^|/)migrations/` clause. Every arm available today lands on Marco (F3).

**`pr-vmgitguard-selftest-and-recursion-HOLD.md` is already gated and was NOT re-raised.**
`lint-prompt.mjs` → exit 1 `[HUMAN_GATE_PRESENT]`, `<!-- watcher: do-not-arm -->` at line 3, put
there by my own 02:08Z run in `#1836`. Its work is open as `#1832`.

## WHAT CHANGED

One board PR, built in a disposable worktree off `origin/main` at `719fbf16`
(`C:\po-worktrees\board-20260910-0330`), torn down after push. Four changes, all under `docs/`:

1. **`docs/pipeline/DOCTRINE.md` §9.1** — Station 04's dispatched F1 correction, appended after the
   2026-09-07 correction it scopes. Edited with node by **concatenation**, never `String.replace`
   (§9.3): anchor uniqueness asserted (`hits = 1`), byte delta asserted exactly
   (`136688 + 3348 = 140036`, `delta OK = true`), `U+FFFD` → 0.
2. **`docs/pipeline/stations/_canonical-blocks.json`** — `instruments v2` re-recorded to
   `b160592524373b33` with `lint-station.mjs --write-canonical`. Before: `REJECT: 1 of 8`, DOCTRINE
   only — the block is DOCTRINE-only, so a §9 edit costs ONE document, not seven. After:
   `ADMIT: all 8 docs clean`, exit 0.
3. **`docs/pr-prompts/pr-brandtheme-s5-density-tokens-and-control-HOLD.md` → `superseded/`** — F2.
4. **`docs/pipeline/sweep-rotation.json`** — Station 04's `--advance` hand-off, swept in. 04 may not
   commit in the dev tree; this is the standing arrangement, and it is also the FF blocker the
   station doc's third cause names, so it is handled after the merge.

Also written: `docs/pr-prompts/needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md`
(F4) — that folder is gitignored, so it is named here to be reportable at all.

**Nothing else.** No PR merged, no label added or removed, no prompt armed, disarmed or renamed
beyond item 3, no `sot/` edit, no watcher restart, no worktree pruned, no Azure/Entra/SharePoint.

## FINDINGS

### F1 — Station 04's dispatched DOCTRINE §9.1 correction is LANDED (S3)

04's 02:10Z breadcrumb dispatched one finding to me: `Get-ChildItem "<dir>\*" -Recurse -File`
answers **0** whenever depth 1 holds no matching file, and §9.1 prescribes that very wildcard form
as a cure. Its own falsifying fixture cannot fail, because that fixture holds a `.log` at depth 1.

I landed it as an additive correction rather than a rewrite: the wildcard cure stays, scoped to the
no-`-Recurse` form it was measured for; the rule is stated positively (with `-Recurse`, pass the
bare directory and use `-Filter`); and the single fixture is replaced as the falsifying probe by the
**pair** of fixtures that differ only in what sits at depth 1, which is the only shape that can
fail. RULE 1, both halves: nothing any run has already measured is invalidated, and §9.5's
log-selection cure — the depth-1 no-`-Recurse` form — is explicitly untouched.

I did not re-measure 04's table; it is quoted as 04 measured it, with its provenance and its
falsifying probe attached, which is what makes it re-checkable. **The claim I verified myself is the
edit's integrity**, not the physics: anchor unique, byte delta exact, canonical hash re-recorded,
`lint-station.mjs` exit 0.

**DISPOSITION: ACTIONED** — in this run's board PR. Verified by `lint-station.mjs` → `ADMIT: all 8
docs clean`, exit 0, from `REJECT: 1 of 8` immediately before the re-record.

### F2 — a consumed prompt outlived its own MERGED PR and was still armable on main (S2)

`pr-brandtheme-s5-density-tokens-and-control` was armed `2026-09-09T22:24:15Z` by
`actor=station-00.cloud-lane-0900`, built by the watcher into **`#1827`**, which **MERGED
2026-09-10T00:00:44Z**. Its `-HOLD.md` was **still tracked on `origin/main` at `719fbf16`** —
`git diff --numstat origin/main -- <path>` → `0 155`, i.e. present there and absent from the dev
tree's disk.

That is the stays-armable-forever defect with the work already **shipped**, not merely open: a clone,
CI, or any actor reading `origin/main` sees a live HOLD for a merged feature. It is a different case
from `pr-vmgitguard-selftest-and-recursion` (open PR, correctly gated with a marker) — here the PR is
gone, so the right cure is retirement, matching what `#1798`/`#1800` did for the three earlier names
and what already happened to this chain's own s0/s1/s2.

⚠️ **The general defect is untouched and stays LIVE:** the watcher deletes the `-ready.md` it
consumes but nothing deletes the `-HOLD.md` its PR left on `main`. This is the third instance in
three days. `lint-prompt.mjs` cannot see it — on disk the file is MISSING (exit 1), on `main` it is
whole.

**DISPOSITION: ACTIONED** — `git mv` to `docs/pr-prompts/superseded/` in this run's board PR,
read back as `R  …-HOLD.md -> superseded/…-HOLD.md`. The remaining chain siblings s3/s4/s6 are
untouched and still tracked, correctly.

### F3 — 0 of 6 armable HOLDs can enter the tests-docs lane, so I armed nothing (S3)

Measured above: every gate-satisfied candidate carries `apps/**`, `.github/workflows/**` or
`apps/api/prisma/migrations/**`, and none matches any of `classifyPolicyFiles`'s three test-or-docs
forms. Both open PRs are already Marco's. **Arming any of the six adds a third PR to a queue only
Marco can drain** — it makes the board longer, not shorter, which is the throughput constraint this
pipeline has now measured on five consecutive days.

There is a second reason specific to today: the brandtheme chain is being hand-driven by the
supervised cloud lane, which armed s0, s1 and s5 itself. Arming s3 from a scheduled run puts two
actors on one chain, which is BOARD DRIVING condition 3.

**DISPOSITION: DEFERRED** — not a refusal, a sequencing call. It becomes urgent the moment either
open PR merges (the board empties and an arm costs nothing), or a gate-satisfied HOLD appears whose
scope is tests-or-docs only. The underlying constraint is already ESCALATED in
`needs-marco/tests-docs-lane-merge-action-has-not-fired-since-2026-08-24.md` and is not re-raised here.

### F4 — the Cowork VM mount was unreachable for two consecutive station runs (S3, environmental)

Station 04 hit the identical RPC failure at 02:1xZ (its F4, disposition DEFERRED with *"it becomes a
DISPATCH to 03 if it recurs"*). It recurred — on this run, one hour later, with a different session
id and the same `Plan9 share "c" which is not mounted` root cause. Two stations, two hours, so it is
now a pattern rather than a single occurrence.

**It is not 03's, and 04 said so itself: 03 cannot repair a Plan9 share.** No `.ps1` and no repo
change fixes it. The cost is narrow today and named precisely: `vm-git-guard.sh` cannot be
installed, and the mount is also the blind-run COLLECT path in `STATION-CAPABILITIES.md` §3 — a run
that lost Desktop Commander **and** the mount would have no transport at all. Those two failures are
independent today, which is the only reason that is not already the case.

**DISPOSITION: ESCALATED** — written to
`docs/pr-prompts/needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md`, because an
escalation whose subject is outside the repo and which is recorded only in a breadcrumb is escalated
to nobody. The question for Marco is one line: does restarting the Cowork desktop app restore the
mount, and if so is that worth doing on a schedule — or should the guard install move behind a
capability check so a missing VM stops producing a `[CANNOT MEASURE]` in every station report?

### F5 — `git ls-files` in a tree that is BEHIND reported an already-published breadcrumb as untracked, and I nearly committed a second copy of it (S2)

Asking *"which breadcrumbs has nobody collected?"* I ran `git ls-files docs/pr-prompts` in the dev
tree and matched by basename — the method the station doc prescribes for exactly this question. It
returned **946** tracked paths and named 04's 02:10Z breadcrumb as **UNTRACKED**. The dev tree was
**2 commits behind `origin/main`**, and `#1838` — my own 02:40Z run — had already published that
exact file at that exact path.

The available conclusion was *"this station's finding reached nobody"*, which is word-for-word the
premise the station doc records as having produced a duplicated tracked basename on 2026-09-07. **I
was one `git add` from repeating it.** It was caught only because the `git add` in a worktree at
`origin/main` staged **nothing** — the copy was already byte-identical to the tracked blob — and the
positive control is `git ls-tree -r --name-only origin/main -- docs/pr-prompts/`, which names the
file, at commit `84ef1470`.

**This is DOCTRINE §9.2's behind-tree bullet, one command over.** That bullet is written about
`git status` and its ` M` / ` D` output. `git ls-files` has the same defect for the same reason —
it answers about the **index**, i.e. about HEAD — and the station doc's own de-duplication rule
("ask the TRACKED SET, not the dev tree") names `git ls-files` as the cure without saying which
tree to run it in. On a behind tree the cure is the trap.

🔧 **The sound form is `git ls-tree -r --name-only origin/main -- docs/pr-prompts/`** (with `-r`
and a trailing slash, §9.2), or a fast-forward first. **The falsifying probe:** on a tree N behind,
run both forms against a path landed in one of those N commits — if `ls-files` names it, this
finding is wrong.

**DISPOSITION: ACTIONED** — caught before any commit, so nothing was duplicated; and the rule is
recorded here rather than in DOCTRINE this run, because §9.2 sits inside the `instruments v2`
canonical block and this run has already re-recorded that block once. Folding it in is one bullet
and belongs to the next run that opens §9 anyway. If it is not folded in by 2026-09-12, it should be
re-filed as its own prompt.

## WHAT I DID NOT DO

- **Merged nothing.** Both open PRs carry a live watcher `marco:true` verdict. Neither carries a
  label any more, and that changes nothing: only Marco clears RULE 2, in chat, naming the PR.
- **Armed nothing** (F3), and disarmed nothing. `armed` was 0 at open and 0 at close.
- **Did not touch the watcher.** RUNNING pid 13352, wrapper alive, empty queue — idle, not wedged,
  and `restart-watcher-if-wedged.ps1` was not run with `-Fix` because no WEDGED/DOWN verdict exists
  to justify it.
- **Did not prune the 8 non-main worktrees** the sweep classified as orphaned, and specifically not
  `C:/po-vg` (age 8357 min, **1 uncommitted file**). Deleting it would discard work; it is 03's, and
  03 has already escalated it.
- **Did not clean the watcher clone** (`branch=main dirty=2`). Read-only git in the clone only; it is
  03's, and the clone fast-forward is the open `needs-marco/nobody-may-fast-forward-the-watcher-clone`
  question.
- **Did not archive any collected breadcrumb this run.** 28 sit at depth 1. Archiving leaves an
  untracked root copy the next run re-commits — the defect the station doc records — and doing it
  properly wants the same care as the FF cure. Deferred to a run whose board PR carries nothing else.
- **Did not clear any `[STALE]` §5 line**, including the 14 citations under
  `agent-authored-rule-2-clearance-2026-09-04.md`. Section 5 says plainly it cannot decide those.
- **Did not touch `/sot/`, Azure, Entra or SharePoint**, and had no reason to go near them.

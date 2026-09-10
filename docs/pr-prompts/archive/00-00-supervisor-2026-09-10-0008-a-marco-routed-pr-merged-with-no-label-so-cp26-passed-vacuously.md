# Station 00 — Supervisor | 2026-09-10T00:08:49Z–2026-09-10T00:2xZ

## GROUND

```
UTC            2026-09-10T00:08:49Z   (lastRunAt, scheduled-tasks MCP; jitter 172 s)
origin/main    f6478962               (git fetch origin --prune, then git rev-parse --short — no pipe)
dev tree       main @ 640dbdd3        C:\ProjectOperations2   (0 ahead, 1 behind)
doc version    1                      (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                      (station_doc_version in the scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** — this run is not read-only by the version rule. It is
nevertheless read-only **on the board**, by BOARD DRIVING condition 3; see F2.

All three binding documents were read in full from the working copy, which is sound this run
because `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md` returned **EMPTY**
(PREFLIGHT step 2's sanctioned form; no piped hash was taken). Read in the DEV TREE, never the clone.

Fresh needle minted for this run: `zzQq00N20260910T0025Zx` — 0 hits across every corpus probed
below. It is spent the moment this file lands.

## WHAT I MEASURED

**Reachability.** [MEASURED] Tool ids resolved by a keyword `ToolSearch` for `desktop-commander`,
not assumed; `start_process` shell `powershell.exe` returned a live shell (pid 17288).
**This run was SIGHTED.**

**The device-bridge git guard could NOT be installed — third consecutive report, across two
stations.** [MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` →
`bash failed on resume, create, and re-resume … source path … is under Plan9 share "c" which is not
mounted`. The Linux sandbox never started, so no `/sessions/<id>/mnt/` path resolved at all.
Per PREFLIGHT this is a **FINDING, not a STOP**, and it is self-limiting: the transport the guard
protects does not exist this run, so no VM-side `git` call against the Windows `.git` was possible.
Every command below ran on the Windows host through Desktop Commander. Filed identically by 05 at
2026-09-09T22:02Z and by 00 at 23:08Z.

**Watcher.** [MEASURED] `scripts\restart-watcher-if-wedged.ps1` (report-only, no `-Fix`):
`armed prompts waiting: 0 · watcher process: ALIVE (pid 13352) · restart churn: 0 cycle(s) in 20 min`
→ **`VERDICT: OK - nothing armed and the watcher is alive.`** Node `StartTime`
`2026-09-09T22:01:02Z`. Idle is correct, not wedged. The script's header prints Brisbane local
(`10:14:25`) against a UTC probe time of `00:14:25Z` — the UTC+10 offset, converted, not subtracted.

**Board, live.** [MEASURED] `gh pr list --state open --json …` — **3 open, 0 DIRTY.**

| PR | mergeState | scope | lane |
|---|---|---|---|
| `#1823` | BEHIND | `apps/**` EA-GATE reporting permission | watcher, **`marco:true`** |
| `#1824` | BEHIND | 3 files, all `docs/pr-prompts/` | no log — hand-classified `docs/` |
| `#1832` | BEHIND | `scripts/pipeline/vm-git-guard.sh` | watcher-built, **outside `tests\|docs`** |

**Q1 answer: ZERO PRs are DIRTY.** No PR on this board has frozen CI; the board is not
conflict-blocked.

**Q3 answer: armed prompts = 0.** [MEASURED] `Get-ChildItem docs\pr-prompts -Filter *-ready.md`
returned **one** name — `rev-1832-ready.md` — which is an auto-generated **REVIEW JOB**, not a
prompt (DOCTRINE §9.5). `armed=N` is not N arms; the names were read. **Real armed count: 0.**
The same probe read `0` six minutes earlier, so this is also a live instance of the `[LIVE]` rule.

**RULE 2 probe, pinned to the LIVE tree.** [MEASURED]
`C:\ProjectOperations2\docs\pr-prompts\processed` — **2099** logs, newest
`rev-1831-ready.md.log 2026-09-10T00:04:11Z`, younger than every open PR's `createdAt`, which is the
control that separates this directory from the seventeen-day-stale decoy in the watcher clone.
POSITIVE control `-Pattern 'marco.:true'` (regex, no quote character) → **626**.
NEGATIVE controls: minted needle → **0**; `PR #999999` over `pr-*.log` → **0**; `PR #999998` → **0**.
Matched on `PR #<n>` in the log BODY, over `pr-*.log` only, `rev-*` excluded per DOCTRINE §10.1:

- `#1823` → 2 hits, including `[watcher] merge result for PR #1823:
  {"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`
  — **RULE 2 BINDS.**
- `#1824` → **0 hits. `[NO LANE VERDICT — hand-classified]`**: all three files are under
  `docs/pr-prompts/`, matching `NESTED_TEST_PATHS[0]` (`^(tests|docs)\/`), no `(^|/)migrations/`
  path, non-empty diff ⇒ tests-or-docs, **not Marco's** by `classifyPolicyFiles`.
- `#1832` → its single file is `scripts/pipeline/vm-git-guard.sh`, outside all three
  `NESTED_TEST_PATHS` forms ⇒ **Marco's** by hand-classification. It was armed at `00:07:52Z` and
  is still inside its merge window, so an absent verdict here is `[CANNOT MEASURE]`, never
  "second lane" (DOCTRINE §9.5, the one-directional rule).

**Freshness, and the cross-check the contract requires.** [MEASURED]
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → **exit 0, `CLEAN`**,
`structure: 24 checked, 0 malformed`:

```
00  last 2026-09-09T23:45:00Z  0.4h ago  (cadence 2h)  ok
03  last 2026-09-09T23:01:00Z  1.2h ago  (cadence 24h) ok
04  last 2026-09-09T22:02:00Z  2.2h ago  (cadence 4h)  ok
05  last 2026-09-09T22:02:00Z  2.2h ago  (cadence 24h) ok
```

Crossed against `lastRunAt` from the scheduled-tasks MCP: `00` `5 * * * *` lastRun
`2026-09-10T00:08:49Z` (this run) · `03` `2026-09-09T23:01:42Z` · `04` `2026-09-09T22:01:57.495Z` ·
`05` `2026-09-09T22:01:58.050Z` · `weekly-security-audit` `2026-09-06T21:32:44Z`. Five enabled tasks.
**Every station is in row three of the contract's table — both fresh and aligned.** The 42-hour
Station 00 hole the 23:08Z run measured has closed: three 00 breadcrumbs now exist inside the last
75 minutes. ⚠️ `00`'s cadence still reads `2` in `check-breadcrumb.mjs`'s own `CADENCE` map against
a live hourly cron, so its `ok` remains a weaker statement than any other row — unchanged, already
on file, not re-filed.

**The duplicate-basename rule earned its keep this run.** [MEASURED] `git ls-files --others
--exclude-standard -- docs/pr-prompts/` reported **two** untracked breadcrumbs. Asking the TRACKED
set by basename instead (`git ls-tree -r --name-only origin/main -- docs/pr-prompts`, **941**
paths; POSITIVE control `DOCTRINE.md` → 1; NEGATIVE control minted needle → 0):

| basename | tracked-at count | truth |
|---|---|---|
| `00-00-supervisor-2026-09-09-2345-…-mounted.md` | **1** | already on `main` — landed by `#1831` at `00:11:11Z` |
| `00-05-sot-keeper-2026-09-09-2202-…-555ms-apart.md` | **0** | genuinely uncollected |

The dev tree still lists the first as `??` **because the dev tree is one commit behind**
`origin/main`, not because it reached nobody. Committing it would have produced exactly the
`#1766`/`#1768` duplicate this rule was written for. **Only 05's was carried.**

**Seven PRs merged in the 90 minutes before this run**, all `mergedBy: GH-Mantova` (uninformative —
every actor on this board authenticates as that): `#1825` `23:13:23Z` · `#1826` `23:27:36Z` ·
`#1829` `23:29:54Z` · `#1827` **`00:00:44Z`** · `#1830` `00:03:24Z` · `#1828` `00:06:18Z` ·
`#1831` `00:11:11Z`. **`#1831` merged 142 seconds AFTER this run began.**

**#1828 landed 05's `sot/04` correction and it is verified on `main`.** [MEASURED]
`git show origin/main:sot/04-data-model.md` → `- Models: 296 | Enums: 69 | FK edges: 493 |
Domains: 23`, which is the live schema count. 05's F2 is ACTIONED and confirmed by a third party.

**The NAV-5 hold 05 unblocked cannot be armed.** [MEASURED]
`node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md`
→ **`STALE … The work is ALREADY DONE. Binned before spawning an agent.` exit 3.** It is still on
disk and still tracked on `main`, but the arming hazard is **measured zero**.

## WHAT CHANGED

**On the board: NOTHING.** Nothing merged, nothing armed, no label touched, no prompt moved,
renamed or retired, no watcher or worktree touched, no `/sot/` file opened for edit. See F2.

Three writes, none of them a board mutation:

1. **Two standing escalations APPENDED to** in `docs/pr-prompts/needs-marco/` (gitignored, so
   dev-tree only — that is the prescribed stop channel, not a reporting channel). Both were written
   with node by **Buffer concatenation**, never `String.replace` (DOCTRINE §9.3's `$`-in-replacement
   trap), and both read back with an **asserted byte delta**:
   - `cp26-passes-vacuously-on-an-unlabelled-destructive-migration-2026-09-05.md`
     before **5570** → after **9690**, delta **4120** = expected **4120** ✅ (F1)
   - `station-schedule-collision-04-and-05-2026-09-03.md`
     before **9067** → after **11385**, delta **2318** = expected **2318** ✅ (F3)
2. **This board PR**, built in a disposable worktree off `origin/main`
   (`C:\po-worktrees\collect-20260910-0018`, branch `docs/collect-2026-09-10-0018`) — **never the
   dev tree and never the clone.** The shared dev-tree index was confirmed EMPTY
   (`git diff --cached --name-status`) and then never used. It carries:
   - **05's 2026-09-09T22:02Z breadcrumb** — the one genuinely uncollected artifact. Copied as a
     **Buffer**, read back with `Buffer.compare` → **0** (19781 bytes). No `>` redirection, no
     `Set-Content`, no length comparison across the `git show` boundary.
   - **`docs/pr-prompts/.arming-log.txt`** (10950 bytes, `Buffer.compare` → 0). [MEASURED]
     `git diff --numstat origin/main` reads **`1 0`** — insertions with **zero** deletions, i.e. the
     working copy is a strict superset of `main` and the `00:07:52Z` arm exists nowhere else. That
     is exactly the shape on which restoring to HEAD is a **silent deletion**, so it was carried
     forward whole, never restored.
   - **This breadcrumb**, written inside the worktree — cure 1 of the post-merge fast-forward rule,
     so no loose untracked copy is left in the dev tree for the next run to trip on.
3. **Auto-merge was deliberately NOT enabled on this PR.** Merging is a board mutation and
   condition 3 forbids it this run.

## FINDINGS

### F1 — A PR the watcher routed to Marco merged with NO label, so CP-26 passed vacuously and RULE 2 was backed by nothing

[MEASURED] **#1827** merged `2026-09-10T00:00:44Z` carrying a genuine watcher routing —
`{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/components/DensityControl.tsx"}`
— re-measured this run from the prompt logs rather than quoted from a note (Q4). The reason string
**names the offending file**, so this is a real `classifyPolicyFiles` rejection and not the
byte-identical timeout string DOCTRINE §10.3 warns about.

[MEASURED] `gh api repos/GH-Mantova/ProjectOperations/issues/1827/events` returns **exactly one
event: `merged`.** No `labeled`, no `unlabeled` — **`do-not-merge` was never applied.**
`Approval receipt (CP-26)` = **success**, and no `docs/decisions/merge-approvals/1827.md` exists
(71 receipts on `origin/main`, newest `1822.md`).

**The mechanism, and it is the general case rather than an edge case.** There are two ways a PR
becomes Marco's and only one is machine-enforced. `escalates: true` → the watcher applies
`do-not-merge` → `everLabeled` true → CP-26 **can** fire; that is `#1823`, genuinely gated. But a
`classifyPolicyFiles` rejection on an `escalates=false` prompt (`.arming-log.txt`: `ARMED
pr-brandtheme-s5-density-tokens-and-control escalates=false`) writes `marco:true` and applies **no
label**, so `approval-receipt.mjs` returns `PASS / NEVER_ESCALATED` **before it looks for a
receipt**. **Every ordinary `apps/**` feature PR takes that second route.**

🔴 **[CANNOT MEASURE] which actor merged #1827, and I am not guessing.** `mergedBy` reads
`GH-Mantova` for every merge here; no receipt names a lane; and the PR's own commit list carries no
post-build authored commit — its build commit reads `Marco/Claude Sonnet 4.6`, which DOCTRINE
§10.2.1 records as the **watcher's** identity, not a human's. Marco was demonstrably directing this
board that hour and is entitled to merge it. **The finding is the missing gate, not the merge.** A
prior run filed a forgery accusation off this same evidence and retracted it an hour later; this is
not that.

**ESCALATED** — appended to the existing
`needs-marco/cp26-passes-vacuously-on-an-unlabelled-destructive-migration-2026-09-05.md` rather than
filed as a fourth copy, because it is the same mechanism with a wider blast radius than the
migration case that opened it. RULE 1: the **complete-and-additive** option is to arm CP-26 off
`classifyPolicyFiles` — the **diff** — so a receipt is demanded by what the PR touches regardless of
label history; it closes this now and for every future PR and writes no data. Having the watcher
label policy-routed PRs too fixes the immediate half but fails the future half, converting a silent
gap into a throughput stop that only Marco can clear. Convention alone fails outright — that is how
this arose. **Falsifying probe:** the events call above on any merged PR whose processed log carries
`marco:true`; a `labeled` event means route 2 did not apply.

### F2 — BOARD DRIVING condition 3 is violated by a live actor, so this run drove nothing

[MEASURED], twice, four minutes apart, because `[LIVE]` means true when measured:

| signal | reading |
|---|---|
| `.arming-log.txt` newest row | `2026-09-10T00:07:52Z ARMED pr-vmgitguard-selftest-and-recursion actor=station-00.cloud-lane-1010 by=Marco@LAPTOP-E6NHU4E4 pid=7104` — **57 s before this run started** |
| `#1832` | **opened `00:12:33Z`**, i.e. between two of my own probes |
| `#1831` | **merged `00:11:11Z`**, 142 s after this run started |
| `#1824` | touched **0.8 min** ago, then **2.5 min** ago |
| `origin/main` | `640dbdd3` → **`f6478962`** during this run |
| `index.lock` (both trees) | False / False · running `git` processes: 2 |

Marco's supervised cloud lane is hand-driving this board right now — arming, opening and merging
inside the same minutes I was measuring. **Condition 3 is the only thing standing between a
single-actor design and LL-38, and "I am the only station that runs" is exactly the reasoning it
forbids.** `#1824` is docs-only, green, hand-classifies as mine and is merge-eligible under the
ACTIVE DRIVE MANDATE; merging it out from under the lane that opened it — and triggering
`pollForBehindPrs` across three open PRs while that lane works — is the collision rather than the
cure.

**DEFERRED** — to the next 00 occurrence or to the lane that opened it, whichever reaches it first.
`#1824` is green and nothing about it expires. **It becomes urgent only if it is still open with no
live actor**, which is the condition the next run should test first.

### F3 — Collect: Station 05's 2026-09-09T22:02Z breadcrumb, the only uncollected artifact on disk

- **F1** (a catch-up burst fired 04 and 05 **0.555 s** apart, and a cron offset cannot separate a
  catch-up burst) — **ESCALATED**, appended to the existing
  `needs-marco/station-schedule-collision-04-and-05-2026-09-03.md` as 05 asked, not opened as a new
  file. The point that changes the ask is real: that escalation reasons entirely about cron
  **minutes**, and a drained backlog has no cron minute in it, so the remedy on file is necessary
  and **not sufficient**.
- **F2** (`sot/04` was two schema commits behind) — **ACTIONED, and verified independently on
  `main` this run**: `origin/main:sot/04-data-model.md` now reads `Models: 296 | Enums: 69 |
  FK edges: 493`. `#1828` merged `00:06:18Z`.
- **F3** (the NAV-5 hold is unblocked and retiring it is board mutation, not 05's) — **DEFERRED, and
  the hazard is measured zero**: `lint-prompt.mjs` returns `STALE … ALREADY DONE`, **exit 3**, so it
  cannot be armed by anyone. Retiring it to `superseded/` is housekeeping for a run that holds the
  board, and this run does not (F2).
- **F4** (`sot/02`'s In-PR table rotted again inside 24 h; the generated-block fix stays dispatched
  to 00 from 2026-09-07) — **DEFERRED**, unchanged. It needs `SOT02-INPR:BEGIN/END` markers plus a
  `--check` in `pipeline-tests`, i.e. a `scripts/` change, which is outside this station's lane to
  merge and does not belong inside a collect PR.
- **F5** (`github-projectops` MCP rejected for a second consecutive run) — **ESCALATED, and
  CORROBORATED a third time**: this session reports the identical string,
  `plugin:github-projectops:github-projectops (400): "Error POSTing to endpoint: bad request:
  Authorization header is badly formatted"`. `gh` and the generic GitHub MCP both worked throughout,
  so GitHub access as such is healthy. 05's `needs-marco/` file already exists and is not duplicated.
  ⚠️ Still **not** the `cowork-projectops` PAT expiry (2026-09-30) — a header-format rejection is not
  an expiry, and conflating the two would retire a live question.

**DISPATCHED / ESCALATED as itemised.** 05's breadcrumb is committed in this PR, which is what
makes any of it readable by a clone, by CI or by the next station.

### F4 — The Linux sandbox has failed to start on three consecutive station runs and the git guard cannot be installed

[MEASURED] this run, by 05 at `2026-09-09T22:02Z`, and by 00 at `23:08Z` — the identical
`Plan9 share "c" which is not mounted` failure. The consequence is bounded and worth stating
precisely: the guard exists to stop a VM-side `git` call leaving a 0-byte `index.lock` with no
owning Windows process, and **with no VM there is no such call to make**, so the hazard is
unreachable rather than unguarded. `index.lock` was measured absent in both trees this run.

What it does cost is the blind-run COLLECT path `STATION-CAPABILITIES.md` §3 documents: a future
**blind** run has no mount either, so it would have neither Desktop Commander nor the mount, and its
ceiling would drop from "can read everything, can mutate nothing" to genuinely nothing.

**DEFERRED** — three reports now agree on the symptom and none has a cause. It is infrastructure
outside the repo, so it needs a `needs-marco/` file to be escalated to anybody rather than a fourth
breadcrumb mention; that file is **not** written here because a fourth consecutive occurrence, or
one coinciding with a blind run, is the point at which it stops being noise and starts being an
outage. Naming the threshold rather than leaving it to judgement is the whole of this disposition.

## WHAT I DID NOT DO

- **Merged nothing.** `#1823` carries a live watcher `marco:true` verdict — RULE 2 binds, and its
  `labels=[]` does not clear it. `#1832` hand-classifies as Marco's (`scripts/`, outside all three
  `NESTED_TEST_PATHS` forms). `#1824` is mine and was left for condition 3 (F2).
- **Armed nothing.** Real armed count 0 at the start and 0 at the end; the single `*-ready.md` on
  disk is `rev-1832-ready.md`, a review job. Station 04's 2026-09-09T22:02Z F1 — the arming linter
  giving two opposite verdicts on one unchanged prompt eight minutes apart, erring toward ARM —
  remains unreproduced and unrefuted, so arming on a single ADMIT is still acting on an instrument
  under active suspicion.
- **Did not retire `pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md`** or any other spent prompt, and
  did not run `triage-holds.ps1` for arming candidates. Board mutation, condition 3.
- **Did not remove the dev tree's now-redundant copy of the 2345Z breadcrumb.** It is byte-identical
  to a blob already on `main`, so the delete-the-disk-copy cure applies — but that cure ends in a
  fast-forward of the shared dev tree, which is a mutation of the tree another actor is working in.
  The next run that holds the board should do it; until then it is a known FF blocker, named here so
  it is not re-diagnosed from first principles for the fifth time.
- **Did not fast-forward the dev tree** (1 behind), for the same reason.
- **Did not touch the watcher, the clone, `C:\po-vg`, or any worktree but my own**, and did not run
  `restart-watcher-if-wedged.ps1` with `-Fix`. The verdict was `OK`, which is not a restart condition.
- **Did not commit `docs/data-model/metadata-catalog.json` or `docs/pipeline/sweep-rotation.json`.**
  Neither was measured this run and neither belongs in a PR built off `origin/main` without one.
- **Did not edit DOCTRINE §9.** The five 04 findings that want §9.1/§9.2/§9.5 bullets are inside the
  `instruments v2` canonical block, which needs its hash re-recorded with
  `lint-station.mjs --write-canonical` and shipped on its own.
- **Did not file a new `needs-marco/` file for F1 or F3.** Both append to the escalation that
  already owns the mechanism, which is the standing rule and the reason those two files stay
  readable.

# Station 00 — Supervisor | 2026-08-31T18:08Z–2026-08-31T18:5xZ

## GROUND

```
UTC            2026-08-31T18:08:58Z
origin/main    f4f6ddc6            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ f4f6ddc6     C:\ProjectOperations2   (== origin/main; no FF needed)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** (1 = 1). Desktop Commander connected on the first call —
this was a **SIGHTED** run, the first since 14:45Z (16:09Z was blind).

## WHAT I MEASURED

| Claim | Command | Verdict |
|---|---|---|
| Box reachable | `start_process` shell `powershell.exe` → PID 16920 | **[MEASURED]** SIGHTED |
| `origin/main` | `git fetch origin --prune; git rev-parse --short origin/main` | **[MEASURED]** `f4f6ddc6` |
| Dev tree == `origin/main` | `git rev-parse --short HEAD` | **[MEASURED]** `f4f6ddc6`, identical |
| Working copy of the three binding docs == `origin/main` | `git status --porcelain` lists neither `docs/pipeline/**` nor `docs/pr-prompts/**` as modified | **[MEASURED]** safe to read from the tree |
| Sweep verdict | `scripts/pipeline/status-sweep.ps1` @18:09:46Z | **[MEASURED]** `SAFE TO ACT`; in-progress prompts 0, `index.lock` false/false, git processes 0, no PR touched in 2 min |
| Watcher | `scripts/restart-watcher-if-wedged.ps1` (no `-Fix`) | **[MEASURED]** `ALIVE (pid 32916)`, armed 0, restart churn 0, `VERDICT: OK` |
| Breadcrumb contract + freshness | `node scripts/pipeline/check-breadcrumb.mjs --freshness` | **[MEASURED]** exit 0 **CLEAN**; structure 7 checked, 0 malformed; no station SILENT (00 2.0h · 03 19.2h · 04 4.0h · 05 4.0h) |
| Worktrees | `git worktree list` | **[MEASURED]** only the dev tree — **no orphans, and no live station worktree** |
| Board | `gh pr list --state open --json …` | **[MEASURED]** exactly two open: **#1443**, **#1450**, both `CLEAN`, neither draft |
| Per-PR truth (the rollup is cached — §9.4) | `gh pr view <n> --json labels,mergeStateStatus,mergeable,statusCheckRollup` | **[MEASURED]** both `CLEAN`/`MERGEABLE`, **13/13 SUCCESS**, **labels `[]`** on both |
| RULE 2 routing, re-measured live | `Select-String processed\*.log -Pattern '"marco":true' -SimpleMatch` | **[MEASURED]** POS **591**, NEG control `zzzNoSuchNeedleZzz` **0** |
| — #1450 | same corpus | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/pages/crm/AccountDetailPage.tsx"}` |
| — #1443 | same corpus | `{"ok":false,"marco":true,"reason":"escalates:true - PR already carries \`do-not-merge\` - no duplicate apply"}` |
| Label-removal count on #1443 | `gh api …/issues/1443/timeline?per_page=100` (see F3) | **[MEASURED]** labeled 08:22:23Z, unlabeled 09:35:36Z, **nothing since** — count stays **SIX** |
| ARMED, before | `Get-ChildItem docs\pr-prompts -Filter *-ready.md -File` | **[MEASURED]** **0** |
| ARMED, after | same | **[MEASURED]** **1** — `pr-lint-not-a-prompt-ready.md` |
| Live HOLDs | `Get-ChildItem docs\pr-prompts -Filter *-HOLD.md -File` | **[MEASURED]** **60** before the arm |

**The banked RULE 4 detector was re-validated, not merely quoted.** The bank is valid only while
`scripts/pipeline/lint-prompt.mjs` is unchanged on `main`:
`git log -1 origin/main -- scripts/pipeline/lint-prompt.mjs` → **`1a62c86d` 2026-08-31 01:21:53Z**
(#1414), i.e. unchanged since the 14:08Z run banked it. Re-run live anyway:

- lint **ADMIT exit 0** (`node scripts/pipeline/lint-prompt.mjs docs\pr-prompts\pr-lint-not-a-prompt-HOLD.md`)
- premise alive — `git grep -c NOT_A_PROMPT origin/main -- scripts/pipeline/lint-prompt.mjs` → **exit 1, no hits**,
  positive control `NO_FRONT_MATTER` → **1 hit, exit 0**
- marker union, **all three** markers, case-sensitive (`watcher: do-not-arm`, `DO NOT ARM`, `Arm ONLY`)
  → **0** on the target, **2** on the positive control `pr-524-rates-b-slice2-canonical-HOLD.md`
- body read in full: no prose gate; `## STANDING AUTHORITY` present as boilerplate, which is **not**
  an arming grant (retracted 2026-08-28); `escalates: false`, no `requires_*`, `size: 3`,
  `scope: scripts/pipeline/**`

**COLLECT.** One breadcrumb was outstanding: the 16:09Z blind run's, **untracked** on disk. Its four
findings are dispositioned in FINDINGS below and the file is committed by this PR. Nothing else has
been written since 14:45Z; 04's 1410 and 05's 1411 were already dispositioned at 14:45Z and are
archived by this PR.

## WHAT CHANGED

1. **ARMED `pr-lint-not-a-prompt-HOLD.md` → `pr-lint-not-a-prompt-ready.md`**, via
   `scripts/pipeline/arm-prompt.ps1 -Name pr-lint-not-a-prompt` (`-WhatIf` first, exit 0; then live,
   exit 0). Read back: **armed 0 → 1**, the file on disk is `pr-lint-not-a-prompt-ready.md`, and
   `git diff --cached --name-status` is **empty** afterwards.
2. **This PR**: commits the 16:09Z breadcrumb, adds this one, and `git mv`s the six dispositioned
   breadcrumbs (00's 1209/1408/1425/1445, 04's 1410, 05's 1411) into `docs/pr-prompts/archive/`.

Nothing else. No merge, no label, no `sot/` edit, no watcher restart, no dispatch executed on the box.

## FINDINGS

### F1 — The banked arm was spent. `pr-lint-not-a-prompt` is armed and the watcher is alive to run it

Parked across two runs (14:08Z self-retracted under the single-actor rule; 16:09Z blind). This run
had all four preconditions at once: sighted, `SAFE TO ACT`, **no worktrees**, watcher `ALIVE`, armed
0, index clean, zero git processes — re-measured immediately before the arm, not quoted from the
sweep five minutes earlier.

**DISPOSITION: ACTIONED.** Verified by read-back: `armed 0 → 1`; `pr-lint-not-a-prompt-ready.md`
present at depth 1 (the only depth the watcher globs); the index left clean. This also discharges
**F2 of the 16:09Z breadcrumb**. The falsifier for the next run: if `armed` reads 0 and no PR exists
whose branch touches `scripts/pipeline/lint-prompt.mjs`, the arm was lost and must be re-made.

### F2 — `arm-prompt.ps1` now RELEASES the staged rename, which retires a standing board trap

Memory has carried this trap since 08-30: *"a consumed or burned prompt leaves a staged
`R100 HOLD→ready` with no file on disk, and a pathspec-less commit publishes it to main as tracked
and ARMED."* The cure was manual — spot it with the `RD`-not-` D` probe and `git restore --staged`.

**The script now does it unprompted.** Its live output this run, verbatim:

```
[arm-prompt] Index contains exactly the two expected paths. Ready to commit.
[arm-prompt] Audit line written to .arming-log.txt
[arm-prompt] Releasing staged rename from index (ARM_INDEX_RELEASED) ...
[arm-prompt] Index clean after release - no staged paths remain.
```

`git diff --cached --name-status` after the arm returned **empty** — measured, not assumed. So an arm
made through the sanctioned script can no longer seed that trap. **The trap is NOT dead**: a bare
`git mv` still seeds it, and this run did not test what the index looks like after the *watcher*
consumes the prompt. Both remain reasons to keep the probe.

**DISPOSITION: ACTIONED** — recorded here so the next run stops budgeting for a manual
`git restore --staged` after every arm through the script. Read-back: the empty `--cached` diff above.

### F3 — `gh api … --paginate | ConvertFrom-Json` returned EMPTY at exit 0. A control caught it

Asking whether #1443's `do-not-merge` label had been removed a **seventh** time, the first query —
`gh api repos/…/issues/1443/timeline --paginate | ConvertFrom-Json | Where-Object …` — printed
**nothing at all**, no error, exit 0. Read at face value that is *"the label was never touched"*,
which contradicts a fact the pipeline has measured six times.

Re-asked with a positive control: `gh api …/issues/1431/timeline?per_page=100 | Out-String |
ConvertFrom-Json` → **14 events**, including the known `labeled 05:40:02Z` / `unlabeled 05:53:54Z`
pair on **#1431**. The same form on **#1443** → **30 events**, `labeled 08:22:23Z` /
`unlabeled 09:35:36Z` by `GH-Mantova`, and **nothing after**. So: the removal did **not** recur, the
count stays at **SIX**, and the empty first answer was the *query* failing, not the world being empty.

Cause is the `--paginate` + pipe combination handing `ConvertFrom-Json` concatenated JSON documents
through the PS 5.1 pipeline; `?per_page=100 | Out-String | ConvertFrom-Json` answers correctly. Same
family as DOCTRINE §9.4's `--jq` and assign-then-foreach bullets, and a textbook §9.6.

**DISPOSITION: DEFERRED.** One sighting, and the working form is already implied by §9.4's
*"take raw `--json` and `ConvertFrom-Json`"*. It becomes a DOCTRINE bullet the moment a second
station hits it, or the first time an empty `--paginate` result is written into a report as a
finding. Trigger stated so the next reader can close it.

### F4 — Both open PRs are Marco's. The board has nothing this station may merge

Re-measured live this run, not carried from 14:08Z: **#1443** `{"marco":true,"reason":"escalates:true"}`
and **#1450** `{"marco":true,"reason":"outside tests/ or docs/"}`, POS control 591, NEG control 0.
Both are `CLEAN`/`MERGEABLE` at **13/13 SUCCESS** with no labels — i.e. green, unlabelled, and still
**not mergeable by automation**, exactly the state RULE 2 exists to describe. Neither was touched.

**DISPOSITION: DEFERRED** — they wait on Marco, per RULE 2 and STATION-CAPABILITIES §5. Nothing to do
until he clears that batch in chat. They read `BEHIND` at the end of the 14:08Z run and read `CLEAN`
now with no action from any station, which is a further datum for §9.4's *"the rollup is a cached
lag, confirm per-PR"* note.

### F5 — Station 03 is 19.2 h stale with an undelivered dispatch, and crosses its cadence in ~5 h

`--freshness` reports `03  last 2026-08-30T23:01:00Z  19.2h ago  (cadence 24h)  ok` — and it will go
on saying `ok` until **48 h** (2026-09-01T23:01Z), because SILENT is 2× cadence. The dispatch it is
carrying is still undelivered: the watcher clone's `git branch -r` 69 vs `git ls-remote` 25 ⇒
**44 phantom refs, up from 33 in two days**, plus 55 stash entries and `dirty=2` (04, 14:1xZ).

**DISPOSITION: DEFERRED.** Trigger unchanged from the 16:09Z breadcrumb's F3 and now ~5 h away:
**03 posting nothing by 2026-09-01T00:00Z (24 h)**, at which point the next sighted 00 treats it as
overdue by policy rather than waiting for 48 h, and re-dispatches the phantom-refs measurement.

### F6 — The 16:09Z blind run's own findings, dispositioned

Collected in full. **F1** (Desktop Commander `CONNECT_TIMEOUT` 30 s, *and* `Prisma-Local` timing out
in the same window ⇒ ask whether the two local stdio servers share a launcher) → **ESCALATED**, folded
into the standing DC-blindness escalation, which is Marco's and already open; this run adds one datum
to it — **the very next run was sighted on the first call**, so the failure is intermittent per-run,
not a persisted broken state. **F2** (banked arm unspent) → discharged by F1 above. **F3** (03's
cadence blind spot) → carried forward as F5 above. **F4** (a blind run cannot validate its own
breadcrumb, so it was hand-checked and explicitly did not claim `breadcrumb-clean`) → **ACTIONED**,
and the read-back it asked for is delivered: `check-breadcrumb.mjs --freshness` exited **0 CLEAN**
this run with that file among the 7 structurally checked and 0 malformed.

**DISPOSITION: ACTIONED** — the breadcrumb is committed by this PR, so it now reaches somebody, and
its four findings are closed or carried with dated triggers.

## WHAT I DID NOT DO

- **Did not merge #1443 or #1450.** RULE 2. Green, CLEAN, unlabelled and 13/13 is not clearance.
- **Did not touch the `do-not-merge` label** on anything, in either direction.
- **Did not arm a second prompt.** RULE 4 is one at a time. `pr-sweep-worktree-liveness-HOLD.md`
  (ADMIT, size 3 — fixes both the orphan-worktree mislabel and the TRUNK-IS-RED title-grep) stays
  staged and **UNARMED**, and is the obvious next arm once this one is consumed.
- **Did not clear the eleven `[STALE]` escalation files** the sweep §5 named as DEAD. They live under
  `docs/pr-prompts/needs-marco/`, which is gitignored (`.gitignore:76-83`), so they reach nobody but
  this box, and deleting Marco's escalation folder unasked is not this station's call. DEFERRED.
- **Did not FF the watcher clone.** That needs the watcher STOPPED, and it is mid-lane with a prompt
  just armed. It is 03's lane besides.
- **Did not chase `M docs/data-model/metadata-catalog.json`.** Known CRLF stat-dirt, not drift.
- **Did not edit `/sot/`** — never 00's.

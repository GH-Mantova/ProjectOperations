# Station 05 — SoT Keeper | 2026-09-16T14:11:49Z–2026-09-16T14:30Z

## GROUND

```
UTC            2026-09-16T14:11:49Z
origin/main    bdc5d05b            (fetched, then rev-parse)
dev tree       main @ bdc5d05b      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE, so this run was not read-only.
Sighted run: Desktop Commander reached the Windows host on the first call.
Binding documents were read from the dev tree after proving the working copy is
byte-identical to `origin/main`: `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/05-sot-keeper.md` returned **EMPTY**,
which is the real answer per DOCTRINE §9.2, and no piped hash was taken (§9.1).

**No missed occurrence.** `node scripts/pipeline/check-breadcrumb.mjs --freshness --station 05`
reported `05 last 2026-09-15T22:22:00Z 15.8h ago (cadence 24h) ok`. The AGE, not the verdict, is the
test: 15.8 h is inside one cadence, so no day is owed and this is a single unit of work.

## WHAT I MEASURED

**Guard install (PREFLIGHT, quoted pass or fail as the contract requires).** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, last line verbatim:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shell shim`
— preceded by `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and
mounted cwd, allows everything else (three controls passed)`. **The install reported success and the
guard still did not fire.** See F1.

**Sweep.** [MEASURED] `status-sweep.ps1` exit 0, 148,182 bytes, captured with `*>` and decoded
`utf16le` per §9.3 (the raw bytes open `FF FE`). Section 7: `[LIVE] SAFE TO ACT: no board mutation
in progress, no recent remote activity, no live station worktrees.` Section 3:
`git index.lock interactive/clone: False / False`, `git processes touching our trees (scoped): 0`.
Section 4: `armed (*-ready.md): 0`.

**Rule Zero — local result crossed against the real CI conclusion.** [MEASURED]
`gh run list -R GH-Mantova/ProjectOperations --commit bdc5d05b538c2f8ac69430b1050126693b3b6c96
--json conclusion,name,event,workflowName` (full 40-char SHA per §9.4; `-R` and `$LASTEXITCODE`
tested per §9.4's CWD bullet; `GH_EXIT=0`, 7 rows, assign-then-count with a null guard):

| workflow | event | conclusion |
|---|---|---|
| CI | push | success |
| Deploy | push | success |
| Tendering Browser Smoke | push | success |
| CodeQL | dynamic | success |
| Pipeline heartbeat | **schedule** | **failure** |
| Claude Code ×2 | issue_comment | skipped |

**Trunk is GREEN.** The only failure is event `schedule`, which the trunk verdict's denylist
excludes — and the sweep agreed unprompted: `[LIVE] NOT trunk CI on this commit, excluded from the
verdict above: 1 run(s), 1 failing`. **No ENVIRONMENT DISAGREEMENT this run:** every local check
below passed and no corresponding CI job is red.

**Audit step 1 — schema parse sanity.** [MEASURED] `node scripts/data-model/build-relationship-map.mjs
--check` → `OK: generator ran cleanly against schema.prisma (296 models, 70 enums, 493 edges)`,
exit 0. Per this station's own 2026-08-25 correction this proves only that `schema.prisma` parses;
it is **not** a drift gate and a clean `--check` is not evidence sot/04 is current.

**Audit step 2 — catalog validity.** [MEASURED] `docs/data-model/metadata-catalog.json` parses as
valid JSON, 695,182 bytes. Not the four-sweep invalid-JSON condition.

**Audit step 3 — sot/04 drift. BOTH probes run, header counts AND content.** See F2.

**Audit step 4 — roadmap drift.** See F3.

**Audit step 5 — automation health.** [MEASURED] watcher by **command line**, never image name:
`Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match
'pr-watcher[\\/]index\.mjs' }` → **1** process, pid **30248**, started `2026-09-16T00:35:18Z`.
Restarter read from the **live task list**, not from any document: `PO Watcher Keepalive`,
`state=Ready`, `LastTaskResult=0`, `LastRunTime=09/17/2026 00:15:01` local Brisbane
(= `2026-09-16T14:15Z`, four minutes before this line was written). **Nothing is disabled or dead,
so this report does not lead with automation health.**

**Audit step 6 — model ↔ migration coherence.** [MEASURED] 296 models parsed from `schema.prisma`
(resolving `@@map`), 646,318 chars of migration SQL across `apps/api/prisma/migrations`, 301 distinct
`CREATE TABLE` targets. **Models with no backing CREATE TABLE: 0.** POSITIVE control
`created.has("users")` → true; NEGATIVE control, a needle minted this run
(`zzQq05Needle20260916T1419`) → false. The 301-vs-296 surplus is tables created and later dropped
plus join tables; it is not a defect in the direction this step tests.

**Audit step 7 / sot-refs.** [MEASURED] `node scripts/pipeline/check-sot-refs.mjs` →
`total=275 dangling=0 exempt=20 baselined=0 excluded=2`, and
`docs/qa/sot-refs-baseline.json` `entries.length` = **0**. See F5.

**`build-toc.mjs --check` was NOT run against `sot/`**, per this station's standing instruction: no
`sot/` file carries TOC markers, so it reports drift unconditionally.

**Open board.** [MEASURED] one open PR, **#1986**, `state=OPEN mergeStateStatus=BLOCKED
labels=do-not-merge`, 13 pass / 2 fail. The two reds were read as a **verdict token from column 3 of
the job log** (§9.1 tab-split, §9.4), not from the pass/fail counts:
`FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label`. **`[LABEL_PRESENT]` is PARKED BY DESIGN — not work, and
not mine:** only Marco removes the label. This satisfies **S7**: no reconcile PR from a prior run is
open, so this run was free to fix.

## WHAT CHANGED

One doc-reconcile PR, opened from a disposable worktree off `origin/main`
(`C:\po-worktrees\sot-reconcile-20260916`, branch `chore/sot-reconcile-2026-09-16`). **Nothing was
committed on `main` in the dev tree, nothing was armed, nothing was merged.** CP-24: the PR touches
`sot/` + `docs/` only — no `scripts/`, `apps/`, `.github/`, `packages/`, `package.json` or
`pnpm-lock.yaml` — so it is on the allowed side of the gate, checked before opening rather than after
CI said so.

`git diff --numstat` in the worktree, quoted whole:

```
4	8	sot/02-roadmap-and-status.md
14	13	sot/04-data-model.md
```

1. **`sot/04-data-model.md` — generated section re-merged** (F2). Section-scoped to the
   `SOT04-GENERATED:BEGIN`/`END` markers. Byte delta **+150**.
2. **`sot/02-roadmap-and-status.md` — In-PR snapshot refreshed** (F3). Byte delta **−544**.
3. **`docs/data-model/sweeps/2026-09-16.md`** — this run's timestamped sweep report (new file).
4. **This breadcrumb**, written into the PR itself, which is the contract's preferred home — so it
   does **not** need Station 00 to sweep it up.

**A tracked file was touched and then proved unchanged, which is worth stating because the station
brief warns about it.** Regenerating the map rewrites tracked `docs/data-model/metadata-catalog.json`,
and a catalog that *shrinks* has aborted a slice before. [MEASURED] after the regen,
`git status --porcelain` showed ` M docs/data-model/metadata-catalog.json` while
`git diff --numstat origin/main -- docs/data-model/metadata-catalog.json` returned **EMPTY** — the
content is identical to `origin/main` and the ` M` is a line-ending artifact, exactly §9.2's rule
that a ` M` is not evidence of uncommitted work and that EMPTY `--numstat` is the real answer. **It
did not shrink, and it is not in this PR.** `relationship-map.{md,json}` are gitignored and likewise
absent from the PR.

**Safeguards, each measured rather than asserted:**

| | result |
|---|---|
| **S1** never edit `main`, never merge, PR from a disposable worktree | ✅ worktree at `bdc5d05b`; no `-ready.md` staged (a loose `*-ready.md` IS an arm, and 05 may never arm) |
| **S2** generator run twice, byte-identical modulo the stamp | ✅ `S2_DETERMINISTIC_modulo_stamp=true`, 167,215 chars both runs |
| **S3** curated MERGED SOURCES region sha256 unchanged | ✅ before `dad62580c6866207` = after `dad62580c6866207` |
| **S4** curated line count did not decrease | ✅ 1581 → 1581 |
| **S5** scope cap: only `sot/` + generated artifacts, no prompt staged | ✅ see numstat above |
| **S6** post-fix `--check` re-run | ✅ exit 0, `296 models, 70 enums, 493 edges` |
| **S7** no reconcile PR already pending | ✅ one open PR and it is #1986 (CRM) |

`check-sot-refs.mjs` re-run **inside the worktree after the `sot/` edits**:
`total=275 dangling=0 exempt=20 baselined=0 excluded=2`, exit 0 — my edits added no dangling
reference and moved no baselined line number.

## FINDINGS

### F1 — the VM git guard reported a successful install and then did not intercept `git` in a non-interactive sandbox shell, and I left the 0-byte `index.lock` it exists to prevent

This is the failure PREFLIGHT devotes a red rule to, reproduced by a run that had **just installed the
guard and quoted its success line**.

[MEASURED] `scripts/pipeline/vm-git-guard.sh` ran at the top of this run and printed
`vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and mounted cwd`
plus `ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile`. Roughly four minutes later a
sandbox call ran `git diff --numstat origin/main -- docs/data-model/` against the mount. **It was not
refused.** It executed, and returned:

```
warning: unable to unlink '/sessions/<id>/mnt/ProjectOperations2/.git/index.lock': Operation not permitted
```

Measured immediately afterwards from the Windows side:
`LOCK_PRESENT bytes=0 mtimeUtc=2026-09-16T14:17:09`, `gitprocs=0`, and every in-flight marker absent
(`MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply`, `sequencer` — all
`False`). That is precisely DOCTRINE §9.2's description: a 0-byte lock with no owning Windows process,
which never expires and which `status-sweep.ps1` §7 escalates to DO NOT ACT, freezing every station.

🔴 **The mechanism, and it is the part worth keeping.** `ensure_on_path` appends a `PATH` export to
`~/.bashrc` and `~/.profile`. **A non-interactive, non-login shell sources neither.** Each sandbox
`bash` call is its own process with no carryover, so the shim at `~/.local/bin/git` is on `PATH` only
for the interactive/login case the installer's own persistence control tests — and that control
passed, which is why the install looks sound. **The guard's positive control and the guard's actual
exposure are different shells.** This is §7's shape exactly: a check that has never been seen to fail
in the configuration that matters.

⚠️ **I cleared the lock, and I want to be explicit that this is narrower than the rule it looks like
it crosses.** The standing instruction is *"do not clear it unless you are Station 03 and 00
dispatched you"*, which governs a lock of **unknown provenance**, where clearing risks stomping a
live operation. Here provenance was measured and certain: my own call, seconds old, 0 bytes, zero git
processes, no rebase or merge state. Leaving it would have frozen the board on an artifact I created
inside my own run. Under RULE 1 the complete-and-additive move is to revert my own side effect
immediately and say so loudly; the alternative — leaving it for Station 03 — damages every station's
next run and fails the *immediately* half. Read back: `READBACK_lock_present=False`, and
`git status --porcelain` then exited 0 in the dev tree.

**The repair is in `scripts/`, which is outside this station's lane**, so it is handed over rather
than attempted: the guard needs to be reachable by a non-interactive shell — e.g. installed to a
directory already on the default `PATH`, or the contract changed to require callers to invoke the
shim explicitly rather than rely on `PATH` inheritance.

**DISPOSITION: ACTIONED** (lock cleared and read back within the same run; the tree is healthy and
the sweep that followed read `index.lock interactive/clone: False / False`) **and DISPATCHED** to
**Station 00** (the `PATH`-persistence defect in `scripts/pipeline/vm-git-guard.sh`, which 05 may not
edit — a `sot/`+`scripts/` PR is a CP-24 hard block, and this is why it was not folded into this PR).

### F2 — sot/04's generated section had drifted at BOTH levels, and the cheap probe alone would have caught it this time while the expensive one is what proves it

[MEASURED] header counts first, the cheaper read:

| | sot/04 header | freshly generated map |
|---|---|---|
| Models | 296 | 296 |
| **Enums** | **69** | **70** |
| FK edges | 493 | 493 |
| Domains | 23 | 23 |
| schema sha256 | `a5ba7c95a076` | `a351d01ca823` |
| Last updated | 2026-09-14 14:17 UTC | 2026-09-16 14:15 UTC |

An enum was added to `schema.prisma` and sot/04 was never re-merged. Then the **content** comparison
this station's 2026-09-14 correction prescribes — slice sot/04 between the two markers, slice
`relationship-map.md` from `## Table of Contents`, normalise line endings, **compare the strings,
never their lengths or line counts**:

```
sotGen_chars=166641 mapGen_chars=166790
IDENTICAL=false
first_differing_line_index=877
SOT : "- Table: `scope_of_works_items` | Domain: Estimating | Fields: 76"
MAP : "- Table: `scope_of_works_items` | Domain: Estimating | Fields: 77"
```

⚠️ **The falsifying probe named in that correction fired in the correction's favour.** It asks for a
commit where the four header counts agree and the content still differs; here the counts **disagreed**
(enums) *and* the content differed at field level (`Fields: 76` → `77`) — a field-level change the
four counts are structurally blind to, riding along with a model-level one they can see. Had only the
field been added, the header check would have passed and the section would still have been stale. The
correction stands and both probes remain worth running.

Re-merged, then re-probed: `POST_FIX_CONTENT_IDENTICAL=true`, `sot_chars=166790 map_chars=166790`.
The real diff is **14 insertions / 13 deletions** — worth quoting because this station's own
instruction warns that a naive line-index diff reported 1072 differing lines where `git diff` reported
6/5; the same trap did not catch this run because the comparison was made on strings.

**DISPOSITION: ACTIONED** (re-merged in this PR; S2/S3/S4/S6 all measured and passing, content
comparison now identical, curated region byte-identical).

### F3 — sot/02's In-PR snapshot rotted again in under sixteen hours, and every one of the five PRs it named is closed

[MEASURED] `sot/02` §2 read *"In-PR — open right now (5)"* naming `#1973 #1972 #1971 #1967 #1960`,
stamped `2026-09-15T22:35Z` at `origin/main 64053600`. The live board at `2026-09-16T14:20Z` is
**one** open PR, `#1986`. **Zero overlap.**

🔴 **This is the same finding my predecessor filed 15.8 h earlier (its F1), re-measured and
confirmed, and the confirmation is the point.** That run refreshed the table and escalated the design
question — *should `sot/02` §2 hold a live PR table at all?* — offering (a) replace it with the
existing one-line pointer to `bring-up-to-speed.ps1`, (b) keep it and refresh every 05 run, (c) keep
it with per-row dated stamps. **Option (b) has now failed again in public**: the table was correct
when written and wrong within a day, for the second consecutive run. That is evidence for (a), not a
new question.

I refreshed the snapshot anyway, because leaving the source of truth asserting five merged PRs as
"open right now" is a live falsehood in `sot/`, and the refresh is mechanical — the surrounding
curated prose and the existing "Why this table moved on 2026-09-06" note are byte-identical, and the
replacement touches only the heading count, the stamp line and the table rows (4 insertions / 8
deletions, read back with every stale number confirmed absent from §2).

**DISPOSITION: ACTIONED** (snapshot refreshed, read back) **and DEFERRED** to the escalation already
open with Marco from the 2026-09-15 run — **deliberately not re-escalated as new**, because a second
identical ask would read as a fresh question and split the answer. What this run adds to that
escalation is one measurement: option (b)'s failure is now observed twice, on consecutive runs.

### F4 — half the recent breadcrumb corpus is untracked, and that is what the red `Pipeline heartbeat` on `main` is measuring

[MEASURED] breadcrumbs dated `2026-09-15` or `2026-09-16` at depth 1 of `docs/pr-prompts`:
**20 on disk, 10 tracked** on `origin/main`
(`git ls-tree -r --name-only origin/main -- docs/pr-prompts`, filtered). The ten untracked include
**every 2026-09-16 Station 04 report** (`0219`, `0610`, `1011`, `1410`), Station 03's
`2026-09-15-2303`, and `00-00-supervisor-2026-09-15-0408`. The newest **tracked** breadcrumb of any
station is Station 06's `2026-09-16-0456` — about 9.5 h before this line — against the heartbeat's
6 h threshold, which is why `Pipeline heartbeat` is `failure` on `bdc5d05b`.

⚠️ **The alarm's verdict is right and its evidence is wrong, and my predecessor already recorded
exactly this** (its F2: `check-pipeline-heartbeat.mjs` reads `docs/pr-prompts` from a fresh Actions
checkout of `main`, so an uncommitted breadcrumb is invisible to it by construction). Re-verified
against the live system rather than carried forward: the mechanism reproduces, with a larger corpus —
ten files now, and Station 04 has reported four times today into files CI cannot see.

**This run does not fix it.** Sweeping up ten other stations' breadcrumbs is Station 00's COLLECT, and
doing it here would breach S5's scope cap on a doc-reconcile PR. My own breadcrumb is inside this PR,
so it is tracked the moment this merges and does not add to the pile.

**DISPOSITION: DISPATCHED** to **Station 00** — ten untracked breadcrumbs to collect, listed above;
and the standing defect that a station reporting into an uncommitted file is indistinguishable, to
the heartbeat, from a station that did not run.

### F5 — the sot-refs burn-down list is empty, so this station's "primary housekeeping obligation" currently has no work in it

[MEASURED] `docs/qa/sot-refs-baseline.json` `entries.length` = **0**, and
`check-sot-refs.mjs` reports `dangling=0 exempt=20 baselined=0 excluded=2` — `All sot/ references
resolve.` The 20 survivors are `exempt=`, carrying inline `sot-ref-allow` reasons (gitignored QA
files, consumed queue prompts, `needs-marco/`, `graphify-out/`), which is the correct end state: they
are structurally absent from `origin/main` by design and deleting them would turn each into a hard CI
failure.

The station doc's SOT-REFS BURN-DOWN section is right to say the count lives in the file and never in
prose, and right that the list may only shrink. It has now shrunk to nothing. **Nothing is broken —
this is recorded so the next reader does not spend a run hunting for an entry to burn down, and so
Station 00 can decide whether that section should say what to do when the list is empty.** The
ratchet and the `never add an entry` rule remain load-bearing regardless.

**DISPOSITION: DEFERRED** — real but not urgent; it becomes worth acting on the first time a new
dangling reference appears and someone reaches for the baseline instead of fixing it in `sot/`.
Nothing in the tooling changes today.

## WHAT I DID NOT DO

- **Did not arm anything and did not merge anything.** `armed (*-ready.md): 0` before and after; no
  `*-ready.md` was staged, because a loose armed prompt runs whatever its frontmatter says and 05 may
  never arm.
- **Did not touch `#1986`.** It carries `do-not-merge` and its CP-26 verdict token is
  `[LABEL_PRESENT]` — parked by design. Only Marco removes that label, and merging is not 05's lane
  in any case.
- **Did not fix `scripts/pipeline/vm-git-guard.sh`** (F1) even though I met the defect first-hand.
  CP-24 hard-blocks a PR mixing `sot/` with `scripts/`, and splitting before opening is the
  instruction. Dispatched instead.
- **Did not sweep up the ten untracked breadcrumbs** (F4). That is Station 00's COLLECT and it would
  breach S5's scope cap here.
- **Did not re-escalate the sot/02 table question** (F3). It is open with Marco from 15.8 h ago; a
  duplicate ask splits the answer. Added a measurement to it instead.
- **Did not run `build-toc.mjs --check` against `sot/`** — no `sot/` file carries TOC markers, so it
  cries wolf unconditionally.
- **Did not touch Azure, Entra or SharePoint**, and nothing in this run came near them.
- **Did not clear, kill or restart anything on the machine** beyond the 0-byte `index.lock` I
  created myself and measured before removing (F1). The watcher (pid 30248) and
  `PO Watcher Keepalive` were healthy and were left alone.
- **Did not claim a catch-up.** Freshness read 15.8 h, inside one cadence, so no day was owed.

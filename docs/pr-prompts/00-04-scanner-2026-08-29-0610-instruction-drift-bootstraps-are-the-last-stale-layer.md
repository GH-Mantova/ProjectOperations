# Station 04 — Scanner | 2026-08-29T06:10:57Z–2026-08-29T06:53Z

Sweep: **instruction-drift** (rotation position 4 of 4; previous run 2026-08-29T02:11:07Z).

## GROUND

```
UTC            2026-08-29T06:10:57Z
origin/main    80e6d80d              (re-fetched 06:26:37Z; was 8b608336 at run start — main moved mid-run)
dev tree       main @ 1501d09c       C:\ProjectOperations2   (3 BEHIND origin/main)
doc version    1                     (docs/pipeline/stations/04-scanner.md)
bootstrap      1                     (C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md)
```

Versions agree — this run is READ-WRITE within its lane. SIGHTED: Desktop Commander reached the box
on the first call (`start_process` powershell.exe, PID 572).

`status-sweep.ps1` verdict at 06:13:10Z: **SAFE TO ACT** — 0 open PRs, 0 in-progress prompts, 0 git
processes, no `index.lock`, no PR touched in the last 2 min. Section 0 positive controls both
[LIVE] (`gh` reached GitHub; `node` runs).

## WHAT I MEASURED

**Bootstrap inventory** — [MEASURED] `Get-ChildItem C:\Users\Marco\Claude\Scheduled -Directory` + regex on each `SKILL.md`:

| bootstrap | bytes | mtime (UTC) | declared version |
|---|---|---|---|
| 00-supervisor | 5340 | 2026-08-24T22:54Z | 1 |
| 02-board-driver | 5337 | 2026-08-24T22:54Z | 1 |
| 03-machine-minder | 5315 | 2026-08-24T22:54Z | 1 |
| 04-scanner | 5276 | 2026-08-24T22:54Z | 1 |
| 05-sot-keeper | 5251 | 2026-08-24T22:54Z | 1 |
| weekly-security-audit | 1982 | 2026-08-17T06:37Z | none (not a station) |
| _retired-2026-08-18 | — | — | no SKILL.md |

All five station bootstraps are **byte-frozen since 2026-08-24T22:54Z** and all 96 lines long.

**Repo station docs** — [MEASURED] `git show origin/main:<f>` for all seven docs under
`docs/pipeline/stations/`: every one declares `station_doc_version: 1`. **No version drift in either
direction.**

**`lint-station.mjs`** — [MEASURED] `node scripts\pipeline\lint-station.mjs` → `ADMIT: all 7 docs clean`,
`EXIT=0`. One advisory: `! names a Windows path outside the known folder map: C:\po-scan-` on
`04-scanner.md` (that string is inside the SUPERSEDED comment block at L292; it is a commented-out
example, not a live instruction).
POSITIVE CONTROL for the instrument: `lint-station.mjs` does carry a REJECT path and can emit it —
`:205` rejects a missing file, `:211` rejects a version mismatch, `:231` prints `REJECT: N of M docs
failed`. So the exit 0 above is a real ADMIT, not a checker that cannot fail.

**Path resolution across all 8 repo docs + all 5 bootstraps** — [MEASURED], script at
`C:\po-sup-fix-scripts\path-resolve-check-0629.ps1`. Repo-relative paths were checked against the
`git ls-tree -r --name-only origin/main` set (**with `-r`**, DOCTRINE §9.2) — control:
`tracked-count = 2689`, a known-tracked path present = True, a known-absent path present = False.
Windows paths checked with `Test-Path`. Every path named in **all five bootstraps** resolves.
DOCTRINE.md itself: **all named paths resolve**.

Non-resolving repo-relative paths in station docs were then triaged (`git check-ignore`, `Test-Path`,
`git log -- <path>`) so that "not on main" is not mistaken for "dead":

| path | on disk | gitignored | verdict |
|---|---|---|---|
| `docs/qa/qa-findings.md`, `qa-checklist.md`, `qa-test-data-registry.md`, `.qa-run.lock` | yes | yes | **by design** — the docs say so |
| `docs/data-model/relationship-map.{json,md}` | yes | yes | **by design** — generated artefact |
| `apps/api/scripts/xero-import-report.md`, `apps/api/.env`, `apps/web/.env.local` | yes | yes | **by design** |
| `docs/pr-prompts/queue-watch-state.md` | yes | no | **by design** — 00's doc labels it UNTRACKED |
| `docs/qa/qa-github-audit.md` | no | no | **by design** — 04's doc says "create if absent" |
| `C:\ProjectOperations-Reference\worktrees` | no | n/a | **by design** — 02 L296 says `mkdir … if missing` and `rmdir … if now empty`. **Not a defect.** |
| `docs/qa/Master-QA-and-Consolidation-Program-Plan.md` | **no** | no | **DEAD** — see F3 |
| `docs/pr-prompts/triage-state.md` | **no** | no | **DEAD** — see F3 |
| `docs/pr-prompts/AWAITING-MARCO-DECISION.md` | **no** | no | **DEAD** — see F3 |

The three DEAD paths were each last seen in one commit only — `8e2eba71 backup: PO2 working-tree
snapshot before 2026-08-17 cleanup` — i.e. they were removed in the 2026-08-17 cleanup and never
restored. [MEASURED] `git log --oneline --all -- <path>`.
`git grep -l "triage-state" origin/main -- scripts .claude` → **NONE**: no script writes it either.

**`docs/qa/` tracked-file control** — [MEASURED] `git ls-tree -r --name-only origin/main -- docs/qa`
returns **6 tracked files** (`sot-refs-baseline.json`, `integration-idempotency-audit.md`,
`workstream-c-coverage-audit.md`, 3 screenshots). `.gitignore:104-110` on origin/main is a list of
**five FILES**, not the folder.

**OAuth / agent lane** — [INFERRED] from `status-sweep` §4B [LIVE] lines: newest `failed/` entries
(`pr-crm-s3-account-on-client-create-ready.md`, `rev-1386-ready.md`) both carry
`401 OAuth access token has expired`. [CANNOT MEASURE] the token itself:
`C:\po-watcher\.credentials.json` does not exist and I did not go hunting for it — that is 03's lane.
The standing ARM-NOTHING block therefore still stands as far as I can see it.

## WHAT CHANGED

- **Advanced the sweep rotation** — `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-08-29T06:10:57Z`.
  `docs/pipeline/sweep-rotation.json` is modified in the working tree and must be committed **with**
  this breadcrumb, or the next 04 run repeats `instruction-drift`.
- **This breadcrumb.** Untracked until a board PR commits it — **Station 00 must sweep it up.**
- Nothing else. No prompt armed, disarmed, renamed, moved or deleted. No PR merged. Shared index was
  **empty** before and after (`git diff --cached --name-status` → no output, checked at 06:5xZ).

## FINDINGS

### F1 — The refuted blindness diagnostic: the repo is FIXED, the five bootstraps are NOT

Station 00's 04:08Z run reported this as still live in all six station docs. **That was true when it
was written and has since been fixed** — `#1389 80e6d80d` (merged 2026-08-29T06:18:27Z, *during this
run*) rewrote L28-29 of all six, and `#1388 8b608336` (02:18:34Z) landed the refutation in
`STATION-CAPABILITIES.md` §2. [MEASURED] `git show origin/main:docs/pipeline/stations/*.md` now reads:

> L28: There is **no diagnostic short of trying.** The scheduled-task listing predicts nothing, in either
> L29: direction — see `STATION-CAPABILITIES.md` §2, where the old "in the listing ⇒ cloud-fired ⇒ blind" …

**What is still stale is the layer that actually governs a scheduled run.** All five bootstraps carry,
verbatim at **L25**:

> If this station appears in the scheduled-task listing, it is cloud-fired and structurally cannot
> reach the box. That is Marco's to fix, not yours to work around.

This is not academic: that exact sentence was inlined as the opening user turn of **this run**. A
station that trips the blindness branch is still told its blindness is structural, unfixable and
Marco's problem — which is the refuted claim. Per `STATION-CAPABILITIES.md` §1 the scheduled-task
file is the layer that governs, and **no agent may edit it.**

**DISPOSITION: ESCALATED** — Marco, one paste, five files, one line each. Replace L25-26 of
`C:\Users\Marco\Claude\Scheduled\{00-supervisor,02-board-driver,03-machine-minder,04-scanner,05-sot-keeper}\SKILL.md`:

```
FROM:  If this station appears in the scheduled-task listing, it is cloud-fired and structurally cannot
       reach the box. That is Marco's to fix, not yours to work around.
TO:    There is no diagnostic short of trying. The scheduled-task listing predicts nothing, in either
       direction - see STATION-CAPABILITIES.md section 2. Report the blindness; do not explain it.
```

**Do NOT bump `station_doc_version`** — the repo docs are still v1, and bumping one side alone forces
every station read-only.

### F2 — All five bootstraps carry a claim the repo corrected in #1383: "docs/qa/ is gitignored"

[MEASURED] **L84** of all five bootstraps:

> Never `docs/qa/` - gitignored at `.gitignore:107`, and it swallowed a real finding for nine days.

`.gitignore:106-110` on origin/main lists **five FILES**, and **6 files under `docs/qa/` are tracked**
(including `docs/qa/sot-refs-baseline.json`, which CI ratchets against and which `CLAUDE.md` names).
`#1383` corrected exactly this in the repo's station-contract v1; the bootstraps never got the fix.
The harm is real and specific: a station reading L84 believes the whole folder is a sink, which is how
a tracked, CI-gated artefact gets treated as unwritable.

**DISPOSITION: ESCALATED** — same paste as F1, same five files, one more line each:

```
FROM:  Never `docs/qa/` - gitignored at `.gitignore:107`, and it swallowed a real finding for nine days.
TO:    Never the five gitignored files at `.gitignore:106-110` (docs/qa/qa-checklist.md,
       qa-findings.md, qa-test-data-registry.md, .qa-run.lock, qa-run-*.md) - one of them swallowed a
       real finding for nine days. The docs/qa/ FOLDER itself is tracked.
```

### F3 — Three paths named as live instructions were deleted on 2026-08-17 and never restored

[MEASURED] none exist on `origin/main`, none exist on disk, none are gitignored, and each appears in
exactly one commit — the pre-cleanup backup `8e2eba71`.

1. **`docs/qa/Master-QA-and-Consolidation-Program-Plan.md`** — `04-scanner.md:173` instructs *this*
   station: *"If missing, rebuild from docs/qa/Master-QA-and-Consolidation-Program-Plan.md."* The
   checklist it names is gitignored (so normally absent) and the rebuild source is gone, so the whole
   branch is a silent no-op. Worse, `.gitignore:105` still says *"The Master Plan doc stays
   committable"* — the ignore file documents a file that no longer exists.
2. **`docs/pr-prompts/triage-state.md`** — named as a signal to read by `00-supervisor.md:366` and
   `03-machine-minder.md:162`. No script writes it. Reading it returns silence, and DOCTRINE §9.6 is
   explicit that silence is not an empty world — here it is a deleted file.
3. **`docs/pr-prompts/AWAITING-MARCO-DECISION.md`** — named by `02-board-driver.md:306`.

Blast radius: 4 of the 6 station docs. Fix is 3-4 one-line docs edits, but they are tracked-file
writes in the shared dev tree where the watcher runs — outside my lane.

**DISPOSITION: DISPATCHED to Station 00** (to fold into its next board PR, or hand to 06). Exact
edits: delete the "rebuild from …Master-QA…" clause from `04-scanner.md:173` and replace it with
"rebuild from `docs/pipeline/stations/04-scanner.md` Part 0 (the six sub-checks below)"; delete the
`triage-state.md` reference from `00-supervisor.md:366` and `03-machine-minder.md:162`; delete the
`AWAITING-MARCO-DECISION.md` reference from `02-board-driver.md:306`. If any of the three is meant to
be re-created rather than removed, that is a design call and belongs to Marco, not to a docs edit.

### F4 — `lint-station.mjs` is structurally blind to the layer that actually drifts

[MEASURED] `Select-String -Path scripts\pipeline\lint-station.mjs -Pattern "Scheduled|SKILL.md|bootstrap"`
returns two hits and **neither reads a bootstrap**: `:38` lists `C:\Users\Marco\Claude\Scheduled` only
as an entry in a known-Windows-folder allowlist, and `:226` merely *prints advice* that "the scheduled-task
bootstrap must declare the same number". The checker lints seven repo files and never opens a
`SKILL.md`.

That is why F1 and F2 survived: the only instrument this sweep names cannot see the drift this sweep
exists to catch, and it exits 0 while five governing files contradict the docs they point at. It also
cannot become a CI gate — `C:\Users\Marco\Claude\Scheduled` does not exist on a runner — so the fix is
a **local-only** checker (or a `--bootstraps` flag on `lint-station.mjs` that no-ops when the folder is
absent) that diffs each bootstrap's version line and its known-claim set against the repo doc, and is
run by whichever station holds the instruction-drift sweep.

RULE 1 applied: the flag-on-`lint-station.mjs` option is the complete-and-additive one — it solves it
now and every future run, adds no new file, touches no data, and degrades to a no-op off the box. A
separate script also passes both tests but adds a second thing to remember to run. Doing nothing and
relying on the 4-hourly human-read sweep fails the *future* half: this drift has already survived
five days and two prior instruction-drift sweeps.

**DISPOSITION: DISPATCHED to Station 06** (design and stage it as a `-HOLD`). I did not stage it
myself — see WHAT I DID NOT DO.

### F5 — `docs/pr-prompts/no-pr-opened/` is still unignored (107 files, oldest content 9 days)

[MEASURED] `git status --porcelain -- docs/pr-prompts` → `?? docs/pr-prompts/no-pr-opened/`
(107 files, newest 2026-08-20). `.gitignore:75-82` covers `processed|failed|paused|blocked|awaiting-review|reviewed|needs-marco`
but **not** `no-pr-opened`. This is 04's own 2026-08-29T02:11Z finding, unchanged. One line in
`.gitignore`.

**DISPOSITION: DEFERRED** — re-dispatched by reference rather than re-diagnosed. It becomes urgent the
moment someone runs a pathspec-less `git add`, which would commit 107 dead prompt files to main.

### F6 — `check-breadcrumb.mjs` called 9 breadcrumbs UNTRACKED and **8 of the 9 were already on main**

Not part of the named sweep, but measured while validating my own breadcrumb, and it changes what 00
should do next. `node scripts/pipeline/check-breadcrumb.mjs` exited **0 / CLEAN** (93 checked, 0
malformed, 7 skipped as pre-contract) and emitted 9 `NOTE … is UNTRACKED — it reaches nobody until a
board PR commits it` lines. I checked every one against the remote with
`git cat-file -e origin/main:<path>` — control: `DOCTRINE.md` exit 0, a fabricated path exit 128.

**8 of 9 are FALSE.** On main already: 00's 2009Z, 2209Z, 0008Z, 0208Z and 0408Z; 03's 2302Z; 04's
2210Z and 0211Z. Genuinely absent: **only this run's breadcrumb.**

Root cause is the already-known one — `check-breadcrumb.mjs:82` builds its tracked set from
`git ls-files`, i.e. the **local index**, and this dev tree is 3 commits behind `origin/main`. The
prior measurement of this defect was 2 false of 5; at 3 commits behind it is now **8 false of 9**, so
the error rate tracks the lag exactly as predicted. Fix already dispatched to 06:
`git ls-tree -r --name-only origin/main -- docs/pr-prompts` (**with `-r`**, DOCTRINE §9.2).

**Consequence for Station 00, this cycle:** do **not** re-land those eight. The only breadcrumb that
needs committing is this one, plus `docs/pipeline/sweep-rotation.json`.

**DISPOSITION: DISPATCHED to Station 00** (as a do-not-re-land notice) **and to Station 06** (the
`:82` fix, already in its queue — this is fresh evidence, not a new item).

## WHAT I DID NOT DO

- **Did not stage a `-HOLD` prompt**, though my lane permits one. The queue carries ~84 HOLDs and
  **0 armed**, and the standing OAuth block says arm nothing — an 85th HOLD that cannot be armed lands
  later than a dispatch line in a breadcrumb 00 reads every 2 h. If 00 disagrees, F4's body is the
  prompt.
- **Did not edit any station doc, DOCTRINE, or `.gitignore`.** F3 and F5 are one-line docs edits I
  could write, but landing them means a branch and a push in the shared dev tree where the watcher
  runs — forbidden by my own HARD RULES. Both are dispatched with the exact before/after so 00's PR is
  transcription, not re-diagnosis.
- **Did not touch the five bootstraps.** No agent may; that is why F1 and F2 are ESCALATED, not
  DISPATCHED.
- **Did not fast-forward the dev tree** (3 behind `origin/main`) and **did not touch the watcher
  clone** (35 dirty, 5 orphaned worktrees per the sweep). Both are 03's lane and both are live
  escalations elsewhere.
- **Did not run Part 0 / Part 1 / Part 2** of the station brief. The rotation named one sweep and the
  contract says cover it completely; a shallow pass over everything is the failure the rotation exists
  to prevent.
- **Did not chase the OAuth credentials file.** `C:\po-watcher\.credentials.json` is absent;
  locating it is 03's lane and I recorded `[CANNOT MEASURE]` rather than infer.

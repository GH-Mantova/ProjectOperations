# Station 00 — Supervisor | 2026-09-07T14:09Z–2026-09-07T14:2xZ

> **THIS RUN WAS BLIND.** Desktop Commander was unreachable. Per `STATION-CAPABILITIES.md` §3
> ("No second transport") this run **COLLECTED through the Cowork mount and acted on nothing** —
> it did not arm, did not merge, did not label, did not mutate the board, and claims **no**
> liveness, smoke, safe-to-act or merge verdict. This is *not* a healthy quiet run.

## GROUND

```
UTC            2026-09-07T14:09:15Z   (VM clock; host-local date has already rolled to 2026-09-08, Brisbane UTC+10)
origin/main    f9815d11               [MEASURED] .git/refs/remotes/origin/main in the dev tree, corroborated by the GitHub API (main tip, 14:05:13Z). NOT via `git rev-parse` — a blind run may not run git against the Windows .git (DOCTRINE §9.2).
dev tree       main @ f7f112f8        C:\ProjectOperations2 — BEHIND origin/main by the #1760 squash
doc version    1                      docs/pipeline/stations/00-supervisor.md front matter
bootstrap      1                      station_doc_version declared by the scheduled-task file
```

Doc version and bootstrap **agree**. Binding documents were read from the mount (the live dev tree
at `f7f112f8`), **not** from `git show origin/main:` — that command is unavailable to a blind run.
Since the dev tree is one commit behind and that commit is `#1760` (a `scripts/pr-watcher` change,
no pipeline-doc paths), the copies read are current for `DOCTRINE.md`,
`STATION-CAPABILITIES.md` and `00-supervisor.md`. **[INFERRED, from the single intervening commit's
message — not from a diff.]**

## WHAT I MEASURED

**Blindness.** [MEASURED] `ToolSearch` for `desktop-commander` was run FIRST, twice, and the schema
never loaded; the session then reported
`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): connection timed out after 30000ms`.
This is a failure **after** the load attempt, not an unloaded schema — i.e. genuine blindness under
the PREFLIGHT test. No `powershell.exe` was ever started.

**Device-bridge git guard.** [MEASURED] `bash scripts/pipeline/vm-git-guard.sh` — last line:
`vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths, allows everything else (both controls passed)`.
Install PASSED, persistence controls passed.

**Mount is the live dev tree.** [MEASURED] `.git/HEAD` → `refs/heads/main`;
`.git/refs/heads/main` = `f7f112f879de5d7de00e51effc97166abd174b74`;
`.git/refs/remotes/origin/main` = `f9815d1116de2f283e05294ac6238f7041df0ee8`.
No `index.lock`, no `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD`, no rebase-merge/apply dir.

**COLLECT.** [MEASURED] `docs/pr-prompts/` root holds exactly two `00-*` breadcrumbs, both from this
station's own earlier runs today (`…-1108-…`, `…-1315-…`), both already dispositioned and shipped in
`#1782`. **No station breadcrumb has been written since the 13:15Z run** — `list_commits main
--since 2026-09-07T13:00Z` returns exactly two commits, `#1782` (my own) and `#1760`, and neither
adds a breadcrumb. COLLECT is therefore **empty this run**, and that emptiness was measured, not
assumed.

**Board.** [MEASURED, GitHub API — labelled as such, NOT presented as coverage of the tree the
watcher globs] 4 open PRs, down from 5: `#1777` (unlabelled), `#1775` (`do-not-merge`), `#1774`
(unlabelled), `#1767` (`do-not-merge`). All four `updated_at` 14:09:1x–14:09:2xZ.

**RULE 2 probe.** [MEASURED] `docs/pr-prompts/processed/` — 150 newest `.log` scanned (the full
~2100-log sweep times out over the mount): POS control `marco.:true` → **10**, NEG control with a
freshly minted needle `zzzQ8vR2NeedleZzz` → **0**. Probe is LIVE and discriminating. Matching by
`PR #<n>` in the BODY: `#1777`, `#1775`, `#1767` match **only** their own `rev-<n>-ready.md.log`
review-job logs; `#1774` matches nothing. **No originating watcher prompt log for any of the four**
⇒ unchanged from 13:15Z: all four remain `[NO LANE VERDICT — hand-classified]` and hand-classify as
**MARCO'S**. Merged none; a blind run could not merge in any case.

**Watcher.** [MEASURED **from log CONTENT**, never from a mount `stat` — mount mtimes are host-local
surfaced as UTC] `ensure-watcher.log` last line `2026-09-07T14:05:03Z  watcher alive, pid(s) 31660`,
alive on every 10-minute tick from 13:15Z. **This is not a liveness verdict** — that requires
`status-sweep.ps1`, which a blind run cannot execute. [CANNOT MEASURE] any smoke, safe-to-act or
merge verdict.

**Queue.** [MEASURED] `docs/pr-prompts/*-ready.md` → **0**. `*-HOLD.md` → 46. `.arming-log.txt` not
present at the searched depth. **[CANNOT MEASURE]** how many HOLDs would lint `ADMIT`:
`lint-prompt.mjs` is driven through PowerShell wrappers a blind run may not run.

**Station 00's own slot.** [MEASURED] this occurrence fired at ~14:09Z, and the previous one fired
at ~13:0xZ. [CANNOT MEASURE] the scheduler's occurrence list itself — that needs Desktop Commander.

## WHAT CHANGED

**Nothing.** No arm, no merge, no label, no push, no PR, no `/sot/` edit, no file written anywhere
except this breadcrumb. The only mutation this run made to the host is the idempotent
`vm-git-guard` install inside the Linux VM, which does not touch the repo.

## FINDINGS

### F1 — BLIND: Desktop Commander CONNECT_TIMEOUT (recurrence)

Third-party-visible symptom identical to `needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`,
which is already open with Marco. Recurrence measured 2026-09-07T14:09Z. Cause still unknown;
DOCTRINE's ~40% intermittency estimate is unrefuted. Not re-raised as a new escalation — a second
file for the same defect splits the evidence.

**DISPOSITION: ESCALATED** — existing file, recurrence recorded here.

### F2 — `#1760` was merged at 14:05:13Z by the supervised cloud lane, on a receipt that lane wrote itself

My 13:15Z run hand-classified `#1760` as **Marco's** (`NO LOG`, `scripts/` ⇒ not tests-docs). It
merged 32 minutes after that run ended. Its squash message carries, as its own second commit,
`docs(merge-approvals): receipt for #1760 - supervised cloud lane, standing authority` — i.e. the
receipt arrived **inside the diff of the PR it clears**, exactly the shape recorded five times
before and exactly what open escalation `#1635` asks about: *how does a run tell Marco's receipt
from an agent's?* Under Marco's 2026-09-07 ruling via `#1736` ("the lane merges, but writes a
receipt first") this is **permitted for the supervised cloud lane**. Recorded as evidence, not as an
attack. **Do not revert. Do not re-raise.**

**DISPOSITION: DEFERRED** — feeds `#1635`, which is Marco's and already open.

### F3 — the CodeQL root-cause from the 13:15Z run landed

`#1760`'s squash includes `fix(pr-watcher): runGh must not spawn through a shell either` — the
`shell: true` removal from `spawn(GH_BIN, …)` that the 13:15Z run root-caused and pushed as
`62d1e655`. It is on `main` at `f9815d11`. The block that no check, label or review could show is
closed.

**DISPOSITION: ACTIONED** — closed, nothing carried forward.

### F4 — `pollForBehindPrs` fired again, on all four open PRs, 4 minutes after the merge

[MEASURED] `watcher-launch.log`: `#1777` 14:09:16.5Z, `#1775` 14:09:19.9Z, `#1774` 14:09:23.0Z,
`#1767` 14:09:25.9Z — all `branch updated (was BEHIND)`, all triggered by the 14:05:13Z merge of
`#1760`. This is the third measured confirmation of the already-escalated behaviour (rebuilding PRs
no automation may merge, driving clone drift). The escalation's option (a) — skip PRs
`classifyPolicyFiles` refuses — remains the complete-and-additive one and stays FIRST under RULE 1.

**DISPOSITION: ESCALATED** — existing escalation, confirmation recorded.

### F5 — the missed-slot symptom did not recur in the two slots since it was escalated

`needs-marco/station-00-overruns-its-hourly-slot-and-eats-the-next-occurrence-2026-09-07.md` was
written by the 13:15Z run after the 12:08Z occurrence never fired. Both slots since (13:0x, 14:0x)
fired. Two clean slots do not refute an intermittent defect, and the `--freshness` detector's
`CADENCE` map still says `'00': 2` while the live cron is hourly — so the detector would still read
`ok` through a missed hour. The escalation stands unchanged.

**DISPOSITION: DEFERRED** — Marco's; no new evidence either way.

### F6 — dev tree is one commit behind `main`, and a blind run may not fast-forward it

`refs/heads/main` `f7f112f8` vs `origin/main` `f9815d11`. A blind run may not run `git` against the
Windows `.git` at all (DOCTRINE §9.2), so this cannot be cured here. It is the ordinary
post-merge state and will clear on the next sighted run or on 03's next pass; recorded because a
stale dev tree is what makes `lint-prompt.mjs` report spent prompts as armable.

**DISPOSITION: DISPATCHED → Station 03** — folds into the open 03 dispatch; no new ask.

### F7 — armed nothing, seventh consecutive run at zero

0 `-ready.md` in the queue root, 46 HOLDs. Blindness alone forbids arming (`arm-prompt.ps1` is a
`.ps1`), so this run's zero carries **no information** about whether anything was armable — unlike
the 13:15Z run, which measured 18 `ADMIT` / 0 tests-docs-only and chose zero. Do not read the two
zeros as the same fact.

**DISPOSITION: DEFERRED** — next sighted run re-measures.

## WHAT I DID NOT DO

> **Heading added by the 2026-09-07T15:1xZ sighted Station 00 run**, which collected this
> breadcrumb. The blind run omitted it and `check-breadcrumb.mjs` exited 1 on the file
> (Station 04 F3, 14:10Z, DISPATCHED to 00). Nothing above this line was altered; the bullets
> below restate only what that run already recorded under WHAT CHANGED and in its findings.

- **Armed nothing.** `arm-prompt.ps1` is a `.ps1` and a blind run may not execute one
  (`STATION-CAPABILITIES.md` §3, "No second transport"), so the zero carries no information
  about whether anything was armable — F7 says so explicitly.
- **Merged nothing, labelled nothing, rebased nothing.** All four open PRs hand-classified as
  Marco's, and a blind run has no `Assert-SmokedOrEscalate` in any case.
- **Did not fast-forward the dev tree** off `f7f112f8`, and did not run `git` against the Windows
  `.git` at all (DOCTRINE §9.2) — F6, dispatched to Station 03.
- **Did not claim any liveness, smoke, safe-to-act or merge verdict.** Every one of those needs a
  `.ps1` this run could not run; they are tagged `[CANNOT MEASURE]` above, not inferred.
- **Did not open a PR to land this breadcrumb.** The GitHub MCP token is write-403, so the file
  was left untracked for a sighted run to sweep.
- **Did not re-file the blindness escalation** as a new `needs-marco/` entry — the existing file
  already holds it and a second file would split the evidence (F1).
- **Azure / Entra / SharePoint: not touched, not read, not reasoned about.** No production data.

## HANDOVER

- This breadcrumb is **UNTRACKED** in `C:\ProjectOperations2\docs\pr-prompts\`. The GitHub MCP token
  is write-403 and a blind run cannot open a PR, so it stays untracked until a sighted run sweeps it
  up. **Station 00: collect this.**
- Every timestamp above is taken from **log content or the GitHub API**, never from a mount `stat`.
- Nothing in this run may be read as clearance for anything. All four open PRs remain Marco's.

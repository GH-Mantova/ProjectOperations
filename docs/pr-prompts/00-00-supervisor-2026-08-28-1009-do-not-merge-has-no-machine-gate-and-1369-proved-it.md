# Station 00 — Supervisor | 2026-08-28T10:09Z–2026-08-28T10:25Z

## GROUND

```
UTC            2026-08-28T10:09:00Z
origin/main    82ba8538            (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 82ba8538     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task file)
```

Versions AGREE — full authority this run. Desktop Commander reached the box on the first call
(pid 41436, `powershell.exe`). **This was a SIGHTED run, not a quiet one.**

## WHAT I MEASURED

- `[MEASURED]` `gh pr list --state open --json number,... --limit 50` → **`OPEN_COUNT=0`. The board
  is EMPTY.** Positive control per DOCTRINE §7: the same command shape against `--state merged`
  returned 8 rows, so the zero is a real zero, not a broken query.
- `[MEASURED]` Merged since the 08:08Z run: **#1369 #1370 #1371 #1372 #1373 #1374 #1375 #1376.**
  #1375 and #1376 were opened and merged by an actor that is not this station.
- `[MEASURED]` `gh pr view 1369 --json labels,mergedAt,files` →
  `labels_now=[do-not-merge]`, `mergedAt=2026-08-28T08:41:20Z`, and `apps/web/src/App.tsx` **is** in
  the diff. The label is still on the PR *after* the merge, so it was never stripped.
- `[MEASURED]` `gh api repos/GH-Mantova/ProjectOperations/rules/branches/main` → required status
  checks are exactly: `CodeQL`, `API — lint, test, compliance smoke`,
  `Web — lint, logic tests, vitest, build`, `tendering-e2e`. **No CP-26. No label gate.**
- `[MEASURED]` `Select-String` over `.github/workflows/*` for `CP-26|do-not-merge|do_not_merge`
  → **zero hits.** Positive control: the same search for `tendering-e2e` hit two files. There is no
  CP-26 workflow in this repo at all; only `ci.yml:134` names diff gates
  (`CP-09-13, CP-17, CP-22, CP-23`).
- `[MEASURED]` `node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0.
  75 checked, 0 malformed. 00 2.0h, 03 35.1h/24h, 04 4.0h, 05 20.0h — **no station is SILENT.**
  **Nothing new has been filed since my 08:08Z run**, so this run's COLLECT is empty by measurement,
  not by omission.
- `[MEASURED]` `status-sweep.ps1` §7 → `SAFE TO ACT: no board mutation in progress`. Re-measured
  immediately before the arm: 0 open PRs, 0 staged paths, 0 `git.exe` processes,
  `.git\index.lock` absent.
- `[MEASURED]` `restart-watcher-if-wedged.ps1` → `watcher process: ALIVE (pid 5444)`,
  `armed prompts waiting: 0`, `restart churn: 0 cycle(s) in 20 min`,
  verdict `OK - nothing armed and the watcher is alive`.
- `[MEASURED]` `supervise-watcher.ps1` wrapper count = **0**, while `Get-ScheduledTask` shows
  **`PO Watcher Keepalive  state=Ready`**. Wrapper absence is the designed state, not a fault.
- `[MEASURED]` All five candidate HOLDs are now BOTH on disk AND tracked:
  `pr-lint-armed-gate-inversion-HOLD`, `pr-lint-not-a-prompt-HOLD`,
  `pr-station-contract-breadcrumb-validator-and-qa-claim-HOLD`,
  `pr-devtree-sync-ff-only-guard-HOLD`, `pr-queue-armed-tracked-detector-HOLD`.
  The 08:08Z unmaterialised-prompt defect is **discharged on these five** (#1376 swept them up).
- `[MEASURED]` The armed candidate was never consumed: `processed/` 0, `no-pr-opened/` 0,
  `failed/` 0 for `*lint-armed-gate-inversion*`.

## WHAT CHANGED

- **ARMED exactly one prompt.** `git mv docs/pr-prompts/pr-lint-armed-gate-inversion-HOLD.md
  docs/pr-prompts/pr-lint-armed-gate-inversion-ready.md`, rc=0.
  Read-back: armed at depth 1 went **0 → 1**, and the only file it names is
  `pr-lint-armed-gate-inversion-ready.md`. `git diff --cached --name-status` carries **exactly one
  line**, `R100 …-HOLD.md → …-ready.md`, and nothing else.
  Pre-arm gate check: `lint-prompt.mjs` → `ADMIT` exit 0; case-sensitive union grep for
  `do-not-arm` / `DO NOT ARM` / `do_not_arm` → **empty**, with a positive control on
  `pr-524-rates-b-slice2-canonical-HOLD.md` that fired. It carries `escalates: true` (line 17),
  which per DOCTRINE §5b gates the MERGE and not the RUN.
- **Nothing else.** No merge, no label change, no `/sot/` edit, no watcher restart, no wrapper
  relaunch, no branch, no commit, no push.

## FINDINGS

### F1 — `do-not-merge` has NO machine enforcement, and #1369 is the proof

The label is not a required status check and **no workflow implements one**. #1369 merged at
08:41:20Z **carrying the label**, 11 minutes after I applied it, with the routing verdict
independently verified as correctly-owned (`apps/web/src/App.tsx` really is in its diff). Both
halves of RULE 2 were satisfied and the merge happened anyway.

This supersedes the ambiguity in every earlier breach claim. Those were disputed because routing
ownership could not be verified. Here it can: the routing is real, the label was present at merge,
and GitHub had nothing configured to refuse it. **RULE 2 is enforced only by agent discipline, and
this board has several concurrent actors** (#1375 and #1376 were merged by someone other than this
station within the same window).

I cannot name the actor: every actor merges as `GH-Mantova`, so there is no audit trail. That is
itself part of the defect.

**Options for Marco (RULE 1 — complete-and-additive first):**

- **(a) COMPLETE + ADDITIVE — add an always-running `label-gate` job to `ci.yml` and make it a
  required check on `main`.** It runs on every PR, passes when no hold label is present, and fails
  while `do-not-merge` / `needs-marco` / `hold` is on the PR. Additive: it changes nothing about
  existing data or any passing PR, and it removes the hole permanently rather than asking humans to
  remember. The job must be authored and merged FIRST and only then added to the ruleset, or every
  PR blocks on a check that never reports. Passes both halves of RULE 1.
- **(b) Ruleset-only — add CP-26 to the required list today.** Fails the "does not damage future
  work" half: there is no CP-26 workflow, so every PR would block on a missing required check.
- **(c) Do nothing and rely on discipline.** Fails the "solves it for the future" half — this is the
  state that produced #1369.

The workflow change in (a) is mine to write. **The branch-protection ruleset edit is an
authorization change and is Marco's**, so I am not making it.

**DISPOSITION: ESCALATED** — Marco: may I write and land option (a)'s workflow job, and will you
then add it to the `main` ruleset?

### F2 — Station doc §3b ENSURE-UP orders a wrapper relaunch that is now wrong

`00-supervisor.md` §3b says to relaunch `supervise-watcher.ps1` whenever it is absent with a live
node. Measured this run: wrapper **0**, node **ALIVE pid 5444**, and `PO Watcher Keepalive` is
`Ready` as the actual restarter. Following §3b literally would have started a **second** restarter
alongside the keepalive. I did not run it.

**DISPOSITION: DISPATCHED** — to **Station 06 (PR Master)** to stage a `-HOLD` prompt replacing
§3b's ENSURE-UP block with a keepalive-presence check
(`Get-ScheduledTask 'PO Watcher Keepalive'` must be `Ready`; relaunch only if the keepalive is
missing or Disabled). Exact before/after is the §3b block quoted above — this is transcription, not
re-diagnosis.

### F3 — The watcher clone is still diverged and cannot fast-forward

Carried from 06:23Z and unchanged: `C:\po-watcher\ProjectOperations` is **16 behind / 2 ahead** with
local commits, so `merge --ff-only` cannot succeed, and #1358/#1360's guards are **not live in the
running watcher**. A FF would arm 0 prompts, so there is no queue risk — but it must be done in an
idle window, and the board is idle right now.

**DISPOSITION: DISPATCHED** — to **Station 03 (Machine Minder)**, re-dispatched. 03 last reported
2026-08-26T23:01Z (35.1h). Never `git checkout` the 35 unstaged ` D` paths under `docs/pr-reviews/`.

### F4 — `sot/03` carries 9 committed U+FFFD, and the byte gate is blind to it

Carried from Station 05 (2026-08-27T14:11Z) and Station 04 (2026-08-28T06:10Z):
`check-sot-bytes.mjs` is a blocking CI gate hardcoded to 3 of 7 `sot/` files and does not look at
`sot/03`, which carries the damage.

**DISPOSITION: DISPATCHED** — to **Station 05 (SoT Keeper)**, whose next job is already the 28
dangling `sot/**` refs. Repair `sot/03` **before** widening the byte gate, or widening it reddens
`main`.

### F5 — This run's COLLECT is genuinely empty

`check-breadcrumb.mjs --freshness` is `CLEAN` and no breadcrumb postdates my 08:08Z run. Every
finding from 03/04/05 that is still open is re-dispatched above rather than restated.

**DISPOSITION: ACTIONED** — verified by exit 0 and by reading the freshness table, not by silence.

### F6 — One `R100` and one untracked breadcrumb are sitting in the shared dev tree

The arming rename is staged in the dev tree's **shared** index, and this file is untracked. Both are
the normal post-arm state, but the index is shared between concurrent chats, so the next actor to
commit must use a pathspec or it will carry my rename.

**DISPOSITION: DEFERRED** — it becomes urgent the moment another chat commits without a pathspec.
The next board PR should sweep this breadcrumb and the `R100` together.

## WHAT I DID NOT DO

- **Did not merge anything.** The board was empty on arrival; there was nothing to drive.
- **Did not relaunch the watcher wrapper** (F2) and **did not restart the watcher** — verdict was
  `OK`, and restarting an idle-but-alive watcher is the LL-25 mistake.
- **Did not fast-forward the watcher clone myself** — that is 03's lane (LL-38).
- **Did not edit `/sot/`**, and did not touch the `sot/03` damage — 05 only.
- **Did not edit the `main` branch ruleset.** An authorization change is a hard stop (DOCTRINE §5.3).
- **Did not create a branch or commit in the dev tree.** A `git checkout` here would move the
  prompt I just armed out from under the watcher.
- **Did not arm a second prompt.** RULE 4 is one at a time; the next in order are
  `pr-lint-not-a-prompt-HOLD`, then
  `pr-station-contract-breadcrumb-validator-and-qa-claim-HOLD`, then
  `pr-queue-armed-tracked-detector-HOLD`. **Not** `dns-s5-checker-flip-to-fail` — its premise is
  Marco triaging #1361's warn findings.
- **Did not quote a trunk colour from `status-sweep.ps1`** — standing rule; I used its §7 verdict
  only, and re-measured safety directly before the arm.

---

**This breadcrumb is UNTRACKED until a board PR commits it.** Station 00: sweep it up together with
the staged `R100` arming rename.

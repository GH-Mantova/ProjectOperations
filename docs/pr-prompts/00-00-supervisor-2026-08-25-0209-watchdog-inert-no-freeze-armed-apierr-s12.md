# Station 00 - Supervisor | 2026-08-25T02:08Z-02:21Z

## GROUND

```
UTC            2026-08-25T02:08:33Z
origin/main    5ec99150            (fetched with +refs/heads/main:refs/remotes/origin/main)
dev tree       main @ 5ec99150  behind=0   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (scheduled-task SKILL.md)
```

Versions MATCH. Full-authority run. Desktop Commander PRESENT - NOT blind.

## WHAT I MEASURED

- **Host reachable** [MEASURED] `start_process powershell.exe` returned. The first attempt failed
  with a parser error because DOCTRINE 9.1 strips `$` from `-Command`; every probe below ran from a
  `.ps1` via `-File`.
- **Board: 4 open PRs, unchanged since 00:08Z** [MEASURED] `gh pr list --state open --json ... |
  ConvertFrom-Json` (never `--jq`, per 9.4): #1313 UNSTABLE `do-not-merge`, #1312 CLEAN unlabelled,
  #1311 CLEAN unlabelled, #1310 UNSTABLE `do-not-merge`. Control: `--state merged` returned 3/3.
- **ALL FOUR are watcher-routed to Marco** [MEASURED] from `docs/pr-prompts/processed/*.log`:
  - #1310 `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`
  - #1311 `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/pages/crm/CrmBoardPage.tsx"}`
  - #1312 `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/pages/crm/CrmBoardPage.tsx"}`
  - #1313 `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`
  Positive control (7.1 guard 1): the same scan returned `{"ok":true}` for #1301, #1295, #1297, so
  the probe CAN report a non-gated PR. **Correction to the recorded probe string:** the token is
  `merge result for PR #N: {json}`. A scan for `[merge]` or `stays for Marco` returns ZERO across
  all 40 processed logs - an empty result that is not an empty world (9.6). My first probe did
  exactly that and I nearly wrote "no gate evidence found".
- **NO FREEZE in the last 95 minutes** [MEASURED] `watcher-launch.log` carries 18 consecutive
  `[review] verdict-archive sweep` ticks at a 5-minute cadence, 00:48:04Z -> 02:13:05Z, largest gap
  5.1 min. `ensure-watcher.log` carries 10 consecutive 10-minute fires 00:38:16Z -> 02:08:16Z with
  no missed fire. This is the fixed-interval-GAP probe, the only one that catches a frozen node.
- **Restarter healthy** [MEASURED] scheduled task `PO Watcher Keepalive` state=Ready,
  lastRun 02:08:15Z, lastResult=0, nextRun 02:15Z; action is
  `-File "C:\po-watcher\ensure-watcher.ps1"`.
- **The live process chain** [MEASURED] `WmiPrvSE (gone) <- watcher-launcher-singlelane.ps1 pid
  10364 <- start-watcher.ps1 pid 3552 <- node index.mjs pid 29024`. **ZERO
  `supervise-watcher.ps1` processes** - measured twice, by command-line match, never by image name
  (13 node.exe on the box, one is the watcher).
- **Locks and mid-merge** [MEASURED] `index.lock` ABSENT in both trees; `MERGE_HEAD` /
  `REBASE_HEAD` absent in both. Shared index CLEAN before I touched it.
- **Queue** [MEASURED] armed 0, `-HOLD` 55 at depth 1. Dev tree carries 7 worktree-level deletions
  of already-consumed `-HOLD.md` files (unstaged) - hygiene, not a fault.

## WHAT CHANGED

1. **Appended a pre-arm marker to the CLONE heartbeat**
   `C:\po-watcher\ProjectOperations\scripts\pr-watcher\heartbeat.log`, mtime 2026-08-24T23:36:34Z
   -> 2026-08-25T02:17:11Z. Belt-and-braces only; see FINDING 1 - the watchdog is not running.
2. **ARMED exactly one prompt.** `git mv docs/pr-prompts/pr-apierr-s12-ci-gate-HOLD.md
   docs/pr-prompts/pr-apierr-s12-ci-gate-ready.md`, exit 0.
   **Read back:** armed 0 -> 1; `-HOLD` copy gone from disk; `git diff --cached --name-status`
   carries `R100` for that path and NOTHING ELSE.
   **Effect read back:** `[queue] pr-apierr-s12-ci-gate-ready.md` at 02:17:12.827Z and `[start]` at
   02:17:13.139Z - **arm-to-pickup 1.8 seconds.** `.queue-state.json` now
   `{"ts":"2026-08-25T02:18:07.968Z","armed":1,"owned":1,"runnable":1}`.

Nothing else was mutated. No merges (see FINDING 3). No `/sot/` edit. No machine repair.

## FINDINGS

### FINDING 1 - the wdHungMin=15 watchdog is INERT. The recorded "IT IS LIVE" is REFUTED.

`supervise-watcher.ps1` exists on disk at both `C:\po-watcher\ProjectOperations\scripts\pr-watcher\`
and `C:\ProjectOperations2\scripts\pr-watcher\` (38405 bytes, 4 `wdHungMin` hits) - **but no process
runs it.** The live wrapper is `watcher-launcher-singlelane.ps1`, and its own header says why:

> the heartbeat watchdog counts armed prompts across the WHOLE shared queue, not just its own lane,
> so two lane-1 prompts made it kill a perfectly healthy lane-0 node every [...] The heartbeat only
> ticks while a prompt is RUNNING, so the node could never clear the staleness it was being killed
> for. Self-sustaining.

The singlelane launcher was written to REPLACE that supervisor precisely to disable the kill loop.
**Consequence: "arming into a stale heartbeat kills the watcher" is not a live hazard under the
current launcher.** I still refreshed the heartbeat before arming, because a hazard I have measured
away once is cheaper to keep guarding than to re-measure every run - but it is no longer a blocker
on arming, and it should stop being quoted as one.

**DISPOSITION: ACTIONED** - refutation measured, recorded here and in project memory; the arm that
follows it completed cleanly with the watchdog absent, which is the confirming evidence.

### FINDING 2 - station doc 3b (ENSURE-UP) instructs a relaunch that would fight the restarter.

`00-supervisor.md` 3b says: if a node is alive and no `supervise-watcher.ps1` wrapper is present,
relaunch `supervise-watcher.ps1`. Measured today that condition is TRUE and **permanently true by
design** - the current architecture is `PO Watcher Keepalive` (PT10M) -> `ensure-watcher.ps1` ->
`watcher-launcher-singlelane.ps1`. Following 3b literally would start a second supervisor carrying
the self-sustaining kill loop that FINDING 1 describes, against a healthy node.

The fix is a docs PR against `docs/pipeline/stations/00-supervisor.md` 3b: replace the
supervise-watcher relaunch with a check that the `PO Watcher Keepalive` task exists, is `Ready`, and
last returned 0 - which is what actually guarantees restart-on-death now.

00 may not create PRs (STATION-CAPABILITIES 5), and Task-tool dispatch does not work in a scheduled
Cowork run, so I did not author it.
**DISPOSITION: DEFERRED** - it becomes urgent the moment any station acts on 3b. Next interactive
session or Station 06 should stage it; the exact edit is specified above.

### FINDING 3 - zero merges, and that is the correct answer.

All four open PRs carry a machine-recorded `"marco":true` routing verdict (evidence above). Two of
them, #1311 and #1312, are CLEAN and unlabelled - the shape that most invites a well-meaning merge.
RULE 2 and STATION-CAPABILITIES 5 both bind: watcher routing is a human-review gate independent of
the label, and neither green CI, nor an empty label set, nor a MERGE review verdict overrides it.
**DISPOSITION: ESCALATED** - #1310, #1311, #1312, #1313 all wait on Marco. #1311 and #1312 are
green, clean and unlabelled and can be merged the moment he says so.

### FINDING 4 - one prompt armed; every precondition measured, not assumed.

`pr-apierr-s12-ci-gate` adds the CI gate that stops the raw-error-envelope pattern coming back.
Checks run before arming:
- `lint-prompt.mjs` -> **ADMIT**, exit 0. Control on a known-dead prompt
  (`pr-watchdog-heartbeat-during-merge-wait-HOLD.md`) -> **STALE**, exit 3, so the reject branch is
  reachable and the ADMIT means something. `gh` present (2.90.0), so 9.5's false-REJECT does not apply.
- Body read in full: no `<!-- watcher: do-not-arm -->`, no `DO NOT ARM` prose, no `docs/approvals/`
  gate. Its STANDING AUTHORITY block is genuine - the body grants it, it is not an LL-53 imposter heading.
- Its own self-gate: the prompt says arm only when the raw-envelope grep over `apps/web/src` prints
  0, and records **82 on 15d9b1d3**. Measured now over 467 files: **0 offenders.** Regex control
  asserted first against a string it must match.
- Premise `! grep -rq "raw-error-envelope" .github/workflows` - TRUE, 0 of 3 workflow files mention it.
- Not already shipped: 60 merged PRs scanned; slices 3-10 of the humane-API-errors migration landed,
  the CI-gate slice did not, and the workflow files confirm the gate is absent.
- No `requires_merged`, no `requires_file_on_main`.

**DISPOSITION: ACTIONED** - armed, picked up in 1.8 s, running at max-turns=240. Expect a PR that
touches `.github/workflows/**`, `scripts/pr-gates/**` and `docs/**`. Note for the next run: because
it touches `.github/`, it will route to Marco like the other four.

### FINDING 5 - breadcrumb collection since the last run: nothing new.

Two breadcrumbs exist after 2026-08-24T23:00Z: `00-03-machine-minder-...-2301` (predates the 00:08Z
supervisor run, already dispositioned there) and `00-00-supervisor-...-0008` (my own predecessor).
No station has reported since. **DISPOSITION: ACTIONED** - collection performed, queue empty.

## WHAT I DID NOT DO

- **Did not merge anything.** FINDING 3.
- **Did not relaunch `supervise-watcher.ps1`** despite station doc 3b's condition being met. FINDING 2.
- **Did not touch the machines.** Watcher healthy on every probe; machine repair is 03's lane and 03
  is report-only by standing instruction.
- **Did not chase CP-26 red on #1310 / #1313.** CP-26 IS the `do-not-merge` hold; it is red because
  the hold is on. Chasing it is chasing the gate.
- **Did not arm a second prompt.** RULE 4: one at a time. 54 `-HOLD` remain.
- **Did not commit the arming rename or the 7 pending prompt deletions.** The dev-tree index is
  shared; I left exactly one `R100` staged and nothing else.
- **Did not clean the dev tree.** No `checkout .`, no `reset --hard`, no `stash pop`, no `clean`.
- **Did not touch `/sot/`, Azure, Entra, SharePoint, or production data.**

---
True at `origin/main` 5ec99150, 2026-08-25T02:21Z. Untracked until a board PR commits it.

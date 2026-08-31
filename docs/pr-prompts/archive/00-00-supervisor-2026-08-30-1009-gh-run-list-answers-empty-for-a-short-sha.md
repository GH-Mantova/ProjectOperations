# Station 00 — Supervisor | 2026-08-30T10:09Z–2026-08-30T10:40Z

## GROUND

```
UTC            2026-08-30T10:09:16Z
origin/main    62fd27f1            (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 62fd27f1     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md)
bootstrap      1                   (scheduled-task SKILL.md) — MATCH, full authority
```

SIGHTED. `start_process` shell `powershell.exe` succeeded (pid 33364); every line below is from the
box unless tagged otherwise. The three binding docs were read from the working copy and then PROVED
current: `git diff --stat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **empty**, so the working copy is byte-identical to
`origin/main` for all three.

## WHAT I MEASURED

- **[MEASURED]** `status-sweep.ps1` @10:10:02Z — verdict **SAFE TO ACT**. Instrument positive controls
  both pass (gh reaches GitHub, node runs). OPEN PRs **0**. armed **0**. in-progress prompts **0**.
  git processes **0**. `index.lock` interactive/clone **False/False**. main trunk green (3/3).
- **[MEASURED]** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **CLEAN, exit 0**.
  119 checked, 0 malformed. No station SILENT: 00 2.0h/2 · 03 11.1h/24 · 04 4.0h/4 · 05 20.0h/24.
- **[MEASURED]** Nothing new to collect. Newest breadcrumbs on disk are `00-04-scanner-…-0611-…` and
  my own `00-00-supervisor-…-0809-…`, both already dispositioned by the 08:09 run. **No station has
  reported since.** (04 is due about now at 4.0h.)
- **[MEASURED]** Queue: `*-ready.md` **0**, depth-1 `*-HOLD.md` **59**, staged index **empty**
  (`git diff --cached --name-status` → nothing), no `index.lock` / `MERGE_HEAD` / `REBASE_HEAD` /
  `CHERRY_PICK_HEAD`, `git worktree list` shows only the dev tree at start.
- **[MEASURED]** Machinery: watcher node **RUNNING pid 26364**, wrappers **3** (matching BOTH launcher
  names per #1396), ENSURE-UP **no action**. Empty queue + stale heartbeat = idle, not wedged.
- **[MEASURED]** **OAuth, fifteenth reading, taken directly at `C:\Users\Marco\.claude\.credentials.json`:**
  mtime `2026-08-28T16:13:26.909Z` (UNCHANGED), `expiresAt` `2026-08-28T16:13:35.984Z`, **expired
  41.96 h**, lead **9.075 s**. Nothing has refreshed it in nearly two days.
- **[MEASURED]** Main CI on `62fd27f1` — the two workflows still in flight when the 08:09 run ended
  are now **both green**: Push on main `success`, CI `success`, **Deploy `success`**, **Tendering
  Browser Smoke `success`**.
- **[MEASURED]** `gh run list --commit <short sha>` returns `[]` — see F1, with its control.

## WHAT CHANGED

- Landed the F1 instrument trap into DOCTRINE §9.4 (this PR), re-recording the `instruments v2`
  canonical hash: `bf70de05304552d2` → `59c1d7bebf098272`. `lint-station.mjs` went from
  **REJECT 1 of 7** (the expected signature of an unrecorded §9 edit) to **ADMIT: all 7 docs clean**
  — that pair is the positive control that the block gate actually fires and was actually satisfied.
- Nothing else. **Armed nothing, merged nothing, dispatched no station, touched no `/sot/`.**

## FINDINGS

### F1 — `gh run list --commit <SHORT sha>` answers `[]`, exit 0, no warning

DOCTRINE §9.4 already warns that `gh run list --branch main` can be days stale and tells you to read
CI **per-commit**. The cure has a trap of its own. **[MEASURED]** on gh 2.90.0, same shell, same
minute, both directions:

```
gh run list --commit 62fd27f1                                  -> []
gh run list --commit 62fd27f1527e963165bfa37962a5476bbaf36d7d  -> 4 runs, all "success"
                                                                  (Push on main, CI, Deploy,
                                                                   Tendering Browser Smoke)
```

The short form does not error and does not warn. I hit it while checking exactly the thing the 08:09
run left open — whether Deploy and Tendering Browser Smoke went green on `62fd27f1` — and the honest
first reading of `[]` is *"no CI ran on that commit"*, one step from *"main CI is dead"*. That is
§9.6's shape precisely: an empty result read as an empty world, arrived at through the very bullet
that exists to prevent a stale-CI misread. The control (full SHA, same run) is what refuted it.

**DISPOSITION: ACTIONED.** Added to DOCTRINE §9.4 immediately after the `--branch main` bullet, with
the measurement and both controls, and the instruction to pass the full 40-char SHA. Verified by
`lint-station.mjs` ADMIT 7/7 after re-recording the canonical hash, and by reading the file back.

### F2 — the OAuth block stands, and it is now two days old

**[MEASURED]** Fifteenth consecutive reading with no change: expired **41.96 h**, mtime frozen at
`2026-08-28T16:13:26.909Z`. The **9.075 s** lead between the last write and the expiry is the whole
diagnosis — the refresher DID run and DID store a credential that was already 9 seconds from death,
so the failure is in the refresh **response**, not in a refresher that stopped running. Waiting
cannot fix that shape, which is why fifteen readings have not moved it.

Board consequence, unchanged: **arm nothing.** An armed prompt today is burned by the 401 exactly as
`pr-crm-s3-account-on-client-create` and `rev-1386` were on 08-29 — the prompt is consumed, the work
is not done. This is why the queue's stillness (0 armed, 0 open, 59 HOLD) is a correctly-held brake
and must not be reported as either health or a stall.

**DISPOSITION: ESCALATED** (standing, folded into the existing item — no second escalation raised).
Only Marco can re-authenticate. **RULE 1 options, complete-and-additive first:**
(A) Marco re-authenticates **and** we add a preflight guard that refuses to arm while the credential
is expired — solves it now and forever, adds nothing destructive, damages no data entry. **Both
halves pass.**
(B) Marco re-authenticates alone — solves today, fails the *future* half: the next expiry burns the
next armed prompt silently.
(C) Guard alone — fails the *immediate* half: the board stays frozen, correctly, but frozen.

### F3 — the collect channel had nothing in it this run, and that is a real reading, not a gap

**[MEASURED]** `--freshness` CLEAN, no station SILENT, and no breadcrumb written since 08:22Z. With
`OPEN=0`, `ARMED=0` and the OAuth brake held, there is genuinely no board work to drive: the only
productive lane open to 00 right now is landing measured doc corrections by hand, which is what this
PR does and what #1394 / #1400 / #1401 did before it.

**DISPOSITION: DEFERRED.** It becomes urgent the moment either (a) OAuth is restored, at which point
the 59 HOLD prompts need arming one at a time under RULE 4, or (b) a station goes SILENT past 2×
cadence in `--freshness`. Neither is true now.

## WHAT I DID NOT DO

- **Armed nothing** — the OAuth block stands (F2). Did not stage `rates-11c-blocked-consumers`
  though §6 of the sweep still reports it READY TO STAGE, for the same reason.
- **Merged nothing** — there were no open PRs to merge (OPEN=0) other than this run's own.
- **Did not chase `watcher clone: dirty=35`** — 03's lane, and a known permanent amber (the watcher's
  own `verdict-archive` moves 35 tracked files without committing).
- **Did not clear the 13 `[STALE]` dead escalations in `needs-marco/`** — the folder is gitignored, so
  no PR can clear them and no reviewer can see them. Still Marco's to decide whether that folder
  should be tracked at all.
- **Did not act on the sot-refs `exempt=` burn-down** — re-dispatched to **05** at 06:09Z, and 05 is
  20.0h into a 24h cadence, so it has not yet had a turn. If 05 has not acted by my next sighted run,
  I land the doc paragraph myself.
- **Did not restart the watcher** — pid 26364 alive, 3 wrappers, empty queue is CORRECT, not wedged.
- **Did not touch** `/sot/`, `metadata-catalog.json` (CRLF stat artefact), the watcher clone's git, or
  anything Azure / Entra / SharePoint.

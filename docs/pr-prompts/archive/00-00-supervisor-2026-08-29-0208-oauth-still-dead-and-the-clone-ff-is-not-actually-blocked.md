# Station 00 — Supervisor | 2026-08-29T02:08Z–2026-08-29T02:30Z

## GROUND

```
UTC            2026-08-29T02:08Z
origin/main    873b3ef6            (git fetch origin, then git rev-parse --short=8 origin/main)
dev tree       main @ 1501d09c     C:\ProjectOperations2   (11 behind origin/main)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md: station_doc_version: 1)
```

Versions AGREE. Desktop Commander PRESENT — this run is **SIGHTED**, not blind.

## WHAT I MEASURED

- `[MEASURED]` **Reachability.** `start_process` shell `powershell.exe` → pid 29276. Control
  `$ctl='DOLLAR-OK'` echoed back intact, so `$` survives `interact_with_process` (the §9.1
  `-Command` stripping trap does not apply to this channel).
- `[MEASURED]` **origin/main = `873b3ef6`**, `docs(board): sweep up 00's orphaned 20:09Z breadcrumb
  and the 22:09Z run (#1387)`, committed 2026-08-28T22:17Z. **Unchanged for ~8h — nothing merged.**
- `[MEASURED]` **OPEN PRs = 0.** `gh pr list --state open --limit 50 --json ...` → count 0.
- `[MEASURED]` **ARMED = 0.** `Get-ChildItem docs\pr-prompts -Filter *-ready.md -File` → 0.
  Positive control on the same glob shape: `*-HOLD.md` → **84**. The instrument can count.
- `[MEASURED]` **Queue is cold.** newest `processed/` = 2026-08-28T16:13Z; newest `failed/` =
  2026-08-28T21:03Z (`pr-crm-s3-account-on-client-create-ready.md`). Nothing consumed in ~10h,
  nothing burned in ~5h.
- `[MEASURED]` **OAuth, at source.** `C:\Users\Marco\.claude\.credentials.json`:
  `expiresAt = 1787933615984` → **2026-08-28T16:13:35Z**; file `LastWriteTimeUtc = 2026-08-28T16:13:26Z`,
  1649 bytes. Now = 2026-08-29T02:09:47Z. **EXPIRED = True, and the file has not been rewritten in
  ~10h** — so no refresh has been attempted or has succeeded since the moment it died.
- `[MEASURED]` **Dev-tree index is CLEAN.** `git diff --cached --name-status` → empty, exit 0.
  No `index.lock`. No `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD`. **No staged half-arm.**
- `[MEASURED]` **Watcher clone `C:\po-watcher\ProjectOperations`** (read-only git only):
  `main @ 181817aa`; `git rev-list --left-right --count origin/main...HEAD` → **`11  0`**;
  `git merge-base --is-ancestor HEAD origin/main` → **exit 0**; dirty = 35, **all ` D`**;
  stashes = 51; `git worktree list` → **1** (the main tree only).
  Incoming file set (`git diff --name-only HEAD origin/main`) = 32; intersection with the 35
  locally-deleted paths = **0**.
- `[MEASURED]` **Process table.** watcher node = 1 (`pid 26364`, chain `2984 → 30388 → 26364`).
  Launchers matching `watcher-launcher-singlelane.ps1` = **3**: `10364` (08-24, parent 26276 GONE),
  `23100` (08-27, parent 25072 GONE), `2984` (08-28, live chain).
  **Each of the three has a live `powershell.exe -Version 5.1 -s` child**: `16884` under 10364,
  `20636` under 23100, `32336` under 2984.
- `[MEASURED]` **Sentinels.** `STOP-WATCHER`, `STOP-WATCHER-LANE2` absent in both trees.
- `[MEASURED]` **`status-sweep.ps1` exit 0**, VERDICT `SAFE TO ACT: no board mutation in progress,
  no recent remote activity`, stamped `SWEEP COMPLETE 2026-08-29 02:11:44Z`.
- `[MEASURED]` **`check-breadcrumb.mjs` exit 0** — `89 checked, 0 malformed, 7 skipped as
  pre-contract`, `CLEAN`. **`--freshness` exit 0** — 00/03/04/05 all `ok`, 02 dispatch-only.
- `[MEASURED]` **Breadcrumb tracking, cross-checked against the remote** with
  `git cat-file -e origin/main:<path>`:
  - ON MAIN: `00-00-supervisor-...-2009-...md`, `00-00-supervisor-...-2209-...md`
  - ABSENT: `00-00-supervisor-2026-08-29-0008-...md`, `00-03-machine-minder-...-2302-...md`,
    `00-04-scanner-...-2210-...md`
  `--freshness` emitted **five** `NOTE ... is UNTRACKED` lines — including the two that are on main.
- `[MEASURED]` **Shared dev tree still carries uncommitted `sot/`**: ` M sot/03-progress-log.md`,
  ` M sot/06-active-specs.md`, ` M docs/qa/sot-refs-baseline.json`, plus ` M
  docs/data-model/metadata-catalog.json` and ` M docs/pipeline/sweep-rotation.json` (04's rotation).
- `[CANNOT MEASURE]` Whether Marco is at the machine to re-authenticate. No probe exists for that.

## WHAT CHANGED

1. Wrote this breadcrumb.
2. Opened and merged one docs-only board PR carrying the **three genuinely untracked breadcrumbs**
   (00's 0008Z, 03's 2302Z, 04's 2210Z) plus the `STATION-CAPABILITIES.md` §2 correction in F6.
   Built in an **isolated worktree off `origin/main`**; the shared dev-tree index was verified clean
   before and after; merged via `Assert-SmokedOrEscalate` → `Merge-Pr` and the merge was read back.
3. **Nothing was armed.** **No process was killed.** **No git write touched the watcher clone.**

## FINDINGS

### F1 — The OAuth token is still expired, measured at source, and it has not tried to refresh

`expiresAt = 2026-08-28T16:13:35Z`; the credential file's own mtime is `16:13:26Z`. Ten hours later
it is byte-for-byte the same file. This is not "a token that will roll over shortly" — the refresh
path is not running. Every agent-lane prompt fired since 16:13Z has died `401 ... token has expired`,
exit 1, retries 0, and one of them (`pr-crm-s3-account-on-client-create`) was **real feature work**,
not a rev-. The board's total stillness — 0 open, 0 armed, nothing merged in 8h, nothing consumed in
10h — is this one fact wearing eight different costumes.

**ARM NOTHING while this stands.** Arming converts a HOLD into a burn.

RULE 1 options, complete-and-additive first:

- **(C) Re-authenticate AND add a pre-arm credential guard.** Marco re-auths; separately we add a
  check to the arming path that reads `expiresAt` and refuses to arm on an expired or
  about-to-expire token. Solves it now *and* in future, and adds nothing to data entry. **Both
  halves pass.**
- **(A) Re-authenticate only.** Fixes it immediately; fails the *future* half — the next expiry
  burns the next prompt exactly the same way.
- **(B) Drop `STOP-WATCHER` and leave it.** Fails both halves: it does not restore the lane, and it
  stops nothing that is not already stopped (ARMED = 0).

**DISPOSITION: ESCALATED.** Re-auth needs Marco at the machine — no agent has an identity (DOCTRINE
§5.3). The question for him is not "please re-auth" but: **do you want guard (C) built?** If yes it
is ordinary work and 00 will stage it.

### F2 — "The watcher clone has DIVERGED and `--ff-only` cannot succeed" is REFUTED

Measured three ways: `git rev-list --left-right --count origin/main...HEAD` = `11  0` (**zero**
commits unique to the clone), `git merge-base --is-ancestor HEAD origin/main` exits **0**, and the
32 incoming paths intersect the 35 locally-deleted paths in **zero** files. The clone is **behind,
not diverged**, and a fast-forward would not have to overwrite a single dirty path. The 35 ` D`
entries are unstaged deletions that a FF does not touch.

The standing note that said otherwise was reading "dirty" as "diverged". It is wrong and should stop
being cited.

But the FF still cannot be done by anyone who has looked at it:

- **00** is barred absolutely — station doc *"YOU NEVER TOUCH GIT IN THE WATCHER'S REPO. EVER"*,
  DOCTRINE §4, and the ACTIVE DRIVE MANDATE explicitly preserves *"never merge in the watcher repo"*.
- **03** is **report-only** in the authority matrix (STATION-CAPABILITIES §5) — which is precisely
  why 03 dispatched this back to 00 at 23:02Z.

So the operation is now known to be safe and is still owned by nobody. That is the finding.

RULE 1 options, complete-and-additive first:

- **(C) Give 03 a narrow, scripted FF authority.** A committed `scripts/pipeline/ff-watcher-clone.ps1`
  that refuses unless: watcher node absent or idle, ARMED = 0, `--is-ancestor` passes, and the
  incoming∩dirty intersection is empty — then FFs and reads back. 03 may run *that script* and
  nothing else. Solves it now and forever, adds no data-entry risk, and the guard encodes exactly
  the four things measured above. **Both halves pass.**
- **(A) Marco runs the FF by hand this once.** Immediate; fails the future half — the clone falls
  behind again within days and we are back here.
- **(B) Leave it behind.** Fails both. A restart adopts nothing (DOCTRINE §9.5): the watcher runs
  `index.mjs` **from the clone**, so every watcher-code fix merged in the last 11 commits — including
  #1358/#1360's guards — is **inert in the running watcher** until this FF happens.

**DISPOSITION: ESCALATED.** It is an authority grant, which is Marco's alone (DOCTRINE §5.3).

### F3 — `check-breadcrumb.mjs --freshness` reports false UNTRACKED, and here is the line

`tracked()` at `scripts/pipeline/check-breadcrumb.mjs:82` builds its set from
`git ls-files docs/pr-prompts` — the **local index**. This dev tree is 11 commits behind
`origin/main`, so any breadcrumb landed in those 11 commits is absent from the local index and is
reported `UNTRACKED`. This run: **5 NOTE lines, 2 of them false** (the 20:09Z and 22:09Z breadcrumbs
are on `origin/main`, proven with `git cat-file -e origin/main:<path>`, exit 0 both).

The fix is one line: resolve against `git ls-tree -r --name-only origin/main -- docs/pr-prompts`
(with `-r`, per §9.2), not `git ls-files`. That also fixes the previously-reported second half — a
station reading `ok` for a breadcrumb that never landed — because both symptoms are the same
working-tree-vs-remote confusion.

**DISPOSITION: DISPATCHED** to **06 (PR Master)** — adds the root cause and the exact line to the
dispatch already open from 2026-08-28T22:09Z. Until it ships, **confirm every tracking claim with
`git cat-file -e origin/main:<path>`.**

### F4 — The orphan-launcher kill list is incomplete: each launcher has a live child

03 dispatched *"kill orphan launchers pid 10364 + 23100 BY PID, keep 2984 → 30388 → 26364"*.
Measured this run: **10364 has a live `powershell.exe -Version 5.1 -s` child, pid 16884**, and
**23100 has one, pid 20636**. Killing the two named PIDs alone leaves those two behind, reparented
and invisible to the same query that found their parents. The `-s` child is **not** the anomaly —
the live launcher 2984 has one too (32336) — so it is a normal part of a launcher, and it must be
killed *with* its parent, not used to tell the orphans apart.

What actually distinguishes the orphans: their own parents (26276, 25072) are **GONE**, and neither
has a `start-watcher.ps1` or `node` descendant. 2984 has both.

**DISPOSITION: DEFERRED.** Killing launchers while the lane is dead buys nothing and risks the one
live chain. It becomes urgent the moment F1 clears: **in the re-auth window, do 03's item (1) — the
clone FF — first, then this, killing each launcher together with its `-s` child.**

### F5 — Three breadcrumbs were untracked; the reporting channel was closed

00's 0008Z, 03's 2302Z and 04's 2210Z existed only on this box. 04's 2210Z carries the
DOCTRINE §9.5 correction (*the silent gate-waiver is `git`, not `gh`*), which is a binding-document
error that reaches nobody while the file sits untracked.

**DISPOSITION: ACTIONED.** Landed in this run's board PR; verified with
`git cat-file -e origin/main:<path>` after the merge.

### F6 — `STATION-CAPABILITIES.md` §2's blindness diagnostic is refuted and actively misleading

§2 says: *"if a station appears in `list_triggers`, it is cloud-fired and **will be blind**."*
Refuted twice now. 03 filed a full breadcrumb at 23:02Z while blind, and **this run appears in the
scheduled-task listing and has Desktop Commander**. The listing does not predict blindness in either
direction. Leaving the line in place invites a station to conclude it cannot reach the box without
trying, which is exactly the "no news" that a blind run and a healthy quiet run both produce.

The honest replacement: blindness is **intermittent** (~40% of 00's recent runs), **its cause is
unknown**, and the only test is to actually call `start_process` and report the result.

**DISPOSITION: ACTIONED** — the line is corrected in this run's board PR. The *cause* of the
intermittent blindness remains **ESCALATED and unanswered**.

### F7 — `sot/` edits are still sitting uncommitted in the shared dev tree

` M sot/03-progress-log.md`, ` M sot/06-active-specs.md`, ` M docs/qa/sot-refs-baseline.json` —
unchanged since the 00:08Z run flagged them. Only 05 may commit `sot/`, and CP-24 hard-fails any PR
mixing code and `sot/`, so this cannot be swept up by a board PR.

**DISPOSITION: DISPATCHED** to **05 (SoT-keeper)** — re-stated, not new. Still open.

### F8 — I nearly filed a false finding because my own tail lied

`node check-breadcrumb.mjs --freshness | Select-Object -Last 40` showed **one** UNTRACKED NOTE. I
was one step from reporting *"the validator flags only 1 of 3 untracked breadcrumbs"* as a defect.
Re-running the same command piped through `Select-String 'NOTE'` returned **five**. The four missing
lines were sorted earlier in the output and fell off the top of the tail.

DOCTRINE §7 in its purest form: the system was fine and the **instrument** — a `-Last 40` window on
sorted output — produced a confident, coherent, wrong reading. **Never conclude absence from a
tail.** Grep for the thing, or read the whole stream.

**DISPOSITION: ACTIONED** — recorded here so the next run does not repeat it.

## WHAT I DID NOT DO

- **Armed nothing.** ARMED stayed 0 all run. F1 makes arming a burn, not a build.
- **Did not fast-forward the watcher clone**, though I proved it is safe. Forbidden to 00 by an
  absolute rule (F2). Escalated instead of reasoning past it.
- **Did not kill 10364 / 23100 / 16884 / 20636.** Deferred to the re-auth window (F4), and no
  process is killed here without the report going first.
- **Did not clear the 51 stashes or the 35 ` D`** in the clone. Read-only git only in that tree;
  `stash drop` never `pop`, and never `checkout` those deletions.
- **Did not touch `sot/`** — 05's lane (F7).
- **Did not re-lint the board.** 84 HOLDs, and a lint verdict is worthless while F1 stands.
- **Did not clear the `[STALE]` escalation files** the sweep listed. They are dead references, not
  live work, and clearing them is churn that would bury this run's real output.

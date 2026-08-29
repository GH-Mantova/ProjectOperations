# Station 00 — Supervisor | 2026-08-29T08:08Z–2026-08-29T08:4xZ

## GROUND

```
UTC            2026-08-29T08:08:52Z
origin/main    80e6d80d            (unchanged since #1389 merged 06:18:28Z)
dev tree       main @ 1501d09c     C:\ProjectOperations2   (3 behind main)
doc version    1
bootstrap      1                   (match — full authority this run)
```

SIGHTED. Desktop Commander reached the box on the first call.

## WHAT I MEASURED

- **[MEASURED]** `git rev-parse --short origin/main` after `git fetch origin` → `80e6d80d`. Nothing
  has merged in the 1h50m since my own #1389. `git rev-parse --short HEAD` in the dev tree →
  `1501d09c`.
- **[MEASURED]** `git diff --cached --name-status` in the shared dev tree → **empty**. No half-arm
  staged by a concurrent chat.
- **[MEASURED]** armed = `@(Get-ChildItem docs\pr-prompts -Filter *-ready.md -File).Count` → **0**.
  Positive control on the same glob shape: `*-HOLD.md` → **84**. The instrument can count.
- **[MEASURED]** `gh pr list --state open --json number,title,mergeStateStatus,isDraft` → `[]`.
  **Zero open PRs.** Nothing to drive, nothing to merge, nothing DIRTY.
- **[MEASURED]** queue folders: `needs-marco` 14 · `no-pr-opened` 107 · `failed` 41; newest `failed/`
  entry `2026-08-28T21:03:55Z`. Byte-identical to the 02:08Z, 04:08Z and 06:08Z readings — the queue
  has not moved in four runs.
- **[MEASURED]** OAuth, read at source from `C:\Users\Marco\.claude\.credentials.json`:
  `expiresAt` = `1787933615984` = **2026-08-28T16:13:35.984Z**; file mtime
  `2026-08-28T16:13:26.909Z`. Now `2026-08-29T08:09:48Z`. **Expired 15h56m ago, and the mtime has
  not moved in 15h56m — nothing is refreshing it.** The execution lane is still dead.
- **[MEASURED]** `restart-watcher-if-wedged.ps1` (the only sanctioned liveness probe) →
  `watcher process: ALIVE (pid 26364)`, `armed prompts waiting: 0`, `restart churn: 0 cycle(s) in
  20 min`, `VERDICT: OK - nothing armed and the watcher is alive.`
- **[MEASURED]** `node scripts/pipeline/check-breadcrumb.mjs --freshness` in the dev tree →
  `00  last 2026-08-29T04:08:00Z  4.0h ago  (cadence 2h)  SILENT`, exit **2**.
- **[MEASURED]** That verdict is FALSE. `git ls-tree -r --name-only origin/main -- docs/pr-prompts`
  lists `00-00-supervisor-2026-08-29-0608-i-landed-the-refuted-diagnostic-fix-myself.md`, and
  `Get-ChildItem docs\pr-prompts -Filter "00-00-supervisor-2026-08-29-06*"` in the dev tree returns
  **nothing**. The breadcrumb is on main and absent from this working directory, because the dev
  tree is 3 commits behind.
- **[MEASURED]** Root cause read at source, `check-breadcrumb.mjs`: the freshness map is built from
  `readdirSync(DIR)` (line ~136) — the **working directory** — and `tracked()` (line ~82) builds its
  set from `git ls-files` — the **local index**. Both lag main. Neither ever consults `origin/main`.
- **[MEASURED]** Negative/positive control pair, same cwd (`C:\ProjectOperations2`), same data, only
  the instrument changed: old script → `00 last 04:08:00Z SILENT`, exit **2**. Patched script →
  `00 last 06:08:00Z ok`, exit **0**. The patched script in a clean tree at `origin/main` →
  `93 checked, 0 malformed`, all five stations `ok`, `CLEAN`, exit **0**.
- **[MEASURED]** F3 audit (04's dispatch to me). `04-scanner.md:173` names
  `docs/qa/Master-QA-and-Consolidation-Program-Plan.md` as a rebuild source; absent from
  `origin/main`, absent from disk, not gitignored. **Genuinely dead.** The other three are not:
  `00-supervisor.md:366` already reads `~~…triage-state.md~~ - REMOVED` (struck out on 2026-08-24);
  `03-machine-minder.md:162` says *"create if absent"* and writes it back at `:171/:172/:175/:179`;
  `02-board-driver.md:306` says *"Overwrite … each run"*. Three of the four self-create.
- **[MEASURED]** `sweep-rotation.json` on `origin/main` is `last_index: 2` / `02:11:07Z`; the dev
  tree carries `3` / `06:10:57Z`. Forward, not a regression — safe to land.

## WHAT CHANGED

One PR, opened from a disposable worktree `C:\po-wt-sup0808` created off `origin/main`
(`git worktree add … -b fix/breadcrumb-collector-reads-main origin/main`, exit 0). The shared dev
tree was never committed from, never `checkout`-ed, never reset.

1. **`scripts/pipeline/check-breadcrumb.mjs`** — `tracked()` now probes
   `git ls-tree -r --name-only origin/main -- docs/pr-prompts` first (with `-r`, per DOCTRINE §9.2)
   and falls back to `git ls-files` when `origin/main` is unavailable, so a shallow CI checkout keeps
   the old behaviour rather than losing the check. Freshness now unions the on-disk listing with what
   is on main; a breadcrumb on main but not on disk counts for freshness and is skipped for
   structural checking (`existsSync` guard) — a file you cannot read cannot be validated.
2. **`docs/pipeline/stations/04-scanner.md:173`** — the dead rebuild source replaced with
   *"rebuild from `docs/pipeline/stations/04-scanner.md` Part 0 (the six sub-checks below)"*, 04's
   own suggested wording, plus the measurement that retired it.
3. **Swept up two untracked artefacts**: 04's `…-0610-instruction-drift-bootstraps-are-the-last-stale-layer.md`
   breadcrumb and its `docs/pipeline/sweep-rotation.json` advance (`2` → `3`).
4. **This breadcrumb.**

Edits made with node (`readFileSync`/`writeFileSync`, utf8), EOL detected from the file and anchors
joined with it, an ANCHOR-NOT-FOUND guard on every replacement, and a read-back asserting byte delta,
zero `U+FFFD`, no BOM, and CRLF preserved. All three edits reported `ok`.

**Board mutations: none.** Nothing armed, nothing merged, no label touched.

## FINDINGS

### F1 — The collector's own instrument reported Station 00 SILENT on the run after its breadcrumb merged

`check-breadcrumb.mjs --freshness` is the first thing my station doc tells me to run, and its exit-2
`SILENT` is defined as a defect I must disposition. It fired on me. It was wrong: the 0608 breadcrumb
merged in #1389 at 06:18Z and sits on `origin/main`; it is simply not in this working directory,
because the dev tree is 3 commits behind.

This is the **third** distinct false verdict from one root cause — the script measures the local tree
and calls the answer "what has landed". The first two (a false `UNTRACKED` on a landed breadcrumb; a
false `ok` on a breadcrumb that never landed) were dispatched to Station 06 on 2026-08-29T02:1xZ. This
one is worse than both, because a false `SILENT` on 00 is precisely the alarm that says "a station did
not run" — and crying wolf on the collector trains the collector to ignore its only freshness signal.

Both halves are fixed by one change, and it is proven by a control pair rather than by inspection.

**DISPOSITION: ACTIONED** — fixed in this PR, with the negative control (old script, `SILENT`, exit 2)
and the positive control (patched script, same cwd and data, `ok`, exit 0) both quoted above, plus a
clean-tree run at `origin/main` returning `93 checked, 0 malformed, CLEAN, exit 0`.

### F2 — Station 06 has no schedule, so the 02:1x dispatch of this same bug could never have fired

I dispatched the `tracked()` half to 06 six hours ago. 06 has no cadence
(`STATION-CAPABILITIES.md §6`: "on demand"), and the execution lane that would carry an on-demand
dispatch has been down on expired OAuth since 2026-08-28T16:13Z. The dispatch was posted into a
channel with no reader — the same lesson my 06:08Z run recorded and, evidently, the same mistake
repeated one run later.

**DISPOSITION: ACTIONED** — I stopped waiting for 06 and did it myself. The work was in-lane (a
pipeline instrument, not code the watcher builds), the board was empty, and no other actor was
mid-mutation, so there was no LL-38 collision to risk. **The standing rule I am writing down: before
dispatching anything, name the live channel that will deliver it. If there is none, it is mine.**

### F3 — 04's "three dead paths" is one dead path and three self-creating ones

04 dispatched four station-doc lines to me as "dead paths given as live instructions". Measured, only
`04-scanner.md:173` is a dead READ — it tells the scanner to rebuild a checklist from a file deleted
in the 2026-08-17 cleanup and never restored. The other three name files their own instruction
creates: `03-machine-minder.md:162` says "create if absent", `02-board-driver.md:306` says "Overwrite
… each run", and `00-supervisor.md:366` was already struck out as REMOVED on 2026-08-24. Reading a
file your next line writes is not drift.

**DISPOSITION: ACTIONED** (the one real instance, fixed in this PR) **and the other three withdrawn**
— do not re-raise them. 04's underlying instrument is sound; its classifier conflated "absent from
main" with "instruction is dead", which is DOCTRINE §9.6's empty-result trap wearing a finding's
clothes.

### F4 — The execution lane has now been down for 16 hours and nothing is refreshing the token

`expiresAt` 2026-08-28T16:13:35Z, file mtime 2026-08-28T16:13:26Z, both unmoved across five
consecutive supervisor runs. The watcher is alive (pid 26364) and would happily consume an armed
prompt; it would then 401 and burn it into `failed/`, which is exactly what happened to a real feature
prompt at 21:03Z on 2026-08-28. So the correct behaviour is the one I am taking: **arm nothing.** The
board's stillness is a held brake, not health and not a stall.

**DISPOSITION: ESCALATED** (standing, unanswered since 2026-08-28T18:09Z). Marco, two things, and
RULE 1 applied to each:

**(C) — complete and additive, and it is the one I recommend.** Re-authenticate (`claude setup-token`
or the interactive login on the box), **and** add a pre-arm guard that reads `expiresAt` and refuses
to arm when the token is expired or inside its last 15 minutes. Solves it now *and* in future; adds a
check without touching any existing data path. Nothing is lost if the guard never fires.

**(A) — re-authenticate only.** Passes "solves it immediately", **fails "and in future"** — the token
expires again and the next unattended run burns another real prompt exactly as 21:03Z did.

**(B) — leave the brake on and keep arming nothing.** Passes "damages nothing", **fails "solves it"** —
the board simply stops, and every queued slice ages.

### F5 — Nobody may fast-forward the watcher clone, and it is still behind

Unchanged and still open, carried from 02:08Z. The clone is **behind, not diverged** (`rev-list
--left-right --count` = `11  0`, `merge-base --is-ancestor` exit 0), so `--ff-only` would succeed.
But 00 is barred absolutely (station doc + DOCTRINE §4 + the mandate's "never merge in the watcher
repo") and 03 is report-only. Until it is fast-forwarded, the watcher runs `index.mjs` from the old
clone and the guards merged in #1358/#1360 stay inert — **a restart adopts nothing** (DOCTRINE §9.5).

**DISPOSITION: ESCALATED** (unanswered). RULE 1: **(C)** a guarded `ff-watcher-clone.ps1` plus a
narrow, explicit Station 03 authority to run it with the watcher stopped — complete and additive, and
it is the only option that passes both halves. **(A)** Marco does it by hand — solves it now, fails
"future". **(B)** leave it — fails both.

### F6 — `lint-station.mjs` never opens a bootstrap, and the five bootstraps are still the last stale layer

04 measured this at 06:10Z and dispatched it to 06. Same reasoning as F2: 06 has no live channel. But
unlike F2 this one is **not** mine to close — the five `C:\Users\Marco\Claude\Scheduled\*\SKILL.md`
bootstraps are the governing layer for a scheduled run and **no agent may edit them**; only Marco's
paste can. Fixing the linter without fixing the bootstraps would only make the gate honest about a
layer it still cannot repair, and I would rather escalate the pair together than half-fix it.

**DISPOSITION: ESCALATED** — Marco, this is the one-paste job: five files, two lines each
(the refuted blindness diagnostic at L25, and the "docs/qa is gitignored" claim at L84 — both already
retired in the repo, by #1389 and #1383 respectively). Replacement text is in 04's 0610 breadcrumb,
which this PR lands. **Never bump `station_doc_version`.**

## WHAT I DID NOT DO

- **Armed nothing.** 84 `-HOLD.md` prompts are staged and several are gate-cleared, but the OAuth
  block stands: an armed prompt today gets consumed, 401s, and lands in `failed/`. Arming into a dead
  execution lane destroys work rather than doing it.
- **Merged nothing** — the board is empty (`gh pr list --state open` → `[]`). Nothing was routed to
  Marco this run, so RULE 2 had nothing to catch.
- **Did not fast-forward the watcher clone** (F5) — forbidden to me, and no amount of it being safe
  changes who may do it.
- **Did not touch the five scheduled-task bootstraps** (F6) — the governing layer, Marco's alone.
- **Did not fix `lint-station.mjs`'s blindness to bootstraps** — deliberately paired with F6 rather
  than shipped as a half-measure.
- **Did not rewrite `03-machine-minder.md`'s triage flow.** Its five `triage-state.md` references are
  self-creating, not dead; changing how 03 triages is a design decision, not a docs correction.
- **Did not run station doc §3b ENSURE-UP.** My 06:08Z run measured that its "wrapper alive" signal
  counts launchers, not `supervise-watcher.ps1`, so on a false negative it would start a fourth
  launcher. It stays quarantined until that edit lands.
- **Never ran `git` in `C:\po-watcher\ProjectOperations`**, and never committed from the shared dev
  tree — all work happened in the disposable worktree, torn down after the merge.

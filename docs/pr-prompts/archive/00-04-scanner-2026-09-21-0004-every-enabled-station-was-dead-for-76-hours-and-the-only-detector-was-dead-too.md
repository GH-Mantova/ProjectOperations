# Station 04 — Scanner | 2026-09-21T00:04:59Z–2026-09-21T00:20Z

## GROUND

```
UTC            2026-09-21T00:04:59Z
origin/main    875e1076            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ 895bdefc      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE — this run was not restricted to read-only on that account.
Station 04 is read-only on the board by its own authority row regardless.

**Sweep this run:** `instrument-honesty` (rotation position 2 of 4), selected by
`node scripts/pipeline/next-sweep.mjs`, previous run 2026-09-17T18:11:02Z.

**Rotation advanced and LEFT DIRTY:** `docs/pipeline/sweep-rotation.json`
(`git diff --numstat` = `2 2`). **Station 00 must commit this file** — 04 may not.

**Fresh negative control minted for this run:** `zzQq04Needle` + `20260921T0010`
(written split so this breadcrumb does not spend it twice). It returned **0** on every corpus
probed. It is spent the moment this file lands.

---

## WHAT I MEASURED

### Preflight

- **[MEASURED]** Desktop Commander `start_process` shell `powershell.exe` reached the box on the
  first call. `Test-Path C:\ProjectOperations2\docs\pipeline\stations\04-scanner.md` → `True`.
  **This run was NOT blind.**
- **[MEASURED]** VM git guard installed, last line quoted verbatim:
  `persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
  (preceded by `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths
  and mounted cwd, allows everything else (three controls passed)`), exit 0.
- **[MEASURED]** All three binding documents read in full. Freshness proved with the sound form,
  not a piped hash: `git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md
  docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**. The working copies
  are byte-identical to `origin/main`, so reading them was sound.
- **[MEASURED]** `status-sweep.ps1` exit 10, §7 verdict **`SAFE TO ACT: no board mutation in
  progress, no recent remote activity, no live station worktrees.`**
- **[MEASURED]** Host PS `5.1.26100.9444`.

### The sweep — DOCTRINE §9 traps, each run against the corpus its own bullet names

Per §9.6's closing rule, no probe was pointed at §9 itself. Every row below reproduced the
documented failure. **Nothing in §9 failed to reproduce.**

| # | §9 bullet | probe | result | verdict |
|---|---|---|---|---|
| 1 | 9.1 `-Command` layer expansion (nested form) | first call of the run, `powershell.exe -NoProfile -Command "...$env:COMPUTERNAME..."` through `start_process` | `$env:COMPUTERNAME` consumed before the child parsed; command arrived as `('HOST=' + + ' NOW=' ...)` → `InvalidCastFromStringToInteger` | **TRAPPED** |
| 2 | 9.1 `Get-ChildItem "$d\*" -Recurse -Filter -File` | fixtures A/B/C rebuilt, truth known by construction | A: depth1=1 → 2/2/3/3 · B: depth1=1 → 2/2/3/3 · **C: depth1=0 → bare 2, star 0, bare 3, star 0** | **TRAPPED** |
| 3 | 9.1 single-quoted `\\` needle vs a Windows path | 11 `SKILL.md` under `C:\Users\Marco\Claude\Scheduled` | double-backslash **0** · single-backslash **17** · NEG 0 | **TRAPPED** |
| 4 | 9.1 automatic variable as loop target | `foreach ($home in @(1,2,3))` via `-File` | `SessionStateUnauthorizedAccessException`, **0 rows**; POS control `$loopVar` → **3** | **TRAPPED** |
| 5 | 9.2 `git ls-tree` depth + glob pathspec | `docs/pr-prompts/superseded` | no slash **1** · with slash **230** · `-r` with slash **436** · **glob pathspec `docs/pr-prompts/*.md` → 0** against POS control depth-1 literal **41** | **TRAPPED** |
| 6 | 9.2 `git check-ignore -v` on a directory | `docs/pr-prompts/processed` | dir exit **1** empty · tracked `CLAUDE.md` exit **1** empty (**opposite truths, identical result**) · a file inside → exit **0**, `.gitignore:76` | **TRAPPED** |
| 7 | 9.2 `git branch -r` vs the remote | dev tree | `branch -r` **68** vs `git ls-remote --heads origin` **15** | **TRAPPED** (worst ratio yet — see F4) |
| 8 | 9.3 `Measure-Object -Line` | `scripts/pipeline/lint-prompt.mjs` | `(Get-Content).Count` **2444** · `Measure-Object -Line` **2282** · blank lines **162** · delta **162 exactly** | **TRAPPED** |
| 9 | 9.3 `*>` writes UTF-16LE | `status-sweep.ps1 *> sweep.txt` this run | opens `FF FE`, **152,008 bytes**, decoded `utf16le` → 902 lines | **TRAPPED** |
| 10 | 9.3 `-SimpleMatch` + `[regex]::Escape()` | `scripts/pipeline/*.ps1` | raw literal **24** · escaped literal **0** · NEG needle **0** | **TRAPPED** |
| 11 | 9.3 node `String.length` vs bytes | `scripts/pr-watcher/index.mjs` | Buffer **152,237** vs string **151,617** UTF-16 units, delta **620** | **TRAPPED** |
| 12 | 9.4 `@(...).Count` | inline / assign / null | inline empty **1** (truth 0) · inline four **1** (truth 4) · assign empty **0** · assign four **4** · **assign `$null` 1** (truth 0) · null-guarded **0** and **4** | **TRAPPED**, all three clauses |
| 13 | 9.4 `gh run list --commit <short>` | `875e1076` vs full 40-char | short → **`[]`** at exit 0 · full → **20 rows** | **TRAPPED** |
| 14 | 9.4 `gh pr view <n> --json number` | PR 999999 | `--json number` → **exit 0, `{"number":999999}`** · `--json number,state` → exit 1 GraphQL · POS control #2017 → `{"number":2017,"state":"OPEN"}` | **TRAPPED** |
| 15 | 9.4 `merged` on a LIST response | `gh api /pulls?state=closed&per_page=10` | 10 entries · `merged === true` **0** · `merged` key **defined at all 0** (absent, the `gh` shape) · `merged_at` populated **10/10** · POS control single GET `/pulls/2016` → `merged=True` | **TRAPPED** |
| 16 | 9.4 `gh` infers repo from CWD | from `C:\Windows` | no `-R` → **exit 1, 0 stdout chars** · with `-R` → exit 0, 19 chars | **TRAPPED** |
| 17 | 9.5 clone-dirty: sweep form vs watcher form | `C:\po-watcher\ProjectOperations` | `status --short` **1** vs `--porcelain --untracked-files=no` **0** | **TRAPPED** — and by a NEW artefact, see F3 |
| 18 | 9.5 daily clone log selection | `…\pr-watcher\logs` | 52 `*.log`, **47 daily-shaped, 5 non-daily**; newest-ANY and newest-DAILY both `2026-09-21.log` @ `00:09:07Z` — they agree today, the hazard is latent | **latent, not fired** |
| 19 | 9.5 `.arming-log.txt` two-count probe | working copy vs `origin/main` | **133 = 133**, identical last row `2026-09-17T19:19:51Z ARMED pr-crmvis-s6-bulk-link`; tracked exit 0, NEG exit 1 | **gap CLOSED today** |
| 20 | 9.6 negative-control contamination | `docs/pr-prompts/**` | spent needle 1 → **60** · spent needle 2 → **43** · fresh needle → **0** | **TRAPPED**, worsening (F4) |

**Provenance note on row 1.** §9.1's 2026-09-14 correction says the trap lives in the *nested*
`powershell.exe -Command "…"` form and not in the bare Desktop Commander shell. This run met both:
the nested form failed as described (row 1, and again mid-run when a `node -e` one-liner was sent
through `cmd /c "… node -e "…""` and died `Missing ')' in method call`), while `-File` and direct
statements preserved `$` intact (row 4 reached the `$home` mechanism, which only a `$`-preserving
transport can). **The correction is current and its cure is working.**

### The outage — measured after the freshness instrument flagged it

- **[MEASURED]** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **2**,
  **`SILENT: 4 station(s) past cadence`**:
  `00` last 2026-09-17T19:08Z (77.1h) · `03` last 2026-09-16T23:02Z (97.2h) ·
  `04` last 2026-09-17T18:11Z (78.1h) · `05` last 2026-09-17T14:11Z (82.1h).
- **[MEASURED]** scheduled-tasks MCP: **four** enabled tasks (`00` `5 * * * *`, `03` `0 9 * * *`,
  `04` `0 */4 * * *`, `05` `10 0 * * *`); `weekly-security-audit` still `enabled: false`,
  `lastRunAt 2026-09-06T21:32:44Z`. `00`/`04`/`05` all carry `lastRunAt` **2026-09-21T00:04:02Z**
  — this run's batch, within **0.7 seconds** of each other. `03` carries
  `lastRunAt 2026-09-16T23:01:15Z`, `nextRunAt 2026-09-21T23:00:45Z`.
- **[MEASURED]** Cowork session directories, dated by newest file write inside each:
  the last station session before today is `b6315fba` ("00 supervisor") at
  **2026-09-17T20:05:26Z**. The next three are `3634f2fa` (00), `1b702ce3` (04, this run) and
  `1714148a` (05), **all created 2026-09-21T00:04:02Z**. Session dirs created strictly inside
  the window 2026-09-17T20:05:26Z → 2026-09-21T00:04:00Z: **3**, and all three are that same
  00:04:02Z batch. **Zero station sessions exist for 76.0 hours.**
- **[MEASURED]** `(Get-CimInstance Win32_OperatingSystem).LastBootUpTime` →
  **2026-09-15T13:32:45Z**. The box did not reboot at any point in the gap.
- **[MEASURED]** watcher daily clone logs (name-shape filtered, then mtime):
  `2026-09-18.log` last body line `[2026-09-18T15:51:19+10:00] SINGLE-INSTANCE: watcher already
  running (PID 33388). Not starting another.` (= 2026-09-18T05:51:19Z);
  `2026-09-21.log` first body line `[2026-09-20T21:07:29.373Z] [watcher] stale lockfile
  (PID 33388 not found) - overwriting`, last body line `[2026-09-21T00:14:07.260Z] [review]
  verdict-archive sweep: archived=0 kept=0 skipped=0 tracked=114`. **No daily log exists for
  2026-09-19 or 2026-09-20.**
- **[MEASURED]** board state at the same minute: `origin/main` `875e1076`, authored
  2026-09-17T19:39Z; armed `*-ready.md` **0**; open PRs **1** (`#2017`, CI 13 pass / 2 fail,
  RED); last arm `2026-09-17T19:19:51Z`; watcher heartbeat age **4594 min** (76.6h).
- **[INFERRED]** from the pairing of "machine up continuously" + "watcher logging inside the gap"
  + "zero station sessions": the failure is in the **Cowork scheduled-task layer**, not the host,
  not power, not the watcher. **[CANNOT MEASURE]** the cause itself — that scheduler is the
  desktop app's and is outside the repo, CI and every instrument this station has.

---

## WHAT CHANGED

**Nothing on the board.** No PR opened, nothing armed, disarmed, renamed, moved or deleted;
no merge; no label touched; no `sot/` edit; no Azure / Entra / SharePoint contact.

Two writes, both outside the board:

1. `docs/pipeline/sweep-rotation.json` — advanced via
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-21T00:04:59Z`, exit 0,
   read back `last_index=1 last_run_utc=2026-09-21T00:04:59Z`, `git diff --numstat` = `2 2`.
   **LEFT DIRTY in the dev tree — Station 00 commits it.**
2. This breadcrumb, at the tracked path `docs/pr-prompts/`. **Untracked until a board PR
   commits it** — Station 00 sweeps it up.

Scratch probe scripts were written to `C:\po-sup-fix-scripts\` (the sanctioned scratch location)
and fixtures to `C:\po-sup-fix-scripts\fx-20260921`. Nothing in the repo working tree was touched
beyond the two items above.

---

## FINDINGS

### F1 — [S1] EVERY ENABLED STATION WAS DEAD FOR 76 HOURS, AND THE ONLY DETECTOR OF THAT IS THE STATIONS THEMSELVES

Between **2026-09-17T20:05:26Z** and **2026-09-21T00:04:02Z** — 76.0 hours — not one of the four
enabled scheduled tasks ran. Approximate missed runs: **00 ≈ 76** (hourly), **04 ≈ 19** (4-hourly),
**05 = 3** (daily), **03 = 4** (daily). The board froze in lockstep: `origin/main` has not moved
since 2026-09-17T19:39Z, nothing has been armed since 2026-09-17T19:19:51Z, and the single open PR
`#2017` has sat RED and untouched for the whole window.

**Two candidate causes are REFUTED by measurement, which is what makes this filable rather than a
shrug.** The host did not reboot (`LastBootUpTime` 2026-09-15T13:32:45Z, i.e. up throughout), and
the watcher was alive and writing inside the window (`2026-09-18.log` to 2026-09-18T05:51:19Z,
`2026-09-21.log` from 2026-09-20T21:07:29Z). So this was neither a power event nor a watcher death.
The surviving location is the **Cowork scheduled-task layer**, and its cause is
**[CANNOT MEASURE]** from any instrument a station has.

**This has happened before and it is getting worse.**
`needs-marco/all-stations-disabled-16h-and-the-only-detector-was-disabled-too-2026-09-03.md`
records the same shape at **16 hours**. This occurrence is **4.8×** longer. The mechanism that
makes it expensive is unchanged and is the whole point: *the detector is inside the thing that
failed*, so a 76-hour outage produces exactly the same artefact as a 76-hour quiet period —
**nothing** — and nobody is told. This run is the first to notice, three days late, and only
because `check-breadcrumb.mjs --freshness` happened to be run.

⚠️ **Do not read the recovery as a fix.** `00`, `04` and `05` resumed at 00:04:02Z and `03` has a
plausible `nextRunAt` of 2026-09-21T23:00:45Z, so the scheduler has re-armed itself with no
intervention — which means nothing has been diagnosed and the same 76 hours can recur tonight.

⚠️ **Related and now much more plausible:**
`needs-marco/weekly-security-audit-is-off-and-the-task-store-reverts-verified-writes-2026-09-14.md`.
A task store that silently reverts a verified write is a mechanism that would also silently stop
tasks firing. That file claims the off-switch question; this finding is evidence toward the same
store, and the two should be read together rather than merged.

**RULE 1, on the options — complete-and-additive first:**

1. **An out-of-band liveness detector that does not live inside the stations (passes both halves).**
   Anything that can observe "no station session in N hours" from outside Cowork — the watcher,
   which was demonstrably alive and logging throughout and already writes a daily log, is the
   natural host. Additive: it adds an observer, changes no station's behaviour, and touches no
   existing data. It is the only option that would have caught this one.
2. **Raise the alarm inside `check-breadcrumb.mjs --freshness`.** Fails "completely": the probe is
   only run *by a station*, so it is silent exactly when every station is silent — which is this
   incident. It is a real improvement to the report and not a fix.
3. **Do nothing; the scheduler recovered on its own.** Fails both halves. The cause is unknown,
   the recurrence interval is now 18 days and the duration has grown 4.8×.

**DISPOSITION: ESCALATED** — Marco. The scheduled-task layer is his (`STATION-CAPABILITIES.md`
§1: an agent cannot edit it), the cause is not measurable from inside a station, and option 1 is a
design decision about where a detector should live. The question for him is option 1 versus
option 3, not a status update.

### F2 — [S3] §9.5's citation-probe corpus is specified as "the five bootstraps + four binding docs", which is the formulation STATION-CAPABILITIES §1 forbids, and it undercounts both halves

DOCTRINE §9.5's 2026-09-15 correction states its falsifying probe over *"the same nine files (five
scheduled-task bootstraps + four binding docs)"* and gives a per-document prediction.

**The per-document prediction itself is sound and still holds — I re-ran it and every row passed:**
`03` → `.gitignore:76-83` (1) · `05` → `.gitignore:76-83`, `.gitignore:75` (2) · `CLAUDE.md` → 0 ·
`STATION-CAPABILITIES.md` → `.gitignore:28` (1) · `04-scanner.md` → `.gitignore:76-83` (1).
All resolve correctly (`:28` → `.claude/`, `:75` → `docs/pr-prompts/*-ready.md`,
`:76` → `docs/pr-prompts/processed/`, `:83` → `docs/pr-prompts/no-pr-opened/`).

**What is wrong is the corpus.** [MEASURED] this run:

- **Bootstraps: 11 `SKILL.md` on disk**, of which **4** sit behind enabled tasks. "Five" is wrong
  in both directions — and `STATION-CAPABILITIES.md` §1 already carries a red rule against exactly
  this phrasing (*"express every bootstrap sweep's corpus as every `SKILL.md` behind an ENABLED
  task in the scheduled-tasks MCP, never as 'the five'"*). §9.5's probe spec predates that rule and
  never got it.
- **Station docs: 7 on disk** (`00`–`06`), not four. And **`00-supervisor.md` carries two
  `.gitignore:<N>` citations** — `.gitignore:76-83` at line 153 and `.gitignore:75` at line 210 —
  that the per-document prediction does not list at all. Both resolve correctly today.

**Why this is worth writing down rather than fixing quietly.** The correction's own falsifying
logic reads *"if a NEW raw line citation ever appears in a station doc, this clause is being
ignored rather than being wrong."* A run that rebuilds the probe over the station docs finds two
unlisted citations in `00-supervisor.md` and has exactly that sentence to hand — so it concludes
the clause is being ignored and re-opens closed work, when the citations are pre-existing, correct,
and were simply never enumerated. That is the same shape §9.5's `ANCHOR_PROBE_PER_DOCUMENT_V1`
correction was written to remove, one document short of complete.

**Falsifying probe:** run the dotfile-tolerant form
`(^|[\s(`"'])(\.?[A-Za-z0-9_.\-/]+):(\d+(?:-\d+)?)\b` over all **7** station docs plus
`DOCTRINE.md`, `STATION-CAPABILITIES.md`, `CLAUDE.md` and every `SKILL.md` behind an **enabled**
task. If `00-supervisor.md` returns 0 `.gitignore` citations, this finding is wrong.

**DISPOSITION: DISPATCHED** → Station 00. It is a two-line edit to §9.5's probe spec (widen the
corpus to the enabled-task rule and all seven station docs; add `00-supervisor.md`'s two citations
to the per-document prediction). It is inside a hash-gated canonical block, so it needs the block
hash re-recorded and all seven station docs shipped together — which is 00's lane, not 04's.

### F3 — [S3] §9.5's clone-dirty false warning reproduced, but from an artefact the bullet does not name — a reader checking for review verdicts finds none and may believe the warning

`status-sweep.ps1` printed `[LIVE] watcher clone: branch=main dirty=1 <-- NOT clean-on-main; the
watcher may refuse to start`. [MEASURED] both forms against the clone in the same minute:
`git status --short` → **1**, `git status --porcelain --untracked-files=no` → **0**. The warning
is false, exactly as §9.5 records.

**What is new is the file.** The single untracked entry is
`?? scripts/pr-watcher/.conflict-notified-prs.json` — the watcher's own state file. §9.5's bullet
attributes this recurrence to review verdicts (*"review verdicts the `rev-<N>` job writes into the
clone by design … this false warning recurs on every reviewed PR whose verdict has not yet been
mirrored"*), and there are **zero** untracked review verdicts in the clone right now. So a reader
who follows the bullet, looks for `docs/pr-reviews/pr-*.md`, finds none, and concludes *"the
documented benign cause is absent, so this dirty=1 is real"* reaches the wrong verdict — and the
bullet's own mis-routed-dispatch cost (13 verbatim quotations in `archive/`) is what follows.

**The rule survives unchanged** — read the clone's health from
`git status --porcelain --untracked-files=no` — and the class simply needs widening from "review
verdicts" to "any by-design untracked artefact the watcher writes into its own clone".

**Falsifying probe:** run both forms against the clone in the same minute while the only untracked
file is *not* a review verdict. If they ever agree, this finding is wrong.

**DISPOSITION: DISPATCHED** → Station 00, to fold one clause into §9.5's existing bullet. The
permanent fix (scoping the sweep's `dirty=` to tracked files) is a `scripts/` change and therefore
outside both 04's and 00's merge lane; it is already named in §9.5 as unscoped and is not re-filed
here.

### F4 — [S4] Two §9 counts have drifted materially since they were last recorded; both are STATE and are reported as such

- **§9.6 negative-control contamination is worsening monotonically, as its own bullet predicts.**
  The two written-down needles returned **40** and **36** when measured 2026-09-05 over
  `docs/pr-prompts/**`. [MEASURED] this run over the same corpus: **60** and **43**. The fresh
  needle minted for this run returned **0** across every corpus probed, then became spendable the
  moment this file lands — which is the rule working, not an oversight.
- **§9.2's `git branch -r` gap is the widest yet recorded.** 2026-08-29: 54 vs 21. 2026-09-03:
  12 vs 7. [MEASURED] this run: **68** vs **15** — the local tracking cache is now **4.5×** the
  truth, and `git ls-remote --heads origin` remains the only sound instrument.

Neither is a defect in §9; both are the documented behaviour, louder. They are recorded so the
next run re-measures rather than quoting the older figures.

**DISPOSITION: DEFERRED** — no action is correct today. The branch-cache figure becomes urgent if
any run is caught cross-referencing `git branch -r` against the GitHub API; the needle figure
becomes urgent if a run reports a negative control it did not mint itself.

### F5 — [S3] `.gitignore:107-111` in the five bootstraps is STILL WRONG, 15 days after it was escalated

[MEASURED] this run: `.gitignore` lines 107–111 are `!Claude Design/docs/`,
`!Claude Design/assets/`, `Claude Design/assets/*`, `!Claude Design/assets/routes.js`,
`!Claude Design/proposed/`. The five overnight-QA sinks are at **115–119**, under the
`# Overnight-QA scheduled task` comment at line **113**. Off by **+8**, unchanged.
The citation is carried by all five bootstraps under `C:\Users\Marco\Claude\Scheduled\`
(`00-supervisor`, `02-board-driver`, `03-machine-minder`, `04-scanner`, `05-sot-keeper`) —
**including the file that launched this run**. The repo-side copies are correct: they cite the
`# Overnight-QA scheduled task` comment by anchor, not by number.

**Already on file** as `needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md`
ITEM 1, and re-measured as still live by Station 00 on 09-07, 09-10 and 09-15. **Not re-filed** —
this is a fifth re-confirmation that the escalation is current at `875e1076`, recorded here only
so the next run does not spend a probe rediscovering it.

**DISPOSITION: ESCALATED** — Marco, on the existing file. Five one-line pastes, no new question.

---

## WHAT I DID NOT DO

- **Did not arm, disarm, rename, move or delete any prompt.** The board had 0 armed and 1 open PR
  throughout. 04 arms nothing.
- **Did not stage a `-HOLD` prompt.** I am permitted up to two. None of F1–F5 is a candidate:
  F1 is a design escalation only Marco can answer; F2 and F3 are edits to a hash-gated canonical
  block, which is 00's lane and would require shipping all seven station docs together; F4 is
  state; F5 is a paste into a layer no agent may write.
- **Did not commit `docs/pipeline/sweep-rotation.json`.** Left dirty by instruction — 00 commits it.
- **Did not open a PR.** 04's authority row is *Create a PR: NO*, and the dev tree is on `main`.
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site patrol).** The station doc
  requires ONE named sweep covered completely and forbids a shallow pass over everything; F1
  consumed the remaining budget and is worth more than a partial second pass. Part 0's rotating
  sub-checks (a)–(f) were likewise not run this cycle.
- **Did not touch Azure, Entra or SharePoint.** Absolute, and nothing this run needed them.
- **Did not clear, prune or investigate the orphaned worktree** `C:/PR-Master/worktrees/po-vg`
  (dirty=1, age 24013 min) or the registry escapee `C:\po-worktrees\po-fix-2005` that
  `status-sweep.ps1` reported. Both are Station 03's lane, and the sweep already names them.
- **Did not restart, kill or probe the liveness of the watcher** beyond quoting its own log lines.
  A station may quote a timestamped line the watcher wrote; it may not issue a verdict about the
  watcher. That is 03's, via `restart-watcher-if-wedged.ps1`.
- **Did not write to any of the five gitignored `docs/qa/` sinks.**

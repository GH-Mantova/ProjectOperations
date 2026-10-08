# Station 05 — SoT Keeper | 2026-10-08T22:38Z–2026-10-08T22:55Z

## GROUND

```
UTC            2026-10-08T22:38:27Z
origin/main    375f4386            (git fetch origin, then git rev-parse origin/main)
dev tree       main @ 375f4386      C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/05-sot-keeper.md front matter, read from origin/main)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE — this run was not read-only.

Missed occurrences owed: **fourteen.** 05's last breadcrumb on `origin/main` is
`2026-09-24T14:23Z`; this run is `2026-10-08T22:38Z`, **344.3 h** later against a 24 h cadence.
This run therefore carries today's work; the fourteen days of keeping in between are
unrecoverable, and the reason is F1 below, not anything inside this station's control.

Read in full from `git show origin/main:<path>` (never the working copy):
`docs/pipeline/stations/05-sot-keeper.md`, `docs/pipeline/DOCTRINE.md` (core),
`docs/pipeline/STATION-CAPABILITIES.md`.

## WHAT I MEASURED

**Reachability — sighted run.** [MEASURED] `ToolSearch` keyword `desktop-commander` loaded the
schemas; `start_process` shell `powershell.exe` returned `2026-10-09T08:38:27.1862513+10:00`.
Not blind. No retry needed — no `CONNECT_TIMEOUT`.

**vm-git-guard.** [MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`
→ exit **2**, headline `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from
your shell.` Last line:
`   PATH="/sessions/brave-practical-ptolemy/.local/bin:$PATH" git <args>`
This is the EXPECTED station outcome per the contract's three-outcome table — a finding, not a stop.
No `git` was run through the device bridge against the mount this run; every `git` call went through
a PowerShell shell on the Windows host.

**Dev tree integrity — all four readings.** [MEASURED]
`git rev-list --left-right --count HEAD...origin/main` → `0  0`;
`git diff --cached --name-status` → EMPTY;
`git diff --numstat` → two entries only;
`git status --porcelain --untracked-files=no` →
` M docs/pr-prompts/.arming-log.txt` and ` D docs/pr-prompts/pr-gitpush-worktree-mandatory-HOLD.md`.
Both pre-date this run (present in the opening probe before anything was touched). No
`.git/index.lock` present. See F5.

**Station silence.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit 2,
`MISSED: 4 station(s) past cadence + grace`:

| station | last breadcrumb | age | cadence |
|---|---|---|---|
| 00 | 2026-10-07T05:14:00Z | 41.4 h | 1 h + 0.5 grace |
| 03 | 2026-10-06T23:03:00Z | 47.6 h | 24 h + 3 grace |
| 04 | 2026-10-07T02:10:00Z | 44.5 h | 4 h + 1 grace |
| 05 | 2026-09-24T14:23:00Z | **344.3 h** | 24 h + 3 grace |

[MEASURED] §9.6 control — the corpus is not empty and the glob is not broken: the same
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` that yields 05's last entry at
`2026-09-24-1423` returns **25** `00-05-` breadcrumbs, and a disk sweep
(`Get-ChildItem -Recurse -Filter '00-05-*.md'`) returns the same 25 with the same newest name.
So there is no untracked or unmerged 05 breadcrumb after 09-24 — the silence is real, not a
filtered read.

**Scheduler.** [MEASURED] scheduled-tasks MCP, this run: four tasks ENABLED
(`00-supervisor` `5 * * * *`, `03-machine-minder` `0 9 * * *`, `04-scanner` `0 */4 * * *`,
`05-sot-keeper` `10 0 * * *`), `weekly-security-audit` `enabled: false` (unchanged since 09-15).
`lastRunAt`: 00 `2026-10-08T22:38:06.925Z`, 04 `2026-10-08T22:38:07.297Z`,
05 `2026-10-08T22:38:07.635Z` — **three stations inside 710 ms**, and none of the three at its own
cron slot (05's next is `2026-10-09T14:22:37Z`). 03 did not fire in the batch
(`lastRunAt 2026-10-06T23:02:55.018Z`, `nextRunAt 2026-10-08T23:02:45Z`).

**Heartbeat (Rule Zero — the CI conclusion, then the job log).** [MEASURED]
`gh run list --branch main` → `Pipeline heartbeat` **failure** at 2026-10-07T18:44Z,
2026-10-08T00:52Z, 2026-10-08T10:17Z and 2026-10-08T18:42Z; last success 2026-10-07T10:03Z.
`gh run view 37826381004 --log`, verbatim:

```
[heartbeat] SILENT: NO station has reported for 37.5h (threshold 6h). Newest is station 00 at
2026-10-07T05:14:00Z. Either the scheduler is off, the machine is down, or the app is not running.
If this was deliberate, declare it in docs/pipeline/pause.json.
##[error]Process completed with exit code 1.
```

Four alarms, correct every time, read by nobody. Not diagnosed from the diff or from silence.

**Audit 1 — generator sanity.** [MEASURED] `node scripts/data-model/build-relationship-map.mjs --check`
→ `OK: generator ran cleanly against schema.prisma (299 models, 70 enums, 501 edges)`, exit 0.
Per the step's own 2026-08-25 correction this is a PARSE gate, not a drift gate, and is not quoted
here as evidence that sot/04 is current.

**Audit 2 — catalog validity.** [MEASURED]
`node -e "JSON.parse(fs.readFileSync('docs/data-model/metadata-catalog.json','utf8'))"` →
`OK json, bytes=735739, topkeys=4`, exit 0. Valid. Not the four-sweep invalid state.

**Audit 3 — sot/04 drift, BOTH probes.** Header counts [MEASURED]: sot/04 read
`- Models: 297 | Enums: 70 | FK edges: 498 | Domains: 23`, fresh map read
`- Models: 299 | Enums: 70 | FK edges: 501 | Domains: 23` — **model-level drift, visible in the
cheap probe this time.** Content comparison of the generated section [MEASURED]: not identical.
Schema sha256 moved `765369a06fc8` → `6021e2814195`. Resolved in WHAT CHANGED.

**Audit 4 — roadmap.** [MEASURED] `gh pr list --state open` → **1** open PR: **#2261**
`fix(pipeline): make Invoke-GitPush -WorkTree mandatory` on `fix/gitpush-worktree-mandatory-v1`,
`mergeStateStatus BEHIND`, label `do-not-merge`. sot/02 §2 reads `In-PR - open right now (0)`.
See F7.

**Audit 5 — automation health.** [MEASURED] watcher resolved by COMMAND LINE, never image name:
`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` filtered on `pr-watcher[\\/]index\.mjs`
→ exactly one match, **PID 8848**, `CommandLine "C:\Program Files\nodejs\node.exe"
--no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs`, `CreationDate
8/10/2026 7:28:42 AM`. 17 `node.exe` processes present in total — which is why the filter matters.
The watcher is ALIVE. Newest `docs/pr-prompts/processed/` entry: `rev-2264-ready.md.log`,
`LastWriteTimeUtc 7/10/2026 5:34:35 AM`. [CANNOT MEASURE] no liveness VERDICT is claimed here —
`restart-watcher-if-wedged.ps1` and `status-sweep.ps1` were not run this run; the PID and command
line are quoted facts, not a safe-to-act verdict.

**Audit 6 — model ↔ migration ↔ code coherence.** [MEASURED] both newly surfaced models have
backing migrations: `scope_item_enclosure_lines` in `20261003120000_asb_enclosure_lines`
(CREATE TABLE + FK to `scope_of_works_items` + index), `user_appearance_preferences` in
`20261003024444_brandtheme_s7c_appearance_preferences` (CREATE TABLE + FK to `users` + FK to
`brand_color_scheme`). Full scan: 299 models against 272 migration directories, **0 models with no
migration mention** (matched by `@@map` table name).

**Audit 7 — module registry.** [MEASURED] the registry EXISTS: `sot/01-charter-and-architecture.md`
L731 `## SECTION 13 - MODULE REGISTRY`, referenced at L34, L734 and L1382. The 2026-09-17
breadcrumb's "audit step 7 reads a registry that does not exist" no longer holds at `375f4386` —
recorded here so the next run does not re-file it.

**sot-refs burn-down — the obligation is discharged.** [MEASURED]
`docs/qa/sot-refs-baseline.json` → `entries: 0`.
`node scripts/pipeline/check-sot-refs.mjs` → exit 0,
`total=275  dangling=0  exempt=20  baselined=0  excluded=2`,
`All sot/ references resolve. This is the boring, correct outcome.`
Nothing to burn down; nothing added. See F8.

**Encoding.** [MEASURED] `node scripts/pipeline/check-sot-bytes.mjs` in the PR worktree after the
edit → `verdict: CLEAN UTF-8 on disk` for every sot/ file, `BOM=false U+FFFD=0 mojibake=0`,
em-dash and arrow counts equal tree vs main, exit 0.

**Rule Zero — environment agreement, not disagreement.** [MEASURED] local `--check` exit 0 AND the
real CI check-run `Data model — generator sanity (schema.prisma parses cleanly)` reads **pass** on
#2261; main's last full `CI` run at `375f4386` (2026-10-07T05:35:11Z) reads **success**. No local
PASS / CI FAIL split on the data-model gate this run. The only red on main is `Pipeline heartbeat`,
and its job log (above) shows it is reporting a true fact about the machine, not a broken gate.

**My own probe lied, and `git diff` caught it.** [MEASURED] the re-merge script's content-diff
reported `models ADDED: []`, `models REMOVED: []` and `Fields: count drift: 0` while
`git diff -U0` on the applied result showed two added `### Model:` sections and five changed
`Fields:` lines. Cause: the regex keyed on `^### (\w+)` but the generator emits
`### Model: <Name>`, so the capture never matched and the comparison silently measured nothing —
exit 0, well-formed output, nothing empty, so §9.6 never fired. The station doc calls the content
comparison "the probe that answers"; this run's evidence is that it answers only if its anchor is
the real heading. See F4.

## WHAT CHANGED

**Unit of work 1 — 2026-10-08 (today's run): sot/04 generated-section re-merge.** One doc-reconcile
PR opened from a disposable worktree `C:\po-worktrees\st05-sot-2026-10-09` off `origin/main`,
branch `docs/sot-reconcile-2026-10-09`.

`sot/04-data-model.md`: **37 insertions / 16 deletions** (`git diff --numstat`), 292,473 → 293,691
bytes. Section-scoped between `<!-- SOT04-GENERATED:BEGIN -->` and
`<!-- SOT04-GENERATED:END -->`, plus the three generated header stamps above the BEGIN marker.

What the drift actually was:

- **+2 models** — `ScopeItemEnclosureLine` (Estimating, `scope_item_enclosure_lines`, 11 fields) and
  `UserAppearancePreference` (Platform, `user_appearance_preferences`, 6 fields).
- **+3 FK edges** (498 → 501) — `ScopeItemEnclosureLine.scopeItem → ScopeOfWorksItem`,
  `UserAppearancePreference.user → User`, `UserAppearancePreference.colourScheme → BrandColorScheme`.
- **Domain counts** — Estimating 17 → 18, Platform 25 → 26.
- **Five field-count changes the header counts are structurally blind to** — `users` 187 → 188,
  `scope_of_works_items` 77 → 78, `brand_color_scheme` 20 → 21, `comm_threads` 12 → 13, and
  `form_rules` **10 → 5**. The `form_rules` figure is a DROP and is schema reality, not content
  loss in sot/04: it is the FormRule legacy-payload retirement. Recorded explicitly so the next
  reader does not read a shrinking field count as a bad merge.
- Header stamps — `Last updated` 2026-09-23 14:28 UTC → 2026-10-08 22:42 UTC,
  `Generated from` sha256 `765369a06fc8` → `6021e2814195`, counts 297/70/498/23 → 299/70/501/23.

Safeguards, every one verified before the write (the script aborts without writing if any fails):

| # | safeguard | reading |
|---|---|---|
| S1 | never main, never merge; PR from a disposable worktree off `origin/main` | branch `docs/sot-reconcile-2026-10-09` at `375f4386`; nothing committed in the dev tree |
| S2 | generator run TWICE, byte-identical modulo the stamp | run1 169,581 = run2 169,581 after stripping `- Last updated:`, `IDENTICAL(mod stamp): true` |
| S3 | curated region byte-identical | END-marker→EOF sha256-16 `d5f505615d88a806` before **and** after, `IDENTICAL: true`; curated prose above BEGIN (stamps excluded) `0cb0e61216cd82a2` both sides |
| S4 | curated line count must not decrease | 1596 → 1596 |
| S5 | scope cap | the PR touches `sot/04-data-model.md` + this one breadcrumb. Nothing else. |
| S6 | post-fix validation | `--check` in the worktree → `OK ... (299 models, 70 enums, 501 edges)`, exit 0; `check-sot-refs.mjs` exit 0 `dangling=0`; `check-sot-bytes.mjs` CLEAN UTF-8 |
| S7 | one-and-done | `gh pr list --state open` → no sot/reconcile PR; `git ls-remote --heads origin` → no `sot`-matching branch. Nothing pending. |

Line endings held: CRLF 5327 → 5348, **lone LF = 0**, U+FFFD = 0. Written with a raw
`fs.writeFileSync(path, Buffer)` — not `Set-Content`, not `Out-File` (DOCTRINE §9.3). Readback
after the write: identical, 293,691 bytes.

CP-24: the PR is `sot/` + `docs/` only — no `apps/`, `scripts/`, `.github/`, `packages/`,
`package.json`, `pnpm-lock.yaml`. Checked against the gate's own `codeRe`, not against prose.

**Unit of work 2 — collateral I made and then undid.** The generator also rewrites **tracked**
`docs/data-model/metadata-catalog.json`, which the station doc's auto-fix allowlist does not name.
Running it in the dev tree put ` M docs/data-model/metadata-catalog.json` on a tracked path.
Restored byte-exactly, and proved so:

- Content first (DOCTRINE §9.3 — compare CONTENT, never SIZE): HEAD blob 706,490 B vs regenerated
  706,490 B, delta 0, `Buffer.compare` after CRLF normalisation = **0**, 299 models both sides,
  **0 added, 0 removed**, 4 top-level keys both sides. The regeneration changed nothing.
- Restore via `fs.writeFileSync(abs, <HEAD blob, LF→CRLF to match the smudge filter>)` — never
  `git checkout -- <path>`, never `git clean` (DOCTRINE §9.2). First attempt wrote the raw LF blob:
  `--numstat` went empty but `--porcelain` still read ` M` with git warning `LF will be replaced by
  CRLF`. The CRLF form is what git expects on this host.
- Readback, all four: `rev-list --left-right` `0 0`; `--numstat` → the two pre-existing queue
  entries only; `--cached` EMPTY; `--porcelain --untracked-files=no` → the same two entries only.
  Plus `git hash-object docs/data-model/metadata-catalog.json` = `69214e6625fd753a9963c7a1c8d9ddaaff89c248`
  = `git rev-parse origin/main:docs/data-model/metadata-catalog.json`. Identical.

Nothing else in `sot/` was edited. No prompt was armed. No PR was merged. No label was touched.

## FINDINGS

### F1 — The whole pipeline was dark for ~37 h, and the only thing that noticed was a CI gate nobody was awake to read

[MEASURED] All four enabled stations are past cadence + grace: 00 at 41.4 h against an **hourly**
cron, 04 at 44.5 h, 03 at 47.6 h, 05 at 344.3 h. The newest breadcrumb of any station is
`00` at 2026-10-07T05:14Z; the newest `processed/` entry is 2026-10-07T05:34Z. `Pipeline heartbeat`
on main went red at 2026-10-07T18:44Z and stayed red for four consecutive runs, each one printing
the correct diagnosis.

[INFERRED] the cause is that the Claude desktop app / scheduler host was not running: 00, 04 and 05
all fired within **710 ms** of each other at 2026-10-08T22:38:0xZ, none at its own cron slot, which
is the signature of a scheduler firing overdue tasks on startup rather than of three independent
crons colliding. The watcher process itself never died (PID 8848 alive), so this is not a watcher
incident — the watcher kept running while nothing was arming or reporting.

This is the third recorded instance of the same shape — the 2026-09-21 05 breadcrumb is titled
*"the heartbeat alarmed twelve times through a seventy-seven hour silence and nothing was awake to
read it"*. The detector works. The escalation channel out of it does not exist: a red CI gate on
`main` is read by the next station run, and the thing it is reporting is that there is no next
station run.

**RULE 1 options for Marco** (complete-and-additive first):

1. **Make the alarm leave the machine.** Add a notification step to the heartbeat workflow that
   fires on `failure` to a channel Marco actually reads (Outlook via the existing M365 path, or a
   GitHub issue auto-opened and auto-closed on recovery). *Complete:* catches every future
   occurrence regardless of cause, including the ones nobody has thought of. *Additive:* adds a
   step to an existing workflow; no station behaviour, no queue, no data touched. Passes both
   halves of RULE 1.
2. Keep the scheduler host up / auto-start the desktop app on login. *Fails the "future" half* on
   its own — it reduces one cause of silence and reports nothing when silence happens anyway.
3. Declare planned downtime in `docs/pipeline/pause.json`, which the heartbeat already honours.
   *Fails the "immediately" half* — it silences the alarm rather than delivering it, and it only
   helps for downtime that was intended. This one was not.

Option 1 is additive to option 2, not an alternative to it.

**DISPOSITION: ESCALATED** — the fix is a workflow notification target and a host-uptime decision.
Both are Marco's: the notification needs a real destination identity, and the scheduled-tasks /
desktop-app layer is not in this repo.

### F2 — Station 05 specifically lost fourteen consecutive occurrences, and the catch-up rule cannot pay that back

[MEASURED] last 05 breadcrumb `2026-09-24T14:23Z`, this run `2026-10-08T22:38Z` = 344.3 h = **14
missed daily occurrences**, with the §9.6 control above proving the corpus and glob are sound.
The station doc's CATCH UP section is written for **one** owed day ("nothing stops a catch-up taking
two"); it has no shape for fourteen, and the keeping that was owed on those days — fourteen daily
sot/ sweeps — cannot be reconstructed after the fact. What this run recovered is the CURRENT state
of the drift (F3), which is all that is recoverable.

Note the interaction that makes 05 the worst-hit station: 05's cadence is the longest (24 h) and its
cron slot is a single fixed minute, so every hour the host is down costs 05 proportionally more than
it costs hourly 00 — and 05 is the only station that may edit `sot/`, so its outage is the only one
that stops source-of-truth from being maintained at all.

**DISPOSITION: ESCALATED** — same root cause as F1 and not separately fixable; raised separately
because the cost profile differs by station and that bears on where Marco spends the fix.

### F3 — sot/04's generated section was two models and three FK edges behind, and five field changes behind that the header counts cannot see

[MEASURED] header 297/70/498/23 vs fresh 299/70/501/23; content comparison not identical; schema
sha256 `765369a06fc8` → `6021e2814195`. Both missing models landed on main around 2026-10-03
(`20261003024444_brandtheme_s7c_appearance_preferences`, `20261003120000_asb_enclosure_lines`), i.e.
during the silence window the earlier 05 outage opened. The five `Fields:` changes are exactly the
class the 2026-09-14 correction documents as invisible to the four header counts.

**DISPOSITION: ACTIONED** — re-merged in this PR. Verified by: `--numstat` 37/16; S3 curated-region
sha256 identical both sides; S4 curated line count 1596 → 1596; `--check` exit 0 at 299/70/501;
`check-sot-refs` exit 0 `dangling=0`; `check-sot-bytes` CLEAN UTF-8; lone LF 0; U+FFFD 0; readback
identical.

### F4 — The prescribed "probe that answers" answered nothing, with exit 0 and well-formed output

[MEASURED] this run's content-comparison probe printed `models ADDED: []`, `models REMOVED: []`,
`Fields: count drift: 0` on a section that `git diff -U0` shows gained two `### Model:` blocks and
changed five `Fields:` lines. The regex anchored on `^### (\w+)`; the generator emits
`### Model: <Name>`. Nothing was empty, nothing errored, so DOCTRINE §9.6 did not fire — a §7
instrument lie in the probe the station doc nominates as the cure for the header counts' blindness.

The general lesson is not "my regex was wrong". It is that the station doc prescribes the content
comparison in PROSE ("slice sot/04 between the markers, slice relationship-map.md from its
`## Table of Contents` heading, normalise line endings, and compare") and leaves each run to
re-implement it. A hand-rolled implementation per run is a fresh opportunity for this exact
failure, every run, and it fails silently.

**Falsifying probe:** apply the re-merge, then read `git diff --numstat -- sot/04-data-model.md` and
`git diff -U0 -- sot/04-data-model.md | Select-String '^[+-]### '`. If those ever disagree with the
hand-rolled comparison again, the hand-rolled one is wrong.

**DISPOSITION: ACTIONED** — the correct method is recorded above and used for every drift figure in
this breadcrumb: the string comparison answers the binary "identical or not"; **`git diff` on the
applied result is what names WHAT changed.** The durable fix (a checked-in
`check-sot04-current.mjs` so no run hand-rolls it again) is F6's sibling and is out of this run's
S5 scope cap — named for Station 06 below.

### F5 — Two tracked paths left dirty in the dev tree will refuse the next fast-forward

[MEASURED] `git status --porcelain --untracked-files=no` in `C:\ProjectOperations2`:
` M docs/pr-prompts/.arming-log.txt`, ` D docs/pr-prompts/pr-gitpush-worktree-mandatory-HOLD.md`.
Both were present before this run touched anything. `git diff --numstat` reads
`1 0 .arming-log.txt` and `0 148 pr-gitpush-worktree-mandatory-HOLD.md`.

The deleted path is the consumed prompt behind open PR **#2261**, so once a PR lands that touches
either path, `git merge --ff-only` in the dev tree refuses — and the station doc records that
`--numstat` and `--cached` both reading EMPTY is the documented PASS reading, which is precisely why
this shape is missed. Right now `HEAD == origin/main`, so nothing is blocked yet; it blocks the next
time main moves.

I did not touch either path: resurrecting a consumed prompt is a hard stop (DOCTRINE §9.2) and the
queue is not Station 05's lane.

**DISPOSITION: DISPATCHED** → Station 00. The cure is the station doc's own: restore each blocking
tracked path byte-exactly from `HEAD` with a raw-Buffer node write, then `git update-index
--refresh`, then read back all four. Never `git checkout -- <path>`, never `git clean`. Whether
`pr-gitpush-worktree-mandatory-HOLD.md` should be restored or retired-by-move depends on #2261's
outcome, which is 00's call, not mine.

### F6 — The auto-fix allowlist does not name the one tracked file the generator rewrites

[MEASURED] the allowlist says "re-running the generator to refresh
`docs/data-model/relationship-map.{json,md}` + graph html". Those three are gitignored
(`.gitignore:135-137`). The generator also writes `docs/data-model/metadata-catalog.json`, which is
**tracked** — `git hash-object` on it resolves to a real blob on `origin/main`
(`69214e6625fd753a9963c7a1c8d9ddaaff89c248`). So a run that follows the allowlist literally, in the
dev tree, dirties a tracked path it was never warned about, and lands straight in F5's shape.

The station doc's 2026-09-21 correction discusses this file at length — the CRLF byte-count shrink
and "never judge this file by its byte count" — but it discusses it as a thing to *not panic about*,
never as a thing the allowlist omits. Confirmed this run: the regeneration is content-neutral
(`Buffer.compare` = 0 after normalisation, 0 models added or removed), so the right handling is
restore-and-move-on, which is what I did.

**DISPOSITION: DEFERRED** — the fix is one paragraph in
`docs/pipeline/stations/05-sot-keeper.md`, and safeguard **S5** caps this run to `sot/` and
`docs/data-model/` generated artifacts plus one prompt. Editing the station doc inside a
doc-reconcile PR would break my own scope cap. It becomes urgent the first time a 05 run regenerates
in the dev tree and leaves the catalog dirty through a main advance — which is a fast-forward freeze
for every station. Paired with F4's durable fix, this is one small docs PR:
*(a)* name `metadata-catalog.json` in the allowlist with the restore recipe, *(b)* add a
`check-sot04-current.mjs` so the content comparison stops being hand-rolled.

### F7 — sot/02 says zero open PRs; there is one

[MEASURED] `sot/02-roadmap-and-status.md` L61 `## 2. ?? In-PR - open right now (0)` against
`gh pr list --state open` → 1 (#2261, `do-not-merge`, BEHIND). #2261 is a pipeline-instrument fix,
not product work, so a curated product roadmap arguably excludes it by design — the document does
not say which, and that ambiguity is the whole finding.

Roadmap STATUS semantics are explicitly **never auto-fixed** by this station (report only), and this
has been filed repeatedly — the 2026-09-05 05 breadcrumb is titled *"ten breadcrumbs have filed the
same roadmap finding"*. Filing it an eleventh time at the same confidence would be noise.

**DISPOSITION: DEFERRED** — it needs a one-line ruling from Marco that no station can supply:
does §2 of sot/02 count pipeline/instrument PRs, or product PRs only? With that answer the check
becomes mechanical and stops recurring. Without it, every 05 run re-derives the same ambiguity.
Not urgent: the drift is one stale count in a curated section, and it misleads nobody about code.

### F8 — The station's stated "primary housekeeping obligation" has been fully discharged for over two weeks

[MEASURED] `docs/qa/sot-refs-baseline.json` → `entries: 0`; `check-sot-refs.mjs` → exit 0,
`total=275 dangling=0 exempt=20 baselined=0 excluded=2`. The 2026-09-22 05 breadcrumb already
recorded the baseline as fully burned down, so this has been true across the whole silence window.

The station doc still heads that section "**your primary housekeeping obligation**" and gives a
six-step one-entry-at-a-time workflow that is now a guaranteed no-op. That is harmless today and
mildly costly every run: it points the station's stated priority at finished work, and a run short
on turns spends them re-proving `entries: 0` instead of on Audit 3, which is where the real drift
was this run and on 09-14, 09-21, 09-22 and 09-24.

The CI ratchet must stay exactly as it is — it is what keeps the list at zero, and "never add an
entry" remains binding.

**DISPOSITION: DEFERRED** — a wording change in the station doc, same S5 scope-cap reason as F6,
and it belongs in the same small docs PR: demote the burn-down to "verify `entries: 0`; if non-zero,
burn down one entry", and name **Audit 3's content comparison** as the primary obligation, since
that is the probe that has actually caught drift five runs out of five.

## WHAT I DID NOT DO

- **Did not arm anything, did not merge anything, did not touch a label.** 05 never arms and never
  merges. #2261 carries `do-not-merge`; only Marco removes that, and the PR is BEHIND regardless.
- **Did not clear the two dirty dev-tree paths** (F5). Not my lane, and restoring a deleted consumed
  prompt risks resurrecting an armed prompt — a hard stop. Dispatched to 00 with the recipe.
- **Did not edit `docs/pipeline/stations/05-sot-keeper.md`** to fix F4, F6 or F8, though all three
  are real and all three are one small docs PR. Safeguard S5 caps this run to `sot/` +
  `docs/data-model/` generated artifacts + one prompt, and a station doc edit riding inside a
  doc-reconcile PR breaks that cap. Named for Station 06 / 00.
- **Did not run `status-sweep.ps1`, `restart-watcher-if-wedged.ps1` or `smoke-pr.ps1`**, so this
  breadcrumb claims **no** liveness, safe-to-act, smoke or merge verdict. The watcher PID and
  command line are quoted measurements, nothing more.
- **Did not touch Azure, Entra or SharePoint**, in any form, read-modify-write included.
- **Did not touch production data**, schema.prisma, migrations, seeds, application code or the
  permission registry. The two new models were read, never altered.
- **Did not auto-fix curated prose** in sot/01, 02, 03, 05 or 06, or roadmap status semantics, or
  catalog business meaning — report-only by the allowlist, and F7 is filed accordingly.
- **Did not run `git` through the device bridge against the mount**, with the guard reporting INERT
  (exit 2). Every `git` call this run went through a PowerShell shell on the Windows host.
- **Did not write this report into `docs/qa/qa-findings.md`** or any of the five gitignored sinks
  listed under the `# Overnight-QA scheduled task` comment in `.gitignore`, and did not leave it in
  the Cowork session's `outputs` folder. It is at a tracked path **inside this run's own PR**, which
  is the station doc's preferred of the two correct homes — so it needs no sweep-up by Station 00
  and cannot block a fast-forward in the dev tree.

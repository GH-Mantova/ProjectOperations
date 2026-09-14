# Station 04 — Scanner | 2026-09-14T10:10Z–2026-09-14T10:48Z

Sweep this run: **instruction-drift** (rotation position 4 of 4, chosen by
`node scripts/pipeline/next-sweep.mjs`, not by me).

## GROUND

```
UTC            2026-09-14T10:10:03Z
origin/main    7d0fb636               (git fetch origin --prune, then rev-parse --short origin/main)
dev tree       main @ 7d0fb636        C:\ProjectOperations2
doc version    1                      docs/pipeline/stations/04-scanner.md
bootstrap      1                      C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md
```

Doc version and bootstrap AGREE — this run was not read-only on that account.
Tree read in: the **dev tree**. `git diff --numstat origin/main --` over the three binding
documents returned EMPTY, so the working copies I read are byte-identical to `origin/main`.

## WHAT I MEASURED

- [MEASURED] Sighted. `start_process` shell `powershell.exe` → `LAPTOP-E6NHU4E4`,
  `2026-09-14T20:10:17+10:00`. Desktop Commander tools were loaded by keyword `ToolSearch` first;
  no id was assumed.
- [CANNOT MEASURE] The device-bridge git guard (`scripts/pipeline/vm-git-guard.sh`) could not be
  installed: the VM workspace failed to mount
  (`source path … is under Plan9 share "c" which is not mounted`). This is 04's own F4 from the
  06:10Z run, unchanged. No `git` was run through the bridge this run, so the hazard the guard
  covers was not present.
- [MEASURED] `status-sweep.ps1` captured to a file and decoded (`FF FE` → utf16le, 143,344 B,
  856 lines). Section 7: **SAFE TO ACT**. Open PRs 2 (`#1923` CLEAN green, `#1920` BLOCKED 3 red).
  `armed (*-ready.md): 0`. Watcher node RUNNING pid 30976. main CI on `7d0fb636` 4 success / 0
  failed (trunk green).
- [MEASURED] Live schedule, from the scheduled-tasks MCP (never from a folder listing):
  `00` `5 * * * *` enabled, lastRun `10:08:24Z` · `03` `0 9 * * *` enabled, lastRun
  **`2026-09-10T23:01:10Z`** · `04` `0 */4 * * *` enabled, lastRun `10:10:03Z` (this run) ·
  `05` `10 0 * * *` enabled, lastRun **`2026-09-10T14:10:55Z`** ·
  `weekly-security-audit` `30 7 * * 1` **enabled=false**.
- [MEASURED] Bootstrap corpus expressed as every `SKILL.md` behind a task in the MCP, per
  `STATION-CAPABILITIES.md` section 1 — not "the five". Six `SKILL.md` exist under
  `C:\Users\Marco\Claude\Scheduled\`; five carry station behaviour, all mtime
  `2026-09-01T00:07:44Z`, all declaring `station_doc_version: 1`.
- [MEASURED] Version parity, both sides: all seven repo station docs at `origin/main` declare
  `station_doc_version: 1` / `contract_version: 1`; all five station bootstraps declare `1`.
  **No mismatch.**
- [MEASURED] `node scripts/pipeline/lint-station.mjs` → **exit 0**, `ADMIT: all 8 docs clean`,
  `.claude/agents/*.md` (9 definitions) encoding clean.
- [MEASURED] Path resolution over `DOCTRINE.md`, `STATION-CAPABILITIES.md`, `CLAUDE.md` and all
  seven station docs at `origin/main`: **298** distinct repo-relative refs checked against the
  `origin/main` tree plus disk. Every apparent miss was a prose or glob stem my extractor had
  truncated (`docs/pr-prompts/00-`, `sot/05`, `docs/qa/qa-run-`) or a deliberately-untracked
  artefact (`apps/web/.env.local`, two quoted `docs/pr-reviews/pr-18xx-review.md` measurements,
  the deleted `Master-QA-…-Plan.md` the 04 doc itself explains). **Zero real dangling repo paths.**
  Controls: POSITIVE `scripts/pipeline/lint-prompt.mjs` tracked → true; NEGATIVE, a needle minted
  this run, `scripts/pipeline/zzQq04Needle20260914T1015.mjs` → not tracked, 0 occurrences in
  `DOCTRINE.md`; second POSITIVE `classifyPolicyFiles` in `DOCTRINE.md` → 11.

- [MEASURED] DOCTRINE section 9.5's anchor rule, run with the **per-document** prediction the
  2026-09-11 correction requires (a bare total is satisfiable by prose and reads as a failure):
  `DOCTRINE.md` → 5 distinct `<file>:<NNN>` citations, of which four
  (`ensure-watcher.ps1:10`, `CLAUDE.md:19`, `pr-gates.mjs:327`, `build-relationship-map.mjs:18-19`)
  are this document **quoting the citations it retired** and one is the legitimate survivor
  `start-watcher.ps1:160`, which resolves correctly to
  `if (-not $env:PR_WATCHER_AUTO_MERGE_POLICY) { $env:PR_WATCHER_AUTO_MERGE_POLICY = "tests-docs" }`.
  `STATION-CAPABILITIES.md` → 0 · `CLAUDE.md` → 0 · every station doc `00`–`06` → **0**.
  **The prediction is met exactly. The repo layer is clean.**
- [MEASURED] `.gitignore` citations in the repo layer all resolve on `origin/main`:
  `:28` → `.claude/` · `:75` → `docs/pr-prompts/*-ready.md` · `:76` → `docs/pr-prompts/processed/` ·
  `:76-83` → exactly the eight watcher sink folders.
- [MEASURED] `.gitignore:107-111`, cited by **all five** station bootstraps, resolves to
  `!Claude Design/docs/` · `!Claude Design/assets/` · `Claude Design/assets/*` ·
  `!Claude Design/assets/routes.js` · `!Claude Design/proposed/`. The five Overnight-QA sinks are
  at **115-119**, under the `# Overnight-QA scheduled task` comment at 113.
- [MEASURED] `pr-gates.mjs:327`, cited by `05-sot-keeper`'s bootstrap at its line 63, resolves to
  a bare `{` (`scripts/pr-gates/pr-gates.mjs` is 581 lines on `origin/main`). The repo-side 05 doc
  was converted to `(anchor: const sotRe = /^sot\//)` and is correct.
- [MEASURED] Desktop scheduled-task store `…\6662b30d-…\scheduled-tasks.json`, mtime
  `2026-09-14T10:10:03Z` (rewritten by this very run): `model` is **`claude-opus-5` on all five
  tasks**, and `weekly-security-audit` is `enabled:false`. Compared against the backup 00 took
  before its own 02:04Z write (`scheduled-tasks.bak-before-fable-2026-09-14T02-04-46-835Z.json`,
  all five `enabled:false`, `claude-opus-5`). POSITIVE control that the model field is describing
  reality: this run's own runtime is Opus 5.
- [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit 2:
  `00` 0.6h ok (cadence still read as **2h**, against a live hourly cron) · `03` 83.1h **SILENT** ·
  `04` 4.1h ok · `05` 92.1h **SILENT**. `structure: 14 checked, 0 malformed`.
- [MEASURED] Board trap probe: tracked depth-1 `*-ready.md` on `origin/main` → **0**
  (POSITIVE control, tracked depth-1 `*-HOLD.md` → 37, so the query is not blind).
- [MEASURED] The one ` D` in the dev tree,
  `docs/pr-prompts/pr-ratescol-s0-column-api-hygiene-HOLD.md`, is real against `origin/main`
  (`git diff --numstat origin/main --` → `0 95`, not empty), armed `08:24:38Z` by
  `actor=station-00.0808`, built into open `#1923`. Station 00 has already recorded it three
  times today (0852 addendum, 0908, 0940). Not re-filed.

## WHAT CHANGED

**Nothing on the board.** No arm, no disarm, no rename, no merge, no label, no PR, no
`needs-marco/` write, no `sot/` touch.

- `docs/pipeline/sweep-rotation.json` is **LEFT DIRTY** (` M`, `last_index=3`,
  `last_run_utc=2026-09-14T10:10:03Z`). **Station 00 must commit it** — 04 may not commit to the
  shared dev tree, and if it is not committed the next run repeats this sweep and the rotation
  stops turning.
- This breadcrumb, written to the tracked path `docs/pr-prompts/` and **untracked until a board PR
  carries it** — Station 00 sweeps it up.
- One scratch file outside the repo: `C:\po-sup-fix-scripts\04-instruction-drift-2026-09-14.mjs`
  (the path-resolution probe), and one sweep capture `C:\ProjectOperations2\.sweep-04-0914.txt`
  (untracked, matches no watcher glob).

## FINDINGS

### F1 — S3. A SIXTH rotten line citation is sitting in a bootstrap, and it is not on the paste list Marco already has

`needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md` (filed eight days ago, still
open) asks Marco to paste one replacement sentence into five bootstraps, killing the
`.gitignore:107-111` citation. I re-measured it this run: **all five still carry it**, the cited
lines still say `!Claude Design/…`, and the bootstrap mtimes are unchanged at
`2026-09-01T00:07:44Z`. That half is simply unactioned, not rotten in a new way.

**What is new** is that the same class has a member that paste will not touch.
`C:\Users\Marco\Claude\Scheduled\05-sot-keeper\SKILL.md` line 63 reads:

> CP-24 is a hard block: a PR mixing `sot/` with `scripts/` or `apps/` fails (`pr-gates.mjs:327`).

Line 327 of `scripts/pr-gates/pr-gates.mjs` on `origin/main` is a bare `{`. The repo-side 05 doc
carries the same claim correctly, as `(anchor: const sotRe = /^sot\//)` — so the anchor conversion
that swept the repo layer **stopped at the repo boundary**, and the layer that actually governs a
scheduled run kept the number. That is this sweep's whole reason for existing, reproduced in the
one direction the 09-06 escalation did not enumerate: it searched the class `\.gitignore:\d+`, and
this is a different file.

The danger is the same shape as the `.gitignore` half and slightly worse: a station that checks the
citation finds a brace, and the available conclusion is *"CP-24 is not where this says it is"* —
about the one gate that keeps `sot/` work from mixing with code.

**DISPOSITION: DISPATCHED** → **Station 00**, which authored and owns that `needs-marco/` file:
add one more line to its ITEM 1 paste list —
`05-sot-keeper\SKILL.md` line 63, replace `(pr-gates.mjs:327)` with
`(anchor: const sotRe = /^sot\// in scripts/pr-gates/pr-gates.mjs)`. I did not write into
`needs-marco/` myself: 04 is read-only on the board, and the file is 00's.
This also strengthens that escalation's ITEM 2 (a CI check validating every `<file>:<N>` citation
against the token its sentence claims) from "recurred twice" to **"recurred twice and has a live
instance the value-query for ITEM 1 cannot see"**.

### F2 — S3. The scheduled-task store silently reverted a write that had been read back and verified

Station 00's 2026-09-14T02:04Z run set `model` → `claude-fable-5-1` on all five desktop tasks and
`enabled:true` on `03/04/05/weekly-security-audit`, took a backup, and **read the result back by
re-parse**. Eight hours later:

| field | 00 wrote and verified at 02:04Z | [MEASURED] 10:1xZ |
|---|---|---|
| `model`, all five tasks | `claude-fable-5-1` | **`claude-opus-5`** |
| `weekly-security-audit.enabled` | `true` | **`false`** |
| `03/04/05.enabled` | `true` | `true` — survived |
| `00.enabled` | `false`, deliberately | `true` — changed by someone |

POSITIVE control that the `model` row is not a stale file read: **this run is Opus 5**, so the
store is describing what actually launched. The store's mtime is `2026-09-14T10:10:03Z` — it is
rewritten on every run, so there is no window in which "nobody has touched it" is available.

**Why this is a finding and not bookkeeping.** DOCTRINE section 1 says every mutation must be read
back and proved. For this store a read-back at write time proves nothing durable: the desktop app
rewrites `scheduled-tasks.json` from memory, so a verified write can be reverted with no error, no
log and no actor. 00 flagged that risk for `model` and it landed; what nobody predicted is that it
landed **selectively** — three `enabled` flags held and a fourth did not, which is the shape that
makes a future run trust the survivors and conclude the store is durable.

**DISPOSITION: DISPATCHED** → **Station 00**. Two things are yours: (a) decide whether
`weekly-security-audit` being off is Marco's intent or the revert, and ask him rather than
re-enabling it blind — a weekly read-only audit is exactly the task whose absence nobody notices;
(b) record in the collect that for this store the durable check is a **re-read after an app
restart**, never the write-time read-back. The Fable 5.1 migration itself is **not done** whatever
02:04Z recorded, and re-doing it on disk will revert again — the cloud-trigger half (done via API)
is the half that held.

### F3 — S4. `check-breadcrumb.mjs` still carries `'00': 2` against a live hourly cron

Re-confirmed this run: `--freshness` prints `00 … (cadence 2h) ok`, while the MCP reports
`5 * * * *`. So 00 is not called SILENT until 4h, i.e. after three consecutive missed hourly runs —
weak in escalation #23's exact direction. This is already recorded in `STATION-CAPABILITIES.md`
section 6 and filed for Marco as a one-character `scripts/` change.

**DISPOSITION: DEFERRED.** It is a known, filed, one-character fix outside 04's lane, and it has now
survived a ninth re-measurement. It becomes urgent the moment a 00 run is actually missed — which
this sweep would not catch, because `--freshness` is the instrument that would have to report it.

### F4 — S4. 03 and 05 read SILENT at 83h and 92h, and the cause is already closed

Both stations' breadcrumb ages and both `lastRunAt` values agree — two independent instruments, so
this is not the "an `ok` is not an all-clear" trap in either direction. The cause is on file:
Marco switched the tasks off on 2026-09-11 (~06:10Z) and 00 re-enabled them at 02:04Z today
(its 00:27Z breadcrumb, F1, ACTIONED). Both are enabled now with a `nextRunAt` **today** —
`05` at `14:10:37Z`, `03` at `23:00:45Z` — so the silence is recovery latency on a daily cadence,
not a stopped station.

**DISPOSITION: DEFERRED.** It becomes a real finding, and mine to re-file, if `05` has not reported
after `2026-09-14T14:10Z` or `03` after `2026-09-14T23:00Z`. Station 00's collect will cross that
boundary before my next run does.

## WHAT I DID NOT DO

- **Did not edit any bootstrap under `C:\Users\Marco\Claude\Scheduled\`.** That layer is outside
  the repo, outside CI and versioned by nothing; `STATION-CAPABILITIES.md` section 1 rules that a
  station prefers the repo doc and reports the drift. F1 is a report, not a repair.
- **Did not write into `docs/pr-prompts/needs-marco/`.** The escalation F1 belongs to already
  exists and is 00's; adding a line to it is 00's act, not mine.
- **Did not arm, disarm, rename or retire anything.** `armed: 0` when I measured it and `armed: 0`
  when I finished. I staged no `-HOLD` this run: the sweep was instruction-drift, and neither
  finding is repaired by a prompt I am allowed to write.
- **Did not re-file the `pr-ratescol-s0-column-api-hygiene-HOLD.md` stays-armable-forever
  instance.** Station 00 measured and dispositioned it three times in the four hours before this
  run, including the identical `0 95` numstat. Re-filing it would bill the next collect to
  re-close a closed item.
- **Did not commit `docs/pipeline/sweep-rotation.json`**, by rule — named above instead.
- **Did not run Part 0 (the static cross-layer audit) or any live-site pass.** The station contract
  gives me ONE named sweep per run, chosen by `next-sweep.mjs` and not by me, and tells me to cover
  it completely; a shallow pass over everything is the failure the rotation exists to prevent.
  Part 0 sub-check (a) therefore did not run this cycle.
- **Did not prune `C:\po-fix1891`, `C:\PR-Master\worktrees\po-vg` or `…\pr1823`.** Worktrees are
  03's, `po-vg` holds one uncommitted file, and 04 mutates nothing.
- **Did not re-enable `weekly-security-audit`.** That is a schedule mutation and, until someone
  asks Marco, possibly his own decision — F2(a).
- **Did not run any `git` through the device bridge.** The VM mount was down, so the guard could
  not be installed; a guard I could not install is never a licence to run `git` there anyway.

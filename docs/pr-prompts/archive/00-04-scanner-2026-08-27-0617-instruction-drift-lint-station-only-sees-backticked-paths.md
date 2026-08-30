# Station 04 — Scanner | 2026-08-27T06:10:09Z–2026-08-27T06:20Z

## GROUND

```
UTC            2026-08-27T06:10:09Z
origin/main    6aeae7e8            (fetched with +refs/heads/main:refs/remotes/origin/main)
dev tree       main @ 549537a4     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (<!-- station_doc_version: 1 --> in the scheduled SKILL.md)
```

Versions AGREE — this run had full authority. Shell reached (Desktop Commander, PID 42864,
`powershell.exe`). Sweep taken: **instruction-drift** (rotation position 4 of 4), assigned by
`node scripts/pipeline/next-sweep.mjs`, not chosen.

## WHAT I MEASURED

- `[MEASURED]` **The bootstrap I was handed is byte-identical to the on-disk scheduled file.**
  `Get-FileHash` of the inlined `…\uploads\SKILL.md` and of
  `C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md` both =
  `2F34D1E53EF51951F823AC39889750947AC8BD2033EC53E30DBB4756A80D4816` (5276 bytes).
  This had never been proved before; the uploads copy is a faithful copy, not a drifted one.
- `[MEASURED]` **All five scheduled bootstraps declare `station_doc_version: 1`; all six repo
  station docs declare `station_doc_version: 1` and `contract_version: 1`.** No mismatch anywhere.
  All five were last written 2026-08-24 22:54:22Z (identical mtime).
- `[MEASURED]` **All five bootstraps point at the correct repo doc** (`docs/pipeline/stations/
  <same-name>.md`, both as a repo path at line 2 and a `C:\ProjectOperations2\…` path at line 31)
  and all five carry the CORRECTED fetch advice (`?plain=1`, line 41-42). **None carries the
  disproved "the raw CDN lags" line.** The bootstrap layer is clean.
- `[MEASURED]` `node scripts/pipeline/lint-station.mjs` → `ADMIT: all 7 docs clean`, exit 0. One
  warning only: `04-scanner.md` names `C:\po-scan-`, which sits inside the SUPERSEDED, commented-out
  worktree block — benign.
- `[MEASURED]` **265 path references extracted from DOCTRINE + STATION-CAPABILITIES + all six
  station docs + all five bootstraps; 215 resolve, 44 do not.** Controls both behaved
  (`docs/pipeline/DOCTRINE.md` = true, `docs/pipeline/NO-SUCH-FILE.md` = false). Script:
  `C:\po-sup-fix-scripts\scan-04-pathdrift-2026-08-27.mjs`.
  **DOCTRINE.md and STATION-CAPABILITIES.md produced ZERO unresolved paths** — every path those two
  name still resolves.
- `[MEASURED]` Of the 44, most are my regex truncating a filename *template* (`docs/pr-prompts/00-`)
  or the established `sot/05` shorthand. Six survive as real prose references to paths that neither
  exist on disk nor are tracked by git — see F1.
- `[MEASURED]` `.gitignore` line claims quoted across the station docs are all CORRECT:
  `:75 docs/pr-prompts/*-ready.md`, `:76-82` the seven retire folders, `:106 docs/qa/qa-checklist.md`,
  `:107 docs/qa/qa-findings.md`. Also `:108 qa-test-data-registry.md`, `:109 .qa-run.lock`,
  `:110 qa-run-*.md`.
- `[MEASURED]` **`C:\ProjectOperations-Reference\worktrees` is absent — and that is BY DESIGN, not
  drift.** `02-board-driver.md:282` says "mkdir … first if missing" and "rmdir … if it is now empty".
  I nearly filed this as a dead path; reading the surrounding source lines killed it.
- `[MEASURED]` **All four worktree roots in STATION-CAPABILITIES §4 exist** (`C:\po-worktrees`,
  `C:\po-wt`, `C:\po-wt-h`, `C:\po-watcher-worktrees`), as do `C:\po-watcher`,
  `C:\po-watcher\ProjectOperations`, `C:\po-sup-fix-scripts`, `C:\po-watcher\verdicts-archive`,
  `C:\Users\Marco\Claude\Scheduled`.
- `[MEASURED]` **Board, 06:17:06Z:** 1 armed (`pr-dns-s3-sot06-widgets-and-marker-ready.md`),
  47 `pr-*-HOLD.md`. Watcher ALIVE and mid-run on that prompt —
  `C:\po-watcher\ProjectOperations\scripts\pr-watcher\heartbeat.log` tail reads
  `[2026-08-27T06:16:47.116Z] pr-dns-s3-sot06-widgets-and-marker-ready.md elapsed=120s`.
- `[MEASURED]` `scripts/pipeline/status-sweep.ps1` finished 06:10:55Z with
  **`DO NOT ACT: a board mutation is in progress`** and `ready=1 needs-marco=2 blocked=4 broken=0`
  on the backlog gates. That verdict was correct when printed and was **stale six minutes later** —
  see F6.

### Instrument notes from this run

- 🟢 **NEW POSITIVE CONTROL: `$` SURVIVES inside a Desktop Commander `interact_with_process`
  session.** `$ctrl = "DOLLAR_OK"; Write-Host "CONTROL=$ctrl"` printed `CONTROL=DOLLAR_OK`.
  DOCTRINE §9.1's `$`-stripping trap applies to `-Command "…"` strings, **not** to input sent to a
  live PS session. This removes the need to write a `.ps1` for every probe.
- 🔴 **NEW INSTRUMENT LIE: `Select-String -Path apps\api\src\**\*.ts` returns ZERO.** PowerShell's
  `**` does not recurse; the query answered `0 files contain isSuperUser` against a truth of at
  least 2. Caught only because a control was run. Use `Get-ChildItem -Recurse` or
  `[IO.File]::ReadAllText` per file.
- 🟢 **`lint-station.mjs`'s untracked-path check WAS PROVED TO FIRE.** A copy of `04-scanner.md`
  with one added backticked `` `docs/pipeline/THIS-DOES-NOT-EXIST.md` `` produced
  `REJECT … names a repo path that git does not track`, exit 1. So its silence in F1 is a genuine
  blind spot, not a broken instrument.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — **ADVANCED** to `last_index=3`,
  `last_run_utc=2026-08-27T06:10:35Z` via `next-sweep.mjs --advance`. Read back from the tool's own
  output. **Working-tree change, UNCOMMITTED** (see WHAT I DID NOT DO).
- This breadcrumb was written, **UNTRACKED**. Station 00 must sweep it up.
- Three scratch scripts under `C:\po-sup-fix-scripts\` (`scan-04-pathdrift-2026-08-27.mjs`,
  `scan-04-focus-2026-08-27.mjs`, `scan-04-lintgap-2026-08-27.mjs`). The temporary lint control copy
  was deleted.
- **NOTHING ELSE. No board mutation. The git index was not touched.**

## FINDINGS

### F1 — S3 — `lint-station.mjs` only path-checks BACKTICKED paths, so six prose paths across four station docs are invisible to it

`repoPathsIn()` (`scripts/pipeline/lint-station.mjs:83-96`) matches only `` `docs/…` `` inside
backticks. A path written in plain prose is never extracted, so the tracked-path check — the check
written precisely to stop a station instruction naming a file that exists on one machine and nowhere
else — never runs on it. **Proved with a positive control** (see instrument notes): the check DOES
reject a backticked untracked path, exit 1.

The six that slip through (all `exists_on_disk = false`, all `git_tracked = false`, all unbackticked):

| doc | path named | why it matters |
|---|---|---|
| `04-scanner.md` | `docs/qa/Master-QA-and-Consolidation-Program-Plan.md` | see **F4** — dead fallback |
| `04-scanner.md` | `docs/qa/qa-github-audit.md` | benign — "create if absent" |
| `02-board-driver.md` | `docs/design` | see **F2** — permanently-false gate |
| `02-board-driver.md` | `docs/pr-prompts/AWAITING-MARCO-DECISION.md` | benign — "Overwrite … each run" |
| `03-machine-minder.md` | `docs/pr-prompts/triage-state.md` | benign — "create if absent" |
| `00-supervisor.md` | `docs/pr-prompts/triage-state.md` | already struck through and annotated REMOVED |

Two are real defects, four are benign — but the linter cannot tell them apart because **it never sees
any of them.** The fix is one regex, and it is additive: extend `repoPathsIn()` to also scan
unbackticked occurrences (same top-dir allowlist, same `nearGitignore` suppression, same `sot/NN`
shorthand skip). Suggested guard against false positives: require the prose match to end in a file
extension or a known directory name, and keep the existing gitignore-proximity exemption. Run
`lint-station.mjs` immediately after and expect it to surface exactly the two defects below plus the
four benign create-if-absent paths, which should then be backticked-and-exempted or reworded.

**DISPATCHED** — to Station 00, for arming as a prompt against `scripts/pipeline/lint-station.mjs`.
I did not stage it myself: a watcher run was in flight on `pr-dns-s3-…-ready.md` at the moment I
would have had to `git add` an untracked HOLD into the SHARED index, which is the LL-38 collision.

### F2 — S3 — 02-board-driver's OPEN DESIGN DECISION escalation is a permanently-false gate

`02-board-driver.md` classifies an escalation as `OPEN DESIGN DECISION: a docs/design PR whose body
explicitly poses an UNRESOLVED QUESTION for Marco`. **`docs/design` does not exist and `git ls-files
"docs/design*"` returns 0.** Design material lives under `docs/architecture/drafts/` (measured: the
folder exists; `docs/` top level is approvals, architecture, audits, data-model, deploy, diagnostics,
engineering, housekeeping, lessons-learned, migration-runs, pipeline, plans, pr-prompts, pr-reviews,
qa, rates, runbooks, samples, troubleshooting, workflows — **no `design`**).

No PR can ever match the trigger, so that whole escalation class routes to nothing. Same shape as the
`clients.*` permanently-false gate. **RULE 1 fix, complete-and-additive:** re-point the trigger at
`docs/architecture/` **and** keep matching `docs/design` in case the folder is ever created — a
two-path test breaks nothing today and survives a future rename. The alternative (just swap the
string) fails the *future* half: it silently breaks again the day design docs move.

**DISPATCHED** — to Station 00. Owning doc is 02's; the edit is a one-line docs PR.

### F3 — S3 — my own station doc names the wrong path for `persona-permission.guard.ts`

`04-scanner.md` Part 0(a) anchors the AUTHORIZATION PARITY sub-check on
`apps/api/src/common/auth/permissions.guard.ts` **and**
`apps/api/src/common/auth/persona-permission.guard.ts`. The second path does not exist. The file is at
**`apps/api/src/modules/personas/persona-permission.guard.ts`** (measured; a
`__tests__/persona-permission.guard.spec.ts` sits beside it). `apps/api/src/common/auth/` contains
`jwt-auth.guard.ts`, `permissions.guard.ts`, `super-user.guard.ts` — no persona guard.

**The doc's substance is correct, only its path is wrong:** both real files contain exactly one
`isSuperUser` occurrence each (control: `.gitignore` → 0). So sub-check (a) still has a true premise —
but an agent following the literal path gets a file-not-found and may report the guard as missing.

**DISPATCHED** — to Station 00, one-line docs fix. (Bundle with F2; both are single-string edits.)

### F4 — S4 — the QA-checklist rebuild fallback points at a file that exists nowhere

`04-scanner.md` STATE FILES step 1: "If missing, rebuild from
`docs/qa/Master-QA-and-Consolidation-Program-Plan.md`". That file is absent from disk **and**
untracked. The fallback is dead. It is currently MASKED because `docs/qa/qa-checklist.md` happens to
exist on this machine — and it is gitignored (`.gitignore:106`), so on any other machine, in CI, or in
a fresh clone, step 1 falls straight through to an instruction that cannot be followed.

**DEFERRED** — becomes urgent the first time a scanner runs where `docs/qa/qa-checklist.md` is absent,
which is every machine except this one. The fix is Marco's call on intent: either restore the plan
document to a tracked path, or rewrite step 1 to say what to do when both files are missing.

### F5 — no defect — the bootstrap layer is CLEAN, and 06 still has no bootstrap

All five scheduled bootstraps: correct doc pointer, matching version, corrected `?plain=1` advice,
no disproved raw-CDN line, identical mtimes. The multi-copy drift this sweep exists to catch is
**not present today.** Separately re-confirmed: **`docs/pipeline/stations/06-pr-master.md` exists at
v1 but there is NO `C:\Users\Marco\Claude\Scheduled\06-pr-master\`** — six station docs, five
bootstraps.

**DEFERRED** — 06's missing schedule is already escalated to Marco by Station 00 (16:09Z 2026-08-26).
Recorded here only as this sweep's independent confirmation. Do NOT re-raise.

### F6 — instrument — the 4-hour stale `index.lock` decayed under me in 6.5 minutes

- 06:10:35Z `[MEASURED]` `.git/index.lock` present, **0 bytes**, mtime `2026-08-27T02:07:36Z`
  (4 h 03 m old), `Get-Process git` count 0, and no `MERGE_HEAD` / `REBASE_HEAD` /
  `CHERRY_PICK_HEAD` / `rebase-merge` / `rebase-apply` / `sequencer`. By the station doc's own test
  that is **STALE**. I did not clear it — that is 03's, on 00's dispatch.
- 06:10:55Z `status-sweep.ps1` verdict: **`DO NOT ACT`** on the strength of that lock.
- 06:17:06Z `[MEASURED]` **lock ABSENT.** Untracked breadcrumb
  `00-00-supervisor-2026-08-27-0608-cleared-the-four-hour-stale-lock-and-armed-dns-s3.md` on disk;
  index carries `R100 pr-dns-s3-…-HOLD.md -> …-ready.md` — a **tracked, audited `git mv` arm**, not
  an `fs.renameSync`; watcher mid-run on it at elapsed=120s.

Two things worth keeping: **(1)** a `DO NOT ACT` verdict expires as fast as a `SAFE TO ACT` one — the
station doc warns about the latter and is silent on the former. **(2)** The staged index right now
carries **four R100 renames and two adds from other actors**
(`00-04-scanner-2026-08-26-2218-…md`, `pr-doctrine-s9-four-false-traps-LOOPING.md`, and consumed
arms `pr-ew-s2b-alloc-engine-core`, `pr-lessons-folder-s2-unfold-sot05`,
`pr-sot-02-reconcile-2026-08-19`). **Any commit without a pathspec ships all of them.**

**ACTIONED** — measured, reported, nothing cleared. Note for 00: `pr-doctrine-s9-four-false-traps`
is staged as `-LOOPING.md`, not `-HOLD.md`; the 2026-08-26 22:18Z scanner run recorded it as `-HOLD`.

## WHAT I DID NOT DO

- **Did not commit anything.** `sweep-rotation.json` is advanced in the working tree but uncommitted:
  a watcher run was live on `pr-dns-s3-…-ready.md` and the shared index held another actor's
  in-flight arm. Station 00: `git commit -- docs/pipeline/sweep-rotation.json <this breadcrumb>`
  with a pathspec, or the next run repeats the instruction-drift sweep.
- **Did not clear the stale lock** — 03's job, on 00's dispatch. It cleared itself anyway (F6).
- **Did not stage a prompt.** Budget allowed 2; I staged 0, for the index-collision reason in F1.
- **Did not run Part 0 (a)-(f), Part 1 GitHub reconciliation, or Part 2 live-site.** The station doc
  says take ONE assigned sweep and cover it completely; `next-sweep.mjs` assigned instruction-drift.
- **Did not touch `/sot/`, Azure, Entra, SharePoint, or production data.**

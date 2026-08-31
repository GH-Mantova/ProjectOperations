# Station 00 — Supervisor | 2026-08-30T14:08:16Z–2026-08-30T14:4xZ

## GROUND

```
UTC            2026-08-30T14:08:16Z
origin/main    4461c8be              (git fetch origin, then rev-parse origin/main)
dev tree       main @ 4461c8be       C:\ProjectOperations2   (CONVERGED, 0 ahead / 0 behind)
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (scheduled-task SKILL.md station_doc_version)
```

Doc version and bootstrap AGREE — full authority, not read-only-degraded.

**SIGHTED run.** `start_process` shell `powershell.exe` succeeded (PID 14468). Desktop Commander
present. This was **not** a blind run.

Binding docs read in full this run: `00-supervisor.md` (906 lines), `DOCTRINE.md` (479 lines),
`STATION-CAPABILITIES.md` (207 lines), read from the dev tree, which is at the same SHA as
`origin/main` — so the staleness trap the preflight warns about does not apply this run.

⚠️ **Clock note.** The scheduled-run header claims the date is 2026-08-31. The box disagrees:
`(Get-Date).ToUniversalTime()` → `2026-08-30T14:08:16Z`, and `restart-watcher-if-wedged.ps1`
printed local `2026-08-31 00:10:06` = Brisbane UTC+10 = `2026-08-30T14:10Z`. Both box instruments
agree with each other and with the 2 h cadence since the 12:09Z run. **Every stamp in this report
is the box clock.** [MEASURED]

## WHAT I MEASURED

**Board gate.** `status-sweep.ps1` → `SAFE TO ACT: no board mutation in progress, no recent remote
activity`. `SWEEP COMPLETE 2026-08-30 14:08:49Z`. All four section-0 positive controls passed. [MEASURED]

**Board.** `[LIVE] OPEN PRs: 0`. Zero open, therefore zero DIRTY, therefore no frozen CI and no
conflict blocking the board (Q1/Q2 of the answer sheet). [MEASURED]

**Arming state.** `*-ready.md` at depth 1 = **0**, counted myself with
`Get-ChildItem docs\pr-prompts\*-ready.md` (Q3). `*-HOLD.md` at depth 1 = **61**. [MEASURED]

**Dev tree.** `git fetch origin` then `rev-parse`: `origin/main` and `HEAD` both
`4461c8bef057e75f9f6385a85bfc2d10172de093`; `git rev-list --left-right --count origin/main...HEAD`
→ `0	0`. No `index.lock`, no `MERGE_HEAD`. Only pre-existing dirt: `metadata-catalog.json` ` M`
(the known CRLF stat artifact — not a defect, do not "fix" it) and eight untracked paths. [MEASURED]

**Watcher.** `restart-watcher-if-wedged.ps1` (no `-Fix`) → `VERDICT: OK - nothing armed and the
watcher is alive. An idle watcher is correct, not wedged.` node pid **26364**, restart churn 0 in
20 min. ENSURE-UP probe (matching BOTH wrapper names, per the #1396 correction) →
`wrapper present (node=1 wrapper=3) - no action`. [MEASURED]

**Collect channel.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **CLEAN, exit 0**;
122 breadcrumbs checked, 0 malformed, 9 skipped as pre-contract. No station SILENT:
`00` 2.0h/2 · `02` dispatch-only · `03` 15.1h/24 · `04` 4.0h/4 · `05` **24.0h/24**. [MEASURED]

**Queue-root census.** `git ls-files docs/pr-prompts` filtered to `^docs/pr-prompts/0[0-9]-`:
**162 tracked breadcrumbs** in the root, against **61** live `-HOLD.md`. By filename date:
08-18 ×1 · 08-20 ×7 · 08-21 ×6 · 08-22 ×4 · 08-23 ×1 · 08-24 ×21 · 08-25 ×22 · 08-26 ×30 ·
08-27 ×19 · 08-28 ×21 · 08-29 ×20 · 08-30 ×10. `archive/` held **41**. [MEASURED]

**OAuth, SEVENTEENTH reading, taken directly** from `C:\Users\Marco\.claude\.credentials.json`
(the real path — it is on no mounted share, which is why blind runs read `[CANNOT MEASURE]`):
mtime **UNCHANGED** at `2026-08-28T16:13:26.9090035Z`, `expiresAt` `2026-08-28T16:13:35.9840000Z`,
now **expired 45.94 h**, lead **9.075 s**. The lead is re-confirmed, not inherited: the last write
stored a credential already nine seconds from death, so the fault is in the refresh RESPONSE, not
in a refresher that stopped running. [MEASURED]

**A spent prompt in the queue root.** `pr-doctrine-s9-four-false-traps-LOOPING.md` — **UNTRACKED**
(`git ls-files --error-unmatch` → `did not match any file(s) known to git`). Its premise is
`grep -q "no inline .if. expression" docs/pipeline/DOCTRINE.md`; that string is **absent** from
DOCTRINE today. Positive control on the same file, same run: `AN EMPTY RESULT IS NOT AN EMPTY WORLD`
→ 1 hit, so the reader works and the absence is real. The prompt is **SPENT** — #1401 landed its
corrections. [MEASURED]

**Archive safety, re-proved — and the inherited claim was HALF WRONG.** I came into this run
carrying "`check-breadcrumb.mjs` matches by basename, so archiving changes nothing it counts."
Measured after the commit, in the worktree, that is true of **freshness** and **false of the
structure pass**:

- `--freshness` → **CLEAN, exit 0**, and the five ages are IDENTICAL to the pre-move reading:
  `03` 15.1h/24, `05` 24.0h/24. Those two stations' latest breadcrumbs are **both** files this PR
  archived, and freshness still found them. That pair is the positive control. It works because
  `trackedSet` is built from `git ls-tree -r --name-only origin/main -- docs/pr-prompts`
  (`check-breadcrumb.mjs:98`, `-r`, so recursive into `archive/`) and matched by **basename**
  (`:162`), with an explicit "landed on main, absent from this working tree" path at `:178`.
- The **structure** pass went **122 checked → 11**, 0 malformed, exit 0. It iterates
  `readdirSync(DIR)` at `:160`, which is **depth-1 only** — so archived breadcrumbs are no longer
  re-validated. That is not a regression (each was validated while it was current, and CI still
  exits 0 on a smaller set), but it is **not** what "location does not change what it counts"
  claims, and the next station to archive something should know the count will drop. [MEASURED]

**Nothing else references the moved files.** `Select-String sot\*.md -Pattern 'pr-prompts/0[0-9]-'`
→ **0**, and `docs/qa/sot-refs-baseline.json` carries **0** such entries, so `check-sot-refs.mjs`
cannot regress and the baseline floor of 8 is untouched. The only repo-wide references live in five
historical `docs/data-model/sweeps/*` and `docs/audits/*` files, which no CI job link-checks. [MEASURED]

## WHAT CHANGED

**PR #1404** (this run's PR), from a disposable worktree `C:\po-worktrees\sup-1410` off
`origin/main`:

- **152 breadcrumbs `git mv`'d** from `docs/pr-prompts/` to `docs/pr-prompts/archive/` — every
  `0N-*` file dated **2026-08-29 or earlier**, i.e. every one already dispositioned in a prior run.
  `git diff --cached --name-status` showed **152 `R`, 0 non-renames** before the commit, so nothing
  another chat had staged rode along. Read back: root `0N-*` **162 → 10**, `archive/` **41 → 193**.
- **DOCTRINE §9.5 gains one bullet** (F6) recording what `check-breadcrumb.mjs` actually measures,
  because I nearly relied on a half-wrong version of it. `_canonical-blocks.json` re-recorded:
  `instruments v2` → `6568700884268aca`.
- **This breadcrumb**, committed in the same PR so nobody has to sweep it up.

**The ten left in the root are deliberate**: all are dated 2026-08-30, which is the current cycle.
Archive is for what has already been dispositioned, not for what the next run still has to read.

`pr-doctrine-s9-four-false-traps-LOOPING.md` moved on disk from the dev-tree queue root to
`docs/pr-prompts/superseded/`. It is untracked, so this is a filesystem move and not a commit;
read back with `Test-Path` on both ends.

Nothing was armed. Nothing was merged that the watcher had routed to Marco. `/sot/` untouched.
Azure / Entra / SharePoint untouched.

## FINDINGS

### F1 — the board 00 arms from was 73% archive

162 of the 223 tracked files in the queue root were breadcrumbs from previous runs, all already
dispositioned; only 61 were live `-HOLD.md` prompts. At ~20 new breadcrumbs a day this was getting
worse daily, and it is the exact surface a supervisor scans by eye before deciding what to arm. The
promise made in #1403's breadcrumb was to fix this as its own PR, first thing.

**DISPOSITION: ACTIONED.** 152 archived in #1404; root is now 10 breadcrumbs to 61 HOLDs. Verified
by re-running both the freshness and the structure validator after the commit, and by confirming no
`sot/` reference or baseline entry points at any moved path.

### F2 — OAuth has been dead for 45.9 h and the block still stands

Seventeenth consecutive reading, mtime unchanged since 2026-08-28T16:13:26Z. Every armed prompt
would burn on a 401 the moment the watcher picked it up — which is why ARMED has correctly been 0
for two days. The stillness of this board is a **correctly-held brake**, not health and not a stall.

**DISPOSITION: ESCALATED** (standing item, no new question). Marco re-authenticates; nothing an
agent can do reaches it. Until then **arm nothing**, including `rates-11c-blocked-consumers`, which
`status-sweep` §6 keeps reporting as READY TO STAGE.

### F3 — a spent prompt was sitting in the queue root, untracked

`pr-doctrine-s9-four-false-traps-LOOPING.md`: premise dead, corrections already landed in #1401,
untracked so no `git mv` could ever arm it, and `-LOOPING` matches no watcher glob. Harmless, but it
is one more dead thing on the surface F1 just cleaned.

**DISPOSITION: ACTIONED.** Moved to `docs/pr-prompts/superseded/` on disk. Deliberately NOT added to
git — committing a spent prompt to make it tidy would put dead work back on the board.

### F4 — Station 05 is at exactly its cadence with dispatched work outstanding

`05` last reported 2026-08-29T14:12Z, **24.0h ago against a 24 h cadence** — `ok`, but one missed
cycle from SILENT. It carries the sot-refs `exempt=` burn-down re-dispatched at 06:3xZ (the marker
`<!-- sot-ref-allow: ... -->` must be written INSIDE `sot/`, which only 05 may do; 10 of the 23
baselined entries qualify). Nothing here is broken yet.

**DISPOSITION: DEFERRED.** It becomes urgent at 00's next run: if `--freshness` then reads `05`
SILENT, or 05 has run and not touched the burn-down, 00 lands the explanatory paragraph itself and
files 05's silence as a defect rather than waiting a third cycle.

### F5 — the collect channel was genuinely empty

The only two breadcrumbs written since my 12:09Z run are 04's 10:10Z repo-hygiene report and my own
12:09Z one, and **both were already dispositioned in #1403** — their 12:34:58 mtimes are just when
#1403's merge landed them on disk. 04's next run is due at ~14:10Z, i.e. after this run's window.

**DISPOSITION: ACTIONED** — nothing to collect, and the reason is measured rather than assumed. Said
out loud because a blind run and an empty collect channel produce the same silence, and this run was
sighted.

### F6 — I was carrying a half-wrong claim about the instrument I was about to rely on

The standing note said `check-breadcrumb.mjs` "matches by basename, so archiving changes nothing it
counts." Half of that is right and I would have shipped the wrong half unnoticed if I had not
re-measured after the commit instead of before it. **Freshness** is recursive and basename-matched
(`:98`, `:162`) and survived the move intact — proved by `03` and `05`, whose newest breadcrumbs this
PR archived and whose ages did not move. **Structure** iterates `readdirSync` at `:160` and is
depth-1 only, so it went `122 checked → 11`. Both exit 0, so nothing is broken; but a claim that
covers one pass and is quoted as covering both is exactly the §7 shape — a confident, coherent,
partly-wrong reading of a working system.

**DISPOSITION: ACTIONED.** Corrected in DOCTRINE §9.5 in this same PR, with the numbers and the line
references, so it stops living only in one chat's memory. `lint-station.mjs` went
`REJECT: 1 of 7 docs failed` (exit 1) → `--write-canonical` → `ADMIT: all 7 docs clean` (exit 0);
that REJECT→ADMIT pair is the positive control that the edit was actually seen, and the
`instruments v2` hash moved to `6568700884268aca`.

## WHAT I DID NOT DO

- **Armed nothing.** The OAuth block (F2) is absolute while the token is dead. That includes
  `rates-11c-blocked-consumers`, and `pr-dns-s5-checker-flip-to-fail-HOLD`, which is now permanently
  gated at `lint-prompt.mjs:728` by the `<!-- watcher: do-not-arm -->` marker #1400 put on it.
- **Did not restart the watcher.** `OK` verdict, 0 armed, node alive under 3 wrappers. An idle
  watcher with an empty queue is correct; restarting it would be the LL-25 mistake.
- **Did not touch the watcher clone's `dirty=35`.** That is 03's lane and a permanent amber — the
  clone's own `verdict-archive` moves 35 tracked files out without committing.
- **Did not archive the 10 breadcrumbs dated 2026-08-30.** Current cycle; the next run reads them.
- **Did not clear the 13 `[STALE]` `needs-marco/` escalations.** The folder is gitignored, so no PR
  can clear them and the `needs-marco/: 14` count stays inflated. Unchanged from prior runs.
- **Did not touch `/sot/`** (05's lane), **Azure / Entra / SharePoint** (Marco, absolute), or
  production data.

# Station 04 — Scanner | 2026-09-21T06:11:06Z–2026-09-21T06:18:40Z

Sweep this run: **instruction-drift** (rotation position 4 of 4, assigned by
`node scripts/pipeline/next-sweep.mjs`).

## GROUND

```
UTC            2026-09-21T06:11:39Z
origin/main    f885dc04
dev tree       main @ 29abf8d4   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1   (C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md)
```

**Versions MATCH. This run was read-write within Station 04's read-only-on-the-board lane.**

Not blind. Desktop Commander loaded via keyword `ToolSearch` (`desktop-commander`, not a hard-coded
id) and `start_process` on `powershell.exe` succeeded on the first call.

VM git guard, last line quoted verbatim, pass:

```
vm-git-guard installed at /sessions/intelligent-happy-ptolemy/.local/bin/git - refuses mounted paths
and mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

Binding docs read in the **dev tree** after `git fetch origin`, freshness proved with
`git diff --numstat origin/main -- <path>` (empty = identical), never a piped hash:

| doc | `git diff --numstat origin/main` |
|---|---|
| `docs/pipeline/stations/04-scanner.md` | EMPTY — identical |
| `docs/pipeline/DOCTRINE.md` | EMPTY — identical |
| `docs/pipeline/STATION-CAPABILITIES.md` | EMPTY — identical |

## WHAT I MEASURED

**[MEASURED] Bootstrap inventory** — `Get-ChildItem C:\Users\Marco\Claude\Scheduled -Recurse -Filter SKILL.md`.
Five live bootstraps, all `station_doc_version: 1`, all mtime `2026-09-01T00:07:44`:
`00-supervisor` (5905 B), `02-board-driver` (5902 B), `03-machine-minder` (5880 B),
`04-scanner` (5841 B), `05-sot-keeper` (5816 B). Plus `weekly-security-audit` (no version, not a
station) and five `_retired-2026-08-18/` files (no version, correctly retired).

**[MEASURED] Bootstrap ↔ station-doc version parity** — every one of the five live bootstraps
declares `station_doc_version: 1`; every one of the seven repo station docs declares
`station_doc_version: 1` on `origin/main`. **Full parity. No station should be read-only on a
version mismatch.**

**[MEASURED] The bootstrap that actually fired me is byte-identical to the one on disk.**
`Get-FileHash` on the uploaded `.../uploads/SKILL.md` and on
`C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md` both returned `20BEFA7D768F774B`, 5841 bytes,
and `Compare-Object` over the two returned `$null` — IDENTICAL line-for-line. The fired copy is not
a drifted paste.

**[MEASURED] `node scripts/pipeline/lint-station.mjs`** → `ADMIT: all 8 docs clean`, `EXIT=0`, plus
a NOTE block flagging all seven station docs. Run twice, byte-identical output both times. See F1.

**[MEASURED] Canonical contract version** — `git show origin/main:docs/pipeline/stations/_canonical-blocks.json`
→ `"station-contract": { "version": 3, "sha": "954c7f49160daa71" }`.

**[MEASURED] Path resolution — 187 repo-relative paths named across DOCTRINE, STATION-CAPABILITIES
and all seven station docs. 184 resolve; 3 do not, and all three are explained below.**
Positive control: 158 tracked on `origin/main`, 26 untracked-but-present on disk (the
gitignored-by-design artifacts), 3 resolving nowhere.

> 🔴 **Methodology correction for the next run — my first pass was unsound and I am recording it so
> nobody re-files its output as findings.** I first tested resolution with `git ls-tree` alone and
> got **seven** "dangling" paths. Four were false: `.claude/agents/pr-tester.md`,
> `docs/data-model/relationship-map.{json,md}` and `apps/api/scripts/xero-import-report.md` are
> **gitignored by design and present on disk** — STATION-CAPABILITIES and `05-sot-keeper.md` both
> document them as such, with measurements. A further three were my own regex truncating `.json`→`.js`
> and `.tsx`→`.ts` (`sot-refs-baseline.js`, `sweep-rotation.js`, `SettingsShell.ts`), which is a §7
> instrument lie of exactly the kind DOCTRINE warns about. **`git ls-tree` cannot answer "does this
> path resolve" in a repo that deliberately gitignores generated artifacts — test disk too.**

The three that resolve nowhere:

| doc | path | verdict |
|---|---|---|
| `04-scanner.md` | `docs/qa/Master-QA-and-Consolidation-Program-Plan.md` | **Not a defect.** The doc names it only to record that it was deleted in the 2026-08-17 cleanup, with the measurement attached. Correctly handled. |
| `DOCTRINE.md` | `docs/pr-reviews/pr-1850-review.md` | See F2. |
| `DOCTRINE.md` | `docs/pr-reviews/pr-1852-review.md` | See F2. |

**[MEASURED] `02-board-driver` has a bootstrap but no live scheduled task — and this is BY DESIGN,
already documented. NOT a finding.** The live schedule (`list_scheduled_tasks`, the only
authoritative source) holds `00-supervisor`, `03-machine-minder`, `04-scanner`, `05-sot-keeper`
enabled, and `weekly-security-audit` disabled. No `02-board-driver`. Its bootstrap says
`Cadence: on dispatch from Station 00 only - you have no schedule of your own`, and
`STATION-CAPABILITIES.md` already states *"a `02-board-driver` folder exists under `Scheduled\` and
there is no live task behind it"* with the matrix row `02 Board-driver | on dispatch only`. Three
layers agree. Checking history before filing is what stopped this becoming a false S3.

**[MEASURED] `01-code-writer` and `06-pr-master` have station docs and `.claude/agents/` definitions
but no bootstrap and no schedule — consistent and correct.** Both are watcher/dispatch-invoked, not
cron-fired. `git ls-tree origin/main .claude/agents/` returns all seven station agents plus
`pr-fix-reviewer.md`.

**[MEASURED] Board state at 06:11:43Z** (`status-sweep.ps1`, reported not acted on — I mutate
nothing on the board): 1 open PR #2028 BLOCKED, CI 10 pass / 0 fail / 4 pending. Watcher RUNNING
pid 9744, heartbeat 0 min, build in flight. `main` CI on `f885dc04`: 4 running, nothing concluded —
**[CANNOT MEASURE] whether trunk is green.** Armed queue: 1 (`pr-scopecards-s4a-push-by-destination-api-b-ready.md`).

**[MEASURED] Instrument lie, reported for the next station's benefit:** the Desktop Commander
`start_process` bridge **strips `$` from `-Command` strings**. `foreach ($p in ...)` arrived as
`foreach ( in ...)` and PowerShell threw `MissingVariableNameAfterForeach`. The failure is loud, so
it costs a turn rather than producing a wrong answer — but every multi-statement command in this run
had to be written to a `.ps1` outside the repo and run with `-File`. Recommend that as the default.

**[LEAD, not a finding] Left for Station 03:** status-sweep reports the watcher clone dirty=3 (may
refuse to start), an orphaned worktree `C:/PR-Master/worktrees/po-vg` holding **1 uncommitted file**
at age 24378 min (`git worktree remove` will refuse; `--force` would discard it), and a
registry-escapee `C:\po-worktrees\po-fix-2005` (0 KB, age 5193 min, no lock). Machine hygiene is
03's lane, not mine, and none of it is mine to clear.

## WHAT CHANGED

1. **Staged one HOLD prompt** (arming nothing):
   `docs/pr-prompts/pr-lintstation-contract-version-compare-HOLD.md`.
   `node scripts/pipeline/lint-prompt.mjs <file>` → `ADMIT (size 4)`, **exit 0**. First attempt was
   `REJECT [MISSING_STANDING_AUTHORITY]`; I added the verbatim standing-authority sentence and
   re-linted to ADMIT. Untracked — **Station 00 must commit it or it is not staged.**
2. **Advanced the sweep rotation.**
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-21T06:11:39Z` → exit 0,
   `advanced: last_index=3 last_run_utc=2026-09-21T06:11:39Z`. Next sweep is **gate-liveness**.
   **`docs/pipeline/sweep-rotation.json` is LEFT DIRTY in the dev tree (` M` in `git status`) —
   Station 00 commits it, because I may not.**
3. **This breadcrumb.** Untracked at a tracked path until Station 00's next board PR commits it.

Nothing else. No board mutation, no merge, no label, no arm, no rename, no `sot/` edit, no commit.

## FINDINGS

### F1 — `lint-station.mjs` compares the wrong version field and prints an instruction that would send every station READ-ONLY (S2)

The linter's closing NOTE compares each station doc's **`station_doc_version`** against the
**canonical `station-contract` version**. Line 170 builds the map from `station_doc_version`; line
222 filters it against `canon['station-contract'].version`. Those are different quantities that have
never been equal, so the filter matches **all seven** station docs on every run:

```
NOTE    contract is v3; these declare a different station_doc_version:
          docs/pipeline/stations/00-supervisor.md -> v1
          ... all seven ...
          the scheduled-task bootstrap must declare the same number, or the run goes read-only
```

**Why S2.** The PREFLIGHT block byte-identical in all seven station docs orders: *"If doc version and
bootstrap disagree, say so in your first line and run READ-ONLY for the rest of the run."* The NOTE
tells the reader the bootstrap must declare **3**. Every bootstrap declares **1**, correctly matching
its doc. A station that obeys the printed line compares 1 against 3, finds a mismatch that does not
exist, and surrenders write authority for an entire run. **The drift-detection tool is itself
emitting an instruction this pipeline has disproved** — the precise failure class this sweep exists
to catch.

It is silent: the linter exits **0** and prints `ADMIT: all 8 docs clean` on the same run, and it
runs in CI at `.github/workflows/ci.yml:229`, so CI is green while the false NOTE scrolls past.

**Second half — `contract_version` is a dead, stale field.** It is read in exactly one place, a
presence/integer check at line 122; nothing ever compares its value. All seven docs declare
`contract_version: 1` while the recorded contract is **v3**. The field that should track the
contract has sat two versions behind, unvalidated, since the contract moved.

Five angles: (1) reproduced twice, byte-identical. (2) source confirmed at
`scripts/pipeline/lint-station.mjs:170` and `:221-227`, lines read directly. (3) violates the
PREFLIGHT read-only rule in the canonical station-contract block. (4) history — no open PR, staged
prompt or HOLD covers it; the three `lint-station` mentions in `docs/pr-prompts/`
(`queue-watch-state.md:289,346,391`) record ADMIT counts only, and
`pr-queue-layout-sot-entry-HOLD.md:6,57` merely invokes the command. (5) blast radius — all seven
station docs, i.e. every station on every run.

**DISPOSITION: DISPATCHED** — to **Station 00**, as
`docs/pr-prompts/pr-lintstation-contract-version-compare-HOLD.md`, lint `ADMIT` exit 0. 00 arms it
on Marco's authority; I armed nothing. **The HOLD is untracked — if 00 does not commit it, it does
not exist.**

### F2 — DOCTRINE's two illustrative review files no longer exist anywhere (S4)

`docs/pipeline/DOCTRINE.md` cites `?? docs/pr-reviews/pr-1850-review.md` and
`?? docs/pr-reviews/pr-1852-review.md` as a worked example of untracked review files. Both are now
**absent entirely** — not tracked on `origin/main`, not on disk. PR #2026 published 33 settled
verdicts covering #1869–#2011; 1850 and 1852 fall below that range and were never published.

The citation is past-tense — a record of what `git status` showed at the time, not a path any
station must open — so nothing breaks. But the example can no longer be verified by a reader, which
is the property that makes illustrations in binding documents decay into folklore.

**DISPOSITION: DEFERRED** — real, not now. It becomes urgent if anyone rewrites that DOCTRINE
passage and needs the example to still hold, or if a station is ever told to *read* those paths
rather than merely recognise their shape. The fix is a one-line edit substituting a surviving
example; it does not deserve an agent run of its own and should ride along with the next DOCTRINE
edit.

## WHAT I DID NOT DO

- **Armed nothing, merged nothing, renamed nothing, moved nothing, deleted nothing.** Station 04 is
  read-only on the board. One HOLD staged, which arms nothing (no watcher glob matches `-HOLD.md`).
- **Did not commit** the rotation advance, the HOLD or this breadcrumb. The dev tree is on `main`
  and nobody commits to `main` directly; the authority matrix gives 04 *Create a PR: NO*. All three
  are named above for Station 00.
- **Did not mint a worktree.** Read `origin/main` with `git show` at a named SHA throughout, per the
  2026-08-24 supersession of the clean-worktree block.
- **Did not run `git` through the device bridge against the Windows `.git`.** The guard was installed
  first; all `git` ran inside the `-File` PowerShell scripts on the Windows host.
- **Did not touch the other three sweeps** (gate-liveness, instrument-honesty, repo-hygiene). One
  named sweep per run, covered completely, then rotate. `gate-liveness` is next.
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site visual patrol).** The rotation
  assigned instruction-drift and the station doc says cover ONE sweep completely rather than skim
  everything; the board was also mid-build (watcher build in flight, #2028 open and moving) and
  reading it further would have been noise. `status-sweep` output is recorded above for 00.
- **Did not touch the watcher clone, the orphaned `po-vg` worktree, or the registry escapee.**
  Station 03's lane, and `po-vg` holds uncommitted work that `--force` would destroy.
- **Did not claim `main` is green.** Four checks were still running on `f885dc04`; that is
  `[CANNOT MEASURE]`, not a pass.
- **Did not touch Azure, Entra or SharePoint.** Nothing in this sweep went near them.

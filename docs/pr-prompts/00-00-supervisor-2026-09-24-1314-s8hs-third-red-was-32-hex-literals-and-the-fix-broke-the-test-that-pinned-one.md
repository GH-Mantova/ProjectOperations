# Station 00 — Supervisor | 2026-09-24T13:14Z–2026-09-24T13:40Z

## GROUND

```
UTC            2026-09-24T13:15:03Z
origin/main    012f602f            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ 012f602f     C:\ProjectOperations2   (0 ahead, 0 behind)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

**Version check: MATCH.** This run is **SIGHTED** — a Windows host shell was reached on the first
keyword `ToolSearch` and every `[MEASURED]` claim below came from it.

## WHAT I MEASURED

**Host reach (PREFLIGHT step 1).** `[MEASURED]` `start_process` shell `powershell.exe` →
`2026-09-24 13:14` / `LAPTOP-E6NHU4E4`, then `git rev-parse --short HEAD` → `012f602f`. **Not blind.**

**vm-git-guard installer (PREFLIGHT step 1).** `[MEASURED]`
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` — headline
`vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`, last line
`PATH="/sessions/eloquent-jolly-gauss/.local/bin:$PATH" git <args>`, **EXIT CODE 2** read from the
installer itself (`echo "EXIT CODE: $?"` directly after it, no pipeline appended — the 2026-09-22
mis-read). That is the documented middle outcome: a FINDING, not a STOP. **No `git` was run through
the device bridge against the mount at any point this run** — every git call went to the Windows host.

**Freshness of the binding documents (PREFLIGHT step 2).** `[MEASURED]`
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md`
→ **EMPTY**. All three are byte-equal to `origin/main`, so reading them from the working copy is sound
this run. No piped hash was taken (§9.1 forbids `git show | git hash-object --stdin` under
`powershell.exe`). All three were read in full: DOCTRINE 2841 lines, STATION-CAPABILITIES 592,
00-supervisor 1660.

**Sweep (PREFLIGHT step 4).** `[MEASURED]` `status-sweep.ps1` captured to a file and decoded
**`utf16le`** (§9.3 — `*>` writes UTF-16LE; the first decode attempt as UTF-8 produced a
`Unexpected token '\ufeff'` crash, i.e. it failed LOUD). 834 lines. Section 0 controls both `[LIVE]`:
`gh CAN reach GitHub (saw merged PR #2163)`, `node runs`. No `[BROKEN]`.

| sweep line | value |
|---|---|
| OPEN PRs | **3** — `#2164` BLOCKED 11/3/1, `#2158` BLOCKED 13/2, `#2148` BLOCKED 13/2 |
| main CI on `012f602f` | 4 success / 0 failed / 0 running — **trunk green** |
| watcher node | RUNNING pid 42212; wrapper alive (2); heartbeat 24 min |
| armed (`*-ready.md`) | **0** at run start |
| `git index.lock` dev/clone | False / False |
| git processes touching our trees | **0** |
| backlog | ready=1 needs-marco=2 blocked=4 broken=0 |
| **section 7 verdict** | **`SAFE TO ACT`** |

**`check-breadcrumb.mjs --freshness`, exit 0, `CLEAN`.** `[MEASURED]`

```
00  last 2026-09-24T12:14:00Z  1.1h ago  (cadence 1h)   ok
02  dispatch-only — no cadence to miss
03  last 2026-09-23T23:04:00Z  14.3h ago (cadence 24h)  ok
04  last 2026-09-24T10:40:00Z  2.7h ago  (cadence 4h)   ok
05  last 2026-09-23T14:23:00Z  22.9h ago (cadence 24h)  ok
structure: 4 checked, 0 malformed, 0 skipped
```

**The `lastRunAt` cross-check — all four stations fresh AND aligned.** `[MEASURED]`
`list_scheduled_tasks`: `00` `5 * * * *` `lastRunAt 2026-09-24T13:14:09Z` (this run) ·
`03` `0 9 * * *` `23:02:54Z` vs its 23:04Z breadcrumb · `04` `0 */4 * * *` `10:09:46Z` vs its 10:40Z
breadcrumb · `05` `10 0 * * *` `2026-09-23T14:22:41Z` vs its 14:23Z breadcrumb ·
`weekly-security-audit` `enabled: false`. Every station's newest breadcrumb sits just after its
`lastRunAt`, which is the healthy row of the contract's table. **No station is SILENT and none needed
a transcript read.**

**Both real reds on `#2164`, from the job log and not from the diff (YOUR LIMITS 6).** `[MEASURED]`
`gh pr checks 2164 -R GH-Mantova/ProjectOperations` at 13:22Z → 3 fail. Two are
`Approval receipt (CP-26)` and `PR gates — diff checks`, which is §9.4's documented one-cause pair.
The third, **`Pipeline — watcher + linter tests`**, was a real defect. Its log (5533 lines, read with
the tab-split so column 1's job name cannot match — §9.1) ends:

```
  GREW   apps/web/src/pages/tendering/ScopeWasteTab.tsx  8 -> 40
##[error]apps/web/src gained a hard-coded colour literal. Use a token from
         apps/web/src/styles/tokens.css instead of a hex - sot/01 SECTION 5.
##[error]Process completed with exit code 1.
```

**Reproduced locally with both control directions.** `[MEASURED]` in a disposable worktree off the
PR head: `check-hex-ratchet.mjs --check --base <origin/main's baseline>` → **exit 1** with the same
`GREW` line before the fix, **exit 0** (`no file grew, no new file carries one`) after it. The
baseline blob had to be dumped with node, not `>` — the `>` form wrote UTF-16LE and the ratchet
refused it as `hex ratchet is broken, not passing`, which is a tool failing loud (§7) rather than
quiet.

**My own first count of the literals was WRONG and I am saying so rather than quoting it.**
`[MEASURED]` a hand-rolled `node -e` scan printed 10 matching lines and then **returned before its
own total** — §9.1's early-return, with the two summary `console.log`s simply absent at exit 0. Re-run
writing to a FILE, using the ratchet's own rule (`#` not preceded by `&`, then 3/4/6/8 hex digits),
it returned **40**, which agrees with the gate exactly. **Had I trusted the first reading I would have
"fixed" 10 of 40 and re-pushed a still-red PR.**

**Why dropping the fallbacks alone was not available.** `[MEASURED]` of the token names the PR's
`var(--token, #hex)` fallbacks refer to, **most are not defined in `tokens.css` at all**:
`--surface-muted` ABSENT · `--border` ABSENT · `--status-danger-bg` ABSENT · `--status-warning-bg`
ABSENT · `--ok-border` ABSENT · `--ok-bg` ABSENT · `--ok-text` ABSENT · `--status-accent` ABSENT ·
`--text` ABSENT; only `--surface-card`, `--surface-subtle`, `--border-default` and `--text-muted` are
real (54 tokens defined in total). **So the hex was load-bearing** and deleting it would have rendered
those elements unstyled — the cheap-looking fix was the breaking one.

**The substitute needle for the broken test was chosen by measurement, and the obvious one was
wrong.** `[MEASURED]` over `ScopeWasteTab.tsx`, route guard at offset 65677, fallback guard at 59106:

| needle | count | firstAt | after route guard | inside fallback slice |
|---|---|---|---|---|
| `ok-border` | 0 | -1 | n/a | no |
| `"Geoapify route"` | 3 | 55128 | **NO** | **YES** |
| `var(--status-active)` | 3 | 67640 | yes | no |

`"Geoapify route"` is the intuitive replacement and it would have satisfied the positive assertion
while silently breaking the `not.toContain` one. `var(--status-active)` has exactly the two properties
the removed needle had.

**No other test pins anything this run changed.** `[MEASURED]` a sweep of `apps/web/src`, `tests/`,
`e2e/` and `playwright/` for all 18 changed strings: 284 hits across ~250 files, **none of them a test
asserting on the strings I changed** except the one I fixed. NEGATIVE control, a needle minted for
this run → **0 files**; POSITIVE control `status-active` → **22 files**. The 284 are the registered
theme-migration debt (D24, `docs/plans/theme-system-plan.md`), deliberately untouched.

**The CP-26 verdict TOKEN, not the counts (§9.4).** `[MEASURED]` from column 3 of job 107656015530:
`FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true). A
human must review and REMOVE the label`. POSITIVE control `CP-26` in the body → 2; NEGATIVE control,
a minted needle → 0. **`[LABEL_PRESENT]` = parked by design, no agent-side action.**

**`#2164` after both pushes.** `[MEASURED]` `gh pr checks 2164` at 13:38Z, head `8073b250`:
`Pipeline — watcher + linter tests` **pass** (was fail), `Web — lint, logic tests, vitest, build`
**pass** (was fail), 11 other checks pass, 2 pending (`API — lint, test, compliance smoke`,
`tendering-e2e`), and **the only two fails are CP-26 and the diff-checks job it runs inside**.

**Two breadcrumbs the validator calls UNTRACKED are tracked, under `archive/`.** `[MEASURED]`
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` (trailing slash AND `-r`, §9.2) returns
`archive/…-0814-…md` and `archive/…-0915-…md`; POSITIVE control, the 1214 breadcrumb at depth 1 → 1
row; NEGATIVE control, a minted needle → 0. Byte identity of the loose root copies against those
blobs, by the sound forms and no piped hash: `git hash-object <root>` vs
`git rev-parse origin/main:<archive path>` → `377e4afe…` = `377e4afe…` and `183c7eb5…` = `183c7eb5…`,
**MATCH on both**.

**Premise of the prompt I armed, live, with both controls.** `[MEASURED]`
`git grep -c "SPACED_PATH_CANDIDATES_V1" origin/main -- scripts/pr-watcher/verdict-guard.mjs` → no
output, exit 1 ⇒ **premise TRUE, work outstanding**; POSITIVE control `PATH_TOKEN_RE` in the same file
→ **3**, exit 0; NEGATIVE control, a minted needle → exit 1. `lint-prompt.mjs` → **ADMIT, exit 0**.

**No concurrent Station 00, measured rather than assumed.** `[MEASURED]` host clock
`2026-09-24T13:35:28Z` against `list_scheduled_tasks`'s `00-supervisor nextRunAt 2026-09-24T13:14:52Z`
… `lastRunAt 2026-09-24T13:14:09Z` — `lastRunAt` is still this run and the next occurrence is ~38
minutes out. I had mis-tracked the clock and was one step from writing an LL-38 collision into this
report; the clock read refuted it. **Safe-to-act was re-measured at 13:35:28Z immediately before the
arm**: `indexlock_dev=False`, `indexlock_clone=False`, `gitprocs=0`, `git diff --cached` EMPTY,
armed=0.

## WHAT CHANGED

**1. `#2164` driven from three reds to two — and the two that remain are Marco's label.** Two commits
pushed to `feat/s8h-waste-travel-index-ui`, each built in its own disposable worktree off the PR head
on the Windows FS, never the dev tree and never `C:\po-watcher`; both torn down.

- **`beb3894f`** — `fix(web): ScopeWasteTab uses existing design tokens, not hex literals`. All **40**
  literals mapped to tokens that **already exist**; no token invented, no new literal added to any
  file, so no file's ratchet count can grow. The edit ran from a `.mjs` file on disk (§9.1) using
  `split`/`join` and never `String.replace` (§9.3's `$`-in-replacement trap), asserting the byte
  delta: `expectedDelta=120 actualDelta=120 MATCH=true`, line count unchanged, and every one of the
  15 rules matched at least once (no `ZERO` row, so nothing was silently skipped).
  Read back: the file's literal count is **0**, down from 40 against a baseline allowance of 8.
- **`8073b250`** — `test(web): re-point the route-chip source assertion at the token it now carries`.
  Byte delta asserted (`14`/`14`), **67 assertions before and 67 after** — nothing weakened, nothing
  removed — `ok-border` remaining: 0.
- Both pushed via `Invoke-GitPush` (DOCTRINE §1), which read the remote SHA back and proved it ours:
  `beb3894f` then `8073b250`.

**2. Armed `pr-verdictguard-spaced-path-candidates`.** `[MEASURED]` `arm-prompt.ps1 -Actor station-00`
**exit 0** through the serialising lock: `Lock acquired (PID 32008)` → index clean before → RULE 4 no
other prompt armed → lint ADMIT → rename → `Index contains exactly the two expected paths` →
`Audit line written` → `ARM_INDEX_RELEASED` → `Index clean after release` → lock released. Read back:
`-ready.md` **True**, `-HOLD.md` **False**, armed **0 → 1**, and the log's last line is
`2026-09-24T13:35:34Z  ARMED  pr-verdictguard-spaced-path-candidates  escalates=true  actor=station-00`.

**3. Board PR — one docs-only PR, built in a disposable worktree** (`C:\po-worktrees\board-00-1314`,
branch `board/00-collect-2026-09-24-1314`, off `origin/main` at `012f602f`):

- `docs/pr-prompts/.arming-log.txt` — this run's arm published. `git diff --numstat origin/main` read
  **`1 0`** (insertions, zero deletions) = the strict-superset shape, so it was copied **byte-exact as
  a raw Buffer** from the dev tree **after** the arm (`srcBytes=25784 dstBytes=25784 byteExact=true`,
  155 lines) and **never restored from `HEAD`**, which on an append-only log destroys local-only lines
  (the 2026-09-06 `actor=marco-delegated` loss, §9.5).
- The arm committed as a **`git mv`** of the tracked `-HOLD.md` to `-ready.md` (`R100`), never a
  creation — `.gitignore` swallows a created `*-ready.md`.
- `docs/pr-prompts/pr-scopecards-s8h-traffic-index-ui-ready.md` **deleted**: the watcher consumed it
  and opened `#2164` from it. Restoring it instead would re-arm a consumed prompt, which is §9.2's
  named hazard; the 12:14Z run set the precedent for committing the deletion of a spent prompt.
- Archived, now that every finding in each carries a disposition:
  `00-00-supervisor-2026-09-24-1214-…` and `00-04-scanner-2026-09-24-1040-…`.
- This breadcrumb, written **inside the PR worktree** (cure 1), so no loose copy exists in the dev
  tree and the post-merge fast-forward cannot trip on it.

**4. Deleted the two loose untracked root copies** of the 0814 and 0915 breadcrumbs from the dev tree,
after proving each byte-identical to the `archive/` blob already on `origin/main`. See F4.

**Nothing else was mutated.** No PR merged, no label touched, no watcher restarted, no worktree
pruned, nothing in `/sot/`, no production data, no Azure / Entra / SharePoint.

## FINDINGS

### F1 — `#2164`'s third red was a real defect: the S8h build added 32 hard-coded colour literals

`GREW apps/web/src/pages/tendering/ScopeWasteTab.tsx 8 -> 40`, against `sot/01` SECTION 5 and the
`check-hex-ratchet` gate. Most were `var(--token, #hex)` fallbacks whose token does not exist, so the
hex was load-bearing.

🔴 **The gate's own error message offers the mask.** It ends *"If you are BURNING DOWN, regenerate the
baseline in this PR: `check-hex-ratchet.mjs --generate > docs/qa/hex-baseline.json`"*. On a PR that
**added** literals that is not a burn-down, it is buying your way out — and the ratchet's `--check`
runs its rule twice precisely to stop it (comparison B). DOCTRINE §8.2 forbids it in as many words:
*"a quick fix is ONLY EVER a legitimate unblock — NEVER a mask"*. It would also have passed CI.

**DISPOSITION: ACTIONED.** Every literal mapped to an existing token; `--check` against
`origin/main`'s baseline now exits **0**, and the same command exited **1** with the `GREW` line
before the change, so the instrument was seen to fail and to pass. Byte delta asserted on the edit.

### F2 — the fix broke a source-assertion test that located the chip by its colour name, and CI is what caught it

`waste-travel-index.test.tsx > fallback does NOT show Geoapify route chip` locates the route chip by
the literal `"ok-border"`. That name was never a real token, so removing it made `indexOf` return -1
and the test failed `expected -1 to be greater than -1`. **The web job had PASSED before my change and
failed after it** — I introduced this red.

⚠️ **Worth recording for the next run: `gh run view --job --log` REFUSES while the run is still in
progress** (*"logs will be available when it is complete"*, 428 bytes, exit 1), and the natural next
move is to wait or to guess. `gh api repos/<owner>/<repo>/actions/jobs/<job_id>/logs` returns the
finished job's log mid-run, and is what produced the diagnosis here.

**DISPOSITION: ACTIONED.** Needle re-pointed to `var(--status-active)`, chosen by the three-row
measurement above rather than by eye; 67 assertions before and after, none weakened. Read back from
CI, which is the instrument that decides (§2): `Web — lint, logic tests, vitest, build` **pass**.

### F3 — nine token names are referenced across the web app but defined nowhere, so the "fallback" is the only thing rendering

`--surface-muted`, `--border`, `--status-danger-bg`, `--status-warning-bg`, `--ok-border`, `--ok-bg`,
`--ok-text`, `--status-accent` and `--text` are all ABSENT from `tokens.css` (measured against its 54
definitions). Every `var(--undefined, #hex)` in the app is therefore a hex literal wearing a token's
clothes: it counts against the ratchet, it does not track the dark theme, and a reader converting it
by dropping the fallback — the obvious reading — **unstyles the element**.

Scale, `[MEASURED]`: 284 hits across ~250 files under `apps/web/src`; `var(--text)` alone in ~30
files; `--status-accent` in 4. Within `ScopeWasteTab.tsx` **6** uses of
`var(--status-accent, var(--brand-secondary))` remain, where **both** names are undefined, and **7**
equivalent uses are already on `origin/main`.

**DISPOSITION: DEFERRED**, and deliberately not bundled. These are pre-existing on `main`, are not hex
literals, are not `#2164`'s defect, and folding ~250 files into a Marco-gated diff is the opposite of
what §8.2 asks for. This is the registered theme-migration campaign (D24,
`docs/plans/theme-system-plan.md`), whose own header records that it *"cannot outrun its own target"*.
It becomes urgent the moment someone converts a `var(--undefined, #hex)` by deleting the fallback —
which is what the ratchet's error message invites — because that renders as unstyled with nothing
warning. 🔧 **The cheap complete-and-additive move, for whoever owns D24: define the nine missing
names in `tokens.css` as aliases of existing tokens (`var(--surface-page)` and friends), which adds
zero literals and retires the whole class at the source.** That is a design-system change and is a
decision for Marco or 06, not something a collect run should take unilaterally.

### F4 — `check-breadcrumb.mjs` reported two breadcrumbs as reaching nobody while `origin/main` holds both

`--freshness` printed `NOTE  …-0814-…md is UNTRACKED — it reaches nobody until a board PR commits it`
and the same for `-0915`. Both are tracked on `origin/main` under `archive/`, landed by the 12:14Z
run. The NOTE is literally true of the depth-1 PATH and false in its stated consequence, and
**believing it commits a second tracked copy at the root path** — the 2026-09-07 duplicate this class
of probe exists to prevent, reached through the validator's own wording. The station doc already
records the mechanism (*"archiving one leaves the same untracked copy, which the next run commits
back"*); what this run adds is that the VALIDATOR now states the wrong consequence out loud, so a run
does not even have to reason its way there.

**DISPOSITION: ACTIONED** for this instance: I asked `origin/main` rather than the dev tree's index,
proved byte identity both ways, and **deleted the two loose root copies** instead of committing them —
which also removes two future fast-forward blockers. The wording defect in
`check-breadcrumb.mjs` is **DEFERRED**: it is a one-line change to say *"untracked at this path"* and
to stay silent when the basename is tracked anywhere in the tree, and it belongs in a PR of its own
rather than inside a collect commit.

### F5 — the board sat at armed=0 with a live idle watcher and exactly one clean candidate

`triage-holds.ps1`: HOLD=16, ready=0, spent=0, gates-satisfied=**2**, still-gated=14. Of the two
ADMITs, `pr-fv2-formrule-contract-HOLD.md` is on the **never-arm list** in this station's own doc and
is flagged a possible duplicate of open `#2158` (9 of 12 scope entries) — not armable on two
independent grounds. The other, `pr-verdictguard-spaced-path-candidates`, is clean: premise verified
TRUE live with both controls, lint ADMIT, body read end to end (no `watcher: do-not-arm`, no
`DO NOT ARM`, no `Arm ONLY`, and no prose gate — it carries explicit STANDING AUTHORITY to open the
PR), on no denylist, scope two files under `scripts/pr-watcher/`.

**DISPOSITION: ACTIONED.** Armed at `13:35:34Z`, both read-backs true, audit line written, and the
rename plus the log committed in this run's board PR. `escalates: true`, so the watcher will apply
`do-not-merge` and the merge is Marco's — that gates the merge, never the run (§5b).

### F6 — the consumed S8h prompt was left as an unstaged deletion in the shared dev tree

`git status --porcelain --untracked-files=no` opened this run with
` D docs/pr-prompts/pr-scopecards-s8h-traffic-index-ui-ready.md`. The watcher consumed it and opened
`#2164`. A deleted tracked file blocks `git merge --ff-only` exactly like a modified one, while
`git diff --numstat` and `--cached` can both read EMPTY.

**DISPOSITION: ACTIONED.** The deletion is committed in this run's board PR. It was **not** restored:
restoring a consumed prompt re-arms it, which is the §9.2 hazard, and the 12:14Z run set the
precedent by committing the spent S8g deletion the same way.

### F7 — carried forward unchanged: the orphaned worktree still holds two uncommitted files

`C:/po-worktrees/sup-cwd-paths` @ `66ac4dcd`, branch
`fix/pipeline-scripts-resolve-state-paths-from-module`, `[LIVE]` this run's sweep at 13:18Z:
**dirty=2 files, age 344 min**. Its PR `#2154` merged 08:35Z, so the branch is spent while two files
in it are in no commit anywhere. `git worktree remove` will refuse and `--force` discards them
silently. `C:/po-wt/fv2drop` @ `817339c3` is dirty=0 and carries no such risk.

**DISPOSITION: DISPATCHED → Station 03 (machine-minder, next occurrence 2026-09-24T23:02Z).** This is
*Repair the machines*, 03's row; 00 doing it is LL-38. **Restated here in full because the 12:14Z
breadcrumb that first raised it is being archived by this run's PR, and a dispatch must not be
reachable only from `archive/`.** In order: (1) `git -C C:/po-worktrees/sup-cwd-paths status
--porcelain` and **list the two files in your breadcrumb before touching anything**; (2) if they hold
real work, commit them to a branch and open a PR, or copy them out — they are unrecoverable
otherwise; (3) only then prune, and **never with `--force`** while dirty. ⚠️ `[LIVE]` means true when
measured: re-measure the dirty count and age immediately before acting. `C:/po-wt/fv2drop` may be
pruned without ceremony.

### F8 — the board's only real constraint is Marco's label, and it now holds three PRs

All three open PRs carry `do-not-merge` with the description *"escalates:true - Marco merges this, not
automation (DOCTRINE 5b)"*, and each shows exactly two reds from that one cause — CP-26 as the
required check and again as a step inside the diff-checks job. `#2164`'s CP-26 verdict token is
`[LABEL_PRESENT]`, read from column 3. There is no CI defect left to fix on any of them, no conflict
to resolve, and no check to re-run.

**DISPOSITION: ESCALATED — for Marco, see `## FOR MARCO`.**

### F9 — the device-bridge git guard installed INERT again, as designed

Exit **2**, `INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell`, with the
installer's own controls showing `bash -lc` resolving the shim and `bash -c` resolving `/usr/bin/git`.
This is the expected outcome for a station, not an anomaly: the `PATH` export lands in `~/.bashrc` and
`~/.profile` and a non-interactive non-login shell sources neither.

**DISPOSITION: DEFERRED** — quoted as the contract requires, and nothing to act on. The ban was kept
by memory: no `git` ran through the bridge against the mount this run. It becomes urgent only if a
station ever reads INERT as a licence.

### F10 — I built an instrument, could not make it fail, and threw the reading away

Before pushing I ran the edited `.tsx` through `esbuild` as a parse check. It exited 0. I then tried
to make it fail: the first negative control failed for the wrong reason (path resolution, not syntax),
and the second — a copy of the same file with `export` doubled — **also exited 0**. A check never seen
to fail is not a check (§7), so the parse result is not quoted as evidence anywhere in this report and
the verification was left to CI, which is the authority §2 names.

**DISPOSITION: ACTIONED** by discarding it. Recording it because the tempting move was to keep the
green reading and mention the controls nowhere — and F2 shows CI then caught a real break that the
parse check had been silent about.

## WHAT I DID NOT DO

- **Did not merge anything, and did not touch a label.** All three open PRs carry `do-not-merge`;
  only Marco removes it. `#2164` is a PR I pushed to — driving it green is the mandate's rule 1
  exception for `escalates:true`, merging it is not available to any station.
- **Did not regenerate `docs/qa/hex-baseline.json`**, which the gate's own error message suggests and
  which would have turned F1 green in one command while leaving 32 literals on `main`.
- **Did not convert the ~250-file undefined-token class** (F3), define any new token, or touch
  `tokens.css`. Bundling a design-system change into a Marco-gated PR is not a collect run's call.
- **Did not touch the 6 remaining `var(--status-accent, var(--brand-secondary))` uses** in the same
  file. They are pre-existing on `main` (7 equivalents there), are not hex, and are not this PR's
  defect.
- **Did not arm `pr-fv2-formrule-contract`** — never-arm list, and a possible duplicate of open
  `#2158`. Did not arm a second prompt: ARM ONE AT A TIME.
- **Did not prune, enter or `--force` either orphaned worktree.** 03's lane, dispatched (F7).
- **Did not re-derive the sweep's `watcher clone: dirty=1`** and claim nothing about it in either
  direction; DOCTRINE §9.5 records that line as the surviving live instance of *provenance is not
  correctness*, and the watcher is demonstrably running and consuming work (it built `#2164` from the
  prompt armed at 12:22Z). **DEFERRED to whoever next has a reason to act on the answer.**
- **Ran no git mutation in `C:\po-watcher\ProjectOperations`** — an absolute stop — and **no `git`
  through the device bridge against the mount**, despite the guard reporting INERT.
- **Did not edit `/sot/`** (05's, CP-24), production data, or Azure / Entra / SharePoint in any form.
- **Did not restart the watcher.** RUNNING pid 42212, wrapper alive (2); a 24-minute heartbeat with an
  empty queue is idle, not wedged.
- **Did not clear any `needs-marco/` `[STALE]` row.** The sweep's section 5 emits its rows as `[FILE]`
  and says in its own text that it *cannot* decide staleness; the 47 files there need a per-file
  `gh pr view --json state,mergedAt` with a negative control. **DEFERRED, and named so it is not
  silently dropped** — this is the third consecutive run to defer it, and it is now the largest piece
  of un-owned work in the queue.

## FOR MARCO

**Three PRs are finished work waiting only on you. Nothing else on the board is blocked.**

- **`#2164`** — *feat(tendering): S8h waste travel-index UI and find-tip fix.* This one arrived red
  for a real reason and is now clean: 13 checks pass, the two remaining reds are CP-26 firing on the
  label itself. I fixed 32 hard-coded colours in it and the test that pinned one of them.
- **`#2148`** — *feat(auth): stop writing sign-in codes and reset links to the production log.* Stops
  secrets reaching a production log; touches no data.
- **`#2158`** — *feat(forms): drop five legacy FormRule flat columns.* A **destructive migration**
  (column drops), which §8.3 routes to you by design.

**RULE 1 on the one decision this run would like from you** — *always lean towards what solves the
issue completely (immediately and future) without damaging existing and/or future data entry*.
The question is F3: nine token names are used across ~250 web files and defined nowhere, so every
`var(--undefined, #hex)` in the app is a hex literal that the theme cannot reach.

1. **Complete and additive — define the nine missing names in `tokens.css` as aliases of tokens that
   already exist** (`--surface-muted: var(--surface-page)`, `--border: var(--border-default)`,
   `--text: var(--text-primary)`, and so on; the tint and "ok" cases need one judgement each). This
   adds **zero** new literals, so it cannot trip the ratchet; it makes every existing fallback
   redundant so the D24 campaign becomes a mechanical delete rather than a per-site colour decision;
   and it fixes dark mode for all of them at once. **Passes both halves: no data entry is touched at
   all, and it removes the cause rather than the symptom.**
2. Keep converting file by file, as D24 does now. Fails the *future* half — the gate's own header
   measures the debt growing faster than the slices retire it (~39 new literals a day), and this run
   is an instance: a single UI slice added 32.
3. Let runs regenerate the hex baseline when a slice adds literals. **Fails outright** — it is the
   mask §8.2 forbids, and it would have hidden today's 32 with one command.

Option 1 needs two decisions only you can make: what `--ok-*` should be (there is **no green** in the
palette at all — I used `--status-active`, the brand teal, which is what `.s7-badge--active` already
does), and whether `--status-accent` is `--status-warning` or `--brand-accent-dark`. Everything else
is an exact colour match to a token that already exists.

**Nothing in this run was blocked waiting on you.**

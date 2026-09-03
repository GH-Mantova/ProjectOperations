# Station 04 — Scanner | 2026-09-03T02:46:18Z–2026-09-03T02:52:34Z

## GROUND

```
UTC            2026-09-03T02:46:18Z
origin/main    f5c01415            (fetch --prune first, then rev-parse)
dev tree       main @ 52f985e8     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE (both `1`) — this run is READ-WRITE-eligible, and it was
**SIGHTED**: `start_process` shell `powershell.exe` returned a live prompt (PID 16196) on the
first call, no blindness at any point.

Sweep assigned by `node scripts/pipeline/next-sweep.mjs` → **`instrument-honesty`**
(rotation position 2 of 4; previous run 2026-09-02T06:10:43Z). Advanced on completion to
`last_index=1 last_run_utc=2026-09-03T02:52:34Z`.

## WHAT I MEASURED

**Preflight.** `[MEASURED]` No `.git/*.lock` in `C:\ProjectOperations2` (Get-ChildItem returned
nothing). `[MEASURED]` `git diff --cached --name-status` → EMPTY, so the shared dev-tree index
carried nothing of another chat's.

🔴 **`[MEASURED]` My own station doc's working copy is STALE against `origin/main`.**
`git diff --stat HEAD origin/main -- docs/pipeline/stations/04-scanner.md` → `17 insertions(+),
5 deletions(-)`. `origin/main` carries **`station-contract v2`** ("ship all **seven** together");
the working copy still carries **v1** ("all six"). I read the doc from `origin/main` per PREFLIGHT
step 2. `station_doc_version` is `1` on BOTH — exactly the case the doc warns about: a version
match is not a freshness proof.

### DOCTRINE §9 traps — each re-run with its control

| Trap | Documented | Re-measured 2026-09-03 @ `f5c01415` | Verdict |
|---|---|---|---|
| §9.2 `ls-tree` depth | no slash ⇒ 1 line; `-r` ⇒ deep | no-slash **1** · trailing-slash **74** · `-r` **272** | ✅ REPRODUCES |
| §9.2 `ls-tree` glob | any `*` ⇒ 0 silently, exit 0; `:(glob)` ⇒ fatal | `superseded/*.md` **0** (with AND without `-r`); POSCTRL `docs/pr-prompts/*.md` **0** against a truth of **74**; `:(glob)…` → `fatal: pathspec magic not supported`, exit **128** | ✅ REPRODUCES |
| §9.2 `check-ignore` on a dir | dir ⇒ exit 1 empty; file inside ⇒ `.gitignore:76` | dir → exit **1**, empty · NEGCTRL `CLAUDE.md` (tracked, genuinely not ignored) → exit **1**, empty · file inside → `.gitignore:76:docs/pr-prompts/processed/` · `git status` on that file → **0** rows | ✅ REPRODUCES — opposite truths, byte-identical results |
| §9.2 `git branch -r` | local cache overcounts vs remote | `branch -r` **8** vs `ls-remote --heads origin` **3** — delta **5**, *and this was after a `fetch --prune` six minutes earlier* | ✅ REPRODUCES (magnitude is state) |
| §9.3 PowerShell `>` | writes UTF-16LE, ~2× bytes, `FF FE` | `git show > file` **43522 B** vs node write **21463 B**, ratio **2.028**, first two bytes **FF FE** | ✅ REPRODUCES |
| §9.3 `-SimpleMatch` + `[regex]::Escape()` | escaped literal matches nothing | raw `reminder-policy.service.ts` → **8** hits · escaped `reminder-policy\.service\.ts` → **0** · dotless control `migrations` → **81** | ✅ REPRODUCES |
| §9.4 `gh run list --commit <SHORT>` | `[]` at exit 0 | short `f5c01415` → **`[]`, exit 0** · full 40-char → **4 runs, exit 0** | ✅ REPRODUCES |
| §9.1 early return | streamed output returns with data pending | Hit **twice** unprompted this run; drained with explicit `offset` until `0 remaining` | ✅ REPRODUCES |
| §9.5 `lint-prompt.mjs` line claims | `LINT_GH_BIN` 1 hit @1164; markers @728/730/732; `foldBlockScalar` ×2 | `LINT_GH_BIN` **1 hit, line 1164** · `LINT_GIT_BIN` **440** · `DO_NOT_ARM_COMMENT` **728** · `DO_NOT_ARM_CAPS` **730** · `ARM_ONLY` **732** · `foldBlockScalar` **2** · NEGCTRL `zzzNoSuchTokenZzz` **0** | ✅ ALL EXACT |
| §9.5 `check-breadcrumb.mjs` | `ls-tree` @:98 recursive, `readdirSync` @:160 depth-1 | `ls-tree` at **93,98** · `readdirSync` at **18,160** | ✅ EXACT |

**Nothing in §9 failed to reproduce.** Every count that moved is state (tree contents), never a
headline rule. Four claims are *incomplete* rather than wrong — see FINDINGS.

**Board state, for 00's context.** `[MEASURED]` `status-sweep.ps1`: watcher node **RUNNING pid
26656**; watcher clone `branch=main dirty=0`. I mutated nothing on the board.

## WHAT CHANGED

Two files, both left **DIRTY and UNCOMMITTED** in the dev tree for Station 00 to commit — 04 may
not commit (authority matrix: *Create a PR: NO*, *Mutate the board: NO, read-only*):

1. `docs/pipeline/sweep-rotation.json` — advanced by
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-03T02:52:34Z`
   → `advanced: last_index=1 last_run_utc=2026-09-03T02:52:34Z`, exit 0.
   **If this is not committed, the next run repeats `instrument-honesty` and the rotation stops.**
2. This breadcrumb.

**Nothing else.** No prompt armed, disarmed, renamed, moved or deleted. No PR touched. No label
changed. No `/sot/` edit. No worktree minted. Scratch files for the §9.3 probe were written under
`$env:TEMP` and removed; the repo was never used as scratch.

## FINDINGS

### F1 — `| Select-Object -First N` reports a SUCCESSFUL native command as `$LASTEXITCODE = -1` — S3, NEW, not in §9

`[MEASURED]`, five cases, one shell:

| | Command | `$LASTEXITCODE` | Truth |
|---|---|---|---|
| A | `git check-ignore -v <ignored-file>` (no pipe) | **0** | 0 ✅ |
| B | same `\| Select-Object -First 1` | **-1** | 0 🔴 |
| C | same `\| Out-String` | **0** | 0 ✅ |
| D | `git check-ignore -v CLAUDE.md \| Select-Object -First 1` (genuine failure, **no output**) | **1** | 1 ✅ |
| E | `git rev-parse --short origin/main \| Select-Object -First 1` | **-1** | 0 🔴 |

`Select-Object -First N` closes the pipeline early, which terminates the native process, and
`$LASTEXITCODE` becomes `-1`. It only fires when the command **produced output** — which is why
case D, a real failure that printed nothing, kept its true code.

**That is the dangerous asymmetry: SUCCESS reads as `-1` while FAILURE reads correctly.** Any
`if ($LASTEXITCODE -eq 0)` after such a pipeline inverts. And `-1` is the *same sentinel* as §7's
trap #3 — the spawn failure whose `-1` "wasn't in the broken-list" and would have silently binned
the whole backlog. This pipeline treats exit codes as authority everywhere (`smoke-pr.ps1` *"the
exit code decides"*, `lint-prompt.mjs` 0/1/3, `check-lessons.mjs` 0/2, `check-backlog.mjs` 10).

**Blast radius in committed code: ZERO — and I checked rather than assumed.** 6 `.ps1` files
contain `Select-Object -First`, 21 contain `LASTEXITCODE`, 4 contain both
(`arm-prompt.ps1`, `bring-up-to-speed.ps1`, `status-sweep.ps1`, `start-watcher.ps1`). Reading the
actual adjacency (±3 lines) in all four: **0 ADJACENT hits.** Every native-command instance
captures *output*, never the exit code — `status-sweep.ps1:98` (`git rev-parse`),
`start-watcher.ps1:93` (`git stash list`); `arm-prompt.ps1:391` isn't a native command at all.
NEGCTRL `zzzNoSuchTokenZzz` → 0.

So this is an **agent-facing** hazard, not a live script defect: it bites whoever types an ad-hoc
probe, which is what every station does every run. It bit me at 02:49Z this run — I read `-1` off a
successful `check-ignore` and would have filed it as a broken instrument had I not controlled it.

**Proposed §9.1 addition** (00 or 06 to author; I am read-only):
> 🔴 **`| Select-Object -First N` on a native command poisons `$LASTEXITCODE` to `-1` — but only on
> SUCCESS.** It closes the pipeline, killing the process. A command that failed *silently* keeps its
> true code, so success and failure swap places. Use `| Out-String`, or capture to a variable and
> slice afterwards. Never read `$LASTEXITCODE` through a `-First` pipeline.

**DISPOSITION: DISPATCHED** — to Station 00, for a §9.1 canonical-block addition (hash-gated, so it
needs `node scripts/pipeline/lint-station.mjs --write-canonical`). Falsifying probe: run cases A–E
above; if B and E return 0, this note is dead.

### F2 — §9.4 blames the `-Command` layer for the `--jq` quote loss; it fires under `interact_with_process` too — S3, drift

§9.4 says escaped double quotes in a `--jq` expression *"do not survive the `-Command` layer"*, and
§10.1 adds *"it is a SHELL fact, not a `gh` one"*. §9.1, separately, exempts `interact_with_process`
from the `$`-expansion trap (*"does NOT do this, measured 2026-08-29, control `CTRL=42`"*).

Read together, a reader concludes jq quoting is safe under `interact_with_process`. **It is not.**

`[MEASURED]` via `interact_with_process` (no `-Command` layer; `CTRL=42` control passed in the same
session, so the §9.1 exemption itself re-verified):

```
gh pr list --limit 3 --json number,title --jq '.[] | [(.number|tostring)] | join(",")'
→ gh: failed to parse jq expression (line 1, column 35)
      .[] | [(.number|tostring)] | join(,)
                                        ^ unexpected token ","      exit=1
```

`join(",")` arrived as `join(,)` — identical to the documented `-Command` symptom. The cause is
PowerShell 5.1's own native-command argument handling, not the tool layer. §9.4's attribution is
too narrow and points the reader at the wrong boundary. It does at least **fail loudly**, so no
silent-wrong-value risk.

**DISPOSITION: DISPATCHED** — 00, to widen §9.4's wording from *"the `-Command` layer"* to
*"PowerShell 5.1 native-command argument passing, including `interact_with_process`"*. The
`--json` + `ConvertFrom-Json` cure is unchanged and still correct.

### F3 — §9.1's "blocked commands" list is unconditional but does not hold in an interactive session — S4, drift, plus a live wedging hazard

§9.1 and STATION-CAPABILITIES §3 both state flatly: *"Blocked commands: `net`, `sc`, `reg`,
`netsh`, `takeown`, `shutdown`."*

`[MEASURED]` Inside a `powershell.exe` session started via `start_process` and driven with
`interact_with_process`, `net` **executed normally** and returned `net.exe`'s own usage text. It was
not blocked. The blocklist governs the Desktop Commander *tool-call* layer (the command string
handed to `start_process`), not commands typed into an already-running shell.

🔴 **And the probe cost me my shell.** `netsh` with no arguments opens its own interactive
sub-prompt; PID 16196 wedged with no output and no PS prompt. I `force_terminate`d it and started
PID 18828. No work was lost, but the lesson generalises: **a "blocked" command that is in fact
reachable can hang a station's only instrument**, and a wedged shell is indistinguishable from a
slow one until you check.

**DISPOSITION: DISPATCHED** — 00, for a one-line §9.1 qualifier ("blocked at the tool-call layer;
reachable inside an interactive session — and `netsh`/`sc` with no arguments will wedge it").
Low severity, but it is a documented fact that measures false, which is the category §9 exists for.

### F4 — `next-sweep.mjs --advance` prints the exact instruction the station doc removed as forbidden — S3, drift

`[MEASURED]` `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-03T02:52:34Z` prints:

```
advanced: last_index=1 last_run_utc=2026-09-03T02:52:34Z
COMMIT THIS FILE with your breadcrumb, or the next run repeats this sweep.
```

The station doc on `origin/main` explicitly retired that instruction:

> *"This line used to read 'and commit that file with your breadcrumb', which asked 04 to do the one
> thing 04 is forbidden to do"* — 04 is *Create a PR: NO*, *Mutate the board: NO, read-only*, and the
> dev tree is on `main`, which nobody commits to directly.

**The doc was fixed; the script still tells every run to do the forbidden thing.** This is precisely
what the sweep brief calls drift: *"a trap that has been fixed upstream and still reads as live is
itself drift."* A station that obeys its most recent instruction — the one printed at it, seconds
before it writes its report — commits to `main` from a shared tree.

**Proposed fix (RULE 1, complete-and-additive first):** change the line to
`LEAVE THIS FILE DIRTY and NAME IT IN YOUR BREADCRUMB — Station 00 commits it.` That solves it
immediately *and* for the future, damages no data, and needs no station to remember an exception.
The alternative — documenting the contradiction in the station doc — fails the "future" half: it
leaves the wrong instruction in the louder channel, where a fresh run with no memory meets it first.

**DISPOSITION: DISPATCHED** — 00, one-line change to `scripts/pipeline/next-sweep.mjs`.

### F5 — dev tree is behind `origin/main` and its copy of the station contract is a version stale — S3

`[MEASURED]` dev tree `main @ 52f985e8`; `origin/main` `f5c01415`. The working copy of
`docs/pipeline/stations/04-scanner.md` carries `station-contract v1`, `origin/main` carries **v2**.
`docs/pipeline/stations/03-machine-minder.md` also differs (`5 insertions(+), 17 deletions(-)`).

No station reading the working copy would notice: `station_doc_version` is `1` in both. I read from
`origin/main` and was unaffected, but **any run that skips that step is served superseded binding
instructions** — the failure the doc records from 2026-08-29.

`[MEASURED]` The tree also holds 5 modified and 13 untracked paths under `docs/`, including a
` D docs/pr-prompts/pr-cardui-s4-plant-columns-HOLD.md` (the arm Station 00 made at 06:31Z on
09-02) and `M docs/pr-prompts/.arming-log.txt`.

**DISPOSITION: DISPATCHED** — 00, to fast-forward the dev tree and land or discard the pending
working-tree state. I did not `ff` it myself: 04 is read-only, and §9.2 forbids `checkout`/`reset`
to "get a clean read".

## WHAT I DID NOT DO

- **Did not commit, push, or open a PR.** 04 is read-only on the board; `sweep-rotation.json` and
  this breadcrumb are deliberately left dirty for 00.
- **Did not fast-forward the dev tree** (F5), and did not run `checkout`/`reset --hard`/`clean` —
  §9.2's board trap resurrects consumed prompts.
- **Did not mint a worktree.** The AUTHORITY section supersedes the old CLEAN-TREE recipe; I read
  `origin/main` with `git show` and `ls-tree` throughout.
- **Did not stage a prompt.** The sweep was instrument honesty; nothing found this run wants a
  prompt from me — F1–F4 are edits to canonical blocks and one script line, which are 00's or 06's.
- **Did not run Part 0 / Part 1 / Part 2** (static cross-layer audit, GitHub reconciliation, live
  visual patrol). The AUTHORITY section binds me to **ONE named sweep per run, covered completely**,
  and `next-sweep.mjs` named `instrument-honesty`. Rotation advanced so the next run moves on.
- **Did not re-run `netsh`** after it wedged PID 16196 (F3), and did not probe `takeown` or
  `shutdown` at all — the wedge was evidence enough and those two carry real side effects.
- **Did not touch `/sot/`, Azure, Entra, or SharePoint.**
- **`[CANNOT MEASURE]`** — the §9.5 claim that `.arming-log.txt` is the only clock dating an arm:
  the file is currently modified in the working tree by another actor, so reading it would have
  reported someone else's uncommitted state as fact. Left alone deliberately.

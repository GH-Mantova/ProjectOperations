# Station 04 — Scanner | 2026-09-14T18:10Z–2026-09-14T18:25Z

Sweep this run: **instrument-honesty** (rotation position 2 of 4).

## GROUND

```
UTC            2026-09-14T18:10Z
origin/main    49685973            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 49685973     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — full authority this run (which for 04 is read-only on the board).

Binding documents read from the dev tree working copy, which is proved identical to `origin/main`:
`git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, and `git rev-list --left-right --count origin/main...HEAD` → `0 0`. No piped-hash comparison was made (PREFLIGHT, 2026-09-04 clause).

Host clock: `PSVersion 5.1.26100.9444`, `E. Australia Standard Time`, UTC 18:12:28Z = local 2026-09-15T04:12:28. Every timestamp in this report is UTC.

Desktop Commander **0.2.50**, client `claude-code 2.1.270`. Transport for every probe below: `start_process` / `-File` as stated per probe.

Fresh negative needle minted for this run: `zzQq04Needle` + `20260915T1810` (written split so this file does not spend it for the corpora it was used against — but treat it as SPENT from now, per section 9.6).

## WHAT I MEASURED

**PREFLIGHT step 4 — sweep.** `status-sweep.ps1` captured to a file (it returns early and hides its own section 7 verdict otherwise). Section 0 instrument positive controls: `[LIVE] gh CAN reach GitHub (saw merged PR #1935)`, `[LIVE] node runs`. Section 7: `[LIVE] SAFE TO ACT`. 416 lines, 10 sections, 88 `[LIVE]` / 4 `[STALE]` / 297 `[FILE]`. [MEASURED]

**Board context.** `gh pr list -R GH-Mantova/ProjectOperations --state open` → **2** open: `#1923` (unlabelled, rates S0) and `#1920` carrying **`do-not-merge`** — Marco's, absolute. Queue depth 1: **37** `-HOLD.md`, **0** `-ready.md`. Tracked `*-ready.md` at depth 1 on `origin/main` (THE BOARD TRAP): **0** — clear. [MEASURED]

### Section 9 traps — every one re-run against the corpus its own bullet names

| § | trap | probe result | truth | verdict |
|---|---|---|---|---|
| 9.2 | `ls-tree --name-only` no `-r`, no trailing slash | **1** | 417 | REPRODUCES |
| 9.2 | same, trailing slash, no `-r` | 211 | 417 | REPRODUCES (depth-1 only) |
| 9.2 | `ls-tree` glob pathspec `superseded/*.md` with `-r` | **0** | >0 | REPRODUCES |
| 9.2 | same glob, POSITIVE control `docs/pr-prompts/*.md` | **0** | 50 | REPRODUCES — `-r` never rescues a zero glob |
| 9.2 | explicit `:(glob)` magic | `fatal: … pathspec magic not supported` | — | REPRODUCES (loud, as documented) |
| 9.2 | `check-ignore -v` on the **directory** `docs/pr-prompts/processed` | exit **1**, empty | ignored | REPRODUCES |
| 9.2 | same on `CLAUDE.md` — a genuinely NOT-ignored tracked file | exit **1**, empty | not ignored | REPRODUCES — byte-identical to the row above |
| 9.2 | same on a **file inside** that directory | exit **0**, `.gitignore:76` | ignored | REPRODUCES — only the file form answers |
| 9.2 | `git branch -r` after `fetch --prune` | **37** | 13 | REPRODUCES — `--prune` does not cure it |
| 9.3 | `\| Measure-Object -Line` on `lint-prompt.mjs` | **2282** | 2444 | REPRODUCES — off by exactly the 162 blank lines |
| 9.3 | `Select-String -SimpleMatch` + `[regex]::Escape()` on a dotted needle, corpus = station docs | ESCAPED **0** / PLAIN **3** / dotless control 156 | 3 | REPRODUCES |
| 9.3 | PowerShell `>` redirection | first bytes **`FF FE`**, 36 B for a 15-char string | UTF-8 | REPRODUCES |
| 9.3 | `*>` capturing `status-sweep.ps1` | **142,656 B**, first bytes **`FF FE`** | — | REPRODUCES — decoded `utf16le` in node, all 10 sections present |
| 9.4 | `@(ConvertFrom-Json '[]').Count` inline | **1** | 0 | REPRODUCES |
| 9.4 | `@(ConvertFrom-Json '[…4 items…]').Count` inline | **1** | 4 | REPRODUCES |
| 9.4 | assign-then-count, both above | **0** and **4** | 0 / 4 | cure WORKS |
| 9.4 | `@($r).Count` where `$r = ConvertFrom-Json ""` | **1** (phantom row) | 0 | REPRODUCES |
| 9.4 | null-guarded count of the same | **0**; control `@(1,2,3)` → **3** | 0 / 3 | cure WORKS |
| 9.4 | `gh run list --commit <8-char SHA>` | exit 0, **2 chars**, count **0** | 4 runs | REPRODUCES |
| 9.4 | same with the full 40-char SHA | exit 0, 210 chars, **4** | 4 | POSITIVE control passes |
| 9.4 | `gh pr view 999999 --json number` | exit **0**, `{"number":999999}` | does not exist | REPRODUCES — fabricated row |
| 9.4 | `gh pr view 999999 --json number,state` | exit **1**, GraphQL "Could not resolve" | — | REPRODUCES (loud, as documented) |
| 9.4 | `gh pr list --json number` from a **non-repo CWD**, no `-R` | exit **1**, **0 chars** | 2 open PRs | REPRODUCES |
| 9.4 | same +`-R`; and both forms from the dev tree | exit 0, 33 chars ×3 | 2 | all three POSITIVE controls pass |
| 9.4 | `merged` key on a `gh api …/pulls?state=closed` LIST | key **ABSENT on 10 of 10**; `merged_at` populated on **10 of 10** | 10 merged | REPRODUCES — 2026-09-07 correction holds |
| 9.4 | POSITIVE control, single `GET /pulls/1935` | `merged=True`, `merged_at=2026-09-14T17:24:31Z` | merged | correct |
| 9.4 | `--jq '.labels[].name'` single-quoted through the shell | `#1920` → **`do-not-merge`**; `#1935` → empty | correct both ways | the 2026-09-05 REFUTATION still holds — labels read correctly |
| 9.1 | single-quoted `'C:\\ProjectOperations2\\docs\\pipeline'`, corpus = the scheduled bootstraps | **0** | 17 | REPRODUCES |
| 9.1 | same needle single-backslash, double-quoted | **17** | 17 | cure WORKS; fresh-needle control **0** |
| 9.1 | `foreach ($home in @(1,2,3))` | `SessionStateUnauthorizedAccessException`, **0 rows**; `$loopVar` control → 3 rows | 3 | REPRODUCES |
| 9.5 | `STOP-WATCHER-LANE2` at `C:\po-watcher` | present, **1090 B**; `STOP-WATCHER` absent | — | REPRODUCES, path included |
| 9.5 | the same search inside the two git repos — the documented FALSE negative | **0** | 1 exists | REPRODUCES |
| 9.5 | `.arming-log.txt` two-line-count probe (the bullet's own falsifier) | working copy **116**, `origin/main` **116** | — | counts AGREE — gap closed at this SHA |
| 10.1 | `NESTED_TEST_PATHS` on `origin/main:scripts/pr-watcher/index.mjs` | **3** hits; POS `classifyPolicyFiles` **2**; NEG **0** | — | the three-form array is intact |

### The `Get-ChildItem` wildcard fixture pair — rebuilt A / B / C, truth known by construction

[MEASURED] PS `5.1.26100.9444`. Each fixture: one subdirectory level, `.log` files as stated.

| fixture | files at depth 1 | bare `-Recurse -Filter -File` | star `-Recurse -Filter -File` | bare `-Recurse -File` | star `-Recurse -File` |
|---|---|---|---|---|---|
| A — a `.log` at depth 1 | 1 | 3 | **3** | 3 | **3** |
| B — `top.txt` at depth 1, `.log` only deeper | 1 | 2 | **2** | 3 | **3** |
| C — **ZERO files of any kind at depth 1** | 0 | 2 | **0** | 2 | **0** |

The 2026-09-11 correction reproduces exactly: **fixture B cannot fail** (its star columns match its bare columns), and only fixture C — zero files of ANY kind at depth 1 — exposes the mechanism. A run that rebuilds only the prescribed A/B pair reads "this correction is wrong" and retires a live trap. [MEASURED]

Separately, the depth-1 `-Include` form: `Get-ChildItem C:\po-watcher -Include '*.log'` → **0**; `C:\po-watcher\* -Include '*.log'` → **7**. REPRODUCES exactly as documented for the no-`-Recurse` form.

### The anchor probe, stated PER DOCUMENT as the 2026-09-11 correction requires

`<file>.<ext>:<NNN>` citations across the ten binding documents at `49685973`:

| document | citations |
|---|---|
| `DOCTRINE.md` | 9 — **5× `start-watcher.ps1:160`** (the one legitimate survivor) plus 4 that are quotations of citations it retired (`ensure-watcher.ps1:10` ×2, `pr-gates.mjs:327`, `build-relationship-map.mjs:18`) |
| `STATION-CAPABILITIES.md` | **0** |
| `CLAUDE.md` | **0** |
| `00`–`06` station docs (7 files) | **0** each |

**The per-document prediction holds in every row.** The clause landed and has stayed landed; the raw DOCTRINE count is state and is not the test. [MEASURED]

## WHAT CHANGED

**Nothing on the board.** 04 is read-only; no prompt was armed, staged, renamed, moved or deleted; no PR was touched; no label was changed; nothing was merged.

One file is deliberately **LEFT DIRTY in the dev tree** and must be swept up by Station 00:

- `docs/pipeline/sweep-rotation.json` — advanced by `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-14T18:10:00Z`. Read back: `last_index=1 key=instrument-honesty last_run=2026-09-14T18:10:00Z station=04-scanner`; `git status --porcelain` → ` M`, and `git diff --numstat origin/main` → `2 2` (both instruments agree it really changed). **Station 00 commits this; 04 may not.**

This breadcrumb is untracked at a tracked path until a board PR commits it.

Scratch `.ps1` probes were written to `C:\po-sup-fix-scripts\` (the sanctioned scratch folder, outside both git repos) and the `_fx` fixture tree was removed after measurement.

## FINDINGS

### F1 — `check-breadcrumb.mjs` still calls Station 00 a two-hour station, twelve days after the one-character fix was filed. S2.

[MEASURED] at `49685973`, anchor `const CADENCE =` in `scripts/pipeline/check-breadcrumb.mjs`:

```
const CADENCE = { '00': 2, '02': null, '03': 24, '04': 4, '05': 24 };
```

NEGATIVE control, the fresh needle over the same file → **0**. `'03': 24` and `'04': 4` match their live crons; **`'00'` is the only wrong row**, and 00's live cron is `5 * * * *` — hourly.

`STATION-CAPABILITIES.md` section 6 records this defect, names this exact line as its own falsifying probe, and says in as many words *"Do not read this paragraph as the fix having landed."* I ran the probe. It has not landed. The escalation `docs/pr-prompts/needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md` has been open **12 days**; `needs-marco/` now holds **54** files.

**Why it matters, and the direction it fails in.** `--freshness` is the probe the COLLECT step is told to *start* with. With `'00': 2` it will not call 00 **SILENT** until 4 h have passed — i.e. only after **three** consecutive missed hourly runs. That is escalation #23's exact failure mode: an instrument that cannot see a missed run, failing toward not noticing. The corroborating history is in this same queue — `needs-marco/all-stations-disabled-16h-and-the-only-detector-was-disabled-too-2026-09-03.md`, `station-00-is-disabled-and-nothing-collects-2026-09-08.md`.

I am not staging a prompt for it: the change is under `scripts/`, it is already filed in `needs-marco/`, and the station brief forbids staging anything already covered by an existing finding or escalation. What this run adds is the re-measurement the escalation needs to stay alive.

**DEFERRED** — real, filed, and unfixed. What would make it urgent: any run in which 00 misses an hourly occurrence and `--freshness` reports `ok`. The cross-check that works today is `lastRunAt` from the scheduled-tasks MCP, which this defect does not touch.

### F2 — `COMMAND_LAYER_EXPANSION` did not reproduce for the third consecutive time, now stamped with the Desktop Commander version DOCTRINE asked for. S3.

DOCTRINE section 9.1's first bullet records a non-reproduction at 2026-09-11T02:2xZ and closes: *"Re-run both rows, and stamp the transport AND the Desktop Commander version, before anyone edits this bullet again."* This run is that re-run.

[MEASURED] 2026-09-14T18:1xZ at `49685973`, through `start_process` shell `powershell.exe` — the `-Command` transport this bullet's own control mandates, **never** `-File`:

| row | result | what a pre-expansion layer would have produced |
|---|---|---|
| `$CTRL=42; "CTRL-literal-is:$CTRL"` | **`CTRL-literal-is:42`** | bare `=42` → `CommandNotFoundException` |
| `foreach ($home in @(1,2,3))` | **`CAUGHT:SessionStateUnauthorizedAccessException`**, 0 rows | `ParserError` naming a filesystem path |
| markers either side of the loop | `MARKER-1`, `MARKER-2` both present | — |

So the assignment survived, the undefined-at-expansion-time name was not substituted, and the discriminator the bullet names for pre-expansion — a ParserError citing a filesystem path — did not appear. Instead the read-only-automatic-variable mechanism fired cleanly, which is section 9.1's *other* bullet working correctly.

**Stamp, which is the point of this finding:** Desktop Commander **0.2.50**, client **`claude-code 2.1.270`**, `start_process` shell `powershell.exe`, PS `5.1.26100.9444`. The 2026-09-11 entry left the cause `[CANNOT MEASURE]` and named a Desktop Commander change between 2026-09-10T10:1xZ and then as the unproved candidate; this adds a second version datapoint on the non-reproducing side.

**This is a non-reproduction, not a retirement — and I am not proposing one.** Writing `$` into a `.ps1` and running it with `-File` costs nothing, and a silent wrong value at exit 0 is the worst shape in section 9. Two runs' inability to reproduce it is not evidence it cannot happen.

**DEFERRED** — the bullet stands unqualified. What would make it actionable: a third independent station recording the same two rows on a *different* Desktop Commander build, at which point the version correlation is measurable rather than suggestive.

### F3 — I walked into section 9.6's closing rule live, and it inverted the answer exactly as written. S3.

My first run of the `SimpleMatch` + `[regex]::Escape()` probe was pointed at `docs/pipeline/DOCTRINE.md` instead of the corpus its bullet names.

[MEASURED], both corpora, same session, same needle:

| corpus | ESCAPED form | PLAIN form | available conclusion |
|---|---|---|---|
| `DOCTRINE.md` | **1** | **0** | *"the escaped form works and the plain one does not — the bullet is backwards"* |
| `docs/pipeline/stations/*.md` (7 files) | **0** | **3** | the bullet is exactly right |

Dotless control over the correct corpus → **156**; fresh needle → **0**. The inversion is caused by DOCTRINE quoting the escaped literal `reminder-policy\.service\.ts` as documentation, which is precisely the mechanism section 9.6's closing bullet records.

Worth noting because `instrument-honesty` is the one sweep in the rotation guaranteed to reach for that file, and the pull toward pointing a probe at the document that describes it is strong enough that I did it first, having read the warning forty minutes earlier. The bullet's remedy worked as soon as it was applied. No new defect — this is a confirmation, filed so the next `instrument-honesty` run sees a worked instance rather than only the rule.

Second-order note on the same bullet: `reminder-policy.service.ts`, the needle the 2026-08-30 measurement used, no longer exists anywhere under `apps/api/src` (**0** hits for both forms across **985** `.ts` files). A future run that reaches for that needle as its positive control will measure nothing in either direction, at exit 0.

**ACTIONED** — re-pointed at the corpus the bullet names and re-measured in the same run; the corrected reading is the one recorded in the table above. Verified by the dotless positive control and the fresh-needle negative control.

### F4 — The VM/mount transport was unavailable, so `vm-git-guard.sh` could not be installed. S3.

PREFLIGHT step 1 requires the device-bridge git guard to be installed at the top of the run, and requires its last line to be quoted here pass or fail. It could not run: the workspace bash transport failed on resume, create and re-resume. Quoted verbatim, as the contract demands:

> `source path /mnt/.virtiofs-root/shared/c/Users/.../uploads is under Plan9 share "c" which is not mounted; create: RPC error -1: ensure user: user epic-charming-ramanujan already exists unexpectedly ... A Windows update released September 8 prevents Claude's workspace from reaching your files.`

**A failed install is a FINDING, not a STOP** — and the hazard it guards is moot while the transport is down, because the mount that a cut-short VM-side `git` call would lock is not reachable either. Every measurement in this report was taken through Desktop Commander against the Windows host directly; no `git` was run from the VM side. This is the fifth-consecutive-run shape already recorded in `STATION-CAPABILITIES.md` section 3 under `NATIVE_FILE_TOOLS_READ_TRANSPORT_V1`, so it is not new — but the guard's own instruction is that an install nobody can see in the report is indistinguishable from one that never ran, which is why it is written here rather than passed over.

**DEFERRED** — no action available to 04, and none needed while the transport is down. What would make it urgent: the mount returning while the guard is still uninstalled, which restores the 0-byte-`index.lock` hazard that freezes every station.

### F5 — Queue-root litter: a prior run's sweep capture and two `-LOOPING.md` files are sitting untracked in the dev tree. S4.

[MEASURED] `git status --porcelain` → 16 untracked entries, of which three are not review verdicts:

- `.sweep-04-0914.txt` at the **dev tree root** — a Station 04 sweep capture from the 14:16Z run, left behind.
- `docs/pr-prompts/superseded/pr-scopecards-s0-plan-b-LOOPING.md`
- `docs/pr-prompts/superseded/pr-fix-1891-scope-cards-literal-fallbacks-trip-the-ratchet-c-LOOPING.md`

The remaining ten are `docs/pr-reviews/pr-*-review.md`, which the `rev-<N>` job writes by design and which `status-sweep.ps1`'s clone-dirty flag is separately known to miscount.

None of this is dangerous: the `-LOOPING.md` files are in `superseded/`, they match no watcher glob, and tracked `*-ready.md` at depth 1 is **0**, so THE BOARD TRAP is clear. It is named only because a sweep capture at the repo root is one `git add -A` away from being committed, and because writing the capture to `C:\po-sup-fix-scripts\` instead — which this run did — costs nothing.

**DEFERRED** — cosmetic. No agent bulk-deletes, and this does not clear the bar for spending one of my two staged prompts. What would make it urgent: the same filename reappearing after several more runs, which would mean the capture path is a habit rather than an accident.

## WHAT I DID NOT DO

- **Staged no prompt and armed nothing.** Budget was 2 staged prompts; I used 0. F1 is already filed in `needs-marco/`, and the brief forbids staging anything covered by an existing escalation. Nothing else this sweep produced is a repo change 04 may author.
- **Did not merge, label, rebase, rename or move anything**, and did not remove a `do-not-merge` label. `#1920` carries one and is Marco's; `#1923` is unlabelled but I made no lane classification for it, because 04 does not merge and a lane verdict is only as of the minute it is taken.
- **Did not commit `docs/pipeline/sweep-rotation.json`.** Left dirty on purpose and named above — Station 00 commits it. The authority matrix gives 04 *Mutate the board: NO*, and the dev tree is on `main`.
- **Did not run PART 0, PART 1 or PART 2** of the station brief (static cross-layer audit, GitHub reconciliation, live-site visual patrol). The AUTHORITY section takes ONE named sweep per run and covers it completely; `next-sweep.mjs` named `instrument-honesty` and that is what this run did. `gate-liveness` is next in the rotation after this advance wraps.
- **Did not mint a throwaway worktree.** Every `origin/main` read used `git show` / `git rev-parse` / `git diff --numstat` against the dev tree, per the AUTHORITY section and the superseded clean-tree block.
- **Did not re-prove every section 9 bullet.** Not covered this run: the node `String.replace()` `$`-substitution trap, the CRLF front-matter parser, the `gh run view --log` three-column trap, the `extractPrNumber` prose-scrape, the three-homes review-verdict rule, and the two `status-sweep.ps1` `[LIVE]`-line derivations. They want a live PR or a live loop to exercise honestly, and a fabricated one would measure the fixture rather than the trap.
- **Did not treat `gh run list --branch main` as refuted.** It returned 5 fresh rows (newest `2026-09-14T17:24:34Z`, ~50 min old) agreeing with the per-commit reading, so the documented staleness did not appear today. That bullet says the command *can* be days stale, which one fresh reading cannot falsify. Trunk at `49685973` is genuinely green: CI, Deploy, Tendering Browser Smoke and CodeQL all `success`, with no Dependabot run attributed to this commit.

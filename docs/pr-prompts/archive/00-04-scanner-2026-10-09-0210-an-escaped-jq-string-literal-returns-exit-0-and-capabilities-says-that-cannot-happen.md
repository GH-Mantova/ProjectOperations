# Station 04 — Scanner | 2026-10-09T02:10Z–2026-10-09T02:4xZ

## GROUND

```
UTC            2026-10-09T02:10:00Z
origin/main    abbdc89c            (fetch first, then rev-parse)
dev tree       main @ abbdc89c      C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE — this run was not restricted to read-only on that account.
Sweep taken this run: **instrument-honesty** (rotation position 2 of 4), assigned by
`node scripts/pipeline/next-sweep.mjs`, not chosen.

## WHAT I MEASURED

**Preflight.**

- [MEASURED] Windows host reachable. `start_process` shell `powershell.exe` after ONE keyword
  `ToolSearch` for `desktop-commander` (ids were deferred; they were read from the search result,
  not assumed). First call returned `main` and `2026-10-09 02:10 UTC`. **This was a SIGHTED run.**
- [MEASURED] git guard installed, **exit 2 — INSTALLED BUT INERT**, the expected station outcome.
  Last line, verbatim:
  `   PATH="/sessions/determined-fervent-goldberg/.local/bin:$PATH" git <args>`
  Headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
  Controls it printed: `bash -lc 'command -v git'` → the shim;
  `bash -c 'command -v git'` → `/usr/bin/git`. So the device-bridge git ban is REMEMBERED, not
  mechanical, for this shell. No `git` was run through the device bridge against the Windows `.git`
  this run; every `git` call below ran in `powershell.exe` on the host.
- [MEASURED] All three binding documents read from `git show origin/main:<path>` in the **dev tree**
  `C:\ProjectOperations2`, never the working copy, never the watcher clone.
- [MEASURED] `status-sweep.ps1` exit 0, section 0 positive controls both `[LIVE]`, no `[BROKEN]`.
  Verdict: **SAFE TO ACT**. Board: 1 open PR (#2261, BEHIND, 13 pass / 2 fail, `do-not-merge`,
  open 47h — Marco's). Trunk green on `abbdc89c` (4 success / 0 failed). Watcher RUNNING pid 8848,
  heartbeat 33 min, no build in flight, board lease free. Armed `*-ready.md`: **0**.
- Instruments: `gh version 2.90.0 (2026-04-16)`, `git version 2.56.0.windows.2`.
- Fresh needle minted this run (§9.6): `SCANNERNEEDLE20261009ZQXJ7`. Confirmed absent from every
  corpus probed (negative controls below).

**The sweep: each §9 trap, run against the query that lies.**

| # | §9 claim | reading | verdict |
|---|---|---|---|
| P1 | §9.6 — a non-recursive `ls-tree` is blind to nested paths | `git ls-tree --name-only origin/main docs/` → **35** lines, all directory entries; `-r` → **2102**; the non-recursive form finds `docs/pipeline/DOCTRINE.md` **0** times | **REPRODUCES** |
| P2 | §9.2 — `git status` is structurally blind to gitignored files | wrote `docs/qa/qa-run-<needle>.md`; `git status --porcelain` → **0** mentions; `--ignored` → **1** (positive control); `check-ignore -v` → `.gitignore:119:docs/qa/qa-run-*.md` (positive control). File removed, `Test-Path` → False | **REPRODUCES** |
| P3 | §9.4 — `gh run list --branch main` can be DAYS stale | run-list newest 3 = `abbdc89c … 2026-10-09T01:46:43Z`; REST `actions/runs?branch=main` returned **the same three ids, shas and timestamps**; both name current `origin/main` | **COULD NOT REPRODUCE TODAY** — see note |
| P4 | §9.4 — keep escaped double quotes out of `--jq` | single-quoted `--jq '.labels[].name'` → `do-not-merge` on #2261 (positive) and empty on #2270 (negative) — both CORRECT. Escaped form → **exit 0**, stdout `.labels[].name` | **rule REPRODUCES, the stated REASON is REFUTED — F1** |
| P5 | §9.2 — piped `git show \| git hash-object --stdin` is unsound in `powershell.exe` | true blob `git rev-parse origin/main:docs/pipeline/DOCTRINE.md` → `5b71fe52`; piped under PS → `bdee0241`; identical pipeline under `cmd /c` → `5b71fe52`; `git hash-object <working copy>` → `5b71fe52`; `git diff --numstat` → EMPTY | **REPRODUCES exactly** |
| P6 | CAPABILITIES §3 — `check-breadcrumb.mjs` is a `git` AND `gh` caller | `git grep -n -E 'ls-tree\|ls-files\|gh pr list' origin/main -- scripts/pipeline/check-breadcrumb.mjs` → **5** hits; needle → **0**; §9.6 double-run of the same pattern against the docs that DESCRIBE it → **1** hit, in `STATION-CAPABILITIES.md` only, distinguishable from the 5 | **REPRODUCES** |
| P7 | §9.4 — a LIST response's `merged` field is unusable | `--json number,merged` → **exit 1**, `Unknown JSON field: "merged"`, on BOTH `gh pr list` and `gh pr view`, 3 invocations. The field does not exist in gh 2.90.0. Prescribed cure verified sound: `state,mergedAt` agreed between LIST (#2270 MERGED `01:46:41Z`) and INDIVIDUAL (same) | **CANNOT REPRODUCE — F2** |
| P8 | §9.3 — `Set-Content -Encoding UTF8` writes a BOM that node refuses | first 3 bytes `239,187,191`; node → `REFUSED: Unexpected token '\ufeff' … is not valid JSON` | **REPRODUCES** |

- [MEASURED] P3 note, stated honestly: the §9.4 wording is **conditional** ("can be days stale"), so
  one agreeing reading does not falsify it. Today both instruments agreed to the second on the live
  head. This is a **lead, not a finding** — it is recorded so a future rotation knows the claim has
  one non-reproducing observation against it, not that it is wrong.
- [MEASURED] Board trap check (station doc, AUTHORITY): tracked `*-ready.md` at depth 1 of
  `docs/pr-prompts/` on `origin/main` → **0**. No defect.
- [MEASURED] Angle 4 (history) on F1 — this is NOT a re-file. Three prior breadcrumbs touch the
  `--jq` trap: `…2026-09-05-0610-a-shell-trap-was-corrected-in-doctrine-and-its-copy-in-station-capabilities-still-lies.md`,
  `…2026-09-17-0221-doctrine-s7-guard-8-names-the-wrong-trigger-for-the-gh-jq-trap.md` (both
  **DISPATCHED → Station 00**), and `…2026-09-24-1810-…-a-jq-string-literal-reads-as-an-unlabelled-board.md`
  (F3, **DISPATCHED → Station 00**). The 09-24 run measured a BARE double-quoted literal and found
  double quotes **stripped** before `gh` sees them, concluding the failure is **loud (exit 1)** and
  that *"there is no quoting workaround — only filters that need no string literal."* **Today's
  measurement reaches a reachable string literal that the 09-24 run concluded was unreachable**, by
  BACKSLASH-escaping. The two findings are different arguments and different polarities; F1 sharpens
  09-24 rather than repeating it. No `needs-marco/` item matches `jq|capabilit|loud`.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — **advanced** to `last_index=1`,
  `last_run_utc=2026-10-09T02:10:00Z` via `next-sweep.mjs --advance`. **LEFT DIRTY in the dev tree
  on purpose.** 🔴 **Station 00 must commit this file with the next board PR** — 04 is read-only on
  the board and the dev tree is on `main`, which nobody commits to directly. Verified dirty:
  `git diff --name-status -- docs/pipeline/sweep-rotation.json` → `M docs/pipeline/sweep-rotation.json`.
- This breadcrumb, written to the dev tree at `docs/pr-prompts/`. **Untracked until a board PR
  commits it.**
- Nothing else. No board mutation, no prompt armed, staged, renamed, moved or deleted, no merge, no
  label change, no `/sot/` edit, no PR.
- Probe scratch `.ps1` files were written to `C:\po-sup-fix-scripts\` (the sanctioned scratch
  location), not into the repo. The one file written inside the repo — the P2 gitignored-path probe —
  was deleted in the same script and its absence read back.

## FINDINGS

### F1 — `STATION-CAPABILITIES.md:351` says an escaped-quote `--jq` "fail[s] **LOUDLY** … never silently." It returns **exit 0** and a plausible wrong answer, on the field that holds the merge gate.

[MEASURED] `origin/main:docs/pipeline/STATION-CAPABILITIES.md:351` reads:
*"Escaped double quotes fail **LOUDLY** (`unknown arguments`), never silently."*

Three consecutive runs, exit code captured each time:

```
P4c-1  exit=0  stdout=[.labels[].name]
P4c-2  exit=0  stdout=[.labels[].name]
P4c-3  exit=0  stdout=[.labels[].name]
```

[MEASURED] Mechanism, not inference. `cmd /c echo` of the identical argument shows the native
command receives `\".labels[].name\"`; after CRT unescaping `gh` passes `".labels[].name"` to jq,
which is a **valid jq program** — a string literal — so jq prints its own program text and exits 0.
This is not an argument error and `unknown arguments` never appears.

[MEASURED] What LOUD actually looks like, as the contrasting control: a genuinely malformed filter
`--jq '.labels[.name'` → **exit 1**, `failed to parse jq expression (line 1, column 14) … unexpected EOF`.
So the loud path exists and the escaped path is not on it.

[MEASURED] Positive and negative controls prove the instrument can produce a right answer:
single-quoted `--jq '.labels[].name'` returned `do-not-merge` for #2261 (which genuinely carries it)
and empty for #2270 (which genuinely has none). The prescribed `--json` + `ConvertFrom-Json` form
returned `do-not-merge`. So the single-quote half of that sentence is CORRECT and stays.

**Why this is the dangerous polarity, and why it is S2.** The field is `labels`. `do-not-merge` is
one of the two binding merge gates (CAPABILITIES §5, DOCTRINE §10.1 step 2) and only Marco removes
it. An escaped-quote probe returns exit 0 and a non-empty, well-formed string that contains no label
name — so a caller that tests "did I get a label back?" by string match sees something, and a caller
that tests for `do-not-merge` sees its absence. **Nothing is empty, so §9.6 does not fire, and
nothing is loud, so the sentence at :351 tells the reader it cannot have happened.** That sentence is
itself a 2026-09-05 correction of an earlier wrong bullet: the correction fixed the single-quote half
and over-generalised the escaped half, which is CAPABILITIES §1's own thesis — a stale instruction
reads exactly like a current one — recurring inside the file that exists to settle capability
disputes, for the fourth time by its own count.

[MEASURED] Blast radius: the 2026-09-24 run measured committed `--jq` callers in `scripts/` as
carrying **no inner string literal** (zero affected). I did not re-measure that and do not restate it
as current — it is cited as that run's reading. The exposure here is to **agents hand-typing a probe**,
which is exactly what this sweep does six times a day.

**DISPOSITION: DISPATCHED → Station 00.** Narrow the justification clause at
`STATION-CAPABILITIES.md:351` in a doc-reconcile PR, folded with the already-DISPATCHED 09-17 and
09-24 siblings rather than filed beside them — three breadcrumbs now point at one sentence and none
has landed. The rule to keep is DOCTRINE §9.4's, unchanged (keep escaped double quotes out of
`--jq`; take raw `--json` and `ConvertFrom-Json`). What must be removed is the claim that the escaped
form announces itself, and the replacement should carry today's three readings plus the exit-1
control so the next reader can tell the two paths apart. I did not edit the file: §9 lives in a
hash-gated canonical block and `/sot/`-adjacent doc reconciliation is not 04's lane.

### F2 — DOCTRINE §9.4 guards a `gh` field that does not exist, so the trap it names cannot occur

[MEASURED] `origin/main:docs/pipeline/DOCTRINE.md:403`:
*"**A LIST response's `merged` field is unusable** — ask each PR individually with
`gh pr view <n> --json state,mergedAt`."*

[MEASURED] On gh 2.90.0 there is no `merged` field to misread, on either call site:

```
gh pr list --state all --limit 4 --json number,merged,mergedAt  -> exit 1  Unknown JSON field: "merged"
gh pr view 2270 --json number,merged                            -> exit 1  Unknown JSON field: "merged"
gh pr view 2261 --json number,merged,state                      -> exit 1  Unknown JSON field: "merged"
```

Each failure prints the full valid-field list, which includes `mergedAt`, `mergedBy`, `mergeable`,
`mergeStateStatus` and `state` — but not `merged`. The failure is **loud and unmissable**.

[MEASURED] The prescribed cure is sound and I verified it rather than assuming it: `--json
state,mergedAt` agreed exactly between the LIST form (#2270 `state=MERGED mergedAt=2026-10-09T01:46:41Z`)
and the INDIVIDUAL form (identical), across four PRs.

This is low-severity — the bullet's ADVICE is right and following it costs nothing — but the sweep's
own charter names this case: *"a trap that has been fixed upstream and still reads as live is itself
drift."* A §9 line describing an impossible silent misreading spends a reader's attention on a
non-risk, and §9 is the section whose credibility the whole instrument-honesty discipline rests on.

**DISPOSITION: DISPATCHED → Station 00.** Fold into the same §9 doc-reconcile PR as F1: either
re-point the bullet at a field that CAN silently mislead (`state` on a closed-unmerged PR, which is
the real confusion the cure solves) or mark it as retired-upstream with today's reading and the gh
version. 🔴 Re-record the canonical block hash in that PR — `lint-station.mjs` fails on any edit to
the `instruments v2` block, and both F1 and F2 sit inside hash-gated canonical text.

### F3 — the rotation advance is sitting uncommitted in the shared dev tree, and only Station 00 can land it

[MEASURED] `next-sweep.mjs --advance --utc 2026-10-09T02:10:00Z` exited 0 and printed
`advanced: last_index=1 last_run_utc=2026-10-09T02:10:00Z`, followed by its own instruction:
*"LEFT DIRTY: name this file in your breadcrumb. Station 00 commits it with the next board PR."*
`git diff --name-status` confirms `M docs/pipeline/sweep-rotation.json`.

Recorded as a finding and not merely as a note because the station doc records the measured failure
mode: on 2026-09-02 two consecutive advances sat uncommitted and the rotation survived only because
the working copy happened to persist between runs. **If this file is not committed, the next 04 run
repeats instrument-honesty and the rotation silently stops turning** — and a rotation that never
turns is the same failure as a shallow pass over everything.

⚠️ Second half, which binds every station and not just 00: this breadcrumb is an **untracked file at
a tracked path** in the dev tree. Once a board PR lands this exact path on `main`, the dev tree holds
an untracked file at a path the fast-forward must create and `git merge --ff-only` refuses — while
`git diff --numstat` and `git diff --cached --name-status` both read EMPTY, which is the documented
PASS reading. Whoever next fast-forwards this tree should expect that and use the station doc's
raw-Buffer restore, never `git checkout -- <path>` and never `git clean` (§9.2 — consumed prompts
come back armed).

**DISPOSITION: DISPATCHED → Station 00.** Commit `docs/pipeline/sweep-rotation.json` and this
breadcrumb together in the next board PR. 04 may not commit to `main`.

## WHAT I DID NOT DO

- **Did not edit `DOCTRINE.md` or `STATION-CAPABILITIES.md`.** Both findings land inside hash-gated
  canonical blocks; 04 is read-only on the board and doc reconciliation is not its lane.
- **Did not stage a prompt.** My budget is 2 and I used 0. Both findings are single-sentence doc
  corrections inside canonical blocks that must be re-hashed together — one reconcile PR by the
  owning station is the complete-and-additive fix; a staged prompt per sentence would fragment a
  three-breadcrumb-old backlog into a fourth piece.
- **Did not touch PR #2261.** It carries `do-not-merge`, it is Marco's, and it is RED (13/2). Not
  04's, on three separate grounds.
- **Did not run Part 0, Part 1 or Part 2** of the pre-existing brief. The station contract's
  AUTHORITY section is explicit that ONE named sweep per run is covered COMPLETELY and that the
  choice is not mine; `next-sweep.mjs` assigned instrument-honesty. Where the older brief's
  "always run Part 0" disagrees with the contract, the contract wins by its own terms.
- **Did not prune, clear or investigate the 31 non-main worktrees, the 2 registry escapees, or the
  stale `docs/qa/` state.** `status-sweep.ps1` reports them `[LIVE]`; several hold unpushed commits
  and two hold uncommitted work, so pruning is irreversible. That is Station 03's lane on 00's
  dispatch, and it is a different sweep in the rotation.
- **Did not re-measure the 2026-09-24 blast-radius reading** on committed `--jq` callers. It is
  cited above as that run's measurement, with its date, not restated as current.
- **Did not call `check-breadcrumb.mjs` through the device bridge.** It shells `git ls-tree`,
  `git ls-files` and `gh pr list` (P6, 5 hits) — running it from the mount would break the §9.2
  device-bridge git ban this run promised to keep. It was run on the Windows host instead; see the
  validator line in the chat report.
- **Azure / Entra / SharePoint: not touched.** No portal, no app settings, no `az`, no
  `Connect-MgGraph`. No production data written.

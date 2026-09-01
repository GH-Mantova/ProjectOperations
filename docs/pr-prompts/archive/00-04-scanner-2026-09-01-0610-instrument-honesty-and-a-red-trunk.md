# Station 04 - Scanner | 2026-09-01T06:10Z-2026-09-01T06:35Z

## GROUND

```
UTC            2026-09-01T06:10:41Z
origin/main    000de2d9            (fetched, then rev-parse)
dev tree       main @ 000de2d9     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE - this run was read-write within station authority (staged one
`-HOLD`, armed nothing).

SIGHTED, not blind: `start_process` shell `powershell.exe` returned PID 30716 on the first call.
All three binding documents were verified byte-identical to `origin/main` before being read
(`git diff origin/main --stat -- <path>` empty for `04-scanner.md`, `DOCTRINE.md`,
`STATION-CAPABILITIES.md`), so the working copies were safe to read this run.

Assigned sweep, from `node scripts/pipeline/next-sweep.mjs`: **instrument-honesty**
(rotation position 2 of 4; previous run 2026-09-01T02:10:46Z).

## WHAT I MEASURED

### DOCTRINE section 9 - every trap re-run, with controls

| Trap | Verdict | Evidence |
|---|---|---|
| 9.1 `$` expanded by the `-Command` layer | **[MEASURED] REPRODUCES VERBATIM** | via `start_process`: `$env:COMPUTERNAME` -> `CTRL=` (empty); `$PSVersionTable.PSVersion` -> `LIT=System.Collections.Hashtable.PSVersion`. Exit 0, no error - the silent-wrong-value case. |
| 9.2 `ls-tree` depth without `-r` | **[MEASURED] REPRODUCES** | `-- docs/pr-prompts/superseded` = **1** line; with trailing slash = **64**; with `-r` = **256**. POS control `-r -- docs/pr-prompts` = 612. |
| 9.2 `ls-tree` glob is silently empty | **[MEASURED] REPRODUCES** | `-- 'docs/pr-prompts/superseded/*.md'` = 0 with and without `-r`; POS control `-- 'docs/pr-prompts/*.md'` = **0 against a truth of 81** depth-1 tracked `.md`. `:(glob)...` magic = exit **128**, loud. |
| 9.2 `check-ignore -v` on a directory | **[MEASURED] REPRODUCES** | dir -> exit 1, empty. dir with slash -> exit 1, empty. NEG control `CLAUDE.md` (tracked, genuinely not ignored) -> **exit 1, empty - identical**. File inside -> exit 0, `.gitignore:76`. Opposite truths, byte-identical results. |
| 9.2 `git branch -r` reads a stale cache | **[MEASURED] REPRODUCES** | `git branch -r` = **47**; `git ls-remote --heads origin` = **29**. 18 phantom tracking refs. |
| 9.2 plain `git fetch origin main` updates `origin/main` | **[CANNOT MEASURE]** | `origin/main` did not move during the run, so before==after proves nothing. Mechanism confirmed present only: `remote.origin.fetch` = `+refs/heads/*:refs/remotes/origin/*`, git 2.55.0.windows.3. |
| 9.3 PowerShell `>` writes UTF-16LE | **[MEASURED] REPRODUCES** | `git show origin/main:docs/pipeline/stations/03-machine-minder.md > f` = **41558 bytes**, first4 `FF FE 2D 00`. node write of the same blob = **20493 bytes**, first4 `2D 2D 2D 0A`. Ratio 2.03. `git hash-object` differs; `git diff --stat` returns **empty**. |
| 9.3 `-SimpleMatch` must not receive `[regex]::Escape()` | **[MEASURED] REPRODUCES** | DOTTED needle `process.env` over `apps\api\src\**\*.ts`: raw = **192**, escaped = **0** (searched literally for `process\.env`). DOTLESS control `RateResolverService`: raw = 113, escaped = 113 - escaping is a no-op only when there is no metacharacter. |
| 9.4 `gh run list --commit <SHORT sha>` | **[MEASURED] REPRODUCES** | `--commit 000de2d9` -> `[]`, exit 0. `--commit 000de2d9e3c32b7e00dade3a510efd025bbbae1f` -> **4 runs**. |
| 9.4 escaped double quotes in `--jq` | **[MEASURED] REPRODUCES - but the stated CAUSE does not hold.** See FINDING 3. | `--jq "map(.number) \| join(\",\")"` -> `failed to parse jq expression ... invalid escape sequence "\)"`, arriving as `join(",\)`. |
| 9.5 three literal don't-arm markers | **[MEASURED] CONFIRMED, line numbers exact** | `const DO_NOT_ARM_COMMENT` at **:728**, `const DO_NOT_ARM_CAPS` at **:730**, `const ARM_ONLY = /Arm ONLY/` at **:732**. NEG control `zzzNoSuchTokenZzz` = 0 hits. |
| 9.5 `LINT_GH_BIN` / `LINT_GIT_BIN` | **[MEASURED] CONFIRMED** | `LINT_GH_BIN` exactly 1 hit at **:1164**. `LINT_GIT_BIN` 1 hit at **:440** (inside the documented `:439-459`). |
| 9.5 `foldBlockScalar` landed | **[MEASURED] CONFIRMED** | `git grep -c foldBlockScalar origin/main -- scripts/pipeline/lint-prompt.mjs` = **2**, exit 0. NEG control `zzzNoSuchTokenZzz` = empty, exit 1. |
| 9.5 `check-breadcrumb.mjs` two-set behaviour | **[MEASURED] CONFIRMED** | `:98` is literally `git ls-tree -r --name-only origin/main -- ${DIR}` (recursive). `:160` is `readdirSync(DIR)` (depth-1). `:162` basename-matches via `p.slice(p.lastIndexOf('/') + 1)`. |
| 10.1 RULE-2 probe and its broken twin | **[MEASURED] REPRODUCES** | Regex form `-Pattern 'marco.:true'` = **601** POS / breadth `marco` **1282** / NEG 0. `-SimpleMatch '\"marco\":true'` = **0** AND `-SimpleMatch '\"marco\":false'` = **0** - opposite questions, identical answers. |

**Zero DOCTRINE section 9 traps have been fixed upstream. Every one that could be exercised this run
still fires.** One claim's stated cause is wrong (FINDING 3); one was untestable (9.2 fetch).

### The board and the trunk

- `origin/main` `000de2d9` = `docs(pr-prompts): 06 handover to 00 ... (#1482)`, ONE file changed.
- main CI on the **full** SHA: CI **failure** / Deploy success / CodeQL success / Tendering Browser Smoke success.
- Preceding three main commits `678c2473`, `b30e166a`, `fd1a8fb5`: **zero** failing runs each.
- Failing job: `Pipeline - watcher + linter tests`, run `33474623827`, job `99751201985`.
- Job log (read, not inferred - DOCTRINE section 3): `check-breadcrumb.mjs` -> `REJECT: 1 malformed breadcrumb(s)`.
- Reproduced locally twice, exit 1 both times, identical verdict.
- Branch ruleset required checks on `main` = exactly **4**: `CodeQL`, `API - lint, test, compliance smoke`, `Web - lint, logic tests, vitest, build`, `tendering-e2e`. `Pipeline - watcher + linter tests` is **NOT** among them.
- #1482 lane (section 10.1): **NO watcher verdict** in `processed/*.md.log` -> did not come through the watcher. `[NO LANE VERDICT - hand-classified]` by `classifyPolicyFiles`' own rule: sole path `docs/pr-prompts/...md`, outside-tests-docs-or-migrations = **False** -> **not Marco's**. Auto-merge SQUASH enabled by `GH-Mantova` at 05:40:30Z; merged 05:42:16Z; labels **none**.

### Sweep instrument

`status-sweep.ps1` threw a PowerShell error block mid-report this run, at `:204`:
`Get-ChildItem $subdir.FullName -Recurse | Measure-Object -Property Length -Sum` - `DirectoryInfo`
has no `Length`. Measured against `C:\po-worktrees\po-scan-1787002207`: current form sum =
**27283317**, `-File` form sum = **27283317**, count 2295. **The number is correct; only the noise
is new.**

## WHAT CHANGED

1. **Staged** `docs/pr-prompts/pr-fix-malformed-breadcrumb-1482-HOLD.md` (untracked, `??`).
   `lint-prompt.mjs` -> **ADMIT (size 1)**, exit 0, no warnings. Bytes verified via node: 4439,
   no BOM, no `U+FFFD`.
2. **Advanced the sweep rotation** via `next-sweep.mjs --advance` (tracked file
   `docs/pipeline/sweep-rotation.json`), as the station contract requires.
3. Scratch `.ps1` probes written under `C:\po-sup-fix-scripts\` (outside the repo).

**Armed nothing.** `*-ready.md` count was 1 before and 1 after
(`pr-crm-uifix-s1-cold-threshold-and-tab-shells-ready.md`, pre-existing). `git diff --cached
--name-status` was **empty** - the shared index was clean and I staged nothing into it.

## FINDINGS

### FINDING 1 - S1. One malformed breadcrumb on main is reddening the entire board.

`00-06-pr-master-2026-09-01-0535-stale-escalations-carried-by-every-sweep.md`, landed by #1482,
carries `## GROUND` plus five headings of its own invention and is missing four of the five
contract sections. `check-breadcrumb.mjs` REJECTs it, `Pipeline - watcher + linter tests` fails,
and that job runs on `main` **and on every open PR**. All 6 open PRs currently read RED; this is
their shared cause. Per the FIX LANE rule, a docs-only PR failing a code check means the
regression is on MAIN - one fix, not six.

Blast radius measured: across every depth-1 `00-*.md` breadcrumb, this is the **only** file
missing any of the five sections. Fold = 1.

**DISPATCHED** -> Station 00. `pr-fix-malformed-breadcrumb-1482-HOLD.md` is staged and ADMITs
clean. It is one file, `docs/`-only, so the `tests-docs` auto-merge lane can carry it with no
human (DOCTRINE 10.3). I am read-only on the board and arm nothing; 00 arms it. The HOLD is
untracked until a board PR commits it - it reaches nobody until then.

### FINDING 2 - S2. The breadcrumb checker cannot block the merge that breaks it.

`Pipeline - watcher + linter tests` is not one of the 4 required checks, so #1482 auto-merged at
05:42:16Z with that job **already red on its own head**. The check therefore cannot stop a
malformed breadcrumb reaching `main`, but it can and does paint every subsequent PR red - so the
board shows 6 failures of which 5 are inherited noise and 1 is real.

This is the **CP-26 shape exactly**: an advisory check that reads like a real gate. It is the same
argument already open with Marco for CP-26, one check further along.

**ESCALATED** -> Marco. RULE 1, complete-and-additive first:

- **(A) Add `Pipeline - watcher + linter tests` to the branch ruleset's required checks.** Solves
  it immediately (this merge would have been blocked) and in future (every later one is too), and
  damages no data entry - it gates merges only. **Passes both halves of RULE 1.** Cost: a
  genuinely broken pipeline check now blocks the board until fixed, which is the intended
  behaviour but is a real change in blast radius.
- **(B) Leave it advisory and rely on stations reading the job.** Fails the *future* half - this
  is at least the second advisory-check-mistaken-for-a-gate incident, and nothing about it
  self-corrects.
- **(C) Make the checker non-fatal (warn, exit 0).** Fails **both** halves: main stops going red,
  and the contract stops being enforced at all, so breadcrumbs silently rot - which is the exact
  failure the five-section contract was written to stop.

Note for the decision: (A) and the open CP-26 A/B/C are the same question about two different
checks. Answering them together is cheaper than twice.

### FINDING 3 - S3. DOCTRINE 9.4 attributes the `--jq` quote failure to the wrong layer.

Section 9.4 says escaped double quotes "do not survive **the `-Command` layer**", and section 10.1
repeats it. **Measured this run: the failure reproduces identically under `powershell -File`,
where there is no `-Command` layer at all.** `join(\",\")` still arrives at `gh` as `join(",\)`.
The cause is PowerShell's own native-argument parsing, not the Desktop Commander wrapper.

Why this matters rather than being pedantry: a station that reads 9.4 literally will believe that
moving its `gh --jq` call into a `.ps1` run with `-File` - the cure 9.1 prescribes for the `$`
trap - makes quoted jq safe. It does not. The trap is unconditional; only its explanation is wrong.

**DEFERRED.** The correction belongs inside the `instruments v2` canonical block, so it needs
`node scripts/pipeline/lint-station.mjs --write-canonical` and cannot ride a normal docs edit.
It becomes urgent the moment a station reports a `gh --jq` result it obtained via `-File` and
believed. Fold it into the next canonical re-record, alongside the already-DEFERRED 9.4
generalisation from the 2026-08-31T20:0xZ run - **same block, same bullet, one re-record.**

### FINDING 4 - S3. STATION-CAPABILITIES overstates the `gh --jq` label trap.

Section 3 says a `--jq` string "has its quotes stripped in transit and prints as `labels=[]`, a
broken query that reads as 'no labels'". Positive control run against **PR #1483, which does carry
a label**: `gh pr view 1483 --json labels --jq ".labels[].name"` returned **`do-not-merge`** -
correct, and matching the `--json` + `ConvertFrom-Json` form. The `--jq` form is only broken when
the jq expression itself contains double quotes (FINDING 3); `.labels[].name` has none.

As written the doc tells stations a working instrument is broken, which costs them the cheap query
and, worse, teaches distrust of a correct reading. Same root as FINDING 3.

**DEFERRED** - this text is in an ordinary docs file, not a canonical block, so it can be fixed by
any station in a normal docs PR. Bundling it with FINDING 3's re-record is the efficient move.

### FINDING 5 - S4. `status-sweep.ps1:204` prints a PowerShell error into every sweep.

`Measure-Object -Property Length -Sum` over a `-Recurse` listing that includes directories. The
**sum is unaffected** (27283317 both ways, verified against a real escapee worktree) - this is
noise, not a wrong number. The one-word fix is `-File`:

```
$escapeeSize = (Get-ChildItem $subdir.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
```

The cost is not the error itself: it is that this report's own header says *"If ANY [BROKEN]
appears in section 0, STOP"*, and a routine red block teaches every reader to skim past red text
in the one instrument they are told to trust.

**DEFERRED**, deliberately not staged. It touches `scripts/`, so it is outside `tests|docs` and
would route to Marco - adding to a queue that already holds 6 red PRs. It should ride the next
`status-sweep.ps1` change rather than consume a slot alone.

### FINDING 6 - method, S4, no action needed.

I nearly filed "DOCTRINE 9.5 cites `check-breadcrumb.mjs:162` as matching by basename, but the
token `basename` appears **0** times in the file". Reading `:162` showed
`p.slice(p.lastIndexOf('/') + 1)` - a basename extraction, at exactly the cited line. **DOCTRINE
was right and my grep was the liar** - a token search standing in for a behaviour claim, which is
DOCTRINE section 7 catching me with its own instrument. Recorded because the instrument-honesty
sweep should report its own near-miss.

**ACTIONED** - no defect; verified by reading the source lines rather than grepping for a word.

## WHAT I DID NOT DO

- **Did not arm anything.** `*-ready.md` = 1 before and after. Arming is 00's, on Marco's authority.
- **Did not merge, label, rebase or touch any PR.** Read-only on the board by station authority.
- **Did not fix the malformed breadcrumb by hand**, though I could have. It is another station's
  artifact, it is on `main`, and hand-landing produces no review (DOCTRINE 10.3). Staged as a
  prompt instead.
- **Did not mint a worktree.** Read `origin/main` with `git show` per the AUTHORITY section; the
  orphaned `/tmp/po-scan-*` trees are exactly what that rule prevents.
- **Did not run `git` through the device bridge**, and did not run `checkout` / `reset --hard` /
  `stash pop` / `clean` anywhere.
- **Did not touch `/sot/`, Azure/Entra/SharePoint, or production data.**
- **Did not clear the 9 registry-escapee worktrees or the 16 `needs-marco/` files** the sweep
  tagged - Station 03's dispatch, already open.
- **Did not run Part 0 / Part 1 / Part 2** of the legacy station brief. The AUTHORITY section is
  explicit that the rotation picks ONE named sweep and covers it completely; `next-sweep.mjs`
  named `instrument-honesty`, and rotating is what stops findings rotting.
- **Did not re-measure the CP-26 escalation or the bootstraps escalation.** Both are open with
  Marco; only the answer is missing, not more measurement.

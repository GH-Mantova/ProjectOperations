# Station 04 - Scanner | 2026-09-05T06:09:57Z-2026-09-05T06:27Z

Sweep this run: **instrument-honesty** (rotation position 2 of 4, chosen by
`node scripts/pipeline/next-sweep.mjs`, not by me). Advanced to position 3 and LEFT DIRTY - see
WHAT CHANGED.

## GROUND

```
UTC            2026-09-05T06:09:57Z
origin/main    21f4820f            (git fetch origin --prune, then git rev-parse)
dev tree       main @ 87bb2e3f     C:\ProjectOperations2   (BEHIND origin/main)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE. This run was NOT read-only on that account.

**SIGHTED.** `start_process` shell `powershell.exe` returned `2026-09-05T16:09:57.9096011+10:00`
on `LAPTOP-E6NHU4E4`. Desktop Commander present the whole run.

**The dev tree is behind `origin/main` (87bb2e3f vs 21f4820f), but the three binding documents are
not.** `git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` returned EMPTY, so the working
copies I read are byte-identical to `origin/main` and the PREFLIGHT "read from origin/main" rule is
satisfied. Blobs: `169a714f` / `1f1e4154` / `c5791f5e`. Same check for the three instrument sources
I grepped (`lint-prompt.mjs` `216d9528`, `check-breadcrumb.mjs` `87fcf245`, `index.mjs` `901ea012`)
- all numstat EMPTY.

`status-sweep.ps1` at 06:10:43Z: section 0 both positive controls LIVE, section 7 **SAFE TO ACT**.
1 open PR (#1640), armed 0, watcher pid 20000 RUNNING, in-progress prompts 0, index.lock false in
both trees, 0 git processes.

## WHAT I MEASURED

Every row [MEASURED] this run unless tagged. Positive and negative controls named where the claim
is a negative. PowerShell 5.1.26100.9168, git 2.55, gh 2.90-class.

### DOCTRINE section 9.1 - the shell

| Claim | Result |
|---|---|
| `$` is EXPANDED by the `-Command` layer, not stripped | **REPRODUCES, exactly as written.** Through `-Command`: `$CTRL` (undefined) arrived EMPTY, `$true` arrived as the literal `True`, `$env:USERNAME` arrived as `Marco`. |
| ...and the cure hides the trap from its own control | **REPRODUCES.** The same session, through `-File`, evaluated `$PSVersionTable.PSVersion.ToString()` correctly to `5.1.26100.9168`. Only the invocation differed. |
| Streamed output can return EARLY with output pending | **REPRODUCES.** Scripts B and C each returned after 1 line with 50+ lines still pending; three `read_process_output` calls were needed. |

This bullet bit me twice during the run on real work, not just on the control: a `foreach ($cmd ...)`
loop arrived as `foreach ( in ...)` and killed the whole statement, and a `node -e` one-liner was
mangled the same way. Both failed LOUDLY, which is the benign half of the trap.

### DOCTRINE section 9.2 - git

| Claim | Result |
|---|---|
| `ls-tree` with no trailing slash returns ONE line | **REPRODUCES.** `-- docs/pr-prompts` = **1** line, and that line is the tree entry `docs/pr-prompts`. `-- docs/pr-prompts/` = **114**. `-r` with slash = **787**. `-- docs/pr-prompts/superseded` = **1**; with `-r` = **294**. |
| `ls-tree` has NO glob pathspec and does not say so | **REPRODUCES.** `-- 'docs/pr-prompts/superseded/*.md'` WITH `-r` = **0**, exit 0. POSITIVE CONTROL `-- 'docs/pr-prompts/*.md'` = **0**, exit 0, against a literal-prefix truth of **106** depth-1 `.md`. Explicit magic `:(glob)...` = exit **128**, `pathspec magic not supported by this command: 'glob'`. |
| `check-ignore -v` on a DIRECTORY carries no information | **REPRODUCES.** Directory `docs/pr-prompts/processed` -> exit 1, empty. CONTROL `CLAUDE.md`, a tracked file that genuinely is not ignored -> exit 1, empty. **Byte-identical.** A file INSIDE -> exit 0, `.gitignore:76:docs/pr-prompts/processed/`. |
| `git status` is structurally blind to gitignored files | **REPRODUCES.** `git status --porcelain -- docs/pr-prompts/processed` = **0** lines; `git ls-files --others --ignored --exclude-standard` over the same path = **3957**. Whole-repo `git status --porcelain` = 29, so the instrument was working. |
| `git branch -r` is a local cache and `--prune` cannot cure it | **REPRODUCES AND HAS WORSENED.** After `git fetch origin --prune`: `git branch -r` = **13**, `git ls-remote --heads origin` = **5**. The eight-way gap is seven hand-made refs no refspec owns: `pr/1477`, `pr/1478`, `pr/1483`, `pr/1487`, `pr/1544`, `pr/1571`, `pr1273`. DOCTRINE records five on 2026-09-03; there are now seven. |
| `git stash` in the watcher clone is a CLOSED LOOP | **REPRODUCES.** `git -C C:\po-watcher\ProjectOperations stash list` = **66**. Newest `watcher-preflight-autostash on 'main' at 2026-09-03T18:55:05+10:00`; oldest `stash@{65}` is a `WIP on feat/sharepoint-folder-mappings` from the CP-24 era. See F4. |

### DOCTRINE section 9.3 - files and encoding

| Claim | Result |
|---|---|
| PowerShell `>` writes UTF-16LE in PS 5.1 | **REPRODUCES.** `git show origin/main:CLAUDE.md > file`: true blob **1960** bytes (`git cat-file -s`), file on disk **3974** bytes, first two bytes **255,254** = `FF FE`. |
| `[regex]::Escape()` on a `-SimpleMatch` pattern kills it silently | **REPRODUCES.** Needle `index.mjs` in `DOCTRINE.md`: raw **9** hits, escaped (`index\.mjs`) **0** hits, exit 0 either way. DOTLESS control `DOCTRINE`: raw **4**, escaped **4** - the control passes while the dotted query silently fails, which is the whole trap. NEGATIVE control `zzzNoSuchNeedleZzz` = 0. |

### DOCTRINE section 9.4 - GitHub

| Claim | Result |
|---|---|
| `gh run list --commit <SHORT sha>` answers `[]`, exit 0 | **REPRODUCES.** `--commit 21f4820f` -> raw `[]`, 0 runs. `--commit 21f4820fd05677b5664ecf546dc8efb0a8600821` -> **4** runs. POSITIVE CONTROL, older full sha `e92fac6c...` -> **4** runs. |
| `@(ConvertFrom-Json ...).Count` answers 1 for an EMPTY array | **REPRODUCES.** inline empty = **1** (truth 0); assign-then-count empty = **0**. inline four = **1** (truth 4); assign-then-count four = **4**. Correct in both directions only when assigned first. |
| A `--jq` expression survives `-Command` intact, spaces included | **REPRODUCES (the claim is TRUE).** `gh pr list --state open --jq '.[] | .number' --json number` returned `1640`. `gh pr view 1369 --json labels --jq '.labels \| map(.name) \| join(-)'` reached jq and failed at **column 30** - the pipes and spaces arrived. |
| ...but escaped double quotes do NOT survive, and fail LOUDLY | **REPRODUCES.** `--jq '.[] \| [.number, (.labels \| map(.name) \| join(\",\"))] \| @tsv'` -> `unknown arguments ["\|" "@tsv"]; please quote all values that have spaces` plus the full usage block. Loud, never silent. NOTE: DOCTRINE illustrates this failure as `failed to parse jq expression` / `join(,\)`. I got a *different* loud message - `gh` re-split the argv before jq ever saw it. The headline claim holds; **the quoted error string is illustrative and a reader grepping for that literal will not find it.** |
| `gh run list --branch main` can be DAYS stale | **DID NOT REPRODUCE TODAY, and the claim is conditional so this is not a refutation.** Newest 4 rows all `2026-09-05T06:10:02Z` on `21f4820f` = current head, 5th row `05:54:48Z success` on `e92fac6c`. |

### DOCTRINE section 9.5 and 10 - the pipeline's own instruments

| Claim | Result |
|---|---|
| ANCHOR BY SYMBOL, NEVER BY LINE NUMBER - and the cure is holding | **CONFIRMED.** All seven symbol anchors in section 9.5 resolve in `lint-prompt.mjs`, each exactly once (or the stated count): `DO_NOT_ARM_COMMENT =` **:822**, `DO_NOT_ARM_CAPS =` **:824**, `ARM_ONLY =` **:826**, `HUMAN_GATE_PRESENT: line` **3** hits (:837/:849/:861), `function readFromOriginMain` **:529**, `LINT_GH_BIN` **1** hit :1258, `foldBlockScalar` **2** hits (:1050/:1165). NEGATIVE control `zzzNoSuchNeedleZzz` = 0. File is 1827 lines. **The three arming markers now sit at 822/824/826 - a further ~94-line drift below the retired `:728/:730/:732` citations, so converting them to symbols was correct and remains correct.** |
| `check-breadcrumb.mjs` measures two different sets | **CONFIRMED by anchor.** `ls-tree -r` **1**, `p.lastIndexOf('/')` **1**, `readdirSync(DIR)` **1**, and the token `basename` **0** - exactly as section 9.5 states. |
| `NESTED_TEST_PATHS` must still be THREE forms (10.1's own falsifying probe) | **CONFIRMED.** `const NESTED_TEST_PATHS` at `index.mjs:1397` holds `/^(tests\|docs)\//`, `/(^\|\/)__tests__\//`, `/\.(test\|spec)\.[cm]?[jt]sx?$/`. POSITIVE control `classifyPolicyFiles` **2** hits; NEGATIVE control 0. **Section 10.1 step 2 is still accurate; do not re-derive it.** |
| RULE 2's probe has TWO homes and the dead one passes its control | **REPRODUCES, UNCHANGED, STILL LIVE.** LIVE `C:\ProjectOperations2\docs\pr-prompts\processed` = **1935** logs, newest **2026-09-05T05:33:53Z**, POS `marco.:true` **612**, NEG 0. DECOY `C:\po-watcher\ProjectOperations\docs\pr-prompts\processed` = **21** logs, newest **2026-08-17T14:28:09Z**, POS **10**, NEG 0. The decoy still passes the mandated POS>0 / NEG=0 control and would clear every PR since 17 August. **Log AGE is still the only discriminator.** |
| Section 10.3's `ok:true` falsifying probe (re-run before quoting either half) | **RE-RUN.** `merge result for PR #(\d+): \{"ok":true` over `processed\*.log` = **50** (was 48 on 2026-09-04). NEGATIVE control `\{"ok":zzzNoSuchZzz` = 0. Highest: **1583, 1580**, 1563, 1537, 1534, 1531, 1514, 1476. **The tests-docs lane is alive and has fired twice more since the 09-04 refutation. Do not re-derive it as dead.** |
| `.arming-log.txt` - nothing commits it, so the gap re-opens by luck | **CLOSED RIGHT NOW.** POS control `git ls-files --error-unmatch` on the log -> exit 0; NEG control on a nonexistent path -> exit 1. `origin/main` = **53** lines, working copy = **53** lines, `git diff --numstat` EMPTY, both ending on the identical row `2026-09-04T22:03:13Z ARMED pr-crmui-account360-s1-tiles-and-next-action ... by=Marco@ pid=13788`. **The defect (nothing commits it on purpose) is untouched; only today's state is clean.** |
| `rev-*.log` pollutes a bare `PR #N` match | **REPRODUCES.** #1640 (the only open PR): prompt-logs-only (`processed\pr-*.log`) = **0**; all-logs (`processed\*.log`) = **1**. The single hit is a non-`pr-*` log, i.e. the review job. NEGATIVE control `PR #999999` = 0. |

### Instruments run end-to-end

| Instrument | Exit | Reading |
|---|---|---|
| `node scripts/pipeline/lint-station.mjs` | **0** | `ADMIT: all 8 docs clean`, 9 agent definitions encoding clean. But see **F3** for what its NOTE says. |
| `node scripts/pipeline/check-lessons.mjs` | **0** | `holding=5 regressed=0 broken=0`. |
| `node scripts/pipeline/check-escalations.mjs` | **0** | `open=0 resolved=3 broken=0`. |
| `node scripts/pipeline/check-breadcrumb.mjs` | **0** | `structure: 11 checked, 0 malformed`, `CLEAN`. |
| `node scripts/pipeline/next-sweep.mjs` | 0 | `instrument-honesty`, position 2 of 4, previous run 2026-09-05T02:09:57Z - i.e. 04's 4h cadence was met. |

### Dev tree hygiene (not my sweep, but measured while here)

`git diff --cached --name-status` = **0** - the shared index is CLEAN, nothing of another chat's is
staged. `git status --porcelain` = **29**, all `??`: 25 untracked `docs/pr-reviews/pr-<N>-review.md`
(section 9.5 records that `verdictApproves` needs those files, and 25 of them exist only on this
box), plus `docs/pr-prompts/.queue-sync-ledger.txt`, `queue-watch-state.md`,
`archive/review-escalations-516-1346/`, `Claude Design/docs/index.html`, and two `-LOOPING.md`
prompts (see F5). **No `*-ready.md` among them; armed = 0.**

### Lane reading for #1640 (for Station 00, not a finding of mine)

`[NO LANE VERDICT - hand-classified]`. #1640 `feat(tendering): the plant picker groups by category`,
head `pr-cardfix-s3-plant-picker`. Prompt-log discriminator = 0 hits; the newest arm in
`.arming-log.txt` is `2026-09-04T22:03:13Z` for a DIFFERENT prompt and armed is currently 0, so no
arm sits in this PR's window. **The branch name reads exactly like a queue prompt and that is not
evidence** (DOCTRINE 9.5 / the `#1633` precedent). Title scope is `apps/`-class, outside all three
`NESTED_TEST_PATHS` forms, no `migrations/` seen -> hand-classifies as **MARCO'S**. CI 13 pass /
0 fail / 1 pending at 06:10Z. I did not merge, label, or touch it.

## WHAT CHANGED

**One file, deliberately left dirty, committed by nobody this run:**

- `docs/pipeline/sweep-rotation.json` - advanced with
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-05T06:09:57Z`, which printed
  `advanced: last_index=1 last_run_utc=2026-09-05T06:09:57Z` and `LEFT DIRTY`. Read back:
  `git status --porcelain -- docs/pipeline/sweep-rotation.json` -> ` M`. **Station 00 must commit
  this with the next board PR; 04 may not commit to the shared dev tree.**

- This breadcrumb, written to `C:\ProjectOperations2\docs\pr-prompts\`. **UNTRACKED until a board PR
  sweeps it up.** 04 has *Create a PR: NO* in the authority matrix, so I cannot land it myself.

Scratch only, outside the repo: `C:\po-sup-fix-scripts\04-instrument-honesty-{A,B,C}.ps1`,
`04-sweep-0610.txt`, `t7-redirect.txt`.

**Nothing else.** No prompt armed, disarmed, renamed, moved or deleted. No PR merged, labelled or
commented. No `sot/` file touched. No git write of any kind to either tree.

## FINDINGS

### F1 - A section 9.4 correction landed in DOCTRINE ten days ago and its restatement in STATION-CAPABILITIES still carries the refuted version, in the dangerous direction. **S2.**

`STATION-CAPABILITIES.md` section 3, under **GitHub**, reads:

> Read labels by piping `gh pr view N --json labels` into a JSON parser - **a `--jq` string has its
> quotes stripped in transit and prints as `labels=[]`, a broken query that reads as "no labels".**

**[MEASURED] with both controls. It is false.**

- POSITIVE CONTROL, a PR that genuinely carries a label. `gh pr list --state all --label do-not-merge`
  returned #1369 (MERGED) with `do-not-merge`. `gh pr view 1369 --json labels --jq '.labels[].name'`
  **through `-Command`** printed `do-not-merge`. Not `labels=[]`. The correct answer.
- NEGATIVE CONTROL, a PR that genuinely has no labels. #1640, same query, printed **nothing** -
  also the correct answer, and its raw `--json labels` is a true `{"labels":[]}`.
- Spaces survive: `--jq '.labels | map(.name) | join(-)'` reached jq and errored at column 30.
- Escaped double quotes fail **LOUDLY** (`unknown arguments ["|" "@tsv"]`), never silently.

**Why S2 and not a typo.** The advice inverts the polarity of the risk. A reader who believes it
will (a) distrust a *correct* label reading, and (b) read a genuine empty - like #1640's, which is
TRUE - as "my instrument is broken", which is the same error wearing the other costume. Labels are
the CP-26 / `do-not-merge` gate, so the reading this bullet teaches you to mistrust is the one that
stops an agent merging Marco's work.

**This is a KNOWN correction that only landed in one of the two files.** The staged prompt
`docs/pr-prompts/superseded/pr-doctrine-s9-four-false-traps-LOOPING.md` (untracked, on disk)
measured this exact claim false on **2026-08-26** and wrote the replacement text. That replacement
is on `origin/main` in DOCTRINE section 9.4 today, verbatim. It was never applied to
STATION-CAPABILITIES, and **STATION-CAPABILITIES is the file the bootstraps tell a station to read
LAST** - which is the failure that same file already records about itself two bullets earlier:

> "The shell traps live in DOCTRINE section 9.1. Read them there; this file must not restate them.
> Two restatements that sat here drifted away from 9.1 and were caught 2026-08-30 by Station 04 ...
> **So: no paraphrase.**"

This GitHub bullet is a **third** restatement of a shell trap, sitting in the same file, under a
different heading, four sections after the rule that forbids restating shell traps - which is
presumably why the no-paraphrase sweep missed it.

**RULE 1 options for the fix.**
(a) **Complete and additive - do this one.** Delete the mechanism claim from
STATION-CAPABILITIES section 3 and replace it with a pointer: *"jq/label reading traps live in
DOCTRINE section 9.4. Read them there; this file must not restate them."* Then extend the existing
no-paraphrase rule in section 3 so it is scoped to **every** shell/CLI trap in this file, not only
the two under "Desktop Commander" - that is what lets the same class be caught next time.
Solves it now (the false claim is gone) and in future (the restatement cannot recur unnoticed);
damages no data entry.
(b) Correct the bullet in place to match DOCTRINE section 9.4's wording. Fails the *future* half:
it leaves a fourth paraphrase in a file that has now drifted three times, free to rot again.
(c) Delete the bullet outright. Fails the *complete* half: readers lose the true and useful part
(use `--json` + `ConvertFrom-Json`; keep double quotes out of jq).

**DISPOSITION: DISPATCHED -> Station 00.** Docs-only, `docs/pipeline/STATION-CAPABILITIES.md`,
inside 00's own lane and inside `^(tests|docs)/`. I cannot open the PR (authority matrix: 04
*Create a PR: NO*). Handing over: the refuted sentence, the two controls above, and option (a).

### F2 - DOCTRINE section 9.5 names the STOP-WATCHER-LANE2 sentinel without a path, and that omission has manufactured a false "the mechanism is gone" at least twice. Six 04 runs have now filed the same one-clause fix and it has never landed. **S3.**

Section 9.5 says: *"`STOP-WATCHER-LANE2` has been present BY DESIGN since 2026-08-15. It is not
drift and it is not a stop signal."* **It names no path.**

**[MEASURED] I walked straight into it this run.** My first probe searched the two obvious places -
`Get-ChildItem C:\ProjectOperations2 -Filter STOP-WATCHER*` and the same in
`C:\po-watcher\ProjectOperations` - and returned **0 and 0**. Read alone, that says the documented
sentinel does not exist. A second, wider probe found it immediately:
`dir /s /b C:\po-watcher\STOP-WATCHER*` -> **`C:\po-watcher\STOP-WATCHER-LANE2`**, i.e. in the
`po-watcher` PARENT directory, outside both git repos, alongside `cowork-stop-watcher.ps1`.
The claim is TRUE. Only its locatability is broken.

**This is not a new observation and that is the finding.** `git grep STOP-WATCHER origin/main`
returns prior 04 breadcrumbs filing it four separate times, each proposing the identical one-clause
fix - name the path:

- `00-04-scanner-2026-08-25-1010-...` F7: *"present by design, but not where a station would look"*
- `00-04-scanner-2026-08-26-0210-...`: **`CANNOT REPRODUCE - the mechanism is gone`** - the
  dangerous direction, written into a table of section 9 verdicts
- `00-04-scanner-2026-08-27-1410-...` FINDING 4: *"documented without a path ... Fix is one clause:
  name the path `C:\po-watcher\STOP-WATCHER-LANE2`"*
- `00-04-scanner-2026-08-28-0610-...` F3: *"true but unlocatable from the text, and reads as drift
  to any station that checks it"*

DOCTRINE section 9.5 on `origin/main` at `21f4820f` still has no path (lines 623-625). Meanwhile
`docs/runbooks/watcher-restarter-scheduled-task.md:47` states the full path correctly, and
`docs/pipeline/stations/03-machine-minder.md:202` repeats the pathless form - so 03 inherits the
same trap. Eleven days, six runs, one clause.

**RULE 1 options.**
(a) **Complete and additive - do this one.** Add the path to the section 9.5 bullet
(`C:\po-watcher\STOP-WATCHER-LANE2`, outside both repos), say the real sentinel `STOP-WATCHER` is
likewise clone-side at `C:\po-watcher\STOP-WATCHER` and is currently absent, and name the three
readers (`ensure-watcher.ps1`, `watcher-launcher-lane2.ps1`, `watcher-launcher-singlelane.ps1`) so
the next station can check the mechanism rather than the file. Fixes the false negative now and
kills the recurrence, because a path cannot be mis-searched. Section 9.5 is inside the
`instruments v2` CANONICAL-BLOCK, so this needs `node scripts/pipeline/lint-station.mjs
--write-canonical` and the regenerated `_canonical-blocks.json` in the same PR, edited with node
per section 9.3.
(b) Add the path only to `03-machine-minder.md`. Fails the *complete* half - DOCTRINE is what
every station reads, and 03's copy is itself a restatement.
(c) Delete the bullet. Fails both halves: the sentinel is real and load-bearing, and deleting it
means the next station that finds a file called STOP-WATCHER-LANE2 treats it as a stop signal - the
exact outcome `docs/runbooks/watcher-restarter-scheduled-task.md:47` says "would mean the watcher
never starts again".

**DISPOSITION: DISPATCHED -> Station 00.** Docs-only + canonical rehash. Note the canonical-block
rehash makes this a deliberate, reviewed edit, not a drive-by.

### F3 - `lint-station.mjs` compares two different version fields and then prints a remedy for a third comparison. Its NOTE currently indicts all seven station docs, and the check that would catch real contract drift is pointed at the wrong field. **S3.**

`node scripts/pipeline/lint-station.mjs` exits 0 and prints `ADMIT: all 8 docs clean`, then:

```
NOTE    contract is v2; these declare a different station_doc_version:
          docs/pipeline/stations/00-supervisor.md -> v1
          ... all seven ...
          the scheduled-task bootstrap must declare the same number, or the run goes read-only
```

**[MEASURED] the three values involved.**

- `docs/pipeline/stations/_canonical-blocks.json`: `"station-contract": { "version": 2 }`.
- All seven station docs: `station_doc_version: 1` **and** `contract_version: 1`, with the block
  markers reading `CANONICAL-BLOCK: station-contract v2`.
- `lint-station.mjs:222` `const contractV = canon['station-contract']?.version;` then `:223`
  filters on the map built at `:209` from `r.version`, which `:170` defines as
  `Number(fm2.station_doc_version)`.

So it compares the **canonical block version** against **`station_doc_version`** - two fields that
are unrelated by design. `contract_version`, the field whose name matches what it is checking, is
validated for being an integer >= 1 at `:122-125` and then **never compared to anything**.

**Three consequences, in increasing order of cost.**

1. The NOTE fires on all seven docs permanently, for a condition that is not a defect. Persistent
   noise is how a real NOTE gets skimmed past.
2. The remedy line is about a **different** comparison. PREFLIGHT step 3 says the run goes
   read-only when the *doc's* `station_doc_version` and the *bootstrap's* disagree. Here they agree
   (1 == 1) - this run correctly did not go read-only - but a station that reads "contract is v2,
   yours is v1, or the run goes read-only" has been handed a coherent argument for standing itself
   down. That is a section 7 instrument lie with a station's whole run attached.
3. **It fails OPEN on the thing it was built for.** `contract_version: 1` is stale in all seven docs
   against a v2 block, and nothing reports it, because the only version comparison in the file is
   aimed elsewhere.

**RULE 1 options.**
(a) **Complete and additive - do this one.** Compare `contract_version` against
`canon['station-contract'].version` (which is the check the code's own comment at `:221` describes:
*"every station doc must declare the same contract version"*), keep the `station_doc_version`
values printed alongside as information, and change the remedy line to name the comparison it
actually belongs to (doc vs scheduled-task bootstrap). Then bump the seven `contract_version: 1` to
`2` in the same PR so the newly-correct check goes green. Fixes the false NOTE, restores the real
gate, and adds no new failure mode - the front matter is already required and already parsed.
(b) Delete the NOTE block. Fails the *complete* half: the noise stops and so does the only guard on
contract drift across seven docs.
(c) Bump `station_doc_version` to 2 in all seven docs to silence it. Fails **both** halves and is
actively harmful: the doc says bumping it is forbidden and that a version match is not a freshness
proof, and every scheduled-task bootstrap still declares 1, so all seven stations would go
read-only on their next run.

**DISPOSITION: DISPATCHED -> Station 00.** Touches `scripts/pipeline/lint-station.mjs` plus the
seven docs' front matter, so it is a `scripts/` PR - outside `^(tests|docs)/`, therefore outside the
tests-docs auto-merge lane, and it re-points a CI-gating instrument. 00 to decide whether to route
it to Marco.

### F4 - The watcher clone's stash is at 66 and nothing anywhere records a prior count, so the "report its growth" instruction cannot be followed. **S4.**

DOCTRINE section 9.2: *"`git stash` in the watcher clone is a CLOSED LOOP - the launcher's preflight
stashes on every start, and nothing ever pops. **Report the count and its growth.** `git stash
drop`, never `pop`."*

**[MEASURED]** count = **66**. Newest `stash@{0}: On main: watcher-preflight-autostash on 'main' at
2026-09-03T18:55:05+10:00`; oldest `stash@{65}: WIP on feat/sharepoint-folder-mappings: a5a096e
ci(pr-gates): CP-24 sot-purity hard block ... (#545)` - a branch from mid-July.

**The growth half is [CANNOT MEASURE].** No prior count exists in the project memory index, in
`DOCTRINE.md`, or in any breadcrumb I can reach, so 66 is a first data point, not a trend. An
instruction to report a delta against a baseline that is never persisted is an instruction that can
never be satisfied - and each run that reports only the count looks like it complied.

**DISPOSITION: DISPATCHED -> Station 03** (machine health is 03's lane; 04 is report-only on the
machines). Handing over: the count 66, the oldest and newest entries above, and the observation
that the baseline needs a home - `status-sweep.ps1` section 2 already prints watcher-clone facts
and could carry `stash=<n>` so the number lands in a durable artifact every run and the delta
becomes computable without anyone remembering to write it down. I did **not** drop any stash: that
is 03's, on 00's dispatch, and stash@{65} names a feature branch.

### F5 - `pr-doctrine-s9-four-false-traps-LOOPING.md` is SPENT: all four corrections it proposed are on `origin/main`. **S4.**

`docs/pr-prompts/superseded/pr-doctrine-s9-four-false-traps-LOOPING.md`, untracked, on disk in the
dev tree. Its `premise` is `grep -q "no inline .if. expression" docs/pipeline/DOCTRINE.md`.

**[MEASURED] all four of its corrections landed:** the section 9.5 `lint-prompt` polarity fix, the
deletion of the inline-`if` bullet, the git-2.55 opportunistic-fetch rewrite, and the section 9.4
`--jq` rewrite are each present verbatim in `DOCTRINE.md` at `21f4820f`. Its premise string does not
occur in the file, so the premise is dead and it can never re-fire. **Controlled:**
`git grep -c "no inline .if. expression" origin/main -- docs/pipeline/DOCTRINE.md` -> **no match,
nonzero exit**; POSITIVE control `"instrument lies"` on the same file/ref -> **1 match**; NEGATIVE
control `"zzzNoSuchNeedleZzz"` -> no match. The absence is a real absence, not a broken query.

**It arms nothing** - `-LOOPING.md` matches no watcher glob, it is in `superseded/`, and it is
untracked. Recording it because it is the artifact that proves F1: **the same prompt fixed this
class of claim in DOCTRINE and left the copy in STATION-CAPABILITIES standing.** A correction that
knows it is fixing a restated trap should sweep for the restatements.

**DISPOSITION: DEFERRED.** No action needed while it stays in `superseded/` and untracked. It would
become urgent only if something moved it to depth 1 and renamed it `-ready.md`, which nothing does.
Named here so a future run does not spend a second sweep re-reading it.

## WHAT I DID NOT DO

- **Did not open a PR for F1, F2 or F3.** The authority matrix gives 04 *Create a PR: NO* and
  *Mutate the board: NO, read-only*. All three are handed to 00 with the measurement, the options
  and the RULE 1 ordering. This is the scope limit, not a stall: everything I could do, I did.
- **Did not commit `docs/pipeline/sweep-rotation.json`,** per the station doc's explicit instruction
  to leave it dirty for 00. Named in WHAT CHANGED so it is not lost.
- **Did not touch #1640** - not merged, not labelled, not commented. Hand-classification recorded
  above for 00 under section 10.1 step 4; the classification is mine to state, the decision is not.
- **Did not drop, pop or prune anything in the watcher clone** (66 stashes) and did not prune the
  orphaned worktree `C:/po-vg` that `status-sweep.ps1` flagged holding 1 uncommitted file. Both are
  03's lane on 00's dispatch. Reporting, not acting.
- **Did not stage a fix prompt.** The station doc allows me to stage a lint-clean `-HOLD`, but
  staging is a write into `docs/pr-prompts/` that only a board PR can publish, and all three
  actionable findings are one-clause doc edits that 00 can land faster than a prompt can be built.
  If 00 disagrees, F1 and F2 are both trivially promptable.
- **Did not run the Part 0 static cross-layer audit, Part 1 GitHub reconciliation, or the Part 2
  live-site visual pass.** The station doc's AUTHORITY section overrides the older brief: one named
  sweep per run, chosen by `next-sweep.mjs`, covered completely. This run was `instrument-honesty`
  and I covered every section 9 and section 10 claim I could probe safely.
- **Did not run any probe that writes to a shared tree.** No `git checkout`, `reset`, `stash pop` or
  `clean` in `C:\ProjectOperations2` (the board trap), no `git` against the workspace mount, and no
  throwaway worktree (the orphan-lock trap). All reads were `git show` / `rev-parse` / `ls-tree`
  against a named ref, or `Select-String` over files whose `--numstat` against `origin/main` I had
  already proved empty.
- **Did not touch Azure, Entra or SharePoint,** and did not read or write production data.

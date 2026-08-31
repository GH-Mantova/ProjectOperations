# Station 04 — Scanner | 2026-08-31T14:10Z–2026-08-31T14:38Z

## GROUND

```
UTC            2026-08-31T14:10:37Z
origin/main    6e105076            (6e105076014ba6c426393dae12c7955fd0212e84)
dev tree       main @ 6e105076     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — no read-only forcing. SIGHTED run: `start_process`
shell `powershell.exe` succeeded on the first call (PID 9084). All three binding documents
were verified byte-equal to `origin/main` before being read
(`git diff origin/main -- <path>` empty for all three).

Sweep this run, per `node scripts/pipeline/next-sweep.mjs`: **instrument-honesty**
(rotation position 2 of 4; previous run 2026-08-31T10:11:04Z). Not my choice.

⚠️ **`origin/main` moved during this run: `6e105076` → `ba1f705b`** (Station 00's PR, landed
~14:40Z). Every §9 reading in the table below was taken at **6e105076**; every finding was
then **re-verified against `ba1f705b`** before being dispositioned. Where the two disagree,
the `ba1f705b` reading governs and is stated in the finding.

🔴 **METHOD, the one worth keeping from this run: Station 00 and I found the same defect from
different instruments, two minutes apart, and neither of us could have known.** Stations do
not read each other's chats, and a breadcrumb written at 14:08Z is invisible to a run that
starts at 14:10Z until someone thinks to look. The check that caught it was angle 4 of the
five-angle protocol — *history: is this already fixed or queued?* — run **after** the finding
was written rather than before. Cheap fix, no new machinery: **re-read
`docs/pr-prompts/00-*.md` for breadcrumbs newer than your own run start, immediately before
you disposition.** I nearly dispatched Station 00 to do work it had already shipped.

## WHAT I MEASURED

**Concurrency.** [MEASURED] The dev tree HEAD moved *between my first two commands*:
`3985d74f` at 14:10:37Z, `6e105076` at 14:12Z. `git reflog` shows
`6e105076 HEAD@{2026-09-01 00:10:47 +1000}: merge origin/main: Fast-forward` — i.e.
14:10:47Z, mid-run. Identified benignly: `check-breadcrumb --freshness` reports Station 00
last ran **2026-08-31T14:08:00Z**. A concurrent station, not an unexplained actor.

**Sweep verdict.** [MEASURED] `status-sweep.ps1` at 14:11:31Z → `SAFE TO ACT`, armed=0,
watcher node RUNNING pid 32916, index.lock false/false, 0 git processes.

### DOCTRINE §9 traps — reproduced (trap still live, no action needed)

| Ref | Claim | Measured at 6e105076 | Verdict |
|---|---|---|---|
| 9.1 | `-Command "..."` expands `$` | `$CTRL=42` → `=42;` (emptied); `$PSVersionTable.PSVersion` → `System.Collections.Hashtable.PSVersion` | **REPRODUCED** |
| 9.1 | `interact_with_process` does NOT expand | same `.ps1` printed `5.1.26100.9168` correctly | **REPRODUCED** |
| 9.2 | `ls-tree` no-slash returns the tree entry | `-- docs/pr-prompts/superseded` → **1** line, the dir itself; `/` → **63**; `-r` → **254** | **REPRODUCED** |
| 9.2 | `ls-tree` has no glob pathspec | glob → **0** with AND without `-r`; POS CONTROL `-- 'docs/pr-prompts/*.md'` → **0** against a truth of **64** `.md` at depth 1; `:(glob)` → `fatal: pathspec magic not supported`, exit 128 | **REPRODUCED** |
| 9.2 | `check-ignore -v` on a DIR is silent | dir → exit 1, empty (with and without `/`); file inside → exit 0, `.gitignore:76` — the exact line §9.2 cites | **REPRODUCED** |
| 9.2 | `git status` blind to ignored | status mentions `processed/` **0** times; `ls-files --others --ignored` → **3681** | **REPRODUCED** |
| 9.2 | `gh pr list --limit N` truncates | `--limit 50` → **50**; `--limit 2000` → **1451** | **REPRODUCED** |
| 9.3 | `Get-Content` false mojibake | line reads `line one ?" em dash here`; `.Contains(U+2014)` **False**, `.Contains(U+FFFD)` **False** | **REPRODUCED** |
| 9.3 | `Set-Content -Encoding UTF8` double-encodes | clean 117-byte UTF-8 fixture → 134 bytes, `EF BB BF` BOM, **`â€"` ×2**, em dash ×0, U+FFFD ×0 | **REPRODUCED** |
| 9.3 | plain `Set-Content` byte-lossless for content | 117 → 121 bytes (+4 = CRLF on 4 lines), no BOM, em dash ×2 intact | **REPRODUCED** |
| 9.3 | PS `>` writes UTF-16LE | 117 → **244** bytes, first bytes `ff fe`, `Buffer.compare` = **-1** | **REPRODUCED** |
| 9.3 | `-SimpleMatch` + `[regex]::Escape()` matches nothing | escaped+dotted → **0**; raw+dotted → **1**; escaped+DOTLESS → **1**; genuinely-absent → **0** | **REPRODUCED** (all four cells) |
| 9.4 | `--jq` with escaped `"` fails loudly | `join(\",\")` → `failed to parse jq expression … join(,)`, exit 1; POS CONTROL `.labels \| length` → exit 0 | **REPRODUCED** |
| 9.4 | `gh run list --commit SHORT` → `[]` exit 0 | `6e105076` → **0** runs exit 0; full 40-char → **4** runs. POS CONTROL on `origin/main~1`: short **0**, full **4** | **REPRODUCED** on two commits |
| 9.5 | human gate fires BEFORE the premise | `checkHumanGate` called at `:1227`, `runPremise` defined `:1174` and reached later | **REPRODUCED** |
| 9.5 | `check-breadcrumb` freshness recursive / structure depth-1 | `ls-tree -r` at `:98`; `readdirSync(DIR)` at `:160`; run reports `structure: 1 checked` vs 4 stations fresh | **REPRODUCED** |
| 9.5 | `lint-prompt` premise `return null` fail-safe | `:457  return null; // git broken - skip check, fail SAFE`; `LINT_GIT_BIN` at `:440` | **REPRODUCED** |

### Not reproduced this run

[MEASURED] **9.4 — "`gh run list --branch main` can be DAYS stale."** Read 3× between
14:11Z and 14:33Z; every read was current (tip `6e105076`, runs timestamped 13:53:5xZ).
This is a *possibility* claim, so three fresh reads do not refute it. Recorded as
**not reproduced today**, not as drift.

[CANNOT MEASURE] **9.1 blocked commands, via the shell.** My first probe tested PATH
resolution, which is not the claim — all six resolve on PATH, as they should. The block is
at the Desktop Commander layer. Read directly from `get_config` instead: `blockedCommands`
contains all six §9.1 names (`net`, `sc`, `reg`, `netsh`, `takeown`, `shutdown`) **plus 27
more** §9.1 does not list. DC version **0.2.47** — the version §9.1 cites.

[INFERRED] §9 sits inside `<!-- CANONICAL-BLOCK: instruments v2 -->`, whose comment states
`lint-station.mjs` fails on an unrecorded edit. `node scripts/pipeline/lint-station.mjs`
exits **0** today (`ADMIT: all 7 docs clean`) [MEASURED]. I did **not** mutate the block to
prove the failure — that is a board mutation outside my lane.

### A lead, not a finding

[MEASURED] `status-sweep.ps1` at 14:11:31Z printed
`main branch CI (last 3 runs): 1 success / 1 not-success  <-- TRUNK IS RED`. Three later
reads (14:20Z, 14:26Z, 14:27Z) all printed `3 success / 0 not-success  (trunk green)`.
Both candidate explanations are **refuted**: a re-run mutating a conclusion is out
(`gh api …/actions/runs/<id> --jq .run_attempt` = **1** on all 12 most recent main runs),
and a genuine red is out (conclusion tally of the last 20 main runs = `{"success":20}`).
I cannot account for the 14:11:31Z reading. It is a lead. The *mechanism* below is a
finding, and it is separate.

## WHAT CHANGED

- Wrote this breadcrumb to the dev tree at `docs/pr-prompts/` — **untracked**, for 00 to sweep up.
- Advanced `docs/pipeline/sweep-rotation.json` via
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-08-31T14:10:37Z` — **uncommitted**.
- Scratch probes written to `C:\po-sup-fix-scripts\sup-0414-*` (outside the repo).
- **Nothing else.** No prompt armed, staged, renamed, moved or deleted. No PR touched.
  No commit, no push. Armed count 0 → 0.

## FINDINGS

### F1 — §9.5's block-scalar trap is FIXED, and the doctrine still reads as live. [S2]

§9.5 states: *"`lint-prompt.mjs`'s `parseFrontMatter` has NO block-scalar support, and it
currently RUBBER-STAMPS the LL-29 rollback gate … `key: >-` stores the literal two
characters `">-"`"*, and instructs every station: *"Until it lands: never write a
front-matter key as a block scalar, treat a `">-"` in lint output as an UNREAD field …
read `rollback_strategy` out of the file by eye before trusting any migration-scoped ADMIT."*

**REFUTED.** [MEASURED] `foldBlockScalar` is defined at `lint-prompt.mjs:956` and **called
at `:1071`, inside `parseFrontMatter`** (exported `:1037`). Live two-arm control, importing
the actual `origin/main` module and calling the real function:

```
FOLDED '>-'        rollback_strategy = "Revert the migration with prisma migrate resolve
                                        --rolled-back, then redeploy the previous image."
PLAIN (control)    rollback_strategy = "Revert the migration and redeploy."
```

The folded field returns its **body**, not `">-"`. The fix landed as
**`1a62c86d fix(pipeline): parseFrontMatter folds YAML block scalars so the LL-29 rollback
gate stops rubber-stamping (#1414)`**. §9.5 even names the staged fix
(`pr-lint-frontmatter-block-scalar-collapse-HOLD.md`) and says "until it lands" — it landed,
and the warning was never retracted.

Cost of leaving it: it bills every station a hand-verification that is no longer needed, and
its authoring advice ("never write a front-matter key as a block scalar") is now **false** —
it steers authors away from a form the linter reads correctly. This is precisely the drift
this sweep exists to catch: *a trap fixed upstream that still reads as live is itself drift.*

**DISPOSITION: ACTIONED — by Station 00, independently, two minutes before this run started.
This finding is a DUPLICATE and is recorded as such, not re-dispatched.**

[MEASURED] Re-checked at 14:41Z after 00's PR landed: `origin/main` advanced
**6e105076 → ba1f705b** *during* this run. On `ba1f705b`, `git show
origin/main:docs/pipeline/DOCTRINE.md` contains the stale claim
`"has NO block-scalar support"` **0 times** and `foldBlockScalar` **2 times** — 00 replaced
the bullet and re-recorded the `instruments` canonical-block hash. Its breadcrumb
(`00-00-supervisor-2026-08-31-1408-…`, landed 14:08:58Z) documents the same chain I found,
plus the provenance I did not have: the fix prompt was **armed and consumed at 00:16–00:21Z**,
#1414 merged **01:21:53Z**, and **four station runs** (00 at 08:09/10:09/12:09Z, 04 at 10:11Z)
carried the retired instruction forward before either of us caught it.

Two convergent findings from independent probes is corroboration, and I am leaving the
evidence above intact for that reason — my live two-arm `parseFrontMatter` control and 00's
`git grep -c foldBlockScalar` reach the same verdict by different instruments. But the work
is done, and **the correct action here is to stand down, not to file it again.** The one
number worth carrying forward is mine, because it is fresher: 00's replacement text preserves
the warning that **10** prompts had a `rollback_strategy` never linted by a working gate;
[MEASURED] the live count on `origin/main` today is **8** (see F5), the difference being the
prompts retired in #1448/#1449.

### F2 — §9.5 says "`gh` appears nowhere in [lint-prompt.mjs]". It appears at :1164. [S3]

§9.5: *"**`gh` appears nowhere in it**, so the old advice — 'confirm `gh` resolves' — proved
nothing."* [MEASURED] `:1164 const gh = process.env.LINT_GH_BIN || "gh";` and
`:1165 execFileSync(gh, ["pr","view",String(n),"--json","state"], …)` inside
`ghFetchPrState`, reached from the exported `checkFixesPrTargetOpen`; `:1518` calls it
*"a single gh call"*. The `git`-not-`gh` half of the bullet is still correct for the five
**gate** probes — but the flat claim is false, and a station reading it will skip checking
`gh` before trusting a `fixes_pr` verdict.

[MEASURED] **Re-verified against `ba1f705b` after 00's edit landed: the claim SURVIVES** —
`"appears nowhere in it"` still occurs **1** time in `docs/pipeline/DOCTRINE.md`. 00's PR
replaced only the adjacent block-scalar bullet. This one is still live and still false.

**DISPOSITION: DISPATCHED → Station 00.** `docs/pipeline/DOCTRINE.md` only (no `sot/`, so
CP-24 is not engaged), and the PR must **re-record the `instruments` canonical-block hash**
or `lint-station.mjs` REJECTs it — 00 measured that gate firing (`REJECT: 1 of 7`, exit 1)
during its own edit this hour, so the procedure is proven and fresh. That hash requirement is
also why I did not stage this as a prompt: a prompt omitting it ships a red PR.

### F3 — status-sweep's TRUNK IS RED matches the commit TITLE, not the conclusion. [S3]

`scripts/pipeline/status-sweep.ps1:86-88` runs `gh run list --branch main --limit 3`
**without `--json`** and greps the human table:

```powershell
$mfail = @($mainci | Select-String -Pattern "failure","cancelled","timed_out" -SimpleMatch).Count
```

The table's TITLE column is the commit subject, so a subject containing any needle is
counted as a failed run. [MEASURED] control — two synthetic rows, **both conclusion
`success`**, one titled `fix(ci): stop swallowing a test failure`:

```
status-sweep logic reports => 2 success / 1 not-success  <-- TRUNK IS RED (FALSE)
```

[MEASURED] and it is realistic here: of the last 400 `origin/main` subjects, **1 already
contains a needle** — `fix(watcher): stop the exit -1 crash loop … treat every non-zero exit
as a failure (#1162)`. It will fire again whenever such a commit sits in the top 3.
Complete-and-additive fix: read `--json conclusion` and count conclusions, which removes the
whole class rather than escaping the needles.

**DISPOSITION: DISPATCHED → Station 00** (a `scripts/` change — code, so it must NOT ride
the `docs/` PR carrying F1/F2; CP-24 hard-fails a mixed PR).

### F4 — §9.5 documents two do-not-arm markers; there are three. [S3]

[MEASURED] `DO_NOT_ARM_COMMENT` `:728` (tested `:738`) and `DO_NOT_ARM_CAPS` `:730` (tested
`:750`) are exactly as documented — but a **third** gate at `:765-:767` rejects
`'Arm ONLY' (conditional arming)`. §9.5 does not mention it. Good news, wrongly recorded: a
station grepping only the two documented markers under-reports which prompts are gated.
Line numbers `:728/:730/:743/:755` all verified exact.

[MEASURED] **Re-verified against `ba1f705b`: still undocumented** — the string `"Arm ONLY"`
occurs **0** times in `docs/pipeline/DOCTRINE.md`. This matters directly for RULE 4, whose
arming detector greps the union of don't-arm markers as its second instrument: that union is
currently missing a marker the linter actually enforces.

**DISPOSITION: DISPATCHED → Station 00**, same docs PR as F2.

### F5 — §9.5's folded-scalar census is stale; its invariant holds. [S4]

[MEASURED] over the **59** depth-1 `-HOLD`/`-ready` prompts on `origin/main` (§9.5 measured
61 on 2026-08-30): `rollback_strategy` **8** (was 10), `premise_means` **14** (was 19),
`done_when` **10** (was 12), and **0** on `premise` / `scope` / `fixes_pr` / `requires_*` —
the invariant §9.5 relies on, unchanged. The drop tracks the prompts retired in #1448/#1449.
Per F1 these are now correctly-folded fields, not unread ones. Numbers in §9 are state, and
state does not belong in an instruction document.

**DISPOSITION: DEFERRED.** Becomes urgent only if the `0` on `premise`/`scope` ever moves —
that would mean a gate field is being silently dropped. Fold the correction into F1's PR if
convenient; not worth its own.

### F6 — the stale remote-tracking cache has WORSENED. [S4]

[MEASURED] `git branch -r` = **69**; `git ls-remote --heads origin` = **25**. §9.2 recorded
54 vs 21 on 2026-08-29. Phantom refs have grown 33 → **44** in two days. §9.2's cure
(`ls-remote`) is correct and still works; the divergence is simply widening, so any audit
built on `branch -r` is now wrong by a larger margin.

**DISPOSITION: DEFERRED.** A `git fetch --prune` is repo hygiene, not mine to run mid-flight
with Station 00 active. Belongs to the **repo-hygiene** sweep (rotation position 3) or to 03.

### F7 — `check-ignore` on a directory is indistinguishable from a true negative. [S4]

[MEASURED] `git check-ignore -v docs/pr-prompts/processed` → exit **1**, empty output.
`git check-ignore -v CLAUDE.md` (tracked, genuinely not ignored) → exit **1**, empty output.
**Byte-identical results for opposite truths.** §9.2 records that the directory form is
silent; it does not say the silence is *identical to the negative control*, which is what
makes it dangerous — there is no way to tell the two apart without querying a file inside.

**DISPOSITION: DISPATCHED → Station 00**, one clause added to the existing §9.2 bullet in
F1's PR. No new bullet.

### F8 — watcher-clone stash growth, reported per §9.2. [S4]

[MEASURED] `git -C C:\po-watcher\ProjectOperations stash list` → **55** entries. §9.2 calls
this a closed loop (the launcher stashes on every start; nothing pops) and asks stations to
report the count and its growth. Also [MEASURED] from the sweep: the clone is on
`feat/crm-s9-anchor-picker`, `dirty=2` — **not** clean-on-main.

**DISPOSITION: DISPATCHED → Station 03 (machine-minder).** Clone state and stash hygiene are
its lane; `stash drop`, never `pop`. I neither cleared nor counted-and-acted.

## WHAT I DID NOT DO

- **Did not commit or push.** Station 00 ran at 14:08:00Z and FF'd this tree at 14:10:47Z,
  mid-run. DOCTRINE §9.2: the dev tree index is shared between concurrent chats. Committing
  into it while 00 is live is the LL-38 shape. Breadcrumb and the advanced
  `sweep-rotation.json` are both left on disk for 00 to sweep up — flagged here so their
  untracked state is not mistaken for a missing report.
- **Did not edit DOCTRINE.md.** F1/F2/F4/F7 are all corrections to a hash-gated canonical
  block; I am read-only on the board and the block-hash re-record belongs with the PR.
- **Did not stage a prompt.** My budget is 2, and I used 0: every finding is a docs or
  scripts correction whose PR must re-record a canonical-block hash (F1/F2/F4/F7) or must
  be code-only to clear CP-24 (F3). A prompt that omitted either would ship a red PR.
- **Did not run `git fetch --prune`**, clear the 55 stashes, or touch the watcher clone.
- **Did not test the §9.1 blocked-command list by executing one**, and did not mutate the
  canonical block to prove `lint-station` fails — both are stated above as inference or
  `[CANNOT MEASURE]` rather than dressed as measurements.
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site patrol).** The station
  doc mandates ONE named sweep covered completely; the rotation named instrument-honesty.
  A shallow pass over everything is the failure it exists to prevent.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.**

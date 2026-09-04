# Station 04 — Scanner | 2026-09-03T22:10:46Z–2026-09-03T22:2xZ

## GROUND

```
UTC            2026-09-03T22:10:46Z
origin/main    bfd2596b            (fetched --prune first, then rev-parse)
dev tree       main @ bfd2596b     C:\ProjectOperations2   (converged, 12 dirty lines)
doc version    1                   (docs/pipeline/stations/04-scanner.md)
bootstrap      1                   (scheduled-task SKILL.md) — MATCH, full authority
```

SIGHTED run. `start_process` shell `powershell.exe` returned PID 380 on the first call — not blind.
`git diff --stat origin/main -- docs/pipeline/stations/04-scanner.md DOCTRINE.md STATION-CAPABILITIES.md`
returned **empty**, so the working copies I read ARE `origin/main` at `bfd2596b`; all three read in full.

Sweep this run was **not chosen**: `node scripts/pipeline/next-sweep.mjs` →
`SWEEP: instrument-honesty` (rotation position 2 of 4; previous run 2026-09-03T18:10:45Z).

`status-sweep.ps1` at 22:11:27Z: section 0 both positive controls LIVE, verdict **SAFE TO ACT**.
04 is read-only on the board and mutated nothing regardless.

## WHAT I MEASURED

DOCTRINE §9 names the traps. I ran the query that lies for each one and checked the documented
failure still reproduces. **13 of 14 reproduce exactly. One is [CANNOT MEASURE] by design. None
has been silently fixed upstream.**

| # | §9 trap | Result |
|---|---|---|
| T1 | `$` EXPANDED by the `-Command` layer (9.1) | **[MEASURED] REPRODUCES verbatim** |
| T3 | blocked commands `net`/`sc`/`reg`… (9.1) | **[MEASURED] REPRODUCES** |
| T4 | `ls-tree` depth without `-r` (9.2) | **[MEASURED] REPRODUCES** |
| T5 | `ls-tree` has no glob pathspec (9.2) | **[MEASURED] REPRODUCES** |
| T6 | `check-ignore` on a DIR is a null answer (9.2) | **[MEASURED] REPRODUCES** |
| T7 | plain `git fetch origin main` moves `origin/main` (9.2) | **[CANNOT MEASURE]** — see WHAT I DID NOT DO |
| T8 | `git branch -r` over-reports (9.2) | **headline REPRODUCES; stated CAUSE is incomplete — F2** |
| T10 | PS `>` writes UTF-16LE (9.3) | **[MEASURED] REPRODUCES** |
| T11 | `-SimpleMatch` + `[regex]::Escape` (9.3) | **[MEASURED] REPRODUCES** |
| T12 | escaped `"` die in a `--jq` expression (9.4) | **[MEASURED] REPRODUCES, loudly** |
| T14 | `gh run list --commit <SHORT>` → `[]` (9.4) | **[MEASURED] REPRODUCES — but see F1** |
| T16-18 | `lint-prompt.mjs` line refs (9.5) | **[MEASURED] all confirmed at `bfd2596b`** |
| T19 | `check-breadcrumb.mjs` two sets (9.5) | **[MEASURED] confirmed** |
| T20 | RULE 2's probe has two homes (9.5) | **[MEASURED] REPRODUCES, freshly** |

### The evidence, per trap

**T1 [MEASURED].** `start_process` with
`powershell.exe -NoProfile -Command "$PSVersionTable.PSVersion.ToString(); $CTRL=42; …"` →
`System.Collections.Hashtable.PSVersion.ToString(); =42; …` + `ParserError: ExpectedExpression`.
The token was replaced by its **value**, not stripped — exactly as §9.1 records.
POSITIVE CONTROL: the identical text through `interact_with_process` →
`T1-CONTROL interact_with_process CTRL=42 and PSVersionTable is 5.1.26100.9168`. Clean.
So the expansion belongs to the `-Command` layer alone, and `-File` remains the cure.

**T3 [MEASURED].** `start_process("net user")` → `Error: Command not allowed: net user`.

**T4 [MEASURED]**, `git ls-tree --name-only origin/main -- docs/pr-prompts/superseded`:
no slash = **1** · trailing slash = **81** · `-r` = **279**. The 1-vs-279 gap is the whole trap.

**T5 [MEASURED].** `-- 'docs/pr-prompts/superseded/*.md'` → **0** without `-r` and **0** with it.
POSITIVE CONTROL, the form that must succeed: `-- 'docs/pr-prompts/*.md'` → **0**, against a literal
`-- 'docs/pr-prompts/'` truth of **95**. So `-r` never rescues a zero-result glob, and the control
fails identically — the documented shape. `:(glob)docs/pr-prompts/superseded/**/*.md` →
`fatal: … pathspec magic not supported by this command: 'glob'` (the only loud form).

**T6 [MEASURED], with the control the trap exists for.**
`git check-ignore -v docs/pr-prompts/processed` → exit **1**, empty.
`git check-ignore -v CLAUDE.md` (tracked, genuinely not ignored) → exit **1**, empty. **Identical.**
`git check-ignore -v docs/pr-prompts/processed/pr-100-…-ready.md.log` → exit **0**,
`.gitignore:76:docs/pr-prompts/processed/`. And `git status --porcelain -- docs/pr-prompts/processed`
→ **0 lines**. Opposite truths, identical results. Only the file form answers.

**T8 [MEASURED].** After `git fetch origin --prune` this run: `git branch -r` = **12**,
`git ls-remote --heads origin` = **7**. Headline holds. Cause differs — see F2.

**T10 [MEASURED].** `git show origin/main:docs/pipeline/DOCTRINE.md > file` under PS
**5.1.26100.9168**: blob `git cat-file -s` = **51953** bytes → file on disk **105378** bytes
(2.03x), first two bytes **FF FE**. UTF-16LE, exactly as recorded.

**T11 [MEASURED].** `Select-String -SimpleMatch` over `DOCTRINE.md`:
needle `lint-prompt.mjs` raw → **8** hits; `[regex]::Escape()`d → **0**.
CONTROL, dotless needle `DOCTRINE`: raw → **2**, escaped → **2**. The dotless control passes while
the dotted query silently fails — the documented signature.

**T12 [MEASURED].** `--jq "[.[].number] | join(\",\")"` →
`failed to parse jq expression … [.[].number] | join(",\)  ← invalid escape sequence "\)"`.
Fails **loud**, the safe direction. POSITIVE CONTROL, spaces but no double quotes:
`--jq "[.[].number] | length"` → **5**, matching the sweep's 5 open PRs. §9.4's precise claim —
spaces survive, escaped double quotes do not — is exactly right.

**T14 [MEASURED], gh 2.90.0.** `gh run list --commit bfd2596b --json …` → raw `[]`, **0** runs, exit 0.
`--commit bfd2596b42b00339b6c5949f5a7e177c89f75520` → **4** runs
(Push on main / CI / Deploy / Tendering Browser Smoke, all `success`). Reproduces.
🔴 **My FIRST measurement of this trap said it did NOT reproduce.** That reading was itself a lie —
see **F1**, which is the real finding of this run.

**T16-T18 [MEASURED]** against `scripts/pipeline/lint-prompt.mjs` at `bfd2596b` — every line
reference §9.5 asserts is still true:
`LINT_GIT_BIN` **:440** (inside the claimed `readFromOriginMain` 439-459) ·
`LINT_GH_BIN` **exactly one hit, :1164** ·
`DO_NOT_ARM_COMMENT` **:728**, `DO_NOT_ARM_CAPS` **:730**, `ARM_ONLY = /Arm ONLY/` **:732** —
all three markers present, so RULE 4's union-of-three is correct and a two-marker grep still
under-reports · `foldBlockScalar` → **2**, NEG control `zzzNoSuchTokenZzz` → **0**.
(`HUMAN_GATE_PRESENT` occurs at :704 :741 :743 :753 :755 :765 :767 :1238; the three §9.5 names as
report sites — :743 :755 :767 — are present and correct.)

**T19 [MEASURED]** against `scripts/pipeline/check-breadcrumb.mjs`:
`:98` `git ls-tree -r --name-only origin/main -- ${DIR}` — **recursive**, so freshness sees `archive/`;
`:160` `readdirSync(DIR)` — **depth-1**, so structure does not; `:161` `p.slice(p.lastIndexOf('/')+1)`
— **basename**. All three as documented. Incidentally `:36`
`CADENCE = { '00': 2, '02': null, '03': 24, '04': 4, '05': 24 }` and `:35` "SILENT past 2x its
cadence" are **unchanged** — see F3.

**T20 [MEASURED], and it moved during this run.**
`C:\ProjectOperations2\docs\pr-prompts\processed` → **1865** logs, newest **2026-09-03T22:14:48Z**,
`marco.:true` → **606**, NEG → 0.
`C:\po-watcher\ProjectOperations\docs\pr-prompts\processed` → **21** logs, newest
**2026-08-17T14:28:09Z**, `marco.:true` → **10**, NEG → **0**.
The decoy still passes the mandated POS>0 / NEG=0 control while being seventeen days dead. The live
tree gained a log (1864 → 1865) between 00's 20:1xZ measurement and mine, so **log age remains the
only working discriminator**. §9.5's cure (landed #1553) is correct and still necessary.

### Board state, observed only

From `status-sweep.ps1` 22:11:27Z, `[LIVE]` lines only: **5 open PRs** — #1554, #1544, #1543, #1541,
#1536, all green. main CI on `bfd2596b` 4 success / 0 failed (**trunk green**). Watcher node
RUNNING pid 24744, heartbeat 1 min, wrapper alive. `armed: 1` = `rev-1554-ready.md`, which is an
auto-generated **REVIEW JOB**, not a prompt (§9.5) — real armed prompts = **0**. Watcher clone
dirty=3; 3 orphaned worktrees + 2 registry escapees flagged for 03. I read these; I acted on none.

## WHAT CHANGED

**Nothing on the board.** No prompt armed, disarmed, renamed, moved or deleted. No PR touched,
labelled or merged. No `sot/` edit. No git write of any kind in any tree.

Two writes, both outside the repo, both scratch:
`C:\po-sup-fix-scripts\04-instrument-honesty-{,2b-,3-}2026-09-03.ps1` and `C:\po-sup-fix-scripts\_t10\`.

One tracked-path write inside the repo: **this breadcrumb**, at
`docs/pr-prompts/00-04-scanner-2026-09-03-2210-instrument-honesty-and-a-count-that-reads-one-either-way.md`.
It is **UNTRACKED** — Station 00 must sweep it into a board PR.

**`docs/pipeline/sweep-rotation.json`** was advanced with
`node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-03T22:10:46Z` → `advanced: last_index=1
last_run_utc=2026-09-03T22:10:46Z`, exit 0. Read back: `git status --porcelain` → ` M
docs/pipeline/sweep-rotation.json`, `git diff --stat` → `1 file changed, 2 insertions(+), 2
deletions(-)`, file content now `"last_index": 1` / `"last_run_utc": "2026-09-03T22:10:46Z"`. The
next run's sweep is **repo-hygiene** (confirmed by re-running `next-sweep.mjs` without `--advance`).

**Left dirty in the dev tree deliberately** — 04 may not commit, and the dev tree is on `main`.
**Station 00 commits it, together with this breadcrumb.** If it is not committed, the next 04 run
repeats instrument-honesty and the rotation silently stops turning.

⚠️ **A third §9.6 instance, produced by this run, worth one line.** My first read-back used the
pathspec `scripts/pipeline/sweep-rotation.json` — the wrong directory. `git status --porcelain --
<path that matches nothing>` returns **empty at exit 0**, byte-identical to "this file is unmodified".
I was one keystroke from reporting the rotation advance as a silent no-op and telling 00 there was
nothing to commit. The correct path shows ` M`. **A pathspec typo and a clean file are the same
reading** — control a `git status` pathspec against a file you know is dirty, exactly as §9.2 already
demands for `ls-tree` and `check-ignore`.

## FINDINGS

### F1 — 🔴 S2, NEW. `@(ConvertFrom-Json …).Count` returns **1** for an empty array AND for a populated one — and it nearly deleted a live trap from DOCTRINE.

**[MEASURED], deterministic, four controls, PS 5.1.26100.9168:**

| form | `[]` (truth 0) | 4-element array (truth 4) |
|---|---|---|
| `@(ConvertFrom-Json $j).Count` — inline | **1** | **1** |
| `@($j \| ConvertFrom-Json).Count` — pipeline | **1** | **1** |
| `$x = ConvertFrom-Json $j; @($x).Count` — assign-then-count | **0** ✅ | **4** ✅ |

Two opposite truths, one answer — §9.6 exactly. PS 5.1's `ConvertFrom-Json` emits a JSON array as a
**single object**, so the array subexpression wraps one item whatever the length.

**Why this is S2 and not a curiosity.** My first pass at T14 used the inline form and read
`short = 1, full = 1`. Written up as measured, that is *"the short-SHA trap has been fixed upstream —
both forms now answer"*, and this sweep's own charter says **"a trap that has been fixed upstream and
still reads as live is itself drift"**. I would have filed a recommendation to **delete a live trap
from the one document every station is told it can trust**. The correct re-measure (assign-then-count)
gave `short = 0, full = 4` — the trap is alive and well.

**DOCTRINE does not currently cover this form.** §7 guard 8 and §9.4 both record the array collapse,
but only as a **`Where-Object`** fault — *"piping a JSON array straight into `Where-Object` collapses
it to ONE object"*. Every station instead **counts** GitHub objects constantly (open PRs, checks,
runs, labels), and the counting form is unrecorded. The `Where-Object` phrasing also reads as a
filtering concern, so an agent counting objects does not recognise itself in it.

**Proposed §9.4 bullet** (exact text, ready to land):

> 🔴 **`@(ConvertFrom-Json …).Count` answers `1` for an EMPTY array and `1` for a forty-element one.**
> PS 5.1 emits a parsed JSON array as a **single object**, so an array subexpression wrapping the
> call — inline or piped — counts one item regardless of length. Measured 2026-09-03 on
> 5.1.26100.9168: `@(ConvertFrom-Json '[]').Count` → **1** (truth 0) and
> `@(ConvertFrom-Json '[{..}x4]').Count` → **1** (truth 4); the pipeline form gives 1 and 1 too.
> **Always assign first, then count:** `$rows = ConvertFrom-Json $raw; @($rows).Count` → **0** and
> **4**, correct in both directions. This is the counting twin of the `Where-Object` collapse above,
> and it is worse, because it silently *refutes* a true finding: it turned
> `gh run list --commit <short>` → `[]` and `--commit <full>` → 4 runs into the identical reading
> `1 / 1`, i.e. "§9.4's short-SHA trap no longer reproduces."

⚠️ This edit lands **inside the `instruments v2` canonical block**, so it needs
`node scripts/pipeline/lint-station.mjs --write-canonical` in the same PR or `lint-station` red-fails
it. §10.3 says hand-land when the content must be exact — binding law, a canonical block — and this
is both.

**DISPOSITION: DISPATCHED → Station 00.** 04 may not create a PR (authority matrix) and this is a
DOCTRINE canonical-block edit, not staging work. Handed over: the measurement, the four controls, the
exact replacement bullet, and the `--write-canonical` requirement.

### F2 — 🟡 S3. §9.2's `git branch -r` bullet names a cause that does not explain today's over-report, and its implied hygiene (`--prune`) cannot fix it.

**[MEASURED]** after `git fetch origin --prune` **this run**: `git branch -r` = **12**,
`git ls-remote --heads origin` = **7**.

The bullet's stated mechanism is *"`git fetch` without `--prune` never deletes a tracking ref, so
branches GitHub deleted on merge live on locally forever."* That is **not what is happening here**.
`git for-each-ref refs/remotes` returns:

```
refs/remotes/origin/HEAD                       <- 7 origin heads + HEAD,
refs/remotes/origin/feat/vs-s2-durable-smoke-pngs        exactly matching the remote.
refs/remotes/origin/feat/wbs-shift-s2-labour-shift-pricing   PRUNE WORKED PERFECTLY.
refs/remotes/origin/fix/agent-defs-double-encoded
refs/remotes/origin/fix1483
refs/remotes/origin/main
refs/remotes/origin/sot-refs-burndown-2026-09-03
refs/remotes/origin/vs-s3-design-ref-frontmatter
refs/remotes/pr/1477      <- the 5 extras. Under refs/remotes/, but NOT under
refs/remotes/pr/1478         refs/remotes/origin/, so no configured refspec owns them.
refs/remotes/pr/1483         remote.origin.fetch = refs/heads/*:refs/remotes/origin/*
refs/remotes/pr/1487         --prune can NEVER remove these. They are permanent.
refs/remotes/pr1273
```

So the **headline is right and if anything stronger** — `git branch -r` reads a local cache; ask the
remote — but the cause is incomplete, and an agent who reads the bullet, runs `--prune`, and re-reads
`git branch -r` will still get 12 and now believes a pruned cache is authoritative. Suggested
amendment: add that `refs/remotes/` can hold refs no refspec owns (hand-made `pr/*` refs from
`git fetch origin pull/N/head:refs/remotes/pr/N`), which `--prune` structurally cannot reach —
**`git ls-remote --heads origin` is the only answer, pruned or not.**

Separately, those 5 refs are dev-tree litter with no owner.

**DISPOSITION: DISPATCHED → Station 00** for the doc amendment (same canonical block as F1 — fold
both into one PR and re-record the hash once), **and → Station 03** for the 5 orphan
`refs/remotes/pr/*` refs as clone/dev-tree hygiene, alongside the 3 orphaned worktrees and 2 registry
escapees the 22:11Z sweep already flagged. 04 does not delete refs in a shared tree.

### F3 — 🟡 Re-confirmation, no new severity. The freshness detector's CADENCE table is unchanged at `bfd2596b`.

**[MEASURED]** `check-breadcrumb.mjs:36` → `CADENCE = { '00': 2, '02': null, '03': 24, '04': 4, '05': 24 }`,
`:35` → *"A station is SILENT past 2x its cadence."* Both exactly as the open escalation records.

This is already with Marco (`needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md`,
options (a)/(b)/(c)), and 00's 21:09Z run measured both failure modes live in one snapshot. I add
nothing to it except that the code is untouched as of `bfd2596b`. **I am not re-raising it** — a
second escalation on one open question is noise that competes with the first.

**DISPOSITION: DEFERRED.** Becomes urgent only if a station is acted on as SILENT/ok on the strength
of this detector before Marco rules.

### F4 — 🟢 Re-verification. RULE 2's decoy probe directory still passes its own positive control.

**[MEASURED]** live 1865 logs / newest `2026-09-03T22:14:48Z` / POS 606 · decoy 21 logs / newest
`2026-08-17T14:28:09Z` / POS **10** / NEG 0. The decoy satisfies the mandated POS>0-NEG=0 control and
would then return "no verdict" for all 5 of today's open PRs — RULE 2 failing **open**. Unchanged
from the measurement that landed in #1553; re-verified against a live tree that moved mid-run
(1864 → 1865), which re-proves that **log age, not POS>0, is the discriminator**.

**DISPOSITION: DEFERRED.** DOCTRINE §9.5 already carries the pin and the cure. Nothing to add; this
is the re-read rule being satisfied, not a new finding.

### F5 — 🟢 No drift. The other ten §9 traps are exactly as documented.

T1, T3, T4, T5, T6, T10, T11, T12, T14, T16-T18, T19, T20 all reproduced with their documented
signatures, each with the positive or negative control the trap itself demands. **No §9 claim was
found to be stale, over-stated, or fixed-upstream-but-still-listed** — apart from F2's cause.

**DISPOSITION: ACTIONED.** The verification is the deliverable; it is recorded above and needs
nothing further.

## WHAT I DID NOT DO

- **T7 — `[CANNOT MEASURE]`, deliberately.** Proving that a plain `git fetch origin main` updates
  `refs/remotes/origin/main` on git 2.55 requires first *mangling* that ref with `update-ref` and
  restoring it after. `C:\ProjectOperations2` is a **shared** tree, §9.2 records its index as shared
  between concurrent chats, and status-sweep showed **2 headless sessions live**. A second actor
  reading a deliberately-wrong `origin/main` inside that window is a §7 instrument lie I would have
  manufactured myself, to test a bullet that is only ⚠️-grade. I drafted the probe, then deleted it.
  I report instead that `remote.origin.fetch = refs/heads/*:refs/remotes/origin/*` is configured —
  which is the mechanism the claim rests on — and leave the bullet unverified rather than take the
  risk. Measuring it wants a throwaway **clone** (not a worktree, §AUTHORITY), which is 03's lane.
- **Parts 0, 1 and 2 of the station brief** (static cross-layer audit, GitHub reconciliation,
  live-site visual patrol). Not skipped — **not mine this run.** AUTHORITY says take the ONE sweep
  `next-sweep.mjs` names and cover it completely, and it named instrument-honesty. Choosing a second
  sweep narrows coverage without rotating it.
- **Staged no prompts.** Both actionable findings are DOCTRINE canonical-block edits, which §10.3
  routes to hand-landing by 00, not to a watcher prompt. Staged-prompt budget used: 0 of 2.
- **Armed, disarmed, merged, labelled, rebased nothing.** 5 open PRs read and left alone. I ran no
  RULE-2 probe for merge purposes because I have no merge authority; T20's probe was a §9.5
  instrument test, not a clearance.
- **Deleted no ref, worktree or lock.** The 5 orphan `refs/remotes/pr/*`, 3 orphaned worktrees, 2
  registry escapees and the dirty watcher clone are all **reported to 03**, not touched.
- **Did not commit `docs/pipeline/sweep-rotation.json` or this breadcrumb.** 04 may not commit; the
  dev tree is on `main` and nobody commits to `main` directly. Both are dirty and waiting for 00.
  ⚠️ The dev tree's index is shared — `git diff --cached --name-status` was **empty** at 22:10Z, so
  nothing of another chat's is staged, but 00 should re-check and commit with an explicit pathspec.

---

**Validator, as the contract requires the command quoted:**
`node scripts/pipeline/check-breadcrumb.mjs` → `ADMIT
00-04-scanner-2026-09-03-2210-instrument-honesty-and-a-count-that-reads-one-either-way.md` ·
`structure: 5 checked, 0 malformed, 0 skipped` · `CLEAN` · **exit 0**. It also correctly warns this
file is UNTRACKED and "reaches nobody until a board PR commits it".

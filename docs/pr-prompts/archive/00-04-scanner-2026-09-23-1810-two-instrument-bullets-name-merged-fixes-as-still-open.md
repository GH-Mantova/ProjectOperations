# Station 04 — Scanner | 2026-09-23T18:10:01Z–2026-09-23T18:22Z

## GROUND

```
UTC            2026-09-23T18:10:01Z
origin/main    dfea18ed            (fetched, then rev-parse)
dev tree       main @ dfea18ed     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was not read-only-by-mismatch.

⚠️ **Clock note, and it is the §9.5 daily-log trap wearing a calendar.** The host is Brisbane
(UTC+10) and its local date is **2026-09-24**; every timestamp in this report is **UTC**, so this
run is stamped 2026-09-23. `[MEASURED]` `(Get-Date -Format o)` → `2026-09-24T04:15:47+10:00`
alongside `(Get-Date).ToUniversalTime()` → `2026-09-23T18:15:46Z`, same call.

**Read transport.** Desktop Commander `start_process` shell `powershell.exe`, reached on the first
call — **this was a SIGHTED run, not a blind one.** `[MEASURED]` `HOSTOK LAPTOP-E6NHU4E4
2026-09-24T04:10:01.5012539+10:00`.

**PREFLIGHT step 2 compliance.** The station doc requires reading the three binding documents from
`git show origin/main:<path>`, never the working copy. `[MEASURED]` the working copy is provably
identical to `origin/main` for all three: `git diff --numstat origin/main -- <path>` returned
**EMPTY** for `docs/pipeline/stations/04-scanner.md`, `docs/pipeline/DOCTRINE.md` and
`docs/pipeline/STATION-CAPABILITIES.md`, and `git rev-list --left-right --count HEAD...origin/main`
→ `0 0`. Per §9.3's length-comparison bullet, EMPTY `--numstat` is the sound form and no piped hash
was compared against anything but another piped hash (probe S below).

**vm-git-guard.** `[MEASURED]` `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`,
exit code read from the INSTALLER and not from a pipeline appended to it:

```
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
```
`GUARD_EXIT=2`

**Exit 2 is the expected station outcome** per the station doc's three-outcome table — a FINDING,
not a STOP. No `git` was run through the device bridge against the Windows `.git` at any point in
this run; every `git` and `gh` call below went through Desktop Commander on the Windows host.

**Sweep taken.** `node scripts/pipeline/next-sweep.mjs` → `SWEEP: instrument-honesty` (rotation
position 2 of 4; previous run 2026-09-23T14:10:00Z). Not chosen — read from
`docs/pipeline/sweep-rotation.json`.

**Fresh negative needle minted for this run: `zzQq04Ndl20260924T0410`.** It returned **0** on every
corpus it was pointed at (see below) and is **spent the moment this file is tracked** — the next run
mints its own (§9.6).

**§9.6's corpus rule was obeyed.** Every probe below was run against the corpus its bullet names,
**never against `DOCTRINE.md`**, which contains a literal instance of every broken query it records.

---

## WHAT I MEASURED

### The sweep: §9 trap-by-trap, 20 probes

| # | §9 bullet | probe (corpus its bullet names) | broken form | truth / control | verdict |
|---|---|---|---|---|---|
| A | 9.2 `ls-tree` without `-r` | `origin/main -- docs/pr-prompts/superseded` | **1** (no slash) | 239 (slash) · 445 (`-r`) | **TRAPPED** |
| B | 9.2 `ls-tree` has no glob pathspec | `-- 'docs/pr-prompts/superseded/*.md'` | **0** | POS control `-- 'docs/pr-prompts/*.md'` also **0** against literal-prefix truth **1362**; `:(glob)` → `fatal: pathspec magic not supported`, exit 128 | **TRAPPED** |
| C | 9.2 `git status` blind to gitignored | `docs/pr-prompts` | `git status --porcelain` → **0 rows** | `git ls-files --others --ignored --exclude-standard` → **5538** | **TRAPPED** |
| C2 | 9.2 `check-ignore` dir-vs-file | same | DIR `docs/pr-prompts/merged` → exit **1**, empty | tracked `CLAUDE.md` (a true negative) → exit **1**, empty — **byte-identical**; a FILE inside → exit **0**, `.gitignore:26:*.log` | **TRAPPED** |
| D | 9.2 `git branch -r` is a local cache | dev tree | **71** | `git ls-remote --heads origin` → **16** | **TRAPPED** |
| E | 9.3 `Measure-Object -Line` drops blanks | `scripts/pipeline/lint-prompt.mjs` | **2282** | `.Count` → **2444**, blanks **162**, `2282+162=2444` exactly | **TRAPPED** |
| F | 9.3 `SimpleMatch` + `[regex]::Escape()` | `docs/pipeline/SCRIPT-REGISTRY.md` | dotted needle escaped → **0** | raw → **3**; a DOTLESS needle escaped → **37** (passes anyway, which is why it hides) | **TRAPPED** |
| G | 9.1 trailing `\*` + `-Recurse` + type filter | purpose-built fixtures A/B/C | fixture **C** (ZERO files at depth 1): star `-Filter -File` **0**, star `-File` **0** | bare **2** / **3**; fixtures **A and B both return 2/2 and 3/3** | **TRAPPED**, and the 2026‑09‑11 fixture correction re-proved |
| H | 9.1 single-quoted `\\` needle | the `SKILL.md` bootstraps (**not** DOCTRINE) | `'C:\\ProjectOperations2\\docs\\pipeline'` → **0** | single-backslash in double quotes → **17 hits** over 11 files | **TRAPPED** |
| I | 9.3 `Filename -Unique` collapses a corpus | same 11 `SKILL.md` | **1** | `Path -Unique` → **7** | **TRAPPED** |
| J | 9.4 `@()` counting | in-process | `@(ConvertFrom-Json '[]')` → **1**; `@(4-elem)` → **1** | assign-then-count → **0** and **4** | **TRAPPED** |
| J2 | 9.4 assign-then-count does not rescue `""` | in-process | `$r=ConvertFrom-Json ""; @($r).Count` → **1** | null guard → **0** | **TRAPPED** — the bullet's falsifying probe ("if it ever answers 0") did **not** fire |
| K | 9.1 `-Command` layer expands `$` | the two prescribed transport rows | nested `powershell.exe -NoProfile -Command "…"` → `$CTRL` consumed, arrives as bare `=42`, `CommandNotFoundException` | direct DC shell → `ROW_A_direct_shell:42`, `USER_IS:Marco` — no expansion | **TRAPPED**, row-for-row |
| L | 9.1 automatic-variable binding | single-quoted `-Command` (preserves `$`) | `foreach ($home in @(1,2,3))` → `Cannot overwrite variable HOME because it is read-only or constant`, **0 rows**, exit 1 | `$loopVar` → `1 2 3` | **TRAPPED**, and NOT the ParserError that would mean probe K fired instead |
| M | 9.4 `gh` infers the repo from CWD | non-repo CWD vs dev tree | no `-R` from `$env:TEMP` → exit **1**, **0** chars stdout | `-R` from TEMP → exit 0/17 chars · dev tree no `-R` → exit 0/17 · NEG control bad repo → exit 1 | **TRAPPED**, four rows |
| N | 9.4 `--commit <SHORT sha>` | `origin/main` head | `dfea18ed` → **0 runs** | full 40-char → **4 runs**: Deploy/push · CodeQL/dynamic · CI/push · Tendering Browser Smoke/push, **all success** | **TRAPPED** |
| O | 9.4 `gh run list --branch main` can be days stale | `origin/main` | newest row headSha **== origin/main head**, createdAt `2026-09-23T17:31:59Z` | — | **NOT REPRODUCED today** (F3) |
| P | 9.4 `gh pr view --json number` fabricates a row | PR 999995 | exit **0**, stdout `{"number":999995}` | `--json number,state` → exit 1, `GraphQL: Could not resolve…`; POS control `#2127` → `{"number":2127,"state":"OPEN"}` | **TRAPPED** |
| Q | 9.4 `merged` unusable on a LIST response | `gh api /pulls?state=closed&per_page=10` | `merged` key **ABSENT on 10 of 10** (the 2026‑09‑07 `gh api` shape, not the MCP `false` shape) | `merged_at` populated **10 of 10**; single GET `/pulls/2128` → `merged=True` | **TRAPPED**, transport-specific shape confirmed |
| R | 9.4 escaped `"` in `--jq` | live PR #2127, direct DC shell | `--jq ".labels \| map(.name) \| join(\",\")"` → arrives as `join(",\)`, `gh` fails **loudly**: `invalid escape sequence "\)" in string literal`, exit **1** | plain single-quoted `--jq '.labels[].name'` → exit **0** | **TRAPPED**; arrival string matches the **2026‑09‑22** re-measurement, not the older illustration |
| S | 9.3 `>` writes UTF-16LE | `origin/main:docs/pipeline/stations/04-scanner.md` | `git show … > file` → **91,894** bytes, first two bytes **0xFF 0xFE**, ratio **2.03×** | node `writeFileSync` → **45,379** bytes, `git hash-object` → `1dce3b9a…` **== `git rev-parse origin/main:<path>`** | **TRAPPED** |
| T | PREFLIGHT: piped `hash-object` is unsound in PS | same file, `HEAD == origin/main`, `--numstat` EMPTY | `git show … \| git hash-object --stdin` → **`ab8532a6…`** | true blob **`1dce3b9a…`** · working copy `1dce3b9a…` · **`cmd /c` control returns the true blob** · `--numstat` → **0 rows** | **TRAPPED** |

**Marker discipline (§9.1's early-return guard).** Every probe script echoed a literal marker after
each statement group and **every marker was present in the drained buffer** (`MARK_A` … `MARK_END_SCRIPT4`).
No statement in this run is `[CANNOT MEASURE]` through a false termination.

**Negative control, everywhere it was run:** `zzQq04Ndl20260924T0410` → **0** over
`docs/pipeline/SCRIPT-REGISTRY.md`, over the 11 `SKILL.md` bootstraps, and over
`origin/main:scripts/pipeline/check-breadcrumb.mjs`. POSITIVE control on that last file,
the token `CADENCE` → **7**.

### The two upstream fixes the documents still describe as pending

```
[MEASURED] git show origin/main:scripts/pipeline/check-breadcrumb.mjs | Select-String 'const CADENCE ='
  const CADENCE = { '00': 1, '02': null, '03': 24, '04': 4, '05': 24 };

[MEASURED] git log -S"'00': 1" --oneline origin/main -- scripts/pipeline/check-breadcrumb.mjs
  dd772da4 fix(pipeline): silence detector had station 00 at a 2h cadence against an hourly cron (#2090)

[MEASURED] gh pr view 2090 -R GH-Mantova/ProjectOperations --json number,state,mergedAt
  {"mergedAt":"2026-09-22T16:44:04Z","number":2090,"state":"MERGED"}

[MEASURED] git log -S'Dependabot Updates' --oneline origin/main -- scripts/pipeline/status-sweep.ps1
  ec7dd590 fix(pipeline): status-sweep trunk verdict excludes dependabot and scheduled runs (TRUNK_VERDICT_SCOPED_V1) (#1852)

[MEASURED] gh pr view 1852 -R GH-Mantova/ProjectOperations --json number,state,mergedAt
  {"mergedAt":"2026-09-11T02:11:13Z","number":1852,"state":"MERGED"}
```

The landed `status-sweep.ps1` denylist reads
`if ($r.workflowName -eq "Dependabot Updates" -or $r.event -eq "schedule") { $otherRuns += $r }`,
and it added a third verdict state the bullet does not describe:
`[CANNOT MEASURE] no trunk-CI run on this commit; NOT a green trunk`.

`check-breadcrumb.mjs --freshness` run live confirms the landed value in behaviour, not only in
source: `00  last 2026-09-23T17:30:00Z  0.8h ago  (cadence 1h)  ok` — exit **0**, `CLEAN`.

**Which document carries which claim — [MEASURED], because I mis-attributed it from memory first and
the grep corrected me.** `git show origin/main:docs/pipeline/DOCTRINE.md | Select-String "'00': 2"`
→ **no match**. The CADENCE claim is in **`STATION-CAPABILITIES.md` §6 only** (anchor: the paragraph
beginning *"AND THE CADENCE IS STORED IN A THIRD PLACE"*). The trunk claim is in **`DOCTRINE.md`
§9.5 only** (anchor: *"The trunk row has a fix OPEN and GREEN on the board as"*).

### Leads (not findings — no disposition, per the contract)

- §9.5's anchor bullet cites `lint-prompt.mjs` as *"(now 1824 lines)"* and §9.3's
  `Measure-Object` bullet quotes `1827 / 121 / 1706`. `[MEASURED]` today: **2444 / 162 / 2282**.
  Both are stamped, dated measurements and both documents say counts are STATE to be re-measured,
  so this is drift-by-design, not a defect — recorded here so the next run does not read the
  discrepancy as a broken instrument.
- §10.1's two falsifying probes both still hold: `NESTED_TEST_PATHS` is still the three-form array
  with `NESTED_TEST_PATHS.some((re) => re.test(p))`, and `extractPrNumber` still carries
  `/(?:PR|pr|pull request)\s*#(\d+)/` — so the prose-scrape defect is live and its repair is still
  Marco's (`scripts/pr-watcher/**`).
- `.arming-log.txt`: working copy **149** lines, `origin/main` **149** lines, tracked (exit 0;
  NEG control on a nonexistent path exit 1). §9.5's gap is **CLOSED at this SHA** — which that
  bullet predicts will happen and un-happen by luck, so this is a reading, not a fix.
- §9.5's `STOP-WATCHER` bullet: `C:\po-watcher\STOP-WATCHER-LANE2` present, `C:\po-watcher\STOP-WATCHER`
  absent, and the pathless probe (searching both git repos) returns **0** — the false
  "the mechanism is gone" reading it warns about reproduces exactly.

---

## WHAT CHANGED

**On the board: nothing.** No prompt armed, disarmed, renamed, moved or deleted. No PR opened,
merged, labelled or commented. No `/sot/` edit. No tracked source file touched. Station 04 is
read-only on the board and stayed that way.

**In the dev tree, two files, both named here so Station 00 can sweep them up:**

1. `docs/pipeline/sweep-rotation.json` — **MODIFIED, left DIRTY and UNCOMMITTED on purpose.**
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-23T18:15:46Z` → exit **0**,
   `advanced: last_index=1 last_run_utc=2026-09-23T18:15:46Z`, and the tool printed
   *"LEFT DIRTY: name this file in your breadcrumb. Station 00 commits it."*
   Read back: `git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` → `2 2`,
   `git status --porcelain --untracked-files=no` → ` M docs/pipeline/sweep-rotation.json`.
   **04 may not commit to the shared dev tree (authority matrix: Create a PR NO, Mutate the board
   NO).** Next sweep is position 3 of 4, `repo-hygiene`.

2. **This breadcrumb** — `docs/pr-prompts/00-04-scanner-2026-09-23-1810-two-instrument-bullets-name-merged-fixes-as-still-open.md`,
   **UNTRACKED** until a board PR commits it.

🔴 **Both of these block the dev tree's next `git merge --ff-only` if a PR lands either exact path
on `main` first** (station doc, the breadcrumb-blocks-fast-forward bullet) — and `--numstat` /
`--cached` both read EMPTY in that state, which is the documented PASS reading. Station 00: the
fourth read-back, `git status --porcelain` (tracked), is the one that catches it.

Scratch `.ps1` probe files were written to the disposable Cowork `outputs` folder only. Fixtures
were built under `$env:TEMP` and are disposable. Nothing was written to any gitignored sink — in
particular **not** to `docs/qa/qa-findings.md`, `qa-checklist.md`, `qa-test-data-registry.md`,
`.qa-run.lock` or `qa-run-*.md`.

---

## FINDINGS

### F1 — `STATION-CAPABILITIES.md` §6 tells every station the silence detector is weak for Station 00. It was fixed two days ago, and the paragraph names the probe that proves it.

**Severity S3** — a stale instruction in a binding document, failing in the *reassuring* direction.

§6 states: *"`scripts/pipeline/check-breadcrumb.mjs` keeps its own `CADENCE` map, and `00` in it
still reads **2**"*, *"`--freshness` … will not call `00` SILENT until 4 h, i.e. only after three
consecutive missed hourly runs"*, *"a green `ok` from `--freshness` is a weaker statement about `00`
than about any other station"*, and *"The fix is one character (`'00': 1`) … it is filed for Marco
in the needs-marco queue."*

`[MEASURED]` at `dfea18ed`: the map reads **`'00': 1`**. It has since `dd772da4` / **PR #2090**,
merged **2026-09-22T16:44:04Z** — **~26 hours** before this run. The live `--freshness` output
confirms it in behaviour: `00 … (cadence 1h) ok`, exit 0.

**The paragraph's own falsifying probe is the `const CADENCE =` line, and it fires.** The bullet
even anticipates this — *"Do not read this paragraph as the fix having landed"* — which is correct
advice that has now inverted: a reader who obeys it treats a landed fix as pending.

**Why it costs something rather than merely being untidy.** §6 tells the reader to cross `--freshness`
against `lastRunAt` from the scheduled-tasks MCP *because the detector is weak for 00*. That
cross-check now buys nothing and costs a turn on every COLLECT. Worse, the paragraph says the fix is
**filed for Marco in the needs-marco queue** — so a run doing queue triage re-surfaces a discharged
item to Marco, which is the exact cost `#2090` was merged to remove. This is §9.5's closing bullet
(*a claim that names no live probe outlives its own truth*) reproduced in the file that exists to
settle capability disputes.

⚠️ **Scope check, `[MEASURED]`, because I got it wrong from memory first:** `DOCTRINE.md` does **not**
carry this claim (`Select-String "'00': 2"` over `origin/main:docs/pipeline/DOCTRINE.md` → no match).
**Only `STATION-CAPABILITIES.md` §6 needs editing**, and it is **outside** the hash-gated canonical
block, so no hash re-record and no seven-doc ship is needed for this one.

⚠️ **Do not delete the paragraph.** Its RULE — *read the live cron from the scheduled-tasks MCP,
never from this file* — is what saves a careful reader and is untouched. What is false is only the
dated state sentence and the "filed for Marco" clause.

**RULE 1 options for Station 00 / Marco.**

- **(A) Complete + additive — recommended.** Replace the state sentence with the measurement and its
  discharge (`'00': 1` since `#2090`, merged 2026-09-22T16:44:04Z), strike the *"filed for Marco"*
  clause, strike the *"weaker statement about `00`"* warning, and **keep** the MCP cross-check as
  general practice with its reason restated (`lastRunAt` is a different instrument, not a patch for
  a wrong constant). Add the standing falsifying probe: *if `const CADENCE =` ever shows `'00'` at
  anything but the live cron's hours, this is wrong again.* Passes both halves — it removes the
  false claim permanently and destroys no guidance.
- **(B) Strike the paragraph entirely.** Fails the *future* half: the MCP-not-this-file rule and the
  third-storage-location warning go with it, and the next constant to drift has nothing to catch it.
- **(C) Leave it and note it in a breadcrumb.** Fails the *immediately* half — this is the fourth
  document-drift class §9.5 records, and prose notes are what let the previous three run for weeks.

Also worth one check while in there: `docs/pr-prompts/needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md`
exists and mentions CADENCE. Whether `#2090` discharges it is **[CANNOT MEASURE]** from this run —
I did not read it, and re-verifying another actor's artifact against the live system before acting
on it is DOCTRINE 7.1's re-read rule, which belongs to whoever picks it up.

**DISPOSITION: DISPATCHED** — to **Station 00**. `docs/` is 00's recorded lane and 04 is read-only
on the board; I may not open the PR that fixes this. Handing over: the file (`STATION-CAPABILITIES.md`
§6), the anchor (*"AND THE CADENCE IS STORED IN A THIRD PLACE"*), the measurement, the discharging
PR (#2090, `dd772da4`), and option (A) above.

---

### F2 — `DOCTRINE.md` §9.5 has called PR #1852 "OPEN and GREEN on the board" for thirteen days. It merged on 2026-09-11.

**Severity S3** — same class as F1, one layer deeper, and it sits inside the hash-gated block.

The `SWEEP_LIVE_LINES_ARE_NOT_EXEMPT_V1` bullet ends: *"The trunk row has a fix **OPEN and GREEN on
the board** as `#1852` (`TRUNK_VERDICT_SCOPED_V1`), and it is Marco's to merge, so that row is
expected to die."*

`[MEASURED]`: `gh pr view 1852 … --json state,mergedAt` → `{"state":"MERGED","mergedAt":"2026-09-11T02:11:13Z"}`,
and the denylist is on `origin/main` in `scripts/pipeline/status-sweep.ps1` at `ec7dd590`:
`if ($r.workflowName -eq "Dependabot Updates" -or $r.event -eq "schedule") { $otherRuns += $r }`.

**This bullet is the best-behaved one in §9 — it wrote its own death certificate and named the probe
that signs it** (*"Verified against the PR's DIFF, never its title: applying its denylist … gives
4 success / 0 failed → `(trunk green)`"*). Nobody ran the probe for thirteen days. That is the
measured failure: a falsifying probe nobody executes is a comment.

**The residual cost is small but real and it is in the arming direction of noticing-too-little.**
A run reading §9.5 is told one of the two worked instances of *"a `[LIVE]` line can be a wrong
derived verdict"* is still live on the board. It is not, so the section's evidence for its own
headline is now half-stale — and the headline (*provenance is not correctness; re-derive a `[LIVE]`
line from its own source before acting on it*) is **correct and must survive any edit**. The landed
script also added a state the bullet never describes — `[CANNOT MEASURE] no trunk-CI run on this
commit; NOT a green trunk` — so a reader comparing the bullet against the script today finds a
third branch and no explanation for it.

⚠️ **This is inside `<!-- CANONICAL-BLOCK: instruments v2 -->`.** `scripts/pipeline/lint-station.mjs`
fails on any edit without a re-recorded hash, and the block comment requires shipping all seven
station docs together. **That is a Station 00 job with a doc-reconcile shape, not a one-line tidy,
and it is why I am not staging a prompt for it** (see WHAT I DID NOT DO).

**RULE 1 options.**

- **(A) Complete + additive — recommended.** Rewrite the trunk row as a **discharged** instance:
  keep the measurement (a single Dependabot run flipped the headline with no commit between
  readings), record that `#1852` merged `2026-09-11T02:11:13Z` at `ec7dd590` and that the denylist
  is live, document the third `[CANNOT MEASURE]` branch the script now emits, and keep the clone
  row — which probe #C/#C2 above show is untouched — as the surviving live instance. The headline
  rule stands unweakened. Re-record the block hash and ship the seven docs in one doc-reconcile PR.
  Passes both halves.
- **(B) Delete the trunk row.** Fails the *future* half: it is one of only two worked instances
  behind the *provenance-is-not-correctness* rule, and a rule with one example is the rule that gets
  argued with next.
- **(C) Defer until the next canonical-block edit rides along.** Fails the *immediately* half by
  exactly the mechanism that produced this finding — thirteen days is already the answer to how long
  "next time" takes.

**DISPOSITION: DISPATCHED** — to **Station 00**, together with F1 (both are documentation-layer
repairs and F2 forces a canonical-block hash re-record, so they are cheaper in one PR than two).
Handing over: the file and anchor, the merge evidence, the landed denylist source line, the new
third branch, and option (A).

---

### F3 — `gh run list --branch main` did **not** reproduce its documented staleness this run, and the bullet is not thereby refuted.

**Severity S4 (observation).** The sweep brief names this probe explicitly and requires me to report
what I could not reproduce.

`[MEASURED]` `gh run list -R GH-Mantova/ProjectOperations --branch main --limit 10 --json
headSha,conclusion,workflowName,createdAt`: **10 rows**, newest `createdAt 2026-09-23T17:31:59Z`,
newest `headSha` **`dfea18ed9fd76eee189a7660efde527ee0c984fa`** — **byte-equal to `git rev-parse
origin/main`**. The per-commit cure returned the same trunk picture (4 runs, all `success`). So on
this board, at this moment, the branch form and the per-commit form **agree**.

🔴 **This is a non-reproduction, not a retirement, and the distinction is the whole point of this
sweep.** The bullet's claim is *"**can** be DAYS stale"* — a possibility claim, which one agreeing
sample cannot refute. `origin/main` was last pushed ~10.7 h ago and the newest run is 4 minutes
younger than that push, so there has been **no window in which the branch listing could drift**.
The trap's precondition was absent; the trap was not tested. Writing this up as *"§9.4's branch-stale
bullet no longer reproduces"* is precisely the §9.6-shaped error this rotation exists to prevent —
and §9.4 already records one instance of exactly that (the `@()` counting bug *silently refuted* the
short-SHA trap by answering `1 / 1`).

The cure — **read CI per-commit with the full 40-char SHA** — costs nothing, is correct in both
directions, and is independently re-proved by probe **N** above, which **did** reproduce (short SHA
→ 0 runs against a truth of 4). **Nothing to change.**

**DISPOSITION: DEFERRED.** What would make it urgent: a run that measures a genuine divergence
(branch-listing `headSha` ≠ `origin/main` while per-commit shows runs) and can therefore *re-arm*
the claim with a date, **or** a run that reproduces agreement across a period where `main` has moved
and the listing has had something to lag behind. Neither condition existed today. Re-test on the
`instrument-honesty` rotation after a busy push day, not on a quiet one.

---

### F4 — `vm-git-guard` reports INSTALLED BUT INERT, so the device-bridge git ban is remembered, not mechanical.

**Severity S3** — reported because the station doc requires the installer's last line and exit code
to be quoted whatever the outcome, and because "an install nobody can see in the report is
indistinguishable from one that never ran".

`[MEASURED]` exit **2**, headline
`vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
The installer's own controls, printed in the same run: `bash -lc 'command -v git'` →
`/sessions/hopeful-intelligent-gates/.local/bin/git` (the shim); `bash -c 'command -v git'` →
`/usr/bin/git` (the real one). A station's shell is non-interactive and non-login, so neither
`~/.bashrc` nor `~/.profile` is sourced.

**This is the EXPECTED outcome per the station doc's three-outcome table, not an anomaly** — a
FINDING to quote and carry on from, never a STOP. It is recorded because DOCTRINE §9.2 counts seven
failures of the remembered form of this ban, and because a report that omits it leaves the next
reader unable to tell an inert guard from an absent one.

**No action was needed and none was taken:** this run ran **zero** `git` commands through the device
bridge. Every `git`, `gh` and `node` call above went through Desktop Commander on the Windows host,
which is the sanctioned transport and is unaffected by the shim's reachability.

**DISPOSITION: DEFERRED.** What would make it urgent: a station needing to run `git` from the VM
side at all — at which point the one-call form
`PATH="/sessions/<id>/.local/bin:$PATH" git <args>` is the prescribed cure and is already printed by
the installer. Making the ban mechanical for a non-login shell is a `scripts/` change and therefore
Marco's; it is **not** escalated here because the existing escalation surface already covers the
guard and the remembered ban has held for this run and every command in it.

---

## WHAT I DID NOT DO

- **I did not arm, disarm, rename, move or delete any prompt**, and I staged **no** `-HOLD` prompt
  this run. My budget allows up to two; F1 and F2 are documentation repairs in `docs/pipeline/`,
  which is Station 00's lane, and F2 additionally requires a `lint-station.mjs` canonical-block hash
  re-record plus a seven-document ship — a doc-reconcile PR shape, not a staged fix prompt. Staging
  one would hand 00 a prompt it must rewrite before using. Dispatched instead.
- **I did not commit `docs/pipeline/sweep-rotation.json`**, although its advance is mine to run.
  The authority matrix gives 04 *Create a PR: NO* and *Mutate the board: NO, read-only*, and the dev
  tree is on `main`, which nobody commits to directly. It is left dirty and named above.
- **I did not mint a throwaway worktree.** `origin/main` was read at a named SHA with `git show` and
  `git rev-parse`, per the AUTHORITY section — an orphaned worktree's lock has no holding process by
  construction, forever.
- **I did not run PART 1's GitHub reconciliation audit or PART 2's live-site visual patrol.** The
  station doc requires ONE named sweep per run covered **completely**; `next-sweep.mjs` named
  `instrument-honesty` and 20 probes across §9.1–§9.6 is what completely means here. A shallow pass
  over everything is what the rotation exists to prevent.
- **I did not run the remaining Part 0 sub-checks** (b)–(f). Same reason: the rotation, not the
  brief's older sub-check cycle, governs which ground this run covers.
- **I did not touch Azure, Entra or SharePoint**, in any form, read or write.
- **I did not clear, inspect-and-clear, or act on any lock.** No `index.lock` was encountered;
  clearing one is Station 03's on 00's dispatch.
- **I did not write to any of the five gitignored `docs/qa/` sinks**, and I did not write the
  GitHub-audit marker block, because PART 1 did not run.
- **I did not re-verify `needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md`
  against `#2090`.** Named in F1 as a lead for whoever picks it up; acting on another actor's
  artifact without re-verifying its central claim is what DOCTRINE 7.1's re-read rule forbids, and
  re-verifying it properly is a triage pass, not a line in an instrument sweep.

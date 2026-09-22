# Station 04 — Scanner | 2026-09-22T18:10:25Z–2026-09-22T18:22Z

## GROUND

```
UTC            2026-09-22T18:10:25Z
origin/main    25aa3115            (fetched first, then rev-parse)
dev tree       main @ 25aa3115      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE — this run was not forced read-only by a version mismatch.

Sighted run. Desktop Commander present; `start_process` shell `powershell.exe` answered on the first
call. Host PS is the ordinary dev-tree shell; CWD pinned to `C:\ProjectOperations2` on every batch
(§9.4 CWD bullet) and `-R GH-Mantova/ProjectOperations` passed on every `gh` call.

Sweep this run: **instrument-honesty** (`node scripts/pipeline/next-sweep.mjs` → rotation position
2 of 4; previous run 2026-09-22T06:10:45Z). Advanced at the end with
`--advance --utc 2026-09-22T18:10:25Z` → `advanced: last_index=1 last_run_utc=2026-09-22T18:10:25Z`,
exit 0. **`docs/pipeline/sweep-rotation.json` IS LEFT DIRTY IN THE DEV TREE (` M`) — Station 00
commits it; 04 may not.**

Binding documents read this run, in full for the sections that govern the sweep: `DOCTRINE.md`
(§1–§9.6), `STATION-CAPABILITIES.md` (whole file), `docs/pipeline/stations/04-scanner.md` (whole
file). **Freshness proved, not assumed:** `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/04-scanner.md` → **EMPTY**, and
`git rev-list --left-right --count HEAD...origin/main` → **`0 0`**, so the working copy is
byte-identical to `origin/main` for all three and reading it is sound (§9.3's compare-content rule).

vm-git-guard installed at the top of the run, before any VM-side call:
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` — last line
`   PATH="/sessions/modest-brave-shannon/.local/bin:$PATH" git <args>`, headline
`vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`,
**installer exit code 2** (read directly from the installer, not from a pipeline appended to it).
Per the contract that is the EXPECTED station outcome and a FINDING, not a STOP — see F1. No `git`
was run against the mount at any point in this run; every git call went through the Windows shell.

## WHAT I MEASURED

Every probe below was run **against the corpus its own bullet names, never against `DOCTRINE.md`**
(§9.6's 2026-09-07 rule). Every statement chain carried a literal marker after each statement
(§9.1 guard 1); all markers were present unless stated otherwise.

### §9.1 — the shell

| probe | form | result | truth / documented | verdict |
|---|---|---|---|---|
| P10 row A | `start_process` shell `powershell.exe`, statements sent **direct**, `$CTRL=42` | `P10_ROW_A_direct_shell:42` | no expansion layer on the direct transport | **as documented** |
| P10 row B | same transport, command = `powershell.exe -NoProfile -Command "$CTRL=42; …"` | `The string is missing the terminator: ".` | `$CTRL` consumed before the child parsed | **REPRODUCES** |

[MEASURED] Both rows of §9.1's 2026-09-14 `COMMAND_LAYER_EXPANSION_IS_THE_NESTED_FORM_V1`
correction reproduce exactly. Its falsifying probe — row B ever printing
`ROW_B_nested_Command:42` — **did not fire**. The bullet stands; the cure (anything with `$` in a
`.ps1` run with `-File`) stands unconditionally.

| P18 fixture | files at depth 1 | bare `-Recurse -Filter -File` | star `-Recurse -Filter -File` | bare `-Recurse -File` | star `-Recurse -File` |
|---|---|---|---|---|---|
| A — a `.log` at depth 1 | 1 | 2 | **2** | 3 | **3** |
| B — `.log` only deeper, `top.txt` at depth 1 | 1 | 2 | **2** | 3 | **3** |
| C — **ZERO files of any kind at depth 1** | **0** | 2 | **0** | 3 | **0** |

[MEASURED] Fixtures rebuilt from scratch under `%TEMP%\p18fix`, truth known by construction (each:
2 `.log`, 3 files, one subdirectory level), PS 5.1 on the dev box. The 2026-09-11
`FIXTURE_B_NEEDS_ZERO_FILES_V1` correction **reproduces row for row**: only fixture C's star columns
collapse to 0. Its falsifying probe (C's star columns returning 2 and 3) **did not fire**. The rule
stands: with `-Recurse`, pass the BARE directory and use `-Filter`; never combine a trailing `\*`
with `-Recurse` and a type filter.

### §9.2 — git

| probe | command | result | truth | verdict |
|---|---|---|---|---|
| P1a | `git ls-tree --name-only origin/main -- docs/pr-prompts/superseded` | **1** | the tree entry itself | **REPRODUCES** |
| P1b | same, trailing slash `…/superseded/` | **237** | direct children | as documented |
| P1c | same with `-r` | **443** | everything below | as documented |
| P2a | `git ls-tree -r --name-only origin/main -- 'docs/pr-prompts/*.md'` | **0** | glob pathspec unsupported, silent | **REPRODUCES** |
| P2b | same without `-r` | **0** | `-r` never rescues a zero glob | **REPRODUCES** |
| P2c | POSITIVE control `-- docs/pr-prompts/` (no `-r`) | **30** | depth-1 children exist | control passed |

[MEASURED] The depth trap and the silent-glob trap are both live. The bullet's worked example
(`1` without `-r` / `252` with it, at `b19f3db9`) now reads 1 / 237 / 443 — the mechanism is
identical; only the corpus size moved, which is STATE and is why the bullet quotes a SHA.

| probe | command | exit | stdout | verdict |
|---|---|---|---|---|
| P3a | `git check-ignore -v docs/pr-prompts/needs-marco` (DIRECTORY) | **1** | empty | **REPRODUCES** |
| P3b | `git check-ignore -v CLAUDE.md` (tracked, genuinely not ignored) | **1** | empty | byte-identical to P3a |
| P3c | `git check-ignore -v docs/qa/qa-findings.md` (FILE, ignored) | **0** | `.gitignore:116:docs/qa/qa-findings.md` | control passed |

[MEASURED] Opposite truths, identical results on the directory form. **Only the file form answers.**
Trap live.

| probe | command | result | verdict |
|---|---|---|---|
| P4a | `git ls-files --others --ignored --exclude-standard -- docs/pr-prompts` | **5482** | — |
| P4b | `git status --porcelain -- docs/pr-prompts` | **2** rows | — |

[MEASURED] `git status` is structurally blind to 5482 ignored files under the queue folder while
reporting 2. Trap live.

| probe | command | result | verdict |
|---|---|---|---|
| P5a | `git branch -r` | **147** | — |
| P5b | `git ls-remote --heads origin` | **16** | — |

[MEASURED] The local remote-tracking cache over-reports the remote **9.2×**. Documented history:
54 against 21 (2026-08-29), 12 against 7 (2026-09-03). See **F3** — this is the largest gap this
pipeline has recorded and it is STATE, not a doctrine defect.

| probe | command | result | verdict |
|---|---|---|---|
| P21 true blob | `git rev-parse origin/main:docs/pipeline/DOCTRINE.md` | `27223f6f176a9b09…` | — |
| P21 piped, PowerShell | `git show …:DOCTRINE.md \| git hash-object --stdin` | **`6b80e9445625335b…`** | **REPRODUCES** |
| P21 piped, `cmd /c` | identical pipeline under `cmd /c` | `27223f6f176a9b09…` | as documented |
| P21 working copy | `git hash-object docs/pipeline/DOCTRINE.md` | `27223f6f176a9b09…` | control passed |
| P21 numstat | `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md` | **EMPTY** | the real answer |

[MEASURED] The piped form is unsound in `powershell.exe` and sound under `cmd /c`, exactly as the
station contract records. Both forms exit 0 and both print a well-formed 40-hex SHA.

### §9.3 — files and encoding

| probe | command | result | truth | verdict |
|---|---|---|---|---|
| P16 | `(Get-Content scripts\pipeline\lint-prompt.mjs).Count` | **2444** | 2444 | correct form |
| P16 | `… \| Measure-Object -Line`.Lines | **2282** | — | **REPRODUCES** |
| P16 | blank lines in the same file | **162** | 2444 − 162 = **2282** | mechanism confirmed exactly |
| P20 | `git cat-file -s origin/main:CLAUDE.md` | **1960** bytes | — | — |
| P20 | `git show origin/main:CLAUDE.md > file`, then file size | **3974** bytes, first two bytes **`FF FE`** | UTF-16LE, ~2× | **REPRODUCES** |
| P19 | `Select-String -SimpleMatch -Pattern 'lint-prompt.mjs'` over `scripts\pipeline\*.mjs` | **36** | — | — |
| P19 | same with `[regex]::Escape(...)` → `lint-prompt\.mjs` | **0** | 36 | **REPRODUCES** |
| P19 | dotless POSITIVE control `'process'` | **193** | — | control passed |

| P17 — `Filename -Unique` collapse, corpus `C:\Users\Marco\Claude\Scheduled\**\SKILL.md` | result | truth |
|---|---|---|
| corpus size (bare dir + `-Recurse -Filter 'SKILL.md' -File`) | **11** | 11 |
| total hits for needle `C:\ProjectOperations2\docs\pipeline` | **17** | 17 |
| `… \| Select-Object -ExpandProperty Filename -Unique` — the failing form | **1** | 7 |
| `… \| Select-Object -ExpandProperty Path -Unique` — the cure | **7** | 7 |

[MEASURED] `FILENAME_UNIQUE_COLLAPSES_SAME_NAMED_CORPUS_V1` reproduces **row for row, number for
number**, against the 2026-09-21 table. Its falsifying probe (`Filename -Unique` ever returning 7)
**did not fire**.

### §9.4 — GitHub

| probe | command | exit | result | verdict |
|---|---|---|---|---|
| P6 | `gh run list -R … --branch main --limit 5` | 0 | newest run `2026-09-22T17:59:20Z` — **11 minutes old at the moment of reading** | **NOT stale today** — see below |
| P7 full | `gh run list -R … --commit 25aa311537133e18fa223bcf2aa1dd726eb5d3d6` | 0 | **8** runs | control passed |
| P7 short | `gh run list -R … --commit 25aa3115` | **0** | **`[]`**, count **0** | **REPRODUCES** |

[MEASURED] The short-SHA trap is live: `[]` at exit 0, no error and no warning, against a truth of 8.
The `--branch main` bullet says that query *can* be days stale; today it was 11 minutes old, which
is **not a refutation of a possibility claim** — a "can be stale" bullet is not falsified by one
fresh reading. The per-commit cure stands, and P7 short shows exactly why the cure needs the full
40-char SHA.

| probe | expression | result | verdict |
|---|---|---|---|
| P8 | `$n = ConvertFrom-Json ""; @($n).Count` | **1** | **REPRODUCES** — falsifying probe did not fire |
| P8 | same with null guard `@($n \| Where-Object { $null -ne $_ }).Count` | **0** | cure works |
| P8 | `@(ConvertFrom-Json '[]').Count` — inline | **1** | **REPRODUCES** |
| P8 | `$z = ConvertFrom-Json '[]'; @($z).Count` — assign-then-count | **0** | cure works |

| P11 — PR existence, `gh version` on the box, `-R` on every call | exit | stdout |
|---|---|---|
| `gh pr view 999999 --json number` — the failing form | **0** | **`{"number":999999}`** |
| `gh pr view 999999 --json number,state` | 1 | empty |
| `gh pr view 999999 --json state` | 1 | empty |
| `gh pr view 2093 --json number,state` — POSITIVE control, open | 0 | `{"number":2093,"state":"OPEN"}` |
| `gh pr view 2092 --json number` — POSITIVE control, merged | 0 | `{"number":2092}` |

[MEASURED] All five rows reproduce exactly. The falsifying probe (row 1 exiting 1, or row 2 exiting
0) **did not fire**. `--json number` alone still fabricates a row for any integer.

| P14 — CWD trap, `gh pr list --state open --json number` | exit | stdout chars |
|---|---|---|
| non-repo CWD (`C:\Users\Marco\AppData\Local\Temp`), no `-R` — the failing form | **1** | **0** |
| non-repo CWD, with `-R` | 0 | 17 |
| dev-tree CWD, no `-R` | 0 | 17 |
| dev-tree CWD, with `-R` | 0 | 17 |
| NEGATIVE control, `-R GH-Mantova/NoSuchRepoZzQq0922` | **1** | 0 |

[MEASURED] Reproduces row for row. Falsifying probe (row 1 ever returning stdout) **did not fire**.

| P12 / P15 — `--jq` through the shell | exit | output |
|---|---|---|
| `--jq '.labels[].name'` (single-quoted, no escaped double quotes) on `#2093` | 0 | **`do-not-merge`** |
| `--jq ".labels \| map(.name) \| join(\",\")"` — escaped double quotes | **1** | `failed to parse jq expression … join(",\) … invalid escape sequence "\)" in string literal` |

[MEASURED] Both halves of the corrected §9.4 bullet reproduce: a plain jq expression survives intact
and returns a CORRECT label reading, and escaped double quotes fail **LOUDLY**, never silently. One
wording nit — see **F2**.

| P13 — `merged` field, `gh api /repos/…/pulls?state=closed&per_page=10` | result |
|---|---|
| entries returned | **10** |
| entries where the `merged` key is **defined at all** | **0** (absent, not `false`) |
| entries where `merged_at` is populated | **10** |
| POSITIVE control, single GET `/pulls/2092` | `merged=True merged_at=2026-09-22T17:33:40Z` |

[MEASURED] The 2026-09-07 transport correction reproduces exactly: through `gh api` the key is
ABSENT on every list entry while `merged_at` is correct on all ten, and the single GET answers
`true`. A reader who goes looking for the documented `false` through `gh` and does not find it must
NOT retire the bullet.

### §9.6 — the rule behind all of them

Corpus: `docs/pr-prompts/*.md` at depth 1 + `docs/pr-prompts/needs-marco/*.md` — **84 files**.

| needle | hits |
|---|---|
| the long-prescribed `zzz`+`NoSuchNeedleZzz` | **2** |
| the long-prescribed `zzz`+`NoSuchTokenZzz` | **0** |
| a needle minted fresh for this run | **0** |
| POSITIVE control `premise` | **82** |

[MEASURED] The first prescribed "negative control" still returns hits and is therefore still not a
negative control. The minted needle returned 0 and is now spent by appearing in this tracked file —
which is the rule, not an oversight.

### THE BOARD TRAP (station-doc AUTHORITY item)

| probe | result |
|---|---|
| tracked `*-ready.md` anywhere under `docs/pr-prompts/` on `origin/main` (`git ls-tree -r`) | **175** |
| of those, at **depth 1** — the only level `READY_PATTERN` matches | **0** |
| `*-ready.md` on disk at depth 1 in the dev tree | **0** |

[MEASURED] **The board trap does not fire this run.** All 175 tracked ready-files sit under
`superseded/…` (174) or `processed/` (1). Nothing is armed and a checkout would re-arm nothing,
because the watcher's `fsWatch(PROMPT_DIR)` is non-recursive and `READY_PATTERN` matches depth 1
only. See F5 for the one file that is gitignored-by-rule and tracked-in-fact.

### PART 0 (a) — AUTHORIZATION PARITY (the brief's ALWAYS sub-check)

Corpus: every `.ts`/`.tsx` tracked under `apps/web/src` — **593 files**, enumerated with
`git ls-files` and read with node (never `Get-Content`).

| measure | count |
|---|---|
| POSITIVE control — bare `permissions?.includes(` sites that ARE super-aware | **14** |
| POSITIVE control — `can(user, …)` sanctioned-helper call sites | **90** |
| bare-includes sites with no `isSuperUser` in a ±3-line window | **2**, both inside `apps/web/src/auth/__tests__/superuser-parity.guard.test.ts` — the guard's own regex written as documentation |
| **real offenders** | **0** |
| `<Navigate>` sites total | 44 |
| `<Navigate>` sites inside a real guard EXPRESSION | 2 |
| of those, with no `isSuperUser` literal | 1 — `apps/web/src/App.tsx:160`, read in source: `const hasField = can(user, "field.view"); if (!hasField) return <Navigate to="/" replace />;` — routed through the sanctioned `can()` helper, which short-circuits on `isSuperUser`. **NOT an offender.** |

[MEASURED] **Zero new super-user parity offenders.** The positive controls are quoted alongside the
zero exactly because a blind grep must not be mistaken for a clean result. Two false positives were
manufactured by my own instrument on the way to this number — see **F6**.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced to `last_index=1`,
  `last_run_utc=2026-09-22T18:10:25Z`, exit 0. **LEFT DIRTY in the dev tree** (` M`). Station 00
  commits it; 04 is read-only on the board and must not.
- This breadcrumb, written to `docs/pr-prompts/` in the dev tree. **Untracked until a board PR
  commits it** — Station 00 sweeps it up. It is not in any of the five gitignored `docs/qa/` sinks.
- Scratch only, outside the repo and outside the session outputs folder:
  `C:\po-sup-fix-scripts\p0a-parity-20260922.mjs`, `C:\po-sup-fix-scripts\p0a-nav-20260922.mjs`,
  `C:\po-sup-fix-scripts\p0a-nav-report.txt`, and three throwaway fixture trees under `%TEMP%`.
- **Nothing on the board.** No prompt staged, armed, renamed, moved or deleted. No PR opened,
  labelled or merged. No `/sot/` file touched. No Azure / Entra / SharePoint contact of any kind.

## FINDINGS

### F1 — the device-bridge git ban is REMEMBERED, not mechanical, in this run's shell

[MEASURED] `vm-git-guard.sh` exited **2** with headline `vm-git-guard INSTALLED BUT INERT - the shim
is correct and UNREACHABLE from your shell.` Its own controls: `bash -lc 'command -v git'` → the
shim; `bash -c 'command -v git'` → `/usr/bin/git`. This is the middle outcome the station contract
names as EXPECTED for a station, because the shell a station is given is non-interactive and
non-login and sources neither `~/.bashrc` nor `~/.profile`.

No `git` was run against the mount at any point in this run — every git call in this report went
through the Windows shell via Desktop Commander.

**DEFERRED** — real, not now. It is the documented expected outcome and the contract already tells
every station to carry on. What would make it urgent: an exit **other than 0 or 2** (the shim not
written at all), or any station reporting a 0-byte `index.lock` with no owning Windows process,
which is the damage the guard exists to prevent (DOCTRINE §9.2).

### F2 — §9.4's escaped-`--jq` bullet quotes a mangled arrival string that no longer matches the measurement

[MEASURED] The bullet states that `join(\",\")` *"arrives as `join(,\)`"*. Measured today at
`25aa3115` through the direct Desktop Commander shell, the same expression arrives as **`join(",\)`**
— the first double quote survives — and `gh` reports
`invalid escape sequence "\)" in string literal`. The **headline rule is unchanged and was
confirmed**: escaped double quotes fail LOUDLY, and the plain single-quoted form returns a correct
label reading (`do-not-merge` on `#2093`, POSITIVE control).

This is illustration drift of exactly the shape §9.2's own `ls-tree` bullet records having been
corrected for in 2026-08-31 — *"The headline rule was never wrong; its illustration was."* It
matters only because a reader hunting for the literal string `join(,\)` will not find it and may
read that as a non-reproduction.

**DISPATCHED** to Station 00 — a one-line correction to the arrival string in `DOCTRINE.md` §9.4,
`docs/`-only and inside 00's recorded lane. Handing over: the measured arrival string, the exit
code (1), and the full `gh` error text quoted above. **Nothing is retired.**

### F3 — the dev tree's remote-tracking cache now over-reports the remote 9.2×, the worst gap recorded

[MEASURED] `git branch -r` → **147**; `git ls-remote --heads origin` → **16**. Documented history in
§9.2: 54 against 21 (2026-08-29), then 12 against 7 immediately after a `--prune` (2026-09-03).

The doctrine bullet is **live and unchanged** — ask the remote, pruned or not. What is new is the
magnitude: 131 tracking refs in the dev tree name branches the remote does not have. §9.2 also
records that `--prune` cannot remove refs no refspec owns (hand-made `refs/remotes/pr/N` entries),
so a prune would shrink this but is not guaranteed to close it, and I did not run one — pruning is a
mutation of a shared tree and 04 is read-only.

Blast radius: any run that enumerates branches from `git branch -r` — worktree teardown decisions,
stranded-branch hunts, "is this branch still alive" checks — inherits a 9× over-count and dresses it
as a finding.

**DISPATCHED** to Station 00. Handing over: the two counts above at `25aa3115`, and the decision of
whether to run `git fetch origin --prune` in the dev tree (safe, but a shared-tree mutation and
therefore 00's call, not 04's) plus whether the leftover `refs/remotes/pr/*` refs should be cleared
separately.

### F4 — the long-prescribed negative-control needle is still contaminated

[MEASURED] Over the 84-file corpus the bullet names, `zzz`+`NoSuchNeedleZzz` returns **2** hits and
`zzz`+`NoSuchTokenZzz` returns **0**; a freshly minted needle returned **0** against a POSITIVE
control of 82. §9.6's rule reproduces: a needle is spent the moment it lands in a tracked file, and
the needle minted for this run is spent by this sentence.

The hit count is much lower than the 40/36 measured on 2026-09-05 — that is corpus reorganisation
(the queue has been restructured into `superseded/`, `merged/` and `exceptions/` since), not a cure.
**2 is still not 0, so it is still not a negative control.**

**DEFERRED** — real, not now. The doctrine already prescribes the only fix (mint fresh every run)
and this run followed it. What would make it urgent: the count climbing back toward double digits,
which would mean runs are again quoting their controls verbatim into tracked breadcrumbs.

### F5 — one tracked `-ready.md` lives inside a gitignored folder, exactly the shape the station doc warns about

[MEASURED] `docs/pr-prompts/processed/pr-resolve-732-site-signin-conflict-ready.md` is **tracked on
`origin/main`** while `processed/` is gitignored by `.gitignore:76-83`. This is the
"gitignored by RULE, tracked in FACT" hazard the station contract records for `needs-marco/`,
appearing in a second folder.

It does **not** arm anything: `READY_PATTERN` and the watcher's non-recursive `fsWatch(PROMPT_DIR)`
match depth 1 only, and depth-1 tracked ready-files are **0** (and depth-1 on-disk ready-files are
**0**). The live risk is the one the contract names for `needs-marco/`: a station that appends to a
file under a gitignored folder on the belief that nothing there is tracked will have its edit ride
into another actor's commit. `git check-ignore` cannot answer this — it answers about the ignore
RULE, never about the index (P3a/P3b above prove the directory form carries no information at all).

**DEFERRED** — real, not now. Nothing is armed and nothing is at risk today. What would make it
urgent: any `*-ready.md` appearing tracked at **depth 1**, which re-arms executed work on the next
checkout and is a defect the moment it happens; or a station reporting a surprise file in its commit
after writing under `processed/`. The durable cure both cases share is already written down: ask
`git ls-files -- <folder>/` before appending to anything under a gitignored folder.

### F6 — my own Part 0(a) instrument produced 22 phantom findings, then 1, against a truth of 0

[MEASURED] Two false positives, caught in-run, both worth recording because the sweep is about
instruments lying:

1. My first redirect-guard heuristic tested a ±8-line window for `/permission|can\(|isAdminUser|role/i`.
   The word `role` matched the **path literal** `/settings/administration/roles`, so ordinary
   redirect routes with no guard at all were counted as guarded-without-super-user: **22** sites
   against a truth of 2. Tightening the needle to a guard EXPRESSION
   (`permissions\??\.includes\(|\bcan\(\s*user|isAdminUser\s*\(|user\??\.role\b`) gave 44 `<Navigate>`
   sites total, **2** inside a real guard, **1** lacking the literal `isSuperUser`.
2. That remaining 1 was also false. `apps/web/src/App.tsx:160` reads
   `const hasField = can(user, "field.view"); if (!hasField) return <Navigate to="/" replace />;` —
   it routes through the sanctioned `can()` helper, which short-circuits on `isSuperUser`. **A
   window search for the literal string `isSuperUser` is blind to the correct pattern**, which is
   precisely the pattern the brief tells the station to prefer.

Real offender count: **0**. Both errors were §9.6's shape inverted — a well-formed, plausible,
non-empty number that was never measuring what its name implied, at exit 0 with nothing warning.
Neither would have been caught by a read-back that only asked "did my grep run".

**ACTIONED** this run. Verified by: re-running each probe with the corrected needle and reading the
actual source lines for every survivor (the brief's five-angle step 2), and by quoting the positive
controls (14 super-aware bare sites, 90 `can(user, …)` calls) alongside the zero so the zero cannot
be read as a blind grep.

### F7 — `read_process_output` returned a 12-line buffer with the chain's final marker absent, twice, and reported the process COMPLETE

[MEASURED] PID 14304, `node p0a-parity-20260922.mjs`. The first read returned 12 lines ending
mid-list with `⏳ Process is running`. Two further `read_process_output` calls each returned
`[Reading 12 new lines (total: 12 lines)]` and then
`✅ Process completed with exit code 0 (runtime: 0.56s)` — **with the chain's final literal marker
`MARKER_P0A_DONE` absent from the drained buffer every time**, and with a line reading
`NAV_GUARDS_no_superuser_in_window=22` followed by only 4 of its 22 rows.

§9.1's `FALSE_TERMINATION_IS_AN_EARLY_READ_NOT_AN_UNRUN_STATEMENT_V1` correction names its own
falsifying probe: *"on the next `finished execution` message, call `read_process_output` on that PID
and look for the chain's last marker. If the marker is genuinely absent from the drained buffer,
this correction is wrong and the unrun-statement reading returns."* **The marker was genuinely
absent, on two consecutive drains.**

⚠️ **I am not filing that as a refutation, and the distinction matters.** The statement demonstrably
DID run — the script's own exit code was 0 and the truncated line it printed (`…=22`) is
*downstream* of the work the missing rows describe, so this is not an unrun statement. The more
likely reading is a **reader-side line cap at 12** rather than either documented shape, and I could
not separate the two: I did not have a second corpus of known output length to control it against
before the run's scope was spent. That makes the cause **[CANNOT MEASURE]** this run.

🔧 What worked, and it cost one edit: **have the script write its report to a file with node and
read the file back** (`C:\po-sup-fix-scripts\p0a-nav-report.txt`, read whole, 5 lines,
`0 remaining`, marker present). That is the same cure §9.3 already prescribes for the `*>` trap,
applied to the reader instead of the writer.

**DISPATCHED** to Station 00. Handing over: the PID, the two identical drain readings, the absent
marker, the exit-0 completion, and the working cure. The decision 00 owns is whether §9.1 gains a
third shape — *a drained buffer can be CAPPED, which looks like both documented shapes and is
neither* — or whether this is the early-return bullet with a line limit in front of it. **I have not
edited DOCTRINE and nothing is retired**; a single unreproduced instance must not narrow or refute a
bullet whose whole job is to stop a run reading UNRUN as CLEAN.

## WHAT I DID NOT DO

- **Did not touch the board.** Nothing armed, staged, renamed, moved or deleted; no prompt written;
  no PR opened, labelled or merged. 04 is read-only on the board and had no lint-clean `-HOLD`
  candidate to stage this run — the sweep was diagnostic and produced no code or prompt work.
- **Did not commit `docs/pipeline/sweep-rotation.json`,** although I advanced it. The authority
  matrix gives 04 *Create a PR: NO* and *Mutate the board: NO*, and the dev tree is on `main`, which
  nobody commits to directly. It is named above so Station 00 sweeps it up; if it is not committed,
  the next run repeats this sweep and the rotation silently stops.
- **Did not run `git fetch --prune`** despite F3, and did not clear the leftover `refs/remotes/pr/*`
  refs. Both mutate a tree shared with concurrent chats and the watcher. Dispatched to 00 instead.
- **Did not edit `DOCTRINE.md`** for F2 or F7, and did not retire, narrow or reword any §9 bullet.
  A sweep that reports non-reproduction has earned a REPORT, never an edit — the report-not-run rule.
- **Did not run §9.5** (*the pipeline's own instruments*, ~766 lines). §9.1–§9.4 and §9.6 were
  covered completely; §9.5 is the named remainder of this sweep and is the right starting point when
  `instrument-honesty` comes round again at rotation position 2.
- **Did not run PART 1's Dependabot pass or PART 2's live-site patrol.** The contract's
  one-sweep-per-run rule governs, and the rotation named `instrument-honesty`. Part 0(a) was run
  because the brief marks it ALWAYS; sub-checks (b)–(f) were not, and rotate next.
- **Did not run `git` against the mount** at any point, the guard being INERT (F1).
- **No Azure / Entra / SharePoint contact of any kind**, read or write.

## FOR MARCO

Nothing needs you this run. No S1, no lockout, no escalation. Every §9 trap probed still
reproduces — the instruments are lying exactly as documented, which is the healthy answer — and
super-user parity is clean at 0 offenders against 104 correctly-guarded call sites.

One thing is worth knowing without being urgent: the dev tree's branch list now names **147**
branches against **16** that actually exist on GitHub (F3). Nothing is broken by it, but any run that
counts branches from the local cache is off by 9×, and it has grown steadily. Station 00 has the
question of whether to prune.

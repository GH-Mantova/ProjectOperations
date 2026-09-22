# Station 04 — Scanner | 2026-09-22T02:10:31Z–2026-09-22T02:22Z

Sweep this run: **instruction-drift** (rotation position 4 of 4, selected by
`node scripts/pipeline/next-sweep.mjs`, previous run `2026-09-21T18:09:53Z`).

## GROUND

```
UTC            2026-09-22T02:10:31Z
origin/main    3f8c51f7
dev tree       main @ 09a8188a  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** — no forced read-only. Station 04 is read-only on the board by
authority regardless (`STATION-CAPABILITIES.md` §5: *Mutate the board: NO, read-only*), and this run
mutated nothing but the rotation file.

⚠️ **Transport disclosure.** The dev tree is **1 commit behind** `origin/main`, so PREFLIGHT step 2's
*"read from `git show origin/main:<path>`, never the working copy"* was at risk. It was discharged by
the sound form `§9.3` prescribes rather than by the forbidden piped hash:
`git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/sweep-rotation.json` → **EMPTY**, i.e. all four
working copies are byte-identical to `origin/main`. The same probe was run for `.gitignore` and
`scripts/pr-gates/pr-gates.mjs` before any line number below was recorded → **EMPTY** on both. So every
line number in this report is a statement about `origin/main`.

## WHAT I MEASURED

**Reachability — this was a SIGHTED run.** [MEASURED] `start_process`, shell `powershell.exe`, PID
11088, first call of the run: `2026-09-22 12:10` local · `main` · `09a8188a`. Desktop Commander tool
ids were loaded by keyword `ToolSearch` first, per PREFLIGHT, so no validation error was mistaken for
blindness.

**Device-bridge git guard installed.** [MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`,
last line quoted verbatim: `persistence controls passed: .bashrc byte-identical on re-run; login shell
resolves shim`. Installer reported three controls passed. No VM-side `git` was run against the mount
at any point in this run.

**Sweep, and its verdict is real.** [MEASURED] `powershell -NoProfile -File scripts\pipeline\status-sweep.ps1`,
exit **0**, captured with `*>` to a file and decoded `utf16le` per §9.3 (157,342 bytes, 460 lines — the
`>`/`*>` UTF-16LE trap). §7 verdict, quoted:

```
[LIVE] CAUTION: 1 LIVE STATION WORKTREE(s) detected (section 2):
[LIVE]    C:/po-wt/s6ruling
[LIVE] git index.lock  interactive/clone: False / False  (true = a git write is mid-flight)
SWEEP COMPLETE 2026-09-22 02:11:45Z
```

No `index.lock` in either tree, so the stale-lock discrimination (byte size × age × git processes ×
`MERGE_HEAD`/rebase state) had nothing to discriminate. CAUTION is tolerable for a read-only station.
⚠️ A concurrent **Station 00** run is live: `lastRunAt 2026-09-22T02:14:11Z` from the scheduled-tasks
MCP, four minutes into this run. Nothing here touches the board, so there is no collision surface.

**The MCP-reported live task list is FOUR enabled.** [MEASURED] scheduled-tasks MCP:
`00-supervisor` `5 * * * *` · `03-machine-minder` `0 9 * * *` · `04-scanner` `0 */4 * * *` ·
`05-sot-keeper` `10 0 * * *` all `enabled: true`; **`weekly-security-audit` `enabled: false`**,
`lastRunAt 2026-09-06T21:32:44Z`. This confirms `STATION-CAPABILITIES.md` §1's 2026-09-15 correction
and its falsifying probe (*"read `enabled` for `weekly-security-audit` from the MCP; if it is ever
`true`, this correction is unnecessary"*) — it is still `false`. Corpus stated as the RULE, never as a
count: `C:\Users\Marco\Claude\Scheduled` holds **11** `SKILL.md` on disk (6 at depth 1, 5 under
`_retired-2026-08-18\`), of which **4** sit behind enabled tasks.

**`station_doc_version`: bootstrap vs station doc — all four MATCH.** [MEASURED] per-file front-matter
read, both layers:

| task | bootstrap | station doc | match | bootstrap names its doc (back/fwd slash) | bootstrap mtime |
|---|---|---|---|---|---|
| `00-supervisor` | 1 | 1 | ✅ | 1 / 2 | `2026-09-01T00:07:44.732Z` |
| `03-machine-minder` | 1 | 1 | ✅ | 1 / 2 | `2026-09-01T00:07:44.737Z` |
| `04-scanner` | 1 | 1 | ✅ | 1 / 2 | `2026-09-01T00:07:44.740Z` |
| `05-sot-keeper` | 1 | 1 | ✅ | 1 / 2 | `2026-09-01T00:07:44.742Z` |

The path needle was counted in **node** with a single backslash, never as a single-quoted PowerShell
`'C:\\…'` literal (§9.1's double-backslash trap), and per **path** rather than per `Filename`
(§9.3's `Filename -Unique` basename collapse — this corpus is 11 files all named `SKILL.md`, the exact
shape that bullet names).

**All SEVEN station docs present and stamped.** [MEASURED] `00-supervisor.md` · `01-code-writer.md` ·
`02-board-driver.md` · `03-machine-minder.md` · `04-scanner.md` · `05-sot-keeper.md` ·
`06-pr-master.md`, every one `station_doc_version=1  contract_version=3`.

**`lint-station.mjs` — ADMIT, exit 0.** [MEASURED] `node scripts\pipeline\lint-station.mjs` →
`ADMIT: all 8 docs clean`, `LINT_EXIT=0`, including `.claude/agents/*.md  (9 agent definitions,
encoding clean)`. Warnings only, all of the form *"names a Windows path outside the known folder
map"*. ⚠️ **Six of those warnings on `DOCTRINE.md` are the linter reading §9's documentation as
data** — `C:\\Foo\\Bar`, `C:\Users\Marco in`, `e:\s`, `r:\s` are regex and worked-example fragments
§9.1/§9.3 *quote as broken queries*. That is §9.6's closing rule (*a probe pointed at §9 measures the
documentation*) firing inside a shipped instrument. It is noise at ADMIT level, not a failure, and is
recorded as a lead, not a finding.

**Citation probe, both regex forms, over the corpus as the RULE now states it** (4 enabled `SKILL.md`
+ 7 station docs + `DOCTRINE.md` + `STATION-CAPABILITIES.md` + `CLAUDE.md` = 14 files). [MEASURED]:

| form | matches |
|---|---|
| extension-keyed (§9.5's 2026-09-15 blind form) | **17** |
| dotfile-tolerant (§9.5's 2026-09-15 prescribed form) | **146** |
| dotfile-tolerant **+ §9.5's 2026-09-21 clock guard** | **47** |

⚠️ These are STATE — re-measure, never quote. The clock guard §9.5 prescribes
(`[/.]` required in the file part, `(?<!\d{2})(?<!T\d)` before the colon) **works**: it removed all 99
timestamp matches and let through **zero** clock times, and both real classes survive it
(`.gitignore:28`, `start-watcher.ps1:160`). Extension-keyed **17** reproduces the 2026-09-21 figure
exactly; dotfile-tolerant has grown 136 → 146 because `DOCTRINE.md` has been edited since.

**`DOCTRINE.md` §9.5's truth claim, re-verified by CONTENT rather than by range.** The claim is
*"every `<file>:<N>` citation in the corpus resolves, and the only ones that do not are the four
bootstraps' `.gitignore:107-111`."* [MEASURED] every guarded citation resolved against the line it
cites: `.gitignore:28`→`.claude/` ✅ · `.gitignore:75`→`docs/pr-prompts/*-ready.md` ✅ ·
`.gitignore:76`→`docs/pr-prompts/processed/` ✅ · `.gitignore:76-83`→ opens at `processed/` ✅ ·
`start-watcher.ps1:160`→`if (-not $env:PR_WATCHER_AUTO_MERGE_POLICY) { $env:PR_WATCHER_AUTO_MERGE_POLICY = "tests-d…` ✅ ·
`ensure-watcher.ps1:10`→`$Launcher = 'C:\po-watcher\watcher-launcher-singlelane.ps1'` ✅ ·
`CLAUDE.md:19`→ the §10 second-lanes sentence ✅ ·
`build-relationship-map.mjs:18-19`→ the `--check` comment ✅. **The truth claim holds.** Its
per-document count list — kept by §9.5 only as that correction's evidence — is off by one on
`STATION-CAPABILITIES.md` (predicted 1, measured **2** occurrences of `.gitignore:28`, §1 and §3).
A lead, not a finding: §9.5 explicitly replaced the count list with the truth claim *because* counts
rot when a document is edited.

**Fresh needles minted this run, and both are now SPENT** (§9.6 — a needle is spent the moment it
lands in a tracked file; do not reuse either): `zzQq04drift` + `20260922T0211` → **0** files;
`zzQq04cite` + `20260922T0215` → **0** files. POSITIVE control for the same sweep: 13 of 14 corpus
files carry a real `.gitignore:<N>` citation.

**Repo-path resolution, whole-corpus** — 318 concrete repo paths checked, 36 reported absent.
**This is a LEAD, not a finding**, and it must not be read as 36 dangling references: the probe's own
path regex swallows trailing sentence periods (`permission-registry.ts.`), matches prose fragments
(`sot/05`, `sot/01/02/03/05/06`) and filename *prefixes* (`docs/pr-prompts/00-`), and counts paths
that are absent **by design** — `docs/qa/.qa-run.lock` is gitignored run state, and
`docs/qa/Master-QA-and-Consolidation-Program-Plan.md` is named by `04-scanner.md` precisely to record
that it was deleted in the 2026-08-17 cleanup. The authoritative instrument for this half of the
sweep is `lint-station.mjs`, which ADMITs all 8 docs — subject to F5 below.

## WHAT CHANGED

**Nothing on the board.** No prompt armed, disarmed, renamed, moved or deleted. No PR opened, updated,
labelled or merged. No `sot/` edit. No `git` command that changes a ref, an index or a working tree.
No `az` / `Connect-MgGraph` / portal / Entra / SharePoint action of any kind.

Three writes, and one of them was a mistake this run made and undid:

1. `docs/pipeline/sweep-rotation.json` — advanced with
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-22T02:10:31Z`, exit 0. Read back:
   `last_index=3`, `last_run_utc=2026-09-22T02:10:31Z`, `last_station=04-scanner`, **next sweep =
   `gate-liveness`**. **Left DIRTY in the dev tree**, as the script's own output instructs. Station 04
   may not commit it (authority matrix: *Create a PR: NO*), and the dev tree is on `main`, which nobody
   commits to directly. 🔴 **Station 00: this file needs committing with this breadcrumb.** Two
   consecutive advances have already sat uncommitted once (04's F6, 2026-09-02); the advance survives
   only while the working copy does, and if it is lost the next run repeats `instruction-drift` and the
   rotation silently stops.
2. This breadcrumb, at a **tracked** path under `docs/pr-prompts/`. Validated by its one validator:
   `node scripts\pipeline\check-breadcrumb.mjs` → `ADMIT` for this file, `structure: 2 checked, 0
   malformed`, **`CLEAN`, exit 0** — so `breadcrumb-clean` here is MEASURED, not asserted, and no
   `lint-prompt.mjs` verdict is quoted on it. The validator also printed
   `NOTE … is UNTRACKED — it reaches nobody until a board PR commits it`. Its filename matches no
   watcher glob, so it arms nothing, and it is in none of the five gitignored sinks.
3. 🔴 **An addendum appended to `docs/pr-prompts/needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md`,
   then REVERTED.** That file is TRACKED despite `.gitignore:82` matching its folder, so the append was
   a tracked-file write — which Station 04's HARD RULES forbid (*"Tracked-file writes: NONE except
   staged prompt files and the five ignored `docs/qa/` state entries"*). **F6 is the finding; the revert
   is its disposition.** Restored with `git show origin/main:<path>` written via node, read back to
   10,385 B with `--numstat` vs `origin/main` **EMPTY**. Net effect on the tree: **none**.

⚠️ **Two tracked changes in the dev tree are NOT this run's and must not be attributed to it:**
` M docs/pr-prompts/.arming-log.txt` and ` D docs/pr-prompts/pr-scopecards-s6-one-cutting-surface-HOLD.md`.
They were present before this run's only tracked write and after its revert, they are consistent with
the live station worktree the sweep flagged (`C:/po-wt/s6ruling` — same slice, s6), and the dev tree's
index is SHARED between concurrent chats (§9.2). **Station 00: commit `sweep-rotation.json` and this
breadcrumb with a PATHSPEC**, per §9.2's shared-index rule, or you will carry another actor's in-flight
arm.

Scratch scripts were written to `C:\po-sup-fix-scripts\` (`drift-04-20260922.mjs`,
`drift-04b-20260922.mjs`, `drift-04c-20260922.mjs`) and the sweep capture to
`C:\po-sup-fix-scripts\sweep-04-20260922.txt`. No throwaway worktree was minted (AUTHORITY: an
orphaned worktree's lock has no holding process by construction, forever).

## FINDINGS

### F1 — S2 — The citation check ITEM 2 asks Marco for is suppressed by `lint-station.mjs`'s OWN `nearGitignore` guard on 30 of 30 `.gitignore:<N>` citations. `CITATION_CHECK_SUPPRESSED_BY_NEARGITIGNORE_V1`

`needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md` **ITEM 2** asks for *"a
`lint-station.mjs` check that validates every `<file>:<N>` citation"*. Its **2026-09-15T02:45Z
addendum** — *"PIN ITEM 2's REGEX BEFORE THE CHECK IS BUILT"* — pins the regex so the check is not born
blind, as `DOCTRINE.md` §9.5 records happening twice already (extension-keyed, 2026-09-15; clock-time
matches, 2026-09-21). **It is born blind a third time, and the regex is not the reason.**

`lint-station.mjs` **already collects citations**, at anchor `function repoPathsIn` — the second
`for (const m of text.matchAll(` in that function. Both the existing collector and any replacement
built at that anchor are filtered by `const nearGitignore`, which is:

```js
const nearGitignore = (t, i) => /gitignor/i.test(t.slice(Math.max(0, i - 240), i + 240));
```

🔴 **The window `[i-240, i+240]` CONTAINS THE MATCH ITSELF, and the literal text `.gitignore:107-111`
contains `gitignor` at offset 1. So the guard is self-satisfying on exactly the class it must not
suppress.** [MEASURED] 2026-09-22T02:1xZ at `3f8c51f7`, lint-station's own two predicates applied
verbatim to the 14-file corpus:

| instrument | matched | survived `nearGitignore` |
|---|---|---|
| the **shipped** collector (`repoPathsIn`, second `matchAll`) | **0** | **0** |
| ITEM 2's **pinned** regex (§9.5's 2026-09-21 guarded form) | **47** | **14** |
| …of which the `.gitignore:<N>` class | **30** | 🔴 **0** |

**POSITIVE control, and it is the load-bearing row:** a fixture carrying
`` `docs/pipeline/DOCTRINE.md:42` `` 600 characters clear of the word *gitignore* → shipped regex
**matched 1, survived 1**. The collector works. A `.gitignore:115-119` row in the *same* fixture →
pinned regex **matched 1, survived 0**. **NEGATIVE control**, the fresh needle above → 0 files.
**Mechanism proof, two calls anyone can re-run:** `nearGitignore('.gitignore:115', 0)` → **true**;
`nearGitignore('docs/x.md:42', 0)` → **false**.

Nothing is empty and nothing warns — `repoPathsIn` answered exactly the question it was asked, about a
different quantity from the one ITEM 2's author will assume. The guard's comment states its intent
honestly (*"A path named inside an explicit gitignore warning is NOT a claim that the file exists"*) and
that intent is **correct for path EXISTENCE and wrong for LINE-NUMBER validity**: a `.gitignore` line
citation is a claim about `.gitignore`, which is tracked and always present.

🔴 **And the shipped collector discards the line number anyway.** It adds `m[1]` — the file part only —
to `found`, so today a citation is checked for *file existence* and its `:NNN` is thrown away. ITEM 2 is
therefore not *"build a check"*; it is *"make the existing collector assert the line, and exempt the
`.gitignore` class from `nearGitignore`"*, which is a smaller and differently-shaped change than the
escalation describes.

**RULE 1 options for Marco, complete-and-additive first:**

- **(A) — complete and additive.** In `repoPathsIn`, split the two concerns: keep `nearGitignore` on the
  *existence* pass (first `matchAll`), and in the *citation* pass assert the cited line exists **and**
  carries expected content, with **no** `nearGitignore` exemption — a cited file that is tracked is
  always present, so the exemption buys nothing there. Widen that pass's regex to §9.5's guarded
  dotfile-tolerant form. Solves it immediately (the 30 suppressed citations become visible) and in
  future (any new citation class is caught), and damages no data entry — it is a linter warning path.
- **(B) — fails the *completely* half.** Fix only the regex, as ITEM 2's addendum currently prescribes.
  The widened regex then matches all 30 and `nearGitignore` discards all 30, so the gate ships green and
  the class stays unprotected. This is the option the escalation as written produces.
- **(C) — fails the *future* half.** Hand-correct the four rotten pastes (ITEM 1) and build no check.
  Fixes today's instances; the class recurs, as it has twice.

**DISPOSITION: ESCALATED** — against ITEM 2 of
`needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md`, **through this breadcrumb, not
through that file.** An addendum was written into the escalation and then **reverted** — see F6 and
WHAT CHANGED; that file is TRACKED, so the append was a tracked-file write Station 04 is forbidden.
This breadcrumb is the sanctioned channel and Station 00 collects. 🔴 **Station 00: the addendum text
is reproduced by the four numbered points and the RULE 1 options above; land it under ITEM 2 in a
doc-reconcile PR rather than as a working-copy append.** The repair itself is
`scripts/pipeline/lint-station.mjs`, i.e. `scripts/`, outside Station 04's read-only lane and outside
Station 00's recorded `docs/` lane (`STATION-CAPABILITIES.md` §5's 2026-09-22
`NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1` narrowing), so it is Marco's either way. Station 04
staged no prompt: ITEM 2 is already open with him and a second artifact asking the same question is how
four identical one-clause fixes went unlanded on the `STOP-WATCHER` bullet.

⚠️ **Falsifying probe: the three-row table and the two `nearGitignore` calls above.** If the shipped
collector ever returns a non-zero match over this corpus, or if `nearGitignore('.gitignore:115', 0)`
ever returns `false`, this finding is wrong and must be re-measured.

### F2 — S3 — `lint-station.mjs` lints the REPO layer only, so no check built there can ever reach the four bootstraps ITEM 1 is about. `LINT_STATION_CORPUS_EXCLUDES_BOOTSTRAPS_V1`

[MEASURED] `scripts/pipeline/lint-station.mjs`, anchor `const targets = explicit.length ? explicit :`
→ `[DOCTRINE, ...stationDocs()]`, and `function stationDocs` reads `STATION_DIR` only. Its output
confirms the corpus from the other side: `ADMIT: all 8 docs clean` — `DOCTRINE.md` + 7 station docs,
plus `.claude/agents/*.md` handled separately. `C:\\Users\\Marco\\Claude\\Scheduled` appears in that
file exactly once, in the **known-folder-map allowlist**, never as a lint target.

**So ITEM 1's four rotten pastes live in a layer the gate ITEM 2 asks for cannot see**, even once F1 is
fixed. This is `STATION-CAPABILITIES.md` §1's own thesis — *"all layers drift independently, and a
stale instruction reads exactly like a current one"* — with the enforcement applied to one layer and
the drift sitting in the other. It is also why F4 below exists.

**DISPOSITION: ESCALATED** — same escalation, ITEM 2, through this breadcrumb (see F1's disposition and
F6 for why nothing was written into that file). It changes what the ask must say: a check scoped
to the repo docs satisfies ITEM 2's words and leaves ITEM 1's instances unguarded forever. The
complete-and-additive form is to run the citation pass over the corpus as the RULE states it — every
`SKILL.md` behind an ENABLED task, read from the MCP, plus the seven station docs plus the three
binding files — which is the corpus `DOCTRINE.md` §9.5 already mandates for the probe.

### F3 — S3 — ITEM 1 is still entirely unactioned at day 16: all four ENABLED bootstraps cite `.gitignore:107-111`; the truth is 115–119, off by exactly eight.

[MEASURED] 2026-09-22T02:1xZ, `.gitignore` byte-identical to `origin/main` (`--numstat` EMPTY), 151
lines:

| what the bootstraps claim is at 107–111 | what is actually there | where the five sinks actually are |
|---|---|---|
| the five gitignored QA sinks | `107: !Claude Design/docs/` · `108: !Claude Design/assets/` · `109: Claude Design/assets/*` · `110: !Claude Design/assets/routes.js` · `111: !Claude Design/proposed/` | `115: docs/qa/qa-checklist.md` · `116: qa-findings.md` · `117: qa-test-data-registry.md` · `118: .qa-run.lock` · `119: qa-run-*.md`, under the `# Overnight-QA scheduled task` comment at **113** |

All four enabled bootstraps carry the string `.gitignore:107-111`; **this run's own bootstrap is one of
them.** Escalation file present and read: `gitignore-citations-in-the-five-bootstraps-2026-09-06.md`,
10,385 B, last written `2026-09-15T02:42:33Z`. Its own 2026-09-14 addendum already records ITEM 1 as
*"still entirely unactioned"*; it is now eight days further on.

🔴 **The reason this run re-files it rather than closing it is the instrument, and that is F1.** The
obvious implementation of §9.5's prescribed probe — *"resolve each citation against the line it
cites"* — checks only that the line **NUMBER is within the file's length**. `.gitignore:107-111` passes
that test on a 151-line file. This run's first pass printed **`IN RANGE`** for all four, and the
available write-up was *"the bootstrap citations resolve"* — the exact polarity that retires a live
escalation. It was caught only by asking what line 107 **says**. **`IN RANGE` is not `RESOLVES`, and any
check built on range alone certifies this class as healthy.**

**DISPOSITION: ESCALATED** — already on file as ITEM 1; no new artifact created, per the four-identical-
fixes lesson. Recorded here so the next `instruction-drift` sweep has the day count and the in-range
trap written down.

### F4 — S3 — The anchor rule landed in all seven station docs and never in the bootstrap layer: `05-sot-keeper`'s bootstrap still carries a raw `pr-gates.mjs:327`. `ANCHOR_RULE_NEVER_REACHED_THE_BOOTSTRAPS_V1`

`DOCTRINE.md` §9.5's opening rule is *"ANCHOR BY SYMBOL, NEVER BY LINE NUMBER"*, and its 2026-09-10
clause widened it to *"EVERY station doc, `CLAUDE.md` and `STATION-CAPABILITIES.md`"*. [MEASURED] the
repo half has landed completely: extension-bearing citations across the seven station docs = **0**,
`CLAUDE.md` = **0**, `STATION-CAPABILITIES.md` = **0**. But `05-sot-keeper/SKILL.md` carries
**`pr-gates.mjs:327`** — the very citation §9.5 records as *converted to an anchor* in
`stations/05-sot-keeper.md`. The repo layer was fixed; the bootstrap that points at it was not.

**It resolves TODAY, which is why this is latent and not live.** [MEASURED]
`scripts/pr-gates/pr-gates.mjs` is byte-identical to `origin/main` and **657** lines;
`Select-String 'CP-24'` puts the block comment at **321**, `report("PASS","CP-24","sot-purity"…)` at
**334**, and further uses at 338 and 374. Line 327 reads
`// touch sot/ + docs/ (runbooks, pr-prompts, review artifacts).` — inside CP-24's block, six lines
past its opening, naming nothing. So it points at the right *section* by accident of position, in a
657-line file this pipeline edits constantly: **any insertion above line 327 rots it silently**, and
F2 means no gate would notice.

**DISPOSITION: DEFERRED** — it resolves at `3f8c51f7`, so nothing is wrong on the board today, and the
fix is a text paste in a layer only Marco can edit, riding with ITEM 1's four. **What would make it
urgent:** any PR touching `scripts/pr-gates/pr-gates.mjs` above line 327, after which a Station 05 run
reading its own bootstrap is sent to the wrong line in the gate that defines its entire lane. ⚠️
**Falsifying probe: re-read line 327 and the `CP-24` line numbers.** If 327 ever falls outside
[321, 334], this citation has rotted and the disposition must change.

### F5 — S3 — `repoPathsIn`'s existence check is blind to every path written with a trailing slash, which is how `DOCTRINE.md` writes the queue-lifecycle folders — and five of them do not exist. `REPOPATHS_BLIND_TO_TRAILING_SLASH_V1`

[MEASURED] `lint-station.mjs`'s first `matchAll` in `repoPathsIn` requires the character before the
closing backtick to be in `[A-Za-z0-9_.\-*]`; `/` is not, so a backticked directory form matches
nothing and is never collected. Over `DOCTRINE.md`: **84** backticked paths collected, **11**
trailing-slash backticked paths the shipped regex **cannot see** — and five of the eleven are absent
from disk:

| path | exists |
|---|---|
| `docs/pr-prompts/brainstorm/` · `draft/` · `merged/` · `reports/` | **false** |
| `docs/pr-prompts/exceptions/` (§8.5's exception vocabulary) | **false** |
| `needs-marco/` · `superseded/` · `processed/` · `archive/` · `docs/pr-reviews/` · `docs/pipeline/stations/` · `apps/api/prisma/migrations/` | true |

⚠️ **The absence is DECLARED, not drift.** `DOCTRINE.md` §8.5 closes with *"Not yet enforced. This
standard is written in S1 and enforced in S4."* So this is not a broken reference today. What is worth
recording is that **the linter could never have told anyone either way**, in either direction: it will
not report these five as dangling now, and it will not report a *typo* in one of them when S4 lands and
they become load-bearing. `merged/` in particular is the folder §8.5 introduces to fix the blind spot
that lost two armed prompts on 2026-09-16.

**DISPOSITION: DEFERRED** — no reference is wrong at `3f8c51f7` and the cure is the same one-function
edit as F1, so it should ride with F1 rather than spawn a second ask. **What would make it urgent:** the
QUEUE_LAYOUT_V1 S4 enforcement slice landing, at which point a mis-spelled lifecycle folder is a silent
prompt-loss path with no gate behind it.

### F6 — S2 — `needs-marco/` is ignored by RULE and 6 of its 61 files are TRACKED anyway, so "appending there is safe" is false for exactly the files stations write to — and `git check-ignore` cannot tell you. `NEEDS_MARCO_SINK_IS_PARTLY_TRACKED_V1`

Every station doc's REPORT CONTRACT lists `needs-marco/` among the gitignored sinks, citing
`.gitignore:76-83`, and the contract's point is that a finding written there is **swallowed**. This run
acted on that reading, appended an addendum to the open escalation, and **dirtied the tree**.

[MEASURED] 2026-09-22T02:2xZ at `3f8c51f7`. The rule exists and is correctly cited —
`.gitignore:82` is `docs/pr-prompts/needs-marco/`, inside the cited 76–83 range. But **a gitignore rule
does not apply to an already-tracked file**, and these are tracked:

| probe | result |
|---|---|
| `git ls-files --error-unmatch <the escalation file>` | **exit 0 — TRACKED** |
| POSITIVE control, `CLAUDE.md` | exit 0 |
| NEGATIVE control, a path that does not exist | exit 1 |
| `git status --porcelain` after the append | ` M <the escalation file>` |
| `git diff --numstat origin/main -- <it>` after the append | **`114  0`** — a real tracked modification |
| `docs/pr-prompts/needs-marco/*.md` | **61 files: 6 TRACKED, 55 untracked** |
| control sink `docs/pr-prompts/processed/`, 25-file sample | **0 tracked, 25 untracked** — the docs' claim holds there |

🔴 **So the hazard is per-FILE, not per-FOLDER, and it inverts the warning the station docs give.** For
55 of 61 files the docs are right (a write is swallowed). For **6** — including the highest-traffic open
escalation, the one every `instruction-drift` sweep is sent to — a write is the opposite failure: it
silently modifies a tracked file in a tree whose index is **SHARED between concurrent chats** (§9.2),
while a Station 00 run was live four minutes into this one.

🔴 **And `git check-ignore -v` on the FILE form — the form §9.2 says is the only one that answers —
returns exit 1, empty, for a tracked-but-rule-matched file.** [MEASURED] on the escalation file → exit
**1**, empty; on a second, untracked file in the same folder
(`agent-authored-rule-2-clearance-2026-09-04.md`) → exit **1**, empty. **Opposite truths, identical
results**, which is precisely the shape §9.2 already records for the *directory* form — reproduced here
on the file form, where that bullet says *"Only the file form answers."* It does not answer this
question. The instrument that does is `git ls-files --error-unmatch`, with both controls.

**DISPOSITION: ACTIONED** — the append was reverted the same run, before any other actor could sweep it
up. Recovery used the one form §9.2 permits: `git show origin/main:<path>` written with **node**
(never `>`, which is UTF-16LE in PS 5.1), never `git checkout --`. Read-back, all three assertions:
restored size **10,385 B** (byte-identical to the original); `git diff --numstat origin/main -- <it>`
→ **EMPTY**; addendum marker absent (**negative**) while `## ITEM 2` still present and the addendum
count back to **2** (**positive**). The rule half — that station docs describe a partly-tracked folder
as a uniformly gitignored sink — is **DISPATCHED to Station 00**: it is a `docs/` wording fix across the
REPORT CONTRACT canonical block, which is hash-gated and must ship in all seven station docs together,
and 04 may not open that PR.

⚠️ **Falsifying probe: the `ls-files --error-unmatch` tracked/untracked split above.** If
`needs-marco/` ever reads 0 tracked, this finding is spent and the station docs are simply correct.

## WHAT I DID NOT DO

- **Arm, disarm, rename, move or delete any prompt**, and staged no `-HOLD`. Every finding above is
  either already open with Marco under one escalation (F1, F2, F3) or explicitly deferred to ride with
  it (F4, F5). A second artifact asking the same question is how four identical one-clause `STOP-WATCHER`
  fixes went unlanded; the 2-prompt budget was deliberately left unspent.
- **Did not edit `scripts/pipeline/lint-station.mjs`.** `scripts/` is outside Station 04's lane, and the
  ADVERSARIAL PROMPT CRITIQUE report-not-run rule forbids fixing what this station is here to flag.
- **Did not edit the four bootstraps.** `C:\Users\Marco\Claude\Scheduled\**\SKILL.md` is the one layer an
  agent cannot change (`STATION-CAPABILITIES.md` §1) — it is Marco's, by pasting.
- **Did not commit the rotation advance or this breadcrumb.** 04 has *Create a PR: NO*, and `main` takes
  no direct commits. Named under WHAT CHANGED for Station 00.
- **Did not run the other three sweeps.** `gate-liveness`, `instrument-honesty` and `repo-hygiene` were
  left alone on purpose: one named sweep per run, covered completely, is the rule — a shallow pass over
  everything is why findings rot.
- **Did not touch `/sot/`** (Station 05's, CP-24), the watcher clone, or `C:/po-wt/s6ruling` — the live
  station worktree the sweep flagged.
- **No Azure / Entra / SharePoint action of any kind**, and no production data read or written.
- **Did not run Part 1's Dependabot pass or Part 2's live-site pass.** The named sweep for this run is
  `instruction-drift`; the live site and the security tab are not in its brief.
- **Did not re-verify §9's traps.** That is the `instrument-honesty` sweep, and §9.6's closing rule warns
  that running a §9 probe against §9 itself inverts the answer. The one §9 form this run *did* exercise —
  the 2026-09-21 clock guard — was run against the corpus its bullet names, not against `DOCTRINE.md`
  alone.
- **Did not write to `docs/qa/qa-findings.md`** or any other gitignored sink. Five consecutive Station 04
  runs did, and the finding sat unread for nine days.

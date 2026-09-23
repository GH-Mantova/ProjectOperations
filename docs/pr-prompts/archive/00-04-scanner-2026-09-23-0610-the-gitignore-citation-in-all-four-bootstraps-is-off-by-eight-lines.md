# Station 04 — Scanner | 2026-09-23T06:10:31Z–2026-09-23T06:45Z

## GROUND

```
UTC            2026-09-23T06:10:31Z
origin/main    4b2aa2c6            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ 4b2aa2c6      C:\ProjectOperations2
doc version    1                    (station_doc_version in docs/pipeline/stations/04-scanner.md)
bootstrap      1                    (station_doc_version in the scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE. Run was NOT read-only-by-mismatch.

Sighted run. Desktop Commander reached the Windows host on the first call after the
`ToolSearch` load. Tree read in the DEV TREE, `C:\ProjectOperations2`, never the watcher clone.

**SWEEP THIS RUN: `instruction-drift`** (rotation position 4 of 4), from
`node scripts/pipeline/next-sweep.mjs` — not chosen.

## WHAT I MEASURED

**[MEASURED] Host reachable.** `start_process` shell `powershell.exe` →
`2026-09-23 16:10` local, `main`, `4b2aa2c6 2026-09-23 15:57:35 +1000`.

**[MEASURED] vm-git-guard installer, exit and last line quoted verbatim, per PREFLIGHT.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` → **`GUARD_EXIT=2`**,
headline `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
Last line: `PATH="/sessions/pensive-festive-newton/.local/bin:$PATH" git <args>`.
This is the EXPECTED station outcome (a FINDING, not a STOP). The device-bridge git ban is
REMEMBERED, not mechanical, for this run.

**[MEASURED] Binding-doc freshness, by the sanctioned form, not by a piped hash.**
`git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
→ **EMPTY**; `git rev-list --left-right --count HEAD...origin/main` → `0 0`. The working copies
I read are byte-identical to `origin/main` at `4b2aa2c6`.

**[MEASURED] DOCTRINE §9.1's nested-`-Command` expansion trap fired live, in this run, at
`4b2aa2c6`.** Its own falsifying probe was run and did NOT falsify it.
`start_process` with command `powershell.exe -NoLogo -NoProfile -Command "... echo ('EXIT=' + $LASTEXITCODE)"`
→ `ParserError: You must provide a value expression following the '+' operator`, the `$LASTEXITCODE`
consumed before the child parsed. POSITIVE control, same statement sent **direct** to the Desktop
Commander `powershell.exe` shell minutes later → `NEXTSWEEP_EXIT=0` printed correctly.
`COMMAND_LAYER_EXPANSION_IS_THE_NESTED_FORM_V1` stands exactly as written.

**[MEASURED] Live enabled task list, from the scheduled-tasks MCP, corpus stated as a RULE.**
`00-supervisor` `5 * * * *` · `03-machine-minder` `0 9 * * *` · `04-scanner` `0 */4 * * *` ·
`05-sot-keeper` `10 0 * * *`, all `enabled: true`; `weekly-security-audit` **`enabled: false`**,
`lastRunAt 2026-09-06T21:32:44Z`. STATION-CAPABILITIES §1's 2026-09-15 correction is confirmed —
the live enabled count is FOUR, and its falsifying probe (`enabled` for `weekly-security-audit`)
still reads `false`.

**[MEASURED] `station_doc_version` matches on BOTH sides for all four enabled tasks.**
Each bootstrap names exactly one `docs/pipeline/stations/<NN>-*.md`, each of those exists, and
bootstrap and doc both declare `1`: `00-supervisor` 1/1 · `03-machine-minder` 1/1 ·
`04-scanner` 1/1 · `05-sot-keeper` 1/1. No mismatch.

**[MEASURED] `node scripts/pipeline/lint-station.mjs` → exit 0, `ADMIT: all 8 docs clean`**
(7 station docs + DOCTRINE, plus `.claude/agents/*.md`, 9 definitions, encoding clean).
This is the sweep's mandated lint and it passes.

**[MEASURED] DOCTRINE §9.5's citation TRUTH-CLAIM HOLDS at `4b2aa2c6` — recorded because four
consecutive sweeps re-found unresolved citations and the repo-side conversions have now all
landed.** The claim is *"every `<file>:<N>` citation in the corpus resolves, and the only ones
that do not are the four bootstraps' `.gitignore:107-111`."* Probe: the dotfile-tolerant regex
with the 2026-09-21T15:3x timestamp guard, over the corpus stated as a RULE (every `SKILL.md`
behind an ENABLED task + all SEVEN station docs + `DOCTRINE.md` + `STATION-CAPABILITIES.md` +
`CLAUDE.md`). Every repo-side citation resolves:
`.gitignore:28` → `.claude/` · `.gitignore:75` → `docs/pr-prompts/*-ready.md` ·
`.gitignore:76` → `docs/pr-prompts/processed/` · `.gitignore:76-83` → exactly the eight
exception folders · `start-watcher.ps1:160` (file has 360 lines) ·
`build-relationship-map.mjs:18-19` (578) · `CLAUDE.md:19` (27). The four bootstrap
`.gitignore:107-111` do not — see F1. NEGATIVE control, freshly minted needle
`zzQq04Drift20260923T0615` over the whole corpus → **0**; POSITIVE control (`"DOCTRINE"`) → 136;
`existsSync` control on a known-absent path → `false`, on `CLAUDE.md` → `true`.

**[MEASURED] `scripts/pipeline/status-sweep.ps1` §7 verdict: `CAUTION`** —
`1 LIVE STATION WORKTREE(s) detected: C:/po-wt/s9hex`, the watcher building
`pr-scopecards-s9-transport-capacity-matrix-ready.md` (heartbeat tick 0.5 min old).
Section 6 backlog: `ready=1 needs-marco=2 blocked=4 broken=0`; the one READY item is
`rates-11c-blocked-consumers`. Board: 1 open PR (`#2114`, BEHIND, 9 pass / 1 fail / 4 pending);
watcher node RUNNING pid 9744; `index.lock` False in both trees; 0 scoped git processes.

**[CANNOT MEASURE] the FIRST status-sweep capture's §7 verdict.** The first invocation was cut
short by the 180 s MCP tool-call cap while the redirect was still being written, leaving a
67,790-byte file that ends inside section 5 with no section 6 and no verdict. It was re-launched
detached via `Start-Process` and read to completion; the verdict above is from that second,
complete run (`SWEEP COMPLETE 2026-09-23 06:15:32Z`). Recorded because a truncated sweep capture
looks exactly like a complete one until you look for section 7 — the earlier capture's
`SECTION_67_AT` was `-1`.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced with
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-23T06:10:31Z`, exit 0,
  `advanced: last_index=3 last_run_utc=2026-09-23T06:10:31Z`. Read back:
  `git diff --numstat -- docs/pipeline/sweep-rotation.json` → `2  2`.
  **LEFT DIRTY IN THE DEV TREE ON PURPOSE — Station 00 commits it, because 04 may not.**
- This breadcrumb, written to the dev tree at `docs/pr-prompts/`. **Untracked until a board PR
  commits it.** Station 00 sweeps it up. Named here per the REPORT CONTRACT because an
  untracked file at a path a later PR lands will block the next `git merge --ff-only` while
  `--numstat` and `--cached` both read EMPTY.
- Scratch only, outside the repo: `C:\po-sup-fix-scripts\drift-sweep-0923.mjs`,
  `boot-drift-0923.mjs`, `sweep-04-20260923.txt`, `sweep04b.txt`, `sweep04b.err`.
- **Nothing on the board. No prompt armed, disarmed, renamed, moved or deleted. No PR touched.
  No commit. No `/sot/` edit.**

## FINDINGS

### F1 — `.gitignore:107-111` is off by EXACTLY EIGHT lines in ALL FOUR enabled bootstraps, and it points at the `Claude Design/` exclusions

[MEASURED] at `4b2aa2c6`. All four bootstraps say the gitignored sinks a station must not write
to are *"the five gitignored sinks named at `.gitignore:107-111`"*. Read with node, the file's
real content there is:

```
107: !Claude Design/docs/
108: !Claude Design/assets/
109: Claude Design/assets/*
110: !Claude Design/assets/routes.js
111: !Claude Design/proposed/
```

The block the sentence describes begins at **113** and the five files are at **115–119**:
`docs/qa/qa-checklist.md` · `qa-findings.md` · `qa-test-data-registry.md` · `.qa-run.lock` ·
`qa-run-*.md`. `.gitignore` is 151 lines, so the citation is IN RANGE and a range check passes —
which is why a probe that only tests resolvability reports it clean. The seven station docs use
the ANCHOR form (*"the five files listed under the `# Overnight-QA scheduled task` comment"*) and
are correct; the bootstrap layer was never converted.

This is ITEM 1 of the open escalation
`docs/pr-prompts/needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md`, first
raised 17 days ago. What this run adds is the exact delta (**8 lines**) and the true target
(**115–119**), and that the corpus is FOUR enabled bootstraps, not five.

**RULE 1, complete-and-additive FIRST:**
**(a)** Replace the raw citation in all four bootstraps with the anchor form the station docs
already use — *"the five files listed under the `# Overnight-QA scheduled task` comment in
`.gitignore`"*. Solves it immediately AND permanently: an anchor cannot rot when a line is
inserted above it, and it damages no existing or future entry. **Both halves pass.**
**(b)** Renumber to `.gitignore:115-119`. Fixes it today; **fails the future half** — it rots on
the next insertion above line 115, which is how it got to 107 in the first place.

Agents cannot edit this layer: the bootstraps are `C:\Users\Marco\Claude\Scheduled\<task>\SKILL.md`
and Marco pastes them (STATION-CAPABILITIES §1).

**DISPOSITION: ESCALATED** — to Marco, folded onto the existing 2026-09-06 escalation, with the
two options above and (a) recommended.

### F2 — `03-machine-minder`'s bootstrap still claims a 4-hour cadence against a live daily cron; it is now the ONLY station whose bootstrap disagrees with its cron

[MEASURED] from the scheduled-tasks MCP and the bootstrap text, same minute.
`03-machine-minder`: bootstrap says `Cadence: every 4 hours, or manually after any crash or
reboot.`, live cron `0 9 * * *` — **daily**. Bootstrap mtime `2026-09-01T00:07:44Z`.
Controls, the other three: `04-scanner` bootstrap `Cadence: every 4 hours.` vs `0 */4 * * *` —
agrees; `05-sot-keeper` `Cadence: daily.` vs `10 0 * * *` — agrees; `00-supervisor` was
**repaired**, mtime `2026-09-22T20:26:23Z`, and now carries its own note that the line
*"said 'every 2 hours' from before 2026-09-07 until 2026-09-22"*.

So the class is not open-ended: three of four were correct or have been fixed, and 03 is the
single survivor. STATION-CAPABILITIES §5 records this half as already open with Marco; this run
confirms it is still live at `4b2aa2c6` and narrows it to one file. The error runs in escalation
#23's direction — a cadence overstated 6× makes a missed run invisible.

**RULE 1:** **(a)** Change 03's bootstrap line to read the cadence from the scheduled-tasks MCP
rather than state a number, as `00-supervisor`'s repaired line now does — solves it for every
future cron change too, and touches nothing else. **(b)** Write `daily` into it — correct today,
wrong again the next time Marco moves the cron.

**DISPOSITION: ESCALATED** — Marco-only layer; one-line paste, option (a).

### F3 — the git-guard rule exists in the station docs and in NO bootstrap, while the guard itself is inert

[MEASURED]: `vm-git-guard` occurs **0** times in each of the four enabled bootstraps;
`status-sweep` likewise **0**. The station doc's PREFLIGHT makes installing the guard the first
act of the run, *before any VM-side call*; the bootstrap's STEP 1 is *"start a shell on the
Windows host"* and its STEP 2 is *"read these three"* — so a run following its bootstrap in order
meets the guard rule only after STEP 1. This run walked into the benign version: its first act
was a read of the mounted tree, before the guard was installed. No `git` was involved, and no
lock was created (`index.lock` False in both trees at 06:12Z), so nothing was damaged.

The exposure is narrow — the ban is about `git` through the device bridge, and a host
PowerShell call is not that — but it compounds with the guard's measured `exit 2` INERT state
above: the protection is remembered in a layer that a scheduled run reads *second*, and
DOCTRINE §9.2 records that ban failing seven times.

**DISPOSITION: DEFERRED** — real, not now. Fixing it is the same Marco paste as F1 and F2 and
should ride with them rather than open a third ask. **It becomes urgent the moment another 0-byte
`index.lock` with no owning Windows process appears in either tree** — at that point the
remembered ban has failed an eighth time and the bootstrap layer is where it has to be written.

### F4 — `pr-gates.mjs:327` survives as a raw line citation in the `05-sot-keeper` bootstrap after the repo doc's copy was converted to an anchor, and it already sits one line past its subject

[MEASURED]. `05-sot-keeper`'s bootstrap, line 63:
``CP-24 is a hard block: a PR mixing `sot/` with `scripts/` or `apps/` fails (`pr-gates.mjs:327`).``
The file is `scripts/pr-gates/pr-gates.mjs` (657 lines). Line 327 reads
`// touch sot/ + docs/ (runbooks, pr-prompts, review artifacts).` — the tail of the explanatory
comment. The gate it names starts at **328** and its regexes are at **329–330**. So it resolves
into the right block and is already off its subject by one line.

`docs/pipeline/stations/05-sot-keeper.md` carries **zero** extension-bearing citations — its copy
was converted to an anchor per DOCTRINE §9.5's 2026-09-10 clause. The bootstrap was not. This is
that clause's own recorded failure mode — *"the fix was applied to one file and the rule was never
widened"* — reproduced one layer up, in the layer that actually governs a scheduled run.

It does not break DOCTRINE §9.5's truth-claim (it resolves), but §9.5's per-document evidence
table lists only `.gitignore` citations for the four bootstraps and does not mention this one, so
a run rebuilding that table from the table alone will not see it.

**DISPOSITION: DISPATCHED → Station 00.** Two things, both cheap: fold this citation into the
same bootstrap paste as F1 so Marco fixes one layer once (anchor form: *"the `sotRe`/`codeRe`
block in `pr-gates.mjs`"*), and add one row to DOCTRINE §9.5's per-document evidence table naming
it, so the next `instruction-drift` sweep is not told the bootstraps carry `.gitignore` citations
only.

### F5 — `lint-station.mjs`'s Windows-path advisory fires on regex fragments, not paths

[MEASURED], `node scripts/pipeline/lint-station.mjs`, exit 0. Among the eight advisories it
prints against `DOCTRINE.md` are `! names a Windows path outside the known folder map: e:\s` and
`... r:\s`. Neither is a path: they are tails of regex text quoted in §9.3/§9.5
(`[ \t]*-[ \t]*\S`, `\r?\n` and kin) matched by a `<letter>:\<...>` drive pattern. Two more are
`C:\\Foo\\Bar` — §9.2's deliberately-fictional worked example.

Exit 0, so nothing is blocked today. It is filed because it is the shape DOCTRINE §9.5 argues
about the citation regex: *"a gate that fails scores of times on its first run is disabled by its
first reader"*, and an advisory that cries wolf on the document it is most often run against
trains its reader to skim the block.

**DISPOSITION: DEFERRED.** Cost is noise, not a wrong verdict. **It becomes urgent the moment
anyone flips this rule from advisory to failing** — at that point `DOCTRINE.md` red-fails CI on
five false positives. The fix is to require a path separator after the drive colon and exclude
matches preceded by a backslash-escape context.

## WHAT I DID NOT DO

- **Staged no prompt.** Budget was 2; I staged 0. The one backlog item reading READY,
  `rates-11c-blocked-consumers`, is on the forbidden never-arm denylist enforced in
  `queue-sync.ps1` (`rates-s11c`) and carries an irreversible table drop; its successor chain is
  Marco's. Reported, not staged.
- **Mutated nothing on the board.** 04 is read-only there. The sweep verdict was `CAUTION` with
  a live station worktree at `C:/po-wt/s9hex` and a build in flight, which I obeyed by touching
  nothing — including that worktree.
- **Did not commit `sweep-rotation.json` or this breadcrumb.** The dev tree is on `main`, which
  nobody commits to directly, and 04 may not create a PR. Both are named above for Station 00.
- **Ran ONE named sweep and covered it, rather than a shallow pass over everything.** Part 0
  static audit, Part 1 GitHub reconciliation and Part 2 live-site patrol were NOT run this
  cycle — the rotation gave `instruction-drift` and a rotation that never turns is the failure
  the one-sweep rule exists to prevent.
- **Did not edit any bootstrap.** That layer is Marco's by paste and an agent cannot change it;
  F1–F4 are written as asks, not as staged edits.
- **Did not edit `/sot/`** (05's alone), did not touch Azure / Entra / SharePoint, did not write
  production data, did not remove a `do-not-merge` label, did not merge anything.
- **Did not clear or re-file the 44 `needs-marco/` entries** the sweep's section 5 tags
  `[FILE]` — section 5 explicitly cannot decide staleness for the ones naming no subject PR, and
  reading 44 files is not this sweep.

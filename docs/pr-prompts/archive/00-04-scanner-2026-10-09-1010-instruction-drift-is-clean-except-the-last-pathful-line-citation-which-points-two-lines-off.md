# Station 04 — Scanner | 2026-10-09T10:09:53Z–2026-10-09T10:4xZ

## GROUND

```
UTC            2026-10-09T10:09:53Z
origin/main    affb1f1b            (git fetch origin, then git rev-parse origin/main)
dev tree       main @ affb1f1b     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter, contract_version 5)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE. Run proceeded with full (read-only) authority.

Sighted run. Desktop Commander present; `start_process` shell `powershell.exe` returned
`LAPTOP-E6NHU4E4` and the host clock on the first call. Not blind.

Sweep taken this run: **instruction-drift** (`node scripts/pipeline/next-sweep.mjs` →
`SWEEP: instruction-drift`, rotation position 4 of 4, previous run 2026-10-09T06:09:53Z).
Covered completely: bootstrap-vs-station-doc diff, `lint-station.mjs`, and path/citation
resolution across all 14 pipeline documents plus the 4 live bootstraps.

## WHAT I MEASURED

**Git guard — quoted in full, with its own exit code (not a pipeline's).**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` → exit **2**.
Last line: `   PATH="/sessions/vibrant-cool-shannon/.local/bin:$PATH" git <args>`.
Headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
[MEASURED] This is the EXPECTED station outcome per the contract's three-outcome table — a
FINDING, not a stop. Controls printed by the installer itself: `bash -lc 'command -v git'` →
the shim; `bash -c 'command -v git'` → `/usr/bin/git`. The device-bridge git ban is therefore
REMEMBERED, not mechanical, for this run. I ran no `git` through the bridge; every `git` in this
report ran in `powershell.exe` on the Windows host.

**Binding reads.** [MEASURED] All three read with `git show origin/main:<path>` in the DEV tree
after `git fetch origin`, never from the working copy: `docs/pipeline/stations/04-scanner.md`,
`docs/pipeline/DOCTRINE.md` (core, in full), `docs/pipeline/STATION-CAPABILITIES.md`.
`DOCTRINE-REFERENCE.md` opened on demand for §9.2 (device-bridge git) and for the citation
write-ups F1 rests on. No piped `hash-object` comparison was made anywhere in this run (§9.2).

**Sweep + verdict.** [MEASURED] `scripts/pipeline/status-sweep.ps1` ran to completion, exit **0**,
195→467 lines read with explicit offsets until `0 remaining` (§9.1 early-return trap; the first
read returned at line 89 of 467). Section 0 positive controls both `[LIVE]`, no `[BROKEN]`.
Verdict: **`SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station
worktrees.`** Board: **0 open PRs**, 0 labelled `do-not-merge`, main CI on `affb1f1b` 4 success /
0 failed. Watcher node RUNNING pid 8848, wrapper alive, heartbeat 40 min (idle, empty queue — not
wedged). Armed prompts: **0**. Board lease free. I mutated nothing on the board regardless.

**Live schedule, from the scheduled-tasks MCP (never from a file, never from the folder list).**
[MEASURED] **FOUR** enabled tasks: `00-supervisor` `5 * * * *` (lastRun 09:13:54Z),
`04-scanner` `0 */4 * * *` (10:09:34Z), `05-sot-keeper` `10 0 * * *` (2026-10-08T22:38:07Z),
`03-machine-minder` `0 9 * * *` (2026-10-08T23:06:07Z). `weekly-security-audit` **`enabled:
false`**, lastRun 2026-09-06T21:32:44Z. This matches STATION-CAPABILITIES §1's 2026-09-15
correction exactly — the live enabled count is four, and the falsifying probe named there
(`enabled` for `weekly-security-audit`) still reads `false`. `Scheduled\` holds **10** folders
against 5 tasks, so the "corpus = every SKILL.md behind an ENABLED task" rule remains the only
sound one.

**Item 1 — bootstrap vs station doc, all four enabled tasks.** [MEASURED]

| task | bootstrap mtimeUtc | bytes | boot ver | doc ver | contract | verdict | `BOOTSTRAP_CORE_REFERENCE_V1` | `read these three in full` |
|---|---|---|---|---|---|---|---|---|
| 00-supervisor | 2026-10-06T05:59:29Z | 8853 | 1 | 1 | 5 | MATCH | 1 | 0 |
| 03-machine-minder | 2026-10-06T05:59:29Z | 8035 | 1 | 1 | 5 | MATCH | 1 | 0 |
| 04-scanner | 2026-10-06T05:59:29Z | 7996 | 1 | 1 | 5 | MATCH | 1 | 0 |
| 05-sot-keeper | 2026-10-06T05:59:29Z | 7971 | 1 | 1 | 5 | MATCH | 1 | 0 |

Controls per bootstrap: POSITIVE `station_doc_version` → 2 hits each; NEGATIVE, a needle minted
this run (`ZZDRIFTNEEDLE-20261009T1010Z-04`) → 0 hits each. **No version drift and no stale
pre-split instruction in any live bootstrap.** STATION-CAPABILITIES' `BOOTSTRAPS_ARE_SPLIT_V1`
falsifying probe still reads 1 hit each, i.e. the correction there is still current.

**Item 2 — `lint-station.mjs`.** [MEASURED] `node scripts/pipeline/lint-station.mjs` → exit **0**,
`ADMIT: all 10 docs clean`, plus `.claude/agents/*.md (9 agent definitions, encoding clean)` and
`bootstraps/*/SKILL.md (5 bootstrap(s) checked, all clean)`. Its only notes are
`! names a Windows path outside the known folder map` advisories (9 of them, all on prose
examples such as `C:\\Foo\\Bar`, `C:\po-scan-`, `e:\s`), and `NOTE bootstraps:
weekly-security-audit has no STEP block — not checked`. Corroborating: `check-lessons.mjs` exit
**0**, `holding=5 regressed=0 broken=0`.

**Item 3 — does every path DOCTRINE and the station docs name still resolve?** [MEASURED] 110
distinct repo-relative path references across the 13 pipeline docs; **97 TRACKED on origin/main,
7 present on disk but gitignored, 6 absent everywhere**. All 6 "absent" are by-design absences
documented in the citing text itself, and **none is drift**:

- `docs/qa/qa-checklist.md`, `qa-findings.md`, `qa-test-data-registry.md` — gitignored run state,
  present on disk. `git check-ignore -q` exit 0 for each.
- `.claude/agents/pr-tester.md` — gitignored by `.gitignore:28` (`.claude/`), exactly as
  STATION-CAPABILITIES §1 records.
- `docs/pipeline/pause.json` — SCRIPT-REGISTRY describes it as the deliberate opt-in silencer for
  `check-pipeline-heartbeat.mjs`. Absent = not silenced. Correct.
- `scripts/pr-watcher/.queue-state.json` — DOCTRINE-REFERENCE states it lives BESIDE THE SCRIPT in
  the watcher clone, not in the dev tree. Probe confirms the doc: dev tree `False`, clone
  `C:\po-watcher\ProjectOperations\scripts\pr-watcher\.queue-state.json` `True`.
- `docs/pr-reviews/pr-1850-review.md` / `pr-1852-review.md` — cited as the two untracked files a
  2026-09 measurement counted, not as paths to open. 31 such files are untracked in the dev tree
  right now, written by the `rev-<N>` job by design.
- `docs/qa/Master-QA-and-Consolidation-Program-Plan.md` — 04-scanner.md's own text records it as
  deleted in the 2026-08-17 cleanup. The citation IS the correction.

Controls: POSITIVE `tracked.has('scripts/pipeline/instrument-lane.json')` → true and
`tracked.has('docs/qa/sot-refs-baseline.json')` → true; NEGATIVE
`tracked.has('docs/pipeline/ZZN-20261009T1010Z.md')` → false. Tracked set = 4441 files.

**Item 3b — every LINE-NUMBER citation, verified against its target.** [MEASURED] 48 citations
across the 14 docs + 4 live bootstraps. **45 resolve to a non-blank line on origin/main; 3 are
occurrences of one citation whose target is deliberately out of repo.** Verified semantically,
not merely for range:

- `.gitignore:28` → `.claude/` ✔ (claim: `.claude/` wholesale)
- `.gitignore:76-83` → the 8 retirement folders, 8/8 in range ✔
- `pr-gates.mjs:327` → the `docs/** is intentionally NOT in codeFiles` comment ✔ (05's CP-24 claim)
- `build-relationship-map.mjs:18-19` → the `--check` mode comment ✔
- `start-watcher.ps1:160` → `UPDATE_AT_MERGE_TIME_V1` ✔
- `CLAUDE.md:19` → the §10 second-lanes sentence ✔
- `C:\po-watcher\ensure-watcher.ps1:10` → **✘ see F1**

Controls: POSITIVE basename resolution `start-watcher.ps1` →
`scripts/pr-watcher/start-watcher.ps1`, `pr-gates.mjs` → `scripts/pr-gates/pr-gates.mjs`;
NEGATIVE `zz-needle-20261009T1010Z.ps1` → `[]`.

**My own instrument lied FOUR times in this one sweep, and I am recording it because a careless
run files all four as findings.** §9.6 says §9 is a written description of broken queries, and an
instruction-drift sweep is the probe most exposed to it:

1. **Extension alternation truncation.** `(md|mjs|js|…)` matched the TAIL of `.json` and `.tsx`, so
   `docs/qa/sot-refs-baseline.json` was reported dangling as `…baseline.js`, and
   `SettingsShell.tsx` as `SettingsShell.ts`. **9 phantom dangles.** Cure: longest-first
   alternation plus a trailing `(?![A-Za-z0-9])`.
2. **"Not tracked" read as "absent".** The gitignored `docs/qa/*` state files are absent from
   `git ls-tree` BY DESIGN. **4 phantom dangles.** Cure: three-way verdict — tracked / on-disk
   (with `check-ignore`) / absent everywhere.
3. **Bare basename resolved as a repo-ROOT path.** `start-watcher.ps1:160` is prose shorthand for
   `scripts/pr-watcher/start-watcher.ps1`. **17 phantom dangles.** Cure: resolve basenames against
   the tracked tree.
4. **Anchor tested with `===` instead of as a prefix.** The `.gitignore` anchor comment the whole
   station contract tells you to cite is `# Overnight-QA scheduled task - local-only run state
   (durable, always-mounted location).` — the prescribed phrase is a PREFIX of it. Exact-equality
   returned `present = false`, which would have filed a phantom S2 against all **43** citations of
   that phrase on origin/main. Re-measured as a substring: present at **.gitignore:113**, with the
   five sinks immediately under it at lines 115–119, each matched literally.
   Controls: NEGATIVE `docs/qa/ZZSINK-20261009T1010Z.md` → absent; `U+FFFD` count in `.gitignore` → 0.

Every count in Item 3 and 3b above is the POST-correction count. The pre-correction run would have
reported 19 + 17 dangling references and one dead anchor. **None of it was real.**

**Open items re-read, per §7.1 — not re-surfaced.** [MEASURED]
`docs/pr-prompts/needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md`: its
bootstrap half now measures DISCHARGED — zero dangling citations in any of the four live
bootstraps, and `03-machine-minder.md` carries **0** hits of `ensure-watcher.ps1:10` against **1**
hit of the prescribed anchor form `(anchor: `$Launcher =`)`. The two remaining
`ensure-watcher.ps1:10` strings in DOCTRINE-REFERENCE are that document quoting the citations it
RETIRED, which is correct text, not live drift. I am not dispositioning the escalation itself —
that is Station 00's.
`.codex/` and `AGENTS.md` remain untracked and not gitignored (`?? .codex/`, `?? AGENTS.md` in
`git status --porcelain`), confirming this morning's 06:10Z F2; the two questions it filed for
Marco are already with him and are **not** re-asked here.

**Dev tree, four readings, per the contract.** [MEASURED]
`git rev-list --left-right --count HEAD...origin/main` → `0 0`; `git diff --numstat` → EMPTY;
`git diff --cached --name-status` → EMPTY; `git status --porcelain` → **33 lines, all `??`**
(`.codex/`, `AGENTS.md`, 4 `Claude Design/` paths, 31 `docs/pr-reviews/pr-*-review.md`). The first
three pass; the fourth is the one that catches the untracked set, exactly as the contract says.
**No `*-ready.md` is tracked at depth 1** (armed count 0, and no board-trap offender found).

## WHAT CHANGED

Nothing on the board. Nothing merged, armed, disarmed, renamed, moved or deleted. No PR opened.
No `/sot/` file touched. No `git` run through the device bridge. No Azure / Entra / SharePoint
contact of any kind.

Two writes, both mine to make and both named here:

1. `docs/pipeline/sweep-rotation.json` — `node scripts/pipeline/next-sweep.mjs --advance --utc
   2026-10-09T10:09:53Z` → `advanced: last_index=3 last_run_utc=2026-10-09T10:09:53Z`.
   **LEFT DIRTY IN THE DEV TREE ON PURPOSE. Station 00 must commit it** — 04 is read-only on the
   board and the dev tree is on `main`, which nobody commits to directly. If this is not committed,
   the next run repeats `instruction-drift` and the rotation silently stops.
2. This breadcrumb, at the tracked path `docs/pr-prompts/00-04-scanner-2026-10-09-1010-…md`.
   **It is UNTRACKED until a board PR commits it** — Station 00 sweeps it up. Cure 1 (write it
   inside my own run's PR worktree) is unavailable to this station: 04 may not create a PR, so the
   dev tree is the prescribed home. Both paths are new, so neither blocks the next fast-forward
   until a PR lands them on `main`.

Scratch `.ps1`/`.mjs` probes were written to `C:\po-sup-fix-scripts\` (the sanctioned scratch
folder), not into the repo.

## FINDINGS

### F1 — S3 — The last surviving pathful line-number citation points TWO LINES off, and names the log where it claims to name the launcher

`docs/pipeline/SCRIPT-REGISTRY.md:100` reads:

> `C:\po-watcher\ensure-watcher.ps1:10` names the same file as its launcher.

[MEASURED] `C:\po-watcher\ensure-watcher.ps1` is 110 lines (5404 B, mtimeUtc
2026-10-03T18:27:33Z, read as bytes with `File.ReadAllLines`, not `Get-Content` piping):

```
  9: $ErrorActionPreference = 'Continue'
 10: $LogPath   = 'C:\po-watcher\ensure-watcher.log'
 11: $StopFile  = 'C:\po-watcher\STOP-WATCHER'
 12: $Launcher  = 'C:\po-watcher\watcher-launcher-singlelane.ps1'
```

**Line 10 names the LOG. The launcher is named at line 12.** The sentence's own surrounding text
is about the launch chain `watcher-launcher-singlelane.ps1 → start-watcher.ps1 → node index.mjs`,
so a reader following the citation to verify which wrapper the keepalive actually uses lands on
`ensure-watcher.log` instead — and DOCTRINE-REFERENCE warns, eight lines further down in its own
write-up, that `ensure-watcher.log` is the precise file a reader must NOT mistake for a source of
truth (`opened PR #` → 0, `[merge]` → 0, `[queue]` → 0, **and the positive control fails too**).
The off-by-two citation walks the reader straight into the trap the same document documents.

This is the **fifth** recurrence of the citation-rot class and the **only** live offender left of
the 48 citations measured. Why it survived every previous sweep: a range check passes on it. Line
10 exists and is non-blank, so "does the citation resolve?" answers YES. Only reading the line and
comparing it against the CLAIM catches it — which is the argument for the anchor form, and the
anchor already exists: `docs/pipeline/stations/03-machine-minder.md` cites this exact file as
``(source of truth: `C:\po-watcher\ensure-watcher.ps1`, anchor `$Launcher =`)``, measured at 1 hit
there against 0 hits of the line form. The cure is to copy that form.

Controls: POSITIVE `ensure-watcher.ps1:10` → 1 hit in SCRIPT-REGISTRY.md, 2 in
DOCTRINE-REFERENCE.md (both retired-quotation context), 0 in DOCTRINE.md, 0 in
03-machine-minder.md; NEGATIVE `ZZF1NEEDLE-20261009T1010Z` → 0 in both files. POSITIVE anchor
control `anchor .\$Launcher` → 1 hit in 03-machine-minder.md.

**RULE 1 options.** Complete-and-additive FIRST:

- **(a) Replace the line citation with the anchor, in the same form 03 already uses** — change
  `` `C:\po-watcher\ensure-watcher.ps1:10` names the same file as its launcher `` to
  `` `C:\po-watcher\ensure-watcher.ps1` (anchor: `$Launcher =`) names the same file as its
  launcher ``. Solves it **immediately** (the sentence becomes true today) and **in future** (an
  anchor does not rot when the file is re-edited, which it was six days ago), damages no data
  entry, and leaves the pathful prefix intact so `lint-station.mjs`'s folder-map check is
  unaffected. One line, one file, `docs/pipeline/` — an ordinary docs PR, not `/sot/`, so no CP-24
  exposure.
- (b) Correct `:10` to `:12`. Fails the **future** half: the next edit to a 110-line script that
  changed three days ago moves it again, and this is the fifth recurrence of exactly that.
- (c) Delete the citation. Fails the **immediate** half: the sentence's whole point is that the
  out-of-repo launcher is identifiable, and removing the pointer loses the only mechanism a reader
  can check.

**DISPOSITION: DISPATCHED** — to Station 00. It is a one-line `docs/pipeline/` edit and I am
read-only on the board and may not open a PR. Option (a), verbatim swap, no other change to the
sentence. Verification after the fix: `Select-String -Pattern 'ensure-watcher\.ps1:10'` over
`docs/pipeline/SCRIPT-REGISTRY.md` → **0**, with the anchor form → **1**, and the
`ensure-watcher.ps1:10` hits in DOCTRINE-REFERENCE.md left at **2** (they are retired-quotation
text and must not be swept).

### F2 — S4 — `vm-git-guard.sh` reports INERT, so the device-bridge git ban is remembered, not mechanical

[MEASURED] exit **2**, headline `vm-git-guard INSTALLED BUT INERT`, quoted in full above. The
installer writes its `PATH` export into `~/.bashrc` and `~/.profile`; a station's shell is
non-interactive and non-login and sources neither.

This is the contract's documented EXPECTED station outcome, recorded for the count rather than as
a defect, and nothing in this run reached for the absent protection as a licence: every `git` ran
on the Windows host via `powershell.exe`, none through the mount.

**DISPOSITION: DEFERRED** — real, not now. It becomes urgent the moment a run is BLIND, because a
blind run has no Windows shell and the remembered ban is then the only thing standing between it
and the 0-byte `index.lock` that freezes every station (§9.2). What would make it urgent: two
consecutive blind runs, or any `index.lock` incident traced to a mount-side `git`. The structural
fix (a wrapper that puts the shim on `PATH` for the shell a station is actually given) is a
`scripts/pipeline/` change and therefore Marco's lane, not 00's.

### F3 — S4 — 33 untracked files sit in the shared dev tree, and only the fourth of the four contract readings can see them

[MEASURED] `git rev-list --left-right --count HEAD...origin/main` → `0 0`, `git diff --numstat`
→ EMPTY, `git diff --cached --name-status` → EMPTY — the three readings a run is most likely to
take all report a clean tree. `git status --porcelain` → **33** lines: `.codex/`, `AGENTS.md`,
4 `Claude Design/` paths, and **31** `docs/pr-reviews/pr-*-review.md` written by the `rev-<N>`
job by design (oldest `pr-2183`, newest `pr-2282` at 09:31Z).

None of the 33 is a breadcrumb, a `*-ready.md` or a tracked-file modification, so **nothing here
blocks a fast-forward today** and the board trap does not fire. What is worth recording is the
growth: 31 review verdicts have accumulated unmirrored in a shared tree, and the moment any one of
those paths lands on `main` the fast-forward refuses while the first three readings still say
PASS. That is the exact failure shape the station contract's fast-forward cure exists for.

**DISPOSITION: DEFERRED** — the mirroring of review verdicts out of the dev tree is Station 03's
machine-hygiene lane (it also owns the 33 non-main worktrees and the 2 registry escapees the sweep
reported this run), and nothing is broken yet. What would make it urgent: a PR that adds any
`docs/pr-reviews/pr-<N>-review.md` for an `<N>` in the untracked set, which turns a clean-looking
tree into a refused fast-forward.

## WHAT I DID NOT DO

- **Did not stage or arm anything.** `check-backlog.mjs` exited **10** with
  `[P2] rates-11c-blocked-consumers` READY TO STAGE. I left it. Its own register note says 11c
  must not merge until `pr-rates-11b2-c-parity-proof` has RUN and come back clean, and that the
  prep corrections must land first — so staging it this run would stage work whose precondition I
  cannot verify, and arming is 00's on Marco's authority in any case. **Reported, not run.**
  `needs-marco=2` (`model-merge-slices-rehomed`, `map-locations-waste-rate-coupling`) are Marco's
  and are not re-asked here.
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site visual patrol).** The station
  doc's own instruction is ONE named sweep per run, covered completely, and the rotation named
  `instruction-drift`. A shallow pass over everything is why findings rot. The board is also empty
  (0 open PRs), so Part 1b/1c would have had nothing to reconcile.
- **Did not prune, clear or touch any worktree, lock or escapee.** The sweep reported 33 non-main
  worktrees, several holding unpushed commits and two holding uncommitted work, plus 2
  registry escapees. All of it is Station 03's, report-only for me.
- **Did not clear any lock.** `git index.lock` interactive/clone both `False`; nothing to assess.
- **Did not commit `sweep-rotation.json` or this breadcrumb.** 04's authority row is
  *Create a PR: NO* and *Mutate the board: NO, read-only*, and the dev tree is on `main`.
- **Did not run `check-breadcrumb.mjs` before writing this file** — it validates a breadcrumb that
  exists. Its result is quoted below; I have written `breadcrumb-clean` nowhere else.
- **Did not touch Azure, Entra, SharePoint, production data, or any `/sot/` file.**

---

## VALIDATOR (run after this file was written, per the report contract)

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs` → `CLEAN`, exit **0**.
`structure: 2 checked, 0 malformed, 0 skipped as pre-contract`. This breadcrumb: `ADMIT`, with
`NOTE ... is UNTRACKED — it reaches nobody until a board PR commits it` — which is the expected
state for a station that may not open a PR, and is why WHAT CHANGED names it for Station 00.

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`, exit **0**.
`00` 1.2 h ago (cadence 1 h + 0.5 h grace) ok · `02` dispatch-only · `03` 11.3 h ago (24 h + 3 h)
ok · `04` 0.2 h ago (4 h + 1 h) ok · `05` 11.8 h ago (24 h + 3 h) ok. Cross-checked against
`lastRunAt` from the scheduled-tasks MCP, which is a different instrument: 00 09:13:54Z,
03 2026-10-08T23:06:07Z, 04 10:09:34Z, 05 2026-10-08T22:38:07Z — all four agree with the
breadcrumb dates, so no station is reporting on a schedule it is not actually running.

`lint-prompt.mjs` was NOT run against this file and its verdict would mean nothing here: it gates
`docs/pr-prompts/` as PROMPTS and rejects a breadcrumb for having no YAML front matter in either
direction. `check-breadcrumb.mjs` is the only validator, and it is the one quoted above.

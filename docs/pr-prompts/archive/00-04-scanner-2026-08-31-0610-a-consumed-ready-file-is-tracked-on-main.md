# Station 04 — Scanner | 2026-08-31T06:10:22Z–2026-08-31T06:34Z

## GROUND

```
UTC            2026-08-31T06:10:22.942Z
origin/main    0a581ac6            (git fetch origin, then rev-parse --short origin/main)
dev tree       main @ 000ee2f1     C:\ProjectOperations2   (4 commits BEHIND origin/main)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (the scheduled-task SKILL.md inlined into this run)
```

Version and bootstrap AGREE — this run is not restricted to read-only on that account.

**SIGHTED.** `start_process` shell `powershell.exe` returned `HOSTOK ... 2026-08-31T06:10:22Z` on
the first call. This was a healthy quiet-ish run, not a blind one.

**Sweep this run:** `instruction-drift` — assigned by `node scripts/pipeline/next-sweep.mjs`
(`rotation position 4 of 4; previous run: 2026-08-31T02:10:32Z`). Not chosen by me.

**Binding docs read in full:** `DOCTRINE.md`, `STATION-CAPABILITIES.md`, `stations/04-scanner.md`.
[MEASURED] All three are byte-identical between dev `HEAD` and `origin/main` —
`git diff --stat HEAD origin/main -- <each>` returned **empty** for all three, so the working-copy
read is sound despite the tree being 4 commits behind. Positive control: the same command over the
4-commit range lists 4 real commits (`git log --oneline HEAD..origin/main`).

**Sweep verdict:** `status-sweep.ps1` at 06:10:59Z — `SAFE TO ACT`. Both instrument positive
controls green. `git index.lock interactive/clone: False / False`, `git processes running: 0`,
in-progress prompts 0. Watcher `pid 6388` healthy, heartbeat 1 min. No lock to age-and-size.

---

## WHAT I MEASURED

Instruments used, all with the controls DOCTRINE §7 guard 1 and §9.6 require. Scripts are in the
sanctioned scratch dir `C:\po-sup-fix-scripts\` (`scan-0610-*.mjs`), not in the repo.

**Tree instrument.** `git ls-tree -r --name-only origin/main` loaded ONCE into a Set —
2763 files, 685 derived dirs. No glob pathspec was ever passed to `ls-tree` (§9.2: any `*` form
returns 0 silently, and `-r` does not rescue it). Controls: `docs/pipeline/DOCTRINE.md` → present;
`docs/pipeline/NO-SUCH.md` → absent; `docs/pr-prompts` → resolves as a dir.

**[MEASURED] Bootstrap vs repo doc, all five scheduled stations.**

| task | bootstrap `station_doc_version` | repo doc | verdict |
|---|---|---|---|
| 00-supervisor | 1 | 1 | MATCH |
| 02-board-driver | 1 | 1 | MATCH |
| 03-machine-minder | 1 | 1 | MATCH |
| 04-scanner | 1 | 1 | MATCH |
| 05-sot-keeper | 1 | 1 | MATCH |

Each bootstrap points at exactly one station doc and it is the right one. Every `C:\` and repo path
named inside the five bootstraps resolves; the single "unresolved" hit per file was my own regex
truncating the breadcrumb **template** `docs/pr-prompts/00-04-<station>-...` at the `<`, not a real
dangling path.

**[MEASURED] `node scripts/pipeline/lint-station.mjs` → `ADMIT: all 7 docs clean`, exit 0.** One
advisory: `04-scanner.md ! names a Windows path outside the known folder map: C:\po-scan-`. That
string sits inside the doc's own `# SUPERSEDED 2026-08-24 - do NOT mint a throwaway worktree`
comment block, i.e. it is the deprecation notice, not an instruction. Not a defect.

**[MEASURED] Path resolution across all 8 pipeline docs on `origin/main`** (DOCTRINE,
STATION-CAPABILITIES, stations 00/02/03/04/05/06): 228 repo paths named, 65 flagged, **61 of the 65
are benign** on inspection — template fragments truncated at `<` (`docs/pr-prompts/00-`,
`docs/pr-reviews/pr-`, `docs/pr-prompts/rev-`…), prose abbreviations (`sot/02`, `sot/05`), files
gitignored **by design and present on disk** (`docs/qa/qa-findings.md`,
`docs/data-model/relationship-map.json` → `.gitignore:127`, `.md` → `:128`,
`apps/api/scripts/xero-import-report.md` → `:86`), and untracked env files (`apps/api/.env`). The
remaining 4 are findings F2–F4 below. **0 bad line-number citations** of the `file.ext:NNN` form
across all 8 docs.

**[MEASURED] Every `.gitignore:N` citation in the repo docs is now CORRECT** — `:75` →
`docs/pr-prompts/*-ready.md`, `:76-83` → `processed/`…`no-pr-opened/`, `:107-111` starts at
`qa-checklist.md`, `:108` → `qa-findings.md`, `:127-128` → the relationship maps. The 2026-08-30
off-by-one repair held on the repo side. **All five BOOTSTRAPS still cite `.gitignore:107` for the
file that swallowed the finding; the correct line is 108** (107 is `qa-checklist.md`). See F5.

**[MEASURED] `C:\ProjectOperations-Reference\worktrees` is absent on disk** — but
`02-board-driver.md:309` already says *"mkdir C:\ProjectOperations-Reference\worktrees first if
missing"*, and the parent `C:\ProjectOperations-Reference` **does** exist. Self-healing. **Not a
finding** — I checked the context before writing it up rather than after.

**[MEASURED] Depth-1 prompt census, disk vs `origin/main`:** tracked depth-1 total 75, tracked
`-HOLD.md` 67, tracked `-ready.md` **1**, disk `-HOLD.md` 67, disk `-ready.md` 2. Controls:
`pr-524-rates-b-slice2-canonical-HOLD.md` → tracked (true); `pr-definitely-not-real-HOLD.md` →
absent (false). `git check-ignore` controls: `*-ready.md` → IGNORED as expected;
`DOCTRINE.md` → not ignored as expected.

**[MEASURED — a near-miss I am recording as a lead, not a finding] Three untracked `-HOLD.md` at
depth 1**: `pr-arm-guard-hook-HOLD.md` (06:03:23Z), `pr-arm-prompt-release-index-HOLD.md`
(06:02:21Z), `pr-watcher-conflict-escalation-HOLD.md` (06:02:53Z). Their mtimes are **7–8 minutes
before this run started.** These are another actor's staging in flight, not orphans, and writing
them up as drift would have been a confident wrong finding. `pr-scopesub-s4/s5-…-HOLD.md` read as
`??` for the same reason in reverse — they landed on main in #1432 at 06:02Z and the dev tree is 4
commits behind. **LL-38: left entirely alone.** Also observed and left alone:
` M pr-scopesub-s2-sub-discipline-HOLD.md` and an untracked
`superseded/pr-doctrine-s9-four-false-traps-LOOPING.md`.

**[MEASURED] `C:\po-wt-h`, named in `STATION-CAPABILITIES.md:146`, does not exist on disk.**
`C:\po-worktrees`, `C:\po-wt`, `C:\po-watcher-worktrees`, `C:\po-watcher\ProjectOperations` and
`C:\po-sup-fix-scripts` all do. A stale entry in an informational folder map; too small to
disposition on its own, folded into F4's fix.

**[MEASURED] `scripts/pipeline/fix-station-bootstraps.mjs` does NOT exist in the repo** — 0 hits
across `git ls-tree -r --name-only origin/main` (62 files under `scripts/pipeline/`, positive
control `lint-station.mjs` found by the same query) and 0 on disk under `C:\ProjectOperations2`.
It lives at `C:\po-sup-fix-scripts\fix-station-bootstraps.mjs`, **4405 bytes, mtime
2026-08-29T10:13:19Z** — byte-for-byte the artifact 00's 10:08Z run described. I checked the
scratch dir *before* writing "does not exist", which is the only reason this is a note and not a
false finding.

**[NOT RE-MEASURED, deliberately] The `fix-station-bootstraps` dry run.** Five runs have now paid
for the same `changed=0 already-clean=0 not-touched=0` reading. Nothing technical is in the way;
only authority is. I did not make it six.

---

## WHAT CHANGED

**On the board: nothing.** I am read-only on it. No prompt armed, disarmed, renamed, moved or
deleted; no PR touched; no label changed; no `git` write of any kind against `docs/pr-prompts/`.

**Written this run:**

- This breadcrumb, at the tracked path `docs/pr-prompts/00-04-scanner-2026-08-31-0610-…md`.
  **Untracked until a board PR commits it — Station 00, please sweep it up.**
- `docs/pipeline/sweep-rotation.json`, advanced by
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-08-31T06:10:32Z`. See WHAT I DID NOT DO
  for why it is left modified-but-uncommitted rather than shipped.
- Four read-only probe scripts in `C:\po-sup-fix-scripts\` (`scan-0610-bootstrap-drift.mjs`,
  `scan-0610-path-citations.mjs`, `scan-0610-triage.mjs`, `scan-0610-context.mjs`,
  `scan-0610-gitignore-and-state.mjs`, `scan-0610-hold-census.mjs`). Outside the repo, per lane.

**Verified after writing:** `node scripts/pipeline/check-breadcrumb.mjs` — result quoted in
WHAT I DID NOT DO. I do not write `breadcrumb-clean` until it has actually exited 0.

---

## FINDINGS

### F1 — [S2] A CONSUMED `-ready.md` IS TRACKED ON `origin/main` AT DEPTH 1. The standing block predicted this exact failure; #1425 performed it.

`docs/pr-prompts/pr-watcher-verdict-sweep-skips-tracked-ready.md` is **tracked on `origin/main` at
0a581ac6** and on dev `HEAD`. My station doc names this class in one line: *"Report tracked
ready-files at depth 1 as a defect."*

- [MEASURED] It is the **only** one. `git ls-tree -r --name-only origin/main -- docs/pr-prompts/`
  filtered to `^docs/pr-prompts/[^/]+-ready\.md$` returns exactly that path; positive control, the
  same query for all depth-1 `.md` returns **73**.
- [MEASURED] **It arrived as a committed arm.** `git log --oneline --follow -- <path>` →
  `c109cf09 docs(pr-prompts): 00 collect — … arm the verdict-sweep fix (#1425)`, preceded by
  `bce9d65e … HOLD — verdict-archive sweep must skip tracked files (#1410)`. Positive control on
  the log instrument: the same command on `DOCTRINE.md` returns 3 real commits. So a `HOLD→ready`
  rename that should have stayed a working-tree fact was **published to main**.
- [MEASURED] **`.gitignore:75` (`docs/pr-prompts/*-ready.md`) does not protect it.** gitignore never
  applies to an already-tracked path — and `git check-ignore -q` on it confirms the rule *matches*
  while the file remains in the tree.
- [MEASURED] **The prompt is already consumed and its premise is dead.** The file is absent from
  disk (` D docs/pr-prompts/pr-watcher-verdict-sweep-skips-tracked-ready.md` in
  `git status --porcelain`). Its own front matter reads
  `premise: '! grep -q "listTrackedVerdicts" scripts/pr-watcher/index.mjs'`; `listTrackedVerdicts`
  now appears **7 times** in `origin/main:scripts/pr-watcher/index.mjs`, shipped as **#1429**
  (merged 05:37Z). Controls: `archiveSettledVerdicts` → 8 hits, `zzzNoSuchSymbolZZ` → 0.
- [MEASURED] **Blast radius, and the part that is NOT alarming.** The file is materialised on disk
  in the watcher clone `C:\po-watcher\ProjectOperations` (clone HEAD `000ee2f1`, which contains
  c109cf09), alongside `pr-sot-ll36-sot-purity-ready.md` and `rev-1162-ready.md`. **But the clone is
  inert as a queue:** all three launchers set
  `$env:PR_WATCHER_PROMPT_DIR = "C:\ProjectOperations2\docs\pr-prompts"`
  (`watcher-launcher.ps1`, `-lane2.ps1`, `-singlelane.ps1`; positive control, the same grep for
  `node` over those files returns 101 lines), and `resolvePromptDir` in `index.mjs` honours that env
  var over `repoRoot`. So **nothing is armed right now.**
- **The hazard is latent, and it is exactly THE BOARD TRAP.** The dev tree currently carries the
  deletion **uncommitted**. Any `git checkout .`, `checkout -- docs/pr-prompts`, `reset --hard`,
  `stash pop` or `git clean` in `C:\ProjectOperations2` — and any **fresh clone** — re-materialises
  an **armed** prompt for work that merged four hours ago, into the exact directory the watcher
  globs. It would burn a full agent run and can open a duplicate PR. The same command also
  resurrects three consumed HOLDs (` D` on `pr-crm-s7-interaction-log-HOLD.md`,
  `pr-estpricing-s2-cutting-rate-corrections-HOLD.md`, `pr-scopesub-s1-one-discipline-list-HOLD.md`).
- **Cure** (one line, additive, reversible): a board PR that commits the deletion of the tracked
  path — `git rm --cached docs/pr-prompts/pr-watcher-verdict-sweep-skips-tracked-ready.md` staged
  **by explicit pathspec**, read back with `git ls-tree` returning 0 depth-1 ready-files against the
  73-file positive control. Nothing else in the index may ride along (§9.2: the dev index is shared,
  and there are four other actors' entries in it right now).
- **Root cause, for whoever fixes it properly:** the arm leaves a staged `R100 HOLD→ready` in the
  **shared** index and a pathspec-less commit then publishes it. The in-flight prompt
  `pr-arm-prompt-release-index-HOLD.md` (staged by another actor 8 minutes before this run) names
  precisely that defect in its own premise. F1 is the evidence that it is not hypothetical.

**DISPATCHED → Station 00 (Supervisor).** It is the only station that may mutate the board; I am
read-only and may not open a PR. Handed over: the path, the proof the premise is dead (#1429), the
proof the clone is inert, the exact pathspec-scoped cure, and the read-back that proves it.

---

### F2 — [S3] Two binding station docs disagree about `docs/pr-prompts/triage-state.md`. 00 recorded it removed; 03 still writes to it five times.

- [MEASURED] `docs/pipeline/stations/00-supervisor.md:388`:
  *"`~~docs/pr-prompts/triage-state.md~~` — REMOVED: this file does not exist on main (checked
  2026-08-24)."*
- [MEASURED] `docs/pipeline/stations/03-machine-minder.md` names it as its **primary state file**
  at `:175` (*"diff against docs/pr-prompts/triage-state.md (create if absent…)"*), `:184`
  (*"Record 'known-pattern: {name}' in triage-state.md"*), `:185` (*"park the batch in
  triage-state.md"*), `:188` (*"already burned one failed fix attempt per triage-state.md"*) and
  `:192` (*"append a run block to triage-state.md … keep the '## For Marco' section at the TOP
  current"*).
- [MEASURED] The file is **not tracked** on `origin/main`, **not on disk**, and **not gitignored** —
  `git check-ignore -v` returns nothing for it, while returning real `.gitignore:127` / `:128` /
  `:86` lines for the three artifacts that *are* ignored. That is the positive control.
- **Why this matters beyond a dangling path.** 03 is instructed to *create it if absent*. When it
  does, the file lands **untracked and unignored** in the queue root: invisible to a clone, to CI,
  and to every cloud-fired station — the same failure mode that let `docs/qa/qa-findings.md` swallow
  a released gate for nine days. And `03` is dispatch-only with no memory tool, so that file is
  supposed to be its continuity across runs. It has none.
- **The fix is a choice, not a typo**, which is why I am not silently patching prose: either 03
  keeps a state file and it is given a *tracked* home (or an explicit `.gitignore` entry plus the
  ⚠️UNTRACKED warning that `00-supervisor.md:389` already carries for `queue-watch-state.md`), or
  03's five references are rewritten to point at its breadcrumb, which is the channel the station
  contract says actually closes.

**DISPATCHED → Station 00**, to route to whoever owns 03's doc (any station may fix a station doc by
ordinary docs PR; it is `docs/`, not `sot/`, so CP-24 is not in play). Folded with F3 and F4 into
one doc-reconcile — they are three instances of one pattern and should not become three PRs.

---

### F3 — [S3] `02-board-driver.md` rule 6c writes the Marco escalation queue to a path that is untracked, unignored, and does not exist.

- [MEASURED] `docs/pipeline/stations/02-board-driver.md:319`: *"Overwrite
  `docs/pr-prompts/AWAITING-MARCO-DECISION.md` each run with a short table (PR # | title | which
  escalate reason | since)."* Referenced again at `:257` as the place an escalation gets listed.
- [MEASURED] Not tracked on `origin/main`, not on disk, not gitignored (same control as F2).
- This is the **escalation queue** — the list of PRs that stop autonomous merge. Written to an
  untracked path it exists only on the box that wrote it. Sibling `queue-watch-state.md` gets an
  explicit *"⚠️ **UNTRACKED** — it exists only on the box that wrote it, so a clone, CI and any
  cloud-fired station see nothing there"* at `00-supervisor.md:389`; `AWAITING-MARCO-DECISION.md`
  gets no such warning anywhere.
- Latent rather than live: 02 has no cadence of its own (STATION-CAPABILITIES §6, dispatch-only), so
  nothing has written it recently. That is why it has gone unnoticed, not why it is safe.

**DISPATCHED → Station 00**, folded with F2/F4.

---

### F4 — [S3] `STATION-CAPABILITIES.md` §1 closes with a state claim that this run measured FALSE — inside the section warning that stale instructions read exactly like current ones.

- [MEASURED] `docs/pipeline/STATION-CAPABILITIES.md:41-42`: *"And `02-board-driver`'s scheduled file
  has not been touched since 2026-07-14."*
- [MEASURED] `C:\Users\Marco\Claude\Scheduled\02-board-driver\SKILL.md` — **5337 bytes,
  `LastWriteTimeUtc = 2026-08-24T22:54:22.674Z`**, declaring `station_doc_version: 1` and pointing
  at `docs/pipeline/stations/02-board-driver.md`, whose front matter also declares `1`. **All five**
  bootstraps were rewritten in the same 2026-08-24T22:54:22Z batch (00 …:22.673Z, 02 …:22.674Z,
  03 …:22.677Z, 04 …:22.678Z, 05 …:22.679Z).
- The claim was true when written and is now six weeks out of date. A reader following it would
  conclude 02's bootstrap is unmaintained and go re-paste a file that is current — which is the
  precise failure the paragraph above it describes. DOCTRINE's own rule applies to this file:
  *"Instructions live here. State does not."* A measured mtime does not belong in a binding doc; a
  pointer to how to measure it does.
- Same fix should drop `C:\po-wt-h` from the folder map at `:146` (measured absent on disk) or
  re-derive that list, and should note that the `machine-minder` wrong-launcher claim in the same
  paragraph carries no date either.

**DISPATCHED → Station 00**, folded with F2/F3 as one doc-reconcile.

---

### F5 — [S3, ALREADY ESCALATED — reinforcing evidence only, NOT a new ask] The repo layer's `.gitignore` citations are now all correct. The five bootstraps are the last place the off-by-one survives — and they are the layer that governs the run.

- [MEASURED] Every `.gitignore:N` citation across all 8 pipeline docs on `origin/main` resolves to
  the line it claims: `:75` → `docs/pr-prompts/*-ready.md`; `:76-83` → `processed/` through
  `no-pr-opened/`; `:107-111` → `qa-checklist.md` through `qa-run-*.md`; `:108` → `qa-findings.md`;
  `:127-128` → the two relationship maps. **Zero wrong.**
- [MEASURED] Every one of the five bootstraps cites **`.gitignore:107`** for the sink that swallowed
  the finding. Line 107 is `docs/qa/qa-checklist.md`; the file that swallowed it is
  `docs/qa/qa-findings.md` at **108**.
- STATION-CAPABILITIES §1 is explicit that the scheduled-task file — not the repo doc, not the
  account skill — is *"the one"* that governs a scheduled run. So the repair has landed everywhere
  except the layer that matters. This is not a second finding; it is the same open item, now with
  the repo side proven clean so the remaining delta is unambiguous.
- I did **not** re-run the dry pass, re-author the script, or re-ask the question.

**DEFERRED** — deliberately, to the existing unanswered escalation (option **(A)**: grant Station 00
standing authority to run `C:\po-sup-fix-scripts\fix-station-bootstraps.mjs` whenever repo doc and
bootstrap disagree and the repo doc is the corrected side). **What would make it urgent:** a
bootstrap citation that changes *behaviour* rather than a line number — e.g. a path that no longer
exists, or a rule the repo docs have since REFUTED. This run measured neither: all bootstrap paths
resolve and all five point at the right doc. It is a paper cut, and it should stop consuming a
finding slot in every run until Marco answers one word.

---

## WHAT I DID NOT DO

- **Did not arm, disarm, rename, move or delete any prompt.** 04 arms nothing (authority matrix,
  STATION-CAPABILITIES §5). Armed count was 2 at 06:10:59Z and I did not change it.
- **Did not touch the three untracked HOLDs written at 06:02–06:03Z, the ` M` on
  `pr-scopesub-s2-sub-discipline-HOLD.md`, or the untracked `superseded/…-LOOPING.md`.** Another
  actor is staging right now. LL-38: a "cleanup" of live work is the incident.
- **Did not fix F1 myself.** Committing a deletion to `docs/pr-prompts/` on main is a board mutation
  and 04 may not open a PR. Dispatched with the cure spelled out instead.
- **Did not stage a fix prompt this run.** My budget allows 2; I spent the run on measurement and
  on not writing three wrong findings (the `ProjectOperations-Reference\worktrees` non-defect, the
  in-flight HOLDs, and `fix-station-bootstraps` "missing"). F2/F3/F4 want one doc-reconcile authored
  by whoever owns those docs, and F1 wants a board commit — neither is mine to stage well.
- **Did not commit `docs/pipeline/sweep-rotation.json`.** `next-sweep.mjs --advance` wrote it and it
  is left **modified-but-uncommitted** in the dev tree. My station doc says to commit it with the
  breadcrumb; the authority matrix says 04 creates no PR. I resolved the conflict in favour of the
  matrix and am flagging it loudly: **Station 00, this file must ride along with your next board PR,
  or the rotation stalls on `instruction-drift` and the next run repeats my sweep.** That
  contradiction between the two documents is itself instruction drift and belongs in the F2/F3/F4
  reconcile.
- **Did not run Part 0 / Part 1 / Part 2 of the legacy brief.** The station doc's AUTHORITY section
  is explicit: ONE named sweep per run, rotated by `next-sweep.mjs`, covered completely. It was
  `instruction-drift`.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.** Not 05; absolute hard stop.
- **Did not run `git checkout` / `reset` / `stash pop` / `clean` anywhere.** F1 is a live
  demonstration of why.
- **Did not use the device bridge for `git`.** Every `git` call went through Desktop Commander
  PowerShell on the Windows host.

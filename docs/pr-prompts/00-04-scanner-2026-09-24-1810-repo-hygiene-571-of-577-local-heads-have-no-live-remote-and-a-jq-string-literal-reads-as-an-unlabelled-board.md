# Station 04 — Scanner | 2026-09-24T18:10:20Z–2026-09-24T18:24Z

## GROUND

```
UTC            2026-09-24T18:10:20Z
origin/main    59d3f4dc            (fetch first, then rev-parse)
dev tree       main @ 59d3f4dc     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** (both `1`), so this run was not restricted to read-only on that
account. It was read-only anyway: Station 04 is read-only on the board by authority.

**Sweep this run: `repo-hygiene`** — rotation position 3 of 4, chosen by
`node scripts/pipeline/next-sweep.mjs`, not by me. Advanced to `last_index=2` at the end of the run.

**This run was SIGHTED.** Not blind. Named explicitly because a blind run and a healthy quiet run
produce the same "no news".

---

## WHAT I MEASURED

### Reachability and the binding-read contract

- [MEASURED] Windows host reachable. `mcp__plugin_desktop-commander_desktop-commander__start_process`,
  shell `powershell.exe`, after a keyword `ToolSearch` for `desktop-commander` (the ids were deferred;
  a cold call would have been an unloaded schema, not blindness):
  `2026-09-25T04:10:20.2242694+10:00` / `main` / `LAPTOP-E6NHU4E4`.
- [MEASURED] **`vm-git-guard.sh` exit code: `2`.** Last line, verbatim:
  `PATH="/sessions/cool-tender-fermat/.local/bin:$PATH" git <args>`
  Headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
  Its own controls, quoted from its output: `bash -lc 'command -v git'` →
  `/sessions/cool-tender-fermat/.local/bin/git`; `bash -c 'command -v git'` → `/usr/bin/git`.
  Exit read directly from the installer, not from a pipeline appended to it. **This is the sixth
  consecutive run to record exit 2** (Station 00's F3 at 17:21Z recorded the fifth). Not re-filed as a
  finding — see WHAT I DID NOT DO.
- [MEASURED] **All three binding docs in the dev tree are byte-identical to `origin/main`**, so
  reading the working copy this run was sound. Probe is the sanctioned one — no piped hash:
  `git diff --numstat origin/main -- <path>` returned **EMPTY** for
  `docs/pipeline/stations/04-scanner.md`, `docs/pipeline/DOCTRINE.md`,
  `docs/pipeline/STATION-CAPABILITIES.md`. Read in the **dev tree**, `C:\ProjectOperations2`, never the
  watcher clone. `git rev-list --left-right --count HEAD...origin/main` → `0	0`.
- [MEASURED] `status-sweep.ps1` ran to completion, exit 0, 221.65s, 417 lines. Section 0 positive
  controls both `[LIVE]` PASS (`gh` reached GitHub; `node` runs). **Section 7 VERDICT: `SAFE TO ACT`.**
  No `[BROKEN]`.

### 1. Orphaned worktrees and their locks

- [MEASURED] `git worktree list --porcelain` in the dev tree — **2 non-main worktrees**:
  - `C:/po-worktrees/sup-cwd-paths` @ `66ac4dcd` [`fix/pipeline-scripts-resolve-state-paths-from-module`]
  - `C:/po-wt/fv2drop` @ `817339c3` [`wt-fv2-formrule-contract-drop`]
- [MEASURED] **No stale worktree locks.** `dir /s /b .git\worktrees\*.lock` → no output;
  `dir /b .git\worktrees` → `fv2drop`, `sup-cwd-paths`. So the specific freeze hazard §9.2 names — a
  0-byte `index.lock` with no owning Windows process — is **absent** this run. This is the sweep's
  headline negative and it is a real one: the registry has two entries, neither is locked.
- [MEASURED] `git -C C:\po-worktrees\sup-cwd-paths status --porcelain`:
  ```
   M docs/data-model/metadata-catalog.json
  ?? pr-body.md
  ```
  **It still holds uncommitted work.** `git worktree remove` will refuse; `--force` would discard it.
- [MEASURED] `C:/po-wt/fv2drop` is clean (0 dirty files per status-sweep's classifier).
- [MEASURED] **Neither worktree's branch has a live remote head.** Cross-checked against
  `git ls-remote --heads origin` (asking the remote, per §9.2 — not `git branch -r`): neither
  `fix/pipeline-scripts-resolve-state-paths-from-module` nor `wt-fv2-formrule-contract-drop` appears in
  the 21 real heads. So neither is pushed anywhere; `sup-cwd-paths` holds the only copy of its 2 files.
- [MEASURED] status-sweep ages at 18:11Z: `sup-cwd-paths` 636 min, `fv2drop` 571 min.
- [MEASURED] `worktree-registry-escapees: none found under known roots` `[LIVE]`.

### 2. Stash growth in the watcher clone

- [MEASURED] `git -C C:\po-watcher\ProjectOperations stash list` → **77 entries.** Dev tree: **1.**
- [MEASURED] **The loop has stopped growing.** Newest watcher stash is
  `stash@{0}: On feat/ratescol-s3-grid-add-column-row-guided-step: watcher-preflight-autostash ... at
  2026-09-16T10:53:28+10:00` — **8.3 days old** at the time of measurement. `stash@{1}` is
  2026-09-16T08:21, `{2}` 2026-09-15T15:06.
- [INFERRED] The launcher preflight has not needed to autostash since 2026-09-16, which is consistent
  with `watcher clone: branch=main dirty=0` `[LIVE]` this run. The 77 are historical residue, not an
  active leak. §9.2 asks for the count *and its growth*; the growth is what changed.
- [MEASURED] The watcher clone's `main` is at `11c07025`
  (`2026-09-24T13:43:34Z docs(pr-prompts): station 00 collect - arm the verdict-guard fix ... (#2165)`)
  against `origin/main` `59d3f4dc` — behind, as expected for a clone that fetches at launch. This is
  exactly why the binding docs were read in the dev tree.

### 3. Superseded / queue-root litter

- [MEASURED] `docs/pr-prompts/superseded/`: **446 tracked** on `origin/main`
  (`git ls-tree -r --name-only origin/main -- 'docs/pr-prompts/superseded/'`), **461 files on disk**.
  The 15-file delta is entirely `*-ready.md.log` sidecars, enumerated by
  `git ls-files --others -- 'docs/pr-prompts/superseded/'`.
- [MEASURED] **6 ignored-but-present files at depth 1 of the queue root**, via
  `git ls-files --others --ignored --exclude-standard -- 'docs/pr-prompts/'` filtered to depth 1
  (`git status` is structurally blind to these — §9.2):
  ```
  docs/pr-prompts/pr-fv2-import-s2-review-route-b-ready.md.log
  docs/pr-prompts/pr-fv2-import-s2-review-route-c-ready.md.log
  docs/pr-prompts/pr-scopecards-s1-operational-costs-priced-b-ready.md.log
  docs/pr-prompts/pr-scopecards-s4a-push-by-destination-api-b-ready.md.log
  docs/pr-prompts/pr-scopecards-s8a-travel-time-snapshot-b-ready.md.log
  docs/pr-prompts/rev-2016-ready.md.usage-limit.log
  ```
  Their parent prompts are gone from depth 1. Oldest 2026-09-15, newest 2026-09-23.
- [MEASURED] **These cannot arm anything.** `scripts/pr-watcher/index.mjs:97`
  `const READY_PATTERN = /^(pr|rev)-.*-ready\.md$/i;` — anchored at `$`, so a `.log` suffix can never
  match. `isReady()` (line 442) is the only gate on `enqueue`. The litter is cosmetic, not a board trap.

### 4. Tracked `*-ready.md` at depth 1 — THE BOARD TRAP

- [MEASURED] **ZERO.** `git ls-tree --name-only origin/main -- 'docs/pr-prompts/'` (trailing slash, no
  `-r`, per §9.2's depth-1 form) → **31 entries**, of which `*-ready.md` = **0**.
- [MEASURED] **Positive control on the same query**, because an empty result is not an empty world:
  the 31 entries include `docs/pr-prompts/PROMPT-SCHEMA.md` (a file I know is tracked) → the query is
  answering. Full depth-1 list captured; 15 of the 31 are `*-HOLD.md`, 1 is Station 00's 1721Z
  breadcrumb, the rest are registers and directory entries.
- [MEASURED] **`-r` contrast**, to prove the depth-1 zero is a real zero and not a blind one:
  `git ls-tree -r --name-only origin/main -- 'docs/pr-prompts/'` → **1400 entries, 175 `*-ready.md`** —
  and **every one** of the 175 sits under `processed/` or `superseded/…`. Retirement is working.
- [MEASURED] `git ls-files --others --exclude-standard -- 'docs/pr-prompts/'` → **0**. Nothing
  untracked-and-not-ignored anywhere in the queue, so the watcher's `untracked-ready-prompt` preflight
  (`warnOnUntrackedReadyPrompts`, index.mjs:3333) has nothing to warn on. Filtered for the armable
  shape `^docs/pr-prompts/(pr|rev)-.*-ready\.md$` at depth 1 → **0**.

**The board trap is clean, measured three ways.**

### 5. Branches merged but not deleted

- [MEASURED] `git ls-remote --heads origin` → **21 real remote heads** (asked the remote, per §9.2).
- [MEASURED] `git for-each-ref refs/heads` → **577 local heads.**
- [MEASURED] **571 local heads have no matching live remote head. 6 do.** The six:
  `chore/sweep-breadcrumbs-20260907-0934`, `docs/st00-collect-2026-09-14-1108`,
  `feat/ea-gate-reporting-team-permission`, `fix/no-rebase-while-checks-run`, `fix1483`, `main`.
- [MEASURED] Positive control: `main` present in both lists (`main_in_remote=True main_in_local=True`).
- [MEASURED] Tip-commit ages of the 571 (all 571 measured, none unreadable):
  **185 older than 30d · 361 older than 14d · 452 older than 7d.**
  Oldest: `chore/sites-detail-page-audit` 2026-06-09. Newest ten are all from the last ~9 hours and are
  all station board branches: `board/station00-2026-09-24-1721`, `board/station00-2026-09-24-1614`,
  `board/station00-2026-09-24-1514`, `sot/reconcile-04-datamodel-2026-09-24`,
  `docs/station-00-correct-f1-stamps`, `docs/station-00-collect-20260924-1500`,
  `board/00-collect-2026-09-24-1214`, `board/sup-2026-09-24-1015`, `wt-fv2-formrule-contract-drop`,
  `docs/s8g-prose-blocks-arming`.
- [CANNOT MEASURE] **Whether each of the 571 was merged.** `git branch -r --merged origin/main` is
  blind to squash merges and every merge in this repo is a squash (§9.2), so I did not run it and am
  not claiming "merged". The measurable claim is the one above: *no live remote counterpart.*
- [MEASURED] **§9.2's `refs/remotes` trap reproduces live:** `for-each-ref refs/remotes` → **117**
  against `git ls-remote --heads origin` → **21**. A pruned cache would still not be authoritative.

### 6. HOLD files tracked on main whose work has already shipped

- [MEASURED] `triage-holds.ps1` (read-only, `--dequeue` never passed) over the 15 depth-1 prompts
  (HOLD=15, ready=0, LOOPING=0): **`spent=0 of 15`. `gates-satisfied=1`, `still-gated=14`,
  `unreadable=0`.** And **`SPENT BEHIND A REJECT: (none)`** — the script re-probed all 14 REJECTs
  directly, so the 14 that lint never ran a premise for were still evaluated.
- [MEASURED] **Both of its controls PASS**, which is what makes the zero readable:
  `GIT control: PASS -- git read origin/main:docs/pipeline/DOCTRINE.md (226897 chars)` and
  `SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture, so the SPENT bucket is
  measurable.` Its own summary says it: *"SPENT BEHIND A REJECT was never observed on the board. The
  fixture control proved the probe CAN emit it, so that 0 means none — not 'this instrument cannot
  say'."*
- [MEASURED] The 14 REJECT reasons: `HUMAN_GATE_PRESENT` ×8, `FILE_GATE_NOT_RELEASED` ×4,
  `GATE_NOT_RELEASED` ×2.
- [MEASURED] One ADMIT with a duplication flag: `pr-fv2-formrule-contract-HOLD.md` overlaps **open PR
  #2158** on **9 of 12** scope entries (`schema.prisma`, `prisma/migrations/`, `forms.service.ts`,
  `forms.dto.ts`, `seed.ts`, `seed-initial-services.ts`, two `__tests__` specs,
  `docs/data-model/metadata-catalog.json`).

**No spent HOLD is squatting on main.** That closes the sixth sweep item cleanly.

### Out-of-sweep, measured because a probe of mine inverted the board's central fact

- [MEASURED] My first labels probe, `gh pr view <N> --json labels --jq '[.labels[].name]|join(",")'`
  with stderr sent to `2>$null`, returned **EMPTY for all five open PRs** — which reads as *"no PR
  carries `do-not-merge`; the board is released."* That is the exact inverse of the truth.
- [MEASURED] Truth, on two independent transports that use no jq string literal:
  `gh pr list --state open --json number,labels` (raw JSON, no `--jq`) and
  `gh api repos/GH-Mantova/ProjectOperations/pulls/<N>` → **all five of #2167, #2166, #2164, #2158,
  #2148 carry exactly one label, `do-not-merge`** (`escalates:true - Marco merges this, not
  automation (DOCTRINE 5b)`). Station 00's 17:21Z reading is **confirmed**, mine was wrong.
- [MEASURED] Mechanism, isolated with ten probes against the same PR (#2167, truth = 1 label
  `do-not-merge`), all from a `-File` script, capturing stderr:
  | filter | exit | out |
  |---|---|---|
  | `.labels \| length` | 0 | `1` |
  | `.labels[0].name` | 0 | `do-not-merge` |
  | `[.labels[].name] \| length` | 0 | `1` |
  | `[.labels[].name] \| @csv` | 0 | `"do-not-merge"` |
  | `.labels[].name` | 0 | `do-not-merge` |
  | `[.labels[].name] \| join(",")` | **1** | `unexpected token ","` — jq saw `join(,)` |
  | `map(.name) \| join(",")` | **1** | `unexpected token ","` — jq saw `join(,)` |
  | `"LITERAL"` | **1** | `function not defined: LITERAL/0` — jq saw bare `LITERAL` |
  **Double quotes are stripped from the `--jq` argument before `gh` ever sees it**, so no jq *string
  literal* of any kind survives. The `"LITERAL"` probe is the decisive control: the quotes are simply
  gone. Single quotes survive the shell but jq rejects them as delimiters (`unexpected token "'"`), so
  there is no quoting workaround — only filters that need no string literal.
- [MEASURED] **This is not confined to `-Command`.** Every probe above ran via
  `powershell.exe -File <script.ps1>`. The existing record (`queue-watch-state.md`, DEFERRED) scopes the
  cause to *"escaped double quotes do not survive the `-Command` layer"*; both halves of that scope are
  too narrow — `-File` strips them too, and the quotes need not be escaped.
- [MEASURED] **It is loud, and only silence makes it dangerous.** Exit is `1` and stderr says exactly
  what happened. My original call was silent *because I wrote `2>$null`.* A caller that discards stderr
  turns a loud parse error into an empty stdout, and an empty stdout here is byte-identical to a true
  "no labels" (§9.6).
- [MEASURED] **Blast radius among committed callers: zero.** Every `--jq` in `scripts/` uses PowerShell
  *double* quotes as the outer delimiter with **no inner string literal**
  (`scripts/security-audit.ps1` lines 13, 25, 27, 30–33, 36 — line 36's
  `map({severity: ..., count: length})` uses bare object keys). No shipped script is broken. The
  exposure is to ad-hoc agent probes, which is where it bit.

---

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced via
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-24T18:18:23Z`, output
  `advanced: last_index=2 last_run_utc=2026-09-24T18:18:23Z`. Verified three ways:
  `git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` → `2	2`; a read-only re-read of
  `next-sweep.mjs` now returns `SWEEP: instruction-drift`, `rotation position 4 of 4`,
  `previous run: 2026-09-24T18:18:23Z`; exit **0** re-measured from `$LASTEXITCODE` (see F3b — the exit
  code I first quoted came from a `cmd /c` `&` chain and was not a measurement).
  🔴 **LEFT DIRTY IN THE DEV TREE ON PURPOSE. Station 00 must commit it** — Station 04 may not commit
  to the shared dev tree, and the dev tree is on `main`. If this is not committed, the next run repeats
  `repo-hygiene` and the rotation silently stops.
- **This breadcrumb**, written to
  `C:\ProjectOperations2\docs\pr-prompts\00-04-scanner-2026-09-24-1810-repo-hygiene-571-of-577-local-heads-have-no-live-remote-and-a-jq-string-literal-reads-as-an-unlabelled-board.md`.
  **Untracked until Station 00 commits it.** It is at a tracked path, not in any of the five gitignored
  `docs/qa/` sinks, and not in the session `outputs` folder. Proved not-ignored on the only query form
  that answers (§9.2, the FILE form, exit read from `$LASTEXITCODE`): `git check-ignore -v --` on it →
  **exit 1, empty**, against a control of `docs/qa/qa-findings.md` → **exit 0**,
  `.gitignore:116:docs/qa/qa-findings.md`. And `git ls-files --others --exclude-standard --
  docs/pr-prompts/` — which excludes ignored files — now lists exactly this one file, where it returned
  **0** before I wrote it. `check-breadcrumb.mjs` agrees: `ADMIT`, plus its own `NOTE ... is UNTRACKED —
  it reaches nobody until a board PR commits it`.
  ⚠️ **Both files above are untracked paths in the dev tree and will block the next `git merge
  --ff-only`** once a PR lands them on `main`, while `--numstat` and `--cached` both read EMPTY. The
  dev tree also already holds 11 untracked `docs/pr-reviews/pr-*-review.md` files and
  `Claude Design/docs/index.html` from earlier runs (`git status --porcelain`, all `??`; tracked
  porcelain and `git diff --cached --name-status` are both EMPTY).
- **Nothing else.** No prompt armed, disarmed, renamed, moved or deleted. No PR created. No worktree
  pruned. No stash dropped. No branch deleted. No label touched. Nothing merged.

---

## FINDINGS

### F1 — 571 of 577 local heads in the dev tree have no live remote counterpart, and every station run adds ~10 more

[MEASURED] 577 local heads against **21** real remote heads (`git ls-remote --heads origin`). Only 6
locals match a live head, `main` included. 185 tips are older than 30 days; 452 older than 7.

The generator is visible in the data rather than inferred from it: the **ten newest** stale locals are
all station board branches created in the last ~9 hours — `board/station00-2026-09-24-1721`,
`board/station00-2026-09-24-1614`, `board/station00-2026-09-24-1514`,
`sot/reconcile-04-datamodel-2026-09-24`, and so on. Each one's PR squash-merged, GitHub deleted the
remote branch, and **nothing deletes the local ref.** At roughly one board PR per hour that is ~24
refs/day accruing forever; 577 is about where three months of that lands.

Why it is not cosmetic: this is the substrate under §9.2's `git branch -r` trap, which I re-measured
live at **117 vs 21**. Every local-ref read in this repo is now 27× noisier than the truth, `git
branch`/`for-each-ref` output is unreadable by eye, and 571 refs pin their whole object graphs so `gc`
can never release them. An agent that reaches for a local-ref listing gets a confident wrong answer,
which is the §7 failure mode this pipeline keeps paying for.

RULE 1 on the remedy, complete-and-additive first:
- **(A) — complete and additive.** Make the deletion part of the merge, and add a bounded catch-up.
  Station 00 already knows the branch name when it merges its own collect PR; deleting the local ref
  after a confirmed squash-merge closes the leak at the source and is idempotent. Pair it with a
  one-off reaper for the existing 571, scoped to refs whose tip is **>30 days old AND** which have no
  live remote head (185 by today's measurement), emitting the list for review before deleting. Solves
  it immediately and in future; touches no data entry. This is a deletion of *local refs only* — no
  remote branch, no worktree, no file — but it is still deletion, so it is Marco's call, and the reaper
  should print before it acts.
- **(B) — fails the "future" half.** Reap the 185 now, change nothing about merge. The leak continues
  at ~24/day and the count is back inside a month.
- **(C) — fails the "completely" half.** Document "ask the remote, never `git branch -r`" harder in
  §9.2. It is already there, I quoted it, and it did not stop the namespace growing — a rule that
  depends on being remembered is the thing §9.2 says has failed seven times.

Neither `wt-fv2-formrule-contract-drop` nor `fix/pipeline-scripts-resolve-state-paths-from-module` may
be reaped under any option: both are checked out in a live worktree and neither exists on the remote,
so `sup-cwd-paths` holds the only copy of its two dirty files (see F2).

**ESCALATED** — Marco. Deleting refs is irreversible (DOCTRINE §5.4), so no agent should do it
unasked, and the question is a real one: *may Station 00 delete its own local board branch after
confirming its PR squash-merged, and may a print-first reaper clear the 185 refs older than 30 days
with no live remote head?* Option (A) above is the recommendation. I deleted nothing.

### F2 — `C:/po-worktrees/sup-cwd-paths` still holds the only copy of 2 files, unchanged across three consecutive reports

[MEASURED] `git -C C:\po-worktrees\sup-cwd-paths status --porcelain` → ` M docs/data-model/metadata-catalog.json`
and `?? pr-body.md`. Its branch `fix/pipeline-scripts-resolve-state-paths-from-module` is **absent from
the 21 live remote heads**, so the work is unpushed and exists nowhere else. Age 636 min at 18:11Z.
The second worktree, `C:/po-wt/fv2drop` [`wt-fv2-formrule-contract-drop`], is clean and also has no
remote head.

[MEASURED] **No lock files** — `dir /s /b .git\worktrees\*.lock` returned nothing. So the freeze
hazard §9.2 names is not present; the risk here is pure data loss, not a wedged board.

New this run, and the reason it is worth another line: the **branch-side** measurement. Earlier reports
established the worktrees are orphaned and one is dirty (Station 00's F5, 17:21Z; the 2026-08-31
station summary lists "the four worktree escapees" as LEFT ALONE). None of them recorded that the
branch has no remote head, which is what upgrades this from "tidy up later" to "one `--force` from
losing a `metadata-catalog.json` edit". `git worktree remove` will refuse while it is dirty — that
refusal is currently the only thing protecting the file.

**ESCALATED** — Marco, jointly with F1, because the safe move is a commit-or-copy decision only he can
make: `metadata-catalog.json` is a generated data-model artifact and whether that edit is wanted is a
product question. Cheapest safe step that needs no decision: copy both files out to a named location
before anyone touches the worktree. I did not prune, did not force, did not commit.

### F3 — a `--jq` string literal silently reads the parked board as released, and the recorded cause is scoped too narrowly

[MEASURED] `gh pr view <N> --json labels --jq '[.labels[].name]|join(",")' 2>$null` returned **empty
for all five open PRs**. The truth, on two literal-free transports, is that **all five carry
`do-not-merge`**. The empty answer is indistinguishable from "the board is released" — the single most
consequential fact on this board, since Station 00's F1 at 17:21Z is precisely *"every product PR is
parked behind one label"*.

[MEASURED] The mechanism, isolated over ten probes (table under WHAT I MEASURED): **double quotes are
stripped from the `--jq` argument before `gh` receives it**, so jq sees `join(,)` and `LITERAL`. The
`--jq '"LITERAL"'` control settles it. Single quotes survive but jq rejects them as delimiters, so
there is no quoting escape — only filters needing no string literal (`@csv`, `.labels[].name`,
`length` all returned correct values at exit 0).

Two corrections to the existing record, which sits DEFERRED in `queue-watch-state.md` as *"escaped
double quotes do not survive the `-Command` layer … DOCTRINE 9.4 carries the cause but scoped to
`--jq` only"*:
1. **Not just `-Command`.** Every probe here ran under `powershell.exe -File <script.ps1>` and was
   stripped identically. An agent that moves its one-liner into a script file to dodge this does not
   dodge it.
2. **Not just *escaped* quotes.** Bare double quotes inside a single-quoted PowerShell string are
   stripped too.

And the part that decides the cure: **the failure is loud** — exit 1, explicit stderr. It only became
silent because I wrote `2>$null`. So the rule is not "avoid `--jq`", it is **never discard stderr and
never ignore `$LASTEXITCODE` on a `gh --jq` call**, plus **prefer `@csv` or a bare path over any jq
string literal**.

[MEASURED] Blast radius among committed callers is **zero** — every `--jq` in `scripts/` uses no inner
string literal (`scripts/security-audit.ps1` lines 13, 25, 27, 30–33, 36). No shipped script needs a
fix. The exposure is ad-hoc agent probes, which is where it bit, twice now from two directions.

**DISPATCHED → Station 00.** This belongs in the §9.4 canonical block, folded together with the
already-DEFERRED `Select-String -Pattern` sibling in `queue-watch-state.md` rather than filed beside
it — both are one cause (PowerShell eating quote characters out of a native command's argument) and
the block should be re-recorded once, with the `"LITERAL"` control as the falsifying probe and the
"keep stderr, check the exit code" cure. I edited no doctrine: `sot/` is Station 05's and
`DOCTRINE.md`'s canonical block needs a hash re-record, which is 00's.

### F3b — `cmd /c "<cmd> & echo %ERRORLEVEL%"` reports the PREVIOUS exit code, and I published two of them before catching it

[MEASURED] `cmd` expands `%ERRORLEVEL%` when it **parses** the line, not when execution reaches the
`echo`, so in a single-line `&` chain the printed value is whatever the errorlevel was *before* the
command ran. Caught on a query whose truth is known in both directions:
`cmd /c "git check-ignore -v <breadcrumb> & echo IGNORE_EXIT=%ERRORLEVEL%"` printed
**`IGNORE_EXIT=0` with no match line** — i.e. "this file is ignored", with nothing to show for it. The
same query from a `-File` script reading `$LASTEXITCODE` is **exit 1, empty output = NOT ignored**,
against a control (`docs/qa/qa-findings.md`) of **exit 0** plus
`.gitignore:116:docs/qa/qa-findings.md`. Opposite truths; the chained form reported the wrong one.

This bit **this report.** I used that idiom for `ADVANCE_EXIT` and `BREADCRUMB_EXIT` and wrote both into
WHAT CHANGED as measurements. Both are now **re-measured from `$LASTEXITCODE` in a `-File` script** and
both genuinely are `0` — so the published numbers were right by luck, not by measurement, which is the
distinction §7 exists to protect. Corroboration for each was independent of the exit code anyway:
next-sweep printed `advanced: last_index=2`, and a read-only re-read now returns
**`SWEEP: instruction-drift`, rotation position 4 of 4, previous run `2026-09-24T18:18:23Z`**;
check-breadcrumb printed its own `ADMIT` and `CLEAN`.

🔧 **Cure: never read an exit code out of a `cmd /c` `&` chain.** Use `powershell.exe -File <script>`
and read `$LASTEXITCODE` on the following line, or `cmd /v:on` with `!ERRORLEVEL!`, or give the command
its own invocation. The failure prints a well-formed, plausible integer and nothing warns.

**DISPATCHED → Station 00**, to fold into the same canonical-block re-record as F3 — it is the third
face of one cause, a Windows shell layer mangling what a native command's caller reads, and should land
in one edit rather than three. Falsifying probe for the record: run `check-ignore` through both forms
against one ignored and one non-ignored file; the chained form returns the same answer for both.

### F4 — 21 stale watcher log sidecars, 6 of them at depth 1 of the queue root

[MEASURED] 6 ignored `*-ready.md.log` / `.usage-limit.log` files at depth 1 of `docs/pr-prompts/`
(enumerated under WHAT I MEASURED), parents long gone, dated 2026-09-15 to 2026-09-23; plus 15 more
under `superseded/` (461 on disk vs 446 tracked). `git status` cannot see any of them — §9.2.

[MEASURED] **They are inert.** `READY_PATTERN = /^(pr|rev)-.*-ready\.md$/i` at
`scripts/pr-watcher/index.mjs:97` is `$`-anchored and `isReady()` is the only gate on `enqueue`, so a
`.log` suffix can never be dequeued. I checked this specifically rather than assume it, because a
filename that *looks* armed at depth 1 of the queue root is exactly the board trap's shape.

**DEFERRED.** Real but harmless: it makes the queue root harder to read by eye, and depth 1 of the
queue root is where a human looks to answer "what is armed?". It becomes urgent only if `READY_PATTERN`
is ever loosened at the tail, at which point 6 dead prompts arm themselves — so the sidecars are worth
sweeping on the next occasion a board PR touches that folder anyway. No agent bulk-deletes; a prompt
to clear them is not worth a watcher run on its own.

### F5 — CLEAN: the board trap, and spent HOLDs

Recorded as a finding because a clean result with controls is evidence, and an unstated clean result is
indistinguishable from a sweep that did not look.

[MEASURED] **Board trap: 0 tracked `*-ready.md` at depth 1 of `docs/pr-prompts` on `origin/main`** —
depth-1 query returned 31 entries and the positive control (`PROMPT-SCHEMA.md` present) proves it
answered; the `-r` contrast found 175 tracked ready-files, **all** under `processed/` or `superseded/`;
and `git ls-files --others --exclude-standard` over the queue returned 0, so there is nothing untracked
for the watcher's own preflight to warn about either. Retirement is working.

[MEASURED] **Spent HOLDs: 0 of 15**, `unreadable=0`, and `SPENT BEHIND A REJECT: (none)` — with both
of `triage-holds.ps1`'s controls PASSing, including the fixture that proves exit 3 is reachable. The 14
REJECTs were re-probed directly, so no spent prompt is hiding behind a gate.

[MEASURED] One item for the arming lane rather than hygiene: `pr-fv2-formrule-contract-HOLD.md` ADMITs
and overlaps **open PR #2158** on 9 of 12 scope entries. Precision on a one-entry scope is zero by
construction, so this is a candidate and not a verdict.

**DISPATCHED → Station 00.** The clean readings need nothing. The #2158 overlap needs confirming **on
the prompt's own marker string, not on the head branch** (`feat/fv2-formrule-contract-drop`, which the
prompt asserts nowhere) before that HOLD is ever armed: `gh pr view 2158 --json title,body`.

---

## WHAT I DID NOT DO

- **Did not act on the board.** Station 04 is read-only there: nothing armed, disarmed, renamed, moved
  or deleted; no PR opened; no `do-not-merge` label touched; nothing merged. `status-sweep.ps1` said
  `SAFE TO ACT`; my authority, not the verdict, is what kept me read-only.
- **Did not stage a prompt.** The sweep permits staging a lint-clean `-HOLD` for anything worth
  deleting, and I deliberately staged none: F1 and F2 both end in irreversible deletion and are
  Marco's under §5.4, and F4 is not worth a watcher run by itself. Staging a prompt for work that
  needs a human decision first would just park the decision somewhere less visible.
- **Did not prune a worktree, drop a stash, or delete a branch.** All three are destructive; the
  `sup-cwd-paths` worktree holds the only copy of 2 files.
- **Did not mint a throwaway worktree** to get a clean read. Read `origin/main` at a named SHA
  (`59d3f4dc`) with `git show` / `ls-tree` / `diff --numstat`, per AUTHORITY — an orphan's lock has no
  holding process by construction, and this run is *about* orphaned worktrees.
- **Did not run `git` from the VM against the Windows `.git`.** Every git command above ran in a
  `powershell.exe` shell on the host. The VM-side reads I did make were plain file reads through the
  mount, no git. The guard is INERT (exit 2), so that ban was remembered, not enforced — stated plainly
  because an inert guard is not a licence.
- **Did not re-file three findings that are already on the board**, per the re-read rule and angle 4:
  Station 00's **F1/F2** (the ten red checks are one `do-not-merge` label on five PRs — I re-measured
  and *confirmed* it, which is the whole of F3's story), its **F3** (guard INERT, exit 2 — this run is
  the sixth consecutive; recorded under WHAT I MEASURED, not as a finding), and its **F5** (the two
  orphaned worktrees — F2 above adds only the new branch-side measurement and the persistence).
- **Did not touch `/sot/`** (Station 05's), `DOCTRINE.md`, or any station doc. F3's cure needs a
  canonical-block re-record, which is Station 00's.
- **Did not go near Azure / Entra / SharePoint**, and nothing in this sweep came close.
- **Did not commit anything.** `git diff --cached --name-status` was EMPTY before and after, so no
  other chat's staged work was at risk. The rotation advance and this breadcrumb are both left dirty in
  the dev tree for Station 00.
- **Covered one sweep, not four.** `instrument-honesty`, `gate-liveness` and `instruction-drift` were
  not run; the rotation is advanced to `last_index=2` so the next run takes `instruction-drift`. F3 is
  an instrument-honesty finding that surfaced inside this sweep, not evidence that sweep was done.

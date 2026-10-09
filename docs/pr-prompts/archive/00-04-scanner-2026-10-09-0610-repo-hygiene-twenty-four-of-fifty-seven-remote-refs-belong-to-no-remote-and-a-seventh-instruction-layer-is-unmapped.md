# Station 04 — Scanner | 2026-10-09T06:09Z–2026-10-09T06:35Z

## GROUND

```
UTC            2026-10-09T06:09:53Z
origin/main    42c09453              (fetched, then rev-parse)
dev tree       main @ 42c09453       C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** (both `1`), so this run was not restricted to read-only by the
version check. It was read-only anyway: Station 04 is read-only on the board by authority
(`STATION-CAPABILITIES.md` §5).

**Sweep taken:** `repo-hygiene` — assigned, not chosen.
`node scripts/pipeline/next-sweep.mjs` → `SWEEP: repo-hygiene`, exit 0,
`(rotation position 3 of 4; previous run: 2026-10-09T02:10:14Z)`.

**Transport:** sighted. Desktop Commander reached the Windows host on the first call after a single
keyword `ToolSearch` for `desktop-commander`. **This was not a blind run.**

**Device-bridge git guard**, run before any VM-side call:
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` →
**exit code 2**, last line:

> `To get the protection for one call, put the shim on PATH yourself:`
> `   PATH="/sessions/laughing-nice-turing/.local/bin:$PATH" git <args>`

headline line: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`

Exit 2 is the **expected** outcome for a station (station contract, PREFLIGHT step 1): the installer
writes its `PATH` export into `~/.bashrc`/`~/.profile` and a station's shell is non-interactive and
non-login. A FINDING, not a STOP. **I ran no `git` through the device bridge at all** — every `git`
in this run went through PowerShell on the Windows host.

**Concurrency, measured at 06:13:58Z — another actor was live on the board while I ran:**
`board lease: station-00.interactive  reason=arm:pr-sweep-quote-the-heartbeat-alarm  1 min old
expires=2026-10-09T06:43:05Z`, and `BUILD IN FLIGHT: pr-sweep-quote-the-heartbeat-alarm-ready.md
(tick 0.4 min old)`. I hold no lease and mutated nothing, so there is no collision — but a
`C:/po-wt/rel-2261` worktree **age 3 min** appeared in the sweep that was absent from my own
worktree enumeration taken at 06:10. That is `[LIVE]` meaning "true when measured" behaving exactly
as the contract warns.

---

## WHAT I MEASURED

All `git` below was run via `powershell.exe` on the Windows host against `C:\ProjectOperations2`.

### The board trap — CLEAN, with a positive control

- **[MEASURED]** `git ls-tree -r --name-only origin/main -- "docs/pr-prompts/"` → **1485** paths.
  Filtered `^docs/pr-prompts/[^/]+-ready\.md$` → **0**. **No tracked `*-ready.md` at depth 1.**
- **[MEASURED] POSITIVE CONTROL** — the same glob finds ready-files where they genuinely are:
  `-ready\.md$` at any depth → **175** (e.g. `docs/pr-prompts/processed/pr-resolve-732-site-signin-conflict-ready.md`,
  and 174 under `superseded/`). So the depth-1 zero is a real zero, not a blind grep.
- **[MEASURED] NEGATIVE CONTROL** — freshly minted needle path
  `docs/pr-prompts-zqx7needle20261009/` → **0**.
- **[MEASURED]** Tracked HOLD files: 353 total, **14 at depth 1** — all legitimately armed-waiting
  per QUEUE_LAYOUT_V1 (`hold` is a filename state at depth 1 by design, DOCTRINE §8.5).

### Remote-tracking refs

- **[MEASURED]** `git remote` → **`origin`, and only `origin`**.
  `git config --get remote.origin.url` → `https://github.com/GH-Mantova/ProjectOperations.git`, exit 0
  (positive control). `git config --get remote.staleprobe.url` → **exit 1 (absent)**.
- **[MEASURED]** `git for-each-ref refs/remotes` → **57** refs across four namespaces:

| namespace | refs | configured remote? |
|---|---|---|
| `origin` | 33 | CONFIGURED |
| `pr` | 14 | **NO SUCH REMOTE** |
| `staleprobe` | 9 | **NO SUCH REMOTE** |
| `pr1273` | 1 | **NO SUCH REMOTE** |

  `ORPHAN_REMOTE_TRACKING_REFS=24 of 57`.
- **[MEASURED]** `git branch -r` → **57 lines**, of which **24** match the orphan namespaces. The
  contamination is not theoretical: `git branch -r --merged origin/main` returned **3** lines and one
  of them is **`staleprobe/main`** — a ref no remote owns, presented as a merged remote branch.
  `git rev-parse refs/remotes/staleprobe/main` → `0029fcdf` (the ref is real, its remote is not).

### Worktrees

- **[MEASURED]** `scripts/pipeline/status-sweep.ps1`, generated `2026-10-09 06:13:58Z`, section 0
  positive controls both `[LIVE]` (`gh CAN reach GitHub (saw merged PR #2277)`, `node runs`) — so
  the report is trustworthy by its own gate.
- **[MEASURED]** `[LIVE] non-main worktrees found: 32`. **31 classified
  `orphaned worktree (aborted run leftover -- investigate/prune)`**; exactly one classified
  `LIVE STATION WORKTREE: C:/po-wt/rel-2261 ... age=3 min -- do NOT prune`.
- **[MEASURED]** Unpushed work the orphans hold, summed from the sweep's own
  `HOLDS n COMMIT(S) ON NO REMOTE BRANCH` lines: **~130 commits across 27 worktrees**, largest
  `C:/po-wt/fv2drop` **21 commits** (age 21454 min ≈ 15 days), then `C:/po-wt/s8h` **16**,
  `C:/po-wt/rcpt-2183` **15**. Two hold **uncommitted** work:
  `C:/po-worktrees/sup-cwd-paths` (2 files, age 21519 min) and
  `C:/PR-Master/worktrees/sweep-dirty-untracked-v1` (1 file, age 9204 min).
- **[MEASURED]** `git worktree prune --dry-run -v` → **empty**: nothing is prunable by git's own
  test, because every registered directory still exists. The orphans are orphaned by *liveness*, not
  by a missing directory — `prune` is structurally blind to them.
- **[MEASURED]** `worktree-registry-escapees: 2` — `C:\PR-Master\worktrees\bootstrap-check`
  (age 9047 min) and `C:\po-wt\dispatch-register-v1` (age 9153 min), both `size=0KB .lock=False`.
- **[MEASURED]** No `index.lock` anywhere under the dev tree or the clone; sweep section 3 agrees:
  `git index.lock interactive/clone: False / False`, `git processes touching our trees (scoped): 0`.

### Stash growth in the watcher clone

- **[MEASURED]** `git -C C:\po-watcher\ProjectOperations stash list` → **86 entries**.
  Newest `2026-10-04 16:57:12 +1000` (`watcher-preflight-autostash on 'main'`); oldest
  `2026-07-14 08:44:31 +1000` (`WIP on feat/sharepoint-folder-mappings`). **87 days of accumulation.**
- **[MEASURED]** dev tree `stash list` → **1**.
- **[MEASURED]** Sweep: `watcher clone: branch=main tracked-dirty=0 untracked=3`.

### Queue-root litter

- **[MEASURED]** 8 loose files at queue depth 1 that are neither prompts nor breadcrumbs — 7
  `*-ready.md.log` plus `rev-2016-ready.md.usage-limit.log`. All three sampled are **gitignored**:
  `git check-ignore -v` → `.gitignore:26:*.log`, exit 0. POSITIVE control
  `docs/qa/qa-findings.md` → `.gitignore:116:docs/qa/qa-findings.md`, exit 0. NEGATIVE control
  `docs/pr-prompts/README.md` → **exit 1, empty** (correctly not ignored). So the litter cannot
  dirty the tree or block a fast-forward.

### Dev-tree dirt (the fast-forward precondition, all four readings)

- **[MEASURED]** `git rev-list --left-right --count HEAD...origin/main` → **`0  0`**
- **[MEASURED]** `git diff --numstat origin/main` → **EMPTY**
- **[MEASURED]** `git diff --cached --name-status` → **EMPTY**
- **[MEASURED]** `git status --porcelain` → **27 entries, ALL untracked (`??`)**, no tracked
  modification. 25 of the 27 are `docs/pr-reviews/pr-<N>-review.md` (#2183…#2276); the other two
  are `.codex/` and `AGENTS.md`, plus three `Claude Design/proposed/*` directories and
  `Claude Design/docs/index.html`.
- **[MEASURED]** `docs/pr-reviews/` tracked on `origin/main` → **185** files. **Collision check:
  none of the 25 untracked review paths exists on `origin/main`.** So they are not blocking a
  fast-forward *today*; they become blockers the moment a PR lands those exact paths, which is the
  mechanism the station contract describes and which archive breadcrumb
  `00-00-supervisor-2026-09-22-0930-...` records having already fired once on eighteen such files.

### The Codex instruction layer

- **[MEASURED]** `AGENTS.md` at repo root: exists, mtimeUtc `2026-09-27T22:41:09`,
  `check-ignore` **exit 1 (NOT ignored)**, `ls-files --error-unmatch` **exit 1 (NOT tracked)**.
  Same three readings for `.codex/`.
- **[MEASURED]** `.codex/agents/` holds **9** agent definitions (`00-supervisor.toml` …
  `06-pr-master.toml`, plus `pr-fix-reviewer.toml`, `pr-tester.toml`), **57,735 bytes** total.
- **[MEASURED] encoding, read as BYTES with `node`, not `Get-Content`** (DOCTRINE §9.3):
  all 9 `.toml` → `U+FFFD=0 cp1252sig=0`; `AGENTS.md` → `bytes=1974 U+FFFD=0 cp1252sig=0 BOM=false`;
  `CLAUDE.md` → `bytes=1986 U+FFFD=0 cp1252sig=0 BOM=false`.
  `CODEX_TOML_SEEN=9 CODEX_TOML_DAMAGED=0`.
  **POSITIVE CONTROL on the detector itself:** a synthetic CP1252 double-encode buffer scored
  `cp1252sig=1`, so the detector is not blind. **The layer is encoding-clean.**
- **[MEASURED]** `lint-station.mjs` sweep corpus: `const AGENT_DIR_REL = '.claude/agents';` (L390),
  and its ADMIT line reports `.claude/agents/*.md (<n> agent definitions, encoding clean)` (L411).
  **`.codex/agents` and root `AGENTS.md` appear nowhere in it.**
- **[MEASURED]** `git grep -n -E "AGENTS.md|\.codex" -- docs sot scripts .github` → 12 hits each,
  **every single one inside archived Station 00 breadcrumbs dated 2026-09-22**, which record them as
  `[INFERRED] '.codex/' and 'AGENTS.md' are untracked artefacts of a lane that is not the watcher`
  and `They belong to a lane I did not identify`. NEGATIVE control needle → **0**.
  **They are named in no instruction document, no map, and no linter.**

### Already-filed check (so this run does not re-file)

- **[MEASURED]** `needs-marco/` census: **53** files. Pattern sweep over them plus
  `ESCALATIONS.yaml`: `worktree` → 8 files, `orphan` → 3, `stash` → 9, `escapee` → 1,
  **`staleprobe` → 0**. NEGATIVE control `zqx7needle20261009` → **0**.
- **[MEASURED]** The live overlapping escalations, read directly:
  `needs-marco/CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md` (supersedes three
  earlier filings; its own history carries 04's instruction *"consolidate those three into one
  escalation and put a single question to Marco. A fourth filing is the failure mode, not the
  remedy"*) and
  `needs-marco/status-sweep-prune-warning-ignores-unpushed-commits-2026-09-17.md`.

---

## WHAT CHANGED

**Nothing on the board.** No prompt armed, disarmed, renamed, moved or deleted. No PR created,
merged, labelled or commented. No `/sot/` edit. No branch, ref, worktree or stash removed. No
`git` run through the device bridge. No Azure / Entra / SharePoint contact of any kind.

Two writes, both outside the board:

1. **This breadcrumb**, created at
   `docs/pr-prompts/00-04-scanner-2026-10-09-0610-repo-hygiene-twenty-four-of-fifty-seven-remote-refs-belong-to-no-remote-and-a-seventh-instruction-layer-is-unmapped.md`
   in the dev tree. **It is UNTRACKED** — Station 04 may not create a PR, so it stays untracked
   until Station 00 sweeps it. Read back: file exists, 5 required sections present.
2. **`docs/pipeline/sweep-rotation.json`**, advanced — see below. **Left deliberately DIRTY in the
   dev tree. Station 00 must commit it, because I may not.**

Scratch `.ps1` probes were written to `C:\po-sup-fix-scripts\` (`04-hygiene{,2,3,4,5,6}-2026-10-09.ps1`).
That folder is outside the repo and is the sanctioned scratch location.

**Rotation advance — [MEASURED]:**
`node scripts/pipeline/next-sweep.mjs --advance --utc 2026-10-09T06:09:53Z`, read back below.

---

## FINDINGS

### F1 — 24 of 57 remote-tracking refs belong to namespaces with no configured remote, and they contaminate every branch census this pipeline runs

**[MEASURED]** `git remote` → `origin` only. `git for-each-ref refs/remotes` → 57 refs in four
namespaces: `origin` 33, **`pr` 14, `staleprobe` 9, `pr1273` 1 — 24 refs owned by nothing**.
`git config --get remote.staleprobe.url` exit 1 against positive control
`remote.origin.url` exit 0.

**Why it is a defect and not just clutter.** `git branch -r` returns all 57, so any census built on
`branch -r` or `refs/remotes` over-reports live remote branches by **73%** (57 against 33). Worse,
`git branch -r --merged origin/main` returned three lines and one was **`staleprobe/main`** — a ref
no remote owns, offered as a merged remote branch. The standing escalation
`CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md` asks Marco a question **about exactly
this corpus**, so its numbers are measured over a set that is 42% phantom. This is a §9.6 shape:
the instrument is pointed at the wrong corpus and nothing is empty, so nothing warns.

`staleprobe` and `pr1273` are self-evidently leftovers of instrument probes — the sort of debris
this sweep exists to find. **0 hits for `staleprobe` across all 53 `needs-marco/` files and
`ESCALATIONS.yaml`** (negative control 0), so this has never been filed.

**I repaired nothing.** Deleting a remote-tracking ref whose remote no longer exists is not
recoverable by `git fetch` — there is no remote to fetch from — so it is irreversible, which is
DOCTRINE §5.4 and Marco's. And a fourth filing on stale-branch hygiene is the named failure mode.

**DISPOSITION: DISPATCHED** — to Station 00, with one instruction: **do not open a new escalation.**
Fold these three readings into the existing
`needs-marco/CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md` as a measured addendum, and
re-state its question over the **33** `origin` refs rather than the 57 `branch -r` reports, because
the answer may change once the corpus is honest. The `git remote prune` / ref-deletion decision
itself stays Marco's.

### F2 — A seventh instruction layer (Codex) has sat in the dev tree for 17 days, untracked, in no map and in no linter

**[MEASURED]** Root `AGENTS.md` (1974 bytes, mtimeUtc 2026-09-27T22:41:09) and `.codex/agents/`
(9 agent definitions, 57,735 bytes) are both **untracked** (`ls-files` exit 1) and **not gitignored**
(`check-ignore` exit 1). `AGENTS.md` self-describes as *"ProjectOperations — Codex bootstrap … Codex
requires `AGENTS.md` at the repo root"* — it is the Codex twin of `CLAUDE.md`, and `.codex/agents/*.toml`
mirrors `.claude/agents/*.md` station for station, including `pr-tester` and `pr-fix-reviewer`.

**`STATION-CAPABILITIES.md` §1 lists FIVE layers and this is not one of them.** §1's own thesis is
the cost: *"A layer that is not in the map does not get swept"* — written after PR #1465 put 203
CP1252-damaged sequences into `.claude/agents/` precisely because the sweeps were pointed only at
`sot/` and `docs/pipeline/`. The remedy then was to add `.claude/agents/*.md` to `lint-station.mjs`.
**[MEASURED]** that linter's corpus is still exactly `const AGENT_DIR_REL = '.claude/agents';`
(L390) — `.codex/agents` and `AGENTS.md` appear nowhere in it. So the identical gap is open one
directory across.

**I checked for the damage and it is NOT there, and I am reporting the negative as loudly as I
would report the defect.** Read as bytes with `node` (DOCTRINE §9.3 — `Get-Content` reports false
mojibake, and it did: the console rendered `AGENTS.md`'s em-dash as `—` and its `⚖️` as mojibake,
which I nearly wrote up as damage): all 9 `.toml` and `AGENTS.md` scored `U+FFFD=0 cp1252sig=0`,
against a synthetic positive control scoring 1. **This is a MAP gap, not a damage incident.**

**[MEASURED]** `git grep` over `docs sot scripts .github`: the only 12 mentions of each are inside
archived Station 00 breadcrumbs **all dated 2026-09-22**, which say
`[INFERRED] '.codex/' and 'AGENTS.md' are untracked artefacts of a lane that is not the watcher`
and `They belong to a lane I did not identify`. Four consecutive 00 runs that day observed them,
correctly declined to touch them, and **none closed the loop**. 17 days later they are still
unidentified and still unmapped.

**DISPOSITION: DISPATCHED** — to Station 00, which owns the `docs/` lane that
`STATION-CAPABILITIES.md` lives in. Two separable pieces, and the first is cheap and complete:
**(a)** add the Codex layer as a row in §1's five-layer table with its `Governs a scheduled run?`
answer, per §1's own *"when a layer is added, add it here first"*; **(b)** the question of whether
`.codex/agents/*.toml` should join `lint-station.mjs`'s encoding sweep and whether either path
should be tracked or gitignored is a design question about a lane nobody here has identified —
**that half is Marco's**, and whoever files it should ask *who runs Codex against this repo*, since
the answer decides (b) entirely. Do not guess it.

### F3 — 31 of 32 non-main worktrees are orphaned and hold ~130 commits that exist nowhere else; `git worktree prune` is structurally blind to all of them

**[MEASURED]** `status-sweep.ps1` at 06:13:58Z: `non-main worktrees found: 32`, **31** classified
`orphaned worktree (aborted run leftover -- investigate/prune)`, 1 live (`rel-2261`, age 3 min).
Summed from the sweep's own lines: **~130 commits across 27 worktrees on no remote branch**, oldest
`C:/po-wt/fv2drop` at 21454 min (≈15 days) holding **21**. Two hold uncommitted work
(`sup-cwd-paths` 2 files, `PR-Master/worktrees/sweep-dirty-untracked-v1` 1 file). Plus **2
registry escapees** (`PR-Master\worktrees\bootstrap-check`, `po-wt\dispatch-register-v1`), both
0KB, both ~9000 min old, neither locked.

**The instrument point worth keeping:** `git worktree prune --dry-run -v` → **EMPTY**. Git's own
prune test asks only whether the registered directory still exists, and all 32 do. **A reader who
runs `prune --dry-run`, sees nothing, and concludes the worktrees are healthy gets a confident
wrong answer** — the orphans are orphaned by liveness, which only `status-sweep.ps1` measures.

**Already-filed, and I am not re-filing:** the *semantics* half is live with Marco as
`needs-marco/status-sweep-prune-warning-ignores-unpushed-commits-2026-09-17.md` (the warning counts
dirty files and ignores unpushed commits, so a `dirty=0` orphan reads "safe to prune"), and 3
`needs-marco/` files already match `orphan`, 8 match `worktree`. What is **new** here is only the
current census, which is state and belongs in a breadcrumb, not in another escalation.

**DISPOSITION: DISPATCHED** — to Station 00 for routing to **Station 03**, which the sweep itself
names (`worktree-registry-escapees: 2 found -- Station 03 should review and prune if confirmed
dead`) and which is the only station with a repair lane. Two hard constraints to carry with it, both
RULE 1: **the complete-and-additive move is to PUSH or otherwise preserve the ~130 commits and the
two dirty worktrees BEFORE any removal** — that solves it now and keeps every future recovery
possible; a `git worktree remove --force` sweep would be faster and **fails the
no-data-loss half outright**, discarding work that exists in exactly one place on one disk. And the
removal itself is irreversible, so it is Marco's call, not 03's, until the preservation step is done
and read back.

### F4 — 25 published review verdicts sit untracked in the dev tree, pre-loading the fast-forward blocker that already fired once on eighteen of them

**[MEASURED]** `git status --porcelain` → 27 untracked entries, **25** of them
`docs/pr-reviews/pr-<N>-review.md` for #2183–#2276. `docs/pr-reviews/` holds **185** tracked files
on `origin/main`. **Collision check: none of the 25 paths exists on `origin/main` today**, and all
four fast-forward readings are currently clean (`left-right 0 0`, `--numstat` EMPTY, `--cached`
EMPTY, and `--porcelain` tracked-clean).

So this is **not** a live blocker — and saying so matters, because the first three of those four
readings pass on a dirty tree and only the fourth catches it. It is a *loaded* one: the station
contract's mechanism is that the moment a PR lands one of these exact paths on `main`, the untracked
file blocks `git merge --ff-only` while `--numstat` and `--cached` both still read EMPTY, the
documented PASS reading. Archive breadcrumb `00-00-supervisor-2026-09-22-0930-...` records this
having already fired on eighteen review verdicts.

**DISPOSITION: DEFERRED** — real, not now. What would make it urgent: any PR that adds a file under
`docs/pr-reviews/` matching one of the 25 names, or a fast-forward refusal in the dev tree whose
`--numstat` reads EMPTY. The named cure is in the station contract (restore the blocking path
byte-exactly from `HEAD` with a raw-Buffer node write, never `git checkout -- <path>`, never
`git clean`).

### F5 — the watcher clone holds 86 stashes spanning 87 days, and the loop that creates them has no exit

**[MEASURED]** 86 entries; newest `2026-10-04 16:57:12 +1000` `watcher-preflight-autostash on 'main'`,
oldest `2026-07-14 08:44:31 +1000` `WIP on feat/sharepoint-folder-mappings`. Dev tree, for contrast:
**1**. Clone `tracked-dirty=0 untracked=3`.

This is DOCTRINE §9.2's documented closed loop — *"`git stash` in the watcher clone is a CLOSED
LOOP — the launcher stashes on every start and never pops"* — so the **mechanism** is known doctrine
and needs no finding. What this run adds is the **magnitude**, which is state: at 86 entries the
clone is carrying 87 days of silently-abandoned working states, and the oldest three are not
autostashes at all but hand-made WIP from July (`pre-tenant-readiness: sot/04 + docs/pr-reviews (not
mine)`), which means real work is buried under the machine-generated layer.

No harm is accruing today — the clone is tracked-clean and the watcher ignores the stashes. The cost
is recoverability: nobody is going to read 86 stashes, so anything genuinely wanted in there is
effectively lost already.

**DISPOSITION: DEFERRED** — real, not now, and deliberately not escalated: `stash drop` is
irreversible and there is no evidence anyone needs these, which is a question for a quiet board
rather than an interrupt. What would make it urgent: the launcher failing to stash (which would make
the clone dirty and block its own update), or a station needing to recover a specific pre-July-14
working state. If Station 00 judges the July WIP entries worth preserving, the additive move is to
export them as patches before anything is dropped — not to drop and hope.

### F6 — three of my own instruments lied inside this run; all three were caught by a control, and the one I nearly published was a §9.3 textbook case

Recording these because §7 says the broken measurement of a working system is the worst failure
here, and a run that only reports other people's instrument lies is not calibrating its own.

1. **`Get-Content` on `AGENTS.md` showed textbook CP1252 double-encode mojibake.** I had an
   S2-shaped finding half-written — *"a sixth instruction layer is byte-damaged exactly like
   PR #1465"*. Read as bytes with `node`: `U+FFFD=0 cp1252sig=0`, clean, against a synthetic
   positive control scoring 1. **DOCTRINE §9.3 names this exact lie and I still walked into it.**
   The surviving finding (F2) is a map gap, which is a far smaller claim than the one the broken
   instrument offered — the lie was in the direction of a *more* alarming result, which is the
   direction that gets acted on.
2. **A direct pipe of `git ls-tree` into `Select-String` appeared to return empty** for HOLD files
   tracked on main, while the same data assigned to a variable first returned **353**. The output
   had in fact arrived **out of order in the stream** and printed under the *following* section's
   header — DOCTRINE §9.1's *"streamed output can return EARLY with output still pending"*. Had I
   read the section headers at face value I would have reported "0 HOLD files tracked on main",
   which is false and would have made every HOLD look untracked. Cured by assign-then-filter and by
   re-reading with explicit offsets until `0 remaining`.
3. **My own orphan-directory probe under-counted the registry escapees 1 against 2**, because I
   enumerated `C:\po-wt`, `C:\po-worktrees` and `C:\po-watcher-worktrees` and never thought of
   `C:\PR-Master\worktrees`. `status-sweep.ps1` found both. A hand-rolled census whose corpus I
   chose from memory lost to the maintained instrument — §1's *"do not hand-roll board operations"*
   generalises to probes, and §9.6's *"an empty result is not an empty world"* was the shape:
   my list was complete over the wrong set.

**DISPOSITION: ACTIONED** — all three corrected within this run before anything was reported;
the corrected values are the ones in WHAT I MEASURED above, and the discarded claim is named here
rather than quietly dropped. Verified by the controls quoted: `node` byte read with a synthetic
positive control, assign-then-filter against 1485/353/175 with a minted-needle negative at 0, and
the sweep's two escapees against my one.

---

## WHAT I DID NOT DO

- **Mutated nothing on the board.** Armed, disarmed, renamed, moved or deleted **no** prompt;
  created, merged, labelled or commented on **no** PR. Station 04 is read-only on the board
  (`STATION-CAPABILITIES.md` §5: *Create a PR: NO*, *Mutate the board: NO, read-only*), and a
  station-00 lease was live on the board until 06:43:05Z with a watcher build in flight the whole
  time I ran.
- **Staged no prompt, not even the `-HOLD` my authority allows.** Every one of F1–F5 lands on an
  irreversible action (ref deletion, worktree removal, `stash drop`) or on a design question about
  an unidentified lane. Per the `gate-liveness` brief's own warning and RULE 1, a prompt that
  repairs the *symptom* ahead of Marco's decision on the *irreversible* half would remove a
  protection rather than add one. F2(a) is the one piece that is purely additive docs — and it is
  Station 00's `docs/` lane, not mine to stage into a PR I cannot open.
- **Did not prune, remove or force-remove any worktree**, did not `git remote prune`, did not delete
  any ref or branch, did not `stash drop`. All irreversible, all Marco's (DOCTRINE §5.4).
- **Did not clear any lock.** There were none to clear; had there been, that is Station 03's on
  00's dispatch.
- **Did not touch `/sot/`** — Station 05's exclusively. The live `docs/sot-reconcile-2026-10-09`
  branch and `C:/po-worktrees/st05-sot-2026-10-09` worktree (age 449 min) are 05's work and I left
  them alone, including in F3's census, where it is listed as an orphan by the sweep but is
  plausibly a live 05 artefact — **I flagged it rather than classifying it, because that call is
  05's.**
- **Did not run `git` through the device bridge**, in either tree, at any point — the guard reported
  itself INERT (exit 2) and an inert guard is not a licence (station contract, PREFLIGHT step 1).
  Every `git` went through `powershell.exe` on the host.
- **Did not touch `.codex/`, `AGENTS.md`, or any untracked file in the dev tree** — not to stage,
  move, delete or gitignore them. F2 is a report.
- **No Azure / Entra / SharePoint contact of any kind.** No portal, no App Service settings, no
  Entra registration/secret/permission/consent, no SharePoint anything, no `az`, no
  `Connect-MgGraph`. Absolute, and not approached.
- **Ran only the one assigned sweep.** `instrument-honesty`, `gate-liveness` and `instruction-drift`
  were **not** run — not out of budget, but because the station doc requires one named sweep covered
  completely and forbids choosing. F6 touches instrument honesty only incidentally, about my own
  probes, and must not be read as coverage of that sweep.
- **Did not commit the rotation advance.** `docs/pipeline/sweep-rotation.json` is left modified and
  uncommitted in the dev tree by instruction: Station 04 may not commit, and the dev tree is on
  `main`, which nobody commits to directly. **If Station 00 does not commit it, the next run repeats
  `repo-hygiene` and the rotation silently stops** — this has already happened twice (04's F6,
  2026-09-02) and again on 2026-10-09 per `#2272`.
- **Did not write to any gitignored sink.** Nothing of this run went to `docs/qa/qa-findings.md`,
  `qa-checklist.md`, `qa-test-data-registry.md`, `.qa-run.lock` or `qa-run-*.md` (the five files
  under the `# Overnight-QA scheduled task` comment in `.gitignore`), nor to the Cowork session's
  `outputs` folder, nor to a disposable worktree. This breadcrumb is in the dev tree at a tracked
  path, untracked until swept.

---

## FOR STATION 00

Three dispatches, in the order they cost least:

1. **F2(a)** — add the Codex layer row to `STATION-CAPABILITIES.md` §1. Pure docs, your lane,
   complete and additive, no question attached. The `.codex/agents` linter corpus question and the
   track-or-ignore question are **Marco's**, and the thing to ask him is *who runs Codex against
   this repo* — that single answer settles both.
2. **F1** — fold the three ref readings into
   `needs-marco/CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md` and restate its question
   over the 33 real `origin` refs. **Do not open a fourth filing** — that file's own history forbids
   it in those words.
3. **F3** — route to Station 03 for *preservation first*, removal never without Marco. ~130 commits
   and two dirty worktrees must be pushed or patched out before anything is pruned.

**And commit `docs/pipeline/sweep-rotation.json`** — it is dirty in the dev tree and I am forbidden
to commit it. Next sweep is `instruction-drift` only if that advance lands.

---

## ADDENDUM — closing readings, and two tracked changes in the dev tree that are NOT mine

Written at 06:20:40Z, after the rotation advance and the breadcrumb validation.

**[MEASURED] Breadcrumb validated by its one validator:**
`node scripts/pipeline/check-breadcrumb.mjs` → `CLEAN`, **exit 0**,
`structure: 2 checked, 0 malformed, 0 skipped as pre-contract`. It emitted the expected
`NOTE ... is UNTRACKED — it reaches nobody until a board PR commits it`, then `ADMIT`.
`ls-files --error-unmatch` on it → exit 1, confirming untracked. 29,404 bytes, six `##` sections,
dispositions ACTIONED 1 / DISPATCHED 3 / DEFERRED 2 / ESCALATED 0.
(Per the station contract I did **not** run `lint-prompt.mjs` on this file — a `lint-prompt` result
on a breadcrumb is not evidence in either direction.)

**[MEASURED] Rotation advanced:**
`node scripts/pipeline/next-sweep.mjs --advance --utc 2026-10-09T06:09:53Z` → exit 0,
`advanced: last_index=2 last_run_utc=2026-10-09T06:09:53Z`. Read back from the file:
`last_index=2  last_run_utc=2026-10-09T06:09:53Z  last_station=04-scanner`, **next sweep key =
`instruction-drift`**. The script printed its own instruction, which matches mine:
`LEFT DIRTY: name this file in your breadcrumb. Station 00 commits it`.

**🔴 The closing `git status --porcelain --untracked-files=no` shows THREE tracked changes, and only
the first is mine:**

```
 M docs/pipeline/sweep-rotation.json                        <- MINE (the advance)
 M docs/pr-prompts/.arming-log.txt                          <- NOT MINE
 D docs/pr-prompts/pr-sweep-quote-the-heartbeat-alarm-HOLD.md   <- NOT MINE
```

**[INFERRED, and the inference is well-grounded]** those two are station-00's arm of
`pr-sweep-quote-the-heartbeat-alarm`, landing in the shared dev tree *while this run was in
progress*: the sweep at 06:13:58Z recorded `board lease: station-00.interactive
reason=arm:pr-sweep-quote-the-heartbeat-alarm`, and an arm is exactly a HOLD-file deletion plus an
`.arming-log.txt` append. My own opening reading at 06:09:53Z had `DIRTY_COUNT=31` with
`--numstat` EMPTY; by 06:20:40Z `--numstat` carries all three paths. **I deleted no prompt and wrote
no arming log.**

This is DOCTRINE §9.2's *"the dev tree's index is SHARED between concurrent chats"* observed live,
and it is why the contract's pathspec-commit rule exists. **[MEASURED]** my
`git diff --cached --name-status` was **EMPTY** throughout, so nothing of mine is staged and nothing
of 00's rode into a commit of mine — I made no commit at all.

**🔧 Station 00: when you commit my rotation advance, use a pathspec commit naming
`docs/pipeline/sweep-rotation.json` ALONE.** A bare `git commit -a` here would sweep your own
in-flight arm into the board PR that is supposed to carry only my breadcrumb and the advance.

**Fast-forward precondition, all four readings at 06:20:40Z:** `rev-list --left-right --count
HEAD...origin/main` → `0 0`; `--numstat` → the three paths above; `--cached` → EMPTY;
`--porcelain` tracked → the three paths above. So the dev tree is **level with `origin/main` but
dirty**, and the dirt is one file of mine plus a live arm that is not mine. F4's 25 untracked review
verdicts are unchanged and still collide with nothing on `main`.

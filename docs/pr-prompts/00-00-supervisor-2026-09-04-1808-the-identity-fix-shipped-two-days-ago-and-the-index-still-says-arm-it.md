# Station 00 — Supervisor | 2026-09-04T18:08Z–2026-09-04T18:4xZ

## GROUND

```
UTC            2026-09-04T18:08:34Z
origin/main    95a47ceb            (fetched, then rev-parse)
dev tree       main @ 95a47ceb     C:\ProjectOperations2   (rev-list --left-right --count HEAD...origin/main = 0 0)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task SKILL.md)
```

Versions AGREE — this run was NOT read-only. All three binding documents were read in the DEV TREE
and proved current: `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md` returned **EMPTY**
(no piped hash was used — PREFLIGHT step 2).

## WHAT I MEASURED

- **[MEASURED] Not blind.** `start_process` shell `powershell.exe` after a keyword `ToolSearch` for
  `desktop-commander`; PID 15928 returned a prompt. Every reading below is from that shell.
- **[MEASURED] Dev tree clean of modifications.** `git status --porcelain` = 22 lines, **all `??`**;
  `git diff --cached --name-status` returned **EMPTY** (the authoritative staged-set probe — the
  `.trim()`-manufactures-a-false-staged-reading trap does not apply to this form). No untracked
  breadcrumb in `docs/pr-prompts/` — both prior breadcrumbs are tracked, so the fast-forward blocker
  recorded at 14:1xZ did not recur.
- **[MEASURED] Sweep run TWICE.** `scripts/pipeline/status-sweep.ps1` at 18:09:08Z printed
  §7 `DO NOT ACT: a board mutation is in progress`. Re-run at 18:10:02Z, §3 read
  `in-progress prompts: 0` · `index.lock interactive/clone: False / False` · `git processes
  running: 0` · `no PR touched on GitHub in the last 2 min`, and §7 printed
  `CAUTION: 1 LIVE STATION WORKTREE(s)`. **The first verdict was the sweep tripping over its own
  git subprocess** — the trap this station recorded at 17:2xZ, reproduced again. The `CAUTION` is
  `C:/po-vg` (dirty=1, age 616 min), already measured NOT live and already dispatched to 03.
- **[MEASURED] Board — 3 open PRs, all CLEAN, all green (14 pass / 0 fail / 0 pending each):**
  `#1594` `feat/pipeline-heartbeat` (created 12:27:33Z) · `#1593` `feat/arm-attribution`
  (12:24:54Z) · `#1589` `fix/lint-gate-path-space` (11:37:41Z). No labels on any of the three.
  `main` CI on `95a47ceb`: 4 success / 0 failed / 0 running — **trunk green**.
- **[MEASURED] RULE 2, re-measured live, not inherited.** Probe pinned to the LIVE tree
  `C:\ProjectOperations2\docs\pr-prompts\processed` (never the clone): **1901** logs, newest
  **2026-09-04T17:21Z** — younger than all three open PRs, which is the control that separates the
  live directory from the 17-day-stale decoy. POS `marco.:true` = **609**, NEG `zzzNoSuchZzz` = **0**.
  - `#1589` → `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/lint-prompt.mjs"}`
    — **watcher-routed. RULE 2 BINDS.**
  - `#1594`, `#1593` → **`NO LOG`.** Per DOCTRINE §9.5 a `NO LOG` obliges asking *which* absence:
    no prompt in `processed/` names `arm-attribution`, `pipeline-heartbeat`,
    `check-pipeline-heartbeat` or the PR titles (4 needles, 0 hits), and `.arming-log.txt` records
    **no arm after `2026-09-04T11:29:24Z`** — 55 minutes before either PR was opened. **These are
    SECOND-LANE PRs (§10), not crashed watcher runs.**
  - Hand-classified under §10.1 step 2: `#1594` touches `.github/workflows/`, `scripts/pipeline/`;
    `#1593` touches `scripts/pipeline/` incl. `hooks/pre-commit`; `#1589` touches
    `scripts/pipeline/`. All outside `^(tests|docs)/`, and **no station lane in
    STATION-CAPABILITIES §5 covers `scripts/`**. `[NO LANE VERDICT — hand-classified] → MARCO'S.`
- **[MEASURED] Queue.** `armed (*-ready.md): 0` · 97 `-HOLD.md` at depth 1 · needs-marco 16 ·
  no-pr-opened 109 · failed 41 · blocked 117. All 97 HOLDs carry the same `09-04 12:36` mtime — a
  checkout artefact, not authorship or arming (§9.5).
- **[MEASURED] Machinery.** watcher node RUNNING pid **20000**, auto-restart wrapper alive (1),
  heartbeat age 49 min against an EMPTY queue = idle, not wedged. Watcher clone `branch=main
  dirty=2` — no `MERGE_HEAD`, no rebase, no unmerged paths, so NOT corrupt.
- **[MEASURED] Freshness, crossed against `lastRunAt` (both instruments, per contract).**
  `check-breadcrumb.mjs --freshness` exit **0 CLEAN**: 00 1.1h · 03 19.2h · 04 4.0h · 05 4.0h, none
  SILENT. MCP `lastRunAt`: 00 `18:07:55Z` (this run) · 03 `2026-09-03T23:01:39Z` (breadcrumb 23:02Z,
  aligned) · 04 `2026-09-04T18:09:34Z` · 05 `2026-09-04T14:10:38Z` (breadcrumb 14:11Z, aligned).
  🔴 **04 fired 99 seconds after this run started and was live for the whole run.** Its 18:09
  breadcrumb does not exist yet; that is mid-run, not silence. 04 is read-only, but the dev-tree git
  index is shared, so this run committed with an explicit pathspec.
- **[MEASURED] The `.arming-log.txt` falsifying probe re-run, as §9.5 requires before quoting either
  half:** `origin/main` **50** lines, working copy **50** lines — **still agreed**; positive control
  `git ls-files --error-unmatch` on the log → exit 0. The gap stays closed. Nothing was armed this
  run, so nothing new needed publishing.

## WHAT CHANGED

- This breadcrumb, written **inside this run's own PR worktree** (`C:\po-collect-1808`, off
  `origin/main` at `95a47ceb`) — cure #1 for the untracked-breadcrumb fast-forward blocker. No loose
  copy exists in the dev tree.
- `docs/pr-prompts/00-00-supervisor-2026-09-04-1608-*.md` archived to `docs/pr-prompts/archive/`
  (every finding in it carries a disposition). Freshness is unaffected — `check-breadcrumb.mjs`
  matches by trailing path segment over `git ls-tree -r` (DOCTRINE §9.5).
- The project-memory index entry that carries the dead instruction below was corrected.
- **No prompt was armed. No PR was merged. No label was touched.**

## FINDINGS

### F1 — 🔴 THE MEMORY INDEX ORDERS THIS STATION TO ARM A PROMPT THAT SHIPPED TWO DAYS AGO

The project-memory index's SECOND LANES block reads, verbatim:

> ROOT-CAUSE fix BUILT and waiting — Part 2 STAGED, gate OPEN:
> `pr-watcher-identity-app-auth-HOLD.md`, `PROMOTE`+`GATE_RELEASED`, size 7. **STATION 00 ARMS IT.**

**[MEASURED] Every clause of that is false, and has been since 2026-09-02.**

- `node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-watcher-identity-app-auth-HOLD.md`
  → `MISSING`, exit 1.
- The prompt was **consumed**: `processed/pr-watcher-identity-app-auth-ready.md` (09-02 02:19) and
  its `.log` (09-02 03:31). The HOLD was moved to
  `superseded/cleared-2026-09-02-shipped-direct/` at 09-02 04:51.
- The log says `Shipped. **PR #1510**`, and
  `[watcher] merge result for PR #1510: {"ok":false,"marco":true,"reason":"escalates:true - held for
  Marco, labelled do-not-merge"}`.
- `gh pr view 1510` → `state MERGED`, `mergedAt 2026-09-02T04:44:40Z`, labels `[]`.

So the work is **on `main`**, Marco cleared it himself, and the index has spent roughly forty hourly
00 runs telling each of them to arm a file that no longer exists. This run followed the instruction
and burned a probe discovering it — which is exactly the lesson already recorded elsewhere in the
index: *a disposition addressed to a FUTURE RUN outlives its own fix and bills a later run to
re-discover it.* The instruction survived because it named no falsifying probe.

**DISPOSITION: ACTIONED.** The index line is corrected to point at F2, and the falsifying probe is
written into the replacement so it cannot outlive its truth the same way. Verified by re-reading the
memory file after the write.

### F2 — 🔴 THE IDENTITY FIX IS HALF-LANDED: THE CODE IS ON MAIN, THE CONFIGURATION WAS NEVER APPLIED

F1 retargets the escalation rather than closing it, and the retarget is the point.

**[MEASURED]** `scripts/pr-watcher/app-auth.mjs` is on `main` and reads
`env.PO_WATCHER_APP_ID` and `env.PO_WATCHER_INSTALLATION_ID`, throwing
`PO_WATCHER_APP_ID is not set` when absent. **Nothing sets them.** A `Select-String` for
`PO_WATCHER_APP_ID|PO_WATCHER_INSTALLATION_ID|PO_WATCHER_PRIVATE_KEY` across
`C:\po-watcher\*.ps1` and `scripts/pr-watcher/start-watcher.ps1` returned **zero hits**, and both
`[Environment]::GetEnvironmentVariable('PO_WATCHER_APP_ID','Machine')` and `…,'User'` returned
**empty**. The live watcher (pid 20000, cmdline
`node --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs`) is therefore
**still authenticating as `GH-Mantova`** — Marco's user token — exactly as before #1510.

That is why the "who merged as `GH-Mantova`" thread has not closed despite the fix being merged:
**the missing piece was never a prompt an agent could arm. It is three configuration values.** The
runbook is already written and tracked on `main` at `docs/runbooks/watcher-identity-github-app.md`
(7578 bytes) — note its step-5 command is JWT-only and can never work with a user token.

Everything an agent may do here is done. App id, installation id and a private-key path are
**production auth configuration** — DOCTRINE §5 hard stop 4 and 00's LIMITS item 4. Marco sets them;
no station may.

**DISPOSITION: ESCALATED.** Not a new escalation — it is the standing identity/second-lane thread,
re-aimed from *"00 arms a prompt"* to *"Marco applies three values"*. The one-line ask, and the
falsifying probe that kills this finding when it is done:

```
[Environment]::GetEnvironmentVariable('PO_WATCHER_APP_ID','Machine')   # non-empty ⇒ F2 is dead
```

### F3 — the board is three PRs, all Marco's, all green, and arming more makes it longer

**[MEASURED]** `#1594`, `#1593`, `#1589` are CLEAN, 14/14 green, unlabelled, and all three classify
to Marco (F2's measurement block above: one watcher `marco:true`, two hand-classified second-lane).
`armed = 0`. All 97 depth-1 HOLDs are feature/UI/pipeline slices touching `apps/**` or
`scripts/**` — every one of them would open a PR that stops at Marco on arrival.

This is the throughput constraint stated exactly, and it is not a stall to be fixed by arming:
**00 can arm, the watcher can build, CI can green — and every PR outside `tests/` or `docs/` then
waits for a human. Arming faster makes the queue longer, not shorter.** `armed = 0` against a
green trunk and an idle watcher is the CORRECT state here, not a wedged one.

**DISPOSITION: DEFERRED.** What would make it urgent: Marco merging or closing the three, at which
point a docs- or tests-only HOLD should be armed first — those clear the `tests-docs` lane without
consuming him.

### F4 — the sweep's §7 verdict flipped between two runs 54 seconds apart

**[MEASURED]** 18:09:08Z → `DO NOT ACT: a board mutation is in progress`. 18:10:02Z → `CAUTION`,
with §3 showing `git processes running: 0` and both `index.lock` False. Nothing merged, nothing was
armed and no PR was touched in between; the first reading was the sweep's own `git` subprocess seen
by its own probe.

This station recorded the same flip at 17:2xZ. Two occurrences in an hour makes it a property of
the instrument, not a coincidence: **a lone `1` in §3's git-process count with clean locks is not
evidence of a second actor.** The cure that works is the one used here — wait, re-run, cross-check
§3's four signals — and it costs a full sweep every time.

**DISPOSITION: DISPATCHED → 04 (scanner).** 04 owns "instruments that lie" and was live during this
run. The question for it: can `status-sweep.ps1` exclude its own process tree from the §3 git-process
count (its own PID's descendants are knowable), or must the double-run stay the cure? Not actioned
here because it edits `scripts/`, which is outside 00's lane and would open a fourth Marco-gated PR
for a defect whose workaround is one re-run.

## WHAT I DID NOT DO

- **Did not arm anything.** F3 gives the measured reason. RULE 4's detector was not run because no
  arm was contemplated, not because it was skipped.
- **Did not merge, approve or label any of `#1594` / `#1593` / `#1589`.** All three are Marco's.
  RULE 2 binds `#1589` by a live watcher verdict; the other two by hand-classification. The
  agent-authored blanket clearance merged in `#1596` is **not honoured** — an agent may not author a
  RULE 2 clearance.
- **Did not touch `C:/po-vg`**, the two registry escapees (`C:\po-worktrees\fix-1523`,
  `vs-s2-durable-smoke`) or the four other non-main worktrees. Worktree pruning is 03's, already
  dispatched, and the sweep's own liveness classifier is under a deferred RULE 1 decision.
- **Did not discharge the six escalations §5 tags `[STALE]`.** That tag is about **PR references**
  going stale, not about the finding. `#22`, `#23` and `#24` are live.
- **Did not clear the watcher clone's `dirty=2` or its stash pile.** 03's lane; no `MERGE_HEAD`, no
  rebase, no unmerged paths, so it is not corrupt and the watcher is running fine on it.
- **Did not set `PO_WATCHER_APP_ID` or any other auth value.** F2 — hard stop, Marco's.

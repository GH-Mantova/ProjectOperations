# Station 04 — Scanner | 2026-09-16T10:11:04Z–2026-09-16T10:26Z

## GROUND

```
UTC            2026-09-16T10:11:04Z
origin/main    bdc5d05b            (remote-tracking ref READ FROM FILE — no fetch, see caveat)
dev tree       main @ bdc5d05b     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter — WORKING COPY)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **AGREE**. But see the caveat below — this run is READ-ONLY regardless,
because it is **BLIND**.

### 🔴 BLIND RUN — no Windows shell. Step 1 of the station contract fired STOP.

**I could not reach the box.** Desktop Commander did not connect this run:
`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server ... connection timed out
after 30000ms"`. No `start_process` tool exists in this session.

**This was not a cold-call validation error.** The contract's own §1 warning was obeyed to the letter:
three `ToolSearch` loads were run *before* concluding anything — `desktop-commander` (keyword, the
form the contract prescribes), then `start_process powershell shell windows host interact_with_process`,
then a third after the server moved from *connecting* to *failed*. The first returned "Some MCP servers
are still connecting… try searching again"; the last returned Microsoft-Learn and Chrome tools and **no
shell tool of any kind**. The server then reported `CONNECT_TIMEOUT` explicitly. That is **absence after
an honest load**, which the contract defines as blindness — not an unloaded schema.

**A blind run and a healthy quiet run both produce "no news." This was the blind one.**

What that costs, named, so nobody reads this as coverage:

- **No `git` at all.** The dev-tree `git` is reachable only through the Windows shell, and the
  device-bridge guard (correctly) refuses `git` against the mount. So: **no `git fetch`**, no
  `git rev-parse origin/main`, no `git diff --numstat`, no `git show origin/main:<path>`.
- **Therefore the GROUND SHAs are file reads, not `rev-parse`.** `.git/HEAD` → `refs/heads/main`;
  `.git/refs/heads/main` and `.git/refs/remotes/origin/main` both → `bdc5d05b53…`. The remote-tracking
  ref is **whatever the last fetch left**, not a fresh fetch. It is fresh in fact — `.git/FETCH_HEAD`
  mtime `2026-09-16T09:47:41Z`, 23 min before this run, and the reflog's last entry is a fast-forward
  to that same SHA — but **"last fetched 23 minutes ago" is not "fetched now."**
- **The three binding documents were read from the WORKING COPY**, which the contract forbids
  (`git show origin/main:<path>` is the required form). I cannot prove my own instructions are current.
  `station_doc_version` matching is explicitly **not** a freshness proof. Treat every reading below as
  taken against possibly-superseded instructions.
- **`scripts/pipeline/status-sweep.ps1` never ran** — it is PowerShell. **No board verdict exists for
  this run.** Nothing here is a merge/arm clearance.
- **`check-breadcrumb.mjs` was NOT run end-to-end on this file.** Its verdict path shells to
  `git ls-tree` / `gh pr list`; under the guard, against the mount, that is refused by design.
  **This breadcrumb is therefore UNVALIDATED — the word `breadcrumb-clean` does not appear in this
  report and must not be inferred.**
  What I *could* run, I ran: the module guards `main()` behind `invokedDirectly`, so importing it
  executes no git. Its **exported pure functions**, applied to this file, returned —
  `NAME_RE.test(filename)` → **PASS** · five `SECTIONS` present and in order → **PASS** ·
  `checkGitignoredSink(text)` → **PASS**, no finding routed into a gitignored path ·
  dispositions present in FINDINGS → `ESCALATED, ESCALATED, DEFERRED`.
  **That is structure only.** The tracked/untracked and open-PR-collision verdicts — the part that
  decides whether this report actually reaches anyone — are exactly the part that needs git, and they
  were **not** obtained. A sighted run should re-validate properly.

**Device-bridge git guard.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` —
last line, quoted verbatim, as the contract requires pass or fail:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`. **PASS**
(exit 0). Installed before any other VM-side call.

**Sweep this run: NONE.** `node scripts/pipeline/next-sweep.mjs` (read-only, no `--advance`; the script
imports no `child_process`, so it is git-free and safe while blind) reports **`SWEEP: gate-liveness`
(rotation position 1 of 4; previous run: 2026-09-15T02:10:31Z)**. It was **not run**: gate-liveness means
executing premises against `origin/main` at a named SHA, which is precisely what a blind run cannot do.
**The rotation was NOT advanced** — advancing it would burn a rotation slot for a sweep that never
happened, which is the same silent-coverage-loss this station exists to prevent. `gate-liveness` is
still owed and remains position 1 for the next run.

**Everything under WHAT I MEASURED was read while establishing ground.** It is not a substitute sweep
and must not be counted as this run's coverage.

---

## WHAT I MEASURED

**[MEASURED] The dev tree is clean of locks and mid-operation state.** File reads only, no git process
(`.git/index.lock` → absent; `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / `rebase-merge` /
`rebase-apply` / `sequencer` → none present). No stale-lock condition to report.

**[MEASURED] `mcp__scheduled-tasks__list_scheduled_tasks`, 10:2xZ — `00-supervisor` is STILL
`enabled: false`,** `lastRunAt 2026-09-15T05:08:34Z` — now **~29 hours** stale against a `5 * * * *`
cadence. POSITIVE control that the field discriminates: `04-scanner`, `05-sot-keeper` and
`03-machine-minder` all read `true` in the same payload, so `false` is a value, not an empty read
(§9.6). This corroborates F1 of the 06:10Z run at +4h; it is **not re-filed** as a new finding here.

**[MEASURED] The `.gitignore:107-111` citation is still wrong, and still live in the bootstrap that
fired THIS run — day twelve.** My own scheduled-task file says *"Never one of the five gitignored sinks
named at `.gitignore:107-111`"*. Resolved by direct file read, `.gitignore:105-111` is the
`Claude Design/` block (`Claude Design/*`, `!Claude Design/README.md`, `!Claude Design/docs/`,
`!Claude Design/assets/`, `Claude Design/assets/*`, `!Claude Design/assets/routes.js`,
`!Claude Design/proposed/`). The five QA sinks are at **`.gitignore:115-119`**
(`docs/qa/qa-checklist.md`, the gitignored `docs/qa/qa-findings.md`, `docs/qa/qa-test-data-registry.md`,
`docs/qa/.qa-run.lock`, `docs/qa/qa-run-*.md`). Already ESCALATED twice (2026-09-06, and F2/F3 of the
06:10Z run) — recorded here only as a **day-twelve datapoint on an open escalation**, deliberately not
re-filed as a fourth finding.

**[MEASURED] The 06:10Z run's rotation advance is gone, and the reflog names what took it.**
`docs/pipeline/sweep-rotation.json` on disk now reads `last_index: 3`,
`last_run_utc: "2026-09-15T02:10:31Z"`. The 06:10Z breadcrumb states it advanced that file to
`last_run_utc=2026-09-16T06:10:45Z` and left it dirty, and it also quotes `next-sweep.mjs` observing
`previous run: 2026-09-16T02:19:05Z` — so the file has regressed **past two** recorded advances
(02:19Z and 06:10Z) to the last *committed* state. Re-read twice; identical both passes.

The mechanism, from `.git/logs/HEAD` (file read, no git process), epochs converted:

```
2026-09-16T06:58:53Z  PR Supervisor <supervisor@local>  checkout: moving from main to main
2026-09-16T06:59:01Z  PR Supervisor <supervisor@local>  reset: moving to HEAD
2026-09-16T06:59:05Z  PR Supervisor <supervisor@local>  checkout: moving from main to feat/crmvis-s4-tenders-register-artboard
2026-09-16T07:02:21Z  PR Supervisor <supervisor@local>  checkout: moving from feat/crmvis-s4-tenders-register-artboard to main
2026-09-16T09:47:42Z  PR Supervisor <supervisor@local>  merge origin/main: Fast-forward   -> bdc5d05b
```

`stat` on the rotation file: **mtime `2026-09-16T06:59:01.727Z`**. The `reset: moving to HEAD` entry is
stamped **`2026-09-16T06:59:01Z`**. **Same second.** That is identification, not correlation.

Timeline, assembled: 06:10:45Z the run starts · 06:18:26Z it writes its breadcrumb (mtime) · ~06:28Z it
advances the rotation and leaves it dirty as instructed · **06:59:01Z the watcher's reset reverts it** ·
06:59:05Z–07:02:21Z the watcher branch-switches the dev tree and back · 09:47:42Z fast-forward to
`bdc5d05b` · 10:11Z this run, blind.

**[INFERRED] The reset was `--hard`.** The reflog records `reset: moving to HEAD` without the flag. A
`--soft` or `--mixed` reset to `HEAD` cannot revert a modified file in the working tree; this one did,
in the same second. Hence hard. The same reading explains cleanly why **breadcrumbs survive and the
rotation does not**: breadcrumbs are **untracked**, and a hard reset leaves untracked files alone —
`00-04-scanner-2026-09-16-0219-…md` and `…-0610-…md` are both still on disk. `sweep-rotation.json` is
**tracked and was modified**, so the reset reverted it.

**[MEASURED] Board trap, depth 1: clean.** `find docs/pr-prompts -maxdepth 1 -name '*-ready.md'` → **0
files**. 36 `*HOLD*` files at depth 1. No tracked ready-file to report as a defect, and the branch
switching above did **not** leave re-armed work behind.

**[CANNOT MEASURE]** Whether `bdc5d05b` is still the true tip of `origin/main` (no fetch). Whether the
breadcrumbs are untracked *on `origin/main`* as opposed to merely absent from the index (no `git
ls-tree`). Any gate premise, any PR state, any live-site behaviour. `check-breadcrumb.mjs --freshness`.

---

## WHAT CHANGED

**Nothing on the board. Nothing in the repo except this file.**

- No prompt staged, armed, disarmed, renamed, moved or deleted.
- **`docs/pipeline/sweep-rotation.json` deliberately NOT advanced** (no sweep was taken). It is
  currently **clean** — the watcher's reset reverted it — so unlike the 06:10Z run there is **no dirty
  rotation file for Station 00 to commit** from this run.
- This breadcrumb is written to the dev tree at `C:\ProjectOperations2\docs\pr-prompts\`. It is
  **UNTRACKED and reaches nobody until a board PR commits it** — and per F1 below, the station that
  does that is switched off.

---

## FINDINGS

### F1 — The watcher's `reset` destroys 04's uncommitted rotation advance every cycle. "Leave it dirty, 00 commits it" is unsafe as written, and 04's sweep rotation has silently stopped.

**Evidence:** the same-second match above — rotation mtime `06:59:01.727Z`, reflog
`reset: moving to HEAD` at `06:59:01Z`, by `PR Supervisor <supervisor@local>`. The file regressed past
**two** advances (02:19:05Z, 06:10:45Z) to `2026-09-15T02:10:31Z`, the last committed state.
`next-sweep.mjs` consequently now reports **position 1 of 4, `gate-liveness`** — the rotation has been
thrown back to the start, and the `instruction-drift` sweep the 06:10Z run actually performed is erased
from the record. The next run will be told to repeat a sweep two runs already did, and
`instruction-drift` will not come round again.

**Why the current instruction cannot work.** `04-scanner.md` (AUTHORITY) says to advance the rotation,
*"Then LEAVE IT DIRTY in the dev tree and NAME IT IN YOUR BREADCRUMB — Station 00 commits it, because
you may not."* That instruction assumes a dirty tracked file survives until 00 collects it. **It does
not.** The dev tree is the watcher's working tree; the watcher hard-resets it between operations. The
station doc already half-knows this — it records that a previous advance *"survived only because the
working copy happened to persist between runs"* (04's F6, 2026-09-02). This run measures the case where
it did not persist, and names the agent that took it. **With 00 disabled (F2) the window is unbounded,
so the advance is now lost every single time.**

**Blast radius.** Any tracked file any station is told to leave dirty for 00 has the same fate — this is
not specific to the rotation. Note the reset is also a standing hazard to the board itself: the station
doc's own hard stop warns that `reset --hard` in `C:\ProjectOperations2` makes *"consumed prompts come
back armed."* **Measured clean this run** (0 `*-ready.md` at depth 1), because ignored files are not
restored by a reset — but that is luck of file-status, not a safeguard.

**RULE 1 options — complete-and-additive first:**

1. **Move the rotation state out of the watcher's working tree.** Have `next-sweep.mjs --advance` write
   to a location the watcher never resets (e.g. alongside the durable local-only QA run-state, or a
   path outside the repo), and have it read from there. **Solves it immediately and in future, damages
   no existing or future data entry, and needs neither 00 nor a commit.** Fails neither half of RULE 1.
2. **Let 04 commit that one file on a branch + PR.** Complete, but it contradicts 04's *"Create a PR:
   NO / read-only"* authority and puts a board-mutating capability in a read-only station — fails the
   *"without damaging"* half by widening 04's blast radius.
3. **Re-enable 00 and hope it collects before the next reset.** Additive but **not complete**: it is a
   race against a reset that fired 41 minutes after the last breadcrumb. Fails the *"solves it
   completely"* half.

**DISPOSITION: ESCALATED.** This needs a decision on where rotation state lives, and the station that
would normally own a `docs/pipeline/` correction is disabled. Option 1 is recommended and is a
self-contained change to `next-sweep.mjs` + `04-scanner.md`. **I repaired nothing** — 04 is read-only,
and the watcher's reset behaviour is not 04's to change.

### F2 — 00-supervisor has been disabled for ~29 hours; every finding channel is open-loop, this one included.

**Evidence:** `list_scheduled_tasks` → `00-supervisor` `enabled: false`, `lastRunAt
2026-09-15T05:08:34Z`, cadence `5 * * * *`, with three sibling tasks reading `true` in the same payload
as a positive control.

This is **F1 of the 06:10Z run, re-measured at +4h and still true** — reported here not as a new defect
but because it is the reason F1 above cannot be dispatched to its natural owner, and because it now has
a **second, worse consequence than stranded breadcrumbs**: stranded breadcrumbs merely wait (they are
untracked, so they survive), whereas **anything tracked left dirty for 00 is actively destroyed** by the
reset in F1. The 06:10Z run counted eight stranded breadcrumbs; this is the ninth.

**DISPOSITION: ESCALATED** — folded into the open 06:10Z F1 escalation rather than re-filed. Marco: the
pipeline currently has no closing channel at all. One question, and it is the only one that matters:
**should `00-supervisor` be re-enabled, or is it off deliberately?** If deliberate, stations 03/04/05
should stop being told that 00 collects their output, because it does not.

### F3 — This run was blind; the cause is unknown and it is now recurrent.

**Evidence:** `CONNECT_TIMEOUT` after three prescribed `ToolSearch` loads, detailed in GROUND. Precedent
on disk: `docs/pr-prompts/00-04-scanner-2026-09-15-0000-blind-run-no-windows-shell.md`. The 06:10Z run
four hours earlier was **not** blind (`start_process` → PID 24092), which confirms the station doc's
statement that blindness is **intermittent** and its cause **not known** — and refutes any reading of
this run's quiet board as health.

**DISPOSITION: DEFERRED.** Real, but two prior escalations are already open ahead of it and a third
would add noise without adding information; the honest next step is data, not another escalation. **What
would make it urgent:** blindness across two *consecutive* 04 runs (coverage would then be >8h old with
no gate-liveness sweep since 2026-09-15T02:10Z), or a blind run coinciding with a red board. Both are
detectable from the breadcrumb trail **once F2 is resolved and someone is reading it.**

---

## WHAT I DID NOT DO

- **Did not take a sweep.** `gate-liveness` was due and is premise-execution against `origin/main` — the
  one thing a blind run cannot do honestly. It remains owed at rotation position 1.
- **Did not advance `sweep-rotation.json`.** No sweep happened; advancing would erase a slot silently.
- **Did not substitute GitHub-side reads for tree coverage.** The GitHub MCP is connected and Part 1
  reads would have "worked" — the contract forbids presenting them as coverage, because `origin/main` is
  not the tree the watcher globs. No Part 0 static sweep either: Part 0 is cheap and git-free and I could
  have run it, but the contract's step-1 STOP is the canonical block and it wins over the brief.
- **Did not run `git`** — not through the device bridge, not against the mount, not around the guard.
  The guard was installed first and left in place.
- **Did not clear, touch or interpret any lock as actionable**, and did not mint a worktree.
- **Did not re-file** the `.gitignore:107-111` citation or the 00-disabled condition as new findings;
  both are corroborating datapoints on open escalations.
- **Did not run `check-breadcrumb.mjs` on this file** (needs git against the mount). This breadcrumb is
  **unvalidated** — Station 00 or the next sighted run should validate it.
- **Did not investigate** `05-sot-keeper`'s `nextRunAt 2026-09-16T14:10:37Z` against its `10 0 * * *`
  cron, which do not obviously agree. That is a **lead, not a finding** — one unexplained reading, no
  second angle, and out of lane for a blind run.

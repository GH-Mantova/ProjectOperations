# Station 00 — Supervisor | 2026-10-10T04:16Z–2026-10-10T04:45Z

## GROUND

```
UTC            2026-10-10 04:16 UTC
origin/main    d197fc84                      (git fetch +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       DETACHED HEAD @ aa0a1257      C:\ProjectOperations2
               (was main @ d197fc84 at 04:16Z; ANOTHER ACTOR checked it out at 04:29:12Z — see F1)
               refs/heads/main is still d197fc84, i.e. == origin/main
doc version    1                             (docs/pipeline/stations/00-supervisor.md, read from origin/main)
bootstrap      1                             (station_doc_version: 1 in the scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE (1 == 1). No read-only downgrade on that account.

**This run was stood down to COLLECT-only by F1, not by a version mismatch.** It armed nothing,
merged nothing, opened no PR, and mutated no board object.

## WHAT I MEASURED

**Reachability — NOT blind this run.**
- [MEASURED] the first keyword `ToolSearch` for `desktop-commander` returned *"No matching deferred
  tools found. Some MCP servers are still connecting"*. That is a **connecting server, not an
  unreachable machine** (BOOTSTRAP_PREFLIGHT_V1). A second search ~60 s later returned the full
  toolkit under the `mcp__plugin_desktop-commander_desktop-commander__*` prefix. Declaring
  blindness on the first answer would have been a §7 instrument lie.
- [MEASURED] `start_process` shell `powershell.exe` → `Process started with PID 49452`, printing
  `2026-10-10T04:16:16Z` and `main`. No `CONNECT_TIMEOUT`; no retry needed.

**Git guard — exit 2, INSTALLED BUT INERT (the expected station outcome).**
- [MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` → **exit 2**.
  Headline, verbatim: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from
  your shell.` Last line, verbatim:
  `   PATH="/sessions/happy-practical-ritchie/.local/bin:$PATH" git <args>`
  Controls it printed: `bash -lc 'command -v git'` →
  `/sessions/happy-practical-ritchie/.local/bin/git` (the shim);
  `bash -c 'command -v git'` → `/usr/bin/git`.
  **The exit code was read off the INSTALLER, with no pipeline appended to it.**
  A FINDING, not a stop (F8). **No `git` ran through the device bridge against the mount at any
  point this run** — every `git` call went through the Windows-host PowerShell shell.

**Binding reads — all from `origin/main`, in the dev tree.**
- [MEASURED] `git -C C:\ProjectOperations2 show origin/main:<path>` for
  `docs/pipeline/stations/00-supervisor.md` (466 lines), `docs/pipeline/DOCTRINE.md` (508 lines)
  and `docs/pipeline/STATION-CAPABILITIES.md` (740 lines) — **all three read in full**, the two
  cores plus capabilities, per BOOTSTRAP_CORE_REFERENCE_V1. No REFERENCE section was needed, and
  none is quoted here.
- No piped `git show … | git hash-object --stdin` comparison was made anywhere (DOCTRINE §9.2 —
  unsound in `powershell.exe`).
- ⚠️ Reading from `origin/main` is what made these reads survive F1: the working copy was
  detached to a PR commit at 04:29Z, and a station reading the working copy would have been
  served #2303's tree as though it were `main`.

**Board state — `scripts/pipeline/status-sweep.ps1`, generated 2026-10-10 04:25:34Z, 474 lines,
run to completion (≈11.5 min wall clock — the cost #2294 removes).**
- [MEASURED] §0 positive controls both pass: `gh CAN reach GitHub (saw merged PR #2304)`,
  `node runs`.
- [MEASURED] `OPEN PRs: 2` — **#2303** BEHIND (11 pass / 4 fail), **#2294** BEHIND (13 pass /
  2 fail). Both carry `do-not-merge`.
- [MEASURED] **MARCO_QUEUE_LINE_V1, both figures copied verbatim:**
  `WAITING ON MARCO: 2 open PR(s) labelled do-not-merge; oldest #2294, open 8h` and
  `ALL OPEN (non-draft): 2; oldest #2294, open 8h`. **I armed nothing, so neither figure moved by
  my hand**, and the count did not change across this run.
- [MEASURED] `main CI on d197fc84: 3 success / 1 failed / 0 running  <-- TRUNK IS RED` (F3).
- [MEASURED] `watcher node: RUNNING pid 16148`; `heartbeat age: 0 min`;
  `watcher clone: branch=main tracked-dirty=0 untracked=3`.
- [MEASURED] `auto-restart wrapper: ANOMALY -- 2 wrappers alive (expected 1).
  WRAPPER_COUNT_ANOMALY_V1` — pids **2068** (started 10-08 07:28 local) and **35512**
  (10-10 11:35 local): the same two pids 04 saw at 02:1xZ and the 0315 run saw at 03:15Z (F4).
- [MEASURED] `non-main worktrees found: 33`; `worktree-registry-escapees: 3 found`
  (`C:\PR-Master\worktrees\bootstrap-check`, `C:\PR-Master\worktrees\sweep-section5`,
  `C:\po-wt\dispatch-register-v1`); `git index.lock interactive/clone: False / False`;
  `git processes touching our trees (scoped): 0`; `board lease: free`.
- [MEASURED] §3 `watcher build (heartbeat -- blocks arming and merging (section 7)):
  BUILD IN FLIGHT: rev-2303-ready.md  (tick 0.6 min old)`.
- [MEASURED] §7 `VERDICT` verbatim: `CAUTION: a watcher build is in flight (rev-2303-ready.md).
  Hold off arming or merging until it lands.`
- [MEASURED] §6 backlog gates: `ready=1  needs-marco=2  blocked=4  broken=0` — unchanged.
- [MEASURED] §4 queue: `armed (*-ready.md): 2` (`rev-2303-ready.md`, `rev-2304-ready.md` — both
  auto-generated REVIEW JOBS, not prompts, DOCTRINE §9.5). `needs-marco/: 53`.
  **No real armed prompt is outstanding.**

**Build-in-flight RE-MEASURED immediately before deciding not to mutate** (§7's `[LIVE]` means
"true when measured"):
- [MEASURED] `C:\po-watcher\ProjectOperations\scripts\pr-watcher\heartbeat.log`, newest four lines,
  taken from log **CONTENT** and not from a mount `stat`:
  `[2026-10-10T04:35:12.438Z] rev-2303-ready.md elapsed=549s last:` — 46 s old at a wall clock of
  `2026-10-10T04:35:58Z`. **Still in flight, ten minutes after the sweep said so.**

**Collection — `node scripts/pipeline/check-breadcrumb.mjs --freshness`, exit 0, `CLEAN`.**
- [MEASURED] `structure: 1 checked, 0 malformed, 0 skipped as pre-contract`; the one checked file
  is the 0315 supervisor breadcrumb.
- [MEASURED] freshness, verbatim: `00 last 2026-10-10T03:15:00Z 1.2h ago (cadence 1h + grace 0.5h)
  ok` · `02 dispatch-only — no cadence to miss` · `03 last 2026-10-09T23:03:00Z 5.4h ago (cadence
  24h + grace 3h) ok` · `04 last 2026-10-10T02:10:00Z 2.3h ago (cadence 4h + grace 1h) ok` ·
  `05 last 2026-10-09T14:22:00Z 14.1h ago (cadence 24h + grace 3h) ok`.
  **No station MISSED, so no FRESHNESS_ONE_CADENCE_V1 classification was required.**
- [MEASURED] crossed against `list_scheduled_tasks` (the MCP, never this repo, for cadence):
  `00-supervisor 5 * * * * lastRunAt 2026-10-10T04:14:03Z` (**this run**, hourly) ·
  `04-scanner 0 */4 * * * lastRunAt 02:09:41Z next 06:09:31Z` ·
  `05-sot-keeper 10 0 * * * lastRunAt 2026-10-09T14:22:42Z next 14:22:37Z` ·
  `03-machine-minder 0 9 * * * lastRunAt 2026-10-09T23:02:54Z next 23:02:45Z` ·
  `weekly-security-audit enabled: false`. **Enabled task count = 4.** Every row is
  `both fresh and aligned` on the station doc's freshness table — healthy, nothing further.
- [MEASURED] the only breadcrumb at depth 1 in `docs/pr-prompts/` is the 0315 supervisor run;
  04's 02:10Z file is already on `origin/main` under `archive/`. So the COLLECT corpus for this
  run is exactly one breadcrumb, and every finding in it is dispositioned below (F5–F10).

**Two negative results, recorded so the next run does not re-file them as defects.**
- [MEASURED] the sweep's `remote board activity in last 2 min: #2302 MERGED` at 04:25:34Z looked
  wrong (#2302 merged at 03:17:55Z, 68 min earlier). It is **CORRECT**: the probe reads
  `updatedAt`, not `mergedAt` (`status-sweep.ps1`, `if ($secs -lt 120)`), and
  `gh pr view 2302 --json updatedAt` → `2026-10-10T04:26:02Z`. **Not an instrument lie.**
- [MEASURED] #2303 looked as though it added `superseded/…HOLD.md` **without** deleting the root
  copy — a §10.5 duplicate — because both paths exist at the dev tree's detached `aa0a1257`. At
  the PR's real head it is a clean rename: `git diff --name-status 1dfb705b origin/pr2303head` →
  `R100 docs/pr-prompts/pr-lint-prompt-…-HOLD.md  docs/pr-prompts/superseded/pr-lint-prompt-…-HOLD.md`.
  **No duplication defect.** The false reading came entirely from F1's detached tree.

## WHAT CHANGED

**Nothing on the board. That is the whole answer, and it is deliberate.**

- No PR merged, no PR opened, no branch updated, no label added or removed, no prompt armed or
  disarmed, no escalation retired, no worktree created or pruned, no lock cleared, no scheduled
  task touched, no `/sot/` edit. The board lease was **never taken** — F1 made taking it the wrong
  move, not a step to rush.
- **One file written:** this breadcrumb, at
  `C:\ProjectOperations2\docs\pr-prompts\00-00-supervisor-2026-10-10-0416-collect-only-the-dev-tree-was-detached-to-a-pr-commit-mid-run-and-the-trunk-red-is-one-flaky-e2e.md`
  — the dev tree, which is the second of the two sanctioned homes. It is **UNTRACKED**, because
  the alternative (a `git worktree add` + branch + push + PR) is a `.git` mutation in a tree
  another actor is mid-checkout in. 🔴 **The next Station 00 run must sweep this file up**; until
  it does, this report is untracked and `sweep-breadcrumbs.ps1` is the route.
- ⚠️ It is also a future fast-forward blocker at that path once a PR lands it on `main` — the
  known cost named in the station doc's REPORT CONTRACT. The cure is §POST-MERGE-FF-CURE, and F7
  records which branch of it actually works in this repo.
- The dev tree was **NOT** fast-forwarded, **NOT** re-attached to `main`, and nothing was restored
  in it. `refs/heads/main` was already `d197fc84` == `origin/main`, so there was nothing to
  fast-forward; the detached `HEAD` is another actor's and is not mine to move (F1).

## FINDINGS

### F1 — the dev tree was checked out to a detached PR commit THIRTEEN MINUTES INTO THIS RUN, while a watcher build was in flight. This run stood down.

Two independent instruments, agreeing.

[MEASURED] at 04:16:16Z, my own first call in the dev tree:
`git rev-parse --abbrev-ref HEAD` → `main`, `git rev-parse HEAD` → `d197fc84`,
`git rev-parse origin/main` → `d197fc84`. Attached, clean, aligned.

[MEASURED] at 04:31:31Z, the same calls: `git rev-parse --abbrev-ref HEAD` → **`HEAD`**,
`git rev-parse --short HEAD` → **`aa0a1257`**, `git rev-list --left-right --count
HEAD...origin/main` → **`1  2`**. `git log --oneline origin/main..HEAD` → one commit,
`aa0a1257 fix(pipeline): refuse a HOLD whose own PR is already open`.

[MEASURED] `.git/HEAD` holds the raw SHA `aa0a1257a3509f9737fb93da0fe106b4bacd9432`, and
`git reflog --date=iso -n 10` names the actor's operation and its minute:

```
aa0a1257 HEAD@{2026-10-10 14:29:12 +1000}: checkout: moving from main to aa0a1257a35…
d197fc84 HEAD@{2026-10-10 13:30:32 +1000}: merge origin/main: Fast-forward
00726081 HEAD@{2026-10-10 13:22:03 +1000}: merge origin/main: Fast-forward
1dfb705b HEAD@{2026-10-10 11:34:08 +1000}: merge origin/main: Fast-forward
```

`14:29:12 +1000` = **04:29:12Z**. **Every one of the nine preceding reflog entries, back more
than twenty hours, is `merge origin/main: Fast-forward` — a station's hourly FF. A `checkout` of
the dev tree is NOT this tree's normal pattern; it is new today.**

[MEASURED] what it was checked out to: `git branch -a --contains aa0a1257` → `remotes/origin/pr-2303`;
`git log -1 --format='%H %P %ci'` → parent `1dfb705b`, authored `2026-10-10 12:52:03 +1000`
(02:52:03Z). So the dev tree is sitting on a commit of **#2303's own lane**, the PR whose review
job the watcher is building.

[MEASURED] the second instrument, independently: the sweep's §3 at 04:25:34Z →
`BUILD IN FLIGHT: rev-2303-ready.md (tick 0.6 min old)`, and §7 →
`CAUTION: a watcher build is in flight (rev-2303-ready.md). Hold off arming or merging until it
lands.` **Re-measured from the heartbeat's own content at 04:35:58Z: still in flight,
`elapsed=549s`, tick 46 s old.** Live, not wedged.

[MEASURED] no half-finished git operation was left behind: `.git/index.lock` **absent**;
`MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / `rebase-merge` / `rebase-apply` / `sequencer`
all `False`; `refs/heads/main` still `d197fc84`. **So this is an actor mid-work, not wreckage.**

**Why this is a stand-down and not a repair.** BOARD DRIVING condition 3 is explicit: the lease is
*in addition to*, not instead of, the lock / process / recent-activity checks — *"first confirm
nothing else is mid-mutation … If something else is acting, STOP: that is the LL-38 collision."*
Something else **is** acting, in the shared tree, right now. `board lease: free` says only that
the actor did not take the lease — and the 2026-10-09 #2279 measurement warns the opposite way
(a refusal naming yourself is a FALSE stand-down); a *free* lease next to a live checkout and a
live build is not clearance.

**The concrete damage avoided, measured rather than asserted.** While `HEAD` is detached at
`aa0a1257`, the working copy is **#2303's tree, not `main`'s**, and the tracked queue files differ
across exactly the paths arming touches:

```
cat-file -e origin/main:docs/pr-prompts/pr-lint-prompt-…-HOLD.md              -> 0    (present)
cat-file -e origin/main:docs/pr-prompts/superseded/pr-lint-prompt-…-HOLD.md   -> 128  (absent)
cat-file -e aa0a1257:docs/pr-prompts/pr-lint-prompt-…-HOLD.md                 -> 0    (present)
cat-file -e aa0a1257:docs/pr-prompts/superseded/pr-lint-prompt-…-HOLD.md      -> 0    (present)
```

`arm-prompt.ps1` arms by `git mv` of a **tracked** `-HOLD.md`, and `git status` compares the
worktree to the **index** — which, detached, is #2303's. An arm taken from this tree would have
been staged against the wrong index, on a tree where the same prompt exists in two states at once.
That is DOCTRINE §9.2's *"the dev tree's index is SHARED between concurrent chats"* with the
sharing made visible for once.

🔴 **And it has already corrupted a station's COLLECT corpus, in both directions, silently.**
[MEASURED] in the working copy as it stands:

```
docs/pr-prompts/00-00-supervisor-…-0315-….md  in working copy: False   on origin/main: exit 0
docs/pr-prompts/00-00-supervisor-…-0114-….md  in working copy: True    on origin/main: archive/ exit 0
```

The actor's checkout **deleted the 0315 breadcrumb — the one and only file this run had to
collect — from the working copy**, and **resurrected the 0114 breadcrumb into the queue root**
although `origin/main` has it under `archive/`. I only had 0315's contents because I read it at
~04:22Z, seven minutes before the checkout; a run starting eight minutes later would have found
its predecessor's report missing and `--freshness` would still have said `ok`, because freshness
compares dates and the newest date it can see.

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs` run after the checkout returns
`structure: 2 checked, 0 malformed`, `CLEAN`, exit **0** — listing 0114 and my own file, and
**not** 0315. It warns about untracked-ness and says nothing about the tree being detached,
because it reads `git ls-files` (the index) and the filesystem. **The validator is working
exactly as written and its answer is about the wrong tree** — §7's broken-instrument shape, and
§9.6's *"an empty result is not an empty world"* does not fire, because nothing is empty.

**DISPOSITION: ACTIONED.** The action is the stand-down itself, and it is verified: `git reflog`
shows no entry of mine after the actor's `14:29:12` checkout; `git status --porcelain
--untracked-files=no` was EMPTY when last read, i.e. I added nothing to the index; the only write
I made anywhere is this untracked breadcrumb. I did **not** re-attach `HEAD`, fast-forward,
`git checkout` anything, prune, or clear — all of which would have been mutations inside another
actor's in-flight operation. 🔴 **The next run must re-measure `git rev-parse --abbrev-ref HEAD`
in the dev tree BEFORE anything else: if it still reads `HEAD` after the rev-2303 build has
landed, the tree has been left detached and re-attaching it becomes the next run's first job.**

### F2 — #2303 went from ONE red to FOUR: the fix lane's second commit regressed nine pre-existing `lint-prompt` tests

At 03:35Z the 0315 run left #2303 with exactly one failing check, CP-26
(`RECEIPT_REQUIRED_BY_DIFF`). It now has four.

[MEASURED] `gh pr view 2303 --json headRefOid,mergeStateStatus,labels` →
`head=01b79c9e` (was `282f7f09`), `mergeState=BEHIND`, `labels=do-not-merge`.
`gh pr view 2303 --json commits` →

```
282f7f09  fix(pipeline): refuse a HOLD whose own PR is already open            (03:37:04Z)
01b79c9e  fix(pipeline): gate SPENT_HOLD check on -HOLD.md name; non-HOLD …    (03:58:09Z)
```

[MEASURED] the failing checks on that head: `Pipeline — watcher + linter tests`,
`Pipeline — arm-prompt tests (Windows)`, `PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)`,
`Approval receipt (CP-26)`. Run `38022417243`, job `114126062937`, failing step
`Run node --test "scripts/pipeline/__tests__/*.mjs"`, tail: `# tests 476  # pass 467  # fail 9`.

[MEASURED] the nine, from `gh run view … --log | Select-String 'not ok '` (the job log, never the
diff — DOCTRINE §3):

```
not ok   5 - THE ARMING CASE: a HOLD baselined by slug still admits once renamed to -ready
not ok 208 - lint — MODULE_AMBIGUOUS and THE RATCHET
not ok 229 - FILE_GATE_NOT_RELEASED — requires_file_on_main
not ok 230 - FILE_GATE_NOT_RELEASED — needle-less requires_on_main
not ok 232 - FILE_GATE_NOT_RELEASED — no gate key
not ok 236 - GATE_NOT_RELEASED
not ok 241 - lint CLI — requires_merged is evaluated end to end
  …plus the leaf cases: "HOLD with requires_file_on_main pointing at present path → exit 0,
  GATE_RELEASED (negative control)", "HOLD whose needle IS present still admits", "HOLD with
  requires_merged on a MERGED PR → exit 0 ADMIT (positive control)", "gh binary absent → exit 0
  ADMIT with a WARN (fail-safe)", "no requires_merged key → admits unchanged"
```

[INFERRED, from the failure set and the commit's own headline] every one of the nine is a case
that **expects a `-HOLD.md` fixture to ADMIT**, and `01b79c9e` gates the new SPENT_HOLD refusal on
the `-HOLD.md` **name**. The new check therefore fires across the whole pre-existing HOLD fixture
corpus, including its own positive and negative controls. I did not read `lint-prompt.mjs` at that
head to confirm the mechanism, so this stays `[INFERRED]`: the nine names and the commit headline
are the measurement.

**DISPOSITION: DEFERRED.** DOCTRINE §8.2 would normally have me push the real fix straight to the
failing branch — and I am not doing that, for one reason that outranks it: **the fix lane is on
that branch right now.** It pushed `01b79c9e` at 03:58Z, the watcher is mid-build on
`rev-2303-ready.md` as of 04:35:12Z, and the dev tree is checked out to one of its commits (F1).
Two actors pushing one branch is the collision, not the cure. The red is also a **diagnosis, not
a flake** — a name-gated check meeting a corpus of `-HOLD.md` fixtures — so there is nothing to
re-run hopefully (DOCTRINE §2). **What would make it urgent:** the rev-2303 build landing and
leaving the nine still red with no further commit, i.e. the fix lane stopping without finishing.
The next run should re-read the head SHA before touching anything. #2303 keeps `do-not-merge`
and stays for Marco regardless (F6).

### F3 — the trunk red is ONE flaky e2e test, and the proof is an identical-code differential

[MEASURED] `main CI on d197fc84: 3 success / 1 failed`. The failure is the
`Tendering Browser Smoke` workflow, run `38020770228`, job `114121300014` (`tendering-e2e`),
failing step `Run PR-acceptance E2E suite`. Its own summary: **`1 failed · 1 skipped ·
165 passed (9.2m)`**, the one failure being

```
tests/e2e/pr-acceptance/batch4-tender-documents.spec.ts:95:7
  "mock SharePoint mode: Open shows the connection-required toast instead of navigating"
  Error: expect(locator).toBeVisible() failed
  Locator: getByText('Document preview requires SharePoint connection. Contact your
           administrator to configure SharePoint.')
  Timeout: 10000ms   Error: element(s) not found
```

[MEASURED] **the diff cannot be the cause.** `d197fc84` is #2304, and
`git diff --name-only 00726081 d197fc84` returns exactly four paths, **all under `docs/`**; the
count of non-`docs/` paths in that range is **0**. The app, the seed and `tests/` are byte-identical
to `00726081`, where the same workflow ran `success` (run `38020066947`) 12 minutes earlier.

[MEASURED] and it passed again on the other side: the same workflow on #2303's head
`01b79c9e` → `success` (run `38022417263`), ~15 minutes after the main failure, on a tree that is
main's docs plus three `scripts/pipeline` files.

[MEASURED] frequency, from `gh run list --workflow "Tendering Browser Smoke" --branch main
--limit 15`: this failure mode appears **once**. The three other failures in that window
(`8daa77e2`, `f0ee3b99`, `120b7ad3`, all 2026-10-09 20:56–21:28Z) are the already-filed
Docker Hub unauthenticated pull-rate-limit escalation, a different mode entirely.

[INFERRED, from the spec's three lines] the test does `openTemplateTenderOverview(page)`, then
`getByRole("button", { name: "Open", exact: true }).first().click()`, then asserts the toast.
Playwright's click waits for visible/stable/enabled but **not** for React to have attached the
handler, so a click that lands pre-hydration is a silent no-op and no toast is ever raised. That
is a hypothesis about the mechanism, not a measurement of it.

**DISPOSITION: DEFERRED.** It is real — a trunk red is never nothing — but it is **not a
regression**, and the two things a station must not do here are the two tempting ones: re-run
hoping for green (DOCTRINE §2), or weaken/skip/quarantine the assertion (§8.2 — *a quick fix is
never a mask*). The complete-and-additive fix is to make the test wait on a hydration signal
before clicking, which is a `tests/e2e/**` change and therefore a prompt — and I deliberately did
not stage one this run (see WHAT I DID NOT DO: `lint-prompt.mjs`, the admission instrument, is
mid-change in #2303 and the queue census was taken from a detached tree). **What would make it
urgent:** a second trunk red on this same spec line, or the same test failing on a PR head where
it blocks a merge. Trunk will read green again on the next merge regardless, which is exactly why
this needs writing down rather than waiting on.

### F4 — the machine findings are unchanged and still live: 2 auto-restart wrappers, 33 worktrees, 3 registry escapees

[MEASURED] re-measured at 04:25:34Z, not quoted from 04 or from the 0315 run:
`auto-restart wrapper: ANOMALY -- 2 wrappers alive (expected 1). WRAPPER_COUNT_ANOMALY_V1`, pids
**2068** (10-08 07:28 local) and **35512** (10-10 11:35 local) — **the same two pids for the third
consecutive observation**, now spanning 02:1xZ → 03:15Z → 04:25Z, so neither has turned over in
over two hours. `non-main worktrees found: 33`. `worktree-registry-escapees: 3 found` —
`C:\PR-Master\worktrees\bootstrap-check` (10380 min), `C:\PR-Master\worktrees\sweep-section5`
(533 min), `C:\po-wt\dispatch-register-v1` (10485 min), all `size=0KB .lock=False`.
`watcher node: RUNNING pid 16148`, heartbeat ticking mid-build — **idle/working, not wedged**, and
nothing here says otherwise.

**DISPOSITION: DISPATCHED to Station 03.** Machine repair is 03's lane and not mine
(STATION-CAPABILITIES §5: 00 dispatches, 03 repairs). **03, before acting:** re-measure — a
wrapper count and a worktree's dirtiness both expire — and note the two that will refuse a prune,
`C:/po-worktrees/sup-cwd-paths` (**4 commits on no remote branch, 2 uncommitted files**) and
`C:/PR-Master/worktrees/sweep-dirty-untracked-v1` (**1 commit on no remote branch, 1 uncommitted
file**); `--force` on either discards real work. Also note F1: **the dev tree itself is listed by
`git worktree list` as `C:/ProjectOperations2  aa0a1257 (detached HEAD)`** — do not treat it as an
orphan and do not prune it. 03's next occurrence is its daily cron, `0 9 * * *`, next run
`2026-10-10T23:02:45Z`.

### F5 — #2294 is unchanged at 8h and this run paid its cost in full, for the fourth time

[MEASURED] `gh pr view 2294 --json state,mergeStateStatus,labels,headRefOid,createdAt` →
`state=OPEN mergeState=BEHIND labels=do-not-merge head=191a6e2a created=2026-10-09T19:33:12Z`,
CI 13 pass / 2 fail. The sweep: `WAITING ON MARCO: … oldest #2294, open 8h`.

[MEASURED] and the cost is now quantified rather than asserted: I ran `status-sweep.ps1` as a
detached background process writing to a file, and it took **≈11.5 minutes of wall clock** to
reach `SWEEP COMPLETE` and 474 lines — the first attempt, run inline with `| Out-String`, hit the
180 s tool ceiling with **zero** output because `Out-String` buffers to completion. #2294 is the
PR that adds `-SkipSection5` and dedupes that crawl. **Four consecutive supervisor runs have now
paid it; this is the first to get sections 5–7 at all, and only by working around the ceiling.**

**DISPOSITION: ESCALATED**, carried forward from the 0114 / 0214 / 0315 runs and **not re-filed**
(§10.5 — one identity per artifact). It carries `do-not-merge` and **only Marco removes that
label**. I did not call `gh pr update-branch` on it: the watcher's auto-update timer is OFF by
default and a stray update-branch costs a full CI rebuild on a PR nobody can merge.

### F6 — the INSTRUMENT_LANE_V1 escalation (0315's F1) is filed and landed; nothing further is owed

[MEASURED] `git cat-file -e
origin/main:docs/pr-prompts/needs-marco/instrument-lane-cannot-cover-a-watcher-built-fix-2026-10-10.md`
→ **exit 0**. The file is on `origin/main` at `d197fc84`, with the three RULE 1 options and which
half each fails. #2303 carries `do-not-merge` and is unlabelled by me this run.

**DISPOSITION: ESCALATED**, carried. Marco's decision, restated once under FOR MARCO below and
**not duplicated as a second file**. I wrote no receipt of either authority for #2303: `standing`
is unavailable outside a lane, and `personal` would forge Marco's release.

### F7 — the fast-forward cure's EOL ordering (0315's F2)

0315 measured, twice in one run, that the station doc's **first** cure — a raw-Buffer
`fs.writeFileSync(abs, execFileSync('git', ['show', 'HEAD:' + rel]))` — leaves a text path reading
` M` in this repo, because `HEAD` holds pure LF and the dev tree checks out CRLF; the CRLF fallback
branch cleared it in one call. It also recorded the adjacent trap: the restore source must be
**`HEAD`**, not `origin/main`, because `git status` compares the worktree to the **index**.

**DISPOSITION: DEFERRED**, unchanged. **I could not re-measure it this run** — `refs/heads/main`
was already `== origin/main`, so there was no fast-forward to perform and no blocker to clear
(F1 also forbade it). `[CANNOT MEASURE]` for this cycle; 0315's reading stands unchallenged.
**What would make it urgent:** a third run spending attempts on the same ordering. The
complete-and-additive fix remains a `scripts/pipeline/ff-dev-tree.ps1` that measures the attribute,
picks the branch and reads back all four controls — and it is blocked behind the same lane
question as F6, since it touches `scripts/pipeline/**`.

### F8 — the git guard reads INSTALLED BUT INERT in a third independent session (0315's F3, 04's F1)

[MEASURED] 04 recorded exit 2 at 02:1xZ on session `/sessions/laughing-wonderful-gauss`; the 0315
run recorded exit 2 at 03:14Z on `/sessions/kind-wizardly-goldberg`; I recorded exit 2 at 04:17Z
on `/sessions/happy-practical-ritchie`. Same headline, same two controls, three different
sessions. **This is the standing station condition the three-outcome table documents, not a
per-session accident** — and the table is right that exit 2 is the EXPECTED outcome.

**DISPOSITION: DEFERRED**, unchanged from 04's own disposition. The cure is how a station's shell
is invoked (a login shell, or an installer target a non-login shell sources), which is 03's or
Marco's call. **What would make it urgent:** a run that actually needs `git` against the mount, or
a fresh 0-byte `.git/index.lock` with no owning process. Neither happened — `index.lock` is
**absent** in the dev tree as of 04:3xZ, and `git index.lock interactive/clone: False / False` in
the 04:25Z sweep.

### F9 — station 03's bootstrap says 4h, its live cron says daily (0315's F4, 04's F2)

[MEASURED] re-measured from the scheduled-tasks MCP this run, rather than carried on 04's reading:
`03-machine-minder  cronExpression "0 9 * * *"  enabled true  lastRunAt 2026-10-09T23:02:54Z
nextRunAt 2026-10-10T23:02:45Z` — **daily**. Already open with Marco at
`docs/pr-prompts/needs-marco/station-03-cadence-bootstrap-says-4h-cron-says-daily-2026-09-03.md`.

**DISPOSITION: DEFERRED.** Marco's to rule on; the scheduled-tasks layer is not in this repo. Not
re-filed and not duplicated (§10.5). **What would make it urgent:** 03 reasoning about heartbeat
age from the 4-hour figure and calling a healthy machine wedged — note that F4 hands 03 a live
heartbeat reading precisely so it does not have to.

### F10 — the spent escalation (0315's F5) is retired, and the retirement holds

[MEASURED] both halves are on `origin/main` at `d197fc84`:
`docs/pipeline/discharges/2026-10-10-0226Z-stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md`
and the file under `docs/pr-prompts/needs-marco/discharged/`. The 04:25Z sweep's §5 no longer
tags it `[STALE]`; it is absent from the escalation census, which now reads `needs-marco/: 53`.
Nothing was deleted — the file moved, via `retire-escalation.mjs`.

**DISPOSITION: ACTIONED** (by the 0214 run; verified by me on `origin/main` and by its absence
from this run's §5 cross-check).

## WHAT I DID NOT DO

- **Did not take the board lease, arm anything, merge anything, or open a PR.** Two instruments
  said the board was busy — §7's `CAUTION: a watcher build is in flight (rev-2303-ready.md)` and
  the dev tree's own detached `HEAD` — and condition 3 says STOP on that, not "check the lease and
  proceed". There was also nothing mergeable: both open PRs are red **and** carry `do-not-merge`.
- **Did not archive the 0315 breadcrumb** to `docs/pr-prompts/archive/`, although every finding in
  it is dispositioned above (F6–F10). Archiving is a `git mv` in the same board PR, and I opened
  no board PR. 🔴 **The next run must archive it together with this one.** `check-breadcrumb.mjs`
  matches by basename, so leaving both in the root costs freshness nothing.
- **Did not create a worktree for my own PR**, which is the better of the two breadcrumb homes.
  `git worktree add` writes into the dev tree's `.git` while another actor is mid-checkout there;
  the untracked-in-the-dev-tree home is the lesser risk and is sanctioned. Said loudly under
  WHAT CHANGED so it gets swept.
- **Did not push to #2303's branch to fix the nine regressed tests** (F2), though §8.2 would
  normally have me fix a red in place. The fix lane pushed to it 20 minutes before I ran and the
  watcher is mid-build on its review job. Two actors on one branch is the collision.
- **Did not re-run any red check hoping for green.** F2's red is a diagnosis; F3's is a
  demonstrated flake whose cause I have named at the differential level and whose mechanism I have
  labelled `[INFERRED]`, not measured.
- **Did not weaken, skip or quarantine the failing e2e assertion** (F3), and did not stage a
  prompt to do so. A quick fix is only ever an unblock, never a mask.
- **Did not stage the `ff-dev-tree.ps1` prompt** (F7) or a prompt for F3. `lint-prompt.mjs` — the
  admission instrument every prompt passes through — is mid-change in #2303, and my queue census
  came from a detached tree. Staging against either is building on sand.
- **Did not re-attach the dev tree's `HEAD`, fast-forward it, restore a path in it, prune a
  worktree, kill a wrapper, or clear a lock.** No lock existed to judge; the rest is 03's lane
  (F4) or another actor's live operation (F1).
- **Did not remove any label, and merged no watcher-routed PR.**
- **Did not touch `/sot/`** — 05's alone.
- **Did not go near Azure, Entra or SharePoint.** F3's failing test only *mentions* SharePoint; it
  is a mock-mode browser assertion and nothing this run approached the real systems.
- **Did not run `git` through the device bridge against the mount** (F8), and did not run
  `check-breadcrumb.mjs` from the mount. Both ran on the Windows host.
- **Did not touch, enable, disable or re-run any scheduled task.** No station read MISSED, so that
  question never arose.

## FOR MARCO

**Nothing new is being asked of you. One decision is still in front of the pipeline, unchanged
from 03:15Z, and one new fact is worth your eye.**

**The decision, unchanged (F6).** INSTRUMENT_LANE_V1 cannot fire for any instrument fix the
watcher builds, because the watcher retires the prompt under `docs/pr-prompts/` and "everything
under `docs/`" is on the lane's never-list. Filed at
`docs/pr-prompts/needs-marco/instrument-lane-cannot-cover-a-watcher-built-fix-2026-10-10.md`, on
`origin/main`. RULE 1, complete-and-additive first:

1. **Exempt the prompt-retirement paths from the lane boundary** — teach
   `check-instrument-lane.mjs` that a move under `docs/pr-prompts/` into `superseded/`, `merged/`
   or `archive/` is queue bookkeeping, not a docs change. Complete: it fixes every future
   watcher-built instrument PR. Additive: it narrows nothing and every other never-list entry
   keeps its veto. **Recommended.**
2. **Release #2303 by hand and leave the lane as it is.** Fails the *future* half of RULE 1 — the
   next instrument fix arrives in the same state. Damages no data.
3. **Retire INSTRUMENT_LANE_V1 as unreachable.** Also fails the future half, and loses the
   capability you asked for on 2026-10-03.

**The new fact, and it is why this run did nothing (F1).** At **04:29:12Z, thirteen minutes into
this run**, something checked `C:\ProjectOperations2` — the shared dev tree, the one the watcher
globs and the one `arm-prompt.ps1` arms from — out to a **detached commit on #2303's lane**, while
the watcher was mid-build on that PR's review job. Nothing is broken: no `index.lock`, no
half-finished merge, and `refs/heads/main` is still `origin/main`. But for as long as it stands,
the dev tree's working copy and index are **#2303's tree, not `main`'s**, and I measured the queue
paths differing across exactly what arming touches. It had already deleted the 03:15Z supervisor
breadcrumb from the working copy and put an already-archived one back in the queue root, and the
breadcrumb validator reported `CLEAN`, exit 0, over that wrong tree without a word. I stood the
run down rather than act through it. Every prior reflog entry for twenty hours is a station's hourly fast-forward, so **a checkout
of that tree is new behaviour today** — if it was you, nothing is wrong and the next run will
simply find it re-attached; if it was not, something is building in the shared tree instead of a
disposable worktree, and that is the shape of LL-38.

**Still waiting, unchanged:** **#2294** (`do-not-merge`, 8h) — the sweep section-5 fix. Four
consecutive supervisor runs have now paid the eleven-and-a-half minutes it removes.
**#2303** (`do-not-merge`) — now four reds rather than one; its own fix lane is working it, and F2
records what broke so the next run can tell "being fixed" from "abandoned red".

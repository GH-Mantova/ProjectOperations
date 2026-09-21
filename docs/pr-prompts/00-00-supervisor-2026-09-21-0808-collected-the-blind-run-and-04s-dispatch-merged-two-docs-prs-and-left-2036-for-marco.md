# Station 00 — Supervisor | 2026-09-21T08:08:11Z–2026-09-21T08:50Z

> **SIGHTED RUN.** Desktop Commander connected on the first call. The 07:10Z occurrence's blindness
> did **not** recur, which is the trigger its own F2 named — see F3 below.

## GROUND

```
UTC            2026-09-21T08:08:11Z
origin/main    e02e265f  (at preflight; e0b5e519 after this run's merges)
dev tree       main @ 29abf8d4   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (scheduled-task SKILL.md, station_doc_version: 1)
```

**Versions MATCH (1 == 1). This run was read-write.**

**Device-bridge git guard — INSTALLED, last line quoted verbatim, PASS:**

```
vm-git-guard installed at /sessions/great-dazzling-allen/.local/bin/git - refuses mounted paths and
mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

⚠️ **Self-report:** the guard was installed AFTER two read-only `git` calls (`git log`, `git status`)
had already run in the VM against the mount, not before as PREFLIGHT requires. Checked immediately:
`.git/index.lock`, `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD` all **ABSENT**, tree readable, no
freeze. No harm done, and every `git` call after that point ran on the Windows host. Recorded because
a near-miss nobody writes down is a near-miss that recurs.

**Binding docs read in the DEV TREE after `git fetch origin`, freshness proved with
`git diff --numstat origin/main -- <path>` (EMPTY = identical), never a piped hash (PREFLIGHT §2):**

| doc | `git diff --numstat origin/main` |
|---|---|
| `docs/pipeline/stations/00-supervisor.md` | EMPTY — identical |
| `docs/pipeline/DOCTRINE.md` | EMPTY — identical |
| `docs/pipeline/STATION-CAPABILITIES.md` | EMPTY — identical |

All three read in full. `git rev-list --left-right --count HEAD...origin/main` → `0	9` — the dev
tree is **9 behind, 0 ahead**. Behind is routine; **ahead** would be the NO-DRIFT incident, and it is
not present. That settles the 07:10Z run's F4 lead, which could not read the direction without git.

## WHAT I MEASURED

**[MEASURED] `status-sweep.ps1` run twice — 08:11:18Z (preflight) and 08:18:33Z (immediately before
the first board mutation), captured to file and decoded `utf16le` (§9.3's `*>` trap).** Section 0
instrument controls both PASS (`gh` reached GitHub, `node` runs). Verdict both times: **CAUTION —
1 LIVE STATION WORKTREE `C:/po-wt/00i-0004-2038`**.

**[MEASURED] Section 5 stale-claim cross-check ran and produced 651 lines, with ZERO `[STALE]`
escalation rows.** POSITIVE control: the section is populated (13 `[FILE]` citation rows visible in
its first 25 lines). The eleven-dead-escalation backlog this station doc records under COLLECT is
**currently clear** — there was nothing to discharge this run.

**[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0.**

```
structure: 4 checked, 0 malformed, 0 skipped
00  last 2026-09-21T07:10:00Z  1.1h ago  (cadence 2h)  ok
03  last 2026-09-21T00:21:00Z  7.9h ago  (cadence 24h) ok
04  last 2026-09-21T06:11:00Z  2.1h ago  (cadence 4h)  ok
05  last 2026-09-21T00:45:00Z  7.5h ago  (cadence 24h) ok
```

⚠️ Cross-checked per the COLLECT contract: `00`'s row is the weak one — `check-breadcrumb.mjs`'s
`CADENCE` map still holds `'00': 2` against a live hourly cron, so `ok` for 00 means "inside 4 h",
i.e. three missed runs. That is `STATION-CAPABILITIES.md` §6's recorded defect, unchanged, not a new
finding. The 07:10Z breadcrumb is 1.1 h old and this run is the next occurrence, so 00 is genuinely
current regardless.

**[MEASURED] BOARD, 6 open PRs at 08:16:53Z** (`gh pr list -R <owner>/<repo>`, `-R` per §9.4's CWD
bullet, `$LASTEXITCODE` tested):

| PR | mergeStateStatus | labels | lane (§10.1) | disposition |
|---|---|---|---|---|
| #2038 | BLOCKED | **do-not-merge** | watcher-opened (2 prompt-log hits) | PARKED — Marco's |
| #2037 | CLEAN | none | second lane, 1 file under `docs/` | **MERGED by me 08:26:01Z** |
| #2036 | CLEAN | none | second lane, **1 of 2 files outside tests/docs** | **Marco's — see F1** |
| #2035 | CLEAN | none | second lane, 1 file under `docs/` | auto-merge armed — see WHAT CHANGED |
| #2034 | BLOCKED | **do-not-merge** | watcher-opened (2 prompt-log hits) | PARKED — Marco's |
| #2031 | CLEAN | none | second lane, 1 file under `docs/` | **MERGED by me 08:23:02Z** |

**Q1 — how many are DIRTY? ZERO.** No PR on this board is conflicted, so no PR has frozen CI. The two
BLOCKED PRs are BLOCKED by a label, not by a conflict, and the rest were BLOCKED only while CI
re-ran after the base moved under them.

**Q2 — a conflict is mine to fix.** Not applicable: there is no conflict on this board.

**Q3 — armed prompts counted MYSELF, not quoted from a note:** `Get-ChildItem docs\pr-prompts -Filter
*-ready.md` → **0**. `-HOLD.md` → **26**. `-LOOPING.md` → 0. The `rev-2034-ready.md` the 07:10Z run
saw armed has been consumed; the queue is empty and idle.

**[MEASURED] Lane probe, §10.1 step 1, with all three controls** — `Select-String -Path
docs\pr-prompts\processed\pr-*.log` (prompt logs only, `rev-*` excluded per §9.5):

```
#2031 -> 0    #2035 -> 0    #2036 -> 0    #2037 -> 0     (no watcher verdict => second lane)
#2034 -> 2    #2038 -> 2                                 (watcher-opened)
POSITIVE control  PR #1850           -> 2
POSITIVE control  'marco.:true'      -> 691   (regex form, no quote char — §10.1's own note)
NEGATIVE control  PR #999994         -> 0
FRESHNESS control newest processed log = rev-2038-ready.md.log @ 07:47:39Z — younger than every open PR
```

The four second-lane PRs were hand-classified against `classifyPolicyFiles` by reading their file
lists, and recorded as `[NO LANE VERDICT — hand-classified]`.

**[MEASURED] CP-26 verdict TOKEN on #2038, read from column 3 of the job log per §9.1** (not from the
pass/fail counts, per §9.4):

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.
```

POSITIVE control 114 body lines matched in the same 16,636-line log; NEGATIVE control, a freshly
minted needle → 0. **`[LABEL_PRESENT]` = PARKED BY DESIGN, not work** — the exact shape §9.4 records
three consecutive collect runs having mis-listed as "the reds". #2034 shows the byte-identical
two-reds-one-cause signature, but its CI was mid-rerun at the moment I looked, so its token this
instant is **[CANNOT MEASURE]**; the label binds regardless and nothing turns on it.

**[MEASURED] WATCHER: HEALTHY-IDLE, not wedged.** `watcher node RUNNING pid 9744`; auto-restart
wrapper alive (1); heartbeat 25 min then 31.8 min — and heartbeat ticks only MID-RUN, so a stale
heartbeat with **0 armed prompts** is the CORRECT idle reading, not a wedge. No build in flight. I
did **not** run `restart-watcher-if-wedged.ps1 -Fix`, and there was no WEDGED/DOWN verdict to justify
it.

**[MEASURED] Single-actor gate, BOARD DRIVING condition 3, re-derived from its own sources rather
than from the sweep's derived verdict (§9.5):**

```
08:16:53Z   git index.lock dev/clone .......... False / False
            git processes touching our trees ... 0
            no PR touched on GitHub ............ in the last 2 min (newest updatedAt 07:52:33Z)
            C:\po-wt\00i-0004-2038 ............. lastWrite 07:50:13Z, 26.7 min idle, dirty=0
            C:\po-wt\00i-0004-2034 ............. lastWrite 07:13:39Z, 63.2 min idle, dirty=0
08:18:33Z   re-run: identical on all four signals
```

The sweep's `CAUTION` fires on a worktree **age** threshold. Re-derived from source, both worktrees
were idle for half an hour, held no dirty files, and belong to PRs I did not touch. Condition 3's own
stated criteria — in-progress prompt, git lock, a PR touched in the last ~2 min — were **all clear**.

**[MEASURED] A second Station 00 actor is live on this board today: `station-00.interactive-0004`.**
`.arming-log.txt` in the dev tree is a strict superset of `origin/main`'s copy —
`git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt` → `2	0`, i.e. **2 insertions,
0 deletions**, which this station doc's own discriminator names as "the working copy has something
that has not landed". The two rows:

```
2026-09-21T05:54:18Z ARMED pr-scopecards-s4a-push-by-destination-api escalates=true actor=station-00.interactive-0004 pid=31356
2026-09-21T07:16:21Z ARMED pr-crmvis-s7-comms-inbox                  escalates=true actor=station-00.interactive-0004 pid=12596
```

Those two arms are #2034 and #2038 — both watcher-built, both labelled, both Marco's. See F2.

**[MEASURED] The dev tree cannot fast-forward, and there are three independent blockers, not one:**

| path | `git diff --numstat origin/main` | shape |
|---|---|---|
| `docs/pr-prompts/pr-lintstation-contract-version-compare-HOLD.md` | `0	126` | tracked on main (#2032), **untracked disk copy** left in the dev tree |
| `docs/pr-prompts/.arming-log.txt` | `2	0` | append-only, **strict superset** — restoring to HEAD would destroy another actor's audit rows |
| `docs/data-model/metadata-catalog.json` | `0	24` | tracked, locally modified |

`docs/pipeline/sweep-rotation.json` numstat is **EMPTY** — 04's rotation advance already landed in
#2032, so the ` M` in `git status` is an artefact of the tree being 9 behind HEAD, exactly §9.2's
"status answers about HEAD, not about origin/main". Not a finding, and not work.

## WHAT CHANGED

1. **MERGED #2031** — `docs(pr-prompts): narrow company-manage S2 to App.tsx only`. Path:
   `Assert-SmokedOrEscalate` → `Merge-Pr`, never raw `gh pr merge`. Read back:
   `{"state":"MERGED","mergedAt":"2026-09-21T08:23:02Z","mergeCommit":{"oid":"8c9efc40..."}}`.
2. **MERGED #2037** — `docs(pr-prompts): retire vault slice 4c HOLD to superseded`. Gate passed, the
   direct merge was refused while GitHub's rollup read `UNKNOWN`, and **`Merge-Pr` correctly threw
   rather than reporting success** (`#2037 is 'OPEN', not MERGED. Do not report success.`). Re-armed
   as native squash auto-merge; read back `{"state":"MERGED","mergedAt":"2026-09-21T08:26:01Z"}`.
3. **#2035 — native squash auto-merge ARMED** (`enabledAt 2026-09-21T08:25:06Z`), then its branch
   updated with the scoped `gh pr update-branch 2035` when the base moved under it — the same call
   `enable-automerge.ps1`, `merge-queue.ps1` and `monitor-board.ps1` all make. `✓ PR branch updated`,
   exit 0. **BEHIND is not a failure, it is a rebase.** Its final state is read back in the addendum
   at the foot of this report.
   ⚠️ I did **not** run `enable-automerge.ps1` itself: it selects across the **whole open board** and
   would have swept in #2036, which F1 classifies as Marco's.
4. **This breadcrumb**, written inside this run's own PR worktree (`C:\po-wt\00s-collect-20260921-0840`,
   detached off `origin/main e0b5e519`, branch `docs/00-collect-20260921-0840`) — REPORT CONTRACT
   cure 1, so no loose untracked copy is left in the dev tree to block the next fast-forward.
5. **`docs/pr-prompts/.arming-log.txt` committed in this PR**, carrying the interactive lane's two
   unlanded arm rows. DOCTRINE §9.5 requires any run that arms to land the log in its board PR; that
   lane armed and did not, so a clone has been reading a stale arm history since 05:54Z. Handled the
   append-only way — the dev tree's copy was read and carried forward whole, **never** restored to
   HEAD, so no row was dropped.

**Nothing else.** No prompt armed, no prompt renamed or binned, no label added or removed, no
`needs-marco` file moved, no watcher restart, no worktree pruned, no `sot/` edit, no commit on `main`,
no production data, nothing near Azure / Entra / SharePoint.

## FINDINGS

### F1 — #2036 is green, mergeable, and NOT mine: it carries a file outside `tests|docs` with no CI gate proving that lane (S3)

`#2036` (`docs(pr-prompts): rewrite ops-m2b tipping HOLD against map-locations, with its mock-up`) is
CLEAN, unlabelled, 15 checks, 0 failing, 0 pending. It is second lane — 0 prompt-log hits with the
probe's positive and negative controls both passing — so §10.1 step 2 applies and
`classifyPolicyFiles` is the definition. Its two files:

```
docs/pr-prompts/pr-ops-m2b-tipping-tab-reminder-HOLD.md         <- inside ^(tests|docs)/
Claude Design/proposed/ops-m2b-tipping/m2b-tipping-mockup.html  <- OUTSIDE
```

`classifyPolicyFiles` refuses the first path that is not test-or-docs, and `Claude Design/` matches
none of `NESTED_TEST_PATHS`' three forms. §10.1 step 3's station-lane exception does not rescue it
either: that exception requires a CI gate proving the lane's boundary, the way **CP-24** proves 05's
`sot/` lane, and **no gate proves a `Claude Design/` boundary**. Self-declaration is not
classification.

So this is the "get it green and mergeable, then hand it over" case, and it already is green.

**DISPOSITION: ESCALATED** — to Marco, one question:

> **#2036 is green and mergeable but pairs a `docs/pr-prompts/` prompt with a mock-up under
> `Claude Design/proposed/`, which is outside the automatic lane and has no CI gate. Which do you
> want?**
>
> **(a) Merge #2036 yourself as it stands, and — separately — decide whether `Claude Design/proposed/`
> should become a recorded lane with a CP-24-style gate proving its boundary.** *Complete and
> additive: the PR lands now, and the next mock-up-plus-prompt PR stops being a fresh judgement call.
> It removes no gate, adds one, and touches no data.* **Passes both halves of RULE 1.** Recommended.
>
> **(b) Merge it and change nothing.** Solves it immediately, **fails the "future" half** — every
> later PR of this shape stops on the same question and burns another station run.
>
> **(c) Require stations to split design assets into their own PR.** Durable, but **fails the
> "immediately" half** (#2036 has to be re-cut first) and costs an extra PR every time a prompt and
> its mock-up belong together.

### F2 — the interactive lane armed twice today and landed neither arming-log row; a clone has been reading a stale arm history since 05:54Z (S3)

Measured above: `.arming-log.txt` is `2 0` against `origin/main` — a strict superset carrying
`05:54:18Z` and `07:16:21Z`, both `actor=station-00.interactive-0004`. DOCTRINE §9.5's own bullet is
explicit that nothing commits this log on purpose, that the gap therefore "closes and re-opens by
luck", and that **"any run that arms something MUST commit the arming log in its board PR"**. That did
not happen for either arm, so for the last ~2.5 hours any reader taking arm history from
`origin/main` has been reading a lower bound that is two arms and two escalating prompts short.

This is the defect §9.5 names, reproducing — not a new one — and it is worth recording precisely
because the recorded failure mode is that it regenerates silently.

**DISPOSITION: ACTIONED** — the log is committed in this run's PR (WHAT CHANGED item 5), carried
forward append-only so neither row was lost. Read back in the PR diff: both rows present, line count
135 → 137, **zero** deletions. ⚠️ **This closes today's instance, not the cause.** The cause is that
no actor owns landing the log, and the next arm re-opens it.

### F3 — the 07:10Z blind run did NOT recur, so its own escalation trigger did not fire (S4)

The 07:10Z occurrence stopped at PREFLIGHT step 1 with
`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT) … after 30000ms`. Its F2 set an
explicit trigger: *"A second consecutive blind run should be escalated to Marco immediately rather
than deferred again."*

**That trigger did not fire.** This occurrence loaded the schemas by keyword `ToolSearch` (ids
searched, never assumed) and `start_process` on `powershell.exe` returned on the **first** call. One
blind run, then one sighted run.

Its F1 was dispositioned ESCALATED, and the escalation already has a home:
`docs/pr-prompts/needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`
(present, last written 2026-09-06T01:13Z). No duplicate was created. ⚠️ `needs-marco/` is gitignored,
so that file reaches nobody on its own — **this breadcrumb is the channel that carries it.**

**DISPOSITION: DEFERRED** — the standing escalation is open and correctly filed; one non-recurrence
is neither a fix nor a refutation. **What would make it urgent:** two consecutive blind occurrences,
which is 07:10Z's own trigger, still unspent.

### F4 — 07:10Z F2 (BUSY vs WEDGED, one prompt armed) is RESOLVED (S4)

That run could not tell a BUSY watcher from a WEDGED one and left `rev-2034-ready.md` armed and
unverified. Measured this run with the sanctioned instruments: `rev-2034` is **consumed** (armed
count 0, counted myself), the watcher node is **RUNNING pid 9744** with its auto-restart wrapper
alive, and no build is in flight. An idle watcher with 0 armed prompts is CORRECT, not wedged.

**DISPOSITION: ACTIONED.** No restart was run and none was warranted.

### F5 — 07:10Z F3 (three breadcrumbs uncollected, `main` red) is RESOLVED (S4)

All three named breadcrumbs (`00-04-scanner-…-0210`, `00-00-supervisor-…-0235`,
`00-00-supervisor-…-0208`) are now **tracked on `origin/main`**, and 04's 0210 sweep was
dispositioned by the 0235 addendum run, which is what that run's own title records. The finding that
run flagged as outranking everything — *"`main` went red"* — is **dead**: `main` CI on `e02e265f`
reads **4 success / 0 failed (trunk green)**, and per §9.5's trunk bullet that verdict is scoped to
real trunk checks rather than to every run attributed to the head.

**DISPOSITION: ACTIONED.**

### F6 — Station 04's F1 dispatch reached 00 and is already committed; I did NOT arm it (S3)

04's 06:11Z breadcrumb dispatched `lint-station.mjs`'s false version-mismatch NOTE to Station 00 as
`docs/pr-prompts/pr-lintstation-contract-version-compare-HOLD.md`, warning *"the HOLD is untracked —
if 00 does not commit it, it does not exist."* It **does** exist:
`git rev-parse origin/main:docs/pr-prompts/pr-lintstation-contract-version-compare-HOLD.md` exits 0,
landed by #2032. The dev tree's copy at that path is a leftover untracked disk copy — one of the
three fast-forward blockers measured above — not a second staging.

I did not arm it. Arming is the one board mutation that shares the queue **filesystem** with
`station-00.interactive-0004`, which armed at 05:54Z and again at 07:16Z and whose two builds are
still open and parked. Merging through GitHub touches no shared tree; arming does. With the sweep
reading CAUTION on that lane's worktree, arming a third prompt concurrently is the LL-38 shape, and
*"never skip condition 3 because you are the only station that runs"* is the instruction that covers
it exactly.

**DISPOSITION: DEFERRED** — 04's dispatch is landed and armable; the arm itself waits. **What would
make it urgent:** the next occurrence finding the `00i-0004-*` worktrees gone and no new
`actor=station-00.interactive-*` row in `.arming-log.txt` — at which point arm it, after the standard
pre-arm checks (gates LIVE on `origin/main`, not already shipped on the merged board, §10.6 `scope:`
cross-check against OPEN PRs, and read the BODY, because a prose human gate matches no regex).
⚠️ Note before arming: its scope is `scripts/pipeline/lint-station.mjs`, outside `tests|docs`, so the
PR it builds routes to **Marco** and will not auto-merge.

### F7 — the dev tree has THREE independent fast-forward blockers, and the append-only one can destroy another actor's data (S3)

Measured in full above. This station doc's cure is written for the untracked-breadcrumb case and for
`sweep-rotation.json`; here `sweep-rotation.json` is already clean and the live blockers are a
leftover untracked HOLD copy, a **strict-superset append-only** `.arming-log.txt`, and a modified
`metadata-catalog.json`. On the arming log the doc is emphatic: `git show HEAD:<path>` piped to a
write **silently deletes** a second actor's rows, and every prescribed read-back still passes.

I did not fast-forward. The dev tree being 9 behind blocked nothing this station needed — every
`origin/main` read this run went through `git show origin/main:` or `git rev-parse origin/main:` —
and attempting the cure while `station-00.interactive-0004` may append a third arm row at any moment
is racing the one file whose loss is unrecoverable.

**DISPOSITION: DEFERRED** — with the order recorded so the next run does not re-derive it: land this
PR first (it commits `.arming-log.txt`, which collapses that blocker to EMPTY if no new arm has
landed since), then `Remove-Item` the leftover HOLD disk copy **only after** proving
`git rev-parse origin/main:<path>` equals `git hash-object <path>` (never a piped hash), then resolve
`metadata-catalog.json`, then `git merge --ff-only`, then read back **all three** of
`rev-list --left-right --count` → `0	0`, `diff --numstat` → EMPTY, `diff --cached --name-status` →
EMPTY. The first alone passes on a dirty tree. **What would make it urgent:** a run that actually
needs a working-copy read of a path newer than `29abf8d4`.

### F8 — Q6: the single most important thing blocking progress right now

**The board's throughput constraint is Marco, not the machinery.** Of six open PRs, two are
`do-not-merge` and parked by design, one (#2036) is green and waiting on a lane decision only he can
make, and the three in the automatic lane I merged or armed to merge. Zero prompts are armed, the
watcher is healthy and idle, `main` is green, and nothing is DIRTY. **Nothing mechanical is stuck.**
The queue holds 26 HOLD prompts and the constraint on draining them is that anything touching code
routes to Marco.

**DISPOSITION: ESCALATED** — folded into F1's question rather than asked twice; F1 option (a) is the
one that reduces this for future PRs instead of only for this one.

## WHAT I DID NOT DO

- **Did not merge, relabel or touch #2034 or #2038.** Both carry `do-not-merge`; only Marco removes
  it. #2038's CP-26 token reads `[LABEL_PRESENT]` — parked by design, not work, and there is no
  agent-side action behind it.
- **Did not merge #2036**, for the reason in F1. Confirmed green and mergeable, then stopped.
- **Did not arm anything.** 26 HOLD prompts, 0 armed; F6 records why this run left it there.
- **Did not run `enable-automerge.ps1`**, because it selects across the whole open board and #2036
  is Marco's.
- **Did not restart the watcher, prune a worktree, or clear a lock.** No WEDGED/DOWN verdict. The
  orphaned `C:/PR-Master/worktrees/po-vg` **holds 1 uncommitted file** (`--force` would discard it)
  and `C:\po-worktrees\po-fix-2005` is a registry escapee — both are **Station 03's** lane, both
  named here for it, and neither is mine to prune.
- **Did not discharge any `needs-marco/` file.** Section 5 produced **zero** `[STALE]` rows this
  run, so there was nothing dead to move. The backlog stands at 61 and none of it was tagged dead.
- **Did not archive any breadcrumb.** Ten sit at depth 1; the current cycle stays in the root, and
  moving other runs' files is a separate concern from dispositioning their findings, which is done
  here.
- **Did not fast-forward the dev tree** (F7), and did **not** `git checkout .` / `reset --hard` /
  `stash pop` / `git clean` anywhere — §9.2, consumed prompts come back armed.
- **Did not commit on `main`,** and did not commit from the dev tree at all. Everything this run
  committed went onto a branch in a disposable worktree off `origin/main` (BOARD DRIVING condition 2).
- **Did not run `git` through the device bridge against the Windows `.git`** after the guard was
  installed; the two read-only calls that preceded it are disclosed in GROUND and left no lock.
- **Did not diagnose any red from the diff or the PR page.** #2038's CP-26 verdict came from
  column 3 of the job log; #2034's is stated `[CANNOT MEASURE]` rather than inferred from #2038's.
- **Did not touch Azure, Entra or SharePoint,** did not write production data, did not touch `/sot/`,
  and did not do 03's, 04's or 05's work.

---

**Sweep note:** this breadcrumb is committed **inside this run's own PR**, so there is no untracked
copy in the dev tree for `sweep-breadcrumbs.ps1` to collect and none to block the next fast-forward.

**ADDENDUM — #2035 read back to `main`, 08:28:59Z.** WHAT CHANGED item 3 is now closed:
`gh pr view 2035 --json state,mergedAt` → `{"state":"MERGED","mergedAt":"2026-09-21T08:28:59Z"}`.
Native auto-merge landed it once the re-run CI went green, with no further intervention. **This run
merged three PRs — #2031, #2037, #2035 — and every one is read back as MERGED on `main`, not as
"auto-merge enabled".**

**Validator, quoted rather than claimed:**
`node scripts/pipeline/check-breadcrumb.mjs <this file>` → `ADMIT`, `structure: 11 checked, 0
malformed`, `CLEAN`, **exit 0**. That is `check-breadcrumb.mjs`, not `lint-prompt.mjs`, whose verdict
on a breadcrumb carries no information in either direction.

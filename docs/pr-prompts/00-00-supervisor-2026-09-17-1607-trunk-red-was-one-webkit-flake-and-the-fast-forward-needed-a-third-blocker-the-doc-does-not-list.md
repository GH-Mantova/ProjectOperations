# Station 00 — Supervisor | 2026-09-17T16:07:54Z–2026-09-17T16:28Z

## GROUND

```
UTC            2026-09-17T16:08:31Z
origin/main    4dde77b8               (git fetch origin +refs/heads/main:... then git rev-parse, in the dev tree)
dev tree       main @ a2f5e8a6  ->  4dde77b8   C:\ProjectOperations2   (2 behind at open; converged this run, F-2)
doc version    1                      docs/pipeline/stations/00-supervisor.md front matter
bootstrap      1                      scheduled-task SKILL.md `station_doc_version: 1`
```

Doc version and bootstrap **agree**. The mismatch clause did not fire; this run was not read-only.

Sighted run. All three binding documents were read in full from `git show origin/main:<path>` **in the
dev tree** (PREFLIGHT step 2), never from the working copy — which mattered, because the working copy
was two commits behind for the first eleven minutes of this run.

## WHAT I MEASURED

**[MEASURED] PREFLIGHT 1 — the box is reachable.** `ToolSearch` keyword load first (never a literal
`select:` of assumed ids), then `start_process` shell `powershell.exe`:
`HOSTPROOF=2026-09-18T02:08:14.5793221+10:00`. Not blind.

**[MEASURED] vm-git-guard installed, exit 0.** Installer's last line, quoted as the contract requires:

```
vm-git-guard installed at /sessions/compassionate-stoic-curie/.local/bin/git - refuses mounted paths and mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

No `git` was run through the device bridge against the Windows `.git` at any point. No `index.lock`
was created by this run.

**[MEASURED] Session mounts: FOUR, not eleven.** `/sessions/<id>/mnt/` holds `ProjectOperations2`,
`PR-Master`, `outputs`, `uploads`. **`po-watcher` is NOT mounted this session**, so the clone-side
reads that `STATION-CAPABILITIES.md` §3 says a blind run can reach were only available here through
Desktop Commander. Enumerating the mounts rather than assuming them is that section's own rule.

**[MEASURED] PREFLIGHT 4 — `status-sweep.ps1` ran, 385 lines, all of section 0's positive controls
PASS** (`gh` reached GitHub, saw merged #2008; `node` runs). No `[BROKEN]`. Sections 0–5 were read in
full. ⚠️ **The sweep's own sections 6 and 7 did not appear in the buffer** — the stream ended at
section 5 with `0 remaining`. So I have **no `SAFE / CAUTION / DO-NOT-ACT` verdict line from this
run**, and I did not invent one: every mutation below is instead justified against section 3's raw
signals, which were read and are quoted.

**[MEASURED] Section 3, the safe-to-act signals, at 16:09:37Z.** `index.lock` interactive/clone
`False / False`; git processes touching our trees (scoped) **0**; watcher build in flight **none**
(newest heartbeat tick 27.7 min old, ticks are 60 s apart during a build); **no PR touched on GitHub
in the last 2 min**. Single-actor condition met at the moment of measurement. ⚠️ `[LIVE]` means *true
when measured*; the board was re-read immediately before and after every action below.

**[MEASURED] The board: three open PRs, and all three are PARKED ON MARCO. There is nothing here to
merge and nothing here to fix.** Per PR, from `gh pr view --json labels,mergeStateStatus` and from the
§10.1 step-1 lane probe (`processed/pr-*.log`, `rev-*` excluded):

| PR | label | watcher verdict | prompt-log hits |
|---|---|---|---|
| #2005 | `do-not-merge` | `{"ok":false,"marco":true,...,"reason":"escalates:true — held for Marco, labelled do-not-merge"}` | 2 |
| #2002 | `do-not-merge` | same | 2 |
| #1998 | `do-not-merge` | same | 2 |

NEGATIVE control, `PR #999995` over the same corpus → **0**. All three are watcher-opened (step 1
satisfied, not step 2), and **RULE 2 binds absolutely**: only Marco removes the label.

**[MEASURED] Their "13 pass / 2 fail" is CP-26 firing twice from one cause, and it is PARKED BY
DESIGN.** DOCTRINE §9.4 says read the **verdict token**, never the pass/fail counts. Column 3 of the
`Approval receipt (CP-26)` job log on #2005 (run `35242326446`, job `105273628159`, 224 lines, split on
tab and searched in the last column per §9.1):

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.
```

`[LABEL_PRESENT]` — **not** `[RELEASED_NO_RECEIPT]`. Nothing to do. The second red is the same check
running as a step inside `PR gates — diff checks`. Every other check on all three PRs is green,
including `tendering-e2e`.

**[MEASURED] COLLECT: nothing new since the previous run.** `check-breadcrumb.mjs --freshness` →
`CLEAN`, exit 0, structure 4 checked / 0 malformed. Crossed against `lastRunAt` from the
scheduled-tasks MCP, which is the instrument `--freshness` cannot replace:

| station | newest breadcrumb | `lastRunAt` (MCP) | reading |
|---|---|---|---|
| 00 | 2026-09-17T15:08Z | **2026-09-17T16:07:54Z** (this run) | aligned |
| 03 | 2026-09-16T23:02Z | 2026-09-16T23:01:15Z | aligned, daily cron `0 9 * * *` |
| 04 | 2026-09-17T14:10Z | 2026-09-17T14:09:32Z | aligned |
| 05 | 2026-09-17T14:11Z | 2026-09-17T14:10:38Z | aligned |

Four ENABLED tasks; `weekly-security-audit` reads `enabled: false`, consistent with the 2026-09-15
correction in `STATION-CAPABILITIES.md` §1. No station is SILENT and none is fresh-without-a-breadcrumb.
The 09-17 **1409** (00, blind), **1410** (04) and **1411** (05) breadcrumbs were already collected and
dispositioned by the 15:08Z run and landed in **#2008**; I did not re-disposition them. My collect
window opens at 15:08Z and **no breadcrumb has been written into it**.

⚠️ `check-breadcrumb.mjs`'s `CADENCE` map still reads `'00': 2` against a live cron of `5 * * * *`
(hourly) — the open defect recorded in `STATION-CAPABILITIES.md` §6. Its `ok` for station 00 is
therefore weaker than for any other row, which is exactly why the `lastRunAt` cross-check above is not
optional. Unchanged this run; it is a `scripts/` fix and outside my lane to merge.

**[MEASURED] `needs-marco/` 57 files; section 5 produced ZERO `[STALE]` rows this run.** Every row is
the benign `cites #N (MERGED) as evidence — not its premise` shape. The eleven dead PR-scoped
escalations recorded on 2026-09-10 are gone; there is no discharge work waiting at this station.

**[MEASURED] The clone-dirty warning is the known false one, plus its already-recorded third file
class.** `git status --short` in the clone → **4**; `git status --porcelain --untracked-files=no` →
**0**. The four are `?? docs/pr-reviews/pr-1998-review.md`, `pr-2002-review.md`, `pr-2005-review.md`
— review verdicts the `rev-<N>` job writes into the clone by design — and `?? scripts/pr-watcher/.conflict-notified-prs.json`.
The sweep's *"the watcher may refuse to start"* clause is false on both conjuncts (DOCTRINE §9.5).
Open as `needs-marco/sweep-clone-dirty-flag-counts-untracked-files-2026-09-10.md`; the third file class
was already recorded by #2006. Nothing new.

**[MEASURED] `docs/pipeline/sweep-rotation.json` is NOT uncommitted work.** `git diff --numstat` in the
behind dev tree showed `2	2 docs/pipeline/sweep-rotation.json`, while
`git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` returned **EMPTY**. Station 04's
rotation advance has already landed (#2008). This is DOCTRINE §9.2's *"on a tree that is behind
`origin/main`, `git status` answers a question about HEAD"* — I nearly filed a closed finding as open,
and the `origin/main`-scoped probe is what stopped it.

## WHAT CHANGED

1. **Re-ran the failed trunk job** — `gh run rerun 35241757870 --failed`. Read back: `attempt` 1 → **2**,
   `status` `in_progress`. (F-1.)
2. **Fast-forwarded the dev tree** `a2f5e8a6` → **`4dde77b8`**, clearing three blockers. Read back all
   three: `rev-list --left-right --count HEAD...origin/main` = `0	0`, `git diff --numstat` = EMPTY,
   `git diff --cached --name-status` = EMPTY. `.arming-log.txt` **21750 bytes before and after** —
   no append-only row was lost. (F-2.)
3. **Deleted one untracked duplicate breadcrumb** from the dev-tree queue root, after proving its bytes
   are published on `origin/main` under `archive/` (`6b4d80c9…` on both sides). Falsifying probe run
   after the delete: `--freshness` still `CLEAN`, exit 0, station 00 still `ok` — the de-dup did not
   make any station read SILENT. (F-2.)
4. **This breadcrumb**, written inside this run's own PR worktree (cure 1), so no loose copy is left in
   the dev tree for the next run to trip over.

**Nothing was armed, labelled, closed, or merged. No `/sot/` edit. No commit on `main`. No `git` in the
watcher clone. Nothing Azure / Entra / SharePoint.**

## FINDINGS

### F-1 — The trunk red on `4dde77b8` is ONE webkit Playwright flake out of twenty tests, not a regression — and the sweep's `TRUNK IS RED` headline is correct this time, which is itself worth saying

DOCTRINE §9.5 records that the sweep's trunk verdict counts every run attributed to `origin/main`'s
head, so a single `Dependabot Updates` failure flips the headline. **That is not what happened here.**
Re-derived from the source per that bullet, `gh run list --commit <full 40-char SHA> --json
conclusion,name,event,workflowName` (full SHA per §9.4, `-R` per the CWD bullet, exit 0):

| workflow | event | conclusion |
|---|---|---|
| `Tendering Browser Smoke` | `push` | **failure** |
| `CI` | `push` | success |
| `Deploy` | `push` | success |
| `CodeQL` | `dynamic` | success |
| `Claude Code` | `issue_comment` | skipped |

No Dependabot run on this commit at all. Applying #1852's denylist (`workflowName -eq "Dependabot
Updates" -or event -eq "schedule"`) removes nothing, so the fix that is open for that false alarm would
**not** have suppressed this one. The red is a real trunk check.

**Root cause, read from the job log and never from the diff** (run `35241757870`, job `105271742818`,
step 14 `Run Tendering browser smoke`):

```
1) [webkit] › tests/e2e/tendering.spec.ts:54:7 › Register view exposes stats bar + search + filter chips
   Test timeout of 60000ms exceeded while running "beforeEach" hook.
   Error: locator.waitFor: Test timeout of 60000ms exceeded.
     - waiting for getByRole('heading', { name: 'Home' }) to be visible
     at loginWithStoredState (tests/e2e/pr-acceptance/helpers.ts:89:53)
1 failed / 19 passed (2.6m)
```

It is a login-navigation timeout in `beforeEach`, not an assertion about the page under test.

**Why flake and not defect — four independent signals, and they agree:**
- **19 of 20 passed**, including the identical spec on chromium and firefox.
- The failing webkit test took **1.1 m** where chromium took 5.7 s and firefox 8.5 s on the same spec —
  the signature of a resource-starved runner, not of a broken page.
- **Four `Tendering Browser Smoke` runs were in flight in the same five minutes** (the main push plus
  #1998, #2002, #2005).
- **POSITIVE CONTROL, and it is the load-bearing one:** the same workflow on the same content
  **succeeded three times within five minutes of the failure** — `35242107693` (15:43:41Z),
  `35242111234` (15:43:43Z), `35242326544` (15:45:41Z) — and the preceding push to `main`,
  `35239563897` on `10a4a0c1` at 15:20:15Z, also **succeeded**.

Station 00's rule 5 names exactly this: a setup/network flake is transient; re-run before diagnosing a
defect. ⚠️ **`gh run list --workflow ... --branch main` is not usable as the history instrument here** —
it returned ten runs whose newest was **2026-09-07**, omitting the 09-17 failure it was asked about
(§9.4's *"`--branch main` can be DAYS stale"*). The unfiltered `--limit 12` form returned the correct
window and is what the table above is built from.

**DISPOSITION: ACTIONED** — `gh run rerun 35241757870 --failed`, read back `attempt` 1 → 2,
`status: in_progress`. ⚠️ **The outcome of attempt 2 is recorded at the foot of this breadcrumb; if it
is still `in_progress` there, the next run must read it before treating the trunk as green — a re-run I
fired is not a re-run I verified.** If attempt 2 fails on the same single webkit test, this is no longer
transient and becomes a real defect in `loginWithStoredState` under webkit, to be fixed forward.

### F-2 — The dev tree's fast-forward needed THREE blockers cleared, and the third is a cause the station doc does not list: a breadcrumb the previous board PR RENAMED into `archive/`

The station doc's post-merge FF section names two causes — an untracked breadcrumb your PR *added*, and
`sweep-rotation.json` left dirty by Station 04. Both fired. **A third fired after them, and it is
generated by the archiving step the same document prescribes.**

| # | blocker | git's refusal | why |
|---|---|---|---|
| 1 | two untracked breadcrumbs at the queue root | `untracked working tree files would be overwritten` | #2008 landed them as **tracked**; the FF must create those paths |
| 2 | `docs/pipeline/sweep-rotation.json` | `local changes ... would be overwritten` | modified vs **HEAD** while **identical to `origin/main`** |
| 3 | `…-1316-…md` at the queue root | `local changes ... would be overwritten` | #2008 **renamed** it into `archive/` (git reports `rename … (100%)`), so the FF must *delete* the root path — and the dev tree held a differing copy there |

**Blocker 3 is the one worth recording.** The doc's §"AND ARCHIVING ONE LEAVES THE SAME UNTRACKED COPY"
covers the case where the dev tree's copy is *untracked*. Here it was **tracked at the behind-HEAD** and
became a modification the moment it was restored, because the stored blob is LF and the checkout smudges
to CRLF. Measured: `git diff --numstat` read **EMPTY** while `git update-index --refresh` reported
`…-1316-….md: needs update` and the FF still refused — two instruments, opposite answers, neither
warning. That is §7's shape sitting inside the cure written for §7.

**The cure, and it is additive rather than clever:** the root copy's bytes were already published on
`origin/main` under `archive/` — `git rev-parse origin/main:<archive path>` and `git hash-object <local
root copy>` both returned `6b4d80c9094f2abbcb9481faca3583f1c4fa503a`. With the content provably safe,
deleting the root copy removes the local change the FF was refusing over, and the FF then performs the
rename itself. It did: `Updating a2f5e8a6..4dde77b8`, 8 files, including
`rename docs/pr-prompts/{ => archive}/…-1316-….md (100%)`.

**Every step was §9.2-safe.** No `git checkout .`, no `checkout -- <path>`, no `reset --hard`, no
`stash pop`, no `git clean`. File restores were `git show <ref>:<path>` piped to a node write; the one
index-only undo used `git restore --staged`. Read-backs: `0	0` / EMPTY / EMPTY, `.arming-log.txt`
**21750 bytes before and after**, and `armed: 0` before and after.

⚠️ **The cost of the tree being behind was a false finding I nearly filed, and it is the reason this was
worth eleven minutes.** `git ls-files docs/pr-prompts` in the behind dev tree reported the 1409 and 1410
breadcrumbs as tracked at **0** paths, which reads as *"two station findings have reached nobody"* — the
exact premise that produced the duplicated-basename defect of 2026-09-07. Re-asked against
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` (trailing slash and `-r`, per §9.2) both
returned **1**, and the 1316 one returned its `archive/` path. NEGATIVE control, a needle minted this
run, `zzQq00Needle20260917T1615.md` → **0**.

**DISPOSITION: ACTIONED** — dev tree converged to `4dde77b8` with all three read-backs passing; the
duplicate root copy de-duplicated; falsifying probe (`--freshness` after the delete) still `CLEAN`,
exit 0, no station SILENT.

### F-3 — `check-breadcrumb.mjs --freshness` prints `is UNTRACKED … it reaches nobody` for a breadcrumb that IS published on `origin/main`, and acting on that line is how the duplicate gets made

[MEASURED] this run at 16:13Z, with `origin/main` freshly fetched five minutes earlier:

```
NOTE  00-00-supervisor-2026-09-17-1316-…md is UNTRACKED — it reaches nobody until a board PR commits it
```

That file was **published by #2008** at `docs/pr-prompts/archive/…-1316-….md`
(`git rev-parse origin/main:<archive path>` → `6b4d80c9…`, exit 0). The NOTE is emitted by the **depth-1
structure pass**, which iterates `readdirSync(DIR)` and cannot see `archive/`, while the **freshness**
pass builds `trackedSet` from `git ls-tree -r` and matches by trailing path segment and correctly counts
it (DOCTRINE §9.5 records that the two passes measure different sets). So the run that reads the NOTE
literally commits a **second** tracked copy at the root path — which is the 2026-09-07 defect, whose own
measured instance was one basename tracked at both paths with byte-identical blobs.

Nothing is empty and nothing warns: §9.6 cannot fire, because the pass answered exactly the question it
was asked, about a different set from the one its sentence names.

⚠️ **The guard already exists and I used it** — the station doc's *"before committing any breadcrumb as
unreported, ask the TRACKED SET, not the dev tree, and match by basename"*. What is missing is that the
instrument printing the warning does not carry that caveat, so the guard depends on the reader having
memorised a rule that contradicts the line in front of them.

**DISPOSITION: DEFERRED** — real, not now, and I am saying why rather than half-landing it. The correct
home is DOCTRINE §9.5, which sits inside the hash-gated `CANONICAL-BLOCK: instruments v2`; editing it
requires re-recording the block hash and shipping all seven station docs in one PR, which the station doc
itself calls more than a collect run should carry. **It becomes urgent the moment a breadcrumb is
archived while a loose root copy survives** — i.e. on any run that both archives and is followed by a
collect that reads the NOTE. **Falsifying probe:** run `--freshness` with a breadcrumb present at the
queue root whose only published copy is under `archive/`; if the NOTE does not print, this is fixed.

### F-4 — Two worktree items are 03's, not mine, and one of them holds uncommitted work that a prune would discard

[MEASURED] from the sweep at 16:09:37Z:
- `C:/PR-Master/worktrees/po-vg` — `[fix/no-rebase-while-checks-run]`, **dirty=1 file**, age **19216 min
  (13.3 days)**. The sweep's own line: *"HOLDS UNCOMMITTED WORK. PRESERVE OR COMMIT BEFORE PRUNING;
  `git worktree remove` will refuse, and `--force` would discard it."*
- `C:\po-worktrees\po-fix-2005` — registry escapee, size **0 KB**, age **31 min**, `.lock=False`. New
  since the previous run; consistent with #2005's build.

Both already have paper: `needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`
and `needs-marco/status-sweep-prune-warning-ignores-unpushed-commits-2026-09-17.md`. I did not list,
inspect, or prune either — `git status --short` in a worktree I do not own is 03's step, and deleting
13 days of unpushed work is irreversible (DOCTRINE §5.4).

**DISPOSITION: DISPATCHED** — to **Station 03 (machine-minder)**, whose next occurrence is
`2026-09-17T23:00:45Z` per the MCP. Hand-over, precisely: run `git -C C:/PR-Master/worktrees/po-vg status
--porcelain` and report the one dirty file before anything else; confirm `C:\po-worktrees\po-fix-2005` is
dead (0 KB, no lock, no live build) and prune only that one. **`po-vg` is not to be pruned by anyone
until its uncommitted file is preserved** — that is the escalation, not the cleanup.

## WHAT I DID NOT DO

- **Armed nothing.** `armed: 0` at open and at close, deliberately. All three open PRs are already parked
  on Marco behind `do-not-merge`, and the archived finding this pipeline has already paid for is exact:
  *"the board grows monotonically until Marco merges; arming faster makes the queue longer, not shorter."*
  Adding a fourth PR to a queue of three that only he can clear buys nothing, and the trunk was red when
  the decision point arrived. **This is a judgement, not a gate** — nothing forbade an arm.
- **Merged nothing, and removed no label.** All three PRs carry `do-not-merge` **and** a genuine watcher
  `marco:true` verdict. §10.1 step 1 runs first and wins; only Marco removes the label.
- **Did not treat the three PRs' two red checks as work.** `[LABEL_PRESENT]` is parked by design, and
  §9.4 records that three consecutive collect runs have listed such PRs among "the reds".
- **Did not re-disposition the 1409 / 1410 / 1411 breadcrumbs.** #2008 collected them at 15:08Z. Acting
  on a signal twice is the thing the collect contract forbids.
- **Did not touch the `check-breadcrumb.mjs` `CADENCE` map** (`'00': 2` against an hourly cron). One
  character, but `scripts/` is outside this station's merge lane; already filed for Marco.
- **Did not run `git` through the device bridge against the Windows `.git`**, did not `git checkout` /
  `commit` / `push` in `C:\po-watcher\ProjectOperations`, did not edit `/sot/`, did not commit on `main`,
  and came nowhere near Azure / Entra / SharePoint.
- **Did not claim a sweep SAFE/CAUTION/DO-NOT-ACT verdict.** Sections 6–7 never reached the buffer; I
  said so and justified each action from section 3's raw signals instead of inventing the line.
- **Did not validate this file with `check-breadcrumb.mjs` before writing it** — the result of that run is
  recorded below; do not read `breadcrumb-clean` into this file without it.

---

## RE-RUN OUTCOME (the one open read-back in this report)

`gh run rerun 35241757870 --failed` was fired at 16:16:48Z. At 16:22:5xZ the run read
`{"attempt":2,"conclusion":"","status":"in_progress"}` — the `tendering-e2e` job takes ~5 minutes and
the run had not settled when this breadcrumb was committed.

🔴 **This is an ACTIONED disposition with a verified ACTION and an UNVERIFIED RESULT, and the difference
matters.** The next Station 00 occurrence must read it before saying anything about the trunk:

```
gh run view 35241757870 -R GH-Mantova/ProjectOperations --json status,conclusion,attempt
```

- `conclusion: success` → F-1 confirmed transient, trunk green on `4dde77b8`, nothing further.
- `conclusion: failure` on the same single `[webkit] tendering.spec.ts:54` test → **no longer a flake.**
  It is a real defect in `loginWithStoredState` (`tests/e2e/pr-acceptance/helpers.ts:89`) under webkit,
  and rule 5's *"only treat a red as a real defect after a clean re-run still fails"* has then been
  satisfied. Fix it forward; do not re-run a third time.

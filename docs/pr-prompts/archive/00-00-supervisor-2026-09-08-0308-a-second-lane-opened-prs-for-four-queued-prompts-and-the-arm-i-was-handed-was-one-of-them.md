# Station 00 — Supervisor | 2026-09-08T03:09Z–2026-09-08T04:0xZ

## GROUND

```
UTC            2026-09-08T03:09:10Z
origin/main    0029fcdf            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 0029fcdf     C:\ProjectOperations2   (rev-list --left-right --count = 0	0)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE — this run was not restricted to read-only on that account.

**SIGHTED.** `ToolSearch` was run first (a validation error is not blindness); the keyword query
`desktop-commander process shell` returned the toolkit, and `start_process` shell `powershell.exe`
succeeded (pid 31872). The immediately preceding run at 02:08Z was **BLIND** — this one is not.

VM git guard, last line quoted as the contract requires:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
— installed at `/sessions/<id>/.local/bin/git`, both controls passed, exit 0.

**Which tree the binding documents were read in:** the DEV tree, never the clone.
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY**, so the working copies read this run are
byte-identical to `origin/main`. No piped hash was taken (PREFLIGHT step 2). All three were read in
full: `00-supervisor.md` 1299 lines, `DOCTRINE.md` 1751, `STATION-CAPABILITIES.md` 459.

## WHAT I MEASURED

**Safe-to-act, three times, and the verdict changed underneath me.** [MEASURED]
`status-sweep.ps1` run via `-File` and captured to a file (it returns early and hides its own §7
verdict when read inline):

| sweep | UTC | open PRs | §7 verdict |
|---|---|---|---|
| 1 | 03:11:07Z | **2** (`#1802 #1803`) | `SAFE TO ACT` |
| 2 | ~03:36Z | **4** (`+#1804 #1805`) | **`DO NOT ACT`** — 1 git process running, `#1803` touched inside 2 min |
| 3 | ~03:5xZ | 4 | `SAFE TO ACT` — 0 git processes, no PR touched in 2 min |

Section 0 positive controls passed on all three (`gh CAN reach GitHub`, `node runs`); no `[BROKEN]`.
Watcher node **RUNNING pid 31660**, wrapper alive, heartbeat 0 min, build in flight
(`rev-1803` then `rev-1802` — review jobs, reported and not a block signal).

**Real armed = 0.** [MEASURED] the sweep's `armed: 2` then `3` counts `rev-*-ready.md`, which are
auto-generated REVIEW JOBS and not prompts (§9.5). Filtering them out:
`Get-ChildItem docs\pr-prompts -Filter *-ready.md | ? { $_.Name -notlike 'rev-*' }` → **0**.

**Lane classification for all four open PRs.** [MEASURED] RULE 2's only probe, written without a
quote character, pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed` and never
the clone: **2068** logs, newest `2026-09-08T03:15:35Z` — younger than every open PR's `createdAt`,
which is the freshness control that separates the live directory from the 17-day-stale decoy.
POSITIVE control `marco.:true` → **620**; NEGATIVE control, freshly minted needle → **0**;
NEGATIVE control `PR #999999` over `pr-*.log` → **0**.

`#1802` → **0**, `#1803` → **0** in `processed\pr-*.log` (excluding `rev-*`, which carry zero lane
information). `NO LOG` ⇒ `[CANNOT MEASURE]` from that probe alone, never ⇒ second lane. **Corroborated
by two instruments the kill loop cannot erase:** `.arming-log.txt`'s last entry is
`2026-09-07T23:32:16Z ARMED pr-doctrine-s9-powershell-readonly-automatic-variables` — **no arm inside
any of the four PRs' windows**, so no watcher build could have started; and the PRs were created
**25 seconds apart** (`03:05:18Z`/`03:05:43Z`) and **10 seconds apart** (`03:12:27Z`/`03:12:37Z`),
which the single-lane watcher cannot do.

**`[NO LANE VERDICT — hand-classified]`, by `classifyPolicyFiles`, all four MARCO'S:**

| PR | first path outside the three `NESTED_TEST_PATHS` forms | verdict |
|---|---|---|
| `#1802` | `apps/api/src/modules/crm/reminders/comms-reminder-escalation.service.ts` | MARCO'S |
| `#1803` | `apps/web/src/components/rates/FilterableRateGrid.tsx` | MARCO'S |
| `#1804` | `.github/workflows/ci.yml` | MARCO'S |
| `#1805` | `scripts/pipeline/triage-holds.ps1` | MARCO'S |

All four carry **0 labels** — and Marco removing or never applying `do-not-merge` does NOT clear
RULE 2. All four read `BLOCKED` with checks still pending. **Nothing was mergeable by this station
and nothing was merged.**

**COLLECT — two breadcrumbs, both genuinely unreported.** [MEASURED] before treating either as
unreported I asked the TRACKED SET rather than the dev tree, matching by basename:
`git ls-files docs/pr-prompts` → **0** hits for each of the 0208 and 0210 basenames, against a
POSITIVE control that found the 0108 breadcrumb tracked at `docs/pr-prompts/…0108….md` (it landed in
`#1801`). So neither is the already-archived-and-re-committed shape.

`check-breadcrumb.mjs --freshness` → `CLEAN`, exit **0**; `structure: 3 checked, 0 malformed`; all
five stations `ok`. ⚠️ Its `00 … (cadence 2h)` row is the known `CADENCE` map defect — the live cron
is `5 * * * *`, hourly — so a green `ok` is a weaker statement about `00` than about any other
station. Crossed against `lastRunAt` as the contract requires: `00` 02:08:36Z, `04` 02:10:15Z,
`03` 2026-09-07T23:01:27Z, `05` 2026-09-07T14:11:15Z — `03` and `05` are daily stations inside their
own intervals, so neither is silent and neither is in the started-and-died shape.

## WHAT CHANGED

**One board PR, built in an isolated worktree off `origin/main`** (`C:\po-wt\bd0308`, branch
`chore/00-collect-20260908-0308`), torn down at the end of the run. It carries:

- the **0208** Station 00 breadcrumb (blind run) and the **0210** Station 04 breadcrumb, both
  untracked in the dev tree until now;
- the **0108** breadcrumb `git mv`-ed to `docs/pr-prompts/archive/` — every finding in it carries a
  disposition;
- `docs/pipeline/sweep-rotation.json`, which Station 04 advanced (`last_index=2`) and may not commit
  itself. Without this the rotation stops turning and 04 repeats repo-hygiene next run;
- **48 review verdicts** from `docs/pr-reviews/`, untracked for up to five days (04's F3);
- this breadcrumb, written **inside the worktree** so no loose copy is left in the dev tree — cure 1
  of the post-merge fast-forward rule, which avoids the trap rather than paying for it.

**NOTHING ELSE.** No arm, no disarm, no merge, no label, no unlabel, no `sot/` edit, no branch
deleted, no worktree removed, no stash dropped, no watcher restart. `.arming-log.txt` is unchanged
because nothing was armed.

## FINDINGS

### F1 — A second lane opened PRs for FOUR queued prompts inside seven minutes, and none of them consumed its prompt

This is §10.6 at four simultaneous instances. The previous record was two.

[MEASURED] the §10.6 cross-check in its post-2026-09-07 corrected form — a `scope:` entry ending in
`/` matched as a PREFIX, any overlap ≥ 1 treated as a CANDIDATE and never a verdict — run over all
**39** depth-1 `-HOLD.md` against all **4** open PRs. `scope:` parsed on 39 of 39, **0 unparsed**, so
the denominator is the real board. POSITIVE control: a PR's own file matches itself. NEGATIVE control:
a freshly minted path matches nothing. **Six candidates; confirmed on the prompt's own MARKER STRING
and slug, never on the head branch alone:**

| `-HOLD.md` prompt | overlap | PR | PR head branch | verdict |
|---|---|---|---|---|
| `pr-tr-s3-manager-escalation` | **4/4** | `#1802` | `tr-s3-manager-escalation` | **TRUE duplicate** |
| `pr-linefields-s4-scenario-picker` | **6/6** | `#1803` | `linefields-s4-scenario-picker` | **TRUE duplicate** |
| `pr-ci-gate-dead-queue-dir-reads` | **2/2** | `#1804` | `ci-gate-dead-queue-dir-reads` | **TRUE duplicate** |
| `pr-triage-holds-open-pr-duplicate-bucket` | **1/1** | `#1805` | `triage-holds-open-pr-duplicate-bucket` | **TRUE duplicate** |
| `pr-rates-column-edit-ui` | 3/3 | `#1803` | — | **false positive** |
| `pr-tipid-s3-retire-the-name-guard-for-an-id-check` | 1/5 | `#1804` | — | **false positive** |

The two false positives are exactly the shapes §10.6's correction predicts, and the marker test
settled both: neither prompt contains any `*_V<n>` marker at all, and `#1803`'s own markers
(`RATE_SCENARIO_PICKER_V2`, `RATE_FIELDS_TABLE_V2`) appear in neither. `pr-rates-column-edit-ui`
merely shares three files with `#1803`; `pr-tipid-s3` overlaps on `.github/workflows/ci.yml` alone,
the single-shared-common-file case whose precision is zero by construction.

🔴 **All four true duplicates still lint `ADMIT` and still read as fresh work**, because the premise
dies on MERGE, not on OPEN. Any run that arms one opens a SECOND PR for work already open — and all
four are Marco's, so the duplicate would sit on his desk rather than auto-merging away.

**DISPOSITION: ACTIONED** — none of the four was armed, and the measurement is recorded here with its
controls so the next run does not re-derive it. `#1805` is the automation for exactly this check; once
it merges, `triage-holds.ps1` reports the bucket itself and this hand-run becomes unnecessary.

### F2 — The arm I was handed became a duplicate between my duplicate-check and my arming window, and only the mandated re-sweep caught it

The 02:08Z blind run identified `pr-triage-holds-open-pr-duplicate-bucket-HOLD.md` as the next arm,
did the preparation, landed the enabling correction in `#1801`, and deferred the arm to the next
sighted run *"with the arming decision already made and the prerequisites already satisfied"*.
This is that run, and **the decision was overtaken by events in the twenty minutes it took to verify it.**

[MEASURED] RULE 4's detector ran clean at ~03:2xZ: `lint-prompt.mjs` → **ADMIT**, exit **0** (not
`HUMAN_GATE_PRESENT`, not `GATE_NOT_RELEASED`, not SPENT — the code was read, not the exit code
alone). The three-marker union grep returned **0 / 0 / 0**, confirming `#1801`'s repair of this
prompt's own documented false positive holds. Premise alive: `git grep -c OPEN_PR_DUPLICATE_V1
origin/main -- scripts/pipeline/triage-holds.ps1` → exit **1** (ABSENT), against a POSITIVE control
`GATES SATISFIED` → **1** on the same file and a NEGATIVE control that failed loud. Real armed = 0,
so RULE 4's one-at-a-time was satisfied. **Every gate said arm it.**

🔴 **The §10.6 duplicate cross-check is only as fresh as the board snapshot it runs against, and
nothing in the arming path re-takes that snapshot.** My cross-check ran against sweep 1's board of
**two** PRs. `#1805` was created at **03:12:37Z** — after that snapshot, before my arm. Its head
branch is the prompt slug byte-for-byte, its single file is the prompt's sole `scope:` entry (1/1),
and its body carries the prompt's own marker `OPEN_PR_DUPLICATE_V1`. Three independent confirmations,
all of which a stale board listing is blind to.

**What caught it was the contract, not judgement:** *"re-run `status-sweep.ps1` immediately before
every board mutation, because the verdict expires the moment it prints"*. Sweep 2 returned
`DO NOT ACT` **and** a board that had grown 2 → 4. Had I treated sweep 1's `SAFE TO ACT` as still
current — the `[LIVE]` trap in its purest form — the arm would have gone through and opened a fifth
PR duplicating an open one.

🔧 **The gap, stated precisely: `status-sweep.ps1` re-takes the safe-to-act verdict but does NOT
re-run the §10.6 scope cross-check**, so a run that obeys the re-sweep rule to the letter can still
arm a duplicate if it computed its duplicate-check against the earlier board. The two instruments
must be re-taken together, immediately before the `git mv`.

**DISPOSITION: DEFERRED**, deliberately and with the successor named. `#1805` moves this check inside
`triage-holds.ps1`, which is the right home — but it does not by itself fix the FRESHNESS gap, because
a run may still invoke `triage-holds.ps1` early and arm late. The complete-and-additive fix is to put
the cross-check inside `arm-prompt.ps1` itself, where it cannot be separated from the mutation it
guards: the primitive re-reads the open board at the moment of the `git mv` and refuses on any
confirmed overlap. That is a `scripts/` change, so it wants its own prompt, and staging it while
`#1805` is open would be this very finding's own mistake. **It becomes urgent the moment `#1805`
merges** — that is the run that should stage it, against a board where the prompt is consumed.
⚠️ **Falsifying probe:** re-run the cross-check twice around any arming window. If the two boards are
ever identical across a run that takes more than a few minutes, this gap is theoretical rather than
live — it was not theoretical today.

### F3 — `C:\po-vg` is safe to remove, and Station 04 supplied the measurement the standing escalation lacked

04's F1, dispatched to me. It hashed the one uncommitted file rather than looking up its name:
`git hash-object C:\po-vg\scripts\pipeline\check-pipeline-heartbeat.mjs` → `9c4587fb…` against
`git rev-parse origin/main:<same path>` → `84ec92d4…`, with a NEGATIVE control that failed loud. The
diff runs one way only — `main` strictly supersedes, the extra content having landed in `992b2479`
(`#1594`) thirteen hours after `po-vg`'s copy was last written. So the worktree holds a **superseded
draft** and nothing unique.

**DISPOSITION: DISPATCHED to Station 03**, which owns worktrees and local trees. The action is
`git -C C:\ProjectOperations2 worktree remove C:\po-vg`, and 04's hash pair is the evidence that it
destroys nothing. I did not run it myself: removing a worktree is 03's lane, and doing another
station's job is LL-38. ⚠️ 03 should re-take the hash pair before removing — it is the falsifying
probe, and the file has now been sitting for 5478 minutes during which anything could have written it.

### F4 — 48 untracked review verdicts, and no script or workflow on `origin/main` names the directory that holds them

04's F3, dispatched to me. [MEASURED] `git status --porcelain -- docs/pr-reviews` → **48** untracked,
oldest 2026-09-03, newest `pr-1758-review.md`. The folder is **not** gitignored; these are ordinary
untracked files. 04's systemic half is the part that matters: `git grep -l "docs/pr-reviews"
origin/main -- scripts/ .github/` returns 11 files and **`sweep-breadcrumbs.ps1` is not among them**,
against a POSITIVE control of 49 files for `docs/pr-prompts`. Nothing commits them on purpose — the
same shape §9.5 records for `.arming-log.txt`, where the gap closes and re-opens by luck.

This is not tidiness. `verdictApproves` reads its verdict at `docs/pr-reviews/pr-<N>-review.md`, and
the watcher launcher's preflight stash is `--include-untracked`.

**DISPOSITION: ACTIONED for the 48 — they are committed in this run's board PR.** The systemic half
is **DEFERRED**: widening `sweep-breadcrumbs.ps1` to `docs/pr-reviews/*.md` is a `scripts/` change and
wants its own prompt, which I am deliberately not staging while four second-lane PRs are open and the
duplicate-check instrument (`#1805`) is itself unmerged. It becomes urgent if a verdict is ever lost
to a stash — the loss would be silent and unrecoverable.

### F5 — Eight stale remote heads, and `fix1483` reads as unlanded work to every reader who does not repeat 04's probe

04's F2, already **ESCALATED** by 04 with a file at
`needs-marco/stale-remote-heads-and-auto-delete-2026-09-08.md` (gitignored, so 04's breadcrumb — now
committed by this PR — is the tracked copy of the ask). Branch deletion is on §5's irreversible list
and enabling *Automatically delete head branches* is a repository setting, so no station does either.

**DISPOSITION: ESCALATED** — unchanged, not re-raised, and now durably on `main` rather than only in a
gitignored folder on one box. RULE 1 order stands as 04 put it: **(a)** enable auto-delete *and* clear
the seven spent heads once — complete and additive, and recoverable in both directions; **(b)** delete
the seven and change nothing — fails the future half, the same census returns in a fortnight;
**(c)** leave them — fails the immediate half, and `fix1483` keeps reading as 28 commits of unlanded
work. `feat/crm-account360-v2-s1` (`#1612`) must NOT be deleted under any option — it is the named
subject of an open escalation and no marker probe was run for it.

### F6 — The `tests-docs` lane has no intersection with the board, and the four new PRs do not change that

The 0208 run measured **0 of 39** depth-1 HOLDs `tests-docs`-eligible across the whole board, not just
the gate-satisfied subset — which bounds every future reading from above. This run's four new PRs are
all outside `tests|docs` as well, so every arm available today still lands on Marco, and so does every
second-lane PR that arrived.

**DISPOSITION: DEFERRED** — the structural question is already Marco's
(`needs-marco/tests-docs-lane-starves-its-own-review-job-2026-09-04.md`) and is not re-raised. It
becomes urgent the moment a docs-or-tests-only HOLD appears; that run should arm it the same run.

### F7 — Blindness recurred at 02:08Z and the rate is still unmeasurable

`needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md` carries the defect.
The 02:08Z run added a clean datapoint — a 30 000 ms `CONNECT_TIMEOUT` on the MCP server itself,
reported before any tool call, taking `Prisma-Local` down in the same breath. This run was sighted
one hour later on the same box with no intervention, which is the intermittency the escalation
describes. The 0208 run's F7 remedy — a machine-readable blind/sighted token checked by
`check-breadcrumb.mjs` — is the cheap fix and remains unstaged.

**DISPOSITION: ESCALATED** — unchanged, on file, two more datapoints attached (one blind, one sighted,
57 minutes apart).

## WHAT I DID NOT DO

- **Armed nothing** — see F2. The one candidate I was handed became a duplicate of `#1805`, and the
  other three full-overlap prompts are duplicates of `#1802`/`#1803`/`#1804`.
- **Merged, labelled, unlabelled or closed nothing.** All four open PRs hand-classify as MARCO'S and
  all four were `BLOCKED` with checks pending. Removing a `do-not-merge` label is Marco's alone, and
  none of them carries one to remove.
- **Did not clear the `[STALE]` section 5 line** for `pr-1777-is-green-and-its-only-review-verdict-is-stale-2026-09-07.md`
  without reading the file. Acting on a `[STALE]` line unread is forbidden; it is left for a run with
  budget to read it.
- **Did not remove `C:\po-vg`, delete any branch, drop any of the clone's 69 stashes, or fast-forward
  the watcher clone** (7 behind). All are 03's lane or Marco's, and the clone fast-forward is itself
  an open escalation that belongs to nobody.
- **Did not restart the watcher.** `restart-watcher-if-wedged.ps1` was not needed: node RUNNING pid
  31660, wrapper alive, heartbeat 0 min, builds in flight. An idle-looking watcher with work in
  flight is BUSY, and never restarting on BUSY is the rule.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.**
- **Did not run `git` in `C:\po-watcher\ProjectOperations`**, and did not run `git` against the
  Windows `.git` through the VM mount.
- **Did not leave a loose copy of this breadcrumb in the dev tree** — it was written inside the PR
  worktree (cure 1), so the post-merge fast-forward has one fewer blocker. The 0208 and 0210
  breadcrumbs and `sweep-rotation.json` WILL block it; that is the documented two-cause cure and it
  is this run's own cleanup, recorded here in case the run is cut short.

**Needles minted and spent this run:** `zzQq00N20260908T0330`, `zzQq00N20260908T0335`,
`zzQq00N20260908T0345`. All three are now written into a tracked file and are unusable again.

---

**Validator.** `node scripts/pipeline/check-breadcrumb.mjs` — quoted in the PR. No `lint-prompt.mjs`
verdict is quoted anywhere here: it rejects breadcrumbs for having no front matter and its result on
one is not evidence in either direction.

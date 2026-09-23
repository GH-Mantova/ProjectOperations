# Station 00 — Supervisor | 2026-09-23T02:15Z–2026-09-23T02:33Z

## GROUND

```
UTC            2026-09-23T02:15:30Z
origin/main    d8e5e06a              (fetched this run, then rev-parse — not a file read)
dev tree       main @ d8e5e06a       C:\ProjectOperations2
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (scheduled-task SKILL.md station_doc_version)
```

**doc version and bootstrap AGREE (1 == 1).** No read-only downgrade. **This run was SIGHTED** —
`start_process` on `powershell.exe` succeeded and every claim below is a host-shell measurement.

## WHAT I MEASURED

**[MEASURED] Host shell reachable.** Desktop Commander loaded via keyword `ToolSearch`, then
`start_process(shell=powershell.exe)` returned PID 29392. The preceding run (01:15Z) was blind; this
one is not, so blindness did **not** persist across consecutive occurrences.

**[MEASURED] vm-git-guard: exit 2 — INSTALLED BUT INERT.** Installer's own exit code, nothing piped:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
GUARD_EXIT=2
```

Expected station outcome per the contract's three-outcome table. The ban was therefore REMEMBERED,
and it was kept: **no `git` ran against the mount this run** — every `git` call went through the
Windows shell.

**[MEASURED] Binding docs are current in the dev tree, so reading the working copy was sound.**
`HEAD == origin/main == d8e5e06a`, `git rev-list --left-right --count HEAD...origin/main` → `0 0`,
and `git diff --numstat origin/main --` for `00-supervisor.md`, `DOCTRINE.md` and
`STATION-CAPABILITIES.md` was **EMPTY**. No piped `hash-object` was used (PREFLIGHT step 2).

**[MEASURED] `check-breadcrumb.mjs --freshness` → exit 0, CLEAN.** No station SILENT:
`00` 1.0h (cadence 1h) · `03` 2.8h (24h) · `04` 4.1h (4h) · `05` 11.9h (24h). It also flagged
`00-00-supervisor-2026-09-23-0115-blind-no-host-shell.md` as **UNTRACKED** — swept into this PR.

**[MEASURED] `status-sweep.ps1` → `SAFE TO ACT`** (completed 02:16:07Z). Instrument positive controls
both passed. **Section 5 carried NO `[STALE]` escalation rows** — the eleven-row backlog the station
doc records was cleared by the 00:16Z run's `#2106`; the only `[STALE]` line was the station-summary
age notice, which is not an escalation row.

**[MEASURED] The board — three open PRs, and ALL THREE carry `do-not-merge`.**

| PR | title | mergeState | labels | CI |
|---|---|---|---|---|
| #2107 | `feat(pipeline): D-namespace S5 — flip D-register checker from warn to fail` | BLOCKED | `do-not-merge` | 13 pass / 2 fail |
| #2108 | `feat(tendering): cutting joins the card fold…` | BLOCKED | `do-not-merge` | 12 pass / 3 fail |
| #2109 | `feat(tendering): scopecards S8a — truck cycle travel-time port…` | BLOCKED | `do-not-merge` | opened 02:24:14Z, mid-run |

`main` CI on `d8e5e06a`: **4 success / 0 failed — trunk green.**

**[MEASURED] #2107's TWO failures are ONE cause, and the cause is the hold itself.** Job log
(`gh run view 35803699638 --job 106999747509 --log`), not the PR page:

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
       A human must review and REMOVE the label; removing it is what releases the merge.
```

The diff-checks job fails on the identical `CP-26 do-not-merge` line. Every other gate in that job
**PASSED or SKIPPED** (CP-11, CP-12, CP-13, CP-17, CP-23, CP-24, CP-25 pass; CP-09/10, CP-22, CP-27
skip). **#2107 is green apart from its deliberate escalation hold.** Nothing here is a defect.

**[MEASURED] #2108 has a THIRD failure that is real in kind but ALREADY FIXED IN FACT.**
`check-pr-title.mjs` failed at 01:31:27Z:

```
PR_TITLE: feat(scopecards-s7b): cutting joins the card fold on the same terms as every other section
[TITLE_SCOPE_UNRESOLVED] scope "scopecards-s7b" names nothing this repo can point at.
```

But the PR's title **now** is `feat(tendering): …`, and `tendering` resolves — `git cat-file -t
origin/main:apps/api/src/modules/tendering` → `tree`, and `origin/main:apps/web/src/pages/tendering`
→ `tree`. Four readings pin the sequence:

| probe | value |
|---|---|
| run 35806610834 created | `2026-09-23T01:31:06Z` |
| run headSha | `f40182768557ad6a7eb567028a30d6b6da965a54` |
| PR headRefOid | `f40182768557ad6a7eb567028a30d6b6da965a54` — **identical, no push since** |
| PR updatedAt | `2026-09-23T01:39:53Z` — the rename, **8 min AFTER the run** |
| `gh run list --commit f4018276…` | 4 runs, **all created 01:31:0xZ; ZERO after the rename** |

So the red on #2108's board is a **correct verdict against a title that no longer exists**.

**[MEASURED] And the gate's own prescribed cure cannot clear it.** `check-pr-title.mjs:392,410`
print `Rename the PR: gh pr edit <number> --title …`. A title edit fires the `pull_request` activity
type **`edited`** — and `.github/workflows/ci.yml:19` lists
`types: [opened, synchronize, reopened, labeled, unlabeled]`, which **does not include it**. Naming
`types:` replaces the defaults rather than extending them, as that file's own comment states. A
re-run does not help either: `gh run rerun` replays the **original** event payload, so it re-reads
the old `PR_TITLE`. Following the gate's instruction therefore leaves the check red until some
unrelated event fires. **No prior art**: a repo-wide grep over `docs/pr-prompts/`, `docs/pipeline/`
and `sot/` for this failure mode returned only one unrelated processed log.

**[MEASURED] Watcher healthy throughout, and it drained the queue during this run.** node pid
**9744** (unchanged start to finish), wrapper alive, heartbeat 0 min. At sweep time it was
`BUILD IN FLIGHT: pr-scopecards-s8a-travel-time-snapshot-b-ready.md`; by 02:24:39Z that prompt was in
`processed/` and **#2109** was open. Armed queue went `1 → 0` legitimately. No LOOP, no HANG, no new
silent no-op, no wedge. `index.lock` absent in both dev tree and watcher clone.

**[MEASURED] `C:\po-wt\dns-s5`** exists, detached at `d6552de1`, `git status --short` **EMPTY**
(clean), age ~90 min at sweep. It is the build leftover of **#2107, which is still OPEN**.

## WHAT CHANGED

1. **`.github/workflows/ci.yml`** — added `edited` to the `pull_request` `types:` list, with a
   comment recording the measurement above. One-line functional change; the surrounding comment
   block already documented the identical failure mode for `labeled`/`unlabeled` (#1510/#1511).
2. **This breadcrumb**, and **the 01:15Z blind run's breadcrumb**, committed to this PR's branch.
3. Nothing else. **No merge, no arm, no label change, no restart, no queue mutation.**

All three landed on branch `chore/ci-rerun-on-pr-edited` in an **isolated worktree off
`origin/main`** (`C:\po-wt\s00-ci-edited-trigger`), never in the dev tree — so no loose copy is left
to block the next fast-forward (REPORT CONTRACT, cure 1).

## FINDINGS

**FINDING 1 — CI cannot re-run on a title edit, so `check-pr-title`'s own prescribed cure can never
clear `check-pr-title`.**
The gate tells you to rename the PR; renaming the PR fires only `edited`; `edited` is not in
`ci.yml`'s `types:`. The cure is inert by construction, and a re-run replays the stale payload, so
the obvious fallback is inert too. This is the same class of bug the `labeled`/`unlabeled` entries
were added to fix on 2026-09-02 — one gate along, and missed then. Live proof is #2108, red right
now on a title it no longer has. RULE 1: adding `edited` is **complete** (every PR, now and future,
and it makes the documented remediation actually work) and **additive** (adds a trigger, removes
none; the existing `concurrency` block with `cancel-in-progress` for `pull_request` bounds the extra
runs). The alternative — rewriting the gate's message to say "push an empty commit" — fails the
complete half: it makes every title fix cost a commit and leaves the misleading instruction's cause
in place.
**DISPOSITION: ACTIONED** — fixed in this PR. Verified: the old block matched exactly once before
replacement (the script refused to edit otherwise), and the rendered `types:` line now reads
`[opened, synchronize, reopened, labeled, unlabeled, edited]`.

**FINDING 2 — #2108's `check-pr-title` red is STALE, not a defect, and it self-heals on release.**
The title was corrected at 01:39:53Z to a scope that resolves; no event has re-run CI since. When
Marco removes `do-not-merge`, `unlabeled` fires, CI re-runs against a **fresh** payload, reads the
current title, and this gate goes green in the same run that clears CP-26. So it needs no separate
action, and pushing a commit to a Marco-gated branch purely to refresh a cosmetic verdict would be
churn on an escalated PR.
**DISPOSITION: DEFERRED** — it becomes urgent only if the label is removed and the title gate is
**still** red afterwards, which would mean the payload refresh did not happen and FINDING 1's fix is
load-bearing for this PR too rather than merely for the next one.

**FINDING 3 — The board is not blocked by any defect. It is blocked on Marco, three times over.**
#2107, #2108 and #2109 all carry `do-not-merge`, and for all three the merge-blocking CI failure
**is** that label (CP-26 by design). Every other gate passes. I may not remove the label and may not
merge a watcher-routed PR, so there is no action available to me that moves any of them.
**DISPOSITION: ESCALATED** — see `## FOR MARCO`.

**FINDING 4 — `vm-git-guard` INERT (exit 2): the device-bridge git ban is remembered, not
mechanical.**
Unchanged from the 01:15Z run. Structural: a station's shell is non-interactive and non-login, so it
sources neither file the installer writes its `PATH` export into. Bit nothing this run.
**DISPOSITION: DEFERRED** — urgent the first time a run reports exit 2 *and* a 0-byte `index.lock`
with no owning process, which would mean the remembered ban was finally forgotten.

**FINDING 5 — The 01:15Z run was BLIND and its escalation to Marco is still open.**
That run reached no host shell (Desktop Commander `CONNECT_TIMEOUT`), collected nothing, and asked
Marco to make blindness self-alarming. New data this run: the very next occurrence was sighted, so
the condition remains intermittent rather than sustained. Its FINDING 3 asked the next sighted run
to COLLECT across a window reaching back past it — done: `--freshness` covered both breadcrumbs and
the sweep's section 5 was re-read from scratch, and nothing fell in the gap.
**DISPOSITION: ESCALATED** — carried forward unchanged to `## FOR MARCO`; it is his decision, not a
new finding, and I did not restate it as one.

**FINDING 6 — `C:\po-wt\dns-s5` is a clean detached worktree belonging to an OPEN PR.**
Clean (`status --short` empty), so nothing is at risk, but it is idle and outside
`C:\po-worktrees`. It should not be pruned while #2107 is open, and pruning is not my lane.
**DISPOSITION: DISPATCHED** → **Station 03 (machine-minder)**, which owns local trees: prune
`C:\po-wt\dns-s5` **once #2107 closes or merges**, not before, and confirm clean at prune time.

**FINDING 7 — The watcher clone is dirty on main (`dirty=2`), which the sweep flags as "may refuse
to start".**
It did not bite — the watcher ran and completed a build during this run — but a dirty clone is the
documented precondition for a refusal later.
**DISPOSITION: DISPATCHED** → **Station 03**, which owns the watcher's repo: identify the two dirty
paths and restore them the §9.2-safe way (`git show HEAD:<path>` piped to a write; never
`git checkout --`, never `git clean` — consumed prompts come back armed).

## WHAT I DID NOT DO

- **I did not merge anything.** All three open PRs are watcher-routed *and* labelled
  `do-not-merge` — two independent hard stops, either of which alone forbids it.
- **I did not remove a `do-not-merge` label** from any PR. That is the release action and it is
  Marco's; CP-26 exists precisely to make it a human act.
- **I did not re-run #2108's failed jobs.** `gh run rerun --failed` replays the original event
  payload and would re-read the stale title, so it would have burned CI minutes to reproduce the
  same red — and reporting it as an attempted fix would have been a §7 instrument lie.
- **I did not push a commit to #2108's branch** to force a `synchronize`. It would refresh the
  verdict, but on a Marco-gated PR that is churn, and FINDING 2 shows the verdict clears itself at
  the moment it matters.
- **I did not add `scopecards-s7b` to `title-scope-baseline.json`.** The gate's own message forbids
  it — that file may only SHRINK, and adding to it is the gate failing open. The title was already
  corrected the right way.
- **I did not arm anything.** The queue drained to zero during the run and the ARM-ONE-AT-A-TIME
  rule plus a live build in flight at sweep time meant there was no safe moment; the backlog's only
  `READY TO STAGE` item (`rates-11c-blocked-consumers`) is a chain whose gate explicitly stays alive
  until its consumers merge, and it is not mine to stage ahead of Marco's three waiting PRs.
- **I did not commit the dev tree's three deleted `-HOLD.md` files or the modified
  `.arming-log.txt`.** The deletions are the consumed prompts behind #2107 and #2108, both still
  OPEN and both Marco-gated. Committing the deletions now would remove those prompts from `main`
  before their PRs are accepted; retiring a HOLD is a deliberate post-merge act (cf. `#2103`).
- **I did not touch Azure, Entra or SharePoint**, write production data, commit to `main`, or edit
  `sot/`.
- **I did not do 03/04/05's work.** FINDINGS 6 and 7 are dispatched by name, not performed.

## FOR MARCO

**Three PRs are waiting on you, and none of them is waiting on a defect.**

`#2107` (D-register checker warn→fail), `#2108` (cutting joins the card fold), `#2109` (S8a truck
cycle travel-time). Each is red **only** because it carries `do-not-merge` — CP-26 fails on the
label's presence by design, and every other gate on each PR passes or skips. Releasing one is:
remove the `do-not-merge` label, then commit `docs/decisions/merge-approvals/<n>.md` to that PR's
branch per `docs/decisions/merge-approvals/README.md`. CI re-runs on the `unlabeled` event and the
gate turns green.

⚠️ **One thing to expect on #2108 specifically:** it currently shows a *third* red,
`check-pr-title`. Ignore it — it is a verdict against a title the PR no longer has (renamed
01:39:53Z, after the run). It will go green by itself in the re-run your label removal triggers. The
underlying reason it could not clear on its own is fixed in this run's PR.

**And the one open question from the blind 01:15Z run, unchanged and still yours.** Station 00 has
been intermittently unable to reach the box (~40% of recent runs by the station doc's own count).
This hour it *could* — but a blind run and a calm board produce the same silence, so the failure is
invisible from outside. The 01:15Z run's recommendation stands and I have added nothing to it:
**make the blindness itself alarm** (a machine-readable marker on the blind path, raised when two
consecutive `00-supervisor` occurrences come back blind or silent). It is additive, it needs only a
yes, and it turns an invisible failure into a visible one. Diagnosing the Desktop Commander timeout
directly is worth doing when you next have the box in front of you, but it cannot be the primary fix
because it needs you present at a failure that is intermittent.

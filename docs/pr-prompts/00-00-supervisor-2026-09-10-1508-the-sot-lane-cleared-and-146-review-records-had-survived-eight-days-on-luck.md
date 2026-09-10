# Station 00 — Supervisor | 2026-09-10T15:08:37Z–2026-09-10T15:3xZ

Sighted run — Desktop Commander reached the box on the first call, before any conclusion was drawn.
Collect cycle. One merge, one board PR, eight findings collected from Station 04 and dispositioned.

Fresh negative-control needle minted for this run: `zzQq00Needle20260910T1510`. It is now written
down and is spent.

## GROUND

```
UTC            2026-09-10T15:08:37Z
origin/main    cfbf59d6            (git fetch origin --prune, then rev-parse)
dev tree       main @ cfbf59d6     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was not restricted to read-only on that account.

All three binding documents were read in full and proved current against `origin/main` rather than
merely off disk: `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY** on all three,
which is the real answer per DOCTRINE section 9.3. No piped hash was taken and none is compared.
The `git show` was run in the dev tree, never the watcher clone.

`origin/main` advanced to `bfbc1f92` mid-run when this station merged `#1855`; the worktree this
report was written in is based on that commit.

## WHAT I MEASURED

**Preflight guard — [CANNOT MEASURE].** `scripts/pipeline/vm-git-guard.sh` could not be installed:
the Linux workspace transport is absent this session. Verbatim, on two attempts several minutes
apart: `bash failed on resume, create, and re-resume … source path … is under Plan9 share "c" which
is not mounted; create: RPC error -1: ensure user: user confident-dazzling-mayer already exists
unexpectedly`. **No `git` was run against any mount this run** — there was no mount to run it
against; every git call went through Desktop Commander's PowerShell against the Windows tree. Per
the station contract a failed install is a finding, not a stop. This independently reproduces
Station 04's F0 from 14:10Z with a different session id, five hours later (F0 below).

**PREFLIGHT step 4 — the sweep.** `bring-up-to-speed.ps1` captured to a file (964 lines), exit 0.
Section 7 verdict, verbatim: `[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote
activity, no live station worktrees.` Re-measured immediately before the merge and again before the
commit: `index.lock` dev **False** / clone **False**, git processes **0**, staged paths **none**,
`git worktree list` showing no live station worktree. Sweep timestamp `2026-09-10 15:09:14Z`.

**Machinery.** `[LIVE] watcher node: RUNNING pid 18228` · auto-restart wrapper alive (1) · heartbeat
32 min (ticks only mid-run; stale + empty queue is idle, not wedged) · trunk green on `cfbf59d6`
(4 success / 0 failed) · `armed: 0`. No restart was needed and none was performed.

**COLLECT corpus.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`,
`structure: 3 checked, 0 malformed`. Freshness: `00` 1.1h (cadence 2h) ok · `03` 16.2h (24h) ok ·
`04` 1.0h (4h) ok · `05` 1.0h (24h) ok. Crossed against the tracked set rather than the dev tree, per
the archiving rule: of the three root breadcrumbs, two were my own already-merged runs (`1308` in
`#1853`, `1408` in `#1854`) and exactly one was **UNTRACKED and had reached nobody** — Station 04's
`1410` repo-hygiene sweep. Station 05's `1411` was not at the root at all; it was riding inside the
open PR `#1855`, which is how it reached main this run.

⚠️ **The `--freshness` `ok` on `00` is weaker than it looks and I am not quoting it as an all-clear.**
`check-breadcrumb.mjs`'s own `CADENCE` map still reads `'00': 2` while the live cron is `5 * * * *`,
so `00` is not called SILENT until three consecutive hourly runs have been missed
(`STATION-CAPABILITIES.md` section 6). Crossed against the board instead: `#1853` (1308) and `#1854`
(1408) merged one hour apart, so the hourly occurrences either side of this one did fire and did
report.

**Board — six open PRs, every one CLEAN and green at sweep time.** Lane established for all six
before any merge was considered, and recorded per PR rather than inferred in bulk.

RULE 2 probe, run against the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed` and never
the watcher clone, written without a quote character (`-Pattern 'marco.:true'`):

| control | result |
|---|---|
| newest log in the probe directory | `2026-09-10T14:38:19Z` — younger than every open PR |
| POSITIVE `marco.:true` | **629** |
| NEGATIVE `zzQq00Needle20260910T1510` | **0** |

| PR | prompt-log hits (`pr-*.log`, `rev-*` excluded) | verdict | lane |
|---|---|---|---|
| `#1850` | 2 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/triage-holds.ps1"}` | **MARCO'S — RULE 2 binds** |
| `#1845` | 2 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/status-sweep.ps1"}` | **MARCO'S — RULE 2 binds** |
| `#1832` | 2 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/vm-git-guard.sh"}` | **MARCO'S — RULE 2 binds** |
| `#1823` | 2 | `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` | **MARCO'S — RULE 2 binds** |
| `#1852` | **0 — NO LOG** | — | `[NO LANE VERDICT — hand-classified]` **MARCO'S** |
| `#1855` | **0 — NO LOG** | — | `[NO LANE VERDICT — hand-classified]` **Station 05's lane** |

**The two `NO LOG` readings were resolved rather than assumed**, because absence has three causes and
only one of them is "second lane".

- The daily clone log was found by **name shape then mtime**, never constructed from a date:
  `…\scripts\pr-watcher\logs\2026-09-10.log`, mtime `15:09:48Z` — **one minute old** — 73,653 B,
  POSITIVE control `[merge]` → **8**, NEGATIVE → **0**. It is younger than both PRs' `createdAt`, so
  the freshness precondition on the `opened PR #<n>` test is satisfied.
- Its newest `opened PR #` line is `#1850` at `12:02:16Z`. **Neither `#1852` nor `#1855` appears**,
  which is `[CANNOT MEASURE]` on that instrument and never on its own a second-lane verdict.
- Corroborated with the instrument a killed build cannot erase: `.arming-log.txt` records nothing
  armed since `11:50:44Z` (`pr-triage-corpus-suffix-union` → `#1850`). `#1852` was created
  `13:21:20Z` and `#1855` `14:30:25Z` — **no arm inside either window, so no watcher build could
  have started.** The log is byte-identical to `origin/main` (`--numstat` EMPTY), so no arm is
  pending publication either.
- Hand-classification then followed `classifyPolicyFiles` from the file lists, not from the titles.
  `#1852` touches `scripts/pipeline/status-sweep.ps1` alone — outside all three `NESTED_TEST_PATHS`
  forms ⇒ **Marco's**. `#1855` touches `sot/03-progress-log.md` and one `docs/pr-prompts/` file —
  which `classifyPolicyFiles` would also refuse, on the `sot/` path.

**`#1855` is the DOCTRINE section 10.1 step 3 exception, and it was checked rather than asserted.**
A PR opened by a station inside its own recorded authority is classified by the
`STATION-CAPABILITIES.md` section 5 matrix, not by `classifyPolicyFiles` — and section 10.1 names
Station 05 → `sot/` as *the only lane step 2 rejects*, which is exactly this PR. Every condition the
exception attaches was verified: the PR body **names its lane in its opening line** (*"A Station 05
doc-reconcile PR"*), it is `sot/` + `docs/` only with no `apps/`, `scripts/`, `.github/` or
`packages/` path, so **CP-24 is clean by construction** and its CI ran 10 pass / 0 fail / 0 pending.
Labels `[]`. The lane's CI gate is what makes the claim measured rather than self-declared.
`STATION-CAPABILITIES.md` section 5 states in terms that *"00 may merge docs-only and `sot/`-only
PRs … via `pipeline-lib`"*. Precedent: `#1828`, the previous `sot/`-only Station 05 reconcile, merged
`2026-09-10T00:06:18Z`.

⚠️ **One instrument pointed the other way and I am recording it rather than burying it.** The review
verdict at `docs/pr-reviews/pr-1855-review.md` (mtime `14:37:57Z`) reads `VERDICT: MERGE`, and in the
same file *"Station 05 cannot merge its own PRs per house rules - Marco's review gate is intact"*;
the PR body likewise says *"Marco reviews the rendered diff"*. **The first clause is about Station 05
and is true and unchanged — it says nothing about whether 00 may merge.** The second is unversioned
prose, and the precise conflict it expresses is the one Marco already ruled on 2026-09-04
(`needs-marco/sot-only-pr-merge-authority-conflict-2026-09-03.md`, first applied to `#1554`). Reading
review prose as a merge gate would re-open a settled ruling and manufacture exactly the human
decision section 10.1 warns that over-routing silently creates. Four instruments said merge — the
authority matrix, the absent watcher verdict, the absent label, green CI including CP-24 — against
one piece of prose. I merged, and I am naming the dissent here so the next reader can overrule me
cheaply.

**Merge, through the sanctioned primitive and read back.** `Assert-SmokedOrEscalate -PR 1855` →
`True`, `True`, exit 0; then `Merge-Pr -PR 1855` → `True`. Pre-merge read-back `state=OPEN
mergeState=CLEAN labels=[]`; post-merge read-back **`state=MERGED mergedAt=2026-09-10T15:15:47Z
mergeCommit=bfbc1f923887b66fb1262d0c4105a880b1bc2249`**. No `gh pr merge` was called by hand and no
`git merge` was run anywhere.

**No board PR was inside its merge window when I merged.** The newest `policy=tests-docs, waiting`
line is `#1850` at `12:02:16Z`; its 90-minute `MERGE_TIMEOUT_MS` window closed about `13:32Z`, more
than 100 minutes before the merge. There was no waiter to go first.

**The 146 files of F4 are CLEAN UTF-8 — the mojibake was in the reader.** `Get-Content` displayed
`PR #1002 �?" Prisma Compute` on the first file, which is the exact signature DOCTRINE section 9.3
says to distrust. Decoded strictly in node across all 146: **U+FFFD total 0 in 0 files**,
**double-encoded `â€`-family sequences total 0 in 0 files**, 103,757 bytes. POSITIVE controls both
fired on synthetic inputs (one `U+FFFD`, one double-encoded em dash); NEGATIVE control on clean ASCII
→ 0. So the display was false mojibake and the files are safe to commit unmodified. Basename
collisions against the tracked `docs/pr-prompts` set: **0**.

## WHAT CHANGED

1. **`#1855` MERGED** at `2026-09-10T15:15:47Z`, `bfbc1f92`, via `Assert-SmokedOrEscalate` →
   `Merge-Pr`, read back as `MERGED` (above). This also published Station 05's `1411` breadcrumb to
   `main`, which had no other route: it was inside that PR and at no point in the queue root.
2. **One board PR opened** from the isolated worktree `C:\po-wt\bc-00-1508` off `origin/main`
   `bfbc1f92`, carrying: Station 04's `1410` breadcrumb (into `archive/`), the
   `docs/pipeline/sweep-rotation.json` advance 04 left dirty on purpose, the **146** review-escalation
   records of F4, the archiving of three fully-collected root breadcrumbs (`1308`, `1408`, 05's
   `1411`), and this report. `docs/` only.
3. **One `needs-marco/` escalation file written** for F2 (branch deletion), in the dev tree.

Nothing else. **No prompt armed, disarmed, renamed, moved or deleted** — `armed` was 0 at the start
of this run and 0 at the end. No label added or removed. No watcher restart. No worktree pruned, no
stash dropped, no branch deleted, no `git clean`, no `git checkout .`, no `reset --hard`, no
`stash pop`. The dev tree's shared index was **empty before and after** (`git diff --cached
--name-status` → EMPTY on both readings), so no other chat's staged work was swept into a commit.

## FINDINGS

### F0 — the Linux workspace transport is gone for a second consecutive station, five hours apart

[MEASURED] Two attempts this run, identical error, quoted verbatim under WHAT I MEASURED. Station 04
recorded the same failure at 14:10Z and 14:19Z under a **different session id**
(`beautiful-gifted-goldberg` against this run's `confident-dazzling-mayer`), so this is not one bad
session — the mount has been unavailable across at least two sessions and five hours.

This is **not blindness** and must not be reported as it. Desktop Commander was present and healthy
throughout both runs; it is the *secondary* transport that is absent, and
`STATION-CAPABILITIES.md` section 3 already says that transport must never be treated as a fallback.
The narrow consequence is that `vm-git-guard.sh` is uninstalled, so the next run that *does* have a
mount inherits an unguarded bridge — the 0-byte `index.lock` freeze DOCTRINE section 9.2 records
three occurrences of.

⚠️ Worth one line for whoever meets this next: the guard exists to stop `git` being run against a
mount, and on both of these runs there was **no mount to run it against**, so the risk the guard
covers was structurally absent while the guard was missing. That is luck, not design.

**DISPOSITION: DEFERRED.** Real, and not actionable from either run — the guard installs from the VM
side and there has been no VM side. It becomes urgent the moment a station with a working mount runs.
The next sighted-and-mounted run installs it and quotes the installer's last line, pass or fail.

### F1 — `C:\po-vg`'s "uncommitted work" is a superseded draft, and the preserve-before-pruning condition is discharged

Station 04 measured this properly and the measurement is the finding: the single untracked file in
that six-day-old worktree, `scripts/pipeline/check-pipeline-heartbeat.mjs`, is an **earlier** revision
of a file already on `main`. 04's blob table (`origin/main` `84ec92d4` · po-vg `9c4587fb` · dev tree
`84ec92d4`) plus a line-set diff showing po-vg's two unique lines are strictly weaker forms of lines
`main` still carries, with a positive control on `status-sweep.ps1` and a negative control on a minted
path. **po-vg holds nothing that is not on main in a stronger form.**

I did not re-run the blob comparison this run and I am not claiming it as my own measurement. What I
can add is that `status-sweep.ps1` still reported the worktree at `age=9076 min` and `dirty=1` at
15:09Z, so nothing has changed since 04 looked, and `git worktree list` at 15:11Z still shows it at
`23c91ba9`.

**DISPOSITION: DISPATCHED → Station 03**, together with F7. The handover, executably: *the
preserve-before-pruning condition on `C:\po-vg` is discharged by measurement; `git worktree remove
C:\po-vg` may proceed and `--force` is not needed for content reasons.* **Re-run 04's three-row blob
comparison immediately before acting** — if the blob at
`C:\po-vg\scripts\pipeline\check-pipeline-heartbeat.mjs` is anything other than `9c4587fb`, someone
has edited it since 14:1xZ and the discharge is void. Worktree pruning is 03's; it is not 00's and it
is not 04's.

### F2 — eight of fourteen remote heads have no open PR, and branch deletion is irreversible

Station 04's measurement stands on its own controls: `git ls-remote --heads origin` (the remote, never
`git branch -r`) → 14 heads, each resolved with `gh pr list -R … --head <branch> --state all`, `-R`
passed on every call and `$LASTEXITCODE` tested before parsing, `mergedAt` read rather than `merged`.
Eight heads carry no open PR: one MERGED (`chore/sweep-breadcrumbs-20260907-0934`, `#1778`), five
closed-unmerged, and `fix1483`, which **never had a PR of its own** and is a surviving copy of merged
`#1483`'s deleted head — 04 proved its content landed by walking all 18 commits touching
`ScopeQuantitiesTable.tsx` and finding the branch blob reachable from `origin/main`, with a positive
control on main's own tip blob.

04 also recorded the trap underneath it, which is the part worth carrying forward: **the
commits-not-on-main count is not a safety test.** `chore/sweep-breadcrumbs-20260907-0934` is merged
and still reads 5 ahead, because every merge on this board is a squash. A run reading "5 ahead" as
"5 commits of unique work" refuses to delete a fully-landed branch forever.

**DISPOSITION: ESCALATED.** Branch deletion is irreversible (DOCTRINE section 5.4) and no agent may
perform it. Written to `docs/pr-prompts/needs-marco/` this run so it is escalated to somebody rather
than to nobody — the subject is a GitHub repository setting, which is outside this repo and therefore
cannot be carried by a prompt. RULE 1 order, with the complete-and-additive option first:

- **(a) COMPLETE AND ADDITIVE — enable "automatically delete head branches" on the repo, then
  hand-delete the settled heads.** Passes both halves: it fixes the recurrence as well as today's
  backlog, and it destroys nothing anyone entered — each is merged or closed by its own author.
- **(b) Delete only the two provably-landed heads.** Fails the *future* half: the next merged branch
  survives identically.
- **(c) Leave all fourteen.** Fails the *immediate* half; the head list is 14 for a five-PR board.

⚠️ **`feat/crm-account360-v2-s1` (`#1612`) must be excluded from (a) and (b) until its standing
escalation is read** — `pr-1612-closed-unmerged-branch-holds-the-only-copy` asserts that branch may
hold the only copy of that work, and neither 04 nor I tested its content.

### F3 — Station 00's sweep capture lands in the repo root and is not gitignored

04 found `.sweep-00-2026-09-10.txt` (132,290 B) as an untracked entry in the repo root, then
**self-corrected eleven minutes later**: the file was gone, because 00 removes its own capture at the
end of its run. The corrected finding is a narrow latent hazard, not damage — `git ls-tree -r
--name-only origin/main` → 3,464 tracked files of which **0** match `*.sweep-*` (04's positive control
`CLAUDE.md` → 1, negative control → 0).

I can confirm the corrected version from this run and it strengthens it slightly: **this run wrote its
capture to `$env:TEMP`, not to the repo root**, and `git status --porcelain` in the dev tree at 15:11Z
showed no `.sweep-*` entry at all. So the behaviour is not uniform across 00 runs, which is itself the
argument for fixing it at the source rather than relying on cleanup.

The hazard is real but small: the capture is written to a non-ignored path, in a tree whose index is
shared between concurrent chats, during a window in which another station is running *by
construction* (`STATION-CAPABILITIES.md` section 6 — hourly 00 lands inside ten minutes of every one
of 04's six daily runs). One stray `git add -A` commits a dump of the board's internal state to main.

**DISPOSITION: DEFERRED**, not dispatched, and the demotion is deliberate. The complete-and-additive
fix is *(a) write the capture to `C:\po-sup-fix-scripts\` like every other station capture AND add
`.sweep-*.txt` to `.gitignore`* — both halves, so a future writer that forgets cannot commit it
either. But that is a `scripts/` plus `.gitignore` change, which the RULE 2 table above shows is
routed to Marco on this board, and every arm available today already lands on him. It becomes urgent
the moment a `.sweep-*` file appears in `git ls-tree`; that probe is one line and costs nothing to
re-run.

### F4 — 146 review records had survived eight days on luck, and they are now tracked

[MEASURED] `docs/pr-prompts/archive/review-escalations-516-1346/` — **146** files, **103,757 bytes**,
`pr-<N>-review-{fix,block,verify}.md` for PRs 516–1346, file mtimes spanning `2026-07-08T09:07:43Z`
to `2026-08-27T01:11:24Z`. Untracked but **not ignored** (04's `check-ignore` on a FILE, never a
directory, exit 1 against a positive control returning `.gitignore:116`), inside a parent directory
that *is* tracked and holds 499 files on `origin/main`. Somebody archived them into the right place
and the commit never happened.

04 dispatched the decision here and declined to take a view, having not read the contents. I read
enough to decide. They are review-escalation records with reasoning in them — the first is a
structured `NEEDS VERIFICATION` write-up of `#1002` naming its blocker and its three reasons — and
every PR they concern is long settled. Encoding checked before committing anything, per F4's entry
under WHAT I MEASURED: 0 U+FFFD, 0 double-encoded sequences, both positive controls firing.

**DISPOSITION: ACTIONED — committed, in this run's board PR.** RULE 1 decided it and the two tests
point the same way: committing is complete (the record is permanent and no longer one `git clean`
from gone) and additive (it destroys nothing, costs 101 KB, and collides with no tracked basename).
Deleting fails the second test outright — 146 records of review reasoning, unrecoverable. Leaving
them untracked-but-not-ignored is what 04 correctly called the worst of the three, because it
survives only by luck. Verified by the PR's own file list, and by `git ls-files` after merge.

### F5 — the watcher clone's stash loop is at 71 and still taking new entries

[MEASURED] by 04: 71 stashes in `C:\po-watcher\ProjectOperations`, 0 in the dev tree, newest
`watcher-preflight-autostash on 'main' at 2026-09-10T15:39:44+10:00` (= `05:39:44Z` today), so the
loop is live rather than historical. DOCTRINE section 9.2 carries the mechanism — the launcher's
preflight stashes on every start and nothing ever pops — and the cure, `git stash drop` and **never
`pop`**.

This is an update to the open clone-hygiene dispatch, not a new finding. The number has moved and the
growth trigger is met. ⚠️ The count is STATE: re-measure it, never quote 71.

**DISPOSITION: DISPATCHED → Station 03**, folded into the existing clone-hygiene dispatch alongside
F1 and F7. Only 03 may act in the clone; 00 may not, and this run did not touch it beyond reads.

### F6 — the worktree-escapee scan's corpus is a fixed root list, on a box that creates fix trees beside those roots

04 verified the sweep's `worktree-registry-escapees: none found under known roots` is **true as
stated** — `C:\po-worktrees` = 1, `C:\po-wt` = 1, `C:\po-watcher-worktrees` = 0, all accounted for —
and then found that `C:\po-*` holds 14 directories, nine outside every known root, of which none is a
lost worktree. Five are empty shells sharing one mtime to the second (a `worktree remove` batch on
09-03 that took the contents and left the directories); they are inert.

The finding is the shape, not the count: **a sweep whose corpus is a fixed list of roots will keep
missing what is created beside them**, and this box creates fix trees as `C:\po-<name>` siblings. Had
`po-vg` been created one level up rather than registered, the scan would report `none found` with
equal confidence. That is `STATION-CAPABILITIES.md` section 1's own rule pointed at a different list —
the same defect class as the "five bootstraps" corpus already open with Marco.

⚠️ 04 reported `C:\po-secrets` by name, count and mtime only and did not open it. Neither did I. It
sits unversioned outside every repo on a machine whose trees stations routinely clean. That is
Marco's to look at, not an agent's, and naming it is as far as either station should go.

**DISPOSITION: DEFERRED.** Nothing is broken today and the empty shells cost nothing. It becomes
urgent if a fix tree is ever created as a `C:\po-*` sibling **and** registered as a worktree — then
`none found` is a false negative on the one question the scan exists to answer. The cheap fix is to
widen the scan from a root list to `C:\po-*`, classifying by the presence of a `.git` entry; that is
a `scripts/` change and therefore Marco's to merge, which is the same throughput constraint F3 hits.

### F7 — `C:\po-worktrees\pr1823` is a stale checkout of a live PR's branch

[MEASURED] by 04: the worktree sits at `9664f95a` while `git ls-remote --heads origin
feat/ea-gate-reporting-team-permission` → `aabc5e6f`, so it is behind its own head; `dirty=0`, age 960
min. `#1823` is OPEN. `status-sweep.ps1` classifies it as `orphaned worktree (aborted run leftover --
investigate/prune)`, which is right about *aborted* and silent about *safe* — it is checked out on the
head branch of an open PR, which is precisely the shape that looks destructive after the fact.

I re-read the sweep at 15:09Z: still registered, still `dirty=0`, `age=1018 min`. `#1823` is still
OPEN and is one of the four PRs RULE 2 binds on, so nothing about this worktree is in my lane to
resolve beyond handing it over correctly.

**DISPOSITION: DISPATCHED → Station 03**, with F1. Pruning is safe on content grounds — `dirty=0` and
the remote head is ahead of the local one, so the worktree holds nothing the remote does not have.
**Re-measure both SHAs immediately before acting**: `#1823` is live and that reading expires.

### F8 — the board's throughput constraint held for a fourth consecutive run, and this run is the first exception to it

[MEASURED] this run, from the RULE 2 table above. Of six open PRs, **five are Marco's**: four carry a
live watcher `marco:true` verdict and one hand-classifies to him on `classifyPolicyFiles`. `armed: 0`,
and nothing was armed this run.

This is the constraint my own `1208`, `1308` and `1408` breadcrumbs each recorded, and it has not
moved: 00 can arm work, the watcher can build it, CI can green it — and every PR touching anything
outside `tests/` or `docs/` then stops until Marco merges. Three of the four watcher verdicts name a
`scripts/pipeline/*` file, and two of those files (`status-sweep.ps1`, `triage-holds.ps1`) are the
pipeline's own instruments, so the work most blocked is the work that repairs the instruments the
stations depend on.

**What is genuinely new is the exception.** `#1855` was merged by this station with no human, because
Station 05's `sot/` lane is classified by the authority matrix and gated in CI by CP-24 rather than by
`classifyPolicyFiles`. That is DOCTRINE section 10.1 step 3 doing exactly what it was written for, and
it is the first time in four runs that a PR left this board without waiting for Marco. **The lesson is
narrow and I am not over-reading it:** the exception works because 05's lane has a CI gate proving its
boundary. Section 10.1's own proviso is that a new lane outside `tests|docs` may not be added without
one, and no other lane on this board has one today.

**DISPOSITION: DEFERRED** as a finding — it is a measured description of a constraint Marco already
knows about and has already been asked about; re-escalating it hourly is noise. It becomes something
to raise again if the open-PR count crosses roughly ten, or if a `fixes_pr` for a main regression is
ever the thing stuck behind it, because that would make the constraint block trunk repair rather than
feature throughput.

## WHAT I DID NOT DO

- **Armed nothing, and did not go looking for something to arm.** `armed` was 0 throughout. Five of
  six open PRs are Marco's; arming another prompt today lengthens that queue rather than shortening
  it, which is the constraint F8 records. `triage-holds.ps1` was not re-run — 04 ran it 65 minutes
  ago (`spent=0 of 40 · gates-satisfied=9 · still-gated=31`, both of its own controls PASS) and its
  answer is not stale at this distance.
- **Did not merge `#1852`, `#1850`, `#1845`, `#1832` or `#1823`.** Four carry a live watcher
  `marco:true` verdict; RULE 2 is not overridden by green, by CLEAN, by being unlabelled, or by my
  own reading of the routing reason. `#1852` hand-classifies to Marco on its single `scripts/` path.
  `#1823` additionally carries `do-not-merge` in its verdict reason — **only Marco removes a label**,
  and I did not.
- **Did not author a merge-approvals receipt.** A scheduled run never may. Marco's 09-07 ruling
  covers the supervised cloud lane only, and this run is the scheduled one.
- **Did not prune `C:\po-vg` or `C:\po-worktrees\pr1823`, drop a stash, or delete a branch.** The
  first two are Station 03's and are dispatched, not done; branch deletion is irreversible and is
  escalated. Doing another station's work is LL-38 and it is the incident this station is named in.
- **Did not touch the watcher clone beyond reads** — the daily log was **copied** before
  `Select-String` because the live file is held open by the watcher, and nothing else in
  `C:\po-watcher` was written.
- **Did not restart the watcher.** It reported RUNNING pid 18228 with a live wrapper and an empty
  queue; a stale heartbeat with 0 armed is idle, not wedged, and `restart-watcher-if-wedged.ps1` was
  not run because there was no verdict to act on.
- **Did not open `C:\po-secrets`** (F6) or read the contents of `feat/crm-account360-v2-s1` (F2).
- **Did not run `git checkout .`, `reset --hard`, `stash pop` or `git clean`** anywhere, and ran no
  `git` at all through the device bridge — there was no bridge, and a guard I could not install is
  never a licence to use one.
- **Left `docs/qa/`, `/sot/`, Azure, Entra and SharePoint alone.** `sot/` reached `main` this run only
  by merging Station 05's own PR; I edited no file under it.

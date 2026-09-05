# Station 04 — Scanner | 2026-09-04T18:09:55Z–2026-09-04T18:4xZ

## GROUND

```
UTC            2026-09-04T18:09:55Z
origin/main    95a47ceb            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 95a47ceb     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task file)
```

Versions agree — full authority, not read-only.

**Which tree I read in.** All three binding documents were read in the DEV TREE
`C:\ProjectOperations2`, never the watcher clone. [MEASURED] `git diff --numstat origin/main --
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/04-scanner.md`
returned **empty output** — the working copies are not different from `origin/main`, so reading them
from disk is sound. Per §9.5 I did **not** compare a piped `git hash-object --stdin` value against
anything; the `--numstat` form is the one this station doc names as "the real answer".

**Sweep this run: `repo-hygiene`** — chosen by `node scripts/pipeline/next-sweep.mjs`
(rotation position 3 of 4; previous run 2026-09-04T14:09:00Z), not by me.

---

## WHAT I MEASURED

**Preflight / instruments**

- [MEASURED] `start_process` shell `powershell.exe` → PID 29980, prompt returned. **Not a blind run.**
- [MEASURED] `status-sweep.ps1` §0 positive controls both pass: `gh CAN reach GitHub (saw merged PR
  #1602)`, `node runs`.
- [MEASURED] Board at 18:11:16Z: **3 open PRs** — #1594, #1593, #1589, all `CLEAN`, all
  `14 pass / 0 fail / 0 pending`. `main CI on 95a47ceb: 4 success / 0 failed` (trunk green).
  Watcher node RUNNING pid 20000, wrapper alive, heartbeat age 51 min.
- [MEASURED] Sweep §7 verdict is **CAUTION**, on the sole grounds that `C:/po-vg` is classified a
  LIVE STATION WORKTREE. That classifier defect is already dispatched (00's 17:08Z breadcrumb,
  merged in #1602); this run re-measures it rather than re-filing it. See F1.
- [MEASURED, lead not finding] One transient `warning: unable to access '.git/config': Permission
  denied` on a single `git ls-tree` at ~18:2xZ. It did not recur across ~20 later git calls and the
  command still returned its rows. Recorded because §7 says an instrument that stutters once is
  worth naming; not diagnosed, not acted on.

**The board trap — tracked `*-ready.md` at depth 1**

- [MEASURED] `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` → **766** tracked paths;
  filtered to depth 1 → **106**; of those, `*-ready.md` → **0**.
  POSITIVE CONTROL: the same depth-1 filter returns `docs/pr-prompts/PROMPT-SCHEMA.md`, a file known
  tracked — so the zero is a true zero and not §9.2's silent-glob or missing-`-r` failure.
  **Board trap CLEAN.**

**Spent HOLDs**

- [MEASURED] `scripts/pipeline/triage-holds.ps1` over the whole board:
  `TOTALS spent=0 gates-satisfied=43 still-gated=54 unreadable=0 of 97`, and it reports
  `SPENT was additionally proved reachable by the fixture control` — i.e. the instrument was shown
  able to emit the verdict it returned zero of. **No HOLD on main has already shipped.**

**Branches, asked of the remote (§9.2: never `git branch -r`)**

- [MEASURED] `git ls-remote --heads origin` → **6**: `main`, `feat/arm-attribution`,
  `feat/pipeline-heartbeat`, `fix/lint-gate-path-space`, `fix/classify-policy-nested-tests`, `fix1483`.
  Local `git branch -r` says **14** — the cache overstates by 8, exactly the §9.2 trap.
- [MEASURED] Three of the six back the three open PRs. `fix/classify-policy-nested-tests` → PR
  **#1571, CLOSED unmerged**, 1 commit not on main. `fix1483` → **0 PRs, ever**, 28 commits not on
  main. POSITIVE CONTROL: the identical query on `feat/pipeline-heartbeat` returns `#1594 OPEN`, so
  the `fix1483` zero is a true zero.
- [MEASURED] `git ls-remote --tags origin` → 48 tags, **46** of them `abandoned/*`. Neither
  `fix1483` nor `classify-policy-nested-tests` has one.

**Watcher clone**

- [MEASURED] `git -C C:\po-watcher\ProjectOperations status --porcelain` → 2 lines:
  ` M docs/data-model/metadata-catalog.json` and `?? scripts/pr-watcher/.conflict-notified-prs.json`.
  No `MERGE_HEAD`, no rebase state, no unmerged paths. **`dirty=2` here is runtime residue, not
  corruption.**
- [MEASURED] `git stash list` → **66**, newest `2026-09-03T18:55:05+10:00`
  (`watcher-preflight-autostash`), oldest `stash@{65}` based on `#545`. Unchanged in count from the
  02:10Z reading — the closed loop §9.2 describes is not currently growing. Already ESCALATED by the
  02:10Z sweep (its F3, the "drop is not safe for 6 of the 66" finding); **not re-filed here.**

**The five non-main worktrees, one at a time** — this is the new work, see F1.

| worktree | branch / HEAD | commits not on main | where else that work lives | [MEASURED] |
|---|---|---|---|---|
| `C:/po-1483-fix` | `fix1483` | 28 | `origin/fix1483` (remote) | `git rev-list --left-right --count origin/fix1483...origin/main` → `28 93` |
| `C:/po-guard` | `guard/never-arm-cd-s1` | 1 (`dd954645`) | nowhere — **local only** | not in `ls-remote --heads`; content spent, see F2 |
| `C:/po-sa-fix` | `pipeline/standing-authority-reject` | 1 (`12c20e90`) | **on main** | `git cat-file -e origin/main:scripts/pipeline/__tests__/lint-prompt.standing-authority.test.mjs` → exit 0 |
| `C:/po-vg` | `fix/no-rebase-while-checks-run` | 1 (`23c91ba9`) | **on main** | `git cat-file -e origin/main:scripts/pr-watcher/__tests__/update-branch-guard.test.mjs` → exit 0 |
| `C:/po-work/s2-e2e` | detached `f85f11cf` | 1 | `refs/heads/fix1483` **and** `refs/remotes/origin/fix1483` | `git for-each-ref --contains f85f11cf` → 2 refs |

NEGATIVE CONTROL for the `cat-file -e` probe: `origin/main:scripts/pipeline/zzz-no-such-file.mjs` →
exit **128**. POSITIVE CONTROL for `for-each-ref --contains`: the same query on `95a47ceb` returns
**7** refs. Both directions answer, so neither the exit-0s nor the 2-refs reading is an empty-world.

- [MEASURED] `C:/po-vg`'s single dirty file is untracked
  `scripts/pipeline/check-pipeline-heartbeat.mjs`, and it is **byte-identical to main**:
  `git rev-parse origin/main:scripts/pipeline/check-pipeline-heartbeat.mjs` → `9c4587fbf4e9…` and
  `git -C C:\po-vg hash-object <same path>` → `9c4587fbf4e9…`. Its staged set is **empty**
  (`git diff --cached --name-status`, the authoritative probe — not `git status --porcelain` piped
  through `.trim()`).

**Queue-root litter**

- [MEASURED] `pr-watcher-merge-policy-nested-test-paths-LOOPING.md` sits untracked at depth 1. Its
  matching `-HOLD.md` is **not on main** (`git cat-file -e` → 128) and not on disk, and its premise
  (`! grep -q "NESTED_TEST_PATHS" scripts/pr-watcher/index.mjs`) is now **false**:
  `NESTED_TEST_PATHS` occurs **3** times in `origin/main:scripts/pr-watcher/index.mjs`
  (POSITIVE CONTROL `classifyPolicyFiles` → 2, NEGATIVE `zzzNoSuchTokenZzz` → 0). The work shipped;
  the file is a corpse, matches no watcher glob, and arms nothing. **Litter, not a hazard.**
- [MEASURED] `docs/pr-prompts/archive/review-escalations-516-1346/` holds **146** untracked files
  dated 2026-07-08 → 2026-08-27, and it is **not gitignored**: `git check-ignore -v` on a file inside
  it → exit 1, against the POSITIVE CONTROL `git check-ignore -v docs/pr-prompts/processed/x.log` →
  exit 0, `.gitignore:76`. Per §9.2 I ran the **file** form, never the directory form. Already
  reported — `git grep -l -i "review-escalations-516-1346" origin/main -- docs/` returns 6 tracked
  breadcrumbs including 04's own 02:10Z run. **Re-verified unchanged; not re-filed.**

---

## WHAT CHANGED

Two working-tree writes in the dev tree, both left DIRTY and both named here because Station 00
commits them — 04 may not commit to the shared tree:

1. `docs/pipeline/sweep-rotation.json` — `node scripts/pipeline/next-sweep.mjs --advance --utc
   2026-09-04T18:09:55Z` → `advanced: last_index=2 last_run_utc=2026-09-04T18:09:55Z`, verified by
   `git status --porcelain` → ` M docs/pipeline/sweep-rotation.json`.
2. This breadcrumb.

Nothing else. No prompt armed, renamed, moved, staged or deleted. No PR opened, merged or labelled.
No worktree pruned. No branch or tag created or deleted. No stash dropped.

---

## FINDINGS

### F1 — all five non-main worktrees hold NOTHING unique, including the one the sweep forbids pruning — S3

Every worktree `status-sweep.ps1` flags for investigation, and the one it flags `do NOT prune`, was
checked individually against `origin/main` and against the remote. The table under WHAT I MEASURED is
the evidence. In summary: `fix1483`'s 28 commits are on the remote; `f85f11cf` is reachable from
`fix1483` in two refs, so the detached HEAD is not orphaned in the git sense; `12c20e90` and
`23c91ba9` have both landed on main by squash (their test files are present on `origin/main`); and
`po-vg`'s only dirty file is byte-identical to main's blob.

This matters because the standing caution has been read as *"pruning might destroy the only copy of
something"* — 00's 11:09Z run recorded exactly that fear about `check-pipeline-heartbeat.mjs` sitting
in `po-vg`. **That fear is now discharged by measurement, for all five.** `git worktree remove` does
not delete a branch ref in any case, so the one genuinely local commit (`dd954645`, F2) survives a
prune regardless.

⚠️ What this finding does **not** say: it does not clear `origin/fix1483` for deletion. That branch is
the only home of 28 never-proposed commits, it carries no `abandoned/*` tag, and deleting a remote
branch is irreversible (DOCTRINE §5.4). Its disposition stands from the 02:10Z run.

**DISPOSITION: DISPATCHED → Station 03 (machine-minder).** 03 owns worktree and lock hygiene and the
sweep names it explicitly (`Station 03 should review and prune if confirmed dead`). Handed over: the
five-row table above, the controls behind it, and the specific claim that pruning
`po-1483-fix`, `po-guard`, `po-sa-fix`, `po-vg` and `po-work/s2-e2e` loses no unique commit and no
unique file. 03's matrix cell is *report-only*, so if pruning counts as repair rather than report,
this needs 00 to authorise the mutation — I am flagging that boundary rather than assuming it.

### F2 — a spent never-arm guard is sitting unpushed, and its self-delete condition can never be observed — S3

`dd954645` (branch `guard/never-arm-cd-s1`, in `C:/po-guard`, authored 2026-09-04T00:04Z) is the one
commit measured this run that exists **nowhere but this machine**. It adds ten lines to
`docs/pipeline/stations/00-supervisor.md` forbidding the arming of
`pr-claudedesign-s1-track-the-written-half`, and it ends: *"Delete this paragraph the moment
`!Claude Design/proposed/` appears in the prompt body — that is the only condition it waits on."*

[MEASURED] That prompt **no longer exists on `origin/main`** — `git cat-file -e
origin/main:docs/pr-prompts/pr-claudedesign-s1-track-the-written-half-HOLD.md` → fatal/not-found, and
the only `*claudedesign*` path left in the tracked queue is
`pr-claudedesign-s2-spec-regeneration-plan-HOLD.md`. Its history shows the condition was met and then
some: `#1559` *"CD-S1 gains the proposed/ re-include and a done_when that can fail"*, then `#1578`.
[MEASURED] `origin/main:docs/pipeline/stations/00-supervisor.md` contains **0** occurrences of
`claudedesign` (POSITIVE CONTROL: `Supervisor` → 20), so the guard is not on main either.

So the commit is dead in both directions: the prompt it guards is gone, and the paragraph's own
delete-trigger can never be seen, because the body it points at no longer exists. If anyone ever
pushes or cherry-picks this branch, `00-supervisor.md` acquires a permanent never-arm rule for a
prompt nobody can find — the *"a stale instruction reads exactly like a current one"* failure that
§9.5 and STATION-CAPABILITIES §1 both record.

**DISPOSITION: DISPATCHED → Station 00.** Two things for 00: (a) do **not** push, merge or
cherry-pick `guard/never-arm-cd-s1`; (b) after 03 prunes the worktree (F1), delete the local branch
ref so the commit cannot be revived by accident. It is 1 commit, never pushed, whose content is
provably obsolete, so no `abandoned/*` tag is warranted — but if 00 prefers the belt-and-braces cure
from escalation #14, tagging costs nothing and I have not done it, because tagging is a board
mutation and I am read-only.

### F3 — DOCTRINE §10.1 step 2 now describes `classifyPolicyFiles` more narrowly than the code does — S3

§10.1 step 2 tells a hand-classifier: *"`classifyPolicyFiles` in `index.mjs` is the definition: any
path outside `^(tests|docs)/`, or any path matching `(^|/)migrations/`, means it is Marco's."*

[MEASURED] On `origin/main`, `classifyPolicyFiles` no longer anchors on that one regex. It now reads:

```
const NESTED_TEST_PATHS = [
    /^(tests|docs)\//,
    /(^|\/)__tests__\//,
    /\.(test|spec)\.[cm]?[jt]sx?$/,
  ];
```

with a comment saying the single-regex form *"classifies every real test-only PR as 'outside' and
routes it to Marco"* — the very defect it was changed to fix. `NESTED_TEST_PATHS` → 3 occurrences,
POSITIVE CONTROL `classifyPolicyFiles` → 2, NEGATIVE CONTROL `zzzNoSuchTokenZzz` → 0.

Consequence: a station hand-classifying a second-lane PR under §10.1 step 2, following the
parenthetical rather than reading the function, will route a PR touching only
`scripts/pipeline/__tests__/…` or `foo.spec.ts` to Marco, while the watcher's own lane would classify
it as tests and auto-merge it. The doc and the code now disagree about the same PR.

**This fails in the SAFE direction** — over-routing to Marco creates work, it does not merge
anything of his — which is why it is S3 and not S2, and why I am not treating it as urgent. It is
still exactly the drift §9.5's closing bullet warns about: a shorthand for a symbol, written into a
document every station is told it can trust, that the symbol has since outgrown.

**DISPOSITION: DEFERRED.** Real, not now. §10.1 is binding law and its correction should be
hand-landed with exact wording by 00 or 05, not folded into a hygiene PR by a read-only station.
**What would make it urgent:** the first time a station hand-classifies a nested-test-only
second-lane PR and routes it to Marco on the strength of the parenthetical — at that point the doc
has cost a human a decision the lane was built to remove. The falsifying probe is the three-element
`NESTED_TEST_PATHS` array above; if a future run finds `classifyPolicyFiles` back on the single
regex, this finding dies.

### F4 — the rest of the repo-hygiene surface is clean, and the instruments proved it — no severity

Board trap: **0** tracked `*-ready.md` at depth 1, with a positive control proving the depth-1 filter
returns real files. Spent HOLDs: **0 of 97**, with the SPENT verdict proved reachable by
`triage-holds.ps1`'s own fixture. Watcher clone: dirty=2, both entries runtime residue, no merge or
rebase state. Queue-root litter: the one `-LOOPING.md` at depth 1 is a corpse whose work is on main
and which matches no watcher glob.

**DISPOSITION: ACTIONED** — verified clean at `origin/main` `95a47ceb`, 2026-09-04T18:1x–18:4xZ.
Nothing to do. Recorded so the next repo-hygiene run can diff against it rather than re-derive it.

---

## WHAT I DID NOT DO

- **Pruned nothing, deleted nothing, dropped no stash.** 04 is read-only on the board and the sweep's
  own charter says *"No agent bulk-deletes."* F1 is a measurement handed to 03, not a prune.
- **Did not touch `origin/fix1483`**, its 28 commits, or the missing `abandoned/*` tag. That is the
  02:10Z run's F1 and it is already dispatched to 00; re-dispatching it would double-count.
- **Did not re-file** the 66 stashes (02:10Z F3, escalated to Marco), the 146 untracked files in
  `archive/review-escalations-516-1346/` (reported in 6 tracked breadcrumbs), the `po-work` registry
  blind spot (02:10Z F2), or the `po-vg` classifier defect (00's 17:08Z run, merged in #1602). All
  four were re-measured this run and are unchanged; unchanged is not news.
- **Did not commit the rotation advance or this breadcrumb.** Both are left dirty in the dev tree by
  design — the station that ran the sweep must not commit to the shared tree. Station 00 collects.
- **Ran no Part 0 / Part 1 / Part 2 pass.** The station doc's AUTHORITY section binds me to ONE named
  sweep per run, covered completely, and `next-sweep.mjs` named `repo-hygiene`. A shallow pass over
  everything is the failure that rule exists to prevent.
- **Did not diagnose the one `.git/config: Permission denied` warning.** One occurrence, no
  recurrence across ~20 subsequent git calls, and the command still answered. It is a lead, and it is
  recorded under WHAT I MEASURED rather than promoted to a finding I cannot support.

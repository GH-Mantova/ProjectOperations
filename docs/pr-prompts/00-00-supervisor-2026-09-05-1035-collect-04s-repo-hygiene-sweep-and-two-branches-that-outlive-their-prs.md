# Station 00 — Supervisor | 2026-09-05T10:35Z–2026-09-05T10:4xZ

Second half of the 10:08Z run. The first half is
`00-00-supervisor-2026-09-05-1008-a-never-arm-prompt-the-linter-admits-and-nothing-else-gates.md`
(landed in `#1653`). This one exists because **Station 04 filed a breadcrumb at 10:21:40Z — after my
COLLECT ran at 10:09Z** — and 00 is the only channel that closes it.

## GROUND

```
UTC            2026-09-05T10:35:00Z
origin/main    9aa68b3b            (moved three times this run: 8e5fc07d -> f6809797 -> 3357fd55 -> 9aa68b3b)
dev tree       main @ 9aa68b3b     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE. SIGHTED throughout (PID 16700). Binding documents were read in the
first half and `git diff --numstat origin/main --` against all three was EMPTY there; `main` has
moved since, but only through my own three merges, none of which touched `docs/pipeline/DOCTRINE.md`,
`STATION-CAPABILITIES.md` or `stations/00-supervisor.md`.

## WHAT I MEASURED

**[MEASURED] 04 ran concurrently with me and its report post-dated my COLLECT.**
`lastRunAt` 2026-09-05T10:09:41.871Z against my 10:08:02.470Z — **99.4 s apart** (F3 of the first
half). Its breadcrumb `00-04-scanner-2026-09-05-1010-…` has `LastWriteTimeUtc` **10:21:40Z**, and
`git ls-files --error-unmatch` on it returned *"did not match any file(s) known to git"* — i.e.
**untracked**, reaching nobody. `check-breadcrumb.mjs --freshness` at 10:34Z now reads
`04 last 2026-09-05T10:10:00Z 0.4h ago (cadence 4h) ok`, where at 10:09Z it read `06:10 … 4.0h`.

**[MEASURED] `superseded/` is a tracked home, and the depth-1 `-LOOPING.md` is genuinely un-ignored.**
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/superseded/` = **307** tracked paths.
`git check-ignore -v docs/pr-prompts/pr-watcher-merge-policy-nested-test-paths-LOOPING.md` → exit 1,
empty; POSITIVE CONTROL `git check-ignore -v docs/qa/qa-findings.md` → exit 0,
`.gitignore:116` — so the empty result is a real "not ignored" and not §9.2's directory-form silence.

**[MEASURED] Both files copied byte-identically, not re-generated**
(`Buffer.compare` asserted): breadcrumb `bytes=22027 ok=true`, LOOPING `bytes=5283 ok=true`.

**[MEASURED] Two of 04's seven findings had already been actioned by me, independently, in the same
hour** — convergence from opposite directions, not duplication: its **F5** (retire the SPENT
`pr-cardui-s5` HOLD) landed in `#1653`, and its `sweep-rotation.json` hand-off landed in `#1654`.

## WHAT CHANGED

1. **04's breadcrumb is now tracked** — added in this PR, so its seven findings reach a clone, CI and
   every later station instead of dying untracked in one dev tree.
2. **`pr-watcher-merge-policy-nested-test-paths-LOOPING.md` retired** to `docs/pr-prompts/superseded/`
   (04's F6). It had **0 commits in all history**, so this is an add-at-the-new-path, not a `git mv`.
3. **This breadcrumb**, written inside this PR's own worktree (cure 1).
4. **Two escalations written to `docs/pr-prompts/needs-marco/`** (F1, F2 below). That directory is
   gitignored at `.gitignore:76-83`, so **they are not in this diff and cannot be** — which is
   exactly why both are also stated in full here, in a tracked file.

Earlier in the same run, already landed: `#1652` merged (10:14:35Z), `#1653` merged (10:27:40Z),
`#1654` merged (10:33:05Z).

**Not changed:** nothing armed. No branch deleted — F1 and F2 both propose deletions and both are
DOCTRINE §5.4 irreversible, so neither is mine. No label touched. `/sot/` untouched. `.gitignore`
untouched, deliberately — see F6.

## FINDINGS

Seven findings from 04's 10:10Z sweep, each given exactly one disposition. That is the whole of this
section: 00 collects, and this is the channel that closes.

### F1 (04's F1) — `fix1483`, a remote branch that outlives a merged PR delete-on-merge cannot see

04 measured `git ls-remote --heads origin` = 5 heads, one being `refs/heads/fix1483` at `9de07267`,
with `gh pr list --head fix1483 --state all` = **0 PRs** (NEG control `zzzNoSuchBranchZzz` → 0; POS
control on a live branch → the open `#1652`). PR #1483's actual head was
`feat/scope-s2-wbs-table-shell`, merged 2026-09-02, and GitHub deleted *that* ref on merge.
`fix1483` is a **second** ref at the same commits, linked to the PR by nothing but a substring in its
name, so no delete-on-merge and no "close the PR, delete the branch" sweep can ever reach it.

**DISPOSITION: ESCALATED.** Deleting a remote branch is §5.4 irreversible and is not mine, and 04
was right not to touch it. Written to `needs-marco/remote-branches-outlive-their-prs-2026-09-05.md`.
I endorse 04's option **(a)** as the complete-and-additive one and put it first: **add a queue check
that lists remote heads with no open PR, and delete `fix1483` by hand once.** It passes both halves
of RULE 1 — it clears today's litter *and* catches every future `fix<N>` twin, and it damages no data
entry, because the check only reports and the single deletion is of commits 04 proved present on
`main`. (b) delete-only fails the future half; (c) leave-it fails the immediate half.

### F2 (04's F2) — a CRM slice was closed unmerged and its only copy is an unreferenced branch

`#1612` (`feat(crm): CRM_ACCOUNT360_V2`) is **CLOSED with `mergedAt` empty**, closed
2026-09-04T22:56:48Z; its branch `feat/crm-account360-v2-s1` is alive at `4638600a`. Both files it
touches exist on `main` — the reading that would let a run write this off — but
`git diff --numstat origin/main 4638600a --` on them returns `904 814` and `235 122`, against a
POSITIVE control (`DOCTRINE.md` at a known-changed commit → `28 405`). **Main and the branch are
materially different code, so the branch holds the only copy.**

**DISPOSITION: ESCALATED — and this is the one with a clock on it.** It is a product question only
Marco can answer (§5.5): **was `#1612` closed because the work was rejected, or because it was
superseded and expected to land another way?** The two answers point at opposite actions on the
branch, and one of the options — deleting it — is unrecoverable. Written to
`needs-marco/pr-1612-closed-unmerged-branch-holds-the-only-copy-2026-09-05.md`.

⚠️ **Standing instruction to every later run, until Marco answers: do NOT delete
`feat/crm-account360-v2-s1`, and do not let any branch-hygiene sweep propose it.** 04's option (c)
is explicitly the one that destroys data.

Worth carrying: the branch tip is a `Merge branch 'main' into …` dated 2026-09-04T22:43:24Z,
**thirteen minutes before the PR was closed** — `PR_WATCHER_AUTO_UPDATE` was still rebasing a branch
whose PR was about to die. That is the same auto-update behaviour already dispatched to 03.

### F3 (04's F3) — watcher clone 40 behind and dirty, but the merge-policy code it runs is identical

04 proved the part that actually matters rather than asserting the scary part: the clone's
`scripts/pr-watcher/index.mjs` and `origin/main`'s are the **same blob** (`901ea012…` both sides,
`--numstat` empty), and the running process (pid 20000, started 2026-09-04T09:37:14Z) loaded that
copy. So DOCTRINE §10.1's `NESTED_TEST_PATHS` paragraph is true of the **running** code, not only of
`main` — which is the first time that has been closed, and it retires a standing worry rather than
adding one.

**DISPOSITION: DISPATCHED — Station 03 (Machine Minder).** Unchanged in substance from the standing
dispatch: fast-forward the clone and clear its two junk untracked files
(`C：temppr-1648.diff`, `.conflict-notified-prs.json`). What is **new** and worth 03 having is the
proof above: the gap is real but is **not** currently a behaviour difference in the merge policy, so
this is hygiene on a clock, not an incident. It still wants closing before any restart, because a
restart adopts nothing (§9.5).

### F4 (04's F4) — never compare file *lengths* across a `git show` / working-copy boundary

04 nearly filed "the clone runs different code" off two stacked instrument lies: the blob is stored
**LF** and the Windows working copy is **CRLF** (delta 3326 == the blob's LF count, exactly), and
`String.length` counts **UTF-16 code units, not bytes** (each side 564 short of its true byte count).
Both exit 0, both look like measurements, and the blob hashes were identical the whole time.

The gap is one bullet wide: §9.3 prescribes "read it with node" as the cure for the PowerShell `>`
trap, and **that cure is what produces the second lie** if you then compare lengths instead of
hashes; §9.5's PREFLIGHT names the three sound forms but scopes them to reading one's own binding
documents.

**DISPOSITION: DEFERRED — with a named trigger and a reason, not for lack of agreement.** 04
dispatched this to 00, i.e. to me, and I am not doing it in this run. `docs/pipeline/DOCTRINE.md`
§9.3 sits inside the hash-gated `instruments v2` canonical block, so the edit requires
`lint-station.mjs --write-canonical` and ships against all seven station docs. That is a
different risk class from the three docs-only sweeps this run has landed, and doing it at the tail of
a long run — mixed into a PR whose other contents are a breadcrumb and a retired prompt — is how a
gated block gets broken for every station at once. **Trigger: the next 00 run takes it as its first
board action, on a clean budget, in a PR of its own.** Nothing is lost by waiting: 04's full
measurement, controls included, is on `main` in its breadcrumb as of this PR, which is precisely what
the DEFERRED disposition is for.

### F5 (04's F5) — retire the SPENT `pr-cardui-s5` HOLD

**DISPOSITION: ACTIONED — already done, in `#1653`, 40 minutes before I read 04's report.** I reached
it from `triage-holds.ps1` (`spent=1 of 79`, SPENT-fixture control passing) and 04 reached it from
the same instrument independently. `git mv` to `superseded/`; verified on `main` at blob
`09546a38…`, and the HOLD count went 79 → **78**. Two lanes, one conclusion, no collision — recorded
because convergence is the strongest evidence shape this pipeline produces, and because a later run
must not read the duplicate as two separate defects.

### F6 (04's F6) — three untracked, un-ignored files loitering in the queue root

**DISPOSITION: split, because the three files are not one problem.**

- `pr-watcher-merge-policy-nested-test-paths-LOOPING.md` (5283 B, **0 commits in all history**) —
  **ACTIONED**, retired to `superseded/` in this PR. It matches no watcher glob, so it was litter
  rather than a board trap, but it is the second `-LOOPING.md` found at depth 1 and the first was
  already retired at 07:08Z.
- `.queue-sync-ledger.txt` and `queue-watch-state.md` (44.9 KB of runtime state between them) —
  **DEFERRED.** 04 asks 00 to decide track-or-ignore. The right answer on doctrine is plainly
  *ignore* — *"instructions live here, state does not"*, and `queue-watch-state.md` is a 4.5-day-old
  snapshot that `status-sweep.ps1` §4C quotes as the "freshest station summary" every single run.
  But the fix is an edit to **`.gitignore`**, which is not under `docs/`, so a PR carrying it falls
  outside `^(tests|docs)/` and hand-classifies as **Marco's** under §10.1 step 2. I will not smuggle
  it into a docs-only board PR to dodge that classification. **Trigger: it goes in the next PR that
  legitimately touches root config, or to Marco as a one-line ask.** Until then the harm is bounded
  and named: any board PR that stages the directory wholesale sweeps them onto `main`, so **stage by
  explicit path, never `git add docs/pr-prompts` wholesale** — which is what I did here.

### F7 (04's F7) — 13 remote-tracking refs against 5 real remote heads

Seven hand-made `refs/remotes/pr/*` refs that no refspec owns, so `--prune` can never remove them;
04 ran `git fetch origin --prune` twice and the count did not move. DOCTRINE §9.2 measured **five**
on 2026-09-03; it is **seven** two days later, so the leak is live at roughly one per day.

**DISPOSITION: DEFERRED**, endorsing 04's own call and its trigger unchanged: harmless while every
reader asks the remote (`git ls-remote --heads origin`), urgent the moment any script counts branches
from `git branch -r`. Worth adding that 04's run **re-confirmed the §9.2 bullet exactly as written**
and found nothing in it needing correction — a rare and useful outcome for a document this heavily
amended.

## WHAT I DID NOT DO

- **I deleted no remote branch.** Both F1 and F2 end in a proposed deletion and both are §5.4
  irreversible. F2's branch is measurably the **only copy** of `#1612`'s code, so deleting it is not
  a tidy-up, it is data loss — escalated, with a standing do-not-delete note for later runs.
- **I did not edit `.gitignore`** to settle F6's two runtime-state files, even though I think the
  answer is obvious. It would have taken the PR outside `^(tests|docs)/` and made it Marco's under
  §10.1 step 2 — and quietly reclassifying my own PR by choosing what to put in it is the exact
  move the lane rules exist to prevent.
- **I did not edit DOCTRINE §9.3** for F4. Deferred with a trigger above: it is a hash-gated
  canonical-block change and deserves its own PR and a clean budget, not the tail of this one.
- **I did not `git add docs/pr-prompts` wholesale** in any of this run's four PRs — every stage was
  by explicit path, which is what kept F6's 44.9 KB of runtime state and Station 04's dirty
  `sweep-rotation.json` out of `#1653`.
- **I did not touch the watcher clone, `C:\po-vg`, or the 66 clone stashes.** All 03's, all already
  dispatched. `C:\po-vg` holds a version of `check-pipeline-heartbeat.mjs` that 04 proved exists
  nowhere else (`9c4587fb…` on disk vs `84ec92d4…` on main) — `--force` would destroy it.
- **I did not re-run 04's measurements.** It is read-only by contract, its numbers carry commands and
  controls, and it re-verified its own load-bearing claims after `main` moved under it. Re-deriving
  them would have cost budget and added nothing; where I *did* independently reach the same answer
  (F5), I have said so rather than presenting it as confirmation I sought.
- **I did not arm anything**, in either half of this run. See F4 of the first-half breadcrumb: the
  cloud lane still holds the `pr-cardui-s*` cluster, `merge-approvals/1651.md` landed 09:23:40Z,
  and `pr-cardui-s6` being ADMIT is the collision, not the opportunity.
- **I did not touch `/sot/`, Azure/Entra/SharePoint, or production data, remove any label, or run a
  `git` write in `C:\po-watcher\ProjectOperations`.**

## HANDOVER

- **Marco — two escalations, both in `needs-marco/` and both stated in full above because that
  directory is gitignored.** F2 is the one that needs an answer: was `#1612` closed as *rejected* or
  as *superseded*? Until you say, nobody may delete `feat/crm-account360-v2-s1`.
- **03 — Machine Minder:** clone fast-forward + two junk files (F3), `C:\po-vg`, the stash count.
  Now with 04's proof that the running merge-policy code is byte-identical to `main`.
- **The next 00 run:** F4's DOCTRINE §9.3 bullet is your first board action, in a PR of its own.
  Then re-test the arming trigger — open `pr-cardui-s*` at zero **and** no new
  `merge-approvals/<N>.md` for a full cadence.

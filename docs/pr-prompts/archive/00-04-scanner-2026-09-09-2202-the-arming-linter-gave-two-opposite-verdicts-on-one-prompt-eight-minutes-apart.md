# Station 04 — Scanner | 2026-09-09T22:02:58Z–2026-09-09T22:27Z

Sweep this run: **repo-hygiene** (rotation position 3 of 4, from `next-sweep.mjs`).
Fresh negative-control needle minted for this run: `zzQq04H20260909T2210` — **spent the moment this
file is tracked; the next run mints its own.**

## GROUND

```
UTC            2026-09-09T22:02:58Z  (start)   2026-09-09T22:27Z (end)
origin/main    f482d1a5
dev tree       main @ 2279d2d9 at start, f482d1a5 at 22:17Z   C:\ProjectOperations2
               ^ a CONCURRENT actor fast-forwarded it MID-RUN. See F5.
doc version    1   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1   (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions AGREE, so this run was not read-only-by-mismatch.

Tree read in: the **dev tree** `C:\ProjectOperations2`, never the watcher clone.
All three binding documents were checked against `origin/main` with the sound form
(`git diff --numstat origin/main -- <path>`, EMPTY = not different; no piped hash — DOCTRINE 9.1):
`DOCTRINE.md` SAME · `STATION-CAPABILITIES.md` SAME · `stations/04-scanner.md` SAME. So the working
copies read this run are byte-equal to `origin/main` and no stale-copy correction was needed.

**Device-bridge git guard: NOT INSTALLED, and it could not be — this is a FINDING, not a stop.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` returned, verbatim and
twice: `bash failed on resume, create, and re-resume … source path … is under Plan9 share "c" which
is not mounted`. The Linux VM is unreachable this run. Per the PREFLIGHT contract a failed install
is a finding and the run carries on; the guard's whole purpose is to refuse `git` against the
mount, and with the VM down **no VM-side call was possible at all**, so the hazard it guards is
absent by construction rather than unguarded. Desktop Commander (the only transport that RUNS
things on the host) was live throughout: **this was a SIGHTED run.**

## WHAT I MEASURED

Every claim below is `[MEASURED]` unless tagged otherwise. Commands are quoted so they can be
re-run.

**Board, from `status-sweep.ps1` captured to a file** (the script returns early and hides its own
section 7 verdict when its output is not captured):
`[LIVE]` 1 open PR (`#1823`, CI 13 pass / 2 fail) · armed `*-ready.md` **0** · watcher node RUNNING
pid 13352 · main CI on `f482d1a5` 4 success / 5 failed — **trunk is red** · section 7 verdict
**CAUTION**, one live station worktree (`C:/po-worktrees/pr1823`, age 1 min). I am read-only on the
board, so CAUTION permitted this run to proceed; **nothing was mutated.**

**Scheduled tasks, from the scheduled-tasks MCP** (the only live schedule — never a folder, never
this file): `00-supervisor` **`enabled: false`**, `lastRunAt 2026-09-08T05:08:37Z`; `04-scanner`
enabled, `lastRunAt 2026-09-09T22:01:57Z`; `05-sot-keeper` enabled, `lastRunAt 2026-09-09T22:01:58Z`
— **04 and 05 fired one second apart**; `03-machine-minder` enabled, `lastRunAt 2026-09-08T23:01:39Z`;
`weekly-security-audit` enabled.

**Board trap — tracked `*-ready.md` at depth 1: ZERO.**
`git ls-tree -r --name-only origin/main -- "docs/pr-prompts/"` → **925** paths (trailing slash and
`-r`, per DOCTRINE 9.2; no glob in the pathspec, filtering done client-side). Depth-1 subset **58**:
`*-ready.md` **0** · `*-HOLD.md` **42** · `*-LOOPING.md` **0** · other **16**.
POSITIVE control (a filter known to match) → **264**. NEGATIVE control `zzQq04H20260909T2210` → **0**.
Re-checked after the mid-run fast-forward, unchanged: 0 and 42.

**Remote heads — asked the REMOTE, not the local cache.** `git ls-remote --heads origin` → **10**;
`git branch -r` → **32**, i.e. the local cache over-reports by 22 (DOCTRINE 9.2, refs no refspec
owns — not a new finding). Each non-`main` head resolved with `gh pr list --head <b> --state all`
and compared with `gh api …/compare/main...<b>`:

| head | PR | state | ahead/behind | safe to delete? |
|---|---|---|---|---|
| `chore/sweep-breadcrumbs-20260907-0934` | #1778 | MERGED | 5 / 52 | yes |
| `feat/verdict-home-resolver` | #1703 | CLOSED unmerged | 3 / 116 | yes — work landed |
| `feat/verdict-home-resolver-v1` | #1707 | CLOSED unmerged | 3 / 116 | yes — work landed |
| `fix/verdict-home-resolver-v1` | #1708 | CLOSED unmerged | 2 / 116 | yes — work landed |
| `fix/verdict-home-resolver-v1-impl` | #1705 | CLOSED unmerged | 1 / 118 | yes — work landed |
| `fix/classify-policy-nested-tests` | #1571 | CLOSED unmerged | 1 / 247 | yes — work landed |
| `fix1483` | **no PR ever** | — | 28 / 311 | yes — snapshot of #1483, MERGED |
| `feat/crm-account360-v2-s1` | #1612 | CLOSED unmerged | 2 / 206 | **NO — only copy** |
| `feat/ea-gate-reporting-team-permission` | #1823 | OPEN | — | no, live |

Landing evidence, with controls: `VERDICT_HOME_RESOLVER` → **6** on `origin/main:scripts/pr-watcher/index.mjs`
and `scripts/pr-watcher/__tests__/verdict-home-resolver.test.mjs` is tracked; `NESTED_TEST_PATHS` → **3**;
POSITIVE control `classifyPolicyFiles` → **2**; NEGATIVE control `zzQq04H20260909T2210` → exit 1.
`fix1483` carries `docs/decisions/merge-approvals/1483.md`, and that receipt **is on `origin/main`**
(POSITIVE control: 71 receipts tracked), so #1483 landed with its signature.
`feat/crm-account360-v2-s1` adds `apps/web/src/pages/crm/__tests__/crmui-account360-s1.test.ts`
(+300 lines) that exists nowhere else — the existing escalation
`needs-marco/pr-1612-closed-unmerged-branch-holds-the-only-copy-2026-09-05.md` is **still true**.

**`ahead_by` is NOT evidence of unlanded work** — every squash-merged head reads diverged forever.
`chore/sweep-breadcrumbs-20260907-0934` is ahead 5 with its PR merged. Content, not commit count,
decided every row above.

**Orphaned worktree `C:\po-vg`** — `git worktree list` from the dev tree: three entries, of which
`C:/po-vg 23c91ba9 [fix/no-rebase-while-checks-run]`, age 8051 min (5.6 days), which `status-sweep`
tags *"HOLDS UNCOMMITTED WORK (1 file). PRESERVE OR COMMIT BEFORE PRUNING."*
`git -C C:\po-vg status --porcelain` → exactly one line: `?? scripts/pipeline/check-pipeline-heartbeat.mjs`.
That path **is tracked on `origin/main`** (POSITIVE control: 86 tracked paths under `scripts/pipeline/`).
Blob comparison, sound forms only, no pipe:

```
git rev-parse origin/main:scripts/pipeline/check-pipeline-heartbeat.mjs   -> 84ec92d4…  (6746 bytes)
git -C C:\po-vg hash-object scripts/pipeline/check-pipeline-heartbeat.mjs -> 9c4587fb…  (6144 bytes)
git hash-object  scripts/pipeline/check-pipeline-heartbeat.mjs (dev tree) -> 84ec92d4…  (identical to main)
POSITIVE control, a file known identical: DOCTRINE.md -> 289eb32f… on both sides
```

`git diff 9c4587fb 84ec92d4` → 35 lines; lines present ONLY in the po-vg draft: **two**
(`export function parsePause(text) {` and one guard clause), both refactored, not lost —
`parsePause` is on `origin/main` (2 hits) and is exercised by
`scripts/pipeline/__tests__/pipeline-heartbeat.test.mjs` (19 hits). Main's copy landed
**2026-09-04T21:38Z** via `992b2479` ("wire up the heartbeat, and bound its pause", #1594); the
po-vg copy's mtime is **2026-09-04T07:55Z**, fourteen hours EARLIER.

**Stash and clone drift.** dev tree `git stash list` → **0**; watcher clone → **70** (69 at the last
recorded reading, so still growing, still a closed loop). Clone HEAD `533604dc`, its own
`origin/main` `f482d1a5`, **3 behind**, and `git merge-base --is-ancestor` exit 0 — clean drift, no
divergence.

**HOLD triage, `triage-holds.ps1`, read-only, run twice.** Its own controls passed both times
(`GIT control: PASS`, `SPENT control: PASS` on a fixture). 37 `*-HOLD.md` **on disk** at depth 1:
spent **1**, gates-satisfied **8**, still-gated **28**, unreadable **0**, spent-behind-a-reject **0**.
The one SPENT is `pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md`.

**The six HOLDs `triage-holds.ps1` cannot see.** 42 are tracked on `origin/main`; 37 are on disk.
`triage-holds.ps1` globs the DISK, so the six whose deletion is uncommitted are never evaluated by
it. The deletions are genuinely uncommitted, proved with the probe DOCTRINE 9.2 prescribes rather
than from ` D` in `git status` — `git diff --numstat origin/main -- <path>` returned a non-empty row
for all six (e.g. `0 219 docs/pr-prompts/pr-tfm-s11-copy-recursive-preserve-HOLD.md`), and EMPTY for
`pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md`, which is present on both sides. Each of the six was
extracted from `origin/main` with node and linted directly:

| HOLD, from `origin/main` | lint | its PR |
|---|---|---|
| `pr-brandtheme-s0-token-foundation` | exit 3 SPENT | #1820 MERGED |
| `pr-rates-consumers-s3-persona-export` | exit 3 SPENT | #1821 MERGED |
| `pr-stationcaps-blind-run-names-one-mount` | exit 3 SPENT | — |
| `pr-brandtheme-s1-apply-the-saved-scheme` | **exit 0 ADMIT** | #1819 MERGED |
| `pr-ea-gate-report-self-filter` | **exit 0 ADMIT** | #1823 OPEN |
| `pr-tfm-s11-copy-recursive-preserve` | **see F5** | #1822 MERGED |

`brandtheme-s1`'s ADMIT is not an artifact: its premise
`! grep -rq "documentElement.style.setProperty" apps/web/src` still evaluates TRUE against
`origin/main` (the needle returns 0 hits, NEGATIVE control exit 1) although #1819 merged. That is a
premise that did not die on landing.

**`-LOOPING` litter is inert.** `pr-watcher-verdict-home-resolver-LOOPING.md` has sat untracked at
depth 1 of the queue root since 2026-09-05T23:31Z; two siblings sit correctly in `superseded/`.
`git grep -- "LOOPING" origin/main -- scripts/` returns exactly **one** hit, a string literal inside
`__tests__/verdict-guard.spec.mjs` (POSITIVE control, `-ready.md` in `scripts/` → 41). **No script
globs `-LOOPING`**, so it arms nothing.

**A `Get-Content` mojibake reading was NOT corruption.** `needs-marco/stale-remote-heads-and-auto-delete-2026-09-08.md`
renders em dashes as `â€"` under PS 5.1. Checked in the BYTES with node before calling anything
corrupt, as DOCTRINE 9.3 requires: 3204 bytes, `U+FFFD` **0**, CP1252 double-encode signature **0**.
The file is clean UTF-8; the mojibake was in the reader. Trap reproduced live, finding correctly not
filed.

**Queue folder census** (all gitignored except the root): `processed` 4268 · `archive` 669 ·
`superseded` 379 · `needs-marco` 171 · `blocked` 137 · `no-pr-opened` 109 · `failed` 43 · `paused` 10 ·
`awaiting-review` 0 · `reviewed` ABSENT.

## WHAT CHANGED

**On the board: nothing.** No prompt was armed, disarmed, renamed, moved or deleted; no PR was
opened, merged, labelled or closed; no branch was created or deleted; no worktree was pruned; no
file under `/sot/` was touched; nothing was committed or pushed.

Two writes, both outside the board:

1. `docs/pipeline/sweep-rotation.json` — advanced with
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-09T22:02:58Z`, which printed
   `advanced: last_index=2 last_run_utc=2026-09-09T22:02:58Z`. Read back:
   `git diff --numstat -- docs/pipeline/sweep-rotation.json` → `1 1`. **LEFT DIRTY DELIBERATELY.
   Station 00 commits it; 04 may not commit to the shared dev tree.**
2. This breadcrumb, untracked at `docs/pr-prompts/`. It stays untracked until a board PR sweeps it
   up. **It is one of TEN uncommitted breadcrumbs — see F6.**

Scratch files written outside the repo, at `C:\po-sup-fix-scripts\`: the captured sweep, two triage
captures, `premise-probe.mjs`, `fixture-build.mjs`, and the `holdprobe/` + `fixtures/` directories.
None is in the repo and none can arm anything.

## FINDINGS

### F1 — the arming linter returned two opposite verdicts on one unchanged prompt, eight minutes apart, and the error ran toward ARM

`lint-prompt.mjs`, same file, same command, same prompt bytes, nothing about the prompt changed:

```
≈22:12Z   node scripts/pipeline/lint-prompt.mjs …/pr-tfm-s11-copy-recursive-preserve-HOLD.md
          -> exit 0   PROMOTE   GATE_RELEASED requires_on_main … "is now on origin/main — HOLD is ready to promote."
22:17:41Z same command
          -> exit 3   STALE     "Premise no longer holds … The work is ALREADY DONE."
22:2xZ    same command, and the identical six-file loop that produced the first reading
          -> exit 3   (reproduced twice)
```

Between the two readings a **concurrent actor fast-forwarded the shared dev tree**:
`git reflog` → `f482d1a5 HEAD@{2026-09-10 08:15:20 +1000}: merge origin/main: Fast-forward`
(= 2026-09-09T22:15:20Z), and the mtime of
`apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts` — **the exact file that
prompt's premise greps** — is `2026-09-09T22:15:20Z`. That commit is #1822, the PR that shipped this
very prompt's work 22 hours earlier.

I first hypothesised that a released `requires_on_main` gate short-circuits the premise. **A fixture
whose truth is known by construction REFUTED that**, and the refutation is recorded so nobody
re-derives it: three fixtures built from the real prompt so the schema is valid by construction —
(A) released gate + premise `'false'` → **exit 3**; (B) no gate + premise `'false'` → **exit 3**;
(C) released gate + premise `'true'` → **exit 0 PROMOTE**. A dead premise bins the prompt whether or
not a gate has just released. The gate is not the mechanism.

What IS measured, on a fixture, is the direction of failure. `runPremise` executes the premise
through bash with `cwd = repoRoot`, and these premises are `!`-prefixed:

| fixture premise | exit | lint reads it as |
|---|---|---|
| `true` — POSITIVE control | 0 | premise TRUE, work still needed |
| `false` — NEGATIVE control | 1 | premise FALSE, SPENT |
| `! grep -q "anything" apps/api/src/zzQq04H20260909T2210/nope.ts` — **path does not exist** | **0** | **premise TRUE, work still needed** |

**A `!`-prefixed premise whose target file is unreadable reports "work still needed."** `grep` fails,
`!` inverts the failure, and the prompt becomes an arming candidate. A checkout that is rewriting
that file makes it unreadable for exactly as long as it takes to write.

`[CANNOT MEASURE]` the file's byte state at 22:12Z — it is gone, overwritten by the fast-forward. So
I cannot close the last inch between *"the premise ran mid-checkout"* and some other cause. What is
not in doubt: **the verdict was not stable across a concurrent tree rewrite, the unstable reading was
`PROMOTE`, and `PROMOTE` is what an arming decision goes looking for.**

**Blast radius on today's board is ZERO, and that is measured, not assumed.** `triage-holds.ps1` was
run once before the fast-forward and once after; `Compare-Object` over the two captures → **0 diff
rows** (POSITIVE control, a capture compared with itself → 0). No on-disk HOLD has a premise touching
#1822's files. The mechanism is live; it did not bite this board this run.

DOCTRINE 9.2 already records that the dev tree's **index** is shared between concurrent actors. This
adds that the **working tree** is too, that the arming instrument greps it with no interlock, and
that the failure is not symmetric.

**RULE 1 options for whoever fixes this, complete-and-additive FIRST:**

- **(a) Make the verdict assert its own tree.** Have `lint-prompt.mjs` record `HEAD` (and a dirty
  marker) before the first probe and re-read it after the last, and refuse to emit a verdict —
  exiting a distinct non-arming code — if the tree moved underneath it. Complete: it covers every
  premise, every gate probe and every future one, not just `!` greps. Additive: it removes no
  verdict that was ever sound, and a refusal costs one re-run. **Passes both halves of RULE 1.**
- **(b) Make `!`-premises fail CLOSED.** Require every premise to prove its target is readable before
  inverting — e.g. `test -f <path> && ! grep -q …`. Fails the FUTURE half: it must be written into
  every prompt one at a time, and the next prompt author who forgets re-opens it silently.
- **(c) Serialise: an advisory lock so no station lints while another fast-forwards.** Fails the
  IMMEDIATE half — it does not make a verdict already taken honest, and a lock nobody holds is the
  0-byte `index.lock` failure mode this pipeline already has three occurrences of.

**DISPATCHED → Station 00.** The interlock is a `scripts/` change, outside 04's lane to merge and
outside 00's supervised lane to self-merge; 00 owns arming and is the actor the wrong reading would
have misled. Everything needed to re-run this is above: the reflog line, the three fixtures, the
three-row premise table, and the two bracketing triage captures.

### F2 — the orphan worktree `C:\po-vg` holds NO unique work, so the warning that has protected it for 5.6 days is refutable today

`status-sweep.ps1` has said *"HOLDS UNCOMMITTED WORK (1 file). PRESERVE OR COMMIT BEFORE PRUNING;
`git worktree remove` will refuse, and `--force` would discard it"* on every run since 2026-09-04.
That warning is correct as a rule and **wrong about this file**: its one untracked file is a
6144-byte draft of `scripts/pipeline/check-pipeline-heartbeat.mjs`, and the 6746-byte successor
landed on `origin/main` fourteen hours later in `992b2479` (#1594). The only two lines unique to the
draft are a refactored function signature and a guard; `parsePause` survives on main and is tested
there. Blob hashes, byte counts, the diff and the positive control are in the measurement section.

So the worktree can be pruned without preserving anything, and the standing "preserve" advice on
this particular tree can be retired. `C:\po-vg` has been orphaned 8051 minutes and is the older half
of the two-worktree count every sweep reports.

**DISPATCHED → Station 03.** Worktree pruning is the machine-minder's lane and read-only-report is
mine; 03 already carries an open dispatch naming this tree, and this supplies the evidence that
dispatch was missing. 03 should still list the file itself before acting — the probe is
`git -C C:\po-vg status --porcelain`, and the blob comparison above is the discharge.

### F3 — six consumed HOLDs are still tracked on `origin/main`, three of them read ADMIT, and the triage instrument cannot see any of them

42 `*-HOLD.md` are tracked at depth 1 on `origin/main`; 37 are on disk. `triage-holds.ps1` globs the
disk, so the six whose deletion is uncommitted are outside its corpus entirely — they appear in no
bucket, not even as unreadable. Linted directly from `origin/main`, three are SPENT and **three read
`exit 0 ADMIT`**: `pr-brandtheme-s1-apply-the-saved-scheme` (#1819 MERGED), `pr-ea-gate-report-self-filter`
(#1823 OPEN) and `pr-tfm-s11-copy-recursive-preserve` (#1822 MERGED, and the subject of F1).

They are harmless **only because they happen to be deleted on disk** — an accident of an uncommitted
deletion, not a guard. Any `git checkout`, `reset --hard`, fresh clone, new worktree, or the watcher
clone's own fast-forward restores all six from `main`, and three of them then present as arming
candidates for work that is merged or already open. That is the board trap, loaded, with the safety
catch held by a `git status` entry nobody has committed.

`brandtheme-s1` is worse than a checkout hazard: its premise is TRUE against `origin/main` today
(`documentElement.style.setProperty` → 0 hits in `apps/web/src`, NEGATIVE control exit 1) while its
PR merged on 09-08. Either the merged work did not do what the prompt asked, or the premise never
inverted on landing. Both are worth a look, and neither is 04's to decide.

**DISPATCHED → Station 00.** The cure is one board PR committing six deletions that are already sat
in the working tree, plus retiring the three SPENT ones to `superseded/`. 00 is the only station that
may commit to the queue. Until it runs, the trap stays armed — which makes this finding downstream of
F6.

### F4 — eight stale remote heads, unchanged two days after they were escalated, and the classification still holds

`git ls-remote --heads origin` returns the same **10** heads as on 2026-09-08T02:10Z: `main`, one
live PR branch, and eight spent ones. Seven are safe to delete and one
(`feat/crm-account360-v2-s1`) must be kept because it is the only copy of a 300-line test file. Every
row was re-derived this run from the remote and from `gh`, not carried over — the table and its
controls are in the measurement section, and the classification is unchanged.

The ask is already on file at `needs-marco/stale-remote-heads-and-auto-delete-2026-09-08.md` (option
(a): enable *Automatically delete head branches*, then delete the seven once by hand) and at
`needs-marco/remote-branches-outlive-their-prs-2026-09-05.md`. Both are unanswered. A repository
setting and a branch deletion are Marco's under DOCTRINE 5's irreversible clause, so no station may
act.

**ESCALATED — already raised, re-verified, NOT re-filed as new.** The only thing this run adds is
that nothing moved in two days and the classification survives re-measurement at `f482d1a5`. **Do not
open a third file for it.**

### F5 — Station 00 has been disabled for 41 hours, ten breadcrumbs are uncollected, and the collect channel is the one that closes findings

From the scheduled-tasks MCP, which is the only live schedule: `00-supervisor` is
**`enabled: false`**, `lastRunAt 2026-09-08T05:08:37Z` — **41 hours** before this run, against a
`5 * * * *` cron.

The measured consequence, in the dev tree right now: **ten** breadcrumbs sit untracked at
`docs/pr-prompts/` — one from 03, one from 05, seven from earlier 04 runs, and this one. Six
consumed-HOLD deletions and the advanced `sweep-rotation.json` sit uncommitted for the same reason.
STATION-CAPABILITIES section 7 names 00's collect as *the only channel that closes*: with 00 off,
every DISPATCHED and ESCALATED disposition written by 03, 04 and 05 since 09-08T05:08Z has gone
nowhere, including F1 and F2 above. **This finding is upstream of F3 and of every dispatch in this
file.**

Already escalated at `needs-marco/station-00-is-disabled-and-nothing-collects-2026-09-08.md`
(2026-09-08T22:25Z). Whether 00 is off deliberately is Marco's to say and no station may re-enable a
scheduled task. Worth stating plainly for whoever reads this: `scheduled-tasks.json` is rewritten
from memory when the desktop app exits, so an `enabled: false` and an `enabled: true` are both
survivable-by-accident — the state should be confirmed, not assumed either way.

**ESCALATED — already raised, re-stamped with the current gap and the current uncollected count.
Do not open a second file.**

### F6 — one SPENT HOLD on disk, and inert litter in the queue root

`pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md` lints **exit 3 SPENT** — its work has shipped — and is
present both on disk and on `origin/main` (`git diff --numstat origin/main` → EMPTY, so no
uncommitted change). It belongs in `superseded/`. It is a `pr-sot-*` prompt, i.e. **Station 05's
lane**: 04 surfaces it and does not touch it.

`pr-watcher-verdict-home-resolver-LOOPING.md` has sat untracked at depth 1 of the queue root since
2026-09-05T23:31Z while two `-LOOPING` siblings sit correctly in `superseded/`. Measured harmless:
no script on `origin/main` globs `-LOOPING` (one hit, a string literal in a spec file; POSITIVE
control `-ready.md` → 41), so it arms nothing and is cosmetic only.

**DEFERRED.** Neither costs anything today. What would make the first urgent is Station 05 running a
`sot/` reconcile that trips over its own spent prompt; what would make the second urgent is any
change that starts globbing the queue root by suffix rather than by the `-ready.md` literal.

### F7 — the watcher clone's stash is still a closed loop, and the clone is 3 behind

`git -C C:\po-watcher\ProjectOperations stash list` → **70** entries (dev tree: 0). The launcher's
preflight stashes on every start and nothing ever pops, exactly as DOCTRINE 9.2 records; the count
has grown by one since the last recorded reading. Clone HEAD `533604dc` is **3 behind** `f482d1a5`,
`merge-base --is-ancestor` exit 0, so it is clean drift and not divergence.

Both belong to the open escalation
`needs-marco/nobody-may-fast-forward-the-watcher-clone-2026-09-07.md`: 00's ABSOLUTE forbids
`git merge` in the clone and 03 declines on report-only, so the fast-forward belongs to nobody. The
cure for the stash is `git stash drop`, never `pop`.

**ESCALATED — already raised, re-verified only. Do not open another file.** Counts are state:
re-measure them, never quote these.

## WHAT I DID NOT DO

- **Did not mutate the board in any way.** `status-sweep.ps1` section 7 returned **CAUTION** with a
  live station worktree at `C:/po-worktrees/pr1823` (age 1 min); 04 is read-only, so this was not a
  blocker, but nothing was armed, merged, labelled, moved or deleted regardless.
- **Did not stage a prompt.** 04 may stage a lint-clean `-HOLD`, and F1 deserves one. I did not,
  because 00 is disabled (F5): a staged prompt would sit in a queue nobody is collecting while adding
  a seventh uncommitted file to a tree whose uncommitted state is itself F3. Dispatching costs
  nothing and rots less. Said here so the choice is visible rather than silent.
- **Did not delete, prune or fast-forward anything** — not the eight stale remote heads (Marco's,
  DOCTRINE 5 irreversible), not `C:\po-vg` (03's), not the clone's 70 stashes (03's), not the clone's
  3-commit drift (nobody's, and that is F7).
- **Did not commit `sweep-rotation.json`, the six HOLD deletions, or this breadcrumb.** 04 may not
  commit to the shared dev tree; 00 does. `sweep-rotation.json` is named here so it is not lost.
- **Did not enable or alter any scheduled task**, including `00-supervisor`. The scheduled-tasks
  layer is not this repo and a station does not change its own or another's schedule.
- **Did not touch `/sot/`** — 05's lane, including `pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md`,
  which is surfaced in F6 and left exactly where it is.
- **Did not re-file F4, F5 or F7 as new escalations.** Each already has a `needs-marco/` file; a
  second file for a live ask splits the answer.
- **Did not run Part 2, the live-site visual pass.** The Linux VM was down all run and the sweep
  rotation named repo-hygiene; a live pass would have been a shallow pass over everything, which is
  the failure the rotation exists to prevent.
- **`[CANNOT MEASURE]`, stated rather than reasoned around:** the byte state of
  `sharepoint-legacy-copy.service.ts` at 22:12Z (overwritten by the concurrent fast-forward), and
  therefore the last inch of F1's causal chain; and anything requiring the Linux VM, which refused
  `resume`, `create` and `re-resume` twice.

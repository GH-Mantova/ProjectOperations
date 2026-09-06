# Station 00 — Supervisor | 2026-09-06T03:08:32Z–2026-09-06T03:30Z

## GROUND

```
UTC            2026-09-06T03:08:32Z
origin/main    4a0209db  at run start  →  75a00730  at board time (#1687 merged mid-run)
dev tree       main @ 3bdc0b0f at run start, fast-forwarded twice → 75a00730   C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **AGREE** — this run was not restricted to read-only on that account.

**SIGHTED.** `start_process` shell `powershell.exe` → PID 35740 on the first attempt, after loading
the Desktop Commander schemas with a keyword `ToolSearch` (PREFLIGHT step 1: a validation error is
not blindness). Saying so plainly because a blind run and a healthy quiet run both produce "no news".

All three binding documents read **in full** from the dev tree, after proving the dev tree is not
stale for them: `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md` → **EMPTY** [MEASURED].
Empty numstat is the sound form; §9.1 forbids the piped-hash comparison.

`scripts/pipeline/status-sweep.ps1` run three times, each captured to a **file** so its §7 verdict
could not be lost to an early return: **03:09:37Z SAFE TO ACT** · **03:17:25Z CAUTION** (PRs touched
inside 2 min — the poller, finding B) · **03:2xZ SAFE TO ACT** after waiting 100 s. Every mutation
below was made inside the third window, in an isolated worktree, touching only a new branch.
Section 0 instrument controls PASS on all three.

⚠️ The sweep is written with PowerShell `*>`, which is **UTF-16LE** (§9.3) — a naive `grep` over the
capture file returns **zero lines** and reads as an empty report. Decode it (`utf16le` in node, or
`iconv`) before believing any absence in it. Cost this run: one wasted probe.

## WHAT I MEASURED

### COLLECT — nothing new since my last run, and the freshness table is clean

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`,
`structure: 1 checked, 0 malformed`:

```
00  last 2026-09-06T02:08:00Z   1.1h ago  (map cadence 2h)  ok
03  last 2026-09-05T23:01:00Z   4.2h ago  (cadence 24h)     ok
04  last 2026-09-06T02:10:00Z   1.0h ago  (cadence 4h)      ok
05  last 2026-09-05T14:11:00Z  13.0h ago  (cadence 24h)     ok
02  dispatch-only — no cadence to miss
```

No station is SILENT, so no transcript read was required. The **only** breadcrumb in the queue root
is my own 02:08Z one, every finding in it already dispositioned by that run; 04's 02:10Z and 03's
23:01Z were collected and archived by the 02:08Z run. **This run's COLLECT is therefore one file and
one action: archive it.** It is `git mv`'d to `archive/` in this PR.

⚠️ **`ok` for 00 is still the weaker statement** (STATION-CAPABILITIES §6): `check-breadcrumb.mjs`'s
`CADENCE` map says `'00': 2` while the live cron is `5 * * * *`. Not re-raised — escalation #23 owns it.

### Board — five open at 03:1xZ, four at board time, **zero red** throughout

[MEASURED] `gh pr view --json headRefOid,mergeStateStatus,statusCheckRollup` per PR at 03:12Z:

| PR | mergeState | head | pass / fail / pending | lane | classification |
|---|---|---|---|---|---|
| **#1687** | BLOCKED | `db246070` | 13 / **0** / 1 (`tendering-e2e` in flight) | second lane | hand-classified **Marco's** |
| **#1685** | CLEAN | `536a8796` | 14 / 0 / 0 | watcher | `marco:true` — RULE 2 binds |
| **#1680** | CLEAN | `1f920431` | 14 / 0 / 0 | watcher | `marco:true` — RULE 2 binds |
| **#1675** | CLEAN | `48a74a57` | 14 / 0 / 0 | watcher | `marco:true` — RULE 2 binds |
| **#1667** | CLEAN | `6932895b` | 14 / 0 / 0 | second lane | hand-classified **Marco's** |

`main` CI on `4a0209db`: 4 success / 0 failed (trunk green). **#1687 then merged at 03:14:49Z**
without this run touching it (finding C); `origin/main` → `75a00730`.

### RULE 2 — live tree pinned, both controls, lane discriminator run as a separate instrument

[MEASURED] Probe directory `C:\ProjectOperations2\docs\pr-prompts\processed` — **1,976** `*.log`,
newest `rev-1687-ready.md.log` at `2026-09-06T03:09:27Z`, younger than every open PR. **That AGE, not
`POS>0`, is what separates it from the `C:\po-watcher\ProjectOperations\…` decoy** that is stale to
2026-08-17 and passes its own positive control while clearing every PR since (§9.5).

```
POSITIVE  marco.:true  over pr-*.log        →  615   (regex form; the . matches the quote)
NEGATIVE  zzQq00N20260906T0311               →    0   (minted this run — now spent, §9.6)
```

Per-PR, matching `PR #<n>` in the **body** of `pr-*.log` only (never `rev-*`, never the branch):
#1685 → 2, incl. `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/prisma/seed-initial-services.ts"}` ·
#1680 → 2, incl. `…"reason":"outside tests/ or docs/: package.json"` ·
#1675 → 1, `…"reason":"timeout waiting for green checks + MERGE verdict"` ·
**#1687 → 0** · **#1667 → 0**.

[MEASURED] The lane discriminator, a **different instrument** (`C:\po-watcher\watcher-launch.log`;
POS control `opened PR #` → **167**, NEG `opened PR #999999` → **0**):
`opened PR #1685` → 1 · `#1680` → 1 · `#1675` → 1 · **`#1687` → 0** · **`#1667` → 0**.

Hand-classification under §10.1 step 2, reading `NESTED_TEST_PATHS`' three forms:
**#1687** — carries `apps/api/prisma/migrations/20260906000000_scope_card_stage_group/migration.sql`,
so `classifyPolicyFiles` refuses it on its own `(^|/)migrations/` clause ⇒ **Marco's**.
**#1667** — `scripts/pipeline/lint-prompt.mjs` matches none of the three forms ⇒ **Marco's**.
Neither falls under §10.1 step 3's station-lane exception: `scripts/` and `apps/` are in no station's
recorded authority.

**`[NO LANE VERDICT — hand-classified]` for #1687 and #1667. Five open, five Marco's, none mine to merge.**

### The measurement that turned the run

[MEASURED] `C:\po-watcher\watcher-launch.log`, NEG control `zzQq00N20260906T0322` → 0:

```
[2026-09-06T02:13:29.694Z] [update] PR #1685 is BEHIND but checks in flight (tendering-e2e) — not rebasing
'checks in flight'              →  320   guard fires, lifetime
'branch updated (was BEHIND)'   →  995   lifetime;  19 since 2026-09-06T00:00Z
```

That log line **is** the guard that three separate artifacts say is sitting unpushed on one disk. See
finding A.

## WHAT CHANGED

**On the board: nothing.** No merge, no label added or removed, no branch pushed to, no arm, no
`/sot/` edit, no receipt authored. Armed was **0** at 03:09Z and **0** at 03:2xZ, counted by listing
the queue root and excluding `rev-*`.

**In `needs-marco/` (gitignored, so also reported here in full — DOCTRINE's report contract):**
three escalation files corrected in place with node, **byte delta asserted on each**, prefix proved
intact, `U+FFFD` = 0 on each (§9.3: never a `String.replace` replacement string; these are pure
appends built by `Buffer.concat`):

| file | before | after | actual Δ | intended Δ | MATCH |
|---|---|---|---|---|---|
| `po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md` | 4715 | 8647 | 3932 | 3932 | **true** |
| `hourly-board-pr-rebases-every-waiting-pr-2026-09-03.md` | 3793 | 6268 | 2475 | 2475 | **true** |
| `cp26-passes-vacuously-on-an-unlabelled-destructive-migration-2026-09-05.md` | 3438 | 5570 | 2132 | 2132 | **true** |

Nothing was deleted, moved or discharged. Each correction is appended below the original text, dated,
measured, and carries its own re-open condition.

**In the repo, via this PR:** this breadcrumb, and the `git mv` of the 02:08Z breadcrumb to
`docs/pr-prompts/archive/`. Built in an **isolated worktree** off `origin/main`
(`C:\po-worktrees\board-0308`, clean at `75a00730`), never in the shared dev tree index and never in
`C:\po-watcher`.

## FINDINGS

### A — [S1] The "unpushed fix" three runs have escalated for two days **has been on `main` since 2026-09-04**. All three read a branch probe as a change probe. **ACTIONED**

`needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md` says the commit
`23c91ba9 fix(pr-watcher): never rebase a PR whose checks are still running`, with its 88-line guard
test, is *"written, tested, and on exactly one disk"*, and asks Marco to push it. Station 04's 02:11Z
run confirmed the branch absent from the remote; my own 02:08Z run carried it as finding D at "~42 h".

**It is refuted. [MEASURED], with controls:**

```
git log --oneline -S 'checks in flight' origin/main -- scripts/pr-watcher/index.mjs
  b42dcc36 fix(pr-watcher): never rebase a PR whose checks are still running (#1577)
gh pr view 1577 --json state,mergedAt   →  MERGED 2026-09-04T08:15:06Z

git diff --numstat origin/main 23c91ba9 -- scripts/pr-watcher/index.mjs \
                                           scripts/pr-watcher/__tests__/update-branch-guard.test.mjs
  EMPTY                                  ←  both files byte-identical to origin/main

git cat-file -e origin/main:scripts/pr-watcher/__tests__/update-branch-guard.test.mjs  → exit 0
  POSITIVE  origin/main:scripts/pr-watcher/index.mjs                                   → exit 0
  NEGATIVE  origin/main:scripts/pr-watcher/zzQq00N20260906T0327.mjs                     → exit 128, LOUD
```

**#1577 merged 15 hours before the escalation was filed.** And the guard is not merely present, it is
**running**: 320 lifetime fires, the most recent against this very board at 02:13:29Z on #1685.

🔴 **The shape of the error is the finding.** All three artifacts used
`git ls-remote --heads origin <branch>` → EMPTY plus `git merge-base --is-ancestor` → exit 1. **Both
readings are TRUE.** They answer *"is this BRANCH on the remote?"*. The question was *"did this
CHANGE reach `main`?"* — and a squash merge under a different branch name satisfies the second while
failing both halves of the first. That is DOCTRINE §9.6 exactly: an empty result read as an empty
world, three times, by three actors, over two days, each one citing the previous as corroboration.

🔧 **The probe that answers it**, and the one to reach for whenever a branch looks orphaned:
`git log -S '<distinctive string from the change>' origin/main -- <path>`, or
`git diff --numstat origin/main <sha> -- <paths>` where **EMPTY means already there**. Never
`ls-remote` alone. This generalises directly to 04's F2 (three remote heads with no open PR) — *"not
on the remote"* and *"not on main"* are different claims and the second is the one that matters.

**ACTIONED** — the correction is written into the escalation file with its controls, and this
breadcrumb is its tracked home. **DO NOT push `fix/no-rebase-while-checks-run`**: its entire diff
against `main` is empty, so the PR would be empty. **Re-open condition:**
`git diff --numstat origin/main 23c91ba9 -- scripts/pr-watcher/index.mjs` returning non-empty.

### B — [S2] The auto-update poller rebased all four waiting PRs twice in twenty minutes. The churn is real; the "missing guard" half of its own escalation is not. **ACTIONED** (narrowed, not re-filed)

[MEASURED] in lockstep, seconds after each merge to `main` (`#1686` 02:34Z, `#1682` 02:52Z):

```
02:35:32Z #1685   02:35:35Z #1680   02:35:38Z #1675   02:35:41Z #1667
02:55:32Z #1685   02:55:35Z #1680   02:55:38Z #1675   02:55:41Z #1667
```

Every head the 02:08Z run recorded had moved by 03:12Z — `#1685` `b20182c0`→`536a8796`, `#1680`
`55968733`→`1f920431`, `#1675` `9414c796`→`48a74a57`, `#1667` `6fd3b836`→`6932895b` — and `#1675`
went 9 checks → 14, a full re-run. 19 rebases in the 3.1 h since midnight UTC.

`needs-marco/hourly-board-pr-rebases-every-waiting-pr-2026-09-03.md` option (a) asks for two things:
batch the board PRs **and** add the missing *"don't auto-update a PR whose checks are RED or
RUNNING"* guard. **Finding A shows the guard shipped as #1577 the day after that file was written.**
So the harm is no longer "in-flight CI is cancelled" — it is narrower and still real: heads move
under a station between reading and acting, and every waiting PR re-runs full CI on every merge.

**ACTIONED** — the escalation is corrected in place and **its question is now one thing, not two:
cadence.** Option (c) (turn `PR_WATCHER_AUTO_UPDATE` off) is now measurably worse than it looked, as
it would also retire a guard firing 320 times. **What would make it urgent:** a `branch updated (was
BEHIND)` line for a PR whose checks were running at that instant, i.e. the guard regressing.

### C — [S2] `#1687` carried a schema migration to `main` with no label, no receipt, no watcher verdict — and CP-26 passed vacuously. **ESCALATED** (instance appended to the open file; not re-filed)

[MEASURED] `#1687` opened 03:00:52Z, classified **Marco's** by this run at 03:1xZ, merged
**03:14:49Z**, `mergedBy=GH-Mantova`, **labels: none, ever**. `git cat-file -e
origin/main:docs/decisions/merge-approvals/1687.md` → **exit 128** (no receipt); same for `1682.md`;
newest receipt on `main` is `1651.md`.

This is a fresh, same-day, **migration-carrying** instance of
`needs-marco/cp26-passes-vacuously-on-an-unlabelled-destructive-migration-2026-09-05.md`: with no
label there is no release, so `RELEASED_NO_RECEIPT` cannot fire, and the CI gate that
STATION-CAPABILITIES §5 calls the supervised lane's boundary proof never evaluates anything.

⚠️ **The migration itself is SAFE and that is not the point.** [MEASURED] by reading the file: one
`ALTER TABLE "scope_cards" ADD COLUMN "stage_group" INTEGER;` — nullable, no default, no backfill, no
UPDATE/INSERT/DELETE. Additive under §8.3. **A gate that passes vacuously is no less broken for
having let a good change through.**

🔴 **[CANNOT MEASURE] who merged it.** `mergedBy` reads `GH-Mantova` for Marco and every agent lane
alike, and the receipt — the only durable signature — is absent. **This station did not merge it.**

**ESCALATED**, to the existing file rather than a new one; the decision is Marco's and unchanged.
**Re-open/close condition:** CP-26 gaining a `classifyPolicyFiles`-driven trigger (RULE 1 (a) on
`#1635`), which would arm it off the diff instead of off the label.

### D — [S3] Five open, five Marco's, and the sixth merged out from under the count. **DEFERRED**

The 02:08Z run deferred this with the re-open condition *"a sixth PR that hand-classifies away from
Marco."* A sixth arrived — `#1687` — and classified **to** Marco, then left the board by a lane that
is not this station. So the conclusion is unchanged and now has two worked negatives:
**nothing on this board is mine to merge.** `Assert-SmokedOrEscalate` was never reached because no
candidate exists. **Re-open condition unchanged.**

### E — [S3] `status-sweep.ps1` §5 still reads CLOSED as MERGED and tells the reader to delete live escalations. **DEFERRED** (04's F1, carried unchanged; third run)

[MEASURED] my 03:09Z sweep prints the same two `[STALE]` lines verbatim, for
`pr-1612-closed-unmerged-branch-holds-the-only-copy-2026-09-05.md` and
`remote-branches-outlive-their-prs-2026-09-05.md`. `status-sweep.ps1` is `scripts/` — the lane
problem in finding F. **Nothing was cleared on the strength of those lines and no station should.**
**What would make it urgent:** any run deleting an escalation file on a §5 `[STALE]` line.

### F — [S2] Four measured `scripts/` defects with named one-line cures and no lane that can land them. **ESCALATED** (02:08Z finding C, carried; the list did not grow this run)

Unchanged and not re-argued: `lint-prompt.mjs`'s `seed_only`, `status-sweep.ps1` §5,
`check-breadcrumb.mjs`'s `CADENCE` map, and `Get-PrBody`'s decode. `#1667` — itself a two-line
`scripts/` fix — has now been open and green since 2026-09-05T14:17Z. **RULE 1 ordering unchanged:**
**(a)** widen 00's recorded lane to `scripts/pipeline/**` + `scripts/pr-gates/**` with a CI gate
proving the boundary the way CP-24 proves 05's — complete and additive, removes no gate;
**(b)** keep the lane and merge the queue yourself — fails the future half at ~one defect per run;
**(c)** do nothing — fails both.
🟢 **One item comes OFF the pile this run:** finding A means there is no fifth `scripts/` change
waiting on a push. **What would make it urgent:** a fifth defect, or a station acting on an
instrument it has already measured as lying.

### G — [S3] `docs/pr-reviews/` in the dev tree still holds ~30 untracked verdicts in one home only. **DEFERRED** (carried, unchanged)

Already landed on `main` in `#1683` as DOCTRINE §9.5's three-homes rule; the fix wants
`pr-watcher-verdict-home-resolver-HOLD.md`, which is `scripts/` and **staged, not armed, ask Marco
first** — it touches the watcher's merge gate. Five runs have now re-derived this; a sixth would be
waste. **What would make it urgent:** a merge decision taken on a missing verdict.

## WHAT I DID NOT DO

- **Did not merge anything.** All five open PRs classified to Marco — three by live watcher
  `marco:true` verdict, two by hand-classification under §10.1 step 2. `#1685`, `#1680`, `#1667` and
  `#1675` being green does not clear their verdicts, and `#1675`'s provably-weak timeout reason does
  not clear its verdict either.
- **Did not merge, touch, revert or comment on `#1687`**, and did not author a
  `docs/decisions/merge-approvals/` receipt for it or any other PR. No agent may author an approval
  file. Recording that a receipt is missing is not the same as supplying one.
- **Did not remove or add a label**, and did not clear a watcher verdict.
- **Did not arm anything.** Armed was 0 at both ends of the run. The gates-satisfied bucket is a list
  of candidates, not instructions; the named never-arm prompts stand, and
  `pr-watcher-verdict-home-resolver-HOLD.md` stays staged, not armed.
- **Did not push `fix/no-rebase-while-checks-run`, and this is now a positive instruction rather than
  caution** — finding A proves the push would open an empty PR.
- **Did not touch, prune or remove the `C:\po-vg` worktree.** Its one untracked file
  (`scripts/pipeline/check-pipeline-heartbeat.mjs`) is still preserved byte-exact at
  `C:\po-sup-fix-scripts\` (`9c4587fb`). Pruning is irreversible and Marco's — and it is now the only
  live question that file contains.
- **Did not delete, discharge or move any `needs-marco/` file**, including the one whose central
  claim I refuted. A refutation appended in place is additive; a deletion is not, and the file still
  holds a live question.
- **Did not commit from the shared dev-tree index.** Everything here was staged in an isolated
  worktree off `origin/main`; the dev tree's index was read (`git diff --cached --name-status` →
  EMPTY) and left alone.
- **Did not commit `docs/pipeline/sweep-rotation.json` or `docs/pr-prompts/.arming-log.txt`** — the
  dev tree was clean of both this run (`git diff --numstat` → EMPTY) and nothing was armed, so
  §9.5's standing arming-log requirement did not fire.
- **Did not edit DOCTRINE §9.6** to add finding A's branch-versus-change probe, though that is where
  it belongs. §9 is inside the hash-gated `instruments v2` canonical block; changing it means
  re-recording the hash and shipping all seven station docs in one PR, which the station doc says is
  more than a collect run should carry. Named here for the next `scripts/`-capable lane.
- **Did not restart, `-Fix` or kill anything.** The sweep read watcher node RUNNING pid 20000,
  wrapper alive (1), heartbeat 1 min: HEALTHY. Nothing was wedged.

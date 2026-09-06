# Station 00 — Supervisor | 2026-09-06T01:08:30Z–2026-09-06T01:26Z

## GROUND

```
UTC            2026-09-06T01:08:30Z
origin/main    f968f5a8   (read from .git/refs/remotes/origin/main through the mount — NOT via git)
dev tree       main @ f968f5a8  C:\ProjectOperations2   (.git/refs/heads/main, same loose ref)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE.

🔴🔴 **THIS RUN WAS BLIND. Desktop Commander never connected.** PREFLIGHT step 1 failed:

```
plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT):
  "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"
```

Three ToolSearch attempts over ~55 s returned no Desktop Commander tool. **No shell was obtained on
the Windows host at any point in this run.** Say it plainly, because a blind run and a healthy quiet
run both produce "no news": **this was the blind one.**

Per STATION-CAPABILITIES §3 ("No second transport", and the correction beneath it) the stop stands
but the run is not dead: the Cowork mount `/sessions/<id>/mnt/ProjectOperations2/` **is** the live dev
tree, so this run **COLLECTED and read**, and **mutated nothing on the board**. Both halves are
reported below. All three binding documents were read through the mount this run —
`00-supervisor.md` (74,684 B, front matter `station_doc_version: 1`), `DOCTRINE.md` (93,204 B) and
`STATION-CAPABILITIES.md` (26,367 B).

**The ceiling this run therefore operated under, stated so no reader mistakes a gap for a clean
result:** no `git` was run against the Windows `.git` (DOCTRINE §9.2 — a cut-short call leaves a
0-byte `index.lock` and freezes every station); no `.ps1` was run, so **no `status-sweep.ps1`, no
`bring-up-to-speed.ps1`, no `smoke-pr.ps1`, no `arm-prompt.ps1`**; and therefore this run makes
**NO liveness verdict, NO smoke verdict, NO safe-to-act verdict and NO merge verdict.** Where a claim
below rests on a file read rather than an instrument, it is tagged `[INFERRED]` and says so.

## WHAT I MEASURED

### The three binding documents, and the version check

[MEASURED] Station doc front matter reads `station: 00-supervisor / station_doc_version: 1 /
contract_version: 1`; this bootstrap declares `station_doc_version: 1`. **They AGREE** — no
read-only downgrade on that account. The blindness is the constraint, not a version mismatch.

### Tree position — read as files, never through `git`

[MEASURED] `.git/refs/heads/main` = `f968f5a8ae818f97a77de24060c85e533adf7d0c`;
`.git/refs/remotes/origin/main` = the **same** 40 bytes; `.git/HEAD` = `ref: refs/heads/main`.
`.git/packed-refs` is dated 2026-09-03 and is the known-permanently-stale copy — **not read, not
quoted.** Loose refs were used.

⚠️ **[INFERRED], and the distinction matters.** Two identical loose refs mean the dev tree's `main`
and its last-fetched `origin/main` point at one commit. It is **not** the `rev-list --left-right
--count` `0 0` read-back, and it says **nothing** about the working tree being clean — `git diff
--numstat` and `git diff --cached --name-status` were **NOT** run and **cannot** be run this run.
**No "dev tree is clean and current" claim is made here.** `.git/FETCH_HEAD` was last written
2026-09-06T00:30Z (Brisbane 10:30, UTC+10 — station doc RULE 2), i.e. the fetch behind those refs is
~38 min old.

### GitHub board — read-only, and NOT presented as coverage

The bootstrap forbids substituting GitHub-side reads for the tree the watcher globs. These are
**not** offered as that. They are the board's own state, read read-only through the GitHub MCP
(which is write-403 and could not mutate anything even if asked), and nothing was acted on.

[MEASURED] `list_pull_requests(state=open)` → **FIVE open PRs, the same five the 00:08Z run
classified, and no sixth:**

| PR | head sha now | head sha at 00:08Z | created | updated |
|---|---|---|---|---|
| **#1682** | `0938ddf5` | `d32b1770` | 09-05T22:30:39Z | 09-06T00:33:33Z |
| **#1680** | `d7bef2dd` | — | 09-05T21:40:58Z | 09-06T00:33:35Z |
| **#1675** | `84cc0128` | — | 09-05T17:27:19Z | 09-06T00:33:39Z |
| **#1667** | `35b5b5ab` | — | 09-05T14:17:15Z | 09-06T00:33:41Z |
| **#1662** | `1076d084` | — | 09-05T11:45:57Z | 09-06T00:33:44Z |

**Every one of the five was touched inside a 13-second window** — `00:33:33Z` to `00:33:44Z`. See
finding B; that is the poller, not five actors.

[MEASURED] `list_commits` on `main`: HEAD is `f968f5a8`, *"docs(board): 00 collect 0008 … (#1684)"*,
authored/merged **2026-09-06T00:30:44Z**, committer `web-flow`. So **the 00:08Z run's own board PR
landed**, and the dev tree fast-forwarded onto it — which is why its breadcrumb is on disk as a
**tracked** file rather than an orphan. Predecessor before that: `162d9d2c` (#1683, 09-05T23:30:29Z).

### COLLECT — exactly ONE breadcrumb since the previous run, and it is 00's own

[MEASURED] `docs/pr-prompts/` and `docs/pr-prompts/archive/` were listed in full; the **only**
breadcrumb bearing a `2026-09-06` date anywhere in either directory is:

```
00-00-supervisor-2026-09-06-0008-the-only-red-on-the-board-is-two-identical-headings-a-locator-cannot-tell-apart.md
```

Read in full (18,211 B). Its five findings each carry a terminal disposition — A DISPATCHED,
B DEFERRED, C DEFERRED, D ESCALATED, E ACTIONED — and each is carried forward below with this run's
own re-measurement rather than a repetition. **No other station has filed since**; newest per
station, by filename (all in `archive/`): 03 → `2026-09-05-2301`, 04 → `2026-09-05-2210`,
05 → `2026-09-05-1411`, 02 → dispatch-only.

⚠️ **Freshness was derived from FILENAMES, not from the validator.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness` was **NOT run** — it builds its `trackedSet`
with `git ls-tree`, and running it would put `git` against the Windows `.git`, which the blind-run
ceiling forbids outright. So `[INFERRED]`, from the UTC stamps in the filenames against the run
clock:

```
00  last 2026-09-06T00:08Z   1.0h ago  (live cron 5 * * * * = hourly)  inside cadence
03  last 2026-09-05T23:01Z   2.1h ago  (cadence 24h)                   inside cadence
04  last 2026-09-05T22:10Z   2.9h ago  (cadence 4h, next due ~02:10Z)  inside cadence
05  last 2026-09-05T14:11Z  10.9h ago  (cadence 24h)                   inside cadence
02  dispatch-only — no cadence to miss
```

**No station is SILENT and no station needed a transcript read.** The second instrument the station
doc requires for 00 itself: my predecessor ran at 00:08Z and its PR #1684 merged at 00:30:44Z, one
hourly occurrence before this run — nothing was missed. And the standing caution applies to me, not
only to them: **`ok` is not an all-clear**, which is why the cron/`CADENCE`-map mismatch is named
again below rather than treated as closed.

### Queue and arming — armed 0, by counting, not by quoting

[MEASURED] `docs/pr-prompts/*.md` at the queue root contains **no `*-ready.md` of any kind** — the
only non-`HOLD` files are `BACKLOG-DECISIONS.md`, `TEMPLATE-sot-reconcile.md`, `queue-watch-state.md`
and `shepherd-state.md`, none of which is an armed prompt. **Armed = 0.** Counted this run; not
quoted from a note (Q3).

[MEASURED] `.arming-log.txt` tail — last entry `2026-09-05T21:33:19Z ARMED
pr-deps-s1-fasturi-browserslist-overrides … actor=marco-delegated`. **Nothing has been armed in the
3.6 h since**, and nothing was armed by me. Bucket counts, by directory listing: `needs-marco` 39,
`no-pr-opened` 109, `failed` 41, `blocked` 121, `superseded` 109, `paused` 4, `archive` 418,
`processed` 4034.

### RULE 2 probe — live tree, both controls, and the tree PINNED

[MEASURED] Probe path `C:\ProjectOperations2\docs\pr-prompts\processed` — **4,034 entries**, newest
log `rev-1684-ready.md.log` written 2026-09-06T00:25Z, which is *younger than every open PR*, so this
is the LIVE directory and not the `C:\po-watcher\ProjectOperations\…` decoy that is stale to
2026-08-17 and **passes its own positive control while clearing every PR since**. Discriminator used
was log **AGE**, not POS>0.

```
POSITIVE  marco.:true  over pr-*.log   →  614   (regex form; the . matches the quote)
NEGATIVE  zzQq00N20260906T0110         →    0   (freshly minted this run)
```

Controls agree with the 00:08Z run's 614/0. **The per-PR classification is NOT re-derived here** —
it was measured against these same logs and the launch log 1 h ago, no PR has changed hands, and
re-running a probe that cannot change its answer is not a second instrument. It stands as:
**#1680** and **#1675** carry live watcher `marco:true` verdicts (RULE 2 binds); **#1682**, **#1667**
and **#1662** are `[NO LANE VERDICT — hand-classified]` second lanes that classify to **Marco** under
§10.1 step 2. **Five open, five Marco's, none of them mine to merge.**

### Watcher — writing one minute before this run, but that is NOT a liveness verdict

[MEASURED] `C:\po-watcher\watcher-launch.log` (2,462,754 B) last line is
`[2026-09-06T01:07:21.672Z] [review] verdict-archive sweep: archived=0 kept=2 skipped=0 tracked=59`,
one minute before this run's start, and the 5-minute sweep line is unbroken back through 00:12Z.
Launch-log controls: `opened PR #` → **166**, `opened PR #999999` → **0**.

🔴 **[INFERRED], and deliberately not upgraded.** A log being written is evidence a process is
writing it. It is **not** `status-sweep.ps1`'s section 2, it does not give a pid, a wrapper state or
a heartbeat age, and the station doc's RULE 1 forbids determining liveness from the Linux sandbox.
**This run makes no liveness claim and did not restart or `-Fix` anything.** The last `opened PR #`
entry predates 2026-09-06 entirely: **the watcher has opened no PR this cadence.**

## WHAT CHANGED

**On the board: NOTHING.** No merge, no arm, no label added or removed, no branch pushed, no PR
opened, no worktree created or pruned, no `/sot/` edit, no `scripts/` edit, no git operation of any
kind. The blind-run ceiling forbids every one of those and none was attempted.

**Two file writes, both outside the board, both verified by byte delta and read-back:**

1. **Appended a `CONFIRMING INSTANCE` block** to
   `docs/pr-prompts/needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`
   — the already-open escalation, which **explicitly asked for this measurement**. Append only,
   nothing edited or removed. `before=5,003 B → after=7,088 B, delta=+2,085`, asserted; POSITIVE
   read-back on the new heading → 1; NEGATIVE control `zzQq00N20260906T0110` → 0; tail re-read
   intact. See finding A.

2. **This breadcrumb**, written to the dev tree at `C:\ProjectOperations2\docs\pr-prompts\`.

🔴 **THIS BREADCRUMB IS UNTRACKED AND A SIGHTED RUN MUST SWEEP IT UP.** Cure 1 of the REPORT
CONTRACT — write it inside your own run's PR worktree — **was not available to me**: a blind run
cannot create a worktree, cannot commit, and the GitHub MCP token is write-403, so no PR could be
opened. So it sits as a loose untracked file, exactly as STATION-CAPABILITIES §3 says a blind run's
breadcrumb must, **and it is therefore live bait for the untracked-file fast-forward trap** at
station doc line 699: the moment a later PR lands this exact path on `main`, `git merge --ff-only`
in the dev tree will refuse with *"untracked working tree files would be overwritten"* while
`--numstat` and `--cached` both read EMPTY and every clean-tree instrument reports nothing wrong.
**Four consecutive runs have already paid for that diagnosis.** The next sighted run: commit this
file from a worktree, then follow the line-699 cure — `git rev-parse origin/main:<path>` against
`git hash-object <path>`, equal ⇒ `Remove-Item`, then ff, then read back `0 0`, and **never**
`git clean` or `git checkout .`.

**Not done, and named so it is not mistaken for done:** the 00:08Z breadcrumb is fully dispositioned
and is the next archive candidate, but archiving is a `git mv` and **a blind run may not touch git**.
It stays at the queue root. A breadcrumb filename matches no watcher glob, so it arms nothing while
it waits.

## FINDINGS

### A — [S1] Blind again, and `Prisma-Local` fell with it — the escalation's own named diagnostic now has no counter-example — ESCALATED (already filed; answered, not re-filed)

Desktop Commander returned `CONNECT_TIMEOUT` after 30,000 ms and never connected. That is the
long-running Station 00 blindness item, filed at
`docs/pr-prompts/needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`.
**I did not open a second file for it.**

**What is new is an answer, not a repetition.** That file ends by naming one cheap diagnostic for
Marco: *"when a station reports blindness, check whether `Prisma-Local` failed in the same run. If
the two always fall together, the fix is one fix, not two."* [MEASURED] this run, from the session's
own MCP report: `desktop-commander` **CONNECT_TIMEOUT after 30000 ms** *and* `Prisma-Local`
**CONNECTION_CLOSED** — the two local stdio servers down together — while **every other** failure in
the same report is a **remote HTTP** server failing on **auth**, never on connecting
(`github-projectops` 400 bad Authorization header; `box` / `asana` / `hubspot` / `pagerduty` /
`bigquery` no dynamic client registration; `similarweb` ×2 and `zoominfo` DCR-rejected). That is the
identical clean split the file recorded on 2026-09-01.

**The correlation now has no counter-example on record.** Every blind run in that file has
`Prisma-Local` down in the same window; no run has reported one without the other. It is still
correlation — **the falsifier is a run that is blind while `Prisma-Local` connects, or one where
`Prisma-Local` fails while Desktop Commander is fine**, and neither has been seen. Recorded in the
escalation with that falsifier stated, so a later run can close it rather than re-discover it.

**ESCALATED — and it stays Marco's for an unchanged reason:** the connect timeout and any pre-warm
live in Claude client / plugin config on his machine, not in this repo, so no agent can apply option
(A). The question put to him is unchanged and needs no new options: **lift the connect timeout for
the local stdio plugins and pre-warm them before the station body runs (option A, the RULE 1
complete-and-additive one — it fixes the cause now and in future and touches no data), or keep
paying a cadence per blind run?** The cost this run was measurable: COLLECT ran, everything else did
not.

⚠️ One thing this run can put beyond doubt for him, because it now has both sides in one report:
**the box was fine.** The watcher was writing to `watcher-launch.log` at 01:07:21Z, one minute before
this run started, and merged #1684 at 00:30:44Z. **The fault is the session's local stdio launch
path, not the host** — which is the split that DOCTRINE-side item #17 already turns on, and it is
re-confirmed rather than re-derived.

### B — [S2] The auto-update poller rebased ALL FIVE open PRs in thirteen seconds, three minutes after a docs-only merge — and the fix for it is still unpushed — ESCALATED (already filed ×2; new instance, worst yet)

[MEASURED] `watcher-launch.log`, five consecutive lines:

```
[2026-09-06T00:33:31.635Z] [update] PR #1682 branch updated (was BEHIND)
[2026-09-06T00:33:34.274Z] [update] PR #1680 branch updated (was BEHIND)
[2026-09-06T00:33:37.157Z] [update] PR #1675 branch updated (was BEHIND)
[2026-09-06T00:33:40.247Z] [update] PR #1667 branch updated (was BEHIND)
[2026-09-06T00:33:43.299Z] [update] PR #1662 branch updated (was BEHIND)
```

Corroborated from the other side: GitHub reports all five `updated_at` inside `00:33:33Z–00:33:44Z`,
and #1682's head moved `d32b1770 → 0938ddf5`. **The trigger was #1684 merging at 00:30:44Z — a
docs-only board breadcrumb.** `PR_WATCHER_AUTO_UPDATE` is `"true"` against a documented default of
OFF, so `pollForBehindPrs()` rebased **the entire open board** because Station 00 filed its own
housekeeping PR.

**Every one of the five then re-ran CI it had already passed.** #1682's run `34001603822` started
`00:33:53Z`, ten seconds after its rebase, and ran to `00:47:27Z` — **13.5 minutes of CI, and 14
check runs per PR across five PRs, spent to re-prove a green board against a docs commit.** This is
the same defect as `needs-marco/hourly-board-pr-rebases-every-waiting-pr-2026-09-03.md`; previous
instances were measured at 3 PRs on 09-03 and single PRs since. **Five in one batch is the largest
recorded, and it is a floor, not a ceiling: it scales with how many PRs are open when 00 files.**

🔴 **The fix already exists and has never been pushed.** `C:\po-vg` holds branch
`fix/no-rebase-while-checks-run` at `23c91ba9`, *"fix(pr-watcher): never rebase a PR whose checks are
still running"*, with an 88-line guard test — escalated at
`needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md` and, as of this run,
**~41 hours old and still the only copy.** The 00:08Z run recorded that the defect "acted on the
board during this very run"; it has now done so again, at five times the scale, in the very next
hour. **I did not touch `C:\po-vg`, its worktree or its branch** — pushing another actor's unpushed
branch and pruning a worktree holding uncommitted work are both irreversible-adjacent and Marco's,
and I am blind besides.

**ESCALATED**, both files already filed, **not re-filed** — an escalation can be wrong about *who* it
needs, and this one is not: the branch is on Marco's machine and only he can push or discard it.
What this run adds is the number. Re-open/close condition: `23c91ba9` reaching `origin`, or
`PR_WATCHER_AUTO_UPDATE` being set to its documented default.

### C — [S2] #1682's red reproduced at a second head, so it is not a flake, and the dispatch was delivered but not yet taken up — DISPATCHED (carried, delivery verified)

Carried from the 00:08Z run's finding A. **Delivery verified, not assumed:** [MEASURED] comment
`5555752614` on #1682, posted `2026-09-06T00:20:43Z`, carries the full root cause, both competing
elements verbatim, and the reason `.first()` is a mask. **No reply, and no push to the branch, in the
40 minutes since.**

**New this run, and it is the point:** the poller moved #1682's head to `0938ddf5` at 00:33:31Z and
CI re-ran. [MEASURED] `get_check_runs` on #1682 → **14 checks, 13 success, 1 failure**; the single
red is `tendering-e2e`, run `34001603822`, completed `00:47:27Z`. Everything else — `CodeQL`,
`Analyze` ×2, `Web`, `API`, `Data model`, `raw-error-envelope gate`, `PR gates — diff checks`,
`Approval receipt (CP-26)`, `Pipeline — watcher + linter tests`, `Pipeline — arm-prompt tests`,
`Changed-path filter` ×2 — is green. **The same job failed at the previous head `d32b1770`.** So the
red survives a rebase onto new `main`: it is **reproducible, not a flake, and not a stale rollup**.

**The 410 KB job log was NOT re-pulled** — the cause is named, and re-deriving it would burn 13
minutes of CI reading to reach a conclusion already written into the PR. It stands: `getByText(
'Concrete cutting')` at `batch3-scope-cutting.spec.ts:48` now resolves to **two** visible
`h3.s7-type-section-heading` elements, differing only by `(0 items)` versus `(0 rows)`, because the
PR renders `<CuttingSection>` directly above `<ScopeCuttingSheet>` on purpose. **Ambiguity, not
absence.**

**DISPATCHED — unchanged, and deliberately not escalated to Marco.** #1682 is a second lane being
driven turn by turn; pushing a fix onto a branch another actor owns is the LL-38 collision that
BOARD DRIVING condition 3 exists to prevent. The honest disambiguation is structural (a
`data-testid`, or headings that differ by more than a live row count) and that is a **UI decision**
about whether a user should see two `h3`s reading `Concrete cutting` on one card — guessing it is
guessing intent (§5.5). The human who can answer is already in the room with the lane that owns the
PR. Re-open condition: the comment still unanswered at the next run **and** #1682's head unmoved by
its own lane — at that point the dispatch has no consumer, and a dispatch with no consumer is a
finding that has not been reported (the 21:08Z run's own lesson).

### D — [S3] Five open, five Marco's, no sixth — the board is correctly stopped, and heads moving is not the board moving — DEFERRED

The 00:08Z run deferred this with a two-limb re-open condition: *any of the five changing state, or a
sixth PR appearing that is not Marco's.* **Neither limb fired.** No sixth PR exists; the five are the
same five, with the same classifications, and the only thing that changed is that a poller rebased
them (finding B). A head sha moving under a PR is not that PR changing hands — its lane, its verdict
and its `marco:true`/hand-classified status are all unchanged, and **RULE 2 still binds on #1680 and
#1675 regardless of how green they are.** Four of the five are fully green; #1682 is the one red and
finding C owns it. **Nothing on this board is waiting on automation, and nothing on it is mine.**

**DEFERRED**, same re-open condition, now stated more precisely so the next run does not re-litigate
it: **a sixth PR that hand-classifies away from Marco** — that one would be mine to drive and merge,
and it would be the first in four runs.

### E — [S3] `check-breadcrumb.mjs` REJECTs a breadcrumb that is merely being WRITTEN — DEFERRED, and this run could not even test it — DEFERRED

Carried unchanged from the 23:08Z and 00:08Z runs. It wants an mtime-versus-now check before a
malformed verdict is believed, and that is a `scripts/` change.

**What this run adds is a caveat on the evidence, not evidence.** The 00:08Z run offered
`structure: 6 checked, 0 malformed` as evidence the defect is intermittent rather than gone. **I could
not run the validator at all** — it shells out to `git ls-tree`, which the blind ceiling forbids — so
this run contributes **no** data point in either direction, and a reader must not count its silence
as a third clean pass. **DEFERRED.** Re-open condition unchanged: a second occurrence, or any run
that dispositions a station as malformed on this cause.

### F — [S3] The freshness map still says 00's cadence is 2 h while its live cron is hourly — DEFERRED

`check-breadcrumb.mjs`'s `CADENCE` map carries `'00': 2`; 00's live cron is `5 * * * *`. The
consequence is unchanged and is the one worth writing down: **00 is not called SILENT until 4 h —
i.e. after three consecutive missed hourly runs** — and given finding A, missed hourly runs are the
failure mode this pipeline actually has. It is a one-character defect behind a `scripts/` change this
run cannot make. **DEFERRED** — it is already filed at
`needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md` (escalation #23) and
this is a pointer to it, not a rival. Re-open condition: a Station 00 run actually missed and not
detected — which, with three blind-adjacent failure modes open at once, is not hypothetical.

## WHAT I DID NOT DO

- **Did not merge anything.** All five open PRs classify to Marco — two by live watcher `marco:true`
  verdict, three by hand-classification under §10.1 step 2. `Assert-SmokedOrEscalate` was never
  reached because no candidate exists, and I could not have run it while blind in any case.
- **Did not run `git` against the Windows `.git`** — not `status`, not `diff`, not `fetch`, not
  `merge --ff-only`, not `mv`. DOCTRINE §9.2: one cut-short call leaves a 0-byte `index.lock` with no
  Windows process behind it, which never expires and freezes every station.
- **Did not run any `.ps1`** — no `status-sweep.ps1`, no `bring-up-to-speed.ps1`, no `smoke-pr.ps1`,
  no `arm-prompt.ps1`, no `restart-watcher-if-wedged.ps1` — and therefore **claimed no liveness,
  smoke, safe-to-act or merge verdict.** Where this report names watcher activity it is a log mtime
  and a log tail, tagged `[INFERRED]`, never a health verdict.
- **Did not run `check-breadcrumb.mjs`**, and did not write `breadcrumb-clean` anywhere in this
  report. Freshness above is `[INFERRED]` from filenames and says so.
- **Did not arm anything.** Armed was 0 at the start and 0 at the end, counted by listing the queue
  root myself. Three named prompts remain on the never-arm-right-now list and
  `pr-watcher-verdict-home-resolver-HOLD.md` remains **staged, not armed, ask Marco first** — it
  touches the watcher's merge gate.
- **Did not archive the 00:08Z breadcrumb** though it is fully dispositioned and is the next
  candidate — archiving is a `git mv`. Left for the next sighted run, along with sweeping up this
  breadcrumb.
- **Did not touch `C:\po-vg`**, its worktree or its unpushed branch — finding B is Marco's.
- **Did not add or remove a label**, did not author a `merge-approvals/` file or any approval
  receipt, and did not clear a `marco:true` verdict. No agent may ever author an approval file, and
  removing `do-not-merge` does not clear RULE 2.
- **Did not push to #1682's branch** and did not apply `.first()` to make it green — finding C says
  why, and DOCTRINE §8.2 forbids the mask by name.
- **Did not open a second escalation file** for either finding A or finding B. Both are already
  filed; I appended a measurement each escalation had asked for and left the files otherwise intact.
- **Did not touch `/sot/`**, `scripts/`, `C:\po-watcher\ProjectOperations`'s git, or any board state.
  This run's entire disk footprint is one appended block in a gitignored `needs-marco/` file and this
  untracked breadcrumb.

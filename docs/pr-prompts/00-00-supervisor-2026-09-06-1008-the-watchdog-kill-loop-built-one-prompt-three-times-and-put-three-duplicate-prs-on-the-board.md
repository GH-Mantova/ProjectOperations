# Station 00 — Supervisor | 2026-09-06T10:08Z–2026-09-06T10:35Z

## GROUND

```
UTC            2026-09-06T10:09:11Z
origin/main    b9c1dd5d            (fetch --prune, then rev-parse)
dev tree       main @ b9c1dd5d      C:\ProjectOperations2   (arrived 111b1bcb, 0 1 behind; fast-forwarded clean)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE. **SIGHTED** — Desktop Commander reached the box on the first call
(`start_process`, `powershell.exe`, pid 31172). All three binding documents were read from the dev
tree after confirming `git diff --numstat origin/main -- <path>` was EMPTY for all three.

This run is the direct successor to `00-00-supervisor-2026-09-06-0930-the-watchdog-kills-every-restart-…`
(landed in **#1702**). That run measured the kill loop and **DISPATCHED it to Station 03**. Everything
below is what happened in the 39 minutes after it wrote its report.

## WHAT I MEASURED

### The kill loop ran to its conclusion: one prompt, built three times, three PRs

[MEASURED] `docs/pr-prompts/.arming-log.txt`, last row:

```
2026-09-06T09:20:50Z  ARMED  pr-watcher-verdict-home-resolver  escalates=false
                      actor=station-00-scheduled-0908Z  by=Marco@LAPTOP-E6NHU4E4  pid=24508
```

[MEASURED] `gh pr list --state open --json number,title,createdAt,author,headRefName,labels,files`:

| PR | created | head branch | files | diff length | diff SHA-256 (first 16) |
|---|---|---|---|---|---|
| #1703 | 09:53:09Z | `feat/verdict-home-resolver` | 2 | 12324 | `BAAEC8CC8F8DDD69` |
| #1704 | 09:54:01Z | `fix/verdict-home-resolver` | 2 | 16271 | `19B5B057833841A3` |
| #1705 | 09:54:39Z | `fix/verdict-home-resolver-v1-impl` | 2 | 16271 | `19B5B057833841A3` |

All three touch exactly `scripts/pr-watcher/index.mjs` and
`scripts/pr-watcher/__tests__/verdict-home-resolver.test.mjs`. **#1704 and #1705 are byte-identical.**
#1703 is a different implementation of the same prompt (`+241/-5` against `+262/-10`).

[MEASURED] `C:\po-watcher\ensure-watcher.log` — the live log, not `watcher-launch.log` (F9 of the
0930 run): `RELAUNCHED` at **09:25:04Z**, **09:35:06Z**, **09:49:32Z**, each followed by a `VERIFIED
node pid` line naming a *different* pid (2556 → 14152 → 19744 → 23352). Three relaunches, three PRs.

[MEASURED] The prompt was **still armed** at 10:09Z — `pr-watcher-verdict-home-resolver-ready.md`,
7733 bytes — and no `docs/pr-prompts/processed/*verdict-home-resolver*` log existed. No node survived
long enough to file it, so every relaunch re-globbed it and built it again.

### The armed count is the kill condition, so an armed queue is self-sustaining

[MEASURED] `scripts/pr-watcher/supervise-watcher.ps1:522-523`:

```powershell
$armed = @(Get-ChildItem (Join-Path $PromptDir '*-ready.md') -File -ErrorAction SilentlyContinue)
if ($armed.Count -eq 0) { continue }   # empty queue: a stale heartbeat is legitimate idle
```

The watchdog **skips the kill entirely when nothing is armed.** Combined with the 0930 run's F7 — a
node that has just started cannot have ticked `heartbeat.log`, so `ageMin` describes the *previous*
run — the loop is: arm ⇒ every new node reads stale-heartbeat + armed≥1 + 0 in-progress ⇒ killed as
HUNG at ~26 s ⇒ relaunched ⇒ killed. **Arming is what breaks the machine.**

### RULE 2 / lane classification — the probe cannot yet speak for four of the five open PRs

[MEASURED] live tree `C:\ProjectOperations2\docs\pr-prompts\processed` (pinned per §9.5, never the
clone): **1989** logs · newest **2026-09-06 09:02:59Z** · POSITIVE control `marco.:true` → **617** ·
NEGATIVE control (freshly minted needle) → **0**.

🔴 **The newest log (09:02:59Z) is OLDER than #1699 (08:44Z open, still building), #1703, #1704 and
#1705 (09:53–09:54Z).** §9.5's pin rule requires the newest log to be younger than the oldest open PR
before a `NO LOG` reading means anything. It is not. So for those PRs the probe is
**[CANNOT MEASURE]**, not "second lane" and not "cleared" — this is §10.1's third cause (a watcher PR
still inside its window), and `watcher-launch.log` cannot discriminate either, because it is stale at
05:27:31Z while its own POSITIVE control (`opened PR #`) returns 167 hits.

| PR | verdict | classification |
|---|---|---|
| #1700 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/pages/admin/JobRolesPage.tsx"}` | **RULE 2 binds — Marco's** |
| #1703 / #1704 | `[NO LANE VERDICT — hand-classified]` | `scripts/pr-watcher/index.mjs` is outside all three `NESTED_TEST_PATHS` forms ⇒ **Marco's** |
| #1699 | `[NO LANE VERDICT — hand-classified]` | contains `apps/api/prisma/migrations/…` ⇒ `classifyPolicyFiles` refuses on its own clause ⇒ **Marco's** |

### #1699 is red on CP-26, and the fix is one an agent is forbidden to write

[MEASURED] `gh run view 34026009717 --job 101466977148 --log`:

```
FAIL - CP-26 do-not-merge [PR #1699 was labelled do-not-merge and released, but
docs/decisions/merge-approvals/1699.md is not in this PR's diff against merge-base
with origin/main.]
```

13 checks pass, including `tendering-e2e` (13m3s) and `API — lint, test, compliance smoke`. The only
two reds are CP-26 and the `PR gates — diff checks` job it runs inside — **one cause, two reds**, the
known coupling.

[MEASURED] label timeline, `gh api repos/…/issues/1699/timeline`:

```
2026-09-06T09:13:09Z  labeled    do-not-merge  actor=GH-Mantova
2026-09-06T09:50:08Z  unlabeled  do-not-merge  actor=GH-Mantova
```

`actor` discriminates nothing — every agent and Marco authenticate as `GH-Mantova`. No receipt exists
on `origin/main` (`git ls-tree -r origin/main -- docs/decisions/merge-approvals/`: newest is
`1651.md`). **I did not author one**: a `merge-approvals/<N>.md` written by an agent is the
self-signed approval CP-26 exists to prevent.

## WHAT CHANGED

1. **Dev tree fast-forwarded** `111b1bcb` → `b9c1dd5d`. Read back: `git rev-list --left-right --count
   HEAD...origin/main` → `0 0`, `git diff --numstat` → EMPTY, `git diff --cached --name-status` →
   EMPTY. No FF blocker: the 0930 breadcrumb's disk copy was byte-identical to the blob #1702 landed.

2. **`pr-watcher-verdict-home-resolver-ready.md` → `pr-watcher-verdict-home-resolver-LOOPING.md`.**
   The sanctioned LOOP action (station doc §3c). Read back: armed count **1 → 0**, source gone,
   destination present at the same **7733** bytes. The file stays untracked in the queue root, which
   is where the existing `superseded/pr-doctrine-s9-four-false-traps-LOOPING.md` lives.

3. **#1705 CLOSED** as a byte-identical duplicate of #1704, with the measurement in the closing
   comment. Read back: `state=CLOSED`, `closed=true`. **The branch was NOT deleted** —
   `git ls-remote --heads origin fix/verdict-home-resolver-v1-impl` → `2ae02ec4…` still present.

4. **A duplicate-pair warning comment posted on #1703 and #1704**, naming each other, the cause, and
   the fact that neither may be auto-merged. Read back: `comments=1` on each.

5. **Nothing was armed.** See F3.

## FINDINGS

### F1 [S1] The kill loop's cost is now measured: one prompt became three PRs, and the queue could not consume it

The 0930 run predicted the board could not build *any* armed prompt. What actually happened is worse
and more specific: it built the same prompt **three times** and consumed it **zero** times, because
the prompt is only filed to `processed/` after a run completes and no run completed. Two of the three
PRs are genuinely different code, so a reviewer meeting them cold has to work out that they are one
piece of work.

**ACTIONED** — the loop is stopped and the duplicates are contained: prompt renamed to `-LOOPING.md`
(armed 1 → 0), #1705 closed, #1703/#1704 cross-referenced in writing. **Evidence the loop stopped:**
watcher node **pid 15336, started 10:09:24Z, still alive at 10:18:14Z — 8 min 50 s**, against three
kills at ~26–30 s in the preceding 45 minutes; `.watchdog-kill.flag` is now **absent**; and the 10:18Z
`status-sweep.ps1` reads **heartbeat age 0 min** where the 10:09Z sweep read **67 min**. [INFERRED,
from the code at `supervise-watcher.ps1:523`] the cause of the stop is `armed = 0`, not a repair —
**F7 of the 0930 run is untouched and still 03's.**

### F2 [S1] `armed >= 1` is the kill condition, so the queue and the watchdog are in a deadlock that arming re-arms

Measured above. This is not a restatement of F7: F7 names *why a young node looks hung*; F2 names *why
the fault only exists when there is work to do*, which is what makes it invisible on a quiet board and
guaranteed on a busy one. It also means the disarm above is a **stopgap that expires the moment
anyone arms anything** — including the next scheduled Station 00 run following its own arming
discipline.

**DISPATCHED → Station 03 (Machine Minder)**, folded into F7/F8 of the 0930 breadcrumb — same file
(`scripts/pr-watcher/supervise-watcher.ps1`), same PR. The age gate F7 proposes fixes F2 as well:
gate the kill on the node's own `Win32_Process.CreationDate` so a node younger than the staleness
window is never judged. 03 next runs `2026-09-06T23:00:45Z`.

### F3 [S2] Arming anything before F7 lands re-creates the outage — so this run deliberately armed nothing

`triage-holds.ps1` candidates were not even enumerated. With `armed = 0` the machine is stable; with
`armed >= 1` every relaunched node dies at ~26 s and the queue produces duplicate PRs instead of work.
The correct arming decision this run is **none**, and the reason is mechanical rather than cautious.

**DEFERRED.** What would make it urgent: F7 landing (then arm normally), or Marco directing an arm
in chat — in which case the board must be watched for a kill within the first minute, and the prompt
disarmed again if one occurs.

### F4 [S2] #1699 was released from `do-not-merge` with no receipt, and CI is correctly refusing it

Measured above: labelled 09:13:09Z, unlabelled 09:50:08Z, no `merge-approvals/1699.md`, CP-26 FAIL.
This is a live instance of the open escalation
`needs-marco/label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md`. The gate is
working exactly as designed — the PR cannot reach `main` unsigned, which is the boundary
`DOCTRINE §10.2.1` relies on.

**ESCALATED → Marco.** The question, with options, RULE 1 applied:

> **#1699 (`fix(rates): give the three unit-less seeded VALUE columns a unit`) had its
> `do-not-merge` label removed at 09:50:08Z and carries no approval receipt. Did you release it?**
>
> **(a) COMPLETE + ADDITIVE — you commit `docs/decisions/merge-approvals/1699.md` on the PR branch
> yourself.** CP-26 goes green, the release is signed by the only actor authorised to sign it, and the
> record survives in the repo. Passes both halves of RULE 1: it resolves this PR *and* every future
> one, because it is the path CP-26 was built for. It is the only option no agent can perform for you.
>
> **(b) Re-apply the `do-not-merge` label and leave it red.** Fails the "solves it completely" half —
> the PR stays parked and the same question returns the next time a label is removed. Damages no data.
>
> **(c) Some other actor removed it and it was not you.** Then the release itself is unauthorised and
> the label should go back on. This is why the question is being asked rather than assumed: the
> timeline's `actor` field reads `GH-Mantova` for the label, for every agent and for you, so it
> **cannot** answer it.
>
> **What I did NOT do, and will not:** write the receipt. An agent-authored `merge-approvals/<N>.md`
> is a self-signed approval, which is precisely what the gate exists to stop.

### F5 [S3] `watcher-launch.log` was stale for the whole of this incident and its positive control still passes

[MEASURED] `watcher-launch.log` last written **05:27:31Z** ("Watcher exited with code 1 (raw node
exit: -1)") while the watcher opened four PRs afterwards. Searching it for `opened PR #170[0-9]`
returns **0**; the POSITIVE control `opened PR #` over the same file returns **167**, and the NEGATIVE
control returns 0. So the instrument is sound and the file is simply four hours behind — an answer
that is confidently wrong at exit 0, with nothing in the file to warn you.

This is F9 of the 0930 run, and it **cost this run a measurement**: the launch log is the discriminator
DOCTRINE §10.1 names for separating a second-lane PR from a watcher PR still inside its window, and it
could not answer for #1703/#1704/#1705. The lane had to be established from the arming log, the branch
names and the timing instead.

**DISPATCHED → Station 03**, folded into F9 of the 0930 breadcrumb — no new work, but this is the
second consecutive run to pay for it, and it now has a named consumer (§10.1's discriminator) rather
than only being untidy.

## WHAT I DID NOT DO

- **Did not restart the watcher.** The 0930 run spent this station's sanctioned `-Fix` under a DOWN
  verdict; the sweep at 10:18Z reads `RUNNING pid 15336, heartbeat age 0 min`, so there is nothing to
  restart. A second `-Fix` would also spend a churn-guard credit for no reason.
- **Did not touch `heartbeat.log`, `.watchdog-kill.flag`, or `scripts/pr-watcher/**`.** That file is
  03's lane; editing the watchdog myself is the LL-38 shape.
- **Did not author `docs/decisions/merge-approvals/1699.md`** — see F4.
- **Did not merge anything.** All five open PRs are Marco's: #1700 by an explicit watcher `marco:true`
  verdict; #1703/#1704 by hand-classification on `scripts/pr-watcher/index.mjs`; #1699 by its
  migration path *and* its red CP-26.
- **Did not close #1703 or #1704.** They are different code, and picking between two implementations
  of one prompt is a review judgement. Only the byte-identical #1705 was closed.
- **Did not delete any branch**, including #1705's — `fix/verdict-home-resolver-v1-impl` is still on
  the remote.
- **Did not arm anything** — F3.
- **Did not clear the `[STALE]` escalation lines** section 5 of the sweep reports (now ~90 of them,
  many naming merged PRs). That backlog is real but it is a separate sweep, and doing it in the same
  PR as an S1 incident report buries the incident.
- **Did not touch `/sot/`, Azure/Entra/SharePoint, or production data.**
- **Did not run `git` in `C:\po-watcher\ProjectOperations`.** Read-only reads of its logs only.

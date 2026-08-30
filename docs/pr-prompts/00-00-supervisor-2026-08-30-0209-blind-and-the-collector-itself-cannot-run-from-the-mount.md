# Station 00 — Supervisor | 2026-08-30T02:09:54Z–2026-08-30T02:15Z

## GROUND

```
UTC            2026-08-30T02:09:54Z
origin/main    5e9f52be            (GitHub API, not a local fetch — see below)
dev tree       main @ 5e9f52be     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (both `1`), so no version-mismatch read-only clamp. This run is
read-only for a different and larger reason: **Desktop Commander is absent.**

`origin/main` was NOT obtained by `git fetch` + `rev-parse` — no shell exists this run. Two
independent readings agree instead: `.git/refs/remotes/origin/main` on the dev tree reads
`5e9f52be23131e8faf3abc8e1bfcb0102602dc35`, and the GitHub API reports the same SHA as the head of
`main`, authored 2026-08-30T00:18:41Z (#1399). The local ref is trustworthy here only because the
remote has not moved since the fetch that wrote it; that is a coincidence this run could check, not
a method.

## WHAT I MEASURED

**[MEASURED] Desktop Commander is gone.** `ToolSearch` for the server, then for `start_process` by
name, three times across the run: first two returned *"still connecting"*, the third returned
**"No matching deferred tools found"** — the server left the connecting list without ever landing.
No PowerShell, no `gh`, no `git`, no `status-sweep.ps1`, no `pipeline-lib.ps1`, no process table.

**[MEASURED] I am not, however, blind to the tree.** `C:\ProjectOperations2` is mounted read-write
at `/sessions/<id>/mnt/ProjectOperations2/` and is the real dev tree, not a clone. Every measurement
below is a direct file read of it. This is why this report is not one paragraph.

**[MEASURED] Dev tree ground, by file read (no `git` invoked).**
`.git/HEAD` → `ref: refs/heads/main`; `.git/refs/heads/main` → `5e9f52be…`;
`.git/refs/remotes/origin/main` → `5e9f52be…` — **converged, 0 ahead / 0 behind.**
`.git/FETCH_HEAD` mtime `2026-08-30T00:23:16Z`, `.git/index` mtime `2026-08-30T00:19:14Z` — both
written by 00's own 00:09Z run.
`index.lock`, `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`: **all absent.** No wedged git state.

**[MEASURED] Board: OPEN = 0.** GitHub API `list_pull_requests state=open perPage=100` returned the
raw string `[]`. Read as a string, not as a `.Count` on a collapsed object (DOCTRINE §9.4).

**[MEASURED] ARMED = 0.** `ls *-ready.md` at depth 1 of `docs/pr-prompts/` →
*"No such file or directory"*. `ls -1 *-HOLD.md | wc -l` → **61**, matching the 61-prompt census
DOCTRINE §9.5 records. The brake is held and nothing is staged behind it.

**[MEASURED] COLLECT: the set is EMPTY.** `find docs/pr-prompts -maxdepth 1 -newermt "2026-08-30
09:50 +1000"` returns exactly two paths, both timestamped 00:19Z: 00's own `0009` breadcrumb and
03's `2305` breadcrumb. Both were collected and fully dispositioned by the 00:09Z run and both
landed on `origin/main` in #1399. **No station has written a breadcrumb in the 1.8 h since.**

**[MEASURED] No station is SILENT — from the source, not from a run.** `CADENCE` is a literal at
`scripts/pipeline/check-breadcrumb.mjs:36`: `{ '00': 2, '02': null, '03': 24, '04': 4, '05': 24 }`,
and a station is silent past 2×. Ages computed from the filename stamps, which is the same key the
script uses:

| station | last stamp | age @02:10Z | threshold | verdict |
|---|---|---|---|---|
| 00 | 2026-08-30 0009 | 2.0 h | 4 h | ok |
| 03 | 2026-08-29 2305 | 3.1 h | 48 h | ok |
| 04 | 2026-08-29 2210 | 4.0 h | 8 h | ok |
| 05 | 2026-08-29 1412 | 12.0 h | 48 h | ok |

**[MEASURED] The watcher's queue stopped at the same minute the OAuth token did.** The newest file
anywhere under `docs/pr-prompts/processed/` is
`pr-station-contract-breadcrumb-validator-and-qa-claim-ready.md.log`, mtime **2026-08-28T16:13Z**
(`2026-08-29 02:13 +1000`). 00's 0009Z run measured, at source, `mtime 16:13:26Z` and
`expiresAt 2026-08-28T16:13:35.984Z` on `C:\Users\Marco\.claude\.credentials.json`. Three clocks,
two instruments, one minute. **33.9 h with nothing processed.**

**[CANNOT MEASURE] the token itself, this run.** `C:\Users\Marco\.claude\.credentials.json` lives
outside every mounted folder; a bounded search of the two mounted trees found no credential file,
and an unbounded one timed out at 120 s against the mount. The twelfth reading therefore still
stands as the latest, and it is 33.9 h old rather than 31.9 h. **No thirteenth reading was taken —
do not read one into this report.**

**[LEAD, not a finding] The last token write was 9 seconds short of its own expiry.** From the
0009Z numbers: written `16:13:26Z`, expiring `16:13:35.984Z`. A refresh that writes a credential
with ~9 s of life left did not simply *stop* refreshing — its last act produced something already
spent. That is a different failure shape from "the refresher died", and it points at the response
being stale on arrival rather than at the timer. This belongs to whoever gets a shell next; I could
not open the file to test it.

**[MEASURED] `needs-marco/` holds 23 entries** by raw `ls -1 | wc -l`. `status-sweep.ps1` reports
`needs-marco: 14`. **Do not reconcile these by picking one** — they are different queries and
DOCTRINE §9.6 is explicit that counts are instrument-dependent. Cite the command or say nothing.

**[MEASURED] `STOP-WATCHER-LANE2` present in `C:\po-watcher\`, `STOP-WATCHER` absent.** By design
since 2026-08-15 (DOCTRINE §9.5). Not drift, not news, recorded so the next run does not re-find it.

**[CANNOT MEASURE] the watcher node process.** No process table without a shell. Standing rule is to
confirm the node process before any arming decision; I cannot, which is one of three independent
reasons nothing was armed.

## WHAT CHANGED

**Nothing.** No file in any tree was created, modified, renamed or deleted by this run except this
breadcrumb. No prompt was armed or disarmed, no PR merged, no label touched, no process started or
killed, no `git` command executed anywhere.

## FINDINGS

**F1 — Desktop Commander absent; the four-run sighted streak is broken.**
The alternation now reads: 14:09 blind · 16:09 sighted · 18:09 blind · 20:09 sighted · 22:09
sighted · 00:09 sighted · **02:09 BLIND**. Four consecutive sighted runs did not mean it was fixed.
The cause remains unknown and unowned, and it is already an open escalation to Marco — this run adds
one data point and the observation that the streak was not a recovery signal. It also adds the
counter-fact the bootstraps still get wrong: **blindness is not predicted by the scheduled-task
listing, and it did not stop this run from measuring the tree.** Folding into the existing
escalation rather than opening a second.
**DISPOSITION: DEFERRED** — urgent the moment a run needs to arm, merge or restart something; today
there is nothing to arm and nothing open to merge, so blindness cost this board no motion.

**F2 — The collector cannot be run by the runs that most need it.**
`check-breadcrumb.mjs` calls `execSync` on `git ls-tree -r --name-only origin/main -- <dir>` and
`git ls-files <dir>` at `:98-101`. Running that from the Linux side against the Windows `.git` is
exactly the hard stop DOCTRINE §9.2 names — a cut-short VM-side call leaves a 0-byte `index.lock`
with no Windows process behind it, which never expires and freezes every station. **So a mount-only
run must not run the validator, and `--freshness` is unavailable precisely on the runs that are
blind** — the runs least able to tell a quiet station from a dead one. I substituted the table above:
same `CADENCE` literal, same filename stamps, no subprocess. That is a workaround, not a fix.
**DISPOSITION: DEFERRED** — the fix is small and additive (a `--no-git` / stat-only freshness path
that skips `tracked()` and says so in its output, leaving today's behaviour untouched when git is
present). It becomes urgent the first time a blind run needs to answer "did 03 die?" and cannot.

**F3 — New evidence for the open 06 escalation: 06 is not merely unscheduled, it is invisible.**
`CADENCE` at `check-breadcrumb.mjs:36` has **no `'06'` key at all** — not `null` like `'02'`
(which is explicitly rendered *"dispatch-only — no cadence to miss"*), simply absent. So Station 06
cannot be reported ok, cannot be reported SILENT, and does not appear in the freshness output in any
form. This is the mechanism behind the standing escalation that *"DISPATCHED → 06 parks instead of
closing"*: there is no instrument that can ever notice the parking. The three options already put to
Marco stand unchanged — (A) give 06 a cadence · (B) let 00 action such items · (C) leave it —
and (A) is the one that satisfies both halves of RULE 1, because adding a key is complete and purely
additive. This run adds the evidence, not a new question.
**DISPOSITION: ESCALATED** — folded into the existing 06-cadence escalation. Do not open a second.

**F4 — The brake is correctly held, and this is the cheapest reading of it yet.**
OPEN = 0, ARMED = 0, 61 HOLDs, dev tree converged at `5e9f52be`, no lock and no interrupted-merge
state. Every one of those came from a file read; none needed a shell. The stillness is a held brake,
not a stall and not health — and the queue's own last-processed timestamp now corroborates the token
reading from a second, independent instrument.
**DISPOSITION: ACTIONED** — the collect was performed, the set was empty, and the emptiness is
accounted for rather than assumed.

## WHAT I DID NOT DO

- **Did not run any `git` command, anywhere, by any route.** Every git fact above is a file read of
  `.git/`. This is the one hard stop a mount-only run is most likely to trip.
- **Did not run `check-breadcrumb.mjs`, `lint-station.mjs`, `lint-prompt.mjs` or `status-sweep.ps1`**
  — the first three shell out to `git` (F2) and the fourth needs PowerShell. Consequently this run
  contains **no `breadcrumb-clean` claim**: the contract forbids writing one until the validator has
  actually exited 0, and it has not.
- **Did not arm anything.** Three independent bars, any one of which suffices: the OAuth block stands
  (33.9 h expired, unrefreshed), the node process cannot be confirmed, and arming is a `git mv` I
  have no `git` to perform.
- **Did not merge.** OPEN = 0; there was nothing to merge.
- **Did not clear the 13 stale `[STALE]` entries in `needs-marco/`.** Still an unreviewable disk
  operation on a gitignored folder, still correctly deferred, and doubly so with no shell.
- **Did not present the GitHub-side reads as tree coverage.** They confirmed OPEN = 0 and the head
  SHA of `main`; they say nothing about what the watcher globs, and the mount is what answered that.
- **Did not take a thirteenth OAuth reading.** The file is outside the mount. The twelfth stands,
  aged.

**This breadcrumb is untracked on the dev tree.** The next board PR should sweep it up; per the
2009Z cure, re-run `node C:\po-sup-fix-scripts\sup-2209-ff-unblock.mjs <repo-relative-path>` after
that PR lands, because a collecting PR creates exactly the untracked twin that blocks the next ff.

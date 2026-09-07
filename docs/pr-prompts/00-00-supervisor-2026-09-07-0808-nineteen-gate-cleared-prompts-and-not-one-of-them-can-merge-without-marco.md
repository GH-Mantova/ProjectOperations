# Station 00 — Supervisor | 2026-09-07T08:08Z–2026-09-07T08:5xZ

## GROUND

```
UTC            2026-09-07T08:08:43Z
origin/main    fa9f74a4            (fetch --prune first, then rev-parse)
dev tree       main @ fa9f74a4  C:\ProjectOperations2   (0 0, no fast-forward needed)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was **not** read-only on that account.

**SIGHTED run.** `start_process` shell `powershell.exe` returned a live prompt on the Windows host
(`LAPTOP-E6NHU4E4`, local clock `2026-09-07T18:08:43+10:00`); the persistent shell was pid **8660**.

Device-bridge git guard, run at the top of the run per PREFLIGHT, last line quoted verbatim:
`vm-git-guard installed at /sessions/gracious-gifted-hawking/.local/bin/git - refuses mounted paths,
allows everything else (both controls passed)`. [MEASURED]

All three binding documents read **in full** this run, from the working copy, with freshness proved
rather than assumed: `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md` returned **EMPTY**,
so the working copy IS `origin/main` for all three. No piped hash was taken (PREFLIGHT step 2).
[MEASURED]

`status-sweep.ps1`, captured to a file so its §7 verdict survives the early return (the file is
105,920 bytes of **UTF-16LE** — PowerShell `*>` redirection, §9.3 — and was read with node, never
by byte count):
**`§7 VERDICT — [LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no
live station worktrees.`** · in-progress prompts **0** · `index.lock` interactive/clone
**False / False** · git processes **0** · no PR touched in the last 2 min · `armed (*-ready.md)`
**0** · instrument controls both PASS. [MEASURED]

**Fresh needle minted for this run: `zzQq00Nd20260907T0830`.** It returned **0** on every corpus it
was run against (the processed-log directory, the edited prompt file). **It is spent the moment this
file is tracked — do not reuse it.** (§9.6.)

## WHAT I MEASURED

### The machinery — healthy, and nothing to fix

`restart-watcher-if-wedged.ps1` (report-only, the sanctioned liveness probe):
**`VERDICT: OK - nothing armed and the watcher is alive. An idle watcher is correct, not wedged.`**
· `armed prompts waiting: 0` · `watcher process: ALIVE (pid 31660)` · `restart churn: 0 cycle(s) in
20 min`. Cross-checked against the process table: node **pid 31660**, parent **36576**, started
`09/07/2026 09:05:03` local — a resolved parent chain, not a `wrapper=0` guess. [MEASURED]

### The board — 4 open, and every one of them is Marco's

`gh pr list --state open --json …`, assigned then iterated (never piped straight into
`Where-Object`/`ForEach-Object`, §9.4 — the first attempt did pipe it and collapsed all four rows
into one object, which is what that bullet describes). `COUNT=4`. [MEASURED]

| PR | state | created | labels | files | lane |
|---|---|---|---|---|---|
| **#1769** | CLEAN | 07:30:49Z | — | `scripts/pipeline/triage-holds.ps1` | **watcher-opened**, verdict `marco:true` |
| **#1767** | BLOCKED, 2 red | 06:43:58Z | `do-not-merge` | migration + `apps/api/**` + `docs/data-model/**` | `[NO LANE VERDICT — hand-classified]` ⇒ MARCO'S |
| **#1760** | BLOCKED | 05:34:03Z | — | `scripts/pr-watcher/index.mjs` + test + `merge-approvals/1760.md` | `[NO LANE VERDICT — hand-classified]` ⇒ MARCO'S |
| **#1746** | CLEAN | 00:23:22Z | — | migration + `apps/api/**` + `merge-approvals/1746.md` | `[NO LANE VERDICT — hand-classified]` ⇒ MARCO'S |

RULE 2 probe, pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed` and never
the clone (§9.5): **2045** logs, newest **2026-09-07T07:50:45Z** — younger than the oldest open PR
(`#1746`, 00:23:22Z), which is the control that separates the live directory from the 17-day-stale
decoy. `marco.:true` (regex form, never `-SimpleMatch`) → **620**; NEGATIVE control, this run's
minted needle → **0**; POSITIVE control on a PR the watcher DID open, `PR #1742\b` over
`processed\pr-*.log` → **2**; NEGATIVE `PR #999999\b` → **0**. Calibrated in both directions.
[MEASURED]

`#1769` returned **one** hit and it is a real verdict:

```
pr-triageholds-s2-env-os-is-empty-in-a-station-shell-ready.md.log ::
  [watcher] merge result for PR #1769: {"ok":false,"marco":true,
  "reason":"outside tests/ or docs/: scripts/pipeline/triage-holds.ps1"}
```

That is a **genuine policy routing**, not the byte-identical timeout string §10.3 warns about — the
reason names the offending path rather than a missed window. **RULE 2 binds absolutely. #1769 is
not mine to merge, and it is the prompt I armed myself an hour ago.**

`#1767`, `#1760` and `#1746` each returned **0**, so each is recorded `[NO LANE VERDICT —
hand-classified]` and classified by `classifyPolicyFiles` on its own file list: two carry
`(^|/)migrations/`, one is `scripts/pr-watcher/` — all three outside `tests|docs`, all three
**MARCO'S**.

### #1767's two reds have exactly ONE cause, and it is the gate working

This closes the **F7 DEFERRED** in my own 07:08Z breadcrumb, whose probe was "read the job log once
that run finishes". It has finished. Both logs read in full (§3 — never diagnosed from the diff):

`PR gates — diff checks`, run `34097880349` job `101665440918` — every other gate passed:
`ALLOWED CP-11 migrations` · `PASS CP-12` · `PASS CP-13` · `PASS CP-17` · `SKIP CP-09/10` ·
`PASS CP-23` · `PASS CP-24 sot-purity` · `SKIP CP-22` · `PASS CP-25`, then

```
FAIL - CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true).
       A human must review and REMOVE the label; removing it is what releases the merge.]
##[error]Process completed with exit code 1.
```

`Approval receipt (CP-26)`, job `101665440751`:
`FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label…`

[MEASURED] **Two red check runs, one cause: `LABEL_PRESENT`.** This is the recorded CP-26 ⇄
`PR gates — diff checks` coupling, measured cleanly on a live PR: `pr-gates.mjs` runs its own CP-26
assertion after every other gate has passed, so a labelled PR is red twice for one reason. Neither
red is a defect and neither is mine to clear — removing a `do-not-merge` label is Marco's alone.
[MEASURED, and the inference stated as one: that the two reds share a cause is measured; that the
coupling is *why* it is worth writing down is the standing record.]

`#1769`, `#1760` and `#1746` are **fully green** — `gh pr checks <n>` filtered to non-`pass` rows
returned nothing for all three. [MEASURED]

### The arming picture — 19 candidates, and not one of them can merge without Marco

`triage-holds.ps1` over **53** depth-1 `-HOLD.md`: **19 GATES SATISFIED (lint ADMIT)**, 30 STILL
GATED, `spent=4 of 23 evaluated`. I then read the `scope:` front matter of **all 19** candidates in
node. [MEASURED]

**Zero of the nineteen is `tests/`-or-`docs/`-only.** Every one names `apps/**`, `scripts/**`,
`.github/**`, `sot/**` or `package.json`, so every one of them, built, produces a PR that
`classifyPolicyFiles` routes to Marco exactly as `#1769` was. The watcher's `tests-docs`
auto-merge lane — the only path that moves the board without him — has **nothing on the board it
can take**.

§10.6 open-PR cross-check, run the corrected way (a `/`-terminated `scope:` entry matched as a
**PREFIX**, any overlap treated as a candidate needing confirmation, never as a verdict):

| ADMIT prompt | open PR | overlap | confirmed on |
|---|---|---|---|
| `pr-tr-s1-reminder-policy` | #1767 | migrations dir prefix + 5 exact | marker/scope — **TRUE duplicate** |
| `pr-rates-plant-fuel-column` | #1746 | migrations dir prefix + 3 exact | `PLANT_FUEL_COLUMN_V1` — **TRUE duplicate** |
| `pr-watcher-gate-path-space` | #1760 | 2 of 2 exact | title/scope — **TRUE duplicate** |
| `pr-fixlane-s1-…-can-never-escalate` | #1760 | 1 of 2 (`index.mjs`) | different work — **false positive** |
| `pr-rateparity-s1-harness` | #1746 | 1 of 4 (`rate-resolver.service.ts`) | different work — **false positive** |

The directory-prefix half of the rule earned its keep twice here: both migration prompts match
`#1767`/`#1746` **only** through a `/`-terminated entry, which an exact-path set test cannot see.
`pr-watcher-gate-path-space` is a **third live §10.6 instance and was on no never-arm list** —
worth saying plainly, because the two that were listed were listed by someone remembering them.

### The premise probe is blind on 30 of 53 HOLDs, and it says so itself

The prompt I armed at 07:20Z (`#1769`) asserts a station shell has no `$env:OS`. Re-measured in this
run's shell **and in a child `powershell -NoProfile` process**, which is the shape
`triage-holds.ps1` is invoked in:

```
PARENT env:OS=[]         CHILD env:OS=[]   CHILD env count=54
"echo NEEDLEOK" | & "/bin/bash" -s   ->  THREW: The term '/bin/bash' is not recognized…
```

So `triage-holds.ps1`'s bash resolution (`if ($env:OS -eq "Windows_NT")`, else `$bashBin =
"/bin/bash"`) falls to the POSIX literal and every premise probe fails. Its own report says so, and
its own control fires:

```
PREMISE UNMEASURABLE -- 30 rejected prompt(s) whose premise could not be RUN
!!! SUSPECT: this bucket is UNMEASURABLE this run -- fixture probe returned UNMEASURABLE
    (expected SPENT) -- could not execute /bin/bash…
!!! An empty bucket above proves NOTHING. Fix the control before believing it.
```

[MEASURED] **The `spent=4` figure comes entirely from `lint-prompt.mjs`'s exit 3** (which has its
own working `findBash`), not from this probe — the report states `4 from lint plus 0 from the
probe`. So the prompt's premise is right, its cure is the right shape, and the instrument is
honest about its own blindness. **What is new is the size of the hole: 30 of 53 HOLDs have an
unmeasurable premise on every run until `#1769` merges.**

### The watcher clone

Read-only `git` only (never `checkout`/`merge`/`commit` there). `git -C C:\po-watcher\ProjectOperations
status --porcelain` → 4 untracked entries; HEAD `1ddf3fb4`; `git -C C:\ProjectOperations2 rev-list
--count 1ddf3fb4..fa9f74a4` → **2** (both of today's docs merges). Three of the four dirty entries
are `docs/pr-reviews/pr-{1760,1767,1769}-review.md` — the review lane's own output, **PRESERVE**.
The fourth is F4 below. [MEASURED]

## WHAT CHANGED

One board PR, opened from an isolated worktree off `origin/main`
(`C:\po-worktrees\bd0830`, branch `docs/prompt-grant-sentence-and-archive-0830`), torn down at the
end of the run. Every edit made in **node, by concatenation** — never `String.replace` with a
replacement string (§9.3) — with the byte delta ASSERTED before the file was accepted. The PR is
**docs-only**, i.e. inside this station's own lane.

1. **`docs/pr-prompts/pr-triage-holds-open-pr-duplicate-bucket-HOLD.md`** — added the verbatim
   grant sentence the linter names. Read-back: `beforeBytes=8302 afterBytes=8387 actualDelta=85
   expectedDelta=85 deltaOK=true`; `sentence_occurrences=1`; `anchor_occurrences=1`; `U+FFFD` 0;
   `â€` 0; no BOM; `git diff --numstat` → `2 0` (insertions, zero deletions).
   `lint-prompt.mjs` before: **REJECT [MISSING_STANDING_AUTHORITY]**, exit 1. After: **ADMIT
   (size 2)**, exit 0.
2. **De-duplicated a breadcrumb tracked at two paths** — `git rm` of the ROOT copy of
   `00-04-scanner-2026-09-07-0610-…md`, keeping the `archive/` copy (F5).
3. **Archived two dispositioned breadcrumbs** — the 0608 and 0637 supervisor runs, `git mv` to
   `docs/pr-prompts/archive/`, both staged `R100`.
4. **`docs/pipeline/stations/00-supervisor.md`** — new section recording F5's mechanism and cure.
   `beforeBytes=77646 afterBytes=80204 actualDelta=2558 expectedDelta=2558 deltaOK=true`;
   `newBlock_occurrences=1`; `canonicalBlock_starts=2` (the canonical block untouched); `U+FFFD` 0;
   `â€` 0; no BOM; `--numstat` `36 0`. `lint-station.mjs` → **`ADMIT: all 8 docs clean`, exit 0.**
5. This breadcrumb, written **inside the PR worktree** (cure 1 of the post-merge FF trap), so no
   loose untracked copy is left in the dev tree.

The dev tree's ` D` for `pr-triageholds-s2-env-os-…-HOLD.md` is **LEFT UNCOMMITTED** — `#1769`
deletes it, as with every consumed HOLD.

**Nothing merged from another lane. No label added or removed. No receipt authored. No prompt armed.
No watcher restart. No `git` run against the mount or in `C:\po-watcher\ProjectOperations` beyond
read-only. No `checkout .` / `reset --hard` / `stash pop` / `clean` anywhere.**

## FINDINGS

### F1 [S2] — 19 gate-cleared prompts, and not one of them can merge without Marco

Measured above: all four open PRs are Marco's, and **zero of the 19 ADMIT candidates is
tests/docs-only**, so arming any of them adds a fifth PR to a queue that already waits on him.
`pollForBehindPrs` also rebuilds every open PR after each board merge, so the churn scales with
that queue. This is the throughput constraint stated as a measurement rather than a mood.

**DISPOSITION: ACTIONED — by NOT arming.** `armed` stays 0 this run, deliberately, and the reason
is recorded so the next run does not re-derive it. The arming precondition is not "the watcher is
idle"; it is "there is work the board can absorb". ⚠️ **The falsifying probe is the scope scan** —
re-read the `scope:` front matter of the ADMIT bucket; the moment one is `tests/`-or-`docs/`-only,
arm it, because that one can auto-merge with no human at all.

### F2 [S2] — #1769 is green, is Marco's, and 30 of 53 HOLD premises stay unmeasurable until it merges

`#1769` fixes the exact defect this run measured live: `triage-holds.ps1` cannot execute any
premise on this box, so its `PREMISE UNMEASURABLE` bucket held **30 of 53** HOLDs and its own
fixture control failed. The PR is **CLEAN**, all checks green, touches **one** read-only reporting
script, and is routed to Marco solely because `scripts/pipeline/` is outside `tests|docs`.

**DISPOSITION: ESCALATED** → Marco. RULE 1 order:

**(a) [complete + additive — FIRST] Merge `#1769`.** Restores the premise probe for all 53 HOLDs
permanently; the change is one PowerShell script that mutates nothing and reports only, so it
cannot damage existing or future data entry. Fixes today and every future run in one move.
**(b) Grant the scheduled 00 lane authority to merge `scripts/pipeline/**` PRs it armed itself.**
Fixes today, fails the *future* half: it widens a merge gate across a whole directory to solve one
PR, and the gate is the only thing standing between this lane and unreviewed script changes.
**(c) Leave it.** Fails the *immediate* half: every arming decision until it merges is made with a
blind SPENT bucket over 30 prompts, which is how a spent prompt gets armed.

I deliberately did **not** open a `needs-marco/` file for this: it self-expires the moment he
merges, and `status-sweep.ps1` §5 already tags eight dead files in that folder `[STALE]` every run —
adding a ninth that will join them is the defect 03 is already dispatched to clean up. This tracked
breadcrumb is the durable channel.

### F3 [S3] — `pr-watcher-gate-path-space-HOLD.md` is a live §10.6 duplicate of open #1760, and was on no never-arm list

Its `scope:` is exactly `#1760`'s two changed files (`scripts/pr-watcher/index.mjs`,
`scripts/pr-watcher/__tests__/gate-path-space.test.mjs`), it lints **ADMIT**, and it will keep
linting ADMIT until `#1760` **merges**, not until it opened (§10.6). The two prompts already on the
standing never-arm list were there because someone remembered them; this one was not, and the
`scope:` cross-check is what caught it.

**DISPOSITION: ACTIONED.** Not armed, left as a `-HOLD` and untouched, recorded here with the two
other true duplicates. The durable cure is F4 — the instrument, not the memory.

### F4 [S3] — the instrument that automates §10.6 was blocked by one missing boilerplate sentence

`pr-triage-holds-open-pr-duplicate-bucket-HOLD.md` adds the `DUPLICATES OF AN OPEN PR — DO NOT ARM`
bucket to `triage-holds.ps1` — i.e. it prints, at the point of the arming decision, exactly the
three duplicates F3 and the table above found by hand. It has been **REJECT
[MISSING_STANDING_AUTHORITY]** — a `## STANDING AUTHORITY` heading present but the one verbatim
grant sentence absent — so it could never be armed, while 06 (its staging station) has no cadence
to notice.

**DISPOSITION: ACTIONED.** The verbatim sentence added and read back; the prompt now lints
**ADMIT (size 2)**, exit 0, gate `SPENT_BEHIND_A_REJECT_V1` satisfied.
🔴 **DO NOT ARM IT UNTIL `#1769` MERGES.** Its sole `scope:` entry is
`scripts/pipeline/triage-holds.ps1`, the same single file `#1769` changes. Under the corrected
§10.6 rule a 1-of-1 single-file overlap is a **candidate, not a verdict**, and confirming on the
marker strings (`OPEN_PR_DUPLICATE_V1` vs `TRIAGEHOLDS-S2`) shows it is **not** a duplicate — but
two PRs on one file guarantees a conflict for whichever lands second, and the prompt's own
`requires_on_main` chain gate exists for exactly that reason.

### F5 [S3] — one breadcrumb is tracked at TWO paths, because archiving leaves the dev tree's copy behind

`00-04-scanner-2026-09-07-0610-…md` is tracked at both `docs/pr-prompts/` and
`docs/pr-prompts/archive/` on `origin/main`, **byte-identical** — `git rev-parse origin/main:<path>`
returns blob `85c147fc` on both sides. The `archive/` copy was added by **#1766** (`f6924544`,
06:36Z); the root copy by **#1768** (`7872d84c`, 07:38Z), whose breadcrumb records *"it was
untracked and reached nobody until now"* — false when written. **1 duplicated basename against 63
root and 434 archived files.**

The mechanism: `git mv` into `archive/` happens in the PR worktree, so the dev tree keeps its own
untracked copy at the ROOT path and `git status` there is unchanged. The next run reads that as an
unreported finding and commits it again. This is the mirror of the existing delete-your-disk-copy
rule, applied to `mv` instead of `add`.

**DISPOSITION: ACTIONED.** Root copy `git rm`-ed (archive copy is the survivor) and the mechanism
plus both cures landed in `00-supervisor.md`. **Safety proved, not assumed:** with only the
`archive/` copy left, `check-breadcrumb.mjs --freshness` still reported
`04  last 2026-09-07T06:10:00Z  2.2h ago  (cadence 4h)  ok`, `CLEAN`, exit 0 — freshness matches by
trailing path segment (§9.5), so archiving and de-duplicating cannot make a station read SILENT.

### F6 [S3] — a 1.03 MB CI log is sitting in the watcher clone under a filename that is a mangled Windows path

`C:\po-watcher\ProjectOperations\` holds an untracked file whose name is the literal string
`C:\po-watcher\ProjectOperations\.._scratch_1740_log.txt` collapsed into **one filename**, with the
`:` stored as **U+F03A** (git prints it `C\357\200\272po-watcherProjectOperations.._scratch_1740_log.txt`)
and the backslashes gone. **1,033,778 bytes**, mtime `2026-09-07T01:24:17Z`; its content is a
`gh run view --log` dump of the `API — lint, test, compliance smoke` job for PR **#1740**.

U+F03A is the private-use substitute a POSIX-style path layer writes when asked to put `:` in a
filename, so this was almost certainly a redirect built from a Windows path string on the VM/bash
side and written as a relative filename in whatever directory was current. It is harmless in
itself, and it is one of the four entries that make `status-sweep.ps1` print
`watcher clone: branch=main dirty=4 <-- NOT clean-on-main; the watcher may refuse to start`.

**DISPOSITION: DISPATCHED → 03 machine-minder** (local trees and clone hygiene are its lane; the
clone is also **2 commits behind** `origin/main` at `1ddf3fb4`, and only 03 may fast-forward it).
Two asks, in order: **delete the stray scratch file** (untracked, reproducible from `gh`, no
information lost); and **preserve** `docs/pr-reviews/pr-{1760,1767,1769}-review.md`, which are the
review lane's live output and must not be swept with it. I did not delete it myself: writing in the
watcher clone is not this station's hand.

## WHAT I DID NOT DO

- **Merged nothing.** `#1769` carries a real watcher `marco:true` verdict — RULE 2 binds absolutely
  and it is not cleared by the PR being green, unlabelled, or armed by me. `#1767`, `#1760` and
  `#1746` are hand-classified MARCO'S with the controls quoted above; two carry their own
  supervised-lane receipts.
- **Armed nothing** — F1. `armed` is 0 and that is a decision, not an omission.
- **Did not author a `docs/decisions/merge-approvals/<N>.md` receipt**, and did not add or remove a
  label. Marco's 2026-09-07 ruling releases the **supervised cloud lane** to merge with a receipt;
  this is the **scheduled** lane and that ruling does not reach it.
- **Did not "fix" #1767's reds.** Both are `LABEL_PRESENT` — the gate doing its job. A fix would
  mean removing the label, which is Marco's alone.
- **Did not touch the watcher clone beyond read-only `git`**, and did not delete the stray file in
  F6.
- **Did not touch `C:\po-vg`** — the orphaned worktree holding 1 uncommitted file, now 4337 minutes
  old. Already 03's and already escalated; `--force` would discard the file.
- **Did not restart, kill or relaunch anything.** `restart-watcher-if-wedged.ps1` returned `OK`,
  parent chain resolved, churn 0 in 20 min.
- **Did not archive the 0708 breadcrumb.** Its F7 was DEFERRED and this run resolved it, so keeping
  it in the queue root for one more cycle puts the question and its answer next to each other.
- **Did not run `git` against the mount, did not touch `/sot/`, Azure, Entra, SharePoint or
  production data.**
- **[CANNOT MEASURE]** which actor opened or labelled `#1767`, or which wrote the F6 scratch file:
  `mergedBy`, the label-timeline actor and every agent's authentication all read `GH-Mantova`, and
  the stray file carries no author.

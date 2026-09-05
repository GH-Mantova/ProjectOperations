# Station 00 — Supervisor | 2026-09-05T09:08Z–2026-09-05T09:2xZ

## GROUND

```
UTC            2026-09-05T09:08:22Z
origin/main    0072c15a            (fetched this run; dev tree was f2a6779f and was fast-forwarded to it)
dev tree       main @ 0072c15a     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE — this run is not read-only on that account.

**SIGHTED run.** `start_process` on `powershell.exe` returned PID 31144 on the first attempt after a
keyword `ToolSearch` for `desktop-commander`. Every measurement below is from that shell on the
Windows host, in the dev tree `C:\ProjectOperations2`, never the watcher clone (§9.5).

Freshness of the three binding documents was established the sound way (§9, the piped-hash trap):
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` returned **EMPTY output** — the working copies are the
`origin/main` blobs. No piped `hash-object` was used and none is quoted.

## WHAT I MEASURED

**Board (status-sweep.ps1, captured to a file per the return-early trap; exit 0, 09:09:02Z).**

- §7 VERDICT: **`CAUTION`** — no local lock, but a PR was touched on GitHub inside the last 2 min.
- §1 OPEN PRs: **1** — `#1651` BLOCKED, `fix(tendering): reading an item's measurements no longer
  writes one (SCOPE_WBS_REVEAL_V1)`. main CI on `0072c15a`: 4 success / 0 failed (trunk green).
- §2 watcher node RUNNING pid 20000; wrapper alive; heartbeat 47 min; **watcher clone dirty=3**;
  one orphaned worktree `C:/po-vg` dirty=1 age 1515 min.
- §3 in-progress prompts 0 · index.lock false/false · git processes 0 · **remote board activity in
  last 2 min: `#1651` OPEN**.
- §4 armed (`*-ready.md`) 0 at sweep time · needs-marco 22 · no-pr-opened 109 · failed 41 ·
  blocked 117 · `-HOLD.md` **79**.

**COLLECT — `node scripts/pipeline/check-breadcrumb.mjs --freshness`, exit 0, `CLEAN`.**
5 breadcrumbs checked, 0 malformed. Freshness: `00` 1.0h (cadence 2h) ok · `02` dispatch-only ·
`03` 10.2h (24h) ok · `04` 3.0h (4h) ok · `05` 19.0h (24h) ok. **No station is SILENT, and no
breadcrumb has been written by any station since my own 0808 run** — so there is nothing new to
disposition from the station channel. Everything below came from the board itself.

**[MEASURED] The only review verdict on record for `#1646` reads BLOCK, and `#1646` is on `main`.**

```
docs/pr-reviews/pr-1646-review.md   line 1: "VERDICT: BLOCK"   LastWriteTimeUtc 07:33:30Z
docs/pr-prompts/processed/rev-1646-ready.md.log  07:34:05Z, Exit 0:
  "PR #1646 verdict: **BLOCK**. Three E2E acceptance tests fail (DOM paths changed when
   measurement/comment blocks moved into expandable rows)."
gh pr view 1646 -> mergedAt 2026-09-05T08:50:16Z, mergedBy GH-Mantova, labels []
                   statusCheckRollup: 14 checks, ALL SUCCESS, including tendering-e2e
```

The blocking condition was genuinely fixed — `tendering-e2e` is SUCCESS at merge. What was *not*
done is re-running the review: `Get-ChildItem docs/pr-prompts/processed/rev-1646*` returns exactly
two files, the job and its one log. There is no second review job, and `pr-1646-review.md` has not
been touched since 07:33:30Z. **A PR merged 76 minutes after a BLOCK verdict was written, and that
verdict is still the only one on file.**

**[MEASURED] This is not a one-off — the review file is write-once and is never retired.**

```
Select-String docs/pr-reviews/pr-*-review.md -Pattern '^VERDICT:\s*BLOCK'   -> 3
  POS control  '^VERDICT:'                    -> 79   (the probe can find verdicts)
  NEG control  '^VERDICT:\s*zzzNoSuchNeedleZzz' -> 0   (it is not matching everything)
  the three:   pr-739-review.md · pr-741-review.md · pr-1646-review.md
gh pr view -> #739 MERGED 2026-07-21T07:33:30Z · #741 MERGED 2026-07-21T03:16:46Z
              #1646 MERGED 2026-09-05T08:50:16Z
```

**3 of 3 BLOCK verdicts on disk sit on MERGED PRs.** So `docs/pr-reviews/pr-<N>-review.md` — the
file `verdictApproves` reads — carries a 100% false-negative rate on the merged population. Any
future gate, or any run, that treats a stored `VERDICT: BLOCK` as current state will be wrong every
time it fires. The pattern is fourteen days older than the cloud lane and is not attributable to it.

**[MEASURED] `#1646` was NOT a RULE 2 violation.** The live-tree probe, with both controls:

```
cd docs/pr-prompts/processed   (LIVE tree: 1941 logs, newest rev-1650-ready.md.log 08:22:50Z)
  POS 'marco.:true'          -> 612
  NEG 'zzzNoSuchNeedleZzz'   -> 0
  'PR #1646'                 -> 1   (rev-1646-ready.md.log — a REVIEW job)
  that log, 'marco.:true'    -> 0
```

The one log naming `#1646` is a **review** job, not a watcher routing verdict, and it carries no
`marco:true`. My own 08:2xZ stanza recorded `#1646` as *"prompt-log 0 ⇒ SECOND LANE, hand-classified
MARCO'S"* — the second-lane half stands, the *"prompt-log 0"* half is now **REFUTED**: the log
existed at 07:34:05Z, before that reading. The earlier probe searched for the PR number when the log
is keyed by prompt name and only names the PR in its body. **The hand-classification was right for
the wrong reason.**

**[MEASURED] `#1651` is the same lane, mid-flight, and I must not touch it.**

```
gh pr view 1651: author GH-Mantova · head pr-cardui-s5b-reveal-not-append · created 09:08:23Z
  autoMergeRequest enabledAt 09:08:25Z by GH-Mantova, SQUASH · labels [] · MERGEABLE / BLOCKED
  checks: 11 SUCCESS, 3 still empty (tendering-e2e, API lint/test, Web lint/build)
gh pr diff 1651 --name-only includes docs/decisions/merge-approvals/1651.md
  that receipt: approved_by: marco · approved_at: 2026-09-05T08:46:00Z · quotes > Marco: "ok"
docs/pr-prompts/rev-1651-ready.md created 09:10:26Z  <- the review job for it is already armed
```

Auto-merge was armed two seconds after open. This PR will merge itself when CI goes green,
without me. That is `DOCTRINE §10.2.1`'s supervised cloud lane behaving as §10.2.1 describes.

**[MEASURED] A mangled path has written a file into the watcher clone and is dirtying it.**

```
git -C C:\po-watcher\ProjectOperations status --porcelain
   M docs/data-model/metadata-catalog.json
  ?? "C\357\200\272temppr-1648.diff"
  ?? scripts/pr-watcher/.conflict-notified-prs.json
Get-ChildItem C:\po-watcher\ProjectOperations -Filter *.diff -Force
  C?temppr-1648.diff   8260 bytes   2026-09-05T07:42:10Z
```

`\357\200\272` is **U+FF1A FULLWIDTH COLON**. Something ran the moral equivalent of
`gh pr diff 1648 > C:\temp\pr-1648.diff` through a form that replaced `:` with the fullwidth
character and dropped both backslashes, so instead of writing to `C:\temp\` it created a file named
`C：temppr-1648.diff` **in the current directory — which was the watcher clone root.** The timestamp
puts it one minute after `#1648` merged (07:41Z). It is one of the three files making the clone read
`dirty=3`, which the sweep flags as *"NOT clean-on-main; the watcher may refuse to start."*

**[MEASURED] `armed=0`, and the one `-ready.md` in the queue root is not an arm.** The single file is
`rev-1651-ready.md` — a review job, not a build prompt. This is the third run to re-confirm the
standing trap that `armed=N` is not N arms.

**[CANNOT MEASURE] Whether Marco actually said what the `#1646` and `#1651` receipts quote.** Both
name `approved_by: marco` and quote a verbatim chat exchange (`07:53Z` / `08:46Z`). Both are
authored by the lane that then merged the PR, and both arrived inside that PR's own diff. Nothing in
the repo, the label timeline or the API distinguishes a true transcription from a fabricated one —
every actor authenticates as `GH-Mantova`. This is the open question already on `#1635`; I am
recording that it recurred twice more today, not re-raising it.

## WHAT CHANGED

- `git fetch origin --prune` then `git merge --ff-only origin/main` in the dev tree:
  `f2a6779f -> 0072c15a`, fast-forward, 9 files. Verified: `git rev-parse --short HEAD` = `0072c15a`,
  `git diff --cached --name-status` EMPTY before and after (the shared index was clean, so no
  pathspec commit was needed).
- This breadcrumb was written to `C:\ProjectOperations2\docs\pr-prompts\`.
- **Nothing else.** No arm, no merge, no label, no prune, no deletion. The §7 verdict was `CAUTION`
  with a second lane demonstrably mid-flight; see WHAT I DID NOT DO.

## FINDINGS

### F1 — The review lane can only ever say BLOCK once, and nothing retires it

`docs/pr-reviews/pr-<N>-review.md` is written once by a `rev-<N>-ready.md` job and never revisited.
When the blocking condition is then fixed — as it was on `#1646`, where `tendering-e2e` went from
three failures to SUCCESS — the file keeps asserting `VERDICT: BLOCK` forever, on a commit that is
on `main`. Measured: **3 of 3** stored BLOCK verdicts are on merged PRs (`#739`, `#741`, `#1646`),
against a 79-verdict population and a passing negative control.

This is a live hazard rather than an untidiness, because `verdictApproves` reads exactly this file.
A gate wired to it today would refuse a merged PR and, worse, a run reading it would report a
shipped change as blocked — the same class as the `[STALE]` escalations §5 of the sweep exists to
suppress, but inside the one file the merge path trusts.

The complete-and-additive fix (RULE 1, both halves pass) is for the review lane to **append a
resolution stanza rather than leave the verdict standing**: when a `rev-` job is re-run, or when the
PR merges green, write `RESOLVED: <sha> <UTC>` beneath the verdict and have any reader require the
resolution line's absence before treating BLOCK as current. It damages no existing data — the
original verdict text is preserved verbatim, which matters because the verdict is the audit record
of what was wrong. The cheap alternative, deleting or overwriting the file on merge, fails the
second half: it destroys the only record that the E2E suite was ever broken by the relocation.

**DISPOSITION: DISPATCHED — Station 06 (PR Master).** The `rev-*` review lane is 06's contract, not
mine. Handed over: the three filenames, the 79/3/0 measurement with its controls, and the
append-a-resolution-stanza shape above. 06 should also decide whether `verdictApproves` currently
has any live caller — I did not measure that and it changes the severity.

### F2 — A fullwidth-colon path wrote a file into the watcher clone root

`C：temppr-1648.diff` (8260 B, 07:42:10Z) is untracked in `C:\po-watcher\ProjectOperations` and is
one of the three files making that clone `dirty=3`. The mangling — `:` becoming U+FF1A and both
backslashes vanishing — is the signature of a redirect target that went through a
filename-sanitising layer, so the write silently landed in the process's CWD instead of `C:\temp\`.
Two harms, and the second is the real one: the clone is not clean on `main`, which the sweep warns
may stop the watcher starting; and **any station following the same recipe writes into whatever
directory it happens to be in**, which for a station is usually a repo.

**DISPOSITION: DISPATCHED — Station 03 (Machine Minder).** The watcher clone is 03's. This is not a
new dispatch of "clone not clean" — that was already handed over — it is the *cause* of one of the
three files, which was not previously named. 03 should delete the file (it is a throwaway diff), and
separately find the caller: `git log --diff-filter=A` will not help since it is untracked, so search
the station docs and scripts for a `>` redirect to `C:\temp\` written from inside a repo.

### F3 — A dead escalation is still sitting in Marco's queue

`docs/pr-prompts/needs-marco/pr-1646-review-block.md` (1244 B, 07:33:15Z) was raised by the review
job that BLOCKed `#1646`. `#1646` merged at 08:50:16Z with `tendering-e2e` SUCCESS, so the
escalation is dead. It is still there. `needs-marco/` is gitignored (`.gitignore:76-83`), so it
cannot be cleared by a PR and no CI check will ever notice it.

I did **not** delete it. Removing something from Marco's own escalation queue on my own judgement is
not a call I should make unattended, and the file costs nothing but a line of noise until he sees it.

**DISPOSITION: DEFERRED.** It becomes urgent if the needs-marco count is ever used as a signal —
it is currently 22, and at least one of those is provably dead, so that count already overstates.
Clearing it is a one-line `Remove-Item` for Marco or for any run he tells to do it.

### F4 — I did not arm, and the reason is a rule, not caution

`armed=0` and there are 79 `-HOLD.md` in the queue, so on the face of it this station's ARM lane had
work. It did not. The `scope-card-redesign` cluster is being driven right now by the supervised
cloud lane: `#1646` (s5) merged 08:50Z, `#1651` (s5b) opened 09:08:23Z with auto-merge armed two
seconds later, and the `#1646` receipt states on its face that **s6, s7 and s8 are all released and
all gated behind it**. Arming any of them from this lane puts two actors on one cluster — LL-38,
and precisely the trap my own 08:2xZ stanza recorded as *"DO NOT ARM
`pr-cardui-s5-actions-and-expandables-HOLD` while `#1646` is open"*. That instance is now spent, but
the rule generalises and should be applied to s6/s7/s8 for as long as the cloud lane holds the
cluster.

**DISPOSITION: DEFERRED.** The trigger to re-arm from this lane is explicit: the cloud lane's PR
count on `pr-cardui-s*` reaching zero open **and** no new `docs/decisions/merge-approvals/<N>.md`
appearing for a full cadence. Until then, arming here is a collision, not throughput.

### F5 — My own prior escalation was answered from the other side, and should not be re-raised

My 08:2xZ stanza recorded: *"`escalates: true` IS ENFORCED BY A WATCHER-APPLIED LABEL, SO OUTSIDE
THE WATCHER THE HUMAN GATE DOES NOT EXIST"*, naming `#1631 #1633 #1638 #1639` as built from
`escalates: true` prompts and merged with zero label events. The `#1646` receipt states the same
mechanism independently and names **the same four PR numbers**, adds the missing link
(`everLabeled` false ⇒ `approval-receipt.mjs` returns `PASS / NEVER_ESCALATED` before reading
anything), and records that it was filed on `#1647`, merged 07:33Z.

Two lanes reached one conclusion from opposite directions, which is the strongest form this
pipeline's evidence takes. `#1646` is also the first PR where that gate was actually honoured — the
lane disarmed its own auto-merge and put the question to Marco before merging.

**DISPOSITION: ACTIONED** — as a *collection*, which is this station's job: the finding is closed as
a duplicate of work already on `main` in `#1647`. **Do not re-derive it a sixth time.** What is
still open is only the verification question on `#1635` (can a run tell Marco's receipt from an
agent's?), which F-nothing here touches.

## WHAT I DID NOT DO

- **I did not mutate the board.** The §7 verdict was `CAUTION` with `#1651` touched on GitHub inside
  the 2-minute window, and I then confirmed the cause directly: a PR opened 09:08:23Z with
  auto-merge armed at 09:08:25Z and its review job armed at 09:10:26Z. The contract says re-run the
  sweep immediately before every mutation and obey it; obeying it here means not mutating. No merge
  was available to me in any case — the one open PR belongs to a lane §10.2.1 authorises and is
  already self-merging.
- **I did not arm anything.** See F4 — this is a rule about cluster ownership, not timidity.
- **I did not delete `C：temppr-1648.diff`** even though it is obviously junk. The watcher clone is
  Station 03's, and a second actor tidying another station's tree is how the shared-index collisions
  in LL-38 start. Dispatched instead.
- **I did not clear the dead `needs-marco` escalation.** F3.
- **I did not archive the dispositioned breadcrumbs** from the 0608/0708/0808 runs into
  `docs/pr-prompts/archive/`. Archiving is a `git mv` of tracked files and therefore a board
  mutation; with a second lane active and this run producing a docs-only PR, I kept the diff to the
  one file that carries new information. The queue root is currently 5 breadcrumbs, not the 159 that
  made archiving urgent on 08-30, so the cost of waiting one cadence is nil.
- **I did not measure whether `verdictApproves` has a live caller.** It changes F1's severity and it
  is 06's file to read; guessing at it would have put an unmeasured claim next to a measured one.

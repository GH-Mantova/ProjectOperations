# Station 00 — Supervisor | 2026-09-15T04:08Z–2026-09-15T04:25Z

## GROUND

```
UTC            2026-09-15T04:08:56Z
origin/main    76a28d2b at run start -> 8b2c0189 at 04:21Z   (fetch, then rev-parse; it moved 3x under me)
dev tree       main @ 38262308  C:\ProjectOperations2   (0 ahead, 3 behind at 04:21Z)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE, so this run was not read-only by that rule. It was read-only for a
different reason, given in F3.

All three binding documents were read from the dev-tree working copy only after proving the copy is
not stale, with the sound form and no piped hash (PREFLIGHT step 2):
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` returned EMPTY for all three.

## WHAT I MEASURED

**Transport — SIGHTED.** [MEASURED] Desktop Commander reached the box on the first call after the
keyword `ToolSearch` load: `start_process` shell `powershell.exe`, PID 408, then PID 35380 after the
first shell died on an unrelated write-permission error. This was not a blind run.

**The VM git guard could NOT be installed.** [MEASURED] the Bash tool returned
`failed to mount ... is under Plan9 share "c" which is not mounted`, with the host's own note
*"A Windows update released September 8 prevents Claude's workspace from reaching your files."*
Quoted pass-or-fail as the contract requires: it FAILED, and the run carried on. Nothing can run on
the VM side at all, so the hazard the guard removes cannot occur, and no `git` was run against the
mount by this run. Already filed as
`needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md`; NOT re-raised.

**Collect / freshness.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` →
`CLEAN`, exit 0, `structure: 5 checked, 0 malformed`. No station SILENT:
`00` 1.0h · `03` 5.2h (cadence 24h) · `04` 2.0h (cadence 4h) · `05` 14.0h (cadence 24h).
**There was nothing new to collect.** The newest breadcrumb at run start was
`00-00-supervisor-2026-09-15-0308-...`, my own lane's previous occurrence, and every finding in the
only other recent breadcrumb (`00-04-scanner-2026-09-15-0210-...`) already carries a disposition in
the `...-0240-...` addendum landed as `#1952` / `#1953`.

**Sweep.** [MEASURED] `status-sweep.ps1` captured to a file (it returns early and hides its own
section 7 otherwise), 423 lines, generated `2026-09-15T04:10:50Z`. Section 0 instrument controls both
PASS. Section 5 stale-claim cross-check produced **ZERO `[STALE]` rows** — the eleven dead PR-scoped
escalations discharged on 2026-09-10 have stayed discharged. **Section 7 verdict: `SAFE TO ACT`.**

⚠️ The sweep was **10 minutes stale on its own board section within 20 seconds of printing**: it
listed `#1955` as OPEN at `04:10:50Z`; `gh pr view 1955 --json state` reads `MERGED`, `updatedAt`
`2026-09-15T04:11:10Z`. That is the `[LIVE]`-means-true-when-measured rule firing on the sweep
itself, not a defect in it.

**Machinery.** [MEASURED] `scripts\restart-watcher-if-wedged.ps1` (report-only, the only sanctioned
liveness instrument) at `14:19:50` Brisbane = `04:19:50Z`:
`watcher process ALIVE (pid 13840)` · `restart churn 0 cycle(s) in 20 min` ·
`heartbeat last write 1 min ago` · `queue last moved 47 min ago` · **`VERDICT: HEALTHY - no action.`**
Sweep section 2 agrees: wrapper alive (2), clone `branch=main dirty=0`, guard hook present.

**Queue.** [MEASURED] `armed prompts waiting: 2` from the health check — and **that is not two arms.**
Reading the names: `pr-ratescol-s2-header-menu-edit-ready.md` (the real arm, 03:51:02Z) and
`rev-1958-ready.md` (a REVIEW JOB, written 04:16:12Z). One arm, one review.
`needs-marco/ 56 · no-pr-opened/ 109 · failed/ 52 · blocked/ 135`.

**Receipts.** [MEASURED] over `git ls-tree -r --name-only origin/main -- docs/decisions/merge-approvals/`
= **113 files**, counting `(?m)^pr:\s*\d+` matches in each blob: **14 numbered receipts carry the
block twice** (`1911, 1913, 1917, 1918, 1920, 1923, 1943, 1945, 1946, 1948, 1950, 1954, 1955, 1957`),
plus `README.md`. NEGATIVE control: `README.md` is doubled **by design** — it prints the template
inside a fenced block. POSITIVE control: `1910.md`, the receipt immediately before the run, has
exactly one. See F1.

**The board, live at 04:20Z.** [MEASURED] `gh pr list --state open -R GH-Mantova/ProjectOperations`:

| PR | state | labels | head | note |
|---|---|---|---|---|
| `#1956` | BLOCKED | **`do-not-merge`** | `feat/crmvis-s1-accounts-list` | red by design — see F2 |
| `#1958` | CLEAN | none | `docs/00-collect-2026-09-15-0415` | **another 00 collect, opened 04:14:02Z, inside my window** — see F3 |

Merged since my previous occurrence: `#1957` (04:00Z), `#1954` (03:49Z), `#1950` (03:21Z),
`#1948` (02:57Z), `#1953`, `#1952`, `#1951`, `#1949`, and `#1955` at `04:11:10Z`.

**The arming log.** [MEASURED] `git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt`
→ `1  0` at run start — insertions with ZERO deletions, the append-only strict-superset shape, so
restoring to HEAD would have DELETED an audit row. `Compare-Object` named the one row that existed
on no other machine: `2026-09-15T03:51:02Z ARMED pr-ratescol-s2-header-menu-edit escalates=true
actor=station-00.interactive-0003 pid=19676`. See F4 — it is already published by somebody else.

## WHAT CHANGED

**Nothing. No merge, no arm, no label, no queue mutation, no watcher restart, and — deliberately —
no board PR of my own.** The only artefact of this run is this breadcrumb, written untracked into
the dev tree at `C:\ProjectOperations2\docs\pr-prompts\`. It is named in my chat report so the next
collect sweeps it up. F3 is why I opened no PR.

## FINDINGS

### F1 — FOURTEEN MERGE-APPROVAL RECEIPTS CARRY THEIR YAML FRONT MATTER TWICE, AND CP-26 PASSES ON EVERY ONE

[MEASURED] `docs/decisions/merge-approvals/1955.md` on `origin/main` opens with the same four-line
block twice, separated by a blank line, before its first heading. Thirteen more do: `1911, 1913,
1917, 1918, 1920, 1923, 1943, 1945, 1946, 1948, 1950, 1954, 1957`. The run is **contiguous in time**
— nothing before `1911` is doubled (`1910.md` is the positive control, one block) and the habit has
held for every receipt this shift.

[MEASURED] **it passes, and I checked why rather than assuming.** `scripts/pr-gates/approval-receipt.mjs:57`
parses with `/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/` — **non-greedy**, so it reads the FIRST
block as front matter and everything after it, second block included, as body. `pr`, `approved_by`,
`approved_at` all resolve from block one and `bodyHasContent` is satisfied by the rest. `#1955` and
`#1957` both merged with `Approval receipt (CP-26)` green, which is the live proof.

**So this is cosmetic today and fragile tomorrow.** Three ways it stops being cosmetic: a greedy
parser would swallow the body into the front matter; a parser taking the LAST block would read
fields from a duplicate nobody proof-reads; and a human auditing an approval sees two `approved_by:`
lines and cannot tell whether they are one approval or two. The receipt is this board's only durable
signature for who released a `do-not-merge` PR — `mergedBy` reads `GH-Mantova` for agent and human
alike — so noise in it is not free.

🔧 **The cure is one line at the authoring end:** the supervised interactive lane, which hand-writes
these (there is no receipt-writing script — `Select-String` over `scripts/pipeline/*` and
`scripts/pr-gates/*` for `merge-approvals` returns only readers), emits the block once. A
belt-and-braces second half would be a `RECEIPT_DUPLICATE_FRONT_MATTER` check in
`approval-receipt.mjs`. 🔴 **Do NOT fold that assertion into `pr-gates.mjs`** — CP-26 failing there
already takes `PR gates — diff checks` down with it, one cause and two reds.

⚠️ **The existing fourteen must NOT be rewritten.** They are signed audit artefacts on `main`; a
tidy-up PR that edits them is exactly the shape nobody should normalise.

**DISPOSITION: DEFERRED** — the defect is live but harmless against today's parser, the lane that
authors them is mid-sequence (F3), and a code PR from this lane while it works is the collision F3
describes. **What would make it urgent:** any change to `approval-receipt.mjs`'s front-matter regex,
or a second reader of these files being written. Either one turns a cosmetic duplicate into a
misread approval.

### F2 — `#1956`'s TWO RED CHECKS HAVE ONE CAUSE AND IT IS THE LABEL. IT IS NOT A BROKEN PR.

The sweep reports `#1956` as `13 pass / 2 fail  <-- RED, do not expect a merge`, which reads like
work waiting for me under the ACTIVE DRIVE MANDATE. It is not.

[MEASURED] I read the job logs rather than the PR page (YOUR LIMITS 6), via
`gh api repos/.../actions/jobs/<id>/logs` because `gh run view --log` refuses while the run is still
in progress:

```
job 104250005572  Approval receipt (CP-26)
  FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
         A human must review and REMOVE the label; removing it is what releases the merge.

job 104250005516  PR gates - diff checks
  PASS CP-11 · PASS CP-12 · PASS CP-13 · PASS CP-17 · PASS CP-23 · PASS CP-24 · PASS CP-25
  SKIP CP-09/10 · SKIP CP-22
  FAIL - CP-26 do-not-merge [PR carries the do-not-merge label ...]
```

**Every other gate passes. Both reds are the same CP-26 assertion, appearing in two check runs — the
known coupling.** `#1956` is the `03:06:27Z` arm of `pr-crmvis-s1-accounts-list`, `escalates: true`,
so the watcher labelled it and CP-26 is doing exactly its job. The PR is correctly parked for Marco;
removing that label is his alone and no green makes it mine.

**DISPOSITION: ACTIONED** — no repair was needed and none was made. The action is the record: a
future run reading `2 fail` on `#1956` should not open a defect. The falsifying probe is the two log
lines above; if either job ever fails on a code other than `LABEL_PRESENT`, this note is spent.

### F3 — A SECOND STATION 00 RAN A FULL COLLECT CYCLE *INSIDE* MY WINDOW AND OPENED ITS BOARD PR BEFORE I COULD OPEN MINE

[MEASURED] `#1958` `docs(board): 00 collect 0415 - eight merges, a paused queue, and a timer that
held jest open`, created `2026-09-15T04:14:02Z` — six minutes after my run began — on branch
`docs/00-collect-2026-09-15-0415`. Its diff is the whole of the job I was about to do: its own
breadcrumb, `docs/pr-prompts/.arming-log.txt`, four spent HOLDs retired into
`docs/pr-prompts/superseded/`, and its own receipt. Commit identity `PR Supervisor <supervisor@local>`;
the receipt names `station-00.interactive-0003`, the same actor as all six of today's arms.

[MEASURED] its four findings are disjoint from mine (a prose `STATUS — HOLD` block pausing the
writer; the hex ratchet; a watcher restart losing an in-flight review; an un-`unref()`ed timer), so
neither breadcrumb is a duplicate of the other — but **both are "the 00 collect for this hour", and
only one of them was scheduled.**

🔴 **The operative consequence is that I opened no PR.** Two concurrent `docs/00-collect-*` PRs
against one board is duplicate work at best; at worst the second one to merge fires
`pollForBehindPrs` against the first, and against `#1956`, which is mid-CI. Condition 3 of BOARD
DRIVING is satisfied in the strict sense the sweep measures — `index.lock` False in both trees, 0
scoped git processes, no PR touched in the last 2 min — **and it is plainly false in the sense the
condition exists to protect.** A watcher build was in flight on `pr-ratescol-s2-header-menu-edit`
(heartbeat tick 0.9 min) while a second supervisor was writing to the same queue directory.

⚠️ **This is NOT a new escalation and I did not re-file it.** It is
`needs-marco/two-station-00s-on-one-board-and-the-safe-to-act-gate-reads-safe-between-arms-2026-09-14.md`,
and my own `...-0109-...` and `...-0308-...` breadcrumbs recorded the two previous instances. What
this run adds as fresh evidence is the sharpest form yet: the collision is no longer two actors
*arming* near each other, it is **two actors running the same station's cycle over the same hour**,
and the scheduled one is the one that has to stand down.

**DISPOSITION: ESCALATED** — carried on the existing `needs-marco/` file. The question for Marco is
unchanged and is a RULE 1 question: while he hand-drives through the interactive lane, should the
hourly scheduled `00-supervisor` task be **(a)** left running and contract-bound to stand off
whenever `.arming-log.txt` shows another actor inside the last hour — complete and additive, it
keeps the safety net for the hours he is asleep and costs only a wasted occurrence; **(b)** disabled
while he drives and re-enabled after — complete, but NOT additive: it removes the only unattended
collect, and 2026-09-08 already filed
`station-00-is-disabled-and-nothing-collects-2026-09-08.md` for exactly that outcome; or **(c)**
left as-is, which fails the future half of RULE 1, since every hour he works costs one duplicated
cycle.

### F4 — THE ONE ARM THAT EXISTED ONLY IN THE DEV TREE IS ALREADY PUBLISHED, BY THE LANE THAT MADE IT

The `1  0` superset on `.arming-log.txt` above is the same defect my `...-0308-...` run actioned an
hour earlier: the log is tracked, nothing commits it on purpose, and the gap closes by luck.

[MEASURED] this time it closed without me: `#1958`'s file list contains
`docs/pr-prompts/.arming-log.txt`, so the `03:51:02Z` `pr-ratescol-s2-header-menu-edit` row reaches
`main` when that PR merges. Publishing it a second time from my own PR would have produced a
conflicting write on an append-only audit file, which is the worst possible way to be helpful.

**DISPOSITION: ACTIONED** — verified published by `#1958` rather than duplicated. If `#1958` is
closed unmerged, the row is orphaned again and the next collect must carry it; that is the
falsifying condition.

## WHAT I DID NOT DO

- **Did not open a board PR.** F3. This breadcrumb is untracked in the dev tree and named in the
  chat report for the next collect.
- **Did not arm anything.** One prompt was armed with its build in flight, which ARM ONE AT A TIME
  settles on its own; F3 is the second and stronger reason. `armed=2` was read by NAME first —
  `rev-1958-ready.md` is a review job, not an arm.
- **Did not merge anything, and `#1956` was never a candidate:** it carries `do-not-merge`, and only
  Marco removes that. `#1958` is the other lane's PR, mid-flight.
- **Did not touch the dev tree's ` D` row** on `docs/pr-prompts/pr-ratescol-s2-header-menu-edit-HOLD.md`.
  That is the in-flight arm's own `git mv`, not drift; restoring it would un-arm a live build.
- **Did not restore `.arming-log.txt` to HEAD.** The `1 0` shape means restoring is a deletion of an
  audit row, not a repair.
- **Did not fast-forward the dev tree** (3 behind at 04:21Z). A second actor is writing to it and an
  FF under another lane's uncommitted work is how the append-only row gets lost.
- **Did not restart or touch the watcher.** `VERDICT: HEALTHY`, and a build was in flight; BUSY is
  never a restart.
- **Did not prune the three orphaned worktrees** (`C:/po-fix1891`, `C:/PR-Master/worktrees/po-vg`
  which holds 1 uncommitted file at 15617 min, `C:/PR-Master/worktrees/pr1823`). Station 03's lane,
  already dispatched, nothing newly urgent.
- **Did not re-file** the second-supervisor collision, the VM mount outage, or the `'00': 2` cadence
  constant. All are open with Marco; a duplicate costs a future run a re-discovery and moves none of
  them.
- **Did not read `DOCTRINE.md` cover to cover.** [CANNOT MEASURE → stated, not papered over] I read
  sections 1–8 and 10.1 in full and located section 9's traps by heading rather than reading all
  1,400 of its lines. The three specific section 9 traps this run depended on were read and obeyed:
  the piped-hash trap (9.2), the UTF-16 capture-to-file trap (9.3), and the `-R`-not-CWD `gh` bullet
  (9.4).
- **Did not touch `/sot/`, Azure, Entra, SharePoint, production data, or any label.**

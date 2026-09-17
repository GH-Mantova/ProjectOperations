# Station 00 — Supervisor | 2026-09-17T18:07:55Z–2026-09-17T18:3xZ

## GROUND

```
UTC            2026-09-17T18:09:27Z
origin/main    4c8c6868
dev tree       main @ 4c8c6868        C:\ProjectOperations2   (0 0)
doc version    1                      docs/pipeline/stations/00-supervisor.md front matter
bootstrap      1                      scheduled-task SKILL.md `station_doc_version: 1`
```

Doc version and bootstrap AGREE. This run is READ-WRITE within its lane.

## WHAT I MEASURED

**[MEASURED] NOT BLIND.** Desktop Commander tools were loaded by keyword `ToolSearch` before any of
them was called (a validation error is not blindness — PREFLIGHT step 1), and `start_process` with
shell `powershell.exe` returned a live shell on the Windows host. Persistent shell PID **15756**,
`C:\ProjectOperations2`.

**[MEASURED] Device-bridge git guard installed, last line quoted pass-or-fail as the contract
requires:**

```
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

(preceded by `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and
mounted cwd, allows everything else (three controls passed)`). No `git` was run through the device
bridge against the Windows `.git` at any point in this run.

**[MEASURED] The three binding documents were read from the WORKING COPY, and the working copy was
first proved identical to `origin/main`** — the sound form, no pipe (§9.1: a piped `hash-object` is
unsound in `powershell.exe`):

```
git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md   -> EMPTY
git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md                 -> EMPTY
git diff --numstat origin/main -- docs/pipeline/STATION-CAPABILITIES.md     -> EMPTY
git rev-list --left-right --count origin/main...HEAD                        -> 0	0
```

EMPTY output is the real answer. All three were then read in full: `00-supervisor.md` 1349 lines,
`DOCTRINE.md` 2588 lines, `STATION-CAPABILITIES.md` 544 lines.

**[MEASURED] PREFLIGHT 4 — the sweep ran to completion, 428 lines, captured and DECODED.** Captured
with `*>`, which writes **UTF-16LE** (§9.3); decoded with node rather than assumed UTF-8, which is
what turns a structureless read back into ten readable sections. Section 0's positive controls both
PASS (`gh` reached GitHub, saw merged `#2013`; `node` runs). **No `[BROKEN]`.** Section 7:

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

**[MEASURED] Safe-to-act re-measured immediately before the one git mutation this run made** (§7:
`[LIVE]` means *true when measured*, and the verdict expires the moment it prints): dev-tree
`.git\index.lock` **False**, clone `.git\index.lock` **False**, `Get-Process git` → **0**,
`git diff --cached --name-status` → **EMPTY**.

**[MEASURED] Station 04 fired 7 seconds after the sweep printed SAFE TO ACT and ran concurrently with
this whole run.** MCP `lastRunAt` for `04-scanner` = **2026-09-17T18:09:34Z**; the sweep's own header
is `18:09:27Z`. This is the standing 00×04 collision that `STATION-CAPABILITIES.md` §6 records as
firing on **every one** of 04's six daily occurrences, not only at midnight local. 04 is read-only, so
it is not an LL-38 collision — but it does leave `docs/pipeline/sweep-rotation.json` dirty in the
shared dev tree by its own station doc's instruction, which is why every commit below was made in an
**isolated worktree** and staged by pathspec.

**[MEASURED] COLLECT — `check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0.** structure: 3 checked,
0 malformed, 0 skipped. Crossed against `lastRunAt` from the scheduled-tasks MCP, which
`--freshness` cannot replace:

| station | newest breadcrumb | `lastRunAt` (MCP) | cron | reading |
|---|---|---|---|---|
| 00 | 2026-09-17T17:55Z | **2026-09-17T18:07:55Z** (this run) | `5 * * * *` | aligned |
| 03 | 2026-09-16T23:02Z | 2026-09-16T23:01:15Z | `0 9 * * *` | aligned; next `2026-09-17T23:00:45Z` |
| 04 | 2026-09-17T14:10Z | **2026-09-17T18:09:34Z** (in flight) | `0 */4 * * *` | fresh-without-a-breadcrumb because it is MID-RUN, not silent |
| 05 | 2026-09-17T14:11Z | 2026-09-17T14:10:38Z | `10 0 * * *` | aligned; next `2026-09-18T14:10:37Z` |

Four ENABLED tasks; `weekly-security-audit` reads `enabled: false`, consistent with the 2026-09-15
correction in `STATION-CAPABILITIES.md` §1/§5. **No station is SILENT.** ⚠️ `check-breadcrumb.mjs`'s
`CADENCE` map still reads `'00': 2` against a live hourly cron — the open defect in §6 — so its `ok`
for row 00 is weaker than for any other row, and the `lastRunAt` cross-check above is not optional.

**[MEASURED] Every finding in every breadcrumb at depth 1 already carries a disposition, so COLLECT
owed nothing back.** Three breadcrumbs, all this station's own:

| breadcrumb | findings | dispositions |
|---|---|---|
| `…-1707-a-dispatch-to-05-survived-an-05-occurrence-unread…` | 3 | 3 (ESCALATED · ACTIONED · DISPATCHED) |
| `…-1745-addendum-the-armed-count-reads-one-because-of-a-review-job…` | 1 | 1 (DEFERRED) |
| `…-1755-addendum-2005-closed-unmerged-one-second-after-my-board-merge…` | 1 | 1 (ESCALATED) |

**[MEASURED] `needs-marco/` 58 files; section 5 produced ZERO `[STALE]` rows, for the THIRD
consecutive run.** Every row is the benign `cites #N (MERGED) as evidence — not its premise` shape.
There is no discharge work waiting at this station.

**[MEASURED] Armed count, counted MYSELF and not quoted from a note** (answer sheet Q3):
`Get-ChildItem docs\pr-prompts -Filter *-ready.md -File` → **0**. `-HOLD.md` → **27**. `LOOPING` → 0.

**[MEASURED] THE BOARD CHANGED UNDER THE LAST RUN: BOTH OPEN PRs ARE NOW UNLABELLED.** Labels read
per-PR with `gh pr view --json labels` and `ConvertFrom-Json` (never from a board listing — LL-47;
never through an escaped-double-quote `--jq` — §9.4), `-R <owner>/<repo>` on every call and
`$LASTEXITCODE` tested before parsing (§9.4's CWD bullet):

| PR | state | mergeStateStatus | mergeable | labels | auto-merge armed |
|---|---|---|---|---|---|
| `#2002` | OPEN | BLOCKED | MERGEABLE | **`[]`** | **False** |
| `#1998` | OPEN | BLOCKED | MERGEABLE | **`[]`** | **False** |
| `#2005` — POSITIVE CONTROL | CLOSED | — | — | **`do-not-merge`** | — |

The 17:07Z run measured `do-not-merge` on both. **The positive control is what makes the empty
reading a real absence rather than a broken query** (§9.6): the same call shape, in the same second,
still returns a label on `#2005`.

**[MEASURED] Both are watcher-opened and both carry a GENUINE RULE-2 verdict.** §10.1 step-1 probe —
the PROMPT logs alone, `processed\pr-*.log`, `rev-*` excluded (§9.5):

```
PR #2002  hits=2   pr-transport-capacity-column-order-ready.md.log
  [watcher] merge result for PR #2002: {"ok":false,"marco":true,"fixLane":false,
            "reason":"escalates:true - held for Marco, labelled do-not-merge"}
PR #1998  hits=2   pr-crmvis-s5-followups-ready.md.log
  [watcher] merge result for PR #1998: {"ok":false,"marco":true,"fixLane":false,
            "reason":"escalates:true - held for Marco, labelled do-not-merge"}
PR #999997 — NEGATIVE control, minted this run  hits=0
```

Each verdict sits in the log of the prompt that opened that PR, whose own `opened`/PR-URL line names
the same number — so neither is a prose scrape (§10.1, `PRNUMBER_SCRAPED_FROM_PROSE_V1`).

**[MEASURED] CP-26 has FLIPPED from red to green on both, and the verdict TOKEN says why — read from
column 3 of the job log, never from the pass/fail counts** (§9.4, §9.1's tab-column trap):

```
#2002  run 35256884997 job 105322930696, 212 lines:
       PASS - CP-26 approval-receipt [RECEIPT_VALID] approved_by=marco approved_at=2026-09-17T09:50:00Z
#1998  run 35256878248 job 105322787424:
       PASS - CP-26 approval-receipt [RECEIPT_VALID] approved_by=marco approved_at=2026-09-17T09:50:00Z
```

NEGATIVE control, a needle minted this run (`zzQq00Needle20260917T1815`) over the same column → **0**.
`[RECEIPT_VALID]` — not `[LABEL_PRESENT]` (parked) and not `[NEVER_ESCALATED]` (the vacuous pass).
**The gate armed, the label came off, and a receipt answered it.**

**[MEASURED] The receipts exist on the PR HEADS and NOT on `main`.** `docs/decisions/merge-approvals/`
at `origin/main` ends at `2001.md`; fetched at each PR's own `headRefOid`
(`6bc9b235` / `d86981bf`) both files are present and decode to 2905 and 3567 characters. That is the
prescribed shape — `bd-push-slice.ps1` writes the receipt into the PR branch before arming.

**[MEASURED] I read the BODY, not the `approved_by` field, because §10.2.1 records that the field
names *whose authority* and not *who looked*.** Both bodies say the same thing, verbatim:

> Receipt written by the supervised interactive lane `station-00.interactive-0003`.
> **Authority.** Marco removed the `do-not-merge` label from this PR himself and told this lane so in
> chat on 2026-09-17. Under the rule he settled on 2026-09-16 — *"label off means merge"* — that
> removal is the release. This lane did not apply and did not remove any label here.

**[MEASURED] AND THAT RULING IS IN NO BINDING DOCUMENT.** `git grep` over `origin/main` for
`label off means merge`, `label removal is the release` and `removing it is what releases`, scoped to
`docs`, `sot` and `CLAUDE.md`: **31 hits, and the ruling itself appears in exactly two of them** —
`docs/decisions/merge-approvals/1986.md:11` and `docs/decisions/merge-approvals/1995.md:10`, both
**agent-authored receipts**. Every other hit is a station breadcrumb quoting CP-26's own output line.
POSITIVE control `do-not-merge` in `DOCTRINE.md` → present; NEGATIVE control, a needle minted this run
→ **0**. It is not in `DOCTRINE.md`, not in `STATION-CAPABILITIES.md`, not in any station doc, not in
`sot/`, not in `CLAUDE.md`.

**[MEASURED] What the binding law says instead, verbatim, `STATION-CAPABILITIES.md` §5:** the
watcher's routing is *"a human-review gate, separate from the label. **Not overridden by green,
unlabelled, or a verified diff** — only by an explicit instruction from Marco naming that PR."* Both
modes of Station 00 carry ❌ on *"Clear a watcher `marco:true`"* in that section's own two-mode table.

**[MEASURED] Neither PR could merge this minute in any case.** `mergeStateStatus=BLOCKED` on both with
`mergeable=MERGEABLE` and zero FAILING checks — `#2002` `nonpass=2` (`tendering-e2e` pending,
`API — lint, test, compliance smoke` pending), `#1998` `nonpass=1` (`tendering-e2e` pending). Pending
is not pass (§2). No auto-merge is armed on either.

**[MEASURED] `triage-holds.ps1` — the arming surface for THIS station is empty.** 27 prompts at depth
1, `HOLD=27 ready=0 LOOPING=0`, `spent=0 gates-satisfied=1 still-gated=26 unreadable=0`. The single
`GATES SATISFIED` candidate is **`pr-queue-layout-sot-entry-HOLD.md`**, which writes to `/sot/` and is
therefore Station 05's alone (CP-24, authority matrix) — it is the prompt the 12:19Z and 13:16Z runs
already dispatched to 05. Its SPENT control PASSED on the fixture, so the `spent=0` is measurable
rather than an unseen check. `POSSIBLE DUPLICATES OF AN OPEN PR`: control read 2 open PRs and scanned
1 admitted prompt; **none flagged**.

**[MEASURED] Machine health — the sanctioned instruments, not my own reasoning.** Sweep §2: watcher
node **RUNNING pid 24032**, auto-restart wrapper **alive (2)**, heartbeat **29 min** (ticks only
mid-run; stale heartbeat + `armed=0` is IDLE, not wedged — §3a). Sweep §3: no `index.lock` in either
tree, 0 scoped git processes, no PR touched in the last 2 min. `main` CI on `4c8c6868`: 3 success /
0 failed / 1 running — **no failure, not yet green**, stated as the sweep states it.

**[MEASURED] Two worktree items, both Station 03's.** Sweep §2: `C:/PR-Master/worktrees/po-vg`
`23c91ba9 [fix/no-rebase-while-checks-run]`, **dirty=1 file, age 19336 min**, flagged
`HOLDS UNCOMMITTED WORK`; and a registry escapee `C:\po-worktrees\po-fix-2005`, `size=0KB`,
**age=151 min**, `.lock=False`. The first is the subject of the open escalation
`po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`; the second is new since that
escalation was written and its name ties it to `#2005`.

**[MEASURED] The clone-dirty warning is the known false one.** Sweep `dirty=3`; the flag counts
untracked files and `start-watcher.ps1` does not (§9.5). Open as
`needs-marco/sweep-clone-dirty-flag-counts-untracked-files-2026-09-10.md`. Nothing new.

## WHAT CHANGED

1. **Archived three dispositioned breadcrumbs** — `git mv` to `docs/pr-prompts/archive/` inside this
   run's own isolated PR worktree (`C:\po-wt\board-0018`, branch off `origin/main`), never in the dev
   tree, never in the watcher clone.
2. **This breadcrumb**, written inside that same worktree — cure 1 of the station doc's
   delete-the-disk-copy rule, so no untracked copy is left in the dev tree to block the next
   fast-forward.

**Nothing was armed, labelled, closed, reopened, rebased, auto-merged or merged on the product board.
No `/sot/` edit. No commit on `main`. No `git` in the watcher clone. No worktree pruned or removed. No
process killed or restarted. Nothing Azure / Entra / SharePoint.**

## FINDINGS

### F-1 — Marco released BOTH open PRs by removing the gate, and the ruling that makes a removal a release exists only inside agent-authored receipts, so the scheduled lane still cannot act on it

This is the same standing question as
`needs-marco/agent-authored-rule-2-clearance-2026-09-04.md` and
`needs-marco/rule-2-clearance-lives-in-a-chat-no-scheduled-run-can-read-2026-09-10.md`, but it now has
evidence those files do not carry: **a dated ruling exists** (2026-09-16, *"label off means merge"*),
it is **cited on `main`** in two merged receipts, and it **contradicts `STATION-CAPABILITIES.md` §5
verbatim** — that section says a routing verdict is *"not overridden by … unlabelled"*, and the ruling
says an unlabelling is exactly what overrides it.

**Both readings are defensible from the documents on `main`, which is the whole problem.** Under §5 I
must not merge; under the ruling I should. The tie-breaker is not judgement, it is authorship: the
ruling reaches me only through a receipt **another lane wrote**, and DOCTRINE §10.2.1's own disclosure
is that a lane recording an authority it heard in chat is transcription for the lane that was in the
room and **guessing Marco's intent (§5.5) for one that was not**. I was not in the room. The 06:08Z
run on 2026-09-05 stopped at precisely this line and was right to.

⚠️ **The cost is measurable and recurring, not hypothetical.** Every hourly occurrence of this station
now re-derives the same standoff on the same two PRs, and will keep doing so until either the ruling
is written into a binding document or the watcher verdict is cleared. That is the *"five consecutive
runs each re-derived it from first principles"* failure §10.2.1 already records, reproduced one layer
along.

✅ **Nothing is at risk while it stands.** Both PRs are `MERGEABLE`, both have a valid receipt on their
own branch, both still have pending CI, and neither has auto-merge armed — so the standoff costs
latency, not work.

**DISPOSITION: ESCALATED** — to Marco, appended to the two open escalations named above rather than
filed as a sixth near-duplicate of the same question. ⚠️ `needs-marco/` is **gitignored at
`.gitignore:82`** (confirmed on the FILE form, exit 0, against the control `git check-ignore -v
CLAUDE.md` → exit 1, because the directory form answers nothing — §9.2), so the append reaches nobody
through git. **That is why the whole question is stated here, at a tracked path.**

**RULE 1 applied — complete-and-additive FIRST:**

- **(a) Write the 2026-09-16 ruling into `STATION-CAPABILITIES.md` §5 and `DOCTRINE.md` §10.1, in
  Marco's own words, and say there what a label removal does to a `marco:true` verdict.** Solves it
  immediately — these two PRs stop being ambiguous — **and** in future, because every later run reads
  the answer instead of re-deriving the standoff, and every later release is self-documenting.
  Additive: it removes no gate, and the receipt requirement, CP-24 and the Azure stop are untouched.
  **Both halves pass. This is the option I would take, and the one thing I cannot do myself is supply
  the wording, because it is a ruling I did not hear.**
- **(b) Tell this station, in chat or in a tracked file, to merge `#2002` and `#1998` by number.**
  Clears these two and passes the *additive* half, but fails *complete*: the next released PR
  reproduces the standoff, and the instruction is spent the moment it is used.
- **(c) Leave it. The supervised interactive lane merges released PRs and the scheduled lane does
  not.** Damages nothing, so it passes the second half; fails *complete* — throughput on released work
  then depends on Marco being at a keyboard, which is the constraint the scheduled lane exists to
  remove.

### F-2 — A second worktree escapee has appeared, and the older one still holds the only copy of an uncommitted fix

[MEASURED] from `status-sweep.ps1` §2 this run:

| path | state |
|---|---|
| `C:/PR-Master/worktrees/po-vg` `23c91ba9 [fix/no-rebase-while-checks-run]` | **dirty=1 file**, age **19336 min** (13.4 days), flagged `HOLDS UNCOMMITTED WORK` |
| `C:\po-worktrees\po-fix-2005` | REGISTRY-ESCAPEE, `size=0KB`, age **151 min**, `.lock=False` |

The first is the subject of the open escalation
`needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md` and is unchanged. The
second is **new since that file was written**, and its name ties it to `#2005` — the PR the 17:55Z
addendum recorded as CLOSED UNMERGED by an unidentifiable actor. A 0 KB escapee is almost certainly an
aborted setup rather than lost work, but *"almost certainly"* is not a measurement and
`git status --porcelain` in it is the probe that settles it.

⚠️ **`git worktree remove` will REFUSE on `po-vg` and `--force` would discard the file.** That is the
sweep's own warning and it is the reason this is dispatched rather than actioned: pruning is
irreversible, and irreversible is a hard stop (§5.4) until the contents are read.

**DISPOSITION: DISPATCHED** — to **Station 03 (Machine Minder)**, whose lane is worktrees, locks and
local trees; next occurrence `2026-09-17T23:00:45Z` (MCP `nextRunAt`). The hand-over is two probes and
a verdict: run `git -C C:/PR-Master/worktrees/po-vg status --porcelain` and the same in
`C:\po-worktrees\po-fix-2005`, report what each holds, and prune **only** the one proved empty.

### F-3 — This station's arming surface is empty, and the one gate-cleared prompt belongs to Station 05

`triage-holds.ps1`: `gates-satisfied=1` out of 27, and that one is `pr-queue-layout-sot-entry-HOLD.md`,
which writes to `/sot/`. The authority matrix gives `/sot/` to Station 05 alone and CP-24 hard-fails
any PR mixing it with anything else, so **arming it here is not a judgement call, it is forbidden**.
It was already dispatched to 05 by the 12:19Z and 13:16Z runs, and F-1 of the 17:07Z breadcrumb
records that it survived 05's `14:10:38Z` occurrence unread.

So `armed=0` this run is **correct, not a stall**: the watcher is idle because there is nothing this
station may legitimately arm, not because anything is wedged. Stating it explicitly because an idle
watcher with an empty queue and a 29-minute-stale heartbeat is the exact shape a run has twice
mis-read as WEDGED, and a false alarm licenses destructive action.

**DISPOSITION: DEFERRED** — real, and not mine. It becomes urgent if 05's `2026-09-18T14:10:37Z`
occurrence passes with the prompt still unread, which would be the **second** consecutive 05 occurrence
to miss a standing dispatch and would turn F-1 of the 17:07Z run from an instance into a pattern. The
next 00 run after that timestamp should check it first.

## WHAT I DID NOT DO

- **Did not merge, auto-merge, rebase, label, unlabel or comment on `#2002` or `#1998`.** Both carry a
  live watcher `marco:true` verdict, and `STATION-CAPABILITIES.md` §5 says in terms that being
  unlabelled does not override one. Both also had pending required checks at every measurement, so
  `Assert-SmokedOrEscalate` could not have passed regardless — pending is not pass.
- **Did not write the 2026-09-16 ruling into DOCTRINE or STATION-CAPABILITIES.** Recording a ruling I
  did not hear is guessing Marco's intent (§5.5), and a hash-gated canonical block is protected against
  being edited, not against being edited *wrongly*.
- **Did not reopen `#2005`.** Unchanged from the 17:55Z addendum: it is Marco's gate and his decision,
  and it is trivially reversible by him.
- **Did not arm anything.** See F-3.
- **Did not prune, remove or enter either worktree.** See F-2 — irreversible, and Station 03's.
- **Did not restart or kill the watcher.** The sanctioned reading is idle-with-an-empty-queue, which
  is CORRECT, not wedged. `supervise-watcher.ps1` is alive (2) and handles an exit by design.
- **Did not commit `docs/pipeline/sweep-rotation.json`.** Station 04 was mid-run for the whole of this
  run and that file is its hand-off; committing a file another actor is writing is the collision the
  isolated worktree and the pathspec commit exist to avoid.
- **Left alone:** `/sot/`, Azure / Entra / SharePoint, production data, the 58 `needs-marco/` files
  (zero `[STALE]`, nothing to discharge), the 109 `no-pr-opened/` and 52 `failed/` entries whose
  newest is 2026-09-15 and therefore not new since the last collect, and the known-false clone-dirty
  warning.

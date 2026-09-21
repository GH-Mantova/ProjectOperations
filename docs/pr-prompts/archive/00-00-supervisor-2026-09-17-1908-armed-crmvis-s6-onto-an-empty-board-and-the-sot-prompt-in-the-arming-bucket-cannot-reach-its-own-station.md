# Station 00 — Supervisor | 2026-09-17T19:08Z–19:35Z

## GROUND

```
UTC            2026-09-17T19:08:53Z
origin/main    895bdefc               (#2002 merged 18:57:07Z)
dev tree       main @ 895bdefc        C:\ProjectOperations2   (0 ahead, 0 behind)
doc version    1                      docs/pipeline/stations/00-supervisor.md front matter
bootstrap      1                      scheduled-task SKILL.md `station_doc_version: 1`
```

Doc version and bootstrap AGREE — this run had full authority.

## WHAT I MEASURED

**[MEASURED] Reachable, and the guard installed.** `start_process` shell `powershell.exe` returned
`main` / `895bdefc` on the first call. `vm-git-guard.sh` last line, quoted as the contract requires:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`.

**[MEASURED] The three binding documents are byte-identical to `origin/main`, so reading them from
disk was sound.** `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, run in the DEV TREE
after an explicit `git fetch origin +refs/heads/main:refs/remotes/origin/main`. No piped hash was
taken (PREFLIGHT step 2).

**[MEASURED] Sweep verdict `SAFE TO ACT`**, re-derived immediately before the arm rather than quoted
from the 19:09Z capture: `index.lock interactive/clone: False / False`, `git processes touching our
trees (scoped): 0`, `no PR touched on GitHub in the last 2 min`, `armed (*-ready.md): 0`.

**[MEASURED] COLLECT — nothing new, and the freshness table is CLEAN.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `structure: 4 checked, 0
malformed`, `CLEAN`; `00` 0.5h (cadence 2h) · `03` 20.2h (24h) · `04` 1.0h (4h) · `05` 5.0h (24h),
all `ok`. Crossed against `lastRunAt` from the scheduled-tasks MCP, which the contract requires
because the breadcrumb is one instrument and cannot name a cause:

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| `00-supervisor` | `2026-09-17T19:07:56Z` | this run | aligned |
| `03-machine-minder` | `2026-09-16T23:01:15Z` | 09-16 23:02 | aligned; `nextRunAt 2026-09-17T23:00:45Z` |
| `04-scanner` | `2026-09-17T18:09:34Z` | 09-17 18:11 | aligned |
| `05-sot-keeper` | `2026-09-17T14:10:38Z` | 09-17 14:11 | aligned |

**No station is SILENT and none is fresh-without-a-breadcrumb**, so neither of the two failure rows
the contract's table names is live. `weekly-security-audit` remains `enabled: false`
(`lastRunAt 2026-09-06T21:32:44Z`) — unchanged, already filed.

**[MEASURED] `#2002` merged at 18:57:07Z while carrying a live watcher `marco:true` verdict, and the
release signal was on its head the whole time.** The RULE-2 probe, run against the live dev tree and
never the clone, over the PROMPT logs only (`processed\pr-*.log`, `rev-*` excluded):

```
pr-transport-capacity-column-order-ready.md.log:
[watcher] merge result for PR #2002: {"ok":false,"marco":true,"fixLane":false,
  "reason":"escalates:true - held for Marco, labelled do-not-merge"}
```

POSITIVE control `PR #1998` → **2** hits; NEGATIVE control `PR #999412` → **0**. That verdict is a
genuine policy routing, not the byte-identical timeout string DOCTRINE §10.3 records — its `reason`
names the label. `gh pr view 2002 --json state,mergedAt,mergedBy,labels` → `MERGED`,
`2026-09-17T18:57:07Z`, `mergedBy GH-Mantova`, `labels []`.

**[MEASURED] The receipt exists on `main` and names its lane.** `git show
origin/main:docs/decisions/merge-approvals/2002.md` → front matter `approved_by: marco`,
`approved_at: 2026-09-17T09:50:00Z`, body *"Receipt written by the supervised interactive lane
`station-00.interactive-0003`… Marco removed the `do-not-merge` label from this PR himself and told
this lane so in chat… that removal is the release."*

**[MEASURED] The watcher does NOT read `station:` front matter.** `git show
origin/main:scripts/pr-watcher/index.mjs | Select-String 'station'` → **3** hits, and all three are
prose: `L229` a comment about worktree stations, `L2650` a comment about Station 00's cadence,
`L3371` a string in an untracked-prompts warning. POSITIVE control `classifyPolicyFiles` → **2**, so
the query does find real symbols in that file.

**[MEASURED] The clone is clean, and the sweep's `dirty=1` is the §9.5 false warning.**
`git -C C:\po-watcher\ProjectOperations status --porcelain --untracked-files=no` → **EMPTY**;
`git status --short` → **1**, `?? scripts/pr-watcher/.conflict-notified-prs.json`. That is the
untracked-inclusive count the sweep reports against a condition `start-watcher.ps1` explicitly
ignores. **Not dispatched to 03** — archived runs have already mis-routed this line repeatedly.

**[MEASURED] Trunk on `895bdefc` at 19:30Z: no failure, not yet green.** Per-commit with the full
40-char SHA (§9.4): `CI` **success**, `Deploy` **success**, `Tendering Browser Smoke`
**in_progress**, `CodeQL` **in_progress**. Zero `failure` conclusions, and no `Dependabot Updates`
run is attributed to this head, so the §9.5 trunk-verdict trap is not in play here.

**[MEASURED] Queue census.** `triage-holds.ps1`, read-only, with both its own controls passing
(`GIT control: PASS`, `SPENT control: PASS`): `spent=0 of 27 evaluated, gates-satisfied=2,
still-gated=25, unreadable=0`. Board: **0 open PRs**, **0 armed**, **27 `-HOLD.md`**.

## WHAT CHANGED

1. **ARMED `pr-crmvis-s6-bulk-link`** via `arm-prompt.ps1 -Actor station-00.sched-1908`, exit **0**.
   Read back three ways: `pr-crmvis-s6-bulk-link-ready.md` → **1**, `…-HOLD.md` → **0**, and the
   arming log's new row `2026-09-17T19:19:51Z ARMED pr-crmvis-s6-bulk-link escalates=true
   actor=station-00.sched-1908 pid=9596`. The script's own guards ran: exclusive lock, index clean
   before and after, RULE 4 (nothing else armed), and it released the staged rename.
2. **Committed `docs/pr-prompts/.arming-log.txt`** in this PR, as DOCTRINE §9.5 requires of any run
   that arms. `git diff --numstat origin/main -- <log>` read **`1  0`** — insertions with zero
   deletions, i.e. the working copy is a strict superset of `main` by exactly my one row, which is
   the shape on which restoring to HEAD would be a deletion rather than a repair. Copied byte-exact
   into the worktree with node (**21,913 bytes**), never `>` or `Set-Content`.
3. **Archived four dispositioned breadcrumbs** to `docs/pr-prompts/archive/` — the three 00 reports
   of 18:07 / 18:25 / 18:43 and 04's 18:11. All four are tracked on `main` (landed by #2015), which
   is the precondition my own 18:43Z run named when it deferred this to "the next run". Asked of the
   TRACKED SET rather than the dev tree, so the 2026-09-07 duplicated-basename defect is not
   reachable here.
4. **Wrote this breadcrumb inside the PR worktree**, which is cure 1 of the station doc's
   fast-forward section: no loose untracked copy is left in the dev tree, so the post-merge
   `--ff-only` cannot be blocked by it.

No merge. No label change. No `/sot/` edit. No commit on `main`. No `git` in the watcher clone. No
`git` through the device bridge against the Windows `.git`. Nothing Azure / Entra / SharePoint.

## FINDINGS

### F-1 — The board was EMPTY with 27 held prompts, and that was the whole finding

`0 open PRs` and `0 armed` at 19:09Z is not health; on a board whose throughput constraint is
arming, it is an idle machine. `pr-crmvis-s6-bulk-link` cleared every gate: lint **PROMOTE** with
`GATE_RELEASED requires_on_main: "apps/web/src/pages/crm/TendersRegisterPage.tsx ::
CRM_PARITY_FOLLOWUPS_V1" is now on origin/main`, verified LIVE and not from the linter alone —
`CRM_PARITY_FOLLOWUPS_V1` on `origin/main` → **9** hits, freshly minted NEGATIVE control → **0**.
Its premise is still TRUE on `main`: `CRM_PARITY_BULKLINK_V1` → **0**, so the work has not shipped.
Body read before arming, as ADMIT-is-not-sufficient requires: STANDING AUTHORITY present, no prose
human gate, `gate_allow: none`, `seed_only: false`, scope three files under `apps/web/**`, and it
is on none of the never-arm lists. The duplicate cross-check is vacuous by construction here —
`triage-holds.ps1` reports `0 open PR(s) read from the board`, so there is nothing to be a duplicate
of, and over merged work the premise is the discriminator (§10.6), which lint already ran.
**DISPOSITION: ACTIONED** — armed, read back three ways, arming log landed in this PR.

### F-2 — A prompt sits in the arming-candidate bucket that arming can never route correctly

`pr-queue-layout-sot-entry-HOLD.md` is the other `gates-satisfied` ADMIT. Its `scope:` is
`sot/02-roadmap-and-status.md`, its front matter says `station: '05'`, and its body says in as many
words *"Station 05 only… Station 00 did not and will not edit `sot/` — the wording is settled here
and 05 executes it."*

**Arming it would not send it to 05.** Measured above: `index.mjs` reads no `station:` key, so an
armed prompt is built by the watcher's code-writer lane whatever that field says. The result would
be Station 01 editing `sot/`, against the source-of-truth law and against the authority matrix's
`Edit /sot/ — ✅ only 05` row. CP-24 would not catch it either: that gate blocks a PR **mixing**
`sot/` with code, and this diff is `sot/`-only, so it would pass on its own clause.

It is also not reachable the other way: **05 wakes on a clock and reads breadcrumbs — it does not
read the queue.** So a prompt addressed to 05 and filed as a queue prompt has no correct consumer
at all; the only channel that reaches 05 is a dispatch in a breadcrumb, which is this.

⚠️ The generalisable half: `triage-holds.ps1`'s `GATES SATISFIED` bucket is the list an arming
decision goes looking at, and it has no notion of which lane a prompt is addressed to. Today that is
one prompt; the bucket cannot tell the next reader either.

**DISPOSITION: DISPATCHED → Station 05.** The prompt is complete, its gate is released
(`QUEUE_LAYOUT_V1` is on `main` via #1999), and its `done_when` is executable. 05 should execute it
as a doc-reconcile PR on its next occurrence (`nextRunAt 2026-09-18T14:10:37Z`) rather than have it
armed. **I left it as `-HOLD.md` deliberately** — it is not gated on anything outstanding, so its
HOLD state is now carrying "wrong lane" rather than "waiting on a predecessor", and that is worth
saying rather than leaving for the next run to re-derive.

### F-3 — `#2002` merged carrying a live `marco:true`, and the previous run had the release in hand

My own 18:43Z run wrote *"Did not merge #2002. Unchanged from F-1 and F-4: live `marco:true`,
unlabelled, and no instruction naming it."* Fourteen minutes later it merged.

The measurements above settle what happened, and the answer is not an unknown actor: Marco removed
the label at **09:50Z**, the supervised interactive lane `station-00.interactive-0003` wrote the
receipt, and the merge is that lane's. The same 18:43Z run had already **measured the receipt on the
PR's head** — it recorded CP-26 reading `PASS … [RECEIPT_VALID] approved_by=marco
approved_at=2026-09-17T09:50:00Z` — and then declined on the ground that no instruction named the
PR. **The receipt was the instruction.** A `[RECEIPT_VALID]` CP-26 naming `approved_by=marco` on the
head is precisely the durable signature that
`needs-marco/label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md` says does not
exist, and one existed and was read.

⚠️ Two cautions against over-correcting this, both already on file and both load-bearing:
`approved_by: marco` records **whose authority, not who looked** (a scheduled run has already filed
a forgery accusation off that field and retracted it), and a real watcher `marco:true` still binds a
**station** absolutely — §10.1 step 1 runs first and wins. What is wrong is narrower: a scheduled
run that has re-measured a `[RECEIPT_VALID]` receipt on the head should record that the PR is
**released and the merge belongs to the lane that signed it**, rather than reporting an
unattributable merge the next run has to re-derive. Three consecutive breadcrumbs (#2013, #2014,
this one) have now spent measurements on the same question.

**DISPOSITION: ACTIONED** — measured, attributed, and the standing escalation updated by this
record rather than by a fifth near-duplicate file. The open product question in that escalation
(should a removal leave a machine-readable signature of its own?) is untouched and still Marco's.

### F-4 — Two worktree defects, unchanged since the last sweep, and neither is mine

`[LIVE]` from the sweep, both re-read this run:

- `C:/PR-Master/worktrees/po-vg` — `23c91ba9 [fix/no-rebase-while-checks-run]`, **dirty=1 file**,
  **age 19,395 min (13.5 days)**. It **holds uncommitted work**; `git worktree remove` will refuse
  and `--force` would discard it. There is an existing escalation naming this tree
  (`needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`).
- `C:\po-worktrees\po-fix-2005` — REGISTRY-ESCAPEE, `size=0KB`, `age=210min`, `.lock=False`.

**DISPOSITION: DISPATCHED → Station 03** (`nextRunAt 2026-09-17T23:00:45Z`). Machines, locks and
worktrees are 03's; the station doc's `git status --short` in each before suggesting deletion is the
right first step, and **neither may be pruned on the sweep's tag alone**. I did not touch either:
pruning a tree holding the only copy of an unpushed fix is irreversible, and the 0 KB escapee is
three and a half hours old, which is inside the window where a live run could still own it.

### F-5 — The trunk read-back is open at the end of this run

`CI` and `Deploy` are green on `895bdefc`; `Tendering Browser Smoke` and `CodeQL` were still
`in_progress` at 19:30Z, 33 minutes after the merge. Zero failures so far.
**DISPOSITION: DEFERRED** — real, not now. It becomes urgent if either finishes `failure`, because
`main` red is what blocks the slice just armed from going green. The next occurrence should re-ask
`gh run list --commit 895bdefcf7a7a05533ecc3d354f5a29bff2acb27` with the full SHA before anything
else, and must not read a `Dependabot Updates` row into that verdict.

## WHAT I DID NOT DO

- **Did not arm a second prompt.** ARM ONE AT A TIME; `pr-crmvis-s6-bulk-link` is the only one in
  flight and the watcher has not started it yet.
- **Did not arm `pr-queue-layout-sot-entry`** — F-2. Dispatched to 05 instead.
- **Did not touch any of the 25 still-gated HOLDs.** Their rejects are `HUMAN_GATE_PRESENT` (13),
  `GATE_NOT_RELEASED` (5), `FILE_GATE_NOT_RELEASED` (4) and `UI_PROMPT_NEEDS_DESIGN_REF` (2), and a
  `HUMAN_GATE_PRESENT` reject is Marco's marker, not a defect. In particular the four `scopecards`
  HOLDs stay exactly as 04 and my 18:43Z run left them: their chain head `#2005` closed UNMERGED and
  the question is escalated, so repairing a gate here would arm a chain whose predecessor is absent
  from `main`.
- **Did not dispatch the clone `dirty=1` line to Station 03.** Measured clean with
  `--untracked-files=no`; dispatching it is the recurring mis-route DOCTRINE §9.5 records.
- **Did not discharge any `needs-marco/` file.** The sweep's section 5 produced **no `[STALE]` rows
  this run** — every row is `[FILE]` "cites #N as evidence, not its premise", which explicitly does
  **not** clear an escalation. The two rows naming a CLOSED-UNMERGED PR (`#1612`, `#2005`) are
  premises, not staleness. 59 files remain; clearing them on a `[FILE]` line alone is the error that
  section warns against.
- **Did not commit the armed prompt's `-HOLD.md` deletion.** Arming files are never swept; the
  rename lands with the build PR.
- **Did not restart, kill or touch the watcher.** Its inputs read healthy-and-idle: node RUNNING pid
  24032, wrapper alive (2), heartbeat 28 min with an **empty queue**, which is idle and explicitly
  NOT wedged. The heartbeat ticks only mid-run.
- **Did not merge anything.** The board was empty when I arrived and the only PR this run creates is
  its own.

---

## ADDENDUM — 2026-09-17T19:40Z, same run, later measurement

Three claims in the report above were true when written and are now superseded by their own
outcomes. Recorded here rather than left for the next occurrence, because a claim that outlives its
SHA is how a finished thread gets re-derived.

### The arm completed the whole chain inside this run — `#2017` is open

WHAT I DID NOT DO said *"the watcher has not started it yet."* It had, one second later. [MEASURED]
from the live daily clone log, found by name shape then mtime and copied before reading
(`2026-09-18.log`, mtime `2026-09-17T19:36:11Z` — the name is host-local and leads UTC, per §9.5):

```
[2026-09-17T19:19:52.223Z] [queue] pr-crmvis-s6-bulk-link-ready.md (depth: 1, source: watch)
[2026-09-17T19:19:53.890Z] [deps] pr-crmvis-s6-bulk-link-ready.md: all dependencies met (merged: [], files: 0, on-main: 1)
[2026-09-17T19:19:53.890Z] [start] pr-crmvis-s6-bulk-link-ready.md (max-turns=240)
[2026-09-17T19:33:19.919Z] [merge] pr-crmvis-s6-bulk-link-ready.md: opened PR #2017, policy=tests-docs, waiting.
[2026-09-17T19:33:27.357Z] [merge] pr-crmvis-s6-bulk-link-ready.md: PR #2017 stays for Marco (escalates:true - held for Marco, labelled do-not-merge)
[2026-09-17T19:33:30.478Z] [ok] pr-crmvis-s6-bulk-link-ready.md  processed/
```

Arm at 19:19:51Z → queued in **1 s** → PR open in **13.5 min** → routed and filed. So the board went
from **0 open / 0 armed** to one open product PR in twenty-five minutes, which is the finding F-1
was about.

**`#2017` is correct and is NOT work for a station.** `gh pr view 2017` → OPEN, created
`19:32:53Z`, head `worktree-agent-aaf983d607db97815`, **exactly the three files in the prompt's
`scope:`** (`AccountLinkPreview.tsx` +335/-425, `crm.css` +294, `crmvis-s6-bulk-link.test.ts` +104),
title carrying `CRM_PARITY_BULKLINK_V1`, label **`do-not-merge`**. Its RULE-2 verdict is written and
genuine — `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco,
labelled do-not-merge"}` — so this is `[LABEL_PRESENT]`: **parked by design, nothing to fix, and
only Marco removes the label.** Three consecutive collect runs have previously listed such PRs among
"the reds"; this one is not a red.

### F-5 CLOSES — the trunk on `895bdefc` is green

Re-asked per-commit with the full 40-char SHA: `Push on main` **success**, `Deploy` **success**,
`CI` **success**, `Tendering Browser Smoke` **success**. The fifth row, `Claude Code`, is
`skipped` on event `issue_comment` and is not a trunk check — reading it into the verdict is the
§9.5 trunk-aggregate trap, and it is not being read in. **DISPOSITION: ACTIONED.** No successor owes
this read-back.

### `#2016` — this PR — is green and CLEAN but had not merged at end of run

Auto-merge armed `19:25:37Z` (SQUASH), `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`, every
check `pass` with the five `skipping` rows being path-filtered jobs rather than failures, and no
label. Still `state: OPEN` with `mergedAt: null` fifteen minutes later.

This is DOCTRINE §9.4's *"`CLEAN` can still be refused — policy evaluation lagging the rollup"*, and
the sanctioned response to it is the one already taken: native auto-merge is armed and will fire on
the next evaluation. **I did not reach for `--admin` and did not hand-merge.**
**DISPOSITION: DEFERRED** — the read-back is open by design, not neglected. The next occurrence
should confirm with `gh pr view 2016 --json state,mergedAt,mergeCommit`; if it is still OPEN and
CLEAN with auto-merge armed, that is a second instance of the lag and worth recording as a pattern
rather than re-diagnosed from scratch.

⚠️ `docs/pr-prompts/` now shows `rev-2016-ready.md`. That is the auto-generated **review job** for
this PR, not a prompt, and it must not be counted as an armed prompt (§9.5). The real armed count is
**0** — `pr-crmvis-s6-bulk-link-ready.md` was consumed into `processed/` at 19:33:30Z.

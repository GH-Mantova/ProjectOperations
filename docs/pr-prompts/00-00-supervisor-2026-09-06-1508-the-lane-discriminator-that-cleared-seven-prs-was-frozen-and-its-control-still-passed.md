# Station 00 — Supervisor | 2026-09-06T15:08:42Z–2026-09-06T15:5xZ

## GROUND

```
UTC            2026-09-06T15:08:42Z
origin/main    c2371a7d  (fetched first, then rev-parse; moved to 1ab5bb0d at 15:16Z when I merged #1724)
dev tree       main @ d1467428 -> 1ab5bb0d   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter, station-contract v3)
bootstrap      1   (scheduled-task SKILL.md, station_doc_version: 1) — MATCH, full authority
```

**SIGHTED RUN.** `ToolSearch` was run first (keyword `desktop-commander`, then a `select:` call);
`start_process` shell `powershell.exe` succeeded on the first attempt. The ids in this environment
are `mcp__plugin_desktop-commander_desktop-commander__*`.

Device-bridge git guard installed **before any VM-side call**, per PREFLIGHT. Its last line,
verbatim: `persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`

All three binding documents read **in full**, from the dev-tree working copy proved current the
sound way (no piped hash): `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**.

`status-sweep.ps1` run twice (captured to a file, because it returns early). Section 0 positive
controls both passed, no `[BROKEN]`. §7 VERDICT at 15:10:35Z and again at 15:14:27Z, immediately
before the merge: `[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no
live station worktrees.`

Fresh negative-control needle minted for this run per §9.6: `zzQq00Needle20260906T1515`. It returned
**0** on every corpus it was used on, and it is spent the moment this file lands.

## WHAT I MEASURED

### COLLECT — two untracked breadcrumbs since my last run, both dispositioned below

`node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`;
`structure: 6 checked, 0 malformed`. It named two files `UNTRACKED — it reaches nobody until a
board PR commits it`:

- `00-00-supervisor-2026-09-06-1408-...-blindness-is-refuted.md` (my own predecessor, **blind**)
- `00-04-scanner-2026-09-06-1410-watcher-launch-log-died-at-0527z-...md`

Freshness table, crossed against `lastRunAt` as the station doc requires:
`00 14:08Z (1.1h) ok · 03 2026-09-05T23:01Z (16.2h) ok · 04 14:10Z (1.0h) ok · 05 14:11Z (1.0h) ok`.
**No station is silent.** ⚠️ The `00` row is the weak one — `check-breadcrumb.mjs`'s own
`const CADENCE =` still holds `'00': 2` against a live hourly cron, so it cannot call 00 SILENT until
three consecutive misses (STATION-CAPABILITIES §6; 04's F5 re-ran that probe this hour and it has
**not** landed). Cited, not re-raised.

### The board at 15:1xZ — 4 open, and one of them was mine to merge

`gh pr list --state open --json number,title,headRefName,mergeStateStatus,isDraft,labels,author,createdAt,files`,
assign-then-count (§9.4): **OPEN=4**. **None of the four carried any label.**

| PR | state | CI | files | lane |
|---|---|---|---|---|
| **#1724** | CLEAN | 15/15 pass | `sot/02`, `sot/06`, `docs/qa/sot-refs-baseline.json`, one `docs/pr-prompts/` breadcrumb | **Station 05 doc-reconcile**, named in its own body — §10.1 **step 3**, classified by STATION-CAPABILITIES §5 |
| #1713 | CLEAN | 15/15 pass | incl. `apps/api/prisma/migrations/20260907000000_rate_line_fields/migration.sql` | `[NO LANE VERDICT — hand-classified]` → **MARCO'S** (migration) |
| #1709 | CLEAN | 15/15 pass | incl. `apps/api/prisma/migrations/20260906180000_tender_client_bid_status/migration.sql` | `[NO LANE VERDICT — hand-classified]` → **MARCO'S** (migration) |
| #1699 | BLOCKED | 13 pass / **2 fail** | incl. `apps/api/prisma/migrations/20260906120000_rates_value_columns_require_unit/migration.sql` | `[NO LANE VERDICT — hand-classified]` → **MARCO'S** (migration) |

### RULE 2 — probe calibrated, live tree pinned, silent on all four

`[MEASURED]` in `C:\ProjectOperations2\docs\pr-prompts\processed` — **never** the clone:
**2005** logs · POSITIVE `-Pattern 'marco.:true'` (regex, no quote character) → **617** ·
NEGATIVE `zzQq00Needle20260906T1515` → **0** · newest log `rev-1724-ready.md.log`, whose **content**
reads `Ended: 2026-09-06T14:33:42.027Z` — younger than every open PR, which is the freshness control
that separates the live directory from the 17-day-stale clone decoy.

Per-PR over `pr-*.log` only (the `rev-*`-excluded discriminator): **#1724 → 0 · #1713 → 0 ·
#1709 → 0 · #1699 → 0**; NEGATIVE control `PR #999999` → **0**. No watcher verdict exists for any of
them, so §10.1 step 2/3 applies to all four and is recorded per PR in the table above.

### #1724 — every gate checked before I touched it

- Body names its lane verbatim: *"Station 05 doc-reconcile, lane: `sot/` (STATION-CAPABILITIES.md §5,
  'Create a PR — doc-reconcile only')"*, and *"05 never arms and never merges."*
- CP-24's boundary holds by inspection of the file list: `sot/` + `docs/` only, **no** `apps/`,
  `scripts/`, `.github/`, `packages/`, `package.json`, `pnpm-lock.yaml`. That gate is what makes the
  §10.1 step-3 exception a measured claim rather than a self-declaration.
- Review lane verdict, found by probing **all three homes** (§9.5) and taking the newest:
  `C:\po-watcher\ProjectOperations\docs\pr-reviews\pr-1724-review.md`, 14:33:23Z — **`VERDICT: MERGE`**,
  *"Out of scope: None detected."* Dev tree and `verdicts-archive`: ABSENT.
- No label, no watcher `marco:true`, no `do-not-merge` — nothing to remove, and I removed nothing.
- No watcher PR was inside a `policy=tests-docs, waiting…` window: armed count **0**, in-progress
  prompts **0**, and the watcher has opened no PR since 02:01:30Z.

### #1699's red — read from the job log, not from the diff

`gh run view 34039053649 --job 101502346111 --log`:

```
FAIL - CP-26 approval-receipt [RELEASED_NO_RECEIPT] PR #1699 was labelled do-not-merge and
released, but docs/decisions/merge-approvals/1699.md is not in this PR's diff against merge-base
with origin/main.
```

The second red, `PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)`, is the **known coupling** —
one cause, two reds. **No agent may author a `merge-approvals/<N>.md`.** It clears only when Marco
commits the receipt or re-applies the label.

### Machinery — live, and 04's F1 reproduces unchanged

| | `[MEASURED]` 15:2xZ |
|---|---|
| watcher node | **RUNNING** pid 27236, `StartTime` **2026-09-06T11:49:57Z** |
| auto-restart wrapper | alive (7) |
| heartbeat age | 38 min (ticks only mid-run; stale + empty queue = idle, not wedged) |
| `C:\po-watcher\ensure-watcher.log` mtime | **15:15:03Z** — fresh |
| `C:\po-watcher\watcher-launch.log` mtime | **05:27:31Z** — still frozen, now 9 h 48 m stale and **6 h behind the running node's own start** |
| watcher clone `refs/heads/main` (loose) | **`16ddb58b`** against `origin/main` `1ab5bb0d` |
| clone dirty | **2** untracked — `docs/pr-reviews/pr-1709-review.md`, `pr-1713-review.md` |
| `C:\po-vg` | 1 untracked file, `scripts/pipeline/check-pipeline-heartbeat.mjs` |
| dev tree `index.lock` / clone `index.lock` / git processes | False / False / **0** |
| armed (`*-ready.md`) | **0** |

## WHAT CHANGED

1. **MERGED #1724** — `docs(sot): the last sot-ref baseline entry was a file deleted by the migration
   sot/06 records as unshipped`. Sanctioned path only: `. .\scripts\pipeline\pipeline-lib.ps1` →
   `Assert-SmokedOrEscalate -PR 1724` (True) → `Merge-Pr -PR 1724` (True). **Read back, not assumed:**
   `gh pr view 1724 --json state,mergedAt,mergeCommit` → `STATE=MERGED MERGED_AT=2026-09-06T15:16:18Z
   COMMIT=1ab5bb0d361979510ac5f26d358ef1ad6e9d1dd1`, and after `git fetch origin --prune`,
   `git rev-parse --short origin/main` → **`1ab5bb0d`**. It is on `main`, not merely auto-merge-enabled.
2. **This board PR**, opened from a **disposable worktree** off `origin/main` at `1ab5bb0d`
   (`C:\po-worktrees\board-1508`), carrying: this breadcrumb (REPORT CONTRACT **cure 1** — written
   inside my own PR worktree, so no loose copy exists in the dev tree and the documented FF blocker
   cannot occur for it); the two DOCTRINE edits below; `docs/pipeline/sweep-rotation.json`, which
   Station 04 advanced and left dirty for me by its own station doc's instruction; and the breadcrumb
   archiving.
3. **`docs/pipeline/DOCTRINE.md` §9.5, two edits, both inside the `instruments v2` canonical block**,
   made in node **by index-slice concatenation, never `String.replace` with a replacement string**
   (§9.3). Byte delta **asserted**: `before 96497 → after 98754`, `actual_delta 2257 ==
   expected_delta 2257`, `old1_gone true`, `new1_present true`, both insertions present;
   `git diff --numstat` → `26 1`, which is the 25 lines I inserted plus the 1 line I edited.
   Canonical hash re-recorded deliberately: `lint-station.mjs --write-canonical` →
   `instruments v2 104aa779f179f9c0`. Re-lint → **`ADMIT: all 8 docs clean`** (it read
   `REJECT: 1 of 8` before the re-record, which is the correct shape for a DOCTRINE-only block).
4. **Archived 7 dispositioned breadcrumbs** into `docs/pr-prompts/archive/` — the five tracked ones
   in the queue root by `git mv` (00's 1116, 1208, 1308; 04's 1010; 05's 1411), and 00's 1408 and
   04's 1410 by copy, because those two were **untracked** on disk. Archiving is safe for freshness:
   `check-breadcrumb.mjs` matches its tracked set by trailing path segment.

**Nothing else.** No prompt armed, disarmed, renamed or moved — `.arming-log.txt` is untouched and
therefore absent from this PR. No label added or removed. No `/sot/` edit. No `git` in
`C:\po-watcher\ProjectOperations`. No `git checkout .` / `reset --hard` / `stash pop` / `clean`
anywhere. No process started or killed. No Azure / Entra / SharePoint contact. No production data.

## FINDINGS

### F1 — [S1] ACTIONED — the lane discriminator that cleared seven PRs was frozen, and its prescribed positive control passed the whole time

Station 04's **F2** (dispatched to me) is correct and it is the most dangerous thing on this board
today, because the failure is in an **instrument**, not a system. DOCTRINE §9.5 sends a run to
`watcher-launch.log`'s `opened PR #<n>` line to separate *second lane* from *a watcher PR whose
verdict was never written* from *a watcher PR still inside its waiting window*. `[MEASURED]` this run:
that log's mtime is **2026-09-06T05:27:31Z** and its newest `opened PR #` line is **02:01:30Z**,
while the node it describes started at **11:49:57Z**. Its positive control (`opened PR #` > 0) reads
**167** and passes. So the instrument answers, exits 0, passes its control — and is blind to every PR
opened after 02:01Z, in **both** lanes.

`#1723` (merged 13:33:51Z) states in its body that all seven then-open PRs *"were established as
second lane by the watcher launch log carrying `opened PR #<n>` for none of them, against a positive
control"*. That classification was drawn from this frozen file. The **conclusion** survived — 04 and
I both re-derived it independently by `classifyPolicyFiles` — but the **evidence** did not, and the
method is written into the document every station is told it can trust.

**ACTIONED.** The freshness precondition is now in DOCTRINE §9.5's `NO LOG` bullet: any run using the
`opened PR #<n>` test must first assert the log's `LastWriteTimeUtc` is younger than the PR's
`createdAt`, and report `[CANNOT MEASURE]` for anything after it. #1723's spent classification is
named there so the next reader does not inherit it. Verified by `git diff --numstat` (`26 1`), the
byte-delta assertion above, and `lint-station.mjs` → `ADMIT: all 8 docs clean`.

### F2 — [S3] ACTIONED — `ARM_ONLY` has gained the `/i` flag and RULE 4's detector was under-reporting in the arming direction

Station 04's **F3**, dispatched to me. `scripts/pipeline/lint-prompt.mjs` now reads
`const ARM_ONLY = /Arm ONLY/i;` while DOCTRINE §9.5 and the RULE 4 detector both quoted
`/Arm ONLY/`, and the memory index added that only `DO_NOT_ARM_CAPS` is case-sensitive. A union grep
run `-CaseSensitive` across all three therefore misses `ARM only`, `arm ONLY` and `Arm only` — prompts
the linter **does** gate. The error runs toward arming something that carries a human gate.

**ACTIONED.** §9.5 now quotes `/Arm ONLY/i` and states which two markers must be grepped
case-INSENSITIVELY and which one case-SENSITIVELY, with the three anchor lines named as the
falsifying probe. Same verification as F1.

### F3 — [S2] DISPATCHED → Station 03 — the transcript does not resume across a relaunch, and the clone is still nine commits behind

Two 03-owned items, unchanged and re-affirmed live this run, handed over as **one** piece of work:

- **(a) `watcher-launch.log` is frozen** (04's F1, re-measured above). `ensure-watcher.log` records
  four `RELAUNCHED`/`VERIFIED` pairs today — 05:35:03Z, 09:25:04Z, 09:35:06Z, 09:49:32Z — **none of
  which appended a byte to the transcript.** Diagnose whether `Start-Transcript -Append -Force` in
  the launcher is throwing (a prior wrapper still holding the handle is the obvious candidate; its
  `| Out-Null` would swallow the error) and give the wrapper a log path that cannot silently vanish.
  🔧 **Falsifying probe:** the log's `LastWriteTimeUtc` against the watcher process's `StartTime`.
  If the mtime is younger, the transcript has resumed and this is dead.
- **(b) the clone is still at `16ddb58b`** against `origin/main` `1ab5bb0d`, so both watcher fixes
  merged today are still undeployed — first raised by the 12:08Z run, re-affirmed at 13:08Z and
  14:08Z, and now again. FF the clone dealing with its 2 untracked `docs/pr-reviews/` files first
  (`stash drop`, **never `pop`**), then restart in an idle window, then leave exactly one supervisor
  family. **I may not do it:** `git` write in `C:\po-watcher\ProjectOperations` is an absolute hard
  stop for this station.

**03 does not run until `2026-09-06T23:00:45Z`** (`nextRunAt`), so (a) and (b) sit ~7.5 h more. That
is now the **sixth** measured cost of the open 03-cadence question (bootstrap says 4 h, live cron says
daily) and of the open "who may fast-forward the watcher clone" question. Both are already with
Marco. **Cited, not re-raised.**

### F4 — [S2] ESCALATED (already on file; cited, not re-filed) — #1699 is red on a receipt no agent may write

Read from the job log this run, quoted verbatim above: `RELEASED_NO_RECEIPT`. #1699 was labelled
`do-not-merge`, the label was removed, and `docs/decisions/merge-approvals/1699.md` does not exist.
**Only Marco can clear this**, by committing the receipt or re-applying the label — and #1699 is a
migration PR, so it is Marco's on lane grounds regardless of what colour CI turns.

⚠️ **`#1721` merged at 14:03:27Z** (*"removing a label must re-run CI, because CP-26 reads the LIVE
label"*), so a future label event will now re-run the gate. **A colour change on #1699 is not a
clearance** — named here so the next run does not read one as permission.

The two underlying gaps — *CP-26 is armed by LABELLING, not by the DIFF*, and *no agent may author an
approval receipt* — are on file from the 09:08Z, 10:08Z, 11:16Z, 12:08Z and 14:08Z runs. Nothing new.

### F5 — [S3] DEFERRED — 04's blindness lead is plausible and one paired observation is not enough to widen the preflight

04's **F7**, dispatched to me: 00 was BLIND at 14:08:15Z with `CONNECT_TIMEOUT` and 04 was SIGHTED on
the same box **125 seconds later**; 04's own first keyword `ToolSearch` returned no desktop-commander
tool and its second, one round-trip later, returned all 26. The shape is a **startup race between the
client's connect window and the server's connect time**, not a property of the host — which would
explain both the intermittency and why no host-side cause has ever been found.

**DEFERRED, deliberately.** The cure would be an edit to the `station-contract` canonical block, which
must be re-recorded and shipped across all seven station docs in one PR; widening the one block every
station must obey on a **single** paired observation is how a stale instruction becomes law. What
would make it actionable: **two** more runs recording the cheap probe 04 already specified — on a
`CONNECT_TIMEOUT`, wait 60 s, issue one further keyword `ToolSearch`, and record in the breadcrumb
whether the second attempt succeeded. One run that comes back sighted converts this into a finding
with a one-line cure; two that stay blind kill it.

### F6 — [S3] ACTIONED as a measurement — the duplicate-prompt exposure still has not fired

The 13:08Z run found six of seven open PRs shadowed by a live, armable `-HOLD.md`, and the 14:08Z run
confirmed none had fired. `[MEASURED]` this run: armed (`*-ready.md`) → **0**, in-progress prompts →
**0**, `.arming-log.txt` newest entry still `2026-09-06T09:20:50Z`. No duplicate PR was created in
this window either, by any lane. The exposure is real and still open; its cure — a `triage-holds.ps1`
DUPLICATES bucket — is staged behind an existing prompt for the same file, correctly gated.
🔧 **Falsifying probe:** the `*-ready.md` glob and `.arming-log.txt`'s newest entry. If either moves
while one of the three surviving PRs is open, the next run will see a duplicate.

### F7 — [S3] DEFERRED — `C:\po-vg` still holds one uncommitted file

`git -C C:\po-vg status --porcelain` → `?? scripts/pipeline/check-pipeline-heartbeat.mjs`; the sweep
ages the worktree at 3317 min. `git worktree remove` will refuse and `--force` would discard the file,
so pruning it is destructive and is not mine to do unsupervised. **What would make it urgent:** the
file being needed by an open escalation, or the worktree acquiring a second dirty file. Unchanged
from prior runs.

## WHAT I DID NOT DO

- **Did not merge, label, unlabel, close or comment on #1713, #1709 or #1699.** All three carry a
  `prisma/migrations/` path, fail `classifyPolicyFiles` on its own clause, and hand-classify as
  **Marco's**. An absent watcher verdict is never a clearance (§10.1 step 4).
- **Did not write `docs/decisions/merge-approvals/1699.md`** or any approval receipt, and did not
  remove `do-not-merge` from anything. Both are Marco's alone.
- **Did not arm, disarm, rename or move any prompt.** The three surviving duplicate `-HOLD.md`s stay
  re-armable in case their second-lane PR closes unmerged (RULE 1's second half), and the standing
  never-arm names are untouched.
- **Did not run `git` in `C:\po-watcher\ProjectOperations`, and did not fast-forward the clone** —
  absolute hard stop, and it is 03's work, dispatched in F3.
- **Did not restart, kill or reconfigure the watcher.** `restart-watcher-if-wedged.ps1`'s
  preconditions are not met: the node is running, the wrapper is alive, armed count is 0, and an
  idle watcher with 0 armed prompts is CORRECT, not wedged. No relaunch was attempted on a
  `wrapper=` reading of any kind.
- **Did not prune `C:\po-vg`**, touch the orphaned worktree's file, or clean the clone's two
  untracked review files. Destructive, and 03's lane.
- **Did not edit the `station-contract` canonical block** for F5, and did not fold the
  breadcrumb-FF-blocker rule into it either — both are seven-document changes and a collect run is
  the wrong PR for them (the second is already DEFERRED in 00's own station doc for that reason).
- **Did not touch `/sot/`.** Reading it is expected; editing it is Station 05's, gated by CP-24.
- **Did not run a smoke or a visual review.** Every PR I touched is docs/`sot`-only; no PR this run
  touches `apps/web/**`.
- No Azure / Entra / SharePoint contact of any kind. No production data written.

---

`[MEASURED]` unless tagged. True at `origin/main` **`1ab5bb0d`**, 2026-09-06T15:5xZ.
Re-verify any claim here against the live system before acting on it.

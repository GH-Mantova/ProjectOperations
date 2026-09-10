# Station 00 — Supervisor | 2026-09-10T16:08:11Z–2026-09-10T16:4xZ

Sighted run — Desktop Commander reached the box on the first call, before any conclusion was drawn.
Collect cycle. No merge, one board PR, one instrument repaired, one breadcrumb collected and archived.

Fresh negative-control needles minted for this run: `zzQq00Needle20260910T1610` through `...T1616`.
They are now written down and are spent.

## GROUND

```
UTC            2026-09-10T16:08:11Z
origin/main    42be202c            (git fetch origin --prune, then rev-parse)
dev tree       main @ 42be202c     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was not restricted to read-only on that account.

All three binding documents were read in full and proved current against `origin/main` rather than
merely off disk: `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md` returned **EMPTY** for
all three, which is the real answer per DOCTRINE section 9.3. No piped hash was taken and none is
compared. Every `git` call ran in the dev tree, never the watcher clone.

## WHAT I MEASURED

**Preflight guard — [CANNOT MEASURE], third consecutive station run.** `scripts/pipeline/vm-git-guard.sh`
could not be installed: the Linux workspace transport is absent again. Verbatim: `bash failed on
resume, create, and re-resume … source path … is under Plan9 share "c" which is not mounted; create:
RPC error -1: ensure user: user admiring-fervent-wright already exists unexpectedly`. Station 04
recorded this at 14:10Z and Station 00 at 15:08Z, each under a different session id; this is the
third, ~2 h after the second. **No `git` ran against any mount this run — there was no mount to run
one against.** Per the station contract a failed install is a finding, not a stop.

**PREFLIGHT step 4 — the sweep.** `status-sweep.ps1` captured to a file, exit 0, 135,440 bytes. It is
UTF-16LE, per DOCTRINE section 9.3's `*>` bullet, and was decoded `utf16le` in node before being read —
decoded as UTF-8 it splits into structureless lines whose `====` headers match nothing. Section 0
controls both `[LIVE]`. Section 7 verbatim: `[LIVE] SAFE TO ACT: no board mutation in progress, no
recent remote activity, no live station worktrees.` Re-measured immediately before creating the
worktree: `index.lock` dev **False** / clone **False**, git processes **0**, staged paths **EMPTY**.

**Machinery.** `[LIVE] watcher node: RUNNING pid 18228` · auto-restart wrapper alive (1) · heartbeat
92 min (ticks only mid-run; stale + empty queue is idle, not wedged) · trunk green on `42be202c`
(4 success / 0 failed) · `armed: 0`. No restart was needed and none was performed;
`restart-watcher-if-wedged.ps1` was not run because there was no verdict to act on.

**COLLECT corpus.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`,
`structure: 1 checked, 0 malformed`. Freshness: `00` 1.1h (cadence 2h) ok · `03` 17.2h (24h) ok ·
`04` 2.0h (4h) ok · `05` 2.0h (24h) ok. Crossed against `lastRunAt` from the scheduled-tasks MCP, as
the collect step requires, because the breadcrumb is one instrument and cannot name a cause:

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| `00` | 2026-09-10T16:08:11Z (this run) | 15:08Z | aligned |
| `03` | 2026-09-09T23:01:42Z | 2026-09-09T23:01Z | aligned; next fire 23:00Z today |
| `04` | 2026-09-10T14:09:49Z | 14:10Z | aligned |
| `05` | 2026-09-10T14:10:55Z | 14:11Z | aligned |

No station is SILENT and none needed a transcript read. ⚠️ **The `ok` on `00` is weaker than it
looks and I am not quoting it as an all-clear:** `check-breadcrumb.mjs`'s own `CADENCE` map still
reads `'00': 2` against a live cron of `5 * * * *`, so `00` is not called SILENT until three
consecutive hourly runs have been missed. Crossed against the board instead — `#1853` (1308),
`#1854` (1408) and `#1856` (1508) merged an hour apart — so the occurrences either side of this one
fired and reported.

**Exactly one breadcrumb to collect**, and it is my own predecessor's: the 1508 run. Asked of the
TRACKED SET rather than the dev tree, per the archiving rule — `git ls-files` returns it, so it has
already reached main (in `#1856`) and is not an unreported finding. All nine of its findings (F0–F8)
carry a disposition, so it is fully collected and is archived in this run's PR.

**Board — five open PRs, every one CLEAN and green.** `#1855` merged since my last run, so the board
went six to five. Lane established per PR before anything else was considered.

RULE 2 probe, run against the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed` and never
the watcher clone, written without a quote character (`-Pattern 'marco.:true'`):

| control | result |
|---|---|
| logs in the probe directory | 2,119 |
| newest log | `2026-09-10T14:38:19Z` — younger than every open PR |
| POSITIVE `marco.:true` | **629** |
| NEGATIVE `zzQq00Needle20260910T1610` | **0** |
| NEGATIVE `PR #999999` over `pr-*.log` | **0** |

| PR | files | prompt-log hits (`rev-*` excluded) | verdict | lane |
|---|---|---|---|---|
| `#1850` | `scripts/pipeline/triage-holds.ps1` | 2 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/triage-holds.ps1"}` | **MARCO'S — RULE 2 binds** |
| `#1845` | `scripts/pipeline/status-sweep.ps1` | 2 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/status-sweep.ps1"}` | **MARCO'S — RULE 2 binds** |
| `#1832` | `scripts/pipeline/vm-git-guard.sh` | 2 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/vm-git-guard.sh"}` | **MARCO'S — RULE 2 binds** |
| `#1823` | 5 × `apps/api/**` + the receipt | 2 | `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` | **MARCO'S — RULE 2 binds** |
| `#1852` | `scripts/pipeline/status-sweep.ps1` | **0 — NO LOG** | — | `[NO LANE VERDICT — hand-classified]` **MARCO'S** |

⚠️ **All five carry `labels: []`.** `#1823`'s label was removed by Marco at `2026-09-09T22:40:06Z`.
**Removing `do-not-merge` does not clear RULE 2** — a live watcher `marco:true` verdict is cleared
only by Marco in chat, for that batch, and no such instruction reached this run.

**`#1852`'s `NO LOG` was resolved, not assumed**, and this run found a better instrument than the two
on file. The daily clone log was located by NAME SHAPE then mtime, never constructed from a date:
`…\scripts\pr-watcher\logs\2026-09-10.log`, mtime `16:09:48Z` — seconds old — 77,133 B, POSITIVE
control `[merge]` → **8**, NEGATIVE → **0**. Its four `opened PR #` lines name `#1827`, `#1832`,
`#1845`, `#1850` and **not `#1852`**, which is `[CANNOT MEASURE]` on that instrument and never on its
own a second-lane verdict. `.arming-log.txt` (byte-identical to `origin/main`, `--numstat` EMPTY)
records nothing armed after `11:50:44Z`, while `#1852` was created `13:21:20Z` — no arm in its
window, so no watcher build could have started. **The decisive instrument was the authoring identity**
(see F1): `#1852`'s single build commit `b401132f` authors as `GH-Mantova <marco@initialservices.net>`,
a pairing neither working tree can produce, while all four watcher builds author as
`Marco <marco@initialservices.net>` — the clone's configured identity. Hand-classified by
`classifyPolicyFiles`: one `scripts/pipeline/` path, outside all three `NESTED_TEST_PATHS` forms ⇒
**Marco's**.

**No board PR was inside a merge window.** Newest `policy=tests-docs, waiting` is `#1850` at
`12:02:16Z`; its 90-minute `MERGE_TIMEOUT_MS` window closed about `13:32Z`, four hours ago. There was
no waiter to go first, and nothing was merged this run in any case.

**Nothing is mergeable by this station.** Five of five open PRs are Marco's. `armed: 0` at the start
of the run and `0` at the end.

## WHAT CHANGED

1. **One board PR opened** from the isolated worktree `C:\po-wt\bc-00-1608`, created off
   `origin/main` `42be202c`, carrying: the DOCTRINE section 10.2.1 correction of F1, the archiving of
   my predecessor's fully-collected 1508 breadcrumb, the seven untracked review records of F4, and
   this report. `docs/` only.
2. **Nothing else.** No PR merged. **No prompt armed, disarmed, renamed, moved or deleted** — `armed`
   was 0 before and after. No label added or removed. No watcher restart. No worktree pruned, no
   stash dropped, no branch deleted, no `git clean`, no `git checkout .`, no `reset --hard`, no
   `stash pop`. The dev tree's shared index was **EMPTY** before and after (`git diff --cached
   --name-status` on both readings), so no other chat's staged work was swept into a commit.

## FINDINGS

### F1 — a cloud-lane receipt now authors as the DEV TREE, and section 10.2.1's identity table has no row for it

[MEASURED] this run across all five open PRs and both working trees. DOCTRINE section 10.2.1 tells a
reader to attribute an actor by the AUTHORING commit's identity and gives a four-row table. The table
is correct as far as it goes and its central claim is now stronger, not weaker — but it is missing
two of the five pairings this board actually emits, and the missing rows are the ones a reader meets
first today.

**The mechanism the table does not state: `%an` / `%ae` come from whichever TREE the commit was made
in, so one actor emits different identities depending on where it committed.** POSITIVE controls,
both trees, same run: dev tree `git config user.name` → `PR Supervisor`, `user.email` →
`supervisor@local`; watcher clone → `Marco` / `marco@initialservices.net`. **That second control
establishes section 10.2.1's own "the most human-looking identity belongs to the most automated
actor" from the CAUSE side** — the clone is simply configured that way — rather than from behaviour
alone, which is how the section reached it.

The row that breaks the table: **`#1823`'s `docs/decisions/merge-approvals/1823.md` receipt
(`9664f95a`) authors as `PR Supervisor <supervisor@local>`**, while the receipt's own closing line
reads *"Receipt written by the supervised Station 00 cloud lane"* and its commit message carries
`Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` and a `Claude-Session:` URL. Same lane, same
kind of artefact, an identity the table has no row for — because it was committed from
`C:\po-worktrees\pr1823`, a **dev-tree worktree** whose HEAD `git worktree list` shows parked at
exactly that SHA, and which inherits the dev tree's `user.name` through the shared `.git/config`.

🔴 **The table's own falsifying probe does not fire on this.** It asks whether a cloud-lane receipt
ever reads `Marco <marco@initialservices.net>`, or a watcher build the cloud-lane identity. Neither
happened — the receipt read a fifth pairing the probe does not mention — so the block stays silently
under-determined, and a reader applying it to today's newest receipt gets **no answer at all**. That
matters here rather than in the abstract: it is the receipt for the one open PR carrying product
code, and receipt attribution is the entire subject of the standing escalation
`needs-marco/nothing-verifies-a-merge-approval-receipt-2026-09-07.md`. A scheduled run has already
filed a forgery accusation off a misread of this same kind and retracted it an hour later.

⚠️ **This is not a forgery finding and must not be read as one.** The receipt names its own author in
prose, its commit names the actor in a trailer, and the two agree. What failed is the *instrument*
the pipeline prescribes for checking such a claim, not the claim.

**DISPOSITION: ACTIONED** — landed in this run's board PR as a correction inside DOCTRINE section
10.2.1, docs-only and inside this station's lane. It adds the two missing pairings, states that `%an`
names a TREE, and replaces the attribution method with the trailers (`Co-Authored-By:`,
`Claude-Session:`), which are written by the actor and survive on the PR's commit list. Byte delta
asserted (`149,558 → 153,900`, insert 4,342, expected 153,900, PASS); the replacement was built by
concatenation, never a `String.replace` replacement string; encoding re-checked after the write
(U+FFFD **0**; the `â€`-family count is **2 before and 2 after**, and both are section 9.3 quoting
that signature as documentation — section 9.6's closing rule, not damage). **Falsifying probe** is
written into the correction: the two `git config` reads and the worktree list.

### F2 — 90% of the open board's commits are rebuild churn, and 00's own hourly collect PR is a driver of it

[MEASURED] this run. `pollForBehindPrs` rebuilding every open PR after every merge to `main` is
already an open escalation. What this run adds is the **rate**, measured across the whole board in
one snapshot, and a causal identity precise enough to be falsified.

| PR | created (UTC) | age | commits | of which `Merge branch 'main' into …` | PRs merged to main since it was created | Δ |
|---|---|---|---|---|---|---|
| `#1852` | 2026-09-10T13:21:20Z | 2.9 h | 5 | **4** | 4 | **EXACT** |
| `#1850` | 2026-09-10T12:02:05Z | 4.2 h | 7 | **6** | 5 | +1 |
| `#1845` | 2026-09-10T09:37:57Z | 6.6 h | 11 | **10** | 10 | **EXACT** |
| `#1832` | 2026-09-10T00:12:33Z | 16.0 h | 21 | **20** | 22 | −2 |
| `#1823` | 2026-09-09T00:05:42Z | 40.2 h | 27 | **24** | 29 | −5 |
| | | | **71** | **64** | | |

Controls: NEGATIVE — merges since a future timestamp → **0**; POSITIVE — merges since 2026-09-01 →
80, i.e. sample-capped, which is why the two long-lived rows read low rather than high and why the
sampled window (`80` PRs, oldest `mergedAt 2026-09-07T08:33:24Z`) is stated.

**64 of 71 commits on the open board — 90% — are machine rebuilds of PRs no automation may merge.**
The one-for-one match at short ages and the negative drift at long ones are both what the mechanism
predicts: a merge arriving while a rebuild is already in flight is skipped rather than double-counted.

🔴 **The part that is new, and that I am reporting against my own station: my collect PR merges every
hour by design, and every one of those merges rebuilds all five of Marco's PRs.** `#1852` gained
exactly four rebuilds in 2.9 hours, and exactly four board PRs merged in that window — `#1853`,
`#1854`, `#1855`, `#1856`, three of them my own collects. The station whose job is to keep the board
moving is, on a board where every PR waits on a human, the main thing writing to it.

This measurement argues specifically for option **(a)** of the standing escalation — *skip PRs
`classifyPolicyFiles` refuses* — because it is exactly those PRs, all five of them, absorbing all 64
rebuilds. It is the complete-and-additive option: it removes the waste permanently and cannot damage
data entry, since a PR that no automation may merge gains nothing from being kept current.

**DISPOSITION: DEFERRED**, not re-escalated. The question is already with Marco with its options, and
re-escalating hourly is the noise F8 of the 1508 run correctly refused to make. What this adds is
evidence for an option already on his list, and it is recorded here where he will meet it. ⚠️ **These
are counts, i.e. state — re-measure them, never quote them.** It becomes urgent if the rebuild loop
ever pushes a PR red, or if a `fixes_pr` for a main regression is ever among the PRs being rebuilt.

### F3 — `#1823` is fully prepared to merge and the only remaining gate is one only Marco can clear

[MEASURED] `state=OPEN`, `mergeStateStatus=CLEAN`, CI **15 pass / 0 fail / 0 pending**, `labels: []`
(released by Marco at `2026-09-09T22:40:06Z`), `autoMergeRequest=false`, and its CP-26 receipt present
in its own diff — the receipt records that CP-26's only FAIL, when the lane ran the gates locally, was
that receipt's own absence. It has sat **17.6 hours** since the receipt was written and **40.2 hours**
since it opened.

The one thing still holding it is the live watcher verdict `{"ok":false,"marco":true,"reason":
"escalates:true - held for Marco, labelled do-not-merge"}`. **RULE 2 is not overridden by green, by
CLEAN, by the label having been removed, or by a receipt** — and the receipt itself does not clear it,
because nothing in the pipeline verifies a receipt (the standing escalation F1 names). I did not merge
it and no station may.

⚠️ **Carried forward because it is the one operational risk on this board and it is marked
[CANNOT MEASURE] by its own author:** the receipt records that keying team visibility off
`tenders.allocate` means every role holding that code sees colleagues' individual numbers in the
estimating and win-rate reports, and that WHICH roles hold it could not be measured from that lane.
That is one look at the Admin role list, and it belongs to Marco before anyone relies on the reports.

**DISPOSITION: DEFERRED.** Not escalated, because it is already written where Marco will read it — in
the receipt inside the PR's own diff — and duplicating it into `needs-marco/` would split one question
across two homes. It becomes urgent the moment the PR is merged or deployed with the role list
unchecked.

### F4 — seven more review records were untracked but not ignored, and they are now tracked

[MEASURED] `docs/pr-reviews/` holds **107** tracked files on `origin/main`, and seven review verdicts
sat in the dev tree at that same path untracked: `pr-{1827,1834,1845,1846,1847,1853,1855}-review.md`,
16,913 bytes. None of the seven basenames is tracked (checked against the `git ls-tree -r` set, with
`docs/pr-reviews/pr-1007-review.md` as the positive control), and none is ignored (`check-ignore` on a
FILE, never a directory: exit **1** for both sampled, against a positive control returning
`.gitignore:76` for a path inside `processed/`). Encoding checked before staging: U+FFFD **0**,
double-encoded sequences **0** across all seven.

This is the same class my predecessor actioned at 15:08Z for 146 archived records — the recurrence,
one hour later, is the argument that it is systemic rather than a one-off tidy-up.

**Committing them changes no gate, and that was read from the source rather than assumed.**
`resolveVerdictPath` in `scripts/pr-watcher/index.mjs` resolves a verdict from three FILESYSTEM homes
— the clone's `REPO_ROOT`, the verdicts archive, and the dev tree — and never from `origin/main`, so
tracking a copy cannot satisfy `verdictApproves` for any PR that would not already satisfy it.

**DISPOSITION: ACTIONED** — committed in this run's board PR. RULE 1 decided it: committing is
complete (the reasoning is permanent and no longer one `git clean` from gone) and additive (nothing is
destroyed, 17 KB, no basename collision, no gate affected). Leaving them untracked-but-not-ignored
survives only by luck; deleting them destroys review reasoning and fails the second test outright.

### F5 — the Linux workspace transport has now been absent for three consecutive station runs

[MEASURED] twice this run, verbatim under WHAT I MEASURED. With Station 04 at 14:10Z and Station 00 at
15:08Z, that is three runs across three session ids and roughly two hours. This is **not blindness**
and must not be reported as it: Desktop Commander was present and healthy throughout all three, and
`STATION-CAPABILITIES.md` section 3 already says that transport is never a fallback.

The narrow consequence is unchanged from the 1508 run: `vm-git-guard.sh` stays uninstalled, so the
first run that *does* get a mount inherits an unguarded bridge. ⚠️ And the luck is unchanged too —
the guard exists to stop `git` running against a mount, and on all three runs there was no mount to
run one against.

**DISPOSITION: DEFERRED**, unchanged from the 1508 run and re-recorded because the count has moved,
which is the only new fact. It is not actionable from a run with no VM side. It becomes urgent the
moment a station with a working mount runs; that run installs the guard and quotes the installer's
last line, pass or fail. ⚠️ `#1832`, which repairs this very script's self-test, is one of the five
PRs waiting on Marco.

### F6 — three more untracked, non-ignored files in the shared dev tree

[MEASURED] `git status --porcelain` in the dev tree, after the seven review records of F4 were taken
out: `docs/pr-prompts/.queue-sync-ledger.txt`, `docs/pr-prompts/queue-watch-state.md` and
`Claude Design/docs/index.html` are all untracked and all **not ignored** (`check-ignore` exit 1,
against the positive control above). `Claude Design/` itself is tracked on `origin/main`, so only that
one generated file is loose inside it.

The first two are STATE, not instructions — `queue-watch-state.md` is the snapshot the sweep tags
`[FILE]` and warns is not current. Tracking state is what the station contract's *"instructions live
here, state does not"* exists to prevent, so the right fix is a `.gitignore` entry, not a commit.

**DISPOSITION: DEFERRED**, folded into the 1508 run's F3, which reached the same conclusion about
`.sweep-*` captures and demoted it for the same reason. The complete-and-additive fix covers all four
paths in one `.gitignore` change — but `.gitignore` is outside this station's lane on this board, and
every arm available today already lands on Marco (F2). ⚠️ It becomes urgent if any of these ever
appears in `git ls-tree -r origin/main`; that probe is one line.

## WHAT I DID NOT DO

- **Merged nothing.** All five open PRs are Marco's: four carry a live watcher `marco:true` verdict
  and `#1852` hand-classifies to him on its single `scripts/pipeline/` path. RULE 2 is not overridden
  by green, by CLEAN, by an empty label list, by a CP-26 receipt, or by my own reading of a routing
  reason. `#1823`'s label was removed by Marco; **that is not a RULE 2 clearance** and I did not treat
  it as one.
- **Armed nothing, and did not go looking for something to arm.** `armed` was 0 throughout.
  `triage-holds.ps1` was not re-run: the 1408 run measured `0 of 15` gate-satisfied HOLDs eligible for
  the `tests-docs` lane, so every arm available today lands on Marco, and adding to a five-deep queue
  he has not cleared makes it longer rather than shorter (F2 now puts a cost on that in rebuild
  commits, not just in waiting).
- **Did not author a merge-approvals receipt.** A scheduled run never may. Marco's 2026-09-07 ruling
  covers the supervised cloud lane only, and this run is the scheduled one.
- **Did not remove or add any label**, and did not enable auto-merge on anything.
- **Did not prune `C:\po-vg` or `C:\po-worktrees\pr1823`, drop a stash, or delete a branch.** The
  worktrees and the 71-deep clone stash loop are Station 03's and are already dispatched by the 1508
  run; branch deletion is irreversible and is already escalated. ⚠️ **One correction for 03 from this
  run, because it changes what that worktree is:** `C:\po-worktrees\pr1823` is not merely a stale
  checkout — its HEAD `9664f95a` **is the commit that authored `#1823`'s merge-approval receipt** (F1).
  Pruning is still safe on content grounds, since the commit is on the pushed branch and `dirty=0`,
  but 03 should know it is deleting the tree an audit artefact was written in rather than an aborted
  run's leftover. **Re-measure both SHAs immediately before acting** — `#1823` is live.
- **Did not touch the watcher clone beyond reads** — the daily log was **copied** before
  `Select-String`, because the live file is held open by the watcher, and nothing in `C:\po-watcher`
  was written.
- **Did not restart the watcher.** RUNNING pid 18228 with a live wrapper and an empty queue; a stale
  heartbeat with 0 armed is idle, not wedged.
- **Did not run `git` through the device bridge** — there was no bridge, and a guard I could not
  install is never a licence to use one.
- **Did not commit `queue-watch-state.md`, `.queue-sync-ledger.txt` or `Claude Design/docs/index.html`**
  (F6), and did not edit `.gitignore`.
- **Left `docs/qa/`, `/sot/`, Azure, Entra and SharePoint alone.** No file under `sot/` was read for
  edit or written this run.

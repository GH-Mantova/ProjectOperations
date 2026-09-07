# Station 00 — Supervisor | 2026-09-07T11:08Z–2026-09-07T12:0xZ

## GROUND

```
UTC            2026-09-07T11:09:49Z (start)
origin/main    01db2bb2            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 01db2bb2     C:\ProjectOperations2   (rev-list --left-right HEAD...origin/main = 0  0)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)  -> MATCH, full authority
```

SIGHTED — Desktop Commander loaded via keyword `ToolSearch`, `start_process` shell `powershell.exe`
returned `2026-09-07T11:09:49Z` and `Test-Path …\DOCTRINE.md -> True`. **Not a blind run.**

Device-bridge git guard, run first, last line quoted verbatim [MEASURED]:

```
vm-git-guard installed at /sessions/admiring-cool-keller/.local/bin/git - refuses mounted paths,
allows everything else (both controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

All three binding documents were read **in full** from the dev tree, proved current rather than
assumed: `HEAD == origin/main == 01db2bb2` and none of the three appears in `git status --porcelain`,
so the working copies I read ARE `origin/main`'s (no piped hash, no length comparison — §9.1/§9.3).

`status-sweep.ps1` at 11:18:08Z — captured to a FILE because it returns early and hides its own §7
verdict — **§7 VERDICT: SAFE TO ACT** (no board mutation in progress, no remote activity in the last
2 min, no live station worktrees). Section 0 positive controls both PASS. Re-read immediately before
the one mutation this run made.

**Fresh needle this run** (now spent — §9.6): `zzQq00Needle20260907T1130`.

## WHAT I MEASURED

### 1. The board — 5 open, and every one of them is Marco's [MEASURED]

RULE 2 probe, pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed` (never the
clone — §9.5), prompt logs only (`pr-*.log`, excluding `rev-*`), written without a quote character:

```
newest log      2026-09-07T09:48:27Z      <- younger than every open PR's createdAt (freshness precondition)
POSITIVE        'marco.:true'   -> 620
NEGATIVE        fresh needle    -> 0
#1777 #1775 #1774 #1767 #1760  -> 0 prompt-log hits each   =>  NO LOG
```

`NO LOG` for all five ⇒ **`[NO LANE VERDICT — hand-classified]`** under §10.1 step 2, from
`classifyPolicyFiles`' three `NESTED_TEST_PATHS` forms. `gh pr view <n> --json files,labels`:

| PR | files | classification | label | CI |
|---|---|---|---|---|
| #1777 | `scripts/pipeline/sweep-breadcrumbs.ps1` | **MARCO'S** — outside tests/docs | — | 15/0 green, CLEAN |
| #1775 | `apps/api/**`, `package.json`, `scripts/rates/**` | **MARCO'S** | `do-not-merge` | 13/2 red |
| #1774 | `.github/workflows/ci.yml`, `scripts/pipeline/check-hex-ratchet.mjs`, +2 | **MARCO'S** | — | 13/2 red |
| #1767 | `apps/api/prisma/migrations/20260907100000_tr1_…/migration.sql` +8 | **MARCO'S** — `migrations/` clause | `do-not-merge` | 13/2 red |
| #1760 | `docs/decisions/merge-approvals/1760.md`, `…/__tests__/gate-path-space.test.mjs`, `scripts/pr-watcher/index.mjs` | **MARCO'S** — the third path | — | 15/0 green |

§10.1 step 3's station-lane exception does **not** rescue any of them: 00's recorded lane is `docs/`
and all five reach outside it. **MERGED NONE.**

### 2. #1774's red is `RELEASED_NO_RECEIPT`, not `LABEL_PRESENT` — and that is a different problem [MEASURED]

The previous cycle recorded *"every red on this board is one label"*. That is still true of #1775 and
#1767, which carry `do-not-merge` — **[INFERRED]**, from the label being present, not from their job
logs. It is **false** for #1774, which now carries no label at all. Job log, read rather than reasoned
from the PR page (`gh run view 34118021452 --job 101729279958 --log`):

```
FAIL - CP-26 approval-receipt [RELEASED_NO_RECEIPT] PR #1774 was labelled do-not-merge and released,
but docs/decisions/merge-approvals/1774.md is not in this PR's diff against merge-base with
origin/main. Commit the receipt on the PR branch so the approval leaves an authored, reviewable
artefact.
```

So the label was applied, then removed — the release happened — and the gate now demands a receipt
that **no scheduled station may author**. See F2.

### 3. Arming — 18 candidates, ZERO of them tests-or-docs-only [MEASURED]

`triage-holds.ps1` at 11:5xZ, run plainly (the `$env:OS` workaround is retired — `#1769`; the script's
own SPENT fixture control printed `PASS`):

```
TOTALS  spent=0 of 46 evaluated  gates-satisfied=18  still-gated=28  unreadable=0
```

Each of the 18 `GATES SATISFIED` prompts was then classified from its **own `scope:` list** against
the three `NESTED_TEST_PATHS` forms (POSITIVE control 3 of 3 on `docs/pipeline/DOCTRINE.md`,
`scripts/pipeline/__tests__/backlog-parser.test.mjs`, `apps/api/src/bootstrap/dev-helper.spec.ts`;
NEGATIVE control `scripts/pipeline/status-sweep.ps1` → 0):

```
TESTS_DOCS_ONLY = 0 of 18       (4 of the 18 carry a migrations/ scope entry)
```

**ARMED NOTHING — fifth consecutive run, and the reason is measured, not cautious.** Arming any of
the 18 opens a sixth PR that only Marco can merge, onto a board where five already wait on him.
§10.6 duplicate check, scope-prefix form (a `/`-terminated entry matched as a PREFIX, any overlap a
CANDIDATE and never a verdict): `pr-brandtheme-s2-hex-ratchet` ↔ **#1774**,
`pr-tipid-s2-write-the-ids-backfill-and-admin` ↔ **#1775**, `pr-watcher-gate-path-space` ↔ **#1760**,
`pr-tr-s1-reminder-policy` ↔ **#1767** via the `migrations/**` prefix — four of the 18 would open a
duplicate of a PR that is already open.

### 4. Stations — nothing silent, and the freshness table agrees with `lastRunAt` [MEASURED]

`node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0, `structure: 3 checked,
0 malformed`. Crossed against the scheduled-tasks MCP, which the breadcrumb instrument cannot see:

| station | newest breadcrumb | `lastRunAt` | verdict |
|---|---|---|---|
| 00 | 2026-09-07T10:08Z | 2026-09-07T11:08:28Z | healthy (this run) |
| 03 | 2026-09-06T23:02Z | 2026-09-06T23:01:13Z | aligned, next 2026-09-07T23:00Z |
| 04 | 2026-09-07T10:18Z | 2026-09-07T10:10:07Z | aligned |
| 05 | 2026-09-06T14:11Z | 2026-09-06T14:11:01Z | aligned, next 2026-09-07T14:10Z |
| `weekly-security-audit` | n/a — not a station | 2026-09-06T21:32:44Z | ran Monday, next 09-13 |

No station is SILENT and no occurrence was missed. The known weakness stands and is already
escalated: `check-breadcrumb.mjs`'s `CADENCE` map still reads `'00': 2` against a live cron of
`5 * * * *`, so an `ok` for 00 is a weaker statement than for any other station.

### 5. Machines [MEASURED]

`restart-watcher-if-wedged.ps1` (the only sanctioned liveness instrument):

```
armed prompts waiting: 0
watcher process:       ALIVE (pid 31660)
restart churn:         0 cycle(s) in 20 min  (starts=0 exits=0, threshold 4)
VERDICT: OK - nothing armed and the watcher is alive. An idle watcher is correct, not wedged.
```

Wrapper alive (1) per the sweep, so ENSURE-UP took **no action**. Heartbeat age 91 min with an empty
queue is idle, not wedged — the heartbeat only ticks mid-run. `index.lock` ABSENT in both trees;
0 git processes; no PR touched on GitHub in the last 2 min.

## WHAT CHANGED

One board PR, built in a **disposable worktree** off `origin/main`
(`C:\po-worktrees\board-1108`, branch `docs/board-collect-1108`), carrying:

- `docs/pipeline/sweep-rotation.json` — Station 04 advanced it to `last_index=2`,
  `last_run_utc=2026-09-07T10:17:56Z` and left it dirty in the shared dev tree by its own station
  doc's instruction. **04 may not commit there; 00 does.** This is the second documented cause of a
  refused post-merge fast-forward, so the cure order in the station doc applies afterwards.
- Station 04's 10:18Z breadcrumb, landed from the dev tree where it was untracked.
- This breadcrumb, written **inside the worktree** (cure 1 — no loose copy in the dev tree).
- `00-00-supervisor-2026-09-07-0908-….md` `git mv`-ed to `docs/pr-prompts/archive/`: every finding in
  it carries a disposition. It is **tracked** in the dev tree, so this move does not create the
  untracked-root-copy blocker the station doc records for archiving.

**Nothing else.** No prompt armed, disarmed, renamed, retired or resurrected. No PR merged, labelled,
closed or rebased. No branch or remote ref deleted. No receipt authored. Nothing touched in
`C:\po-watcher`, `C:\po-vg`, `/sot/`, Azure, Entra or SharePoint.

## FINDINGS

### F1 — S2 — 04's resurrected branch is still live, re-verified, and it is Marco's to delete

Station 04's 10:18Z F1 re-measured at 11:3xZ, independently:

```
git ls-remote --heads origin | Select-String 'sweep-breadcrumbs-20260907-0934'
  -> 261d78568c985980154c3b381d7bed1d8fe8ef47  refs/heads/chore/sweep-breadcrumbs-20260907-0934
NEGATIVE control (fresh needle over the same output)                     -> 0 hits
git merge-base --is-ancestor <that ref> origin/main                      -> exit 1  (tip NOT on main)
git diff --name-status origin/main <that ref>                            -> 13 entries
POSITIVE control: same diff against origin/fix/watcher-gate-path-space   -> 3 files
```

The eight `R100` rows are still there — `superseded/pr-armguard-s2-…`, `pr-module-provenance-s2`,
`pr-pipeline-nodrift-…`, `pr-rates-plant-fuel-column`, `pr-statussweep-local-time-timestamps`,
`pr-sweep-dead-queue-dir-reads`, `pr-triageholds-s2-…` and `pr-watcher-app-auth-switch-on`, each
moved back to depth 1 — plus `M scripts/pipeline/triage-holds.ps1` (the `#1769` fix reverted),
`D` of 00's 1008 breadcrumb, and two breadcrumbs un-archived. Two of the eight are on the standing
do-not-arm list and one of those is **production auth**.

My probe ref was created and then deleted; `git for-each-ref refs/remotes/probe` reads **0**, so I
added nothing to the un-prunable remote-tracking cache §9.2 records.

**DISPOSITION: ESCALATED** — folded into the existing
`needs-marco/remote-branches-outlive-their-prs-2026-09-05.md` rather than filed as a tenth
near-duplicate, exactly as 04 asked. Deleting a remote ref is DOCTRINE §5.4 irreversible and
therefore Marco's; I did not delete it. Options are recorded in that file, RULE 1 order, with 04's
option (a) — report-never-auto-delete, extended to compare each PR-less head's TREE against
`origin/main` and flag anything that would resurrect `superseded/` or `archive/` — first.

### F2 — S2 — Marco released #1774, and the gate now needs a receipt no scheduled station may write

Measured in §2 above. `approval-receipt-check.mjs` fails `RELEASED_NO_RECEIPT` because `everLabeled`
is true, the label is gone, and `docs/decisions/merge-approvals/1774.md` is not in the PR's diff.
The coupled `PR gates — diff checks` red goes with it — one cause, two reds, as recorded.

**Nobody on the board can clear this.** Marco's 2026-09-07 ruling (`#1736`) authorises the
**supervised cloud lane** to author a receipt before it merges; it does not authorise the scheduled
lane, and this run did not author one. So #1774 is a released PR that can never go green until Marco
or his supervised lane commits the receipt onto the branch — and nothing on the board reports that
state. `#1760` shows the working shape: its own diff carries `docs/decisions/merge-approvals/1760.md`.

**DISPOSITION: ESCALATED** — written to
`needs-marco/pr-1774-released-but-cp26-demands-a-receipt-2026-09-07.md`. This is the mirror image of
the standing `cp26-passes-vacuously-on-an-unlabelled-destructive-migration-2026-09-05.md`: that one
is CP-26 passing when it should bite, this one is CP-26 biting with no actor permitted to satisfy it.
Both are the same root cause — **the gate is armed by LABELLING, not by the diff.**

### F3 — S3 — Five dead `verdict-home-resolver` heads (04's F2)

**DISPOSITION: ESCALATED**, same fold as F1. Not re-measured here beyond 04's table; its claim that
they hold nothing unique is 04's `[INFERRED]` and I have not upgraded it. The measured half — heads
with no open PR went 5 → 8 in two days and no instrument reports it — is what option (a) fixes.

### F4 — S3 — A megabyte of junk in the build clone's root (04's F3)

`"C\357\200\272po-watcherProjectOperations.._scratch_1740_log.txt"`, 1,033,778 B, second character
U+F03A. It is one of the six untracked entries behind `status-sweep.ps1`'s live line
`watcher clone: branch=main dirty=6 <-- NOT clean-on-main; the watcher may refuse to start`.

**DISPOSITION: DISPATCHED → Station 03 (machine-minder).** Only 03 acts in the clone. Fold into the
existing open 03 dispatch; do not raise a new one. The ask is one deletion plus, if the caller is
findable in a session transcript, a note on why the path flattened.

### F5 — S3 — `C:\po-vg` still holds the only copy of one commit (04's F4)

Re-measured live by `status-sweep.ps1` at 11:18Z: `C:/po-vg` `23c91ba9`
`[fix/no-rebase-while-checks-run]`, `dirty=1 files`, **age=4525 min (~75 h)** — 04 recorded 74 h at
10:1xZ, so it is still ageing and still untouched.

**DISPOSITION: DISPATCHED → Station 03**, a re-statement of 03's own open escalation with a fresh
number so the dispatch does not go stale. **Nothing in it may be `--force`d away** — the commit is on
no remote branch and the untracked `scripts/pipeline/check-pipeline-heartbeat.mjs` is the only copy.

### F6 — S4 — Two stale state files in the queue root, neither tracked nor ignored (04's F5)

`docs/pr-prompts/.queue-sync-ledger.txt` (2026-08-19) and `docs/pr-prompts/queue-watch-state.md`
(2026-08-31). The second is why `status-sweep.ps1` still prints a 19-day-old snapshot as its
"freshest station summary".

**DISPOSITION: DEFERRED**, agreeing with 04. The additive cure is a `.gitignore` entry for both — but
`.gitignore` is outside 00's `docs/` lane, so that PR would land on the board as a **sixth** PR only
Marco can merge, which is the exact constraint F-§3 above measures. It becomes urgent the moment a
station commits with `-A` instead of a pathspec; `#1773`'s NO-DRIFT law and §9.2's shared-index rule
both already guard that. Better carried by the next PR Marco is already merging that touches the root.

### F7 — S4 — `gh pr list --state closed --limit 60` cannot see this board's closed-unmerged PRs (04's F6)

**DISPOSITION: DEFERRED**, agreeing with 04's reasoning: it is one instance of the `--limit`
truncation §9.2 already names, and a §9 bullet per query variant would bloat the section faster than
it helps. Recorded here so the disposition exists rather than the finding simply ageing out. The
falsifying probe if anyone wants it retired is 04's: re-run with `--limit 400` and check for `#1708`.

## WHAT I DID NOT DO

- **Merged nothing.** All five open PRs hand-classify as Marco's under §10.1 step 2, and #1775/#1767
  additionally carry `do-not-merge`, which only Marco removes.
- **Armed nothing.** 0 of 18 gate-cleared prompts is tests-or-docs-only (§3, measured with controls),
  and four of the 18 duplicate an open PR under §10.6.
- **Authored no receipt** for #1774 or anything else. The 2026-09-07 ruling covers the supervised
  cloud lane; this is the scheduled lane.
- **Deleted no remote ref**, including the resurrected branch in F1 — DOCTRINE §5.4, Marco's.
- **Did not chase the three red PRs.** Their reds are CP-26 and its coupled diff-checks failure; a
  rebase or a re-run cannot clear either, and #1774's needs a human artefact.
- **Did not touch `C:\po-watcher`, `C:\po-vg`, the 69 clone stashes, `/sot/`, production data, Azure,
  Entra or SharePoint.**
- **Did not restart the watcher** — `restart-watcher-if-wedged.ps1` returned `OK`, and an idle
  watcher with 0 armed prompts is correct.
- **Did not archive 04's 10:18Z breadcrumb** in the same PR that lands it. Landing and archiving a
  file in one PR is what produced the duplicated-basename instance the station doc records; the next
  collect archives it from the root path where it will then be tracked.

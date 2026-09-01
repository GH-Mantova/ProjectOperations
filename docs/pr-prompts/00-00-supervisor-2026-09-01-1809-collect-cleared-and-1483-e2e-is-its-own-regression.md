# Station 00 — Supervisor | 2026-09-01T18:09Z–2026-09-01T18:4xZ

**SIGHTED run.** `start_process` shell `powershell.exe` returned a live shell on the first call.
This is a measured board, not a quiet one. The 16:09Z run was blind; this one is not.

## GROUND

```
UTC            2026-09-01T18:09:12Z
origin/main    cdc78159            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ cdc78159     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE — full authority, not read-only.

## WHAT I MEASURED

### Reading the binding docs from the right copy

- [MEASURED] `git diff --stat origin/main -- docs/pipeline/stations/00-supervisor.md
  docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` returns **empty**. The working
  copy is byte-equivalent to `origin/main` for all three, so reading it is reading main.
- 🔴 [MEASURED] **My first freshness probe LIED, in the shape DOCTRINE §9.3 predicts.** I dumped
  `git show origin/main:docs/pipeline/stations/00-supervisor.md` with `Out-File -Encoding utf8` and
  ran `Compare-Object` against the working copy: **166 differing lines** on a 915-line file. The
  files are identical; `Out-File` re-encoded the dump. Had I stopped there I would have opened this
  run by declaring my own instructions stale. **`git diff` / `git hash-object` are the only honest
  comparators.** Station 05 hit the same trap from the other direction four hours earlier.

### Preflight §4 — locks, merge state, sweep

- [MEASURED] No `index.lock` in **either** tree (dev + watcher clone), 0 git processes, and none of
  `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / rebase-merge / rebase-apply / sequencer present
  in `C:\ProjectOperations2\.git`. The device-bridge lock did **not** recur (8th consecutive clean).
- [MEASURED] `bring-up-to-speed.ps1` @18:10:15Z — verdict **SAFE TO ACT**: no board mutation in
  progress, no remote activity in 2 min, no live station worktrees, `armed: 0`, 0 in-progress prompts.
- [MEASURED] Machinery: watcher node **RUNNING pid 28400** — the same PID Station 05 measured at
  14:12Z and 00 measured at 14:38Z, so it has now survived **~4 hours** unchanged. Wrapper alive (1).
  Watcher clone `branch=main dirty=0`. Heartbeat 217 min stale **with `armed: 0`** = idle, not wedged.
  **The 90-cycle crash loop has not recurred.**
- [MEASURED] `check-breadcrumb.mjs --freshness` → `structure: 4 checked, 0 malformed`, `CLEAN`,
  exit **0**. No station SILENT: 00 2.0h/2h · 03 19.2h/24h · 04 4.0h/4h · 05 4.0h/24h.

### The board, and which lane opened each PR (DOCTRINE §10.1)

- [MEASURED] **2 open PRs**, both carrying **zero labels**.
- [MEASURED] **#1483** `feat(scope-s2): WBS item table shell` — BLOCKED, 11 pass / 3 fail.
  RULE-2 probe (regex form, POS control **602** `marco.:true` across the corpus, NEG control
  `zzqq9917` → 0): `pr-cardui-s2-wbs-table-shell-ready.md.log` carries
  `[watcher] merge result for PR #1483: {"ok":false,"marco":true,"reason":"escalates:true - held for
  Marco, labelled do-not-merge"}`. **RULE 2 APPLIES. Not mine to merge.**
- [MEASURED] **#1477** `test(export): one makeSummary() helper` — **CLEAN, 14 pass / 0 fail / 0
  pending**. No `[watcher] merge result for PR #1477` line exists in the whole corpus, only a
  `rev-1477-ready.md.log` review verdict. **[NO LANE VERDICT — hand-classified]**: its three files
  are `apps/api/src/modules/estimate-export/estimate-export.service.spec.ts`,
  `apps/api/src/modules/estimate-export/test-support/make-summary.ts` and
  `apps/api/src/modules/pdf-rendering/builders/__tests__/quote-html.builder.spec.ts` — **all three
  outside `^(tests|docs)/`**, so `classifyPolicyFiles`' rule makes it **MARCO'S**. A `.spec.ts`
  under `apps/api/` is not in `tests/`; the rule is a path prefix, not a file kind.

### The trunk red, and why it is NOT the same red as #1483's

- [MEASURED] `main CI on cdc78159: 3 success / 1 failed`. Full 40-char SHA used
  (`gh run list --commit` answers `[]` for a short SHA — §9.4). The failure is
  **Tendering Browser Smoke → tendering-e2e**, run `33520578163`, job `99901417047`.
- [MEASURED] Job log read (never the diff). **1 failed**, and only one:
  `batch7-field.spec.ts:264 › timesheet submits for today; duplicate attempt shows the friendly 409
  message` — `getByText(/Timesheet submitted — 8 hours/)` not visible after 10 s.
  Log-search controls: POS `tendering` → 2860 hits, NEG `zzzNoSuchTokenZzz` → 0.
- [MEASURED] The nine preceding `Tendering Browser Smoke` runs on `main` are **success × 8 +
  cancelled × 1**, including `9fa9a41f` five minutes earlier. `cdc78159` is a **`sot/` + `docs/`
  only** merge (#1496) — a docs diff cannot break a timesheet form.
- [MEASURED] The spec file has not changed since `832e6deb`, 2026-08-03.
- **ACTION TAKEN:** `gh run rerun 33520578163 --failed`; read back `attempt: 2, status: queued` at
  18:12:25Z. Result recorded under FINDINGS F5.

### #1483's e2e is a different failure set entirely

- [MEASURED] `#1483`'s tendering-e2e job `99899793317` reports **7 failed**, none of them
  `batch7-field`: `batch3-scope-items.spec.ts:65, :122, :184, :252`, `batch3-scope-waste.spec.ts:45`,
  `batch8-misc.spec.ts:91` and `:105`. Two of those (`batch8-misc:91` *item cards render collapsed by
  default; chargeBy is gone from the card UI* and `:105` *item notes expand modal cancels via Escape*)
  **PASSED on main in the very same hour**. So #1483's red is its own diff, not main's flake.

## WHAT CHANGED

One board PR, opened from a **disposable worktree** off `origin/main`
(`C:\po-worktrees\board00-20260901-1815`, branch `board/00-collect-2026-09-01-1815`). Nothing was
mutated in the dev tree, in `C:\po-watcher`, or on any other PR.

| Change | Why |
|---|---|
| `pr-crm-uifix-s1-cold-threshold-and-tab-shells-HOLD.md` → `superseded/…-SPENT-2026-09-01-shipped-in-1486.md` | 04's F1 |
| `pr-scopesub-s4-linked-items-and-quotes-HOLD.md` → `superseded/…-SPENT-2026-09-01-shipped-in-1478.md` | 04's F2 |
| `docs/pipeline/sweep-rotation.json` committed (2/2) | 04's F4 — 04 has no PR authority |
| 04's 1410 breadcrumb + 00's 1609 blind-run breadcrumb committed into `archive/` | they were UNTRACKED and reached nobody |
| 00's 1409 and 05's 1411 breadcrumbs `git mv`'d into `archive/` | dispositioned below |
| this breadcrumb, at the tracked queue-root path | current cycle |

**Pathspec discipline (04's F6):** the dev tree also carries ` M docs/data-model/metadata-catalog.json`.
[MEASURED] `git diff --numstat` on it returns **no rows** — an end-of-line flip, not a content change.
It was **not** copied into the worktree, so it cannot ride into this PR and read as data-model drift.

**One board mutation outside the PR:** `gh run rerun 33520578163 --failed` on `main`'s red workflow.
Sanctioned by the station doc's transient-CI rule; read back as attempt 2.

## FINDINGS

### F1 — The COLLECT queue is CLEARED. Three breadcrumbs, sixteen findings, all dispositioned.

The queue had been missed for two consecutive cadences (12:35Z deferral, then the 16:09Z blind run).
It is now empty. Dispositions, in full:

**Station 04, 2026-09-01T14:10Z (gate-liveness sweep):**
F1 `pr-crm-uifix-s1` SHIPPED in `#1486` — **ACTIONED**, retired to `superseded/` in this PR.
F2 `pr-scopesub-s4` SHIPPED in `#1478` — **ACTIONED**, retired to `superseded/` in this PR; the
cluster is NOT retired, `cluster_order: 5` stays live.
F3 seven HOLDs gated transitively on `#1483` — **DISPATCHED**, see F2 below.
F4 `sweep-rotation.json` cannot be committed by 04 — **ACTIONED**, committed here.
F5 clean sweep with controls — **ACTIONED**, nothing to fix.
F6 concurrent actor regenerated the data-model artifacts — **ACTIONED** on the half that matters
(pathspec commit, above); the writer's identity stays `[CANNOT MEASURE]` and I did not guess it.

**Station 05, 2026-09-01T14:11Z (the eight-finding breadcrumb):**
1 sot/04 three merges stale — **ACTIONED** by 05 itself in `#1496`, verified on main.
2 sot-refs baseline re-keyed — **ACTIONED** by 05 in the same PR.
3 the sot encoding gate reads **3 of 7** sot files and is blind to the only damaged one —
**DISPATCHED**, see F3 below.
4 sot/03's 9 U+FFFD, blocked for 6 days by CP-24 — **DISPATCHED**, see F3 (it is the second half of
the same two-PR sequence).
5 411 double-encodes across 28 files, including the six `.claude/agents/*.md` rewritten 08-31 —
**DEFERRED**, see F4.
6 05's own instrument produced a false finding and it caught it — **ACTIONED**, nothing to do.
7 sot/02 §2 names `#894`/`#895` as open; both merged 2026-08-04 — **DEFERRED**, curated prose,
Marco's wording. Urgent the moment anyone answers *"what is open?"* from that file.
8 21 of 81 API modules absent from sot/01's registry — **DEFERRED**, curated judgement.

**Station 00 (me), 2026-09-01T16:09Z blind run:**
1 blindness recurred — **ESCALATED**, already filed at
`needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`; carried, not
re-raised.
2 collect queue missed twice — **ACTIONED**, this finding.

### F2 — `#1483` cannot go green, and its e2e red is a real regression in its own diff. **S2.**

Two independent blockers, and only one of them is anybody's to fix here:

1. **`Approval receipt (CP-26)` fails `RELEASED_NO_RECEIPT`** because `#1483`'s `do-not-merge` label
   was removed at 08:51:48Z and no `docs/decisions/merge-approvals/1483.md` exists. [MEASURED] the
   label set is still **empty** at 18:11Z. **No agent may author that receipt** — an agent-written
   receipt turns the only instrument that caught the release into a rubber stamp.
2. **tendering-e2e fails 7 acceptance tests**, listed under WHAT I MEASURED, two of which pass on
   `main` in the same hour. This is not a flake and not main's regression; the WBS table shell has
   broken the scope-card and item-card acceptance suites.

04's F3 makes this the **highest-leverage red on the board**: six `cardui` slices plus
`pr-scopesub-s5` — 7 of the 30 still-gated prompts — are transitively behind it, and no other open
PR releases more than zero.

**DISPATCHED → Station 01/02 on the e2e half** (a UI regression in `ScopeQuantitiesTable.tsx` is
code-writing work, and LL-38 says I do not do it in a shared tree), **and ESCALATED on the receipt
half** — that one is Marco's and is already escalation #20. I did **not** re-run its e2e: with the
receipt gate red the PR cannot merge either way, and re-running a genuine 7-test failure is exactly
the *"never re-run hoping for green"* DOCTRINE §2 forbids.

### F3 — The sot encoding gate must be widened BEFORE sot/03 can be repaired. Two PRs, in that order.

05's findings 3 and 4 are one problem. `check-sot-bytes.mjs:8-12` is a hard-coded three-element
array; the only damaged `sot/` file (`sot/03-progress-log.md`, 9 U+FFFD, reported first on
2026-08-27) is one of the four it cannot see. The repair has now been re-reported **twice into the
same wall**: the complete fix touches `sot/` **and** `scripts/`, and CP-24 hard-fails any PR
carrying both.

RULE 1, complete-and-additive first: **(A)** widen the array to a `readdirSync('sot')` filter in a
`scripts/`-only PR, then repair the 9 characters in a `sot/`-only doc-reconcile PR with the now-live
gate as its proof. Solves it immediately *and* for every `sot/` file added later, and a checker that
reads more files cannot damage data. **(B)** add the four missing names by hand — fixes today, fails
the future half, because `sot/07` is unwatched again. **(C)** leave it — fails both halves.

**DISPATCHED → Station 06 to stage (A) as a `scripts/`-only prompt**, which 00 then arms. I did not
stage it myself: 06 owns staging, and a prompt written by the station that will arm it gets no review.

### F4 — 411 double-encoded sequences, 110 of them in the six `.claude/agents/*.md`. **S3.**

05's finding 5, outside its allowlist in every direction. The `.claude/agents/*.md` row is the one
that matters: those six were rewritten 2026-08-31T00:38:06Z by the fix that discharged the
shared-doctrine thread, and came out carrying 110 double-encodes. `check-agent-doctrine.mjs` exits 0
because it checks that they *cite* DOCTRINE, not that they are readable.

**DEFERRED.** Mechanically recoverable (a fixed byte table, provable by re-running the scan to 0
with the em-dash count rising by the same number it fell) — but it touches `schema.prisma`,
`.claude/`, `docs/plans/` and `BACKLOG.yaml` in one sweep, and this run's queue was collect + the
board. What makes it urgent: any agent misreading a mangled instruction in `.claude/agents/`, or the
count rising again after another rewrite.

### F5 — main's trunk red is ONE test, and the re-run is the discriminator.

[MEASURED] at 18:15Z the re-run (attempt 2) was still `in_progress`. Recorded here with the probe
that settles it rather than a guess, per §9.5's *name the probe that would falsify it*:
`gh run view 33520578163 --json status,conclusion,attempt`. **Green ⇒ a flaky date-dependent
timesheet test on `main`, worth a prompt naming `batch7-field.spec.ts:264`. Red again ⇒ a genuine
main regression and the next run authors a `fixes_pr` for main.**

**DEFERRED to the 20:0xZ cadence**, with the exact command above. It is one test out of 165 and the
board is not blocked on it; it becomes urgent if a second `main` commit fails the same job.

### F6 — An untracked `-LOOPING.md` has been sitting in `superseded/` since 2026-08-26. **S4.**

[MEASURED] `docs/pr-prompts/superseded/pr-doctrine-s9-four-false-traps-LOOPING.md`, 9056 bytes,
mtime 2026-08-26T22:17:17Z, **untracked**. Its premise greps DOCTRINE for `no inline .if. expression`
— text §9 no longer carries — so it is spent as well as looping.

**DEFERRED.** It arms nothing: `-LOOPING.md` matches no watcher glob and it is not at depth 1, so it
is noise in `git status`, not a hazard. Deliberately not swept into this PR — committing a dead
looping prompt into the tracked corpus adds clutter a future reader must re-adjudicate. It becomes
worth acting on if `status-sweep` starts reporting it, or if anyone renames it.

## WHAT I DID NOT DO

- **Did not merge `#1483`.** RULE 2, on a live `marco:true` verdict quoted above. Its `do-not-merge`
  label is still absent and I did not re-apply it either — 00 does not touch that label in either
  direction.
- **Did not merge `#1477`**, though it is fully green. `[NO LANE VERDICT — hand-classified]` puts all
  three of its files outside `^(tests|docs)/`, which makes it Marco's under §10.1's own rule.
  I did not arm auto-merge on it.
- **Did not author `docs/decisions/merge-approvals/1483.md`.** Absolute. An agent-written approval
  receipt destroys the only instrument that has ever caught a released escalation.
- **Did not arm anything.** `armed: 0` before and after. The whole open board is already Marco's
  queue, so a code-touching arm only lengthens it; the one prompt worth arming (F3's `scripts/`
  widening) does not exist yet and is 06's to write.
- **Did not re-run `#1483`'s e2e** — see F2.
- **Did not touch the 11 registry-escapee worktrees, the 2 orphaned `stage/brandtheme-*` worktrees,
  the 40 `needs-marco/` files or the watcher process.** Clone hygiene is Station 03's standing
  dispatch and the machinery measured healthy.
- **Did not run `git` through the device bridge**, did not `git checkout .` / `reset --hard` /
  `stash pop` / `git clean` anywhere, and did not touch `/sot/`.
- **Did not touch Azure, Entra or SharePoint.** Absolute.

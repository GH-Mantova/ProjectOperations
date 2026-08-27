# Station 00 — Supervisor | 2026-08-27T12:08Z–2026-08-27T12:5xZ

## GROUND

```
UTC            2026-08-27T12:08:50Z
origin/main    01ad020e            (fetch +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 6283e12b     C:\ProjectOperations2   (DIVERGED: 2 local / 3 incoming)
doc version    1
bootstrap      1
```

Versions AGREE. Desktop Commander reached the box on the first attempt — **this run is NOT blind.**
The previous 00 run (2026-08-27T10:09Z) *was* blind and its breadcrumb REJECTs the shape lint.

## WHAT I MEASURED

- **Board: EMPTY.** `gh pr list --state open --limit 50 --json ...` → `OPEN=0`. [MEASURED]
- **Armed: 0** at run start. `Get-ChildItem docs\pr-prompts -Filter *-ready.md -File` → `ARMED=0`.
  60 `pr-*HOLD.md` on disk. [MEASURED]
- **No `index.lock`.** `Test-Path C:\ProjectOperations2\.git\index.lock` → false. [MEASURED]
- **Watcher node ALIVE**, 1 process, pid 28328, matched by exact cmdline
  `pr-watcher[\\/]index\.mjs` (never by image name). [MEASURED]
- **`gh` resolves** → `C:\Program Files\GitHub CLI\gh.exe`, so today's linter ADMITs are not the
  DOCTRINE §9.5 silent-waive kind. [MEASURED]
- **Breadcrumb freshness** (`check-breadcrumb.mjs --freshness`, exit 1): 57 checked, 9 malformed;
  00 ok, 04 ok, 05 ok, **03 reported SILENT at 13.1 h**. [MEASURED]

### The headline measurement, and the two instrument lies I caught on the way

**#1350 merged at 10:42:48Z with the `do-not-merge` label STILL ON IT and CP-26 RED.** [MEASURED]

```
gh api repos/GH-Mantova/ProjectOperations/issues/1350/events
  2026-08-27T08:47:32Z labeled do-not-merge by=GH-Mantova
  2026-08-27T10:42:48Z merged                by=GH-Mantova     <- label never removed
gh pr checks 1350
  PR gates - diff checks (CP-09-13, CP-17, CP-22, CP-23)   fail   6s
gh run view 33061054544 --job 98479640242 --log
  FAIL - CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true).
  A human must review and REMOVE the label; removing it is what releases the merge.]
  ##[error]Process completed with exit code 1.        (at 09:59:37Z — 43 min before the merge)
```

Not a one-off: **#1342 merged 2026-08-26T17:54:02Z, labelled `do-not-merge` @16:21:13Z, never
removed.** [MEASURED]

**LIE 1 I caught.** `gh api .../branches/main/protection` → **HTTP 404 "Branch not protected"**. I was
one sentence from reporting "main is unprotected". **The control refuted it:**
`gh api "repos/.../branches?per_page=100"` → `branch main protected=True`. Governance is a
**repository ruleset**, which the *legacy* protection endpoint does not see. DOCTRINE §7 shape
exactly: an inapplicable call read as a meaningful negative.

**LIE 2 I caught.** Grepping `.github/workflows/*.yml` for `CP-26` → **0 hits**, which reads as
"CP-26 does not exist". **Control:** the same loop for `CP-23` → `ci.yml:134`. CP-26 is real; it
lives in `scripts/pr-gates/pr-gates.mjs:472-510`, which the ci.yml job *runs*. The job **name** is
simply out of date — it advertises `CP-09-13, CP-17, CP-22, CP-23` and silently also runs CP-24,
CP-25 and CP-26.

### ROOT CAUSE — the gate works; it is simply NOT REQUIRED

```
gh api repos/GH-Mantova/ProjectOperations/rules/branches/main
  ruleset "Main" id 15532058, enforcement=active
  required_status_checks (strict=true):
      CodeQL
      API - lint, test, compliance smoke
      Web - lint, logic tests, vitest, build
      tendering-e2e
```

**Four checks are required. `PR gates — diff checks (...)` is NOT one of them.** [MEASURED]

Therefore **every CP gate is advisory** — CP-11 migrations, CP-23 seed-without-migration,
CP-24 sot-purity, CP-25 failure-honesty and CP-26 do-not-merge can all go red and the PR merges.
That single fact explains the whole 24-hour breach run without needing any "a chat stripped the
label" theory. Even a perfectly-timed, never-stripped, red CP-26 does not block a merge today.

**This RETIRES two standing beliefs in project memory:**

1. *"CP-26 RED **IS** THE GATE"* — **FALSE.** CP-26 red is a red advisory check.
2. *"the fix is `types:[…,labeled,unlabeled]` on `ci.yml`'s `on: pull_request`"* — **necessary but
   NOT sufficient**, and on its own it changes nothing at all.

The label race is real (`ci.yml:6-9` has `on: pull_request` with no `types:`), but it is the
*second* half of the problem, not the first.

### Is the fix safe? — the one detail that decides it

`ci.yml:132-134`: the `pr-gates` job carries **`if: github.event_name == 'pull_request'`** and has
**no `needs: changes`** and no path filter. It runs on **100 % of PRs**. [MEASURED] And ci.yml:29-32
records the repo's own rule: *"A required job skipped via a job-level `if:` still satisfies branch
protection."* So promoting it to required **cannot** leave a PR pending forever. There is no
board-wedge risk in the additive direction.

### RULE-2 breach ledger, re-measured this run

The watcher-routing probe is `processed/<prompt>.md.log` → `"marco":true` (the `stays for Marco`
string probe is retired — dead path). Of 7 processed logs written in the last 8 h: [MEASURED]

| PR | merged (UTC) | `marco:true` | `do-not-merge` at merge |
|---|---|---|---|
| #1350 | 10:42:48Z | **yes** | **PRESENT, and CP-26 red** |
| #1352 | 11:23:58Z | **yes** | absent |
| #1349 | 06:44:36Z | **yes** | applied 06:23:10Z, **stripped 06:44:30Z**, merged 6 s later |
| #1342 | 08-26 17:54:02Z | not re-probed | **PRESENT** |

With #1340 / #1344 / #1347 / #1348 already on the ledger, that is **8 RULE-2 breaches in ~24 h**,
two of them with the label visibly attached at merge time. All show `mergedBy=GH-Mantova`, which
identifies nothing — every actor merges as that account.

## WHAT CHANGED

1. **ARMED exactly one prompt**, `pr-lessons-folder-s3-ref-checker`, by `git mv` of the **tracked**
   HOLD. Verified `ARMED 0 → 1` on disk by re-listing. Pre-arm checks, all with controls:
   - `requires_file_on_main: docs/legacy-ai-providers-investigation.md` → `git cat-file -e
     origin/main:<path>` **exit 0**; control on a fabricated path **exit 128**. Gate LIVE.
   - `lint-prompt.mjs` → **PROMOTE / GATE_RELEASED**, exit 0, with `gh` on PATH.
   - RULE 4 marker sweep on the body: `watcher:\s*do-not-arm` = 0, `DO NOT ARM` (case-sensitive)
     = 0, `docs/approvals` = 0, exactly one `requires_*` line.
   - `git ls-files --error-unmatch` → tracked, so the rename is a real rename.
2. **Wrote this breadcrumb** (untracked until committed — committed below with a pathspec).

**Nothing else.** No merge, no label touched, no lock cleared, no watcher restart, no ruleset edit.

## FINDINGS

### F1 🔴🔴 The `do-not-merge` gate is not a required check, so nothing has ever enforced it

Measured above: ruleset "Main" requires 4 checks; the job carrying CP-09→CP-26 is not one of them.
#1350 merged 43 minutes after CP-26 failed, label attached. #1342 the same, yesterday.

**Marco — this is your call, and it is the one decision that closes all 8 breaches.** RULE 1 applied,
complete-and-additive FIRST:

- **A — require the gate AND make it re-run on label events. Solves both halves.**
  (i) Add `PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)` to ruleset "Main"
  → required status checks. (ii) In `ci.yml`, change `on: pull_request:` to carry
  `types: [opened, synchronize, reopened, labeled, unlabeled]`.
  *Immediate:* a red CP-26 blocks the merge the moment (i) lands. *Future:* applying the label
  turns the gate red and removing it turns the gate green **by itself**, so your removal is what
  releases the merge, exactly as the gate's own message already promises. *Additive:* no check is
  removed, no data is touched, and the job runs on 100 % of PRs so it cannot wedge the board.
  ⚠️ **One trap:** the check name must be entered **byte-exact**, including the em-dash in
  `— diff checks` and the en-dash in `CP-09–13`. An ASCII hyphen creates a required check that
  never reports, which wedges every PR permanently. Do not rename the job in the same change.

- **B — require the gate only (skip the `types:` half).** Fails the FUTURE half. After you remove
  the label, CI does not re-run, so the stale red persists and the PR stays blocked until someone
  manually re-runs the workflow. It converts every escalated PR into a manual chore.

- **C — add `types:` only.** Fails the IMMEDIATE half completely. The gate stays advisory and PRs
  keep merging red. Changes nothing today.

- **D — wire `merge-queue.mjs`'s hold-label guard (DOCTRINE §8.3a).** Fails both halves as a
  primary fix: it governs only merges that go *through* the queue, and any actor calling
  `gh pr merge` bypasses it — which is precisely what happened all 8 times.

**DISPOSITION: ESCALATED**

### F2 🔴 The ci.yml job NAME understates what it runs — and the name is the contract

`ci.yml:134` advertises `CP-09–13, CP-17, CP-22, CP-23`. The log for job 98479640242 shows it also
runs **CP-24 (sot-purity), CP-25 (failure-honesty) and CP-26 (do-not-merge)**. A reader auditing
which gates are enforced from the job name will undercount by three — and the required-checks list
is keyed on that same name. Renaming it is a genuine change with an ordering hazard once F1(A)(i)
lands, so it is not a free tidy-up. **DEFERRED** — it becomes urgent the moment anyone proposes
renaming or re-scoping that job; do F1 first, then rename as its own change with the required-checks
entry updated in the same window.

### F3 The `03` SILENT verdict is a false positive from a wrong cadence constant

`check-breadcrumb.mjs` reports `03 last 2026-08-26T23:01:00Z 13.1h ago (cadence 4h) SILENT`.
`CADENCE['03'] = 4` is wrong — 03's schedule is **daily**, so twice-cadence is 48 h and 13.1 h is
well inside it. 03 is quiet, not silent. The fix is one line, `'03': 24`. This mis-fires on every
00 run and trains the reader to ignore a real silence. **DEFERRED** — no live impact this run;
worth one line in the next pipeline-guard slice.

### F4 Nine malformed breadcrumbs; seven of them are Station 06's

`check-breadcrumb.mjs` exit 1: 7 of the 9 rejects are `00-06-pr-master-*` missing the
`# Station <NN>` heading and carrying no disposition line. 06 still has **no scheduled task**, so
it only runs when Marco fires it by hand, and nothing will correct these on its own. Also rejecting:
`00-00-supervisor-2026-08-27-1009-blind-desktop-commander-absent.md` (the blind run wrote no
sections at all) and `00-04-scanner-2026-08-27-0617-...` (routes findings to a gitignored path).
**DEFERRED** — these are reporting-shape defects on work already reported elsewhere; none hides a
live finding.

### F5 The dev tree is diverged 2/3, and it is benign

`git rev-list --left-right --count origin/main...HEAD` → `3 2`. The two local commits are a merge
commit and `1b83d45d docs(crm): build-order plan…`, whose content is already on main as
`22b2f529` (merged as #1351). Incoming depth-1 `*-ready.md` in the range: **0**, so the FF-arms-a-
prompt trap is not live here. No reconciliation needed and none attempted. **DEFERRED**.

## WHAT I DID NOT DO

- **I did not edit the ruleset.** Changing repository merge governance is Marco's call, and the
  wrong check name there wedges the entire board — see the trap in F1(A). Escalated instead.
- **I did not ship the `ci.yml` `types:` half on its own.** Alone it changes nothing (option C),
  and half-shipping an escalated decision is how a partial fix gets mistaken for a closed one.
- **I did not merge anything, remove any label, or re-open #1350 / #1342.** The merges are done;
  nothing is gained by touching them and RULE 2 forbids it either way.
- **I did not arm a second prompt.** One at a time.
- **I did not clear or touch the shared index's pre-existing orphan `R100`**
  (`pr-guard-s1-verdict-file-list`, whose PR #1352 has merged). It belongs to another chat's arm;
  I committed with an explicit pathspec so my commit does not carry it.
- **I did not restart the watcher.** Node alive (pid 28328), 0 armed at the time — an idle watcher
  with nothing armed is correct, not wedged.

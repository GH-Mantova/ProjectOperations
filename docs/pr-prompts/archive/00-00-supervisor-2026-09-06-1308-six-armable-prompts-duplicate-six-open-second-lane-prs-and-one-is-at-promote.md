# Station 00 — Supervisor | 2026-09-06T13:08:42Z–2026-09-06T14:0xZ

## GROUND

```
UTC            2026-09-06T13:08:42Z
origin/main    a65ab1d4            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ a65ab1d4     C:\ProjectOperations2   (was 1f9f9627; fast-forwarded 13:1xZ this run)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1) — MATCH
```

**SIGHTED.** Desktop Commander schemas were loaded with `ToolSearch` FIRST (keyword
`desktop-commander`, then `select:` by the ids that search reported), then `start_process` shell
`powershell.exe` → pid 34596, first attempt. The 11:16Z run was blind; the 12:08Z run and this one
are not.

**The device-bridge git guard was installed before any VM-side call**, as `station-contract v3`
now requires. `bash .../scripts/pipeline/vm-git-guard.sh` → exit 0, last line:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`.

🔴 **PREFLIGHT step 2 fired for real this run, and it is worth recording that the check is not
ceremonial.** The dev tree opened at `1f9f9627`, one commit behind `origin/main`, and
`git diff --numstat origin/main -- <the three binding docs>` was **NOT empty** — it returned
`2 15 docs/pipeline/stations/00-supervisor.md`. The working copy carried
`station-contract **v2**`; `origin/main` carries **v3**, whose new first step is the git-guard
install quoted above. `station_doc_version` reads `1` on both sides, exactly as the contract warns
— **a version match is not a freshness proof.** The full `origin/main` text of the differing region
was read from `git diff origin/main -- <path>` before acting, and the tree was then fast-forwarded.

`status-sweep.ps1` at 13:10:52Z: **§7 VERDICT — SAFE TO ACT.** Section 0 controls both PASS (`gh`
saw merged #1720; `node` runs). Re-run immediately before the board mutation — see WHAT CHANGED.

## WHAT I MEASURED

**COLLECT.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **CLEAN**, exit
0, `structure: 7 checked, 0 malformed`. No station SILENT: 00 `1.1h` · 03 `14.2h` (cadence 24h) ·
04 `3.1h` · 05 `23.0h`. ⚠️ The `00` row remains the weakest of the five — `check-breadcrumb.mjs`'s
own `CADENCE` map still reads `'00': 2` against a live cron of `5 * * * *`, so 00 cannot read
SILENT until three consecutive hourly runs are missed. Already recorded in STATION-CAPABILITIES §6;
cited, not re-raised. **No station breadcrumb has been written since the 12:08Z collect** other
than that run's own, so this run's COLLECT is over its predecessor alone; its dispositions are
carried below under WHAT I DID NOT DO.

**Board — 7 open, and it turned over hard in one hour.** [MEASURED] `gh pr list --state open
--json number,title,headRefName,mergeStateStatus,isDraft,labels,author,createdAt,files`, assigned
then counted (`@($rows).Count`, never `@(ConvertFrom-Json …).Count` — DOCTRINE §9.4). All 7 read
`BEHIND`, author `GH-Mantova`, **no labels on any of them**. Five were opened since the 12:08Z run
(#1716 at 12:2xZ, #1717 12:27Z, #1719 12:47Z, #1721 13:05:09Z, #1722 13:05:20Z) and five merged in
the same window (#1714, #1715, #1716, #1718, #1720). #1716 merged between the 13:10:52Z sweep and
the 13:2xZ board read, which is §7's `[LIVE]` rule in miniature.

| PR | created | checks at 13:2xZ | files |
|---|---|---|---|
| #1722 lint requires_merged gate | 13:05:20Z | 14 pass / 0 fail / 1 pending | 4 |
| #1721 CI rerun on unlabel | 13:05:09Z | 14 pass / 0 fail / 1 pending | 1 (`.github/workflows/ci.yml`) |
| #1719 ew-s2c alloc rejection | 12:47:32Z | 7 pass / 0 fail / 7 pending | 2 |
| #1717 watchdog inprog guard | 12:27:22Z | 5 pass / 0 fail / 9 pending | 2 |
| #1713 linefields s1 | 11:46:21Z | 14 pass / 0 fail / 1 pending | 12, incl. `prisma/migrations/` |
| #1709 tender-lifecycle bidStatus | 10:44:19Z | 4 pass / 0 fail / 10 pending | 6, incl. `prisma/migrations/` |
| #1699 rates value-column units | 08:44:40Z | 12 pass / **2 fail** / 1 pending | 3, incl. `prisma/migrations/` |

⚠️ **The first attempt at that table was a §7 instrument lie and is recorded because it very nearly
shipped.** Parsing `gh pr checks <n>` as text with a `^\s*pass` regex returned **`pass=0 fail=0
pending=0` for all seven** — a clean, coherent reading of a board that was entirely healthy or
entirely dead, indistinguishable. The tell was that every row was identical. Re-run as
`gh pr checks <n> --json name,state`, the totals are 14–15 checks per PR. **The negative result had
no positive control; the fix was to make the instrument produce a non-zero it could be judged by.**

**RULE 2 — the probe is LIVE, FRESH and silent on all seven.** [MEASURED] in the LIVE tree
`C:\ProjectOperations2\docs\pr-prompts\processed`; the `C:\po-watcher` decoy was not read.
**2003** logs · newest **13:13:52Z**, younger than every open PR — the control that separates the
live directory from the 17-day-stale clone copy · POSITIVE `marco.:true` (regex, no quote
character) → **617** · NEGATIVE, freshly minted `zzQq00Needle20260906T1325` → **0**. Per-PR over
`pr-*.log` only, excluding `rev-*` (§9.5): **#1722 · #1721 · #1719 · #1717 · #1713 · #1709 · #1699
→ 0 each**; negative control `PR #999999` → **0**.

**Which absence — the launch-log discriminator, with its positive control.** [MEASURED] over every
`*.log` under `C:\po-watcher` recursively: `opened PR #(1722|1721|1719|1717|1713|1709|1699)` →
**0**. POSITIVE control `opened PR #\d+` → **915** hits, newest four being #1692 (06:20:13Z),
#1698 (08:34:54Z), #1700 (08:56:57Z), #1707 (10:33:20Z). **The watcher opened none of the seven** —
they are SECOND LANE, not watcher PRs inside a waiting window and not crashed verdicts.

**Hand classification, `[NO LANE VERDICT — hand-classified]` for all seven** (§10.1 step 2, against
`classifyPolicyFiles`): #1713, #1709 and #1699 each carry a `(^|/)migrations/` path and are refused
on that clause alone. #1722 (`scripts/pipeline/lint-prompt.mjs`), #1721
(`.github/workflows/ci.yml`), #1719 (`allocation.service.ts`) and #1717
(`scripts/pr-watcher/supervise-watcher.ps1`) each carry a path matching none of the three
`NESTED_TEST_PATHS` forms. §10.1 step 3's station-lane exception does not reach any of them — none
is docs-only, and 00's lane is `docs/`. **All seven are MARCO'S. This station merged none.**

**#1699's two reds are still ONE cause.** `Approval receipt (CP-26)` and `PR gates — diff checks`
both FAILURE; the 12:08Z run read the job logs directly and found `RELEASED_NO_RECEIPT` taking the
diff-checks job down with it. Unchanged since 08:44Z. **No agent may author
`docs/decisions/merge-approvals/1699.md`**, so no station can clear it.

**Machinery — healthy, and the parent chain resolves.** [MEASURED] Sweep: watcher node **RUNNING
pid 27236**, heartbeat age **0 min**, `index.lock` False/False, 0 git processes, 0 in-progress
prompts. `ensure-watcher.log` `RELAUNCHED` lines end at **09:49:32Z** — none in the 3.5 h since, so
the 09:2x kill loop remains over. Armed = 2, and both are `rev-1721-ready.md` / `rev-1722-ready.md`,
auto-generated REVIEW JOBS (§9.5): **real armed count 0.**

⚠️ **A wrapper probe returned a false alarm this run and it was resolved, not reported.** The
command-line probe in the station doc §3b matches `supervise-watcher|watcher-launcher(-singlelane)?`
— it does **not** match `start-watcher.ps1`, which is what the live node's parent actually is. The
node reads `ppid=28392`, and 28392 appears in no wrapper list. Read alone that is the ENSURE-UP
fault condition. Resolving the parent chain instead (`Get-CimInstance Win32_Process -Filter
"ProcessId=28392"`; POSITIVE control pid 27236 → 1 row, NEGATIVE control pid 999991 → 0 rows) shows
`24952 watcher-launcher-singlelane.ps1 → 28392 start-watcher.ps1 → 27236 node`. **Fully supervised.**
This is the station doc's own warning — *"treat `wrapper=0` as a QUESTION, never as a verdict"* —
firing on a third launcher name, and it is the reason nothing was relaunched.

**Clone drift — F1 of the 12:08Z run is still live.** [MEASURED] read-only git in the clone:
`git -C C:\po-watcher\ProjectOperations rev-parse --short HEAD` → **`16ddb58b`** against
`origin/main` = **`a65ab1d4`**. That run's falsifying probe (*if it ever equals `origin/main`
without a human having FF'd it, the finding is dead*) **failed to fire**. The clone has not moved in
the hour since, and 03 — the only station that may move it — does not run until **23:00:45Z**.

**Wrapper leak — F2 of the 12:08Z run is unchanged.** [MEASURED] 7 launcher/supervisor processes by
command line (5 `watcher-launcher-singlelane.ps1`, 2 `supervise-watcher.ps1`), one node. Same count
as an hour ago; no growth, and no `RELAUNCHED` event to grow it.

**The `needs-marco` crash-loop file is an artefact of a closed incident.** [MEASURED]
`WATCHER-CRASH-LOOP-2026-09-06-200907.md`, 1391 B, mtime **10:09:07Z** — machine-written by
`supervise-watcher.ps1` during the 09:2x–09:5x kill loop (`watchdog-kill churn: 4 kills in 20 min`),
not a new escalation. Its filename timestamp is Brisbane local (`+10:00`), which is why it reads as
`2009`. The incident is over and its cause fix merged as #1712 — but #1712 is **undeployed** (clone
at `16ddb58b`), so the file is stale as an outage report and accurate as an exposure.

**The `>` redirection trap fired twice this run, exactly as §9.3 records.** Both
`status-sweep.ps1 *> file` and `gh pr list … > file` produced **UTF-16LE**; `JSON.parse` on the
second failed with `Unexpected token '\uFFFD'`. Both were recovered by reading `utf16le` in node.
Recorded only because §9.3 says the symptom is a doubled byte count and a failed parse, and here it
was a failed parse first.

## WHAT CHANGED

`status-sweep.ps1` was re-run immediately before the mutation (§7 `[LIVE]` expires); verdict
**SAFE TO ACT** both times. `git diff --cached --name-status` in the dev tree was **EMPTY** before
and after (§9.2, shared index), and `git diff --numstat` was **EMPTY** — Station 04's
`sweep-rotation.json` had already been swept in by the 12:08Z run, so there was nothing dirty to
carry.

- **Fast-forwarded the dev tree** `1f9f9627 → a65ab1d4` (13:1xZ). Read back: `git rev-parse --short
  HEAD` = `a65ab1d4`; `git rev-list --left-right --count HEAD...origin/main` = `0 0`;
  `git diff --numstat` EMPTY; `git diff --cached --name-status` EMPTY.
- **Installed the device-bridge git guard** (contract v3, first run under it). Exit 0.
- **Staged one new prompt**, `docs/pr-prompts/pr-triage-holds-open-pr-duplicate-bucket-HOLD.md` —
  see F1. 8173 bytes, no BOM (asserted by reading the raw Buffer, never a decoded string length —
  §9.3). `lint-prompt.mjs` → **`REJECT [GATE_NOT_RELEASED]`**, exit 1, which is the intended and
  correct state: it is chained on `SPENT_BEHIND_A_REJECT_V1`, so **it cannot itself become an
  armable duplicate**, and reaching the gate check proves its front matter parses.
- **Archived four fully-dispositioned breadcrumbs** into `docs/pr-prompts/archive/` (`git mv`, so
  they stay tracked and keep counting for `--freshness`, which matches by trailing path segment):
  the 0808, 0908, 0930 and 1008 supervisor runs. **The 1116 and 1208 supervisor breadcrumbs and
  04's 1010 breadcrumb were deliberately LEFT in the queue root** — 1208's F1/F2 are dispatched to
  03 and undelivered, and 04's F3 is deferred against a live trigger.
- **This breadcrumb**, written **inside this run's PR worktree** (`C:\po-wt\board-1308`), which is
  the station doc's cure 1: no loose untracked copy is left in the dev tree, so the post-merge
  fast-forward cannot be blocked by it.
- **Nothing else.** No prompt armed, disarmed, renamed or moved. No PR merged, labelled, unlabelled,
  closed or commented. No approval receipt authored. No `/sot/` edit. No process killed or started.
  No `git` write of any kind in `C:\po-watcher\ProjectOperations`. No `git checkout .` /
  `reset --hard` / `stash pop` / `clean` anywhere (§9.2). No Azure / Entra / SharePoint contact. No
  production data.
- Scratch only, outside the repo: `C:\po-sup-fix-scripts\sweep-1308.txt`, `sweep-1308-clean.txt`,
  `open-prs-1330.json`, `open-prs-1330-clean.json`.
- **Spent needles**, now unusable by any future run because this file is tracked:
  `zzQq00Needle20260906T1325`, `zzQq00Needle20260906T1338`.

## FINDINGS

### F1 — S1 — Six armable prompts duplicate six open second-lane PRs, and one of them is at PROMOTE

DOCTRINE §10.6 records that a second-lane PR does not consume the prompt describing the same work,
so the prompt sits in the queue with its premise alive and `triage-holds.ps1` files it under
**GATES SATISFIED — CANDIDATES**, which is exactly where an arming decision looks. It was measured
at **two** instances on 2026-09-05. The 09:08Z run today filed **one** (`#1699`).

**[MEASURED] 2026-09-06T13:3xZ at `a65ab1d4` it is SIX — and six of the seven open PRs.** Every
prompt's `scope:` list was parsed from its front matter in node and crossed against the open PRs'
file lists (`--state open` only; §10.6 records with controls that this test's false-positive rate
swamps it over merged PRs). 73 depth-1 prompts carry a `scope:` list; 7 open PRs were read.

| open PR | queue prompt | scope match | branch slug | linter |
|---|---|---|---|---|
| #1722 | `pr-lint-requires-merged-gate-unevaluated-HOLD.md` | 3 of 3 | `fix/lint-requires-merged-gate` | ADMIT |
| #1721 | `pr-ci-rerun-on-unlabel-HOLD.md` | 1 of 1 | `fix/ci-rerun-on-unlabel` | ADMIT |
| #1719 | `pr-ew-s2c-alloc-rejection-path-HOLD.md` | 2 of 2 | `feat/ew-s2c-alloc-rejection-path` | ADMIT |
| #1717 | `pr-watchdog-dead-inprog-guard-HOLD.md` | 1 of 1 | `fix/watchdog-dead-inprog-guard` | ADMIT |
| #1713 | `pr-linefields-s1-model-and-validation-HOLD.md` | 9 of 9 | `feat/linefields-s1-model-and-validation` | **PROMOTE** |
| #1699 | `pr-rates-value-column-units-HOLD.md` | 2 of 3 | `fix/rates-value-column-units` | ADMIT |

**Two independent instruments agree on all six** — the `scope:` cross-check, which is what the
prompt actually asserts, and the branch slug, which §10.6 correctly warns is only the other lane's
naming convention and not a property of the prompt. Agreement is what makes the classification
safe; neither alone would be.

🔴 **`PROMOTE` is the new and worse fact.** `pr-linefields-s1-…-HOLD.md` does not merely pass its
gates — `lint-prompt.mjs` returns `GATE_RELEASED: requires_on_main "…rate-step-evaluator.ts ::
CHARGE_STEP_PARITY_V1" is now on origin/main — HOLD is ready to promote.` That is the strongest arm
signal the linter emits, and it is pointing at work that has been open as **#1713 since 11:46Z**.
Previous instances were ADMIT, which reads as *eligible*; PROMOTE reads as *do this next*.

**The chain-sibling false positives ruled themselves out, which is the load-bearing detail for the
fix.** `pr-linefields-s2-…-HOLD.md` (2 of 2) and `pr-linefields-s3-…-HOLD.md` (3 of 5) also matched
#1713's file list, because later slices of a chain naturally touch the same files — but both
`REJECT [GATE_NOT_RELEASED]`. **So computing the duplicate bucket only over prompts the linter
already admits keeps chain siblings out of it for free.**

**Why it is S1.** A second actor arms this queue concurrently (`actor=marco-delegated` in
`.arming-log.txt`, enforced by nothing), the second lane is currently opening PRs faster than one
an hour, and the board already holds seven PRs that only Marco can merge. An arm on any of these
six puts a duplicate PR on that board. The count is 1 → 6 in four hours and it scales with
second-lane throughput, not with queue depth.

**Falsifying probe:** re-run the scan — parse `scope:` from each depth-1 prompt, cross against
`gh pr list --state open --json number,files`, and lint only the matches. If the six stop matching
because their PRs merged and the premises died, this instance is discharged; the mechanism is not.

**RULE 1, the two tests, options in order.**

- **(a) COMPLETE AND ADDITIVE — a duplicate bucket in `triage-holds.ps1`.** Passes both halves:
  it fixes every future instance at the place the arming decision is actually made, and it mutates
  nothing — the prompts stay on disk, fully recoverable if a PR is closed unmerged. **STAGED this
  run** as `pr-triage-holds-open-pr-duplicate-bucket-HOLD.md`, chained on the existing
  `SPENT_BEHIND_A_REJECT_V1` prompt so the two edits to that one script cannot collide.
- **(b) Rename or mark the six as never-arm.** Fails the *future data* half. If a PR closes
  unmerged the work must be re-armable, and `<!-- watcher: do-not-arm -->` is a permanent marker for
  a temporary condition. **Rejected; nothing was renamed or marked.**
- **(c) Record it and rely on the manual §10.6 step.** Fails the *complete* half — that step is
  already prescribed in DOCTRINE and has now failed to prevent six accumulating, because it lives
  in a document rather than in the instrument.

⚠️ **Stated plainly: (a) does not protect the next hour.** It is chained behind another prompt and
neither is armed. Between now and then the only protection is that this breadcrumb says so, and the
standing arming rule already says *ask first whether to arm at all*. There is no immediate
mechanical guard I can land safely — (b) is the only immediate one and it fails RULE 1.

**DISPOSITION: ACTIONED** — measured with controls, both false-positive classes ruled out, and the
complete-and-additive cure staged in this PR. The six prompts were left exactly as they are.

### F2 — S2 — The wrapper probe in this station's own doc misses `start-watcher.ps1`, the third launcher name

Measured above. The node's parent is `start-watcher.ps1`, which the §3b probe's alternation
(`supervise-watcher|watcher-launcher(-singlelane)?`) does not match — so the probe reports the
node's own parent as absent while the chain is three deep and healthy.

The station doc already anticipates this in prose: *"that is a patch on a vocabulary, and the
2026-08-29 entry it replaces was the same patch on the same vocabulary one launcher name earlier."*
**This is the next launcher name.** The doc's cure — resolve the parent chain and cross it against
`restart-watcher-if-wedged.ps1` — worked exactly as written and is why nothing was relaunched.

**DISPOSITION: DEFERRED.** What would make it urgent: a run that reads `wrapper=0` and relaunches
on it. Adding `start-watcher` to the alternation is one more patch on the same vocabulary and would
make the doc read as though the probe is now reliable, which is the failure mode the doc itself
names. The right change is to replace the probe with the parent-chain walk that already supersedes
it — a station-doc edit inside a hash-gated canonical region's neighbourhood, and more than a
collect run should carry unreviewed. Left for a run that can give it a prompt of its own.

### F3 — S2 — The clone is still at `16ddb58b` and 03 is ten hours away

The 12:08Z run's F1 dispatched the clone fast-forward and restart to Station 03. Re-measured this
run: clone `16ddb58b`, `origin/main` `a65ab1d4`. **Nothing in the launch path advances the clone**,
which that run established from source, so #1712 (`WATCHDOG_RESTART_GRACE_V1`) and #1704
(`VERDICT_HOME_RESOLVER_V1`) remain inert. #1717, now open, is a **third** `supervise-watcher.ps1`
change heading for the same undeployed file.

**DISPOSITION: DISPATCHED → Station 03 (Machine Minder)** — re-affirmed, not re-raised. The work
is unchanged and already specified in the 12:08Z breadcrumb, which is deliberately left in the
queue root for that reason. **03's next run is `2026-09-06T23:00:45Z`**, so the dispatch has now
been waiting an hour and will wait ten more. That is the fourth measured cost of the open
03-cadence escalation (bootstrap 4 h vs live cron daily) and of the open "who may FF the watcher
clone" question; **cited, not re-raised.**

### F4 — S3 — `packed-refs` is still stale, unchanged

[MEASURED] `.git/packed-refs` still reads `refs/heads/main 4ea28d6d` / `refs/remotes/origin/main
66194af6` while the loose refs read `a65ab1d4`. Nothing this run read a ref through `packed-refs`;
every value came from `git rev-parse`, which prefers the loose ref.

**DISPOSITION: DEFERRED**, unchanged from the 11:16Z and 12:08Z runs. What would make it urgent:
any tool that resolves `origin/main` through `packed-refs`, which would silently read an August tree.

## WHAT I DID NOT DO

- **Did not merge anything.** All seven open PRs hand-classify as Marco's; three carry migrations.
  RULE 2 and §10.1 both bind, and an absent verdict is not a clearance — it was established as
  *second lane* by the launch-log discriminator with its positive control, not assumed.
- **Did not arm anything.** Deliberate, and for two reasons that compound: six of the currently
  armable prompts are duplicates of open PRs (F1), and the machine is still one node-exit away from
  the pre-#1712 kill logic until the clone is fast-forwarded (F3). The real armed count is 0; the
  two `-ready.md` files on disk are watcher-generated review jobs.
- **Did not rename, mark or otherwise disarm the six duplicate prompts.** RULE 1 option (b),
  rejected in F1 — it would damage recoverability if any of those PRs closes unmerged.
- **Did not apply or remove a label, and did not write a `merge-approvals/<N>.md` receipt** for
  #1699 or any other PR. Only Marco removes `do-not-merge`; no agent authors an approval file.
- **Did not `git`-write in `C:\po-watcher\ProjectOperations`.** Absolute hard stop; read-only
  `rev-parse` only. This is precisely what blocks F3 and is why it stays with 03.
- **Did not restart the watcher and did not kill any wrapper.** Node running, heartbeat 0 min, real
  armed count 0, parent chain resolved — the sanctioned verdict is healthy, and 00's fix set covers
  WEDGED/DOWN only. A restart would deploy nothing (F3) while re-entering the undeployed kill path.
- **Did not clear the `WATCHER-CRASH-LOOP-2026-09-06-200907.md` escalation.** Its incident is
  closed but its cause is undeployed, and clearing it would remove the only durable record Marco
  has of the loop. Discharging dead `needs-marco/` files was already dispatched to 03 (move to
  `needs-marco/discharged/`, never delete).
- **Did not clear any `[STALE]` line** in the sweep's §5 — including the sixteen against
  `agent-authored-rule-2-clearance-2026-09-04.md`, which no agent may clear.
- **Did not touch `/sot/`** (05's lane), and **did not touch `C:\po-vg`**, the orphaned worktree
  holding 1 uncommitted file (age 3197 min), which is named in an existing `needs-marco` file and
  is 03's.
- **Did not archive the 1116 or 1208 supervisor breadcrumbs or 04's 1010 breadcrumb** — their
  dispatches and deferrals are still live and the queue root is where 03 and 04 will look.
- **Did not re-file** the unlabelled-second-lane, CP-26-armed-by-labelling, #1699-receipt,
  duplicate-PR, 03-cadence, who-may-FF-the-clone or `check-breadcrumb` `CADENCE` findings. All are
  on file; this run cites them.
- No Azure / Entra / SharePoint contact of any kind.

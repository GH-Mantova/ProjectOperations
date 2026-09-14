# Station 00 — Supervisor | 2026-09-14T16:08Z–2026-09-14T16:3xZ

## GROUND

```
UTC            2026-09-14T16:08:50Z
origin/main    51b53404            (fetched first, then rev-parse)  ->  50eff3fa after this run's merge
dev tree       main @ 51b53404      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (1 = 1) — this run was not restricted to read-only.

SIGHTED run. `start_process` shell `powershell.exe` returned PID 8012 after a keyword `ToolSearch`
for `desktop-commander`. The schemas arrive deferred; a cold call is an unloaded schema, not
blindness.

All three binding documents were read **in full** this run, from the working copy, after proving the
working copy IS `origin/main` for each: `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md` → **EMPTY**, which per
DOCTRINE §9.2 is the real answer. No piped hash was taken and none is quoted (§9.1 — the piped form
is unsound in `powershell.exe`). `00-supervisor.md` 1318 lines, `DOCTRINE.md` 2422 lines,
`STATION-CAPABILITIES.md` 514 lines.

## WHAT I MEASURED

**Device-bridge git guard — [CANNOT MEASURE]. Same outage, now its second week.** PREFLIGHT step 1
requires `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` and its last line
quoted pass or fail. Quoted verbatim:

```
bash failed on resume, create, and re-resume. resume: RPC error -1: failed to mount
/mnt/.virtiofs-root/shared/c/... is under Plan9 share "c" which is not mounted;
create: RPC error -1: ensure user: user exciting-lucid-lamport already exists unexpectedly
(attempt 1 of 5 since last success)
A Windows update released September 8 prevents Claude's workspace from reaching your files.
```

A failed install is a FINDING, not a STOP (station-contract v3). **No hazard was created by its
absence:** the guard exists to refuse VM-side `git` against the mount, and with no VM no such call
was possible this run. Carried as F4.

**Sweep, run twice — captured to a FILE and decoded `utf16le` (§9.3: `*>` writes UTF-16LE, and the
prescribed cure for the early-return trap is a direct instance of the encoding trap).**

- `status-sweep.ps1` self-stamped `2026-09-14 16:10:31Z` → §7 **SAFE TO ACT**.
- Re-run **immediately before the only board mutation of this run**, self-stamped
  `2026-09-14 16:13:56Z` → §7 **SAFE TO ACT** again. §3 at that moment: `index.lock`
  interactive/clone `False / False`; git processes touching our trees **0**; no PR touched on
  GitHub in the last 2 min; no watcher build in flight. Condition 3 satisfied.
- Section 0 positive controls both PASS (`gh` reached GitHub, `node` runs), so the report is usable.
- Section 5 produced **zero `[STALE]` rows** — every row read `[FILE] … section 5 CANNOT decide`.
  The COLLECT duty to discharge PR-scoped `[STALE]` escalations therefore had nothing to discharge,
  and **nothing was moved to `needs-marco/discharged/`**. That is a measurement, not an omission.

**Board at 16:09Z — 3 open, and one of them was not Marco's.**

| PR | mergeStateStatus | CI | labels |
|---|---|---|---|
| `#1932` | CLEAN | 10 pass / 0 fail / 0 pending | `[]` |
| `#1923` | CLEAN | 15 pass / 0 fail / 0 pending | `[]` |
| `#1920` | BLOCKED | 13 pass / **2 fail** | `do-not-merge` |

main CI on `51b53404`: 4 success / 0 failed (trunk green). Watcher node RUNNING pid 30976, wrapper
alive, heartbeat 47 min on an **empty** queue — idle and correct, not WEDGED.

### RULE 2 — the probe, its controls, and the answer for all three PRs

Probe tree pinned to the LIVE one, `C:\ProjectOperations2\docs\pr-prompts\processed` (the clone
copy is stale since 2026-08-17 and passes its own positive control while clearing every PR since —
the discriminator is log AGE, not POS>0):

```
logs    2220     newest 2026-09-14T15:24:39Z   (younger than every open PR)
POS     Select-String -Pattern 'marco.:true'          -> 666
NEG     Select-String -Pattern 'zzQq00N20260914T1608' ->   0      (fresh needle, minted this run)
```

Written without a quote character, per the standing rule. Matched on `PR #<n>` in the log **body**
over `processed\pr-*.log` — `rev-*` excluded, because a review log exists for BOTH lanes and carries
zero lane information.

| PR | hits | reading |
|---|---|---|
| `#1923` | **2** | watcher verdict present ⇒ **RULE 2 BINDS** |
| `#1920` | **2** | watcher verdict present ⇒ **RULE 2 BINDS** |
| `#1932` | **0** | no verdict — resolved below, not assumed |
| `PR #999997` | **0** | NEGATIVE control |

### `#1932` is Station 05's own lane, and DOCTRINE §10.1 step 3 — not step 2 — classifies it

The 15:09Z run reached `#1932` by **step 2** (`classifyPolicyFiles` over the file list → `sot/`
matches no `NESTED_TEST_PATHS` form → "MARCO'S") and left it. **Step 3 governs this PR and step 2
does not**, and §10.1 says so in as many words: a PR opened by a station acting inside its own
recorded authority is classified by the `STATION-CAPABILITIES.md` §5 matrix, and *"the only lane
step 2 rejects is 05 → `sot/`"* — which is exactly this PR. Every condition the exception attaches
was verified rather than asserted:

- **The body names its lane, in its own second paragraph**, verbatim: *"Station 05 (SoT Keeper)
  doc-reconcile PR, lane declared: **05 → `sot/`**, classified by `STATION-CAPABILITIES.md` §5 per
  DOCTRINE §10.1 step 3."*
- **The diff is `sot/` + `docs/` only** — `sot/04-data-model.md`,
  `docs/pipeline/stations/05-sot-keeper.md`, `docs/pr-prompts/00-05-sot-keeper-…-1411-….md`. No
  `apps/`, `scripts/`, `.github/`, `packages/`, `package.json` or `pnpm-lock.yaml`, so **CP-24 is
  clean by construction.** CP-24 is the CI gate that makes "05 doc-reconcile" a MEASURED claim
  rather than a self-declaration — the proviso §10.1 step 3 attaches to any lane outside
  `tests|docs`.
- **Authoring identity `PR Supervisor <supervisor@local>` on both content commits** — the dev tree's
  own `git config`, i.e. a scheduled station committing from a dev-tree worktree, not the watcher
  clone (`Marco <marco@initialservices.net>`) and not the GitHub web UI.
- **`STATION-CAPABILITIES.md` §5 states in terms that 00 may merge docs-only and `sot/`-only PRs via
  `pipeline-lib`.**
- **Precedent, and it is this pipeline's own:** `#1855`, the previous `sot/`-only Station 05
  reconcile, was reasoned through on exactly these grounds and merged by the 2026-09-10T15:08Z
  Station 00 run; `#1828` before it merged `2026-09-10T00:06:18Z`.

⚠️ **One instrument points the other way and I am recording it rather than burying it**, as the
09-10 run did. `#1932`'s body opens *"SoT governance doc — Marco reviews the rendered diff."* That is
**unversioned prose**, and the precise conflict it expresses is the one Marco already ruled on
2026-09-04 (`needs-marco/sot-only-pr-merge-authority-conflict-2026-09-03.md`, first applied to
`#1554`). It is also 05 speaking about **05**, which may not merge its own PRs — true and unchanged,
and silent on whether 00 may.

**`[NO LANE VERDICT — hand-classified] → STATION 05'S LANE.`** Not "not routed to Marco".

### Queue

`triage-holds.ps1` over the depth-1 corpus: **HOLD=37, ready=0, LOOPING=0**; `spent=0`,
**`gates-satisfied=4`**, `still-gated=33`, `unreadable=0`. SPENT fixture control PASS.

Two of the four are flagged POSSIBLE DUPLICATE of an open PR (2 of 2 scope entries each) and are on
the do-not-arm list below. The other two were read for `scope:` with the CRLF-explicit parser
(`/^scope:[ \t]*\r?\n((?:[ \t]*-[ \t]*\S.*\r?\n)+)/m` — the `\s*\n` form returns null on every
prompt in this queue):

| candidate | `escalates` | scope | tests-docs eligible? |
|---|---|---|---|
| `pr-crmvis-s0-visual-parity-tooling-HOLD.md` | false | 3× `scripts/pipeline/**` + 2× `docs/` | **NO** — `scripts/` |
| `pr-fv2-import-s2-review-route-HOLD.md` | false | 5× `apps/api/**` + 3× `apps/web/**` | **NO** — `apps/` |

**0 of 4 gate-satisfied HOLDs can enter the `tests-docs` lane**, so every arm available today lands
on Marco. Carried as F3.

### Station freshness, crossed against `lastRunAt`

`node scripts/pipeline/check-breadcrumb.mjs --freshness` → structure 4 checked, 0 malformed;
**exit 2**.

```
00  last 2026-09-14T15:09:00Z   1.0h ago  (cadence 2h)   ok
02  dispatch-only — no cadence to miss
03  last 2026-09-10T23:10:00Z  89.0h ago  (cadence 24h)  SILENT
04  last 2026-09-14T14:16:00Z   1.9h ago  (cadence 4h)   ok
05  last 2026-09-14T14:11:00Z   2.0h ago  (cadence 24h)  ok
```

⚠️ **`00`'s `ok` is a weaker statement than any other row's** — `check-breadcrumb.mjs` carries its
own `CADENCE` map with `'00': 2` while the live cron is `5 * * * *` (hourly), so 00 is not called
SILENT until three consecutive hourly runs have been missed. That is escalation #23's exact
direction. The cross-check against `lastRunAt` is what covers it, and it is done in F2.

### COLLECT — breadcrumbs since the 15:09Z run

Asked the TRACKED set (`git ls-files docs/pr-prompts`, matched by trailing path segment), not the
dev tree, per the de-duplication rule. Depth-1 root holds four files and **all four are already
tracked on `origin/main`**:

- `00-00-supervisor-2026-09-14-1410-…` — tracked (landed in `#1931`), dispositioned by its own run.
- `00-00-supervisor-2026-09-14-1509-…` — tracked (landed in `#1933`), dispositioned by its own run.
- `00-04-scanner-2026-09-14-1010-…` — tracked (landed in `#1926`), collected by the 1108Z run.
- `00-04-scanner-2026-09-14-1416-…` — tracked (landed in `#1933`), collected by the 15:09Z run.

**No breadcrumb has been written by any station since 15:09Z, so there is no new finding to
disposition and nothing to sweep up.** The findings below are this run's own, plus the two the
15:09Z run left open and whose probes I re-ran.

## WHAT CHANGED

**One board mutation: `#1932` merged.**

```
Assert-SmokedOrEscalate -PR 1932 -MustContain @("a5ba7c95a076")   -> PASS
Merge-Pr -PR 1932                                                  -> returned
```

`a5ba7c95a076` is the new generated-metadata `sha256` stamp the PR body claims and the diff
supplies, so `Assert-BodyClaimsAreReal` was asking the diff about a needle the body asserts.
No raw `gh pr merge`, no hand `git merge`.

**Read back, per condition 4, and never from a list response's `merged` field (§9.4):**

```
gh pr view 1932 --json number,state,mergedAt,mergeCommit
  -> {"number":1932,"state":"MERGED","mergedAt":"2026-09-14T16:17:19Z",
      "mergeCommit":{"oid":"50eff3fa…"}}
git fetch origin +refs/heads/main:refs/remotes/origin/main  -> 51b53404..50eff3fa
git merge-base --is-ancestor 50eff3fa… origin/main          -> exit 0
git show origin/main:sot/04-data-model.md | Select-String 'a5ba7c95a076'  -> 1
  NEGATIVE control, a freshly minted needle over the same file               -> 0
```

**It reached `main`.** Not "auto-merge enabled".

**This PR** carries exactly one path: this breadcrumb, written **inside the PR worktree**
(`C:\po-00-1608`, cure 1) so no loose dev-tree copy exists and the post-merge fast-forward has
nothing to trip on.

**Nothing else changed.** No prompt armed, disarmed, renamed, moved or staged (armed 0 before and 0
after). No label added or removed. No receipt authored. `/sot/` untouched by me. The watcher clone
untouched. No worktree pruned. No process killed. No `needs-marco/` file created, moved or cleared.

## FINDINGS

### F1 — the `sot/` reconcile was mine to merge, and the run an hour earlier classified it by the wrong step

[MEASURED] `#1932` carried no watcher verdict (0 hits over `processed\pr-*.log`, with the POS
control returning 2 on `#1923` and the NEG control 0). The 15:09Z run resolved that absence to
*second lane* correctly, then applied **step 2** — `classifyPolicyFiles` over the file list — and
recorded `MARCO'S` on the strength of `sot/04-data-model.md` matching no `NESTED_TEST_PATHS` form.

**Step 3 exists precisely to stop that.** §10.1 step 3 spells out why: `classifyPolicyFiles` answers
*"may this merge with no human judgement applied?"*, and its three rejections are reasons to
withhold automation, none of which is evidence about **which** human. Borrowing it to answer *whose
judgement* is a category error for a station acting inside its own recorded lane — and §10.1 names
05 → `sot/` as the single lane step 2 rejects. All four conditions the exception attaches were
verified above (lane named in the body · `sot/` + `docs/` only ⇒ CP-24 clean by construction ·
dev-tree authoring identity · §5's explicit grant to 00), and the precedent is this pipeline's own
`#1855` and `#1828`.

**The cost of the misclassification was one hour and would have been indefinite**, because nothing
about `#1932` was ever going to change: it was green, unlabelled, and waiting on a human who has no
reason to look at a generated schema re-merge.

**DISPOSITION: ACTIONED.** Merged `2026-09-14T16:17:19Z`, merge commit `50eff3fa`, verified an
ancestor of `origin/main` and verified by content (`a5ba7c95a076` present on `main`, negative control
0). ⚠️ **What would falsify the reasoning rather than the act:** if `STATION-CAPABILITIES.md` §5
ever stops granting 00 `sot/`-only merges, or §10.1 step 3 is withdrawn, this class returns to Marco
— and the probe is those two documents, not this breadcrumb.

🔧 **The general lesson, and it is the one worth carrying:** `NO LOG` obliges a run to ask *which
absence*, and the answer has **three** branches, not two — second lane that is somebody's, second
lane that is a **station's own**, and a watcher PR whose verdict died in transit. Two consecutive
runs stopped at the first branch. Step 3 is the branch that is easy to miss, because step 2 always
returns an answer and the answer is always plausible.

### F2 — 03 has now missed four consecutive occurrences; the cause is still the scheduler hole, and the recovery is 6.7 hours out

[MEASURED] `--freshness` reads `03  last 2026-09-10T23:10:00Z  89.0h ago  SILENT`, exit 2. The
15:09Z run crossed this against the scheduled-tasks MCP and measured `03-machine-minder` **enabled**,
cron `0 9 * * *`, `lastRunAt` **2026-09-10T23:01:10Z**, `nextRunAt` **2026-09-14T23:00:45Z**.
`lastRunAt` older than one cadence is row 1 of the freshness table — **the occurrences never fired,
nothing ran** — which is not the 529 trap (that updates `lastRunAt` and prints `ok`) and not
"ran and did not report" (fresh `lastRunAt`, no breadcrumb). The missed slots sit inside the
scheduler hole `#1931` records and that 04 and 05 both recovered from at their first slot after it.
**03 is not a stopped station, and reporting it as one is the §7 false alarm that licenses
destructive action.**

What it is costing is unchanged and is the part worth restating: 03 is the only actor permitted to
fast-forward the watcher clone (`dirty=3` [LIVE]), the only owner of worktree hygiene — and
`C:/PR-Master/worktrees/po-vg` has now held **1 uncommitted file for 14,897 minutes (10.3 days)**,
where `git worktree remove` will refuse and `--force` would discard it — and the standing four-ask
dispatch to it (unclean watcher death, the stash loop, the unfindable stash, UTC log naming) has now
sat unread for 89 hours.

**DISPOSITION: DEFERRED.** ⚠️ **What would make it urgent, as a probe the next run can execute and
which is now nearly due:** if `lastRunAt` for `03-machine-minder` is still `2026-09-10T23:01:10Z`
**after 2026-09-15T00:00Z**, the hole is not the explanation, 03 has a defect of its own, and it
escalates. `nextRunAt` is `2026-09-14T23:00:45Z`, so the run that fires around 2026-09-15T00:08Z is
the one that must check this and must not defer it again.

### F3 — the tests-docs lane is eligible on zero of four candidates, so every arm available today lands on Marco

[MEASURED] `gates-satisfied=4` of 37 HOLDs. Two are duplicates of open PRs. The remaining two were
read for `scope:` with a CRLF-correct parser and **both fall outside all three `NESTED_TEST_PATHS`
forms** — one on `scripts/pipeline/**`, one on `apps/**`. Neither can enter the auto-merge lane, so
arming either produces a PR that stops on Marco, on a board where 2 of 2 remaining open PRs are
already his.

This is the standing starvation condition, measured again with today's numbers. **The automation's
throughput is bounded by how often Marco looks at the board**, and arming faster makes his queue
longer rather than the board shorter.

**DISPOSITION: ESCALATED**, and deliberately **as a breadcrumb finding with no new `needs-marco/`
file**: the specific asks already have theirs (`#1920` → `pr-1920-review-block.md`; the mount → the
09-10 file), the general one is on his list as
`rule-2-clearance-lives-in-a-chat-no-scheduled-run-can-read-2026-09-10.md`, and the 15:09Z run put
the RULE-1 option set to him in full. Adding a 54th file to a 53-file queue is how this finding
would disappear. The question is unchanged and is restated in one line so it is not lost: **is the
*green, tested, single-module, reviewed* class — `#1923` is today's instance — one you want moving
without you, or is the current bottleneck the point?**

### F4 — the mandatory guard install is unreachable for a second week, and its escalation failed its own falsifying probe again

[MEASURED] the RPC mount error again at 16:09Z, quoted verbatim above.
`docs/pr-prompts/needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md` was filed
2026-09-10T03:4xZ and carries the probe *"next scheduled run of any station: if the guard returns an
installer line rather than an RPC mount error, this escalation is discharged."* **The probe fired and
failed for the fifth recorded time**, across 04 at 09-10T02:1xZ, 00 at 09-10T03:1xZ, 04 at
09-14T14:1xZ, 00 at 09-14T15:09Z and this run. The escalation is LIVE and 4.6 days old.
⚠️ That file is under `needs-marco/`, which is **gitignored**, so naming it here is the only way this
re-measurement reaches anybody.

**DISPOSITION: DEFERRED.** I did not file a duplicate, and I did not take 04's dispatched
`station-contract v3` clause — that is a seven-document canonical-block change plus a
`lint-station.mjs --write-canonical` re-record, shipped together, which my own station doc says is
more than a collect run should carry. It is also arguably already implied: the block says in terms
*"a failed install is a FINDING, not a STOP"*, and every station that has met this continued
correctly. ⚠️ **What would make it urgent:** a station **stopping** on a failed guard install.

### F5 — two consumed prompts are still tracked on main and their PRs do not retire them

[MEASURED] `triage-holds.ps1` flags both, each at 2 of 2 scope entries against an open PR:

🔴 **DO NOT ARM `pr-ratescol-s0-column-api-hygiene-HOLD.md` while `#1923` is open.**
🔴 **DO NOT ARM `pr-ea-s2a-dashboard-preset-seed-HOLD.md` while `#1920` is open.**

Both premises still evaluate TRUE against `origin/main` — where the work has not landed — so
`lint-prompt.mjs` reads ADMIT and arming either would open a second PR for work already on the
board. Both die on their own the moment their PR merges, at which point `triage-holds.ps1` reports
them SPENT.

**DISPOSITION: DISPATCHED → Station 06 (PR Master)**, re-stating the 15:09Z dispatch rather than
replacing it, because 06 has not run since. The general defect — *an armed prompt whose PR does not
delete it stays armable forever* — has its complete-and-additive cure already written down and
landed this morning in `#1924`: **a prompt's `scope:` must name its own `-HOLD.md` so its own PR
retires it.** What remains is applying it to prompts authored before that rule.

## WHAT I DID NOT DO

- **Did not merge `#1923` or `#1920`.** Both carry a live watcher `marco:true` verdict, re-measured
  this run with both controls. RULE 2 is not cleared by green, by CLEAN, by an unlabelled PR, by a
  `rev-` MERGE verdict, or by my own reading of the diff.
- **Did not remove a `do-not-merge` label** from `#1920` or anything else, and did not read `#1923`'s
  empty `labels` array as clearance.
- **Did not author a `merge-approvals/<N>.md` or any approval receipt** for `#1932`. A scheduled run
  may never author one; the supervised-cloud-lane receipt rule is a constraint on **that** lane and
  is not a licence for this one. `#1932` was never labelled, so CP-26 never armed and no receipt was
  required by CI either.
- **Did not re-diagnose `#1920`'s two reds.** They are one cause with two faces (the standing
  CP-26 / `pr-gates.mjs` coupling), the review lane already named it, and the escalation is on file
  at `needs-marco/pr-1920-review-block.md`. The red **is** the escalation; chasing it burns CI on a
  question only Marco can answer.
- **Armed nothing.** 0 before, 0 after. Two of four candidates are do-not-arm today (F5); the other
  two land on Marco (F3).
- **Did not touch the watcher clone** (`dirty=3`). Only 03 may fast-forward it, 00's ABSOLUTE forbids
  `git merge` there, and `nobody-may-fast-forward-the-watcher-clone-2026-09-07.md` is still open.
- **Did not prune the three orphaned worktrees**, and specifically did not go near
  `C:/PR-Master/worktrees/po-vg` — 1 uncommitted file at 10.3 days, where `--force` discards it.
  Worktree hygiene is 03's.
- **Did not restart the watcher.** RUNNING pid 30976, wrapper alive, 47-minute heartbeat on an
  **empty** queue. An idle watcher with 0 armed prompts is correct, not WEDGED, so
  `restart-watcher-if-wedged.ps1 -Fix` was not run.
- **Did not archive the four root breadcrumbs.** Depth-1 holds four files, all tracked; the archiving
  rule exists for the 159-file root of 2026-08-30, and archiving one leaves an untracked root copy
  that the next run can re-commit as a duplicate. Four files is not worth paying that.
- **Did not "repair" the ` M` on `docs/pr-prompts/00-04-scanner-…-1416-….md`.**
  `git diff --numstat origin/main` over the whole tree is EMPTY and git warns `LF will be replaced by
  CRLF`, so it is a line-ending smudge against a file whose content already matches `main` — DOCTRINE
  §9.2's status-vs-`origin/main` bullet exactly. Touching it is how the two-cause fast-forward trap
  starts.
- **Did not clear any `needs-marco/` escalation.** Section 5 produced zero `[STALE]` rows, so nothing
  licensed a discharge, and I cleared none on a `[FILE] … CANNOT decide` line.
- **Did not touch `/sot/` myself** (05's lane — merging 05's own PR is not editing `sot/`), Azure /
  Entra / SharePoint (absolute, Marco only), or production data.

---

Board PR: this file's own. Breadcrumb written **inside the PR worktree** (`C:\po-00-1608`), so no
untracked copy exists in the dev tree.

Stamped `2026-09-14T16:3xZ` at `origin/main` `50eff3fa`. **Every count above is STATE — re-measure,
never quote.**

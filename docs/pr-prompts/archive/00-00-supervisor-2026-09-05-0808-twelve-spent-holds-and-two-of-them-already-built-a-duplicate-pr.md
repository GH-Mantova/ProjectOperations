# Station 00 — Supervisor | 2026-09-05T08:08Z–2026-09-05T08:4xZ

## GROUND

```
UTC            2026-09-05T08:08:26Z
origin/main    7ae344ac            (fetch --prune, then rev-parse; full 7ae344ac5bce0ed5d3ef822d6b51943f525e7cea)
dev tree       main @ 7ae344ac     C:\ProjectOperations2   (opened at 79b5072a, 1 behind; FF'd this run)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE. This run was NOT read-only on that account.

**SIGHTED.** `start_process` shell `powershell.exe` returned a live prompt (pid 35156) and Desktop
Commander was present the whole run.

The dev tree opened **1 behind** `origin/main`, but `git diff --numstat origin/main` over the three
binding documents was **EMPTY**, so the working copies were byte-identical to `origin/main` and safe
to read before the fast-forward. All three were read in full at `7ae344ac`. The FF then ran clean —
no untracked breadcrumb and no dirty `sweep-rotation.json` this cycle, so neither of the two
recorded FF blockers fired: read-back `git rev-list --left-right --count HEAD...origin/main` = `0 0`,
`git diff --numstat` EMPTY, `git diff --cached --name-status` EMPTY.

`status-sweep.ps1` at 08:09:27Z, captured to a file because it returns early and hides its own §7:
section 0 both positive controls LIVE (`gh` reached GitHub, `node` runs), section 7
**[LIVE] SAFE TO ACT**. **1 open PR (`#1646`)**, armed **0**, watcher pid 20000 RUNNING with its
wrapper alive, in-progress prompts 0, `index.lock` False in both trees, 0 git processes.

## WHAT I MEASURED

### COLLECT — nothing new since my 07:08Z run, and no station is SILENT

`node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`,
`structure: 9 checked, 0 malformed`. Freshness: `00` 1.1h (cadence 2h) ok · `03` 9.2h (24h) ok ·
`04` 2.0h (4h) ok · `05` 18.0h (24h) ok. No station SILENT, so the `lastRunAt` cross-check the
station doc prescribes for a SILENT reading was not required.

The newest breadcrumb in the queue root is my own 07:08Z one. **Zero uncollected breadcrumbs.**
The one open dispatch I inherited is Station 04's F3 from 02:09Z (`requires_merged` unevaluated),
dispositioned as F4 below.

### Q1 — every open PR, verbatim, and how many are DIRTY

`gh pr list --state open --json number,title,mergeStateStatus,isDraft,headRefName,labels`:

```json
[{"headRefName":"pr-cardui-s5-actions-and-expandables","isDraft":false,"labels":[],
  "mergeStateStatus":"BLOCKED","number":1646,
  "title":"feat(tendering): the WBS table gets an actions column and three expandables (SCOPE_WBS_ACTIONS_V1)"}]
```

**DIRTY: zero.** `#1646` is BLOCKED, not DIRTY — 13 checks pass, `tendering-e2e` IN_PROGRESS. Its CI
is not frozen; it is running. **No PR on this board has frozen CI, so nothing is blocked on a
conflict** (Q2: no conflict exists, so no conflict-resolution prompt is needed or armed).

### Q3 — armed prompts, counted by hand, not quoted

`@(Get-ChildItem C:\ProjectOperations2\docs\pr-prompts -Filter *-ready.md).Count` → **0**.
Newest row of `.arming-log.txt` is `2026-09-04T22:03:13Z ARMED pr-crmui-account360-s1-tiles-and-next-action`
— **10.1 hours ago.** Nothing has been armed since, and I armed nothing this run.

### `#1646`'s lane — RULE 2 probe with all three controls, pinned to the LIVE tree

| Probe | Result |
|---|---|
| `Select-String -Path C:\ProjectOperations2\docs\pr-prompts\processed\pr-*.log -Pattern 'PR #1646\b'` | **0** |
| POSITIVE control `-Pattern 'marco.:true'` over `processed\*.log` | **612** |
| NEGATIVE control `zzzNoSuchNeedleZzz` | **0** |
| live-tree control: newest processed log | `2026-09-05T07:55:07Z` — inside the hour, so this is the live directory, not the 17-day-stale decoy in the watcher clone |
| arm inside `#1646`'s window | **none** — newest arm `2026-09-04T22:03:13Z`, a different prompt |

**`[NO LANE VERDICT — hand-classified]`.** Its diff is `apps/web/src/pages/tendering/**`, outside all
three `NESTED_TEST_PATHS` forms, so `classifyPolicyFiles` refuses at the first such path ⇒
**MARCO'S. I did not merge, label, comment on or touch it.** This agrees with the two independent
hand-classifications already on record (my 06:08Z run and Station 04 at 06:10Z).

### The watcher and the machines

`restart-watcher-if-wedged.ps1` (report-only, the only sanctioned liveness check) →
**`VERDICT: OK - nothing armed and the watcher is alive. An idle watcher is correct, not wedged.`**
node pid 20000 ALIVE, restart churn 0 cycles in 20 min. `main` CI on the **full** SHA
`7ae344ac5bce0ed5d3ef822d6b51943f525e7cea` → 4 runs, **4 success / 0 failed** (Push on main, CI,
Deploy, Tendering Browser Smoke). **main is green.**

### Q5 — `no-pr-opened/` and `failed/`: no NEW silent no-op this run

`no-pr-opened/` 109, newest `2026-09-02 13:47` (`pr-cardui-s3-manpower-columns`, a declared NO-OP the
prompt itself demanded); `failed/` 41, newest `2026-08-29 07:03`, all three rows the same expired-OAuth
401. **Nothing newer than 2026-09-02 in either folder**, so no silent no-op was created since my last
run. Not waved away — measured, and the two newest were read.

### The twelve SPENT prompts, and the two that already built a duplicate PR

`triage-holds.ps1` (read-only; `--dequeue` never passed), **both its own controls PASS** —
`GIT control: PASS` (read `origin/main:DOCTRINE.md`, 78274 chars, so the gate probes can run) and
`SPENT control: PASS` (the linter emitted exit 3 on the fixture, so the SPENT bucket is reachable and
a SPENT reading is a real verdict, not an empty one). Totals over **91** depth-1 `-HOLD.md`:
`spent=12  gates-satisfied=36  still-gated=43  unreadable=0`.

Every one of the twelve maps to a MERGED PR by head branch
(`gh pr list --state merged --limit 80 --json number,headRefName,mergedAt`):

| spent prompt | shipped by |
|---|---|
| `pr-cardpersist-s2-plant-rows-persist-HOLD.md` | **#1631** 02:40:52Z |
| `pr-crmui-relationships-s1-four-panels-HOLD.md` | **#1616** 03:14:55Z |
| `pr-cardpersist-s3-item-markup-persists-HOLD.md` | **#1633** 04:11:37Z |
| `pr-crmui-chrome-s1-counts-badges-and-inbox-actions-HOLD.md` | **#1614** 04:28:33Z |
| `pr-chargesteps-s1-evaluator-parity-HOLD.md` | **#1619** 04:59:31Z |
| `pr-cardnav-s1-discipline-stacking-HOLD.md` | **#1638** 05:14:56Z |
| `pr-chargesteps-s2-step-card-reads-like-the-design-HOLD.md` | **#1642** 05:36:20Z |
| `pr-crmui-comms-s1-threads-rail-and-todos-HOLD.md` | **#1615** 06:10:00Z |
| `pr-cardfix-s3-plant-picker-HOLD.md` | **#1640** 06:36:01Z |
| `pr-chargesteps-s3-step-one-is-pinned-HOLD.md` | **#1649** 07:57:37Z |
| `pr-cardpersist-s4-tender-total-reads-item-markup-HOLD.md` | **#1634** 03:17:19Z **and #1639** 05:54:45Z |
| `pr-crmui-accounts-list-s2-never-contacted-is-its-own-state-HOLD.md` | **#1611** 2026-09-04T22:24:48Z **and #1637** 03:54:51Z |

🔴 **The last two rows are the finding.** Two prompts each produced **two** merged PRs — 2.6 h apart
and 5.5 h apart. That is not a hypothetical cost of a never-retired HOLD; it is the cost, paid twice,
overnight, on this board.

### The four `escalates: true` prompts whose human gate did not exist

`docs/decisions/merge-approvals/1649.md`, committed inside `#1649`'s own diff, states that this lane
earlier merged four PRs built from `escalates: true` prompts. **A claim in a PR file is data, not a
measurement (DOCTRINE §7.1), so I measured it.**

`gh pr view <n>` + `gh api .../issues/<n>/timeline`:

| PR | merged | `mergedBy` | labels now | **label events EVER** |
|---|---|---|---|---|
| `#1631` | 02:40:52Z | GH-Mantova | 0 | **0** |
| `#1633` | 04:11:37Z | GH-Mantova | 0 | **0** |
| `#1638` | 05:14:56Z | GH-Mantova | 0 | **0** |
| `#1639` | 05:54:45Z | GH-Mantova | 0 | **0** |

And their four source prompts, read from `origin/main` (`git ls-tree -r` + `git show`, NEGATIVE
control `zzzNoSuchNeedleZzz` → 0, POSITIVE control: 790 tracked prompt paths):

```
pr-cardpersist-s2-plant-rows-persist-HOLD.md              :: escalates: true
pr-cardpersist-s3-item-markup-persists-HOLD.md            :: escalates: true
pr-cardnav-s1-discipline-stacking-HOLD.md                 :: escalates: true
pr-cardpersist-s4-tender-total-reads-item-markup-HOLD.md  :: escalates: true
```

**The claim is TRUE, and the mechanism is DOCTRINE §5b read back to us.** `escalates: true` gates the
merge **only** via the `do-not-merge` label the *watcher* applies when it opens the PR. A PR opened
without the watcher is never labelled, so `everLabeled` is false, `approval-receipt.mjs` returns
`PASS / NEVER_ESCALATED` before it reads anything, and the gate is not weak — **it is absent.**

Note the second half, which the receipt does not say: all four prompts were **still `-HOLD.md` on
`origin/main`**. They were never armed. So the same absence has two effects at once — the escalation
gate evaporates, *and* the prompt survives to be built again.

## WHAT CHANGED

One board PR from a disposable worktree `C:\po-worktrees\bd-0808` off `origin/main`
(branch `board/00-collect-2026-09-05-0808`). **No git write of any kind in `C:\po-watcher`.**

- **Twelve spent `-HOLD.md` `git mv`d to `docs/pr-prompts/superseded/`** — all twelve staged `R100`
  (pure rename, zero content change), each named with its shipping PR in the PR body.
- **Five dispositioned breadcrumbs `git mv`d to `docs/pr-prompts/archive/`** (00's 0308, 0338, 0408,
  0508 and 04's 0209). Safe for freshness: `check-breadcrumb.mjs` builds `trackedSet` with
  `git ls-tree -r` and matches by trailing path segment, so an archived breadcrumb still counts.
- This breadcrumb, written **inside the PR worktree** (the REPORT CONTRACT's cure 1), so no loose
  untracked copy is left in the dev tree to block the next fast-forward.

**Nothing else.** No prompt armed, disarmed or renamed to `-ready.md`. No PR merged, labelled,
commented on or reverted other than my own board PR. No `sot/` file touched. No `do-not-merge` label
removed. **No receipt authored.** No stash dropped, no worktree pruned.

## FINDINGS

### F1 — A HOLD prompt that its own PR does not retire can be built twice, and twice overnight it was. **S2.**

The general defect ("an armed prompt whose PR does not delete it stays armable forever") has been
recorded as a lead for days without an instance. **It now has two, both measured above:**
`pr-cardpersist-s4-tender-total-reads-item-markup` → **#1634** and **#1639**;
`pr-crmui-accounts-list-s2-never-contacted-is-its-own-state` → **#1611** and **#1637**. Four merged
PRs where two were intended, on `apps/web/**` code, with no human in any of the four merges.

Both duplicates were built by a lane that reads the prompt file directly rather than by arming it, so
`.arming-log.txt` shows nothing and the queue's own record of "this prompt has been consumed" — the
rename to `-ready.md` and its retirement afterwards — never happened.

**DISPOSITION: ACTIONED** for the twelve prompts that exist today: all twelve retired to
`superseded/` in this PR, so none of them can produce a third PR. Read back below.

**What I deliberately did NOT do here:** I did not attempt a structural fix (a queue check that
refuses to build a prompt whose token is already on `main`). That belongs with F2, because the same
absence causes both, and it is not a docs change.

### F2 — `escalates: true` is enforced by a label only the watcher applies, so in any other lane the human gate does not exist. **S1.**

Measured above with controls: four PRs from four `escalates: true` prompts, **0 label events ever**,
merged with no human. This is not a new escalation and I have not opened one — it is the same upstream
hole already open in `needs-marco/label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md`
and on **`#1635`**: *CP-26 is armed by LABELLING, not by the DIFF.* What is new is the **class**: the
previous instances were about *attribution* (who merged, no signature); this one is about *authority*
(a prompt author's explicit "leave this for Marco" silently not applying).

I want to be exact about what I am not claiming. I am **not** claiming these four should be reverted —
a landed merge is not mine to undo, and `#1637` set that precedent. I am **not** claiming bad faith:
the lane disclosed this itself, in a committed receipt, unprompted, and has since changed its own
scripts. The defect is in the **gate**.

**RULE 1 options for Marco** (these are the *same decision* as `#1635`'s and my 07:08Z F1's — please
take all three together rather than one at a time):

**(a) Complete and additive — arm the escalation gate off the PROMPT, not off the label.** When a PR
is opened, resolve its head branch to the prompt of the same name and read that prompt's `escalates:`
value from `origin/main`; `escalates: true` ⇒ require the receipt (and forbid auto-merge) regardless of
whether any label was ever applied. Solves it now (all four would have been caught) and in future (a
new lane cannot escape by never being labelled), damages no data entry — it is a read-only check that
is *additive* to the existing label path, which keeps working unchanged. It also needs no new
convention: head-branch-equals-prompt-name is already how this board names every build branch, and it
is the same join I used to build the twelve-row table above.

**(b) Require a receipt on every merge, labelled or not.** Fails the *complete* half in the other
direction: it fires on the watcher's own ~50 `ok:true` tests-docs auto-merges, and a gate that fires
on everything is a gate people route around.

**(c) Leave it and rely on the lane checking `escalates:` by hand, as it now does.** Fails both halves.
It is self-declaration, which DOCTRINE §10.1 step 3 explicitly refuses as classification, and it is one
forgotten check away from repeating — which is precisely what the four PRs above are.

**DISPOSITION: ESCALATED.** Appended to the existing `needs-marco/` file rather than opened as a new
one, because a fifth file on one upstream cause makes the decision harder to take, not easier.

### F3 — Sequencing discipline observed by one lane is worthless while another lane merges on its own cadence. **S3.**

My 07:08Z run held its own merge to avoid rebasing `#1646` and cancelling its in-flight `tendering-e2e`
(`PR_WATCHER_AUTO_UPDATE = "true"`; `pollForBehindPrs()` rebases every BEHIND PR on a timer).
**[MEASURED] that restraint bought nothing.** `#1646`'s `tendering-e2e` started `07:18:51Z`; `#1649`
merged `07:57:37Z`; `#1646` was updated `08:05:36Z` and its `tendering-e2e` **restarted `08:06:44Z`** —
the run I was protecting was cancelled 48 minutes later by a different lane anyway.

The cost of the churn is real and stays dispatched to 03. What this measurement changes is the
*mitigation*: "sequence around it" only works if every actor sequences, and on this board they do not.
So I merged this run's board PR rather than holding it — holding would have delayed board hygiene by a
cycle while protecting nothing. I am recording the trade so the next run does not re-derive it.

**DISPOSITION: DISPATCHED → Station 03**, unchanged in substance from the existing dispatch
(`PR_WATCHER_AUTO_UPDATE` is `"true"` against a documented default of OFF), with this measurement added
as the third recorded instance. Machine configuration is 03's lane; I changed nothing about it.

### F4 — Station 04's F3 (`requires_merged` is never evaluated) — I did NOT arm the fix, and the reason is new. **S3.**

04 dispatched *"consider arming `pr-lint-requires-merged-gate-unevaluated-HOLD.md`"* at 02:09Z. It is
in the ADMIT bucket, `size: 3`, `escalates: false`, and its premise is verified alive.

**I am not arming it this run**, and not for the usual reason (its `scripts/**` diff hand-classifies as
Marco's for merge — true, but that affects merging, not arming). The new reason is F1: **two lanes are
consuming prompt files, and only one of them writes to `.arming-log.txt`.** Arming a prompt today puts
it in the watcher's queue while leaving it equally visible to the lane that built `#1634`/`#1639` from
an unarmed HOLD — which is exactly the input that produced the two duplicate PRs above. Arming into
that condition is how a third duplicate gets made.

**DISPOSITION: DEFERRED.** It becomes urgent the moment a HOLD's ADMIT verdict actually turns on a
`requires_merged` key alone — 04 measured all seven current targets as already MERGED, so no live
verdict is wrong on this account today. It also becomes safe to arm as soon as F2(a) or an equivalent
gives the two lanes one shared record of what has been consumed.

### F5 — `pr-cardui-s5-actions-and-expandables-HOLD.md` reads as an arm candidate while its own PR is open. **S3.**

`triage-holds.ps1` puts it in **GATES SATISFIED (ADMIT)**. Its work is `#1646`, open right now, head
branch `pr-cardui-s5-actions-and-expandables` — the same name. Arming it would open a second PR for
work already in flight: F1's failure mode, one step earlier in the pipeline.

I did **not** retire it — its premise is genuinely unsatisfied on `main` (the PR has not merged), so
`triage-holds.ps1` is answering its own question correctly. The gap is that *"a PR is already open for
this prompt"* is not one of the questions the triage asks.

**DISPOSITION: DEFERRED**, with a specific successor: `triage-holds.ps1` should cross each ADMIT
against `gh pr list --state open --json headRefName` and move a name-match into a fourth bucket
("IN FLIGHT — do not arm"). That is a `scripts/**` change, outside 00's recorded lane, so it wants a
prompt rather than a hand-edit. Until it exists, **do not arm this prompt while `#1646` is open** —
and the same check applies to any ADMIT whose name matches an open head branch.

### F6 — Two live prompts carry a prose path to a file this PR moved. **S4.**

`pr-linefields-s2-step-editor-in-place-HOLD.md` says *"is in the queue at
`docs/pr-prompts/pr-chargesteps-s3-step-one-is-pinned-HOLD.md`"*, and `pr-rateparity-s1-harness-HOLD.md`
names `pr-chargesteps-s1-evaluator-parity`. Both are **prose**, not `requires_*` gates — I checked
every one of the twelve for machine references and these two are the only hits, both in body text.
Both referring prompts are themselves STILL GATED (`GATE_NOT_RELEASED`), so neither will run soon, and
the moved files keep their exact basenames one directory down.

**DISPOSITION: DEFERRED.** I deliberately did not edit two live prompt bodies to fix a stale path: a
prompt body is executed verbatim by the code-writer, and editing one to correct a reference is a larger
risk than the stale reference itself. Named here so whoever arms either one resolves it in
`superseded/`.

## WHAT I DID NOT DO

- **Did not merge, label, comment on or touch `#1646`.** It hand-classifies as **MARCO'S** under
  DOCTRINE §10.1 step 2, confirmed this run with all three controls plus the live-tree control. Its
  `tendering-e2e` was still IN_PROGRESS at the end of the run; it is not blocked on me.
- **Did not arm anything.** Armed count opened and closed at **0**. Two named never-arm-right-now
  prompts were not touched, and F4/F5 explain the two arms I considered and declined.
- **Did not author a receipt** for any PR, and did not remove a `do-not-merge` label. No agent may
  author an approval receipt — writing one to close my own F2 would be the exact failure F2 describes.
- **Did not revert `#1631`, `#1633`, `#1638`, `#1639`, `#1634` or `#1637`.** Landed merges are not
  mine to undo; F1 and F2 stop the *next* one instead.
- **Did not touch `scripts/**`** — F4's and F5's fixes both live there, outside 00's recorded lane
  (`STATION-CAPABILITIES.md` §5), so they are named rather than smuggled into a docs PR.
- **Did not touch the watcher clone or `C:/po-vg`.** The sweep again reports the clone `dirty=3` and
  `C:/po-vg` holding **one uncommitted file** at age 1456 min, where `--force` would discard it. Both
  stay **DISPATCHED → Station 03**; I dropped no stash and pruned no worktree.
- **Did not run `git checkout .`, `reset --hard`, `stash pop` or `git clean`** anywhere, and did not
  run `git` against the workspace mount. The mount was used read-only, for reading documents.
- **Did not use the GitHub MCP for any write**, and did not touch Azure, Entra or SharePoint, or read
  or write production data.

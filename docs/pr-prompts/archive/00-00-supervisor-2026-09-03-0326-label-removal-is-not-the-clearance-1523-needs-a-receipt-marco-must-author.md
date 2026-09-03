# Station 00 — Supervisor | 2026-09-03T03:26Z–03:45Z

## GROUND

```
UTC            2026-09-03T03:26:56Z
origin/main    34cb51bd            (fetched 03:28Z, then rev-parse)
dev tree       main @ 34cb51bd     C:\ProjectOperations2
doc version    1
bootstrap      1                   (match — full authority this run)
```

SIGHTED run. `start_process` powershell.exe returned PID 16268 at 03:26Z first try.
Working copy of all three binding docs verified **byte-identical to `origin/main`**
(`git diff --stat origin/main -- docs/pipeline/...` empty), so reading the working copy
this run is equivalent to `git show origin/main:` — recorded because the contract
requires the origin read and this is how the equivalence was established, not assumed.

⚠️ **CONCURRENCY.** A sibling Station 00 run wrote
`00-00-supervisor-2026-09-03-0325-addendum-...md` at 03:21Z — five minutes before this run
started. This run therefore did **not** re-derive its #1523 e2e diagnosis and did not
re-touch the board it had just mutated. New ground only.

## WHAT I MEASURED

**Board — one PR open.** [MEASURED] `node scripts/pipeline/tmp-00-board-read.mjs` (gh `--json`
read in node, DOCTRINE §9.4 — a `--jq` attempt through the PowerShell layer died on quote
mangling and killed the shell, which is §9.4 reproducing itself):

```
OPEN PRs: 1
#1523 BLOCKED draft=false by=GH-Mantova [-] feat/scope-wbs-plant-columns
```

`[-]` = **no labels.** `do-not-merge` is confirmed removed (Marco, in chat, ~03:2xZ).

**#1523 is genuinely watcher-routed to Marco.** [MEASURED] RULE-2 probe, positive control first
on the same corpus:

```
breadth 'marco'   : 1294
POS 'marco.:true' : 602        <- instrument is live, an empty result would have meant something
docs\pr-prompts\processed\pr-cardui-s4-plant-columns-ready.md.log:
  [watcher] merge result for PR #1523:
  {"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}
```

This is a **real** routing, not escalation #21's timeout artefact: the reason string is the
genuine policy reason, and the diff is 2 files both under `apps/web` — outside `^(tests|docs)/`,
so `classifyPolicyFiles` correctly calls it Marco's.

**CP-26 will stay red after a re-run.** [MEASURED] Read the gate's own decision table at
`scripts/pr-gates/approval-receipt.mjs`:

```
labelPresent                                   -> FAIL LABEL_PRESENT
!labelPresent && !everLabeled                  -> PASS NEVER_ESCALATED
!labelPresent && everLabeled && !receiptInDiff -> FAIL RELEASED_NO_RECEIPT   <-- #1523 lands here
```

#1523 has `everLabeled=true` (the watcher applied `do-not-merge`), `labelPresent=false` (Marco
removed it), and no receipt:

```
git ls-tree -r --name-only origin/feat/scope-wbs-plant-columns -- docs/decisions/merge-approvals/
  1483.md 1510.md 1511.md 1512.md 1519.md 1520.md README.md      <- no 1523.md
```

**The CI reds are stale on the label half and permanent on the receipt half.** [MEASURED]
Run 33711207188 at 03:24:04Z still saw the label:
`FAIL - CP-26 do-not-merge [PR carries the do-not-merge label...]`. That half is now stale.
The standalone `Approval receipt (CP-26)` job at 03:24:05Z printed the *remediation*: commit
`docs/decisions/merge-approvals/1523.md`. A re-run clears LABEL_PRESENT and lands on
RELEASED_NO_RECEIPT. **Every other gate in the job passed** (CP-12, CP-13, CP-17, CP-23,
CP-24, CP-25 PASS; CP-09/10, CP-22 SKIP) — the known one-cause-two-reds coupling again.

**Nothing was fixed on the branch.** [MEASURED] `git log bd08b0f8..origin/feat/scope-wbs-plant-columns`
returns exactly two commits, and neither is a fix:

```
17b0d7d5 Merge branch 'main' into feat/scope-wbs-plant-columns
34cb51bd docs(board): 00 addendum 0325 ... (#1525)
```

The branch moved only because `PR_WATCHER_AUTO_UPDATE=true` rebased it. **The
`batch3-scope-items.spec.ts:256` regression the 03:25Z addendum diagnosed is untouched.**

**`tendering-e2e` FAILED — and the flake hypothesis is now dead.** [MEASURED] Run 33711207171
finished at 15m4s while this report was being written:

```
1) [chromium] tests/e2e/pr-acceptance/batch3-scope-items.spec.ts:256:7
   Batch 3 — Scope of Works items › plant pills: add a plant cluster, set qty/days, remove it
   at .../batch3-scope-items.spec.ts:304:28
1 failed
163 passed (10.4m)
```

**Byte-identical to the 03:25Z addendum's diagnosis, on a third distinct head.** Three heads,
one failure, the same failure, 163 siblings green each time. A flake does not survive three
independent runs with a 163:1 ratio. DOCTRINE §5's "re-run before you diagnose" is now
**spent** on this red — re-running it again would be the loop the doctrine forbids.

**Machinery is healthy.** [MEASURED] `restart-watcher-if-wedged.ps1` (13:29:50 AEST = 03:29Z):
`VERDICT: OK - nothing armed and the watcher is alive` — pid 26656, churn 0 in 20 min.
`git worktree list`: dev tree + `C:/po-1483-fix` + `C:/po-work/s2-e2e`. No locks
(`.git\index.lock`, `docs\qa\.qa-run.lock` both absent).

**Armed prompts: 0.** [MEASURED] `Get-ChildItem docs\pr-prompts -Filter *-ready.md` → count 0.

## WHAT CHANGED

**#1523: nothing.** No merge, no label, no push, no re-run. It is untouched by this run and
remains BLOCKED at 17b0d7d5.

**Armed exactly one prompt: `pr-vmguard-s1-persist-and-repo-param`.** [MEASURED] Via the
primitive, never a bare `git mv`:

```
scripts\pipeline\arm-prompt.ps1 -Name pr-vmguard-s1-persist-and-repo-param
  Lock acquired (PID 26376) ... ADMIT (size 2) ... SUCCESS: -HOLD.md -> -ready.md
  Index contains exactly the two expected paths ... ARM_INDEX_RELEASED ... Index clean
```

Read-back: `Get-ChildItem *-ready.md` → exactly `pr-vmguard-s1-persist-and-repo-param-ready.md`;
`Test-Path ...-HOLD.md` → `False`; `git diff --cached` → 0 paths. Board went 0 armed → 1 armed.

Pre-arm conditions all measured immediately before acting (DOCTRINE: the verdict expires when it
prints): index empty (no other chat mid-commit), no `RD`/` D` staged-rename trap, 0 armed,
watcher alive pid 26656, no locks. RULE 4 detector: lint **ADMIT**, and the three-marker
don't-arm union returned **zero hits with a live POS control** (`pr-524` → 2 hits).

One scratch file written and removed: `scripts/pipeline/tmp-00-board-read.mjs`.

## FINDINGS

### F1 — Removing `do-not-merge` did not release #1523, and the remaining half is Marco's alone

The gate is two-conditional. Marco satisfied the first condition; the second — a committed
`docs/decisions/merge-approvals/1523.md` — is unsatisfied, and **no agent may ever author an
approval receipt.** That prohibition is permanent and is not softened by Marco having already
signalled approval by removing the label.

Note the ordering hazard this creates: label-removal alone moves the PR from
`FAIL LABEL_PRESENT` to `FAIL RELEASED_NO_RECEIPT` — a *different* red with the same colour.
An agent reading only "CP-26 red" before and after would conclude nothing had happened.

**DISPOSITION: ESCALATED** — Marco, in chat, 2026-09-03T03:4xZ. Two things are needed from him
and only him: (a) commit the receipt file to `feat/scope-wbs-plant-columns`; (b) clear RULE 2
for #1523 explicitly in chat, since label removal is not that clearance. Neither is ripe until
F2 is resolved — approving a PR whose e2e is unfixed would land the regression.

### F2 — The #1523 e2e fix was DISPATCHED→01 and there is nothing for 01 to consume

The 03:25Z addendum dispatched the `batch3-scope-items.spec.ts:256` regression to Station 01.
Station 01 has **no cadence**: it runs only when the watcher consumes an armed `-ready.md`.
Armed prompts this run: **0**. So the dispatch has no consumer and will not execute.

This is the *same shape* as the failure the station doc records for 02 — the #1483 e2e work
dispatched to "01/02" at 18:09Z and 20:09Z on 09-01 and still undone eight hours later, because
the named station had no schedule and no consumer. **A dispatch to a station with no cadence is
a dispatch into a void**, and it is indistinguishable in a breadcrumb from work that is moving.

I did not author and arm a prompt for it this run: the fix is in `apps/web` (restore the moved
plant cell — the addendum's finding that relaxing the assertions produces a test that lies still
holds), so it is neither `tests/`-only nor `docs/`-only, and RULE 4 says ask before arming that.

**DISPOSITION: ESCALATED** — bundled to Marco with F1, since it gates F1.

### F3 — `PR_WATCHER_AUTO_UPDATE=true` moved #1523's head again, with no fix in it

Third recorded instance. The branch advanced bd08b0f8 → 17b0d7d5 purely from the watcher's
timer-driven rebase, which also re-triggered the full check suite at 03:23:54Z — including the
e2e that is now sitting queued. The doc drift (`start-watcher.ps1:159` says `"true"`;
`index.mjs:155` + `README.md:90` document the default OFF) and the missing
"don't update a PR whose checks are RED/RUNNING" guard both remain unstaged.

**DISPOSITION: DISPATCHED → 03 (machine-minder)** — re-affirming the existing open dispatch,
now with a third measured instance attached. Not new work for 03; new evidence for work it
already owns.

### F4 — Five Station 06 breadcrumbs from this morning are UNTRACKED and dispatch seven prompts at me

`check-breadcrumb.mjs` flagged them: `00-06-pr-master-2026-09-03-` at 0250, 0300, 0320, 0335 and
0345, each `NOTE ... is UNTRACKED — it reaches nobody until a board PR commits it`. Between them
they DISPATCH → Station 00: `pr-vmguard-s1` (armed this run), `pr-visualreview-s1/s2/s3`,
`pr-hygiene-s1-guarded-branch-prune`, `pr-claudedesign-s1/s2`. One carries an ESCALATED item and
a title that should not sit unread: *"a one-click VS Code task would have deleted 28 unpushed
commits."*

Collected. Only `pr-vmguard-s1` was actioned — RULE 4 is one at a time. The rest are real, staged
work for subsequent 00 runs, in cluster order.

**DISPOSITION: ACTIONED** (collected + one armed) — the remainder **DEFERRED** to the next 00
cadence, which is the correct pace for serial arming, not a backlog forming.

### F5 — Board and machinery are otherwise clean

One PR open, zero DIRTY, watcher alive with zero restart churn, no stale locks, no orphaned
worktrees beyond the two known named ones. Q1 answer: **0 DIRTY**. Q3 answer: armed prompts
counted myself — **0 at the start of the run, 1 at the end** (`pr-vmguard-s1-persist-and-repo-param-ready.md`).
Q6 answer: the one thing blocking progress is F2 — the unfixed, unarmed e2e regression on the
only open PR.

**DISPOSITION: ACTIONED** — measured and recorded; nothing to fix.

## WHAT I DID NOT DO

- **Did not merge #1523.** RULE 2 bars it on a live `marco:true` verdict, and label removal is
  not the clearance. It is also not mergeable: BLOCKED, two required reds, and a **third** red — the
  e2e, measured failing on this very head at 03:39Z.
- **Did not author `docs/decisions/merge-approvals/1523.md`.** Absolute, permanent prohibition.
  Marco removing the label is approval of the *change*; it is not permission for an agent to
  forge his signature on the receipt, and the two must never be conflated.
- **Did not re-run #1523's checks.** A re-run now would only trade LABEL_PRESENT for
  RELEASED_NO_RECEIPT and would cancel the queued e2e. Re-run *after* the receipt lands.
- **Did not re-derive the 03:25Z e2e diagnosis.** A sibling 00 run measured it 5 minutes before
  this one started; re-deriving it would bill this run to rediscover a finding already written.
- **Did not arm a second prompt.** RULE 4 is one at a time; `pr-visualreview-s1/s2/s3`,
  `pr-hygiene-s1` and `pr-claudedesign-s1/s2` wait for the next cadence.
- **Did not arm `pr-vmguard-s2-preflight-installs-guard-HOLD.md`** — it is gated on s1 and lints
  `REJECT [GATE_NOT_RELEASED]`. Arming it now would be arming an unmet gate.
- **Did not author a prompt for F2.** The fix is in `apps/web`, so it is neither `tests/`- nor
  `docs/`-only, and RULE 4 says ask Marco before arming that shape.
- **Did not touch Azure / Entra / SharePoint, `sot/`, production data, or the watcher repo's git.**

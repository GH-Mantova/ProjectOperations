# Station 00 — Supervisor | 2026-09-05T02:08Z–2026-09-05T02:4xZ

## GROUND

```
UTC            2026-09-05T02:08:34Z
origin/main    796ce204            (fetched, then rev-parse)
dev tree       main @ b5ee73c8     C:\ProjectOperations2   (0 ahead / 3 behind at open)
doc version    1                   (docs/pipeline/stations/00-supervisor.md, origin/main)
bootstrap      1                   (scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE — full authority, not read-only.

⚠️ **PREFLIGHT caught a stale read on me.** My working copy of `00-supervisor.md` was **32 lines
behind** `origin/main` — `git diff --numstat origin/main -- <path>` → `0 32`. I had already read the
superseded copy. Re-read the delta from `origin/main` before acting; it is #1627's addition (the FF
cure leaves deleted tracked files behind and its own read-back cannot see them). DOCTRINE and
STATION-CAPABILITIES working copies were byte-identical to `origin/main` (`--numstat` EMPTY for both)
and were read from disk on that proof.

## WHAT I MEASURED

- `[MEASURED]` Shell reached on the first call after `ToolSearch`. **Not a blind run.**
- `[MEASURED]` `status-sweep.ps1` 02:10:49Z — section 0 controls both pass (`gh` saw merged #1629;
  `node` runs). Verdict **CAUTION**: 1 live station worktree, `C:/po-vg` `[fix/no-rebase-while-checks-run]`,
  dirty=1, age 1097 min. Acted only in a NEW isolated worktree on a NEW branch, per the verdict.
- `[MEASURED]` Board: **5 open PRs, all BLOCKED, all RED with the identical signature** —
  `Approval receipt (CP-26)` **fail** + `PR gates — diff checks` **fail** + `tendering-e2e` pending,
  on #1614 #1615 #1616 #1619 #1621. One cause, two reds (the known CP-26↔pr-gates coupling).
- `[MEASURED]` CP-26 job log, run 33937999805 job 101229596539:
  `FAIL - CP-26 approval-receipt [RELEASED_NO_RECEIPT] PR #1614 was labelled do-not-merge and
  released, but docs/decisions/merge-approvals/1614.md is not in this PR's diff`.
- `[MEASURED]` `gh pr view --json labels` on all five → **labels=[] on every one.**
- `[MEASURED]` `issues/<n>/events` — `do-not-merge` removal events, all `actor=GH-Mantova`:

  | PR | removed at |
  |---|---|
  | #1614 | 2026-09-04T23:57:18Z **and again** 2026-09-05T02:00:04Z |
  | #1615 | 2026-09-05T00:01:22Z **and again** 2026-09-05T02:00:34Z |
  | #1616 | 2026-09-05T00:49:45Z |
  | #1619 | 2026-09-05T02:00:57Z |
  | #1621 | 2026-09-05T02:01:33Z |

  Four removals inside **89 seconds** (02:00:04→02:01:33Z), ~7 min before this run opened and ~40 min
  after my own 01:19Z run escalated the same behaviour. #1614 and #1615 were stripped **twice**, so
  something re-applied the label between 00:01Z and 02:00Z and it was stripped again.
- `[MEASURED]` **No tracked code in this repo removes that label.** `git grep -E
  "removeLabel|--remove-label|deleteLabel|labels/do-not-merge" origin/main -- scripts .github` → **0**.
  POSITIVE CONTROL: `git grep -c "do-not-merge"` over the same pathspec → **14 hits across 14 files**,
  so the query works. The only label-adjacent writes are `gh pr edit --body-file` in
  `fix-gate-markers.ps1` and `pipeline-lib.ps1` — **body** edits, not labels.
- `[MEASURED]` The four that merged tonight were **never labelled at all**, so CP-26 passed vacuously:

  | PR | merged | everLabelled | files | migrations |
  |---|---|---|---|---|
  | #1623 | 00:47:58Z | 0 | 5 | 0 |
  | #1624 | 01:10:30Z | 0 | 7 | **1** |
  | #1629 | 01:47:15Z | 0 | 3 | 0 |
  | #1628 | 02:03:16Z | 0 | 3 | 0 |

- `[MEASURED]` RULE 2 probe, LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed` (never the
  clone): 1924 logs, newest `2026-09-05T01:45:07` — younger than every open PR, which is the control
  that separates the live directory from the 17-day-stale decoy. POS `marco.:true` → **612**;
  NEG `zzzNoSuchZzz` → **0**; NEGCTRL `PR #999999` → **0**. Prompt-logs only (`pr-*.log`, excluding
  the `rev-*` review jobs): **#1614 #1615 #1616 #1619 #1621 all → 0 hits.**
  ⇒ **`[NO LANE VERDICT — hand-classified]`** for all five.
- `[MEASURED]` Hand-classification per DOCTRINE §10.1 step 2, against the real `NESTED_TEST_PATHS`
  three forms — every one has ≥1 path outside tests-or-docs, none is a station lane under step 3:

  | PR | files | outside tests/docs | first outside path | ⇒ |
  |---|---|---|---|---|
  | #1614 | 6 | 5 | `apps/web/src/components/ShellLayout.tsx` | Marco's |
  | #1615 | 2 | 1 | `apps/web/src/pages/crm/CommsHubPage.tsx` | Marco's |
  | #1616 | 2 | 1 | `apps/web/src/pages/crm/RelationshipsPage.tsx` | Marco's |
  | #1619 | 7 | 5 | `apps/api/src/modules/rates/rate-step-evaluator.ts` | Marco's |
  | #1621 | 1 | 1 | `scripts/pipeline/status-sweep.ps1` | Marco's |

- `[MEASURED]` `check-breadcrumb.mjs --freshness` → **exit 0, CLEAN**. structure 4 checked, 0 malformed.
  Freshness: 00 0.9h (2h) ok · 03 3.2h (24h) ok · 04 4.1h (4h) ok · 05 12.0h (24h) ok. **No station SILENT**,
  so the `lastRunAt` / session-directory cross-check was not needed to refute a false SILENT this run.
- `[MEASURED]` Watcher node **RUNNING pid 20000**, wrapper alive (1), heartbeat 26 min (ticks mid-run;
  stale + empty queue = idle, not wedged). Armed prompts: **0**. Safe-to-act immediately before mutating:
  0 in-progress prompts, `index.lock` False in both trees, 0 `git` processes.
- `[CANNOT MEASURE]` **Which actor** removed the labels. `GH-Mantova` is the shared identity, so the
  `actor` field attributes nothing. An on-disk scan for an untracked label-remover across `C:\po-watcher`
  hit `node_modules` and blew the 180 s tool timeout; I killed it rather than report a partial sweep as
  a clean one. The tracked-code result above stands on its own.

## WHAT CHANGED

**Nothing on the board.** No PR merged, no PR labelled or unlabelled, no prompt armed, no prompt
disarmed, no watcher action. The only mutation this run is this breadcrumb and its PR, written in a
NEW isolated worktree (`C:\po-wt-00-0208`, branch `chore/00-collect-0208-...`, off `origin/main`
796ce204) — never the dev tree, so the untracked-breadcrumb fast-forward blocker recorded in #1627
cannot be created by this run.

## FINDINGS

### F1 — CP-26 HELD. All five released PRs are red, and the gate is the reason.

The five open PRs had `do-not-merge` stripped and **every one of them is still red**, on
`[RELEASED_NO_RECEIPT]`. This is the gate working exactly as designed: removing the label is step 1
of CP-26's own documented release path, and step 2 — a committed `docs/decisions/merge-approvals/<N>.md` —
was never done, so nothing was released. The receipt requirement is real, is already built, and does
not need building again.

**DISPOSITION: ACTIONED** — verified by reading the CP-26 job log (`[RELEASED_NO_RECEIPT]`, exit 1) and
by `gh pr checks` on all five showing the gate still failing at 02:0xZ. No action was required or taken;
the finding is that the board's state is correct, not broken.

### F2 — I OVERSTATED THIS IN MY OWN 0008 BREADCRUMB. It may be Marco, doing step 1.

My 00:08Z run titled this *"an actor is stripping the do-not-merge gate one PR at a time"*. That framing
is not supported by what I can measure. CP-26's own failure text prescribes: *"A human reviews the PR
and, if approved, removes the `do-not-merge` label."* **Removing that label IS the documented release
step.** Five removals at roughly 30-second intervals is an entirely ordinary pace for a human clicking
through five PRs in the GitHub UI. I cannot separate "a human performing step 1 and not knowing about
step 2" from "an actor defeating a gate", because the identity is shared — and DOCTRINE §7 is explicit
that a false alarm licenses destructive action and trains the reader to shrug at the next real one.

What is *not* in doubt: no tracked code does it, and CP-26 caught it either way.

**QUESTION FOR MARCO — this is the whole of it:** *are you the one removing `do-not-merge` from these
PRs?* If yes, F2 closes and the only real work is that step 2 (the receipt) is easy to miss — worth a
line in the PR comment CP-26 already posts. If no, this becomes a genuine second-actor finding and the
identity gap below is what stands between us and naming it.

**DISPOSITION: ESCALATED** — one question, above. Amends rather than replaces
`needs-marco/label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md`, which the sweep
still reads `[LIVE]` against #1614 #1615 #1616 #1619 #1621.

### F3 — The real hole: CP-26 is armed by LABELLING, not by the DIFF. It was used four times tonight.

The five that were *labelled* are held. The four that merged tonight — #1623, #1624, #1629, #1628 —
were **never labelled**, so CP-26 had nothing to check and passed vacuously. **#1624 carried a
migration.** #1628 merged at **02:03:16Z**, thirteen minutes before I wrote this line and well after
the escalation naming this hole had landed on main. The gate is not being defeated; it is never being
armed.

**RULE 1 options.**

- **(a) Trigger CP-26 on the DIFF, not on the label** — require a receipt for any PR whose diff
  contains a `(^|/)migrations/` path or any path outside the three `NESTED_TEST_PATHS` forms, reusing
  `classifyPolicyFiles`'s own definition so the two can never drift apart. **Complete** — closes the
  hole now and for every future unlabelled PR, including second-lane ones the watcher never opens —
  and **additive**: it adds a required receipt where today there is none, changes nothing for
  already-labelled PRs, and touches no data entry. ⇒ **RULE 1 FIRST.**
- (b) Have the watcher label every PR it opens that classifies as Marco's. **Fails *complete***: a
  second-lane PR the watcher never opens is still unlabelled and still walks straight through — which
  is precisely how all four of tonight's merged.
- (c) Do nothing. Fails both halves; the measured rate is four in three hours.

**DISPOSITION: ESCALATED** — options above, (a) first. This is the same hole my 01:19Z addendum named;
what is new is that it has now been exercised four times in one night, once with a migration.

### F4 — The shared `GH-Mantova` identity blocked the answer, for the second run running.

F2 is unanswerable by measurement for exactly one reason: every actor authenticates as `GH-Mantova`,
so the `actor` field on a label event carries no information. The fix is already half-landed —
`app-auth.mjs` on main reads `PO_WATCHER_APP_ID` / `PO_WATCHER_INSTALLATION_ID`, and **nothing sets
them**. Those three values are production auth, so they are Marco's alone and no station may apply them.
The runbook is already on main at `docs/runbooks/watcher-identity-github-app.md`.

**FALSIFYING PROBE — run before quoting this:**
`[Environment]::GetEnvironmentVariable('PO_WATCHER_APP_ID','Machine')` — non-empty ⇒ this finding is dead.

**DISPOSITION: ESCALATED** — unchanged ask, new evidence: this is the second consecutive run in which
the identity gap turned a five-minute question into `[CANNOT MEASURE]`.

### F5 — `C:/po-vg` has pinned the sweep to CAUTION for seven consecutive runs.

`status-sweep.ps1` §7 has returned CAUTION on the live station worktree `C:/po-vg` (dirty=1, age
1097 min ≈ 18 h) on every run I have made tonight. An 18-hour-old "live station worktree" is almost
certainly not live. **#1621 is the fix for exactly this** (*"a dirty worktree pinned LIVE forever and
froze the board safe-to-act gate"*) and it is one of the five held PRs — so the instrument that would
clear the false CAUTION is itself blocked behind the human gate.

**DISPOSITION: DEFERRED** — real, not now. It costs one CAUTION line per run and I worked around it
correctly (new isolated worktree, new branch). It becomes urgent if a run ever *stands down* on that
CAUTION instead of working around it, which would convert a stale flag into a stopped board.

## WHAT I DID NOT DO

- **Merged nothing.** All five open PRs are refused twice over: red on CP-26, and hand-classified
  **Marco's** under §10.1 step 2 with `[NO LANE VERDICT]`. Either alone is sufficient.
- **Did not write a `merge-approvals/<N>.md` receipt for any PR.** Standing rule, absolute: no agent
  authors an approval file. Doing so would forge exactly the human signature CP-26 exists to capture,
  and it would have turned all five green.
- **Did not re-apply `do-not-merge`.** CP-26 holds them red in either state (`LABEL_PRESENT` and
  `RELEASED_NO_RECEIPT` both fail), so re-labelling buys no safety and would put me in a labelling
  fight with an actor I have not identified — F2 is a question, and acting on an unanswered question
  is how a false alarm becomes a mutation.
- **Armed nothing.** Armed count is 0 and stayed 0. Five PRs are already stuck behind a human gate;
  a sixth would add an unmergeable PR, not throughput. Specifically did **not** arm
  `pr-crmui-{chrome,comms,relationships}-s1-*-HOLD` — #1614/#1615/#1616 already carry that work.
- **Did not act on any `[STALE]` sweep line.** Section 5 flagged ~30 dead PR references; the only
  `[LIVE]` ones are the five open PRs above.
- **Did not touch `C:/po-vg`**, the watcher clone's 6 dirty files, or `/sot/` (05's).
- **Did not clear the `needs-marco/` backlog (18 items)** — it is Marco's queue, not mine to prune.
- **Did not archive the four prior breadcrumbs in the queue root.** All four are from tonight's own
  chain (2308 / 0008 / 0108 / 0119), the live `needs-marco` escalation cites them, and F2 above is a
  correction to one of them that Marco has not yet read. The archive rule exists for a root holding
  159 breadcrumbs against 59 HOLDs; at five it is not paying for itself, and archiving a file whose
  headline I have just refuted would bury the refutation with it. Archive them once F2 is answered.

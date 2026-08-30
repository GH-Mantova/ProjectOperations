# Station 00 — Supervisor | 2026-08-28 20:09Z–20:25Z

## GROUND

```
UTC            2026-08-28T20:09Z
origin/main    1032afba  at start  ->  93bd3801 after my merge of #1385
dev tree       main @ 82ba8538   C:\ProjectOperations2   (5 behind at start)
doc version    1
bootstrap      1                 (MATCH)
```

Shell reached on the first attempt (`start_process`, `powershell.exe`, PID 33452). This was a
SIGHTED run, not a blind one — the two previous 00 runs were blind and said so.

## WHAT I MEASURED

**Sweep** — `scripts/pipeline/bring-up-to-speed.ps1`, generated 2026-08-28T20:09:20Z, exit 0.
Both instrument positive controls passed (`gh` saw merged #1384; `node` runs). Verdict:
**SAFE TO ACT**. `[MEASURED]`

- **ARMED = 0** — `Get-ChildItem docs\pr-prompts -Filter *-ready.md` returned nothing. `[MEASURED]`
- **Shared index CLEAN** — `git diff --cached --name-status` empty, **no `R100 …-HOLD.md ->
  …-ready.md` half-arm**. This is the probe the 18:09Z run had to DEFER for want of a shell; it is
  now run and clean. Two plain ` D` entries (`pr-lint-armed-gate-inversion-HOLD`,
  `pr-station-contract-breadcrumb-validator-and-qa-claim-HOLD`) are **consumed** prompts —
  `processed/` ≥ 2 for each — so they are LEFT alone. `[MEASURED]`
- **Watcher** — node RUNNING pid 26364, auto-restart wrapper alive (3), heartbeat 237 min (ticks
  only mid-run; stale + empty queue = idle, NOT wedged). `[MEASURED]`
- **Open PRs = 3**: `#1383` CLEAN 8/8 green, `#1382` CLEAN 8/8 green, `#1377` UNSTABLE with
  **exactly one** failing check — `PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)`,
  the job CP-26 lives inside — and the label `do-not-merge`
  ("escalates:true - Marco merges this, not automation (DOCTRINE 5b)"). `[MEASURED]`
- **The OAuth expiry, measured directly rather than inferred from log lines.** Reading only the
  numeric `claudeAiOauth.expiresAt` out of `C:\Users\Marco\.claude\.credentials.json` (no token
  value read or printed):

  ```
  expiresAt(UTC)       = 2026-08-28T16:13Z
  now(UTC)             = 2026-08-28T20:17Z
  EXPIRED              = True
  minutes_since_expiry = 244
  ```

  The file's `LastWriteTimeUtc` is also `2026-08-28T16:13Z` — it has **not been rewritten since**,
  so no re-authentication has happened. `[MEASURED]`
- **Breadcrumb validator** — `node scripts/pipeline/check-breadcrumb.mjs --freshness` reported
  `83 checked, 1 malformed` and exit 1; the single REJECT was
  `00-00-supervisor-2026-08-28-1809-execution-lane-down-on-expired-oauth.md`. After the heading
  fix: `83 checked, 0 malformed`, exit 0, and that file reads ADMIT. **The instrument was seen to
  both REJECT and ADMIT the same file — a real positive control, not a hopeful one.** `[MEASURED]`
- **Station 03 ran and did not report.** `list_scheduled_tasks` gives 03-machine-minder
  `lastRunAt 2026-08-27T23:01:16Z` (enabled, daily, next 2026-08-28T23:00Z). But
  `git ls-tree -r --name-only origin/main docs/pr-prompts` shows 03 breadcrumbs for **08-24, 08-25,
  08-26 only** — nothing for 08-27. The freshness checker's "03 last 2026-08-26T23:01Z, 45.2h ago,
  ok" is therefore reading a real gap, not a scheduling gap. `[MEASURED]`
- Watcher clone `dirty=35`, and the same **4 pre-existing** orphaned worktrees
  (`sot-d-register`, `sot-readme-fetch`, `sotk-03-ledger`, `po-wt-h`). Unchanged. `[MEASURED]`

## WHAT CHANGED

1. **Fixed the malformed breadcrumb.** The 18:09Z blind run wrote its report with free-form
   headings, so it was the one file failing `check-breadcrumb.mjs` — which runs in CI on `main`,
   where one malformed file reddens Pipeline board-wide. I rewrote **the section headings only**,
   into the contract's five in order, and recorded that in an HTML comment at the top of the file.
   No finding, measurement, or disposition was altered.
2. **Opened, drove and merged `#1385`** — `docs(board): sweep up 00's 18:09Z + 04's 18:10Z
   breadcrumbs and the sweep rotation`. Built in a **disposable worktree** off `origin/main`
   (`C:\po-worktrees\bc-2020`), never in the shared dev tree. CLEAN, all required checks green,
   merged via `Assert-SmokedOrEscalate -PR 1385` → `Merge-Pr -PR 1385`.
   **Read back:** `state=MERGED  mergedAt=2026-08-28T20:16:52Z  mergeCommit=93bd3801`, and
   `git rev-parse --short origin/main` = `93bd3801`.
   `docs/pipeline/sweep-rotation.json` landed **in the same commit** as 04's breadcrumb, as 04
   asked — otherwise the next 04 repeats `gate-liveness` and the rotation silently stops.
3. **Tore the worktree down** — `git worktree remove --force` + `git worktree prune`. `worktree
   list` afterwards shows the dev tree plus **the same 4 pre-existing orphans; no 5th**. Dev-tree
   index re-checked and still clean.

Nothing else. **No prompt was armed** (see FINDING 1), no label touched, no PR closed.

## FINDINGS

### FINDING 1 — 🔴 The watcher's agent lane is still dead, and now it is measured at the source

The 18:09Z run inferred an expired OAuth token from eight `401` log lines. That inference is now a
direct reading: the credential's own `expiresAt` is **2026-08-28T16:13Z**, **244 minutes past** at
20:17Z, and the file has not been rewritten since. This also explains the onset exactly — the first
quarantined prompt (`rev-1382-ready.md`) fired at 16:13:25Z, seconds after the token died.

Nothing has fired since 16:13Z (ARMED has been 0), so the lane has never been *retested* — but it
does not need to be: **the token is expired as a fact, not as a symptom.** This probe replaces
"burn one cheap spent prompt to test the lane", which was the previous plan and costs a prompt.

**Arming anything while this holds destroys it** — the prompt is consumed, exits 1 with `retries 0`,
and lands in `failed/` with no work done. `ARMED` must stay 0.

**ESCALATED** — Marco. Re-authenticating the watcher's Claude credential is his (hard-stop
categories 3/4: authorization grant / auth config that cannot be verified without him). The three
quarantined `rev-138x` review prompts are re-raisable once auth is restored; nothing else was lost.

### FINDING 2 — Station 03 ran on 2026-08-27 and produced no breadcrumb

The scheduler says it ran (`lastRunAt 2026-08-27T23:01:16Z`, enabled). `origin/main` has no 03
breadcrumb for that date, while 08-24 / 08-25 / 08-26 are all present. Per the station contract a
silent station is a defect either way: it did not run, or it ran and did not report. The scheduler
settles which — **it ran and did not report.** The cause is not visible from here; the candidates
are an early exit (e.g. a blind run that stopped at preflight, as two 00 runs did today) or a write
to a path nobody reads.

This matters beyond the missing report: 03 owns the **watcher clone divergence** (`dirty=35`,
`merge --ff-only` cannot succeed) dispatched to it on 2026-08-28T06:23Z and still open, plus the
4 orphaned worktrees.

**DISPATCHED** — Station 03, next run 2026-08-28T23:00Z. Two things to carry: (a) say plainly why
the 08-27 run produced no breadcrumb, and (b) the clone divergence and orphans are still open.

### FINDING 3 — every open PR on the board needs Marco. The board cannot move without him

- **#1382 vs #1383** — mutually-exclusive duplicates of the same station-contract doc fix, both
  CLEAN and 8/8 green, 98 s apart. The wording pick is Marco's and has been unanswered since
  2026-08-28T16:21Z. **#1383 is watcher-routed (`{"marco":true}`, ownership proven), so RULE 2
  forbids me merging it** — which means even "Option A" cannot be executed by an agent.
  - **Option A (complete + additive, RULE 1):** Marco merges **#1383** and closes #1382. Fixes the
    doc once, in the version that came out of the routed lane, and leaves no duplicate behind.
  - **Option B:** merge #1382, close #1383 — fails the *complete* half only in that it discards the
    routed PR the watcher itself produced, and leaves the routing question unexamined.
  - **Option C:** close both and re-cut one PR — fails the *additive* half; it throws away two green
    PRs to gain nothing but a third wording.
- **#1377** — carries `do-not-merge`; I never remove that label and never merge a PR wearing it.
  Its single red is the `PR gates — diff checks` job, i.e. CP-26 alone; every other check passes.
- Because the canonical station-contract block is what #1382/#1383 both edit, **nothing touching
  that block can be armed until Marco picks** — and item 2 of the next-arm order
  (`pr-lint-not-a-prompt-HOLD`) is separately held until #1377 merges, which is also Marco's.

**ESCALATED** — Marco, re-raised. Three PRs, zero of them movable by an agent.

### FINDING 4 — CP-26 is machine-VISIBLE but not machine-BLOCKING, and the fix is a ruleset edit

Unchanged from 2026-08-28T14:09Z and still unanswered. The required contexts are exactly four and
`PR gates — diff checks` is not one of them, so a PR can merge wearing a red CP-26 (#1369 did).

- **Option A (complete + additive):** add `PR gates — diff checks` to the required contexts on
  `main`. Nothing already-green is disturbed; the gate starts blocking what it was written to block.
- **Option B:** leave it advisory — fails the *complete* half: the gate keeps producing a red that
  stops nothing, which is how a false sense of enforcement forms.

The ruleset edit is Marco's to make. **ESCALATED.**

### FINDING 5 — the deferred half-arm probe is run and clean

The 18:09Z run deferred `git diff --cached --name-status` for want of a shell, having found two
half-arms earlier the same day. Run now: **index empty, no `R100` rename, no `RD`.** The class has
not recurred. **ACTIONED.**

### FINDING 6 — breadcrumb sweep-up landed, validator green

Two breadcrumbs that existed only on one disk are now on `main` (#1385), and the validator that
gates them in CI is at `0 malformed`. **ACTIONED** — merge read back at `93bd3801`.

## WHAT I DID NOT DO

- **Did not arm anything.** ARMED stays 0 while FINDING 1 holds. This is a deliberate hold, not an
  empty queue: 11 HOLDs are gate-open with live premises.
- **Did not burn a "cheap spent prompt" to test the agent lane.** The credential probe answers the
  same question for free, and a test firing would have quarantined a real file.
- **Did not merge, close or relabel #1377, #1382 or #1383.** All three are Marco's, for the three
  distinct reasons in FINDING 3.
- **Did not touch the watcher clone, its git, or the 4 orphaned worktrees** — 03's lane, and the
  divergence is already dispatched there.
- **Did not run `git` anywhere but the dev tree's own repo and my disposable worktree**; never in
  `C:\po-watcher\ProjectOperations`.
- **Did not touch `/sot/`, production data, or anything Azure / Entra / SharePoint.**
- **Did not restart the watcher.** It is alive with an idle queue, which is the correct state, and
  restarting it would not refresh an expired credential.

---

**This breadcrumb is UNTRACKED until a board PR commits it.** The next Station 00 run (22:07Z)
sweeps it up. It is deliberately not landed by this run: a report that merges before its own
outcome is known is how a postscript-correction PR became necessary on 2026-08-28.

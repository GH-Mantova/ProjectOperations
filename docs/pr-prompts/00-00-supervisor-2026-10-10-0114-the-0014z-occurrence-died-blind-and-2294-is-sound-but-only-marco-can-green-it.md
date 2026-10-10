# Station 00 — Supervisor | 2026-10-10T01:14:13Z–2026-10-10T01:5xZ

## GROUND

```
UTC            2026-10-10T01:14:13Z
origin/main    d118482d            (git fetch origin, then rev-parse)
dev tree       main @ d118482d      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/00-supervisor.md, read from origin/main)
bootstrap      v1, station_doc_version: 1
```

Doc version and bootstrap AGREE (1 = 1), so this run was not restricted to read-only.

## WHAT I MEASURED

**Reachability.** [MEASURED] One keyword `ToolSearch` for `desktop-commander` loaded the toolkit;
`start_process` with shell `powershell.exe` returned `PROBE_OK` and `2026-10-10 01:14:13 UTC` on the
first call. **Not blind.** No retry was needed.

**Git guard.** [MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` →
exit **2**, last line:

```
   PATH="/sessions/ecstatic-gifted-allen/.local/bin:$PATH" git <args>
```

headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
Exit 2 is the documented EXPECTED outcome for a station (00-supervisor.md PREFLIGHT step 1): a
finding, not a stop. Controls it printed: `bash -lc 'command -v git'` → the shim;
`bash -c 'command -v git'` → `/usr/bin/git`. I ran no `git` through the device bridge; every git call
in this run went through the Windows host shell.

**Binding reads.** [MEASURED] All three read from `git show origin/main:<path>` in the dev tree, not
the working copy, not the watcher clone: `docs/pipeline/DOCTRINE.md` (508 lines),
`docs/pipeline/stations/00-supervisor.md` (466 lines), `docs/pipeline/STATION-CAPABILITIES.md`
(740 lines). `git rev-parse HEAD` = `git rev-parse origin/main` = `d118482d`, so the working copy was
not behind at read time. No REFERENCE file was needed: no core line sent me to one.

**Sweep.** [MEASURED] `scripts/pipeline/status-sweep.ps1`, generated 2026-10-10T01:14:55Z, section 7
verdict: `SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station
worktrees.` Section 0 positive controls both passed (`gh` saw merged #2300; `node` runs) — no
`[BROKEN]`. Section 3: `git index.lock` false/false, 0 scoped git processes, board lease **free**, no
PR touched in the last 2 min, no watcher build in flight (newest heartbeat tick 232 min old, and the
heartbeat ticks only mid-run, so stale + empty queue = idle, not wedged).

**Board.** [MEASURED] 1 open PR, `#2294`, `BEHIND`, 13 pass / **2 fail** / 0 pending, labelled
`do-not-merge`. `main` CI on `d118482d`: 4 success / 0 failed (trunk green). Armed `*-ready.md`: **0**.
`WAITING ON MARCO: 1` open PR, oldest #2294, open 5h. Queue census: needs-marco 53, no-pr-opened 111,
failed 80, blocked 204.

**Backlog gates.** [MEASURED] `ready=1 needs-marco=2 blocked=4 broken=0`. The one READY-TO-STAGE item
is `rates-11c-blocked-consumers` [P2], whose own note says its consumers are *staged but not yet
merged* and that 11c must not merge until the parity proof has RUN clean; I staged nothing from it
(see WHAT I DID NOT DO).

**HOLD admissibility, by exit code.** [MEASURED] All 15 `docs/pr-prompts/*-HOLD.md` passed to
`node scripts/pipeline/lint-prompt.mjs`, classified on `$LASTEXITCODE`:

| verdict | count |
|---|---|
| REJECT (exit 1) | **14** |
| ADMIT (exit 0) | **1** — `pr-sweep-section5-dedupe-and-fast-switch-HOLD.md` |

and that single ADMIT is the prompt whose own PR **#2294 is OPEN** (F2). The two freshest HOLDs both
REJECT for named gate reasons: `pr-sweep-escapee-crosscheck-and-completion-stamp-HOLD.md` →
`PR_GATE_NOT_RELEASED: requires_merged: 2294 — PR #2294 is OPEN, not MERGED`, and
`pr-tipid-s3-retire-the-name-guard-for-an-id-check-HOLD.md` → `GATE_NOT_RELEASED` on
`docs/audits/waste-map-location-backfill.md :: BACKFILL_UNMATCHED_ZERO`, absent from `origin/main`.

**#2294's two reds are the release gate, not defects.** [MEASURED] from the job logs, not the diff:
`PR gates — diff checks` → `FAIL - CP-26 do-not-merge [PR carries the do-not-merge label
(escalates:true). A human must review and REMOVE the label; removing it is what releases the merge.]`
— every other CP in that job PASSed or SKIPped. `Approval receipt (CP-26)` → exit 1, asking for
`docs/decisions/merge-approvals/2294.md`. Per STATION-CAPABILITIES §5, a **standing** receipt is *not
permitted on a PR that was ever labelled `do-not-merge`* and a **personal** receipt requires Marco's
release, so **no receipt form is open to Station 00** (F6).

**#2294's substance at its head.** [MEASURED] with controls, before I pushed: `marco-queue` matched
**4** times in `status-sweep.ps1` on the branch and **4** on `origin/main` (positive control); needle
`QX9922` matched **0** (negative control); `SkipSection5` matched **7** on the branch. The branch's
TRUE change set, taken as a three-dot diff against the merge base `6aaaddb8`, is exactly four paths:
`docs/pr-prompts/superseded/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md` (A),
`scripts/pipeline/__tests__/board-lease.test.mjs` (M),
`scripts/pipeline/__tests__/status-sweep-section5.test.mjs` (A),
`scripts/pipeline/status-sweep.ps1` (M). `git rev-list --left-right --count origin/main...branch` →
`7 2`.

⚠️ **A two-dot diff lied here and I nearly reported it.** `git diff origin/main <branch>` listed two
breadcrumbs as `R100` out of `archive/` and **eight** files as `D`, which reads as a branch that
reverted merged board work. It is an artefact of the branch being 7 commits behind: everything #2295–
#2300 added shows as a deletion. The three-dot diff above is the real answer. DOCTRINE 9.2 warns that
`origin/main` is a per-tree ref; this is the adjacent trap — **a two-dot diff against a newer base
reports later additions as your deletions, exits 0, and nothing warns.**

**Verdict provenance, all three homes.** [MEASURED] `pr-2294-review.md` exists ONLY in the watcher
clone (`C:\po-watcher\ProjectOperations\docs\pr-reviews\`, 5230 bytes); absent from the dev tree's
`docs/pr-reviews/` and from `C:\po-watcher\verdicts-archive\`. It reads `VERDICT: REJECT-AND-REDO`,
`REVIEWED-SHA: 8a7278e8` — **not** the head I measured (`7671943c`), so it is stale (F4).

**RULE 2 probe.** [MEASURED] `docs/pr-prompts/processed/*.log` for `PR #2294`:
`pr-sweep-section5-dedupe-and-fast-switch-ready.md.log :: PR #2294 opened. Leaving it unmerged per
the prompt.` No `stays for Marco (outside tests/ or docs/)` routing line — the blocker is the LABEL,
not watcher routing. Negative control needle `ZZQ7731` over the same corpus → **0**.

**Breadcrumb freshness.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit
**2**; structure `2 checked, 0 malformed`; `00 last 2026-10-09T23:15:00Z 2.1h ago (cadence 1h + grace
0.5h) MISSED`; 03 ok (2.3h, cadence 24h), 04 ok (3.1h, cadence 4h), 05 ok (10.9h, cadence 24h).

**Cadence, from the MCP and not from any document.** [MEASURED] `list_scheduled_tasks`: 4 enabled —
`00-supervisor` `5 * * * *` lastRun `2026-10-10T01:14:02Z` (this run), `03-machine-minder` `0 9 * * *`
lastRun `2026-10-09T23:02:54Z`, `04-scanner` `0 */4 * * *` lastRun `2026-10-09T22:09:39Z`,
`05-sot-keeper` `10 0 * * *` lastRun `2026-10-09T14:22:42Z`; `weekly-security-audit` `enabled: false`.
My cadence is hourly, confirming the bootstrap's own measured line.

**Classifying the MISSED reading.** [MEASURED] The session directory scan (at depth, no name filter,
per DOCTRINE 9.5) shows `4e948d4a` created `2026-10-10 00:14:02` — so the 00:05 occurrence **FIRED**.
Its transcript, `…\4e948d4a\.claude\projects\session\b38be4b8-….jsonl` (55 lines, last written
00:16:13), opens its final assistant turn with:

```
BLIND: plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server
plugin:desktop-commander:desktop-commander connection timed out after 30000ms"
```

and records three `ToolSearch` loads first, then a ~45 s wait and a retry per
`BOOTSTRAP_CONNECT_RETRY_V1`, then the same timeout. `cost-state` totalDuration 128406 ms. So the
classification is **fired and died (blind)**, NOT "never fired" — and it followed the preflight
correctly. See F1 for what it could not do.

## WHAT CHANGED

**Board lease.** `Enter-BoardLease -Actor 'station-00.scheduled'` → `LEASE_OK=True`, with
`$env:PO_ACTOR` set to the SAME string for every later primitive (the measured 2026-10-09 #2279 trap:
an unset `-Actor` makes `Merge-Pr` generate `pwsh-<pid>` and be refused by the station's own lease).
Reason recorded: *retire the spent section5 HOLD inside #2294; open board PR*.

**#2294: the self-retirement completed as a rename.** In an isolated worktree off
`origin/fix/sweep-section5-dedupe-and-fast-switch` on the Windows FS (`C:\po-wt\st00-1014-retire`),
`git rm docs/pr-prompts/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md`, committed with a pathspec
commit (`git diff --cached --name-status` was EMPTY beforehand — the dev tree's index is shared), and
pushed with `Invoke-GitPush -Branch … -WorkTree …`.

- before: `PRESENT_BEFORE=True`, branch head `7671943c`
- after: `PUSH_RESULT=191a6e2a`
- **read back from GitHub**: `gh pr view 2294 --json headRefOid` → `191a6e2aabac14b993a09280ec1b4b8337b6f3bc`,
  `state OPEN`, and the PR's file list now carries both the root path (deleted) and the `superseded/`
  path (added). `git diff -M --name-status origin/main...HEAD -- docs/pr-prompts/` → `D` + `A`.

Git records `D`+`A` rather than `R` because the retirement copy was rewritten, not moved verbatim
(113 lines → 62, with a `(RETIRED)` heading and a retirement note); the identity is carried by the
filename, which is unchanged. Nothing in `status-sweep.ps1` or either test file was touched.

**A comment on #2294** recording the stale verdict, both refutations with their controls, the
retirement fix, and the two RULE-1 options for releasing it:
`https://github.com/GH-Mantova/ProjectOperations/pull/2294#issuecomment-6092160110`.

**This board PR**: this breadcrumb; the two collected breadcrumbs `git mv`'d to
`docs/pr-prompts/archive/`; and one new staged HOLD,
`docs/pr-prompts/pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md` (F2's mechanical fix).

**Nothing was armed.** See F7.

## FINDINGS

### F1 — Station 00's 00:14Z occurrence fired, went blind, reported in chat, and left no breadcrumb, so `--freshness` cannot tell it from a run that never fired

Classification per `FRESHNESS_ONE_CADENCE_V1`: **fired and died**. Measured above: session folder
created 00:14:02, transcript present, `BLIND: … CONNECT_TIMEOUT … 30000ms` after three `ToolSearch`
loads and one 45 s retry. It obeyed `BOOTSTRAP_PREFLIGHT_V1` and `BOOTSTRAP_CONNECT_RETRY_V1`
exactly, opened its report with the mandated `BLIND:` line, and stopped. Its conduct was correct.

What is defective is the **channel**. Its whole report exists only in a chat nobody reads, so one
hour later `--freshness` prints `00 … MISSED` and the next supervisor has to reconstruct the cause
from session directories and a transcript — which is how this run spent a meaningful part of its
budget. And `STATION-CAPABILITIES.md` §3 already records the cure under
`NATIVE_FILE_TOOLS_READ_TRANSPORT_V1`: with Desktop Commander at `CONNECT_TIMEOUT` and the mount
gone, the Cowork **native file tools are read-WRITE** against `C:\ProjectOperations2`, and *"the same
run wrote its own breadcrumb to `docs/pr-prompts/` through `Write`, which is how a blind run leaves a
report at a tracked path even though it cannot open the PR that tracks it."* The 00:14Z run did not
do that, and nothing told it to: the bootstrap's STEP 1 blind branch says only *"write one paragraph
saying you are blind, name what you could not reach, and END THE RUN"*, and the station doc's
PREFLIGHT step 1 says the same. Neither names the breadcrumb, so the one documented capability that
makes a blind run legible to the next one is recorded in a third file that a blind run has no reason
to open.

This is not guessable, because the fix spans two layers I may not simply edit. The bootstrap is
Marco's layer (`C:\Users\Marco\Claude\Scheduled\00-supervisor\SKILL.md`; an agent cannot change it),
and the station-doc half sits **inside the hash-gated canonical block** `station-contract v5`, which
is byte-identical across all seven station docs and which `lint-station.mjs` fails on any edit — so
it means re-recording the hash and shipping seven docs together, for every station, not just mine.

**RULE 1 — complete-and-additive first.** (1) *Add one sentence to the blind branch of the
station-contract canonical block* — "before you end the run, write the blind paragraph as your
breadcrumb at the tracked path using the native file tools, and say in it that it is untracked until
a sighted run sweeps it up" — re-record the block hash, and ship all seven station docs in one PR;
then Marco pastes the same sentence into the five bootstraps. Complete (every station, every future
blind run) and additive (it adds a write on a path that currently writes nothing; it changes no
verdict, no gate and no data). (2) *Bootstrap-only*: Marco edits the five `SKILL.md` files and the
repo is untouched. Fails the *future* half — the station docs keep contradicting the bootstraps, and
STATION-CAPABILITIES §1's whole thesis is that the layers drift independently and a stale instruction
reads exactly like a current one. (3) *Nothing; rely on the next run reconstructing it.* Fails the
*immediately* half: it is what happened here, and it costs a supervisor's budget each time. Blindness
was ~40% of Station 00's runs when last measured, so this is not rare.
→ **ESCALATED** (Marco: both the seven-doc canonical-block change and his bootstrap layer).

### F2 — a HOLD whose own PR is OPEN still lints ADMIT, so the only armable prompt on the board was the one that must not be armed

Measured above by exit code: 14 REJECT, 1 ADMIT, the ADMIT being
`pr-sweep-section5-dedupe-and-fast-switch-HOLD.md` with #2294 open. Its premise is
`! grep -q "SkipSection5" scripts/pipeline/status-sweep.ps1`, true on `main` because the fix is
unmerged, so `lint-prompt.mjs` — which evaluates the premise against `origin/main` and has no notion
of a PR already carrying the work — ADMITs it. Third consecutive reproduction (the 2026-10-09 2214Z
breadcrumb names it in its own title, *"a spent HOLD is re-armable"*).

The window is bounded: once #2294 merges, `SkipSection5` is on `main`, the premise dies and lint
REJECTs. But the window is precisely when a station hunts for something to arm — a board with one
parked PR and nothing else — and arming it would send the watcher to rebuild work already open,
DOCTRINE 10.6 arriving from the opposite direction.
→ **DISPATCHED** to the watcher's code-writer via
`docs/pr-prompts/pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md`, staged in this PR: reject
with `SPENT_HOLD_PR_OPEN` when an open PR's changed-file set contains the prompt's own path or all of
its non-prompt `scope`. Staged `-HOLD`, not armed — arming is a separate deliberate call, and its
premise is live now. `lint-prompt.mjs` and `scripts/pipeline/__tests__/**` are both inside the
instrument-lane allowlist, so only its own retirement path puts the built PR out of lane.

### F3 — my own verdict classifier lied, for the second run running, because the REJECT message contains the word ADMIT

I first classified the 15 HOLDs by grepping `lint-prompt.mjs`'s stdout for `ADMIT`. It returned
**ADMIT for five prompts that exit 1**, including `pr-fv2-ai-digests-HOLD.md` and
`pr-rates-s11c-drop-legacy-tables-HOLD.md`, each printed absurdly as
`ADMIT  FILE_GATE_NOT_RELEASED`. The cause: the rejection text itself ends *"A bare ADMIT would be
indistinguishable from a prompt whose gate IS satisfied."* The 2026-10-09 1913Z breadcrumb records
the same trap in its own title, so this is occurrence two.

This is DOCTRINE 9.6's *"mint a fresh needle"* one level up: the rule is written about documentation
returning false positives for strings quoted in it, and the same mechanism applies to **any corpus
that describes a positive answer** — a REJECT message explaining what ADMIT would mean is such a
corpus. The contradiction (`ADMIT` next to a `*_NOT_RELEASED` code) was visible in the output, which
is the only reason I caught it.
→ **ACTIONED** — re-measured on `$LASTEXITCODE`, which is the verdict `arm-prompt.ps1` itself relies
on; every HOLD figure in this breadcrumb comes from the exit code. Written into the staged prompt as
a named trap so the code-writer's new test asserts on exit code and code string, never on the word.

### F4 — #2294's only review verdict is a stale REJECT-AND-REDO whose two blocking claims are both refuted at the current head

`REVIEWED-SHA: 8a7278e8` against a head of `7671943c` when I read it, so DOCTRINE 7.1's re-read rule
makes it a lead, not a finding. Both of its blocking claims, re-measured with controls:

1. *"PR removes all ~30 lines of marco-queue.mjs invocation from section 1 … leaving 0 references"* —
   **refuted**: 4 matches on the branch, 4 on `origin/main` (positive control), 0 for a minted needle
   (negative control). Commit `7671943c` is titled *"restore the two blocks this branch deleted
   outside its scope"*. Test 260 passes.
2. *"the originating prompt file does not exist in any location searched"* — **refuted**:
   `git ls-files` returns the HOLD, tracked and on `origin/main`, and `processed/` holds both
   `pr-sweep-section5-dedupe-and-fast-switch-ready.md` and its `.log`.

Test 19, its other named failure, also passes. The risk was concrete: the verdict is the only
written assessment of this PR, it lives in one of the three homes, and it tells its reader to reject
and redo work that is sound.
→ **ACTIONED** — the refutations, with their controls and the SHA mismatch, are now a comment on the
PR itself, where the person who has to decide will see them. The verdict file is in the gitignored
clone and is not mine to edit.

### F5 — #2294's self-retirement was an ADD without a DELETE, so two copies of one prompt identity would have landed on main

The prompt's `scope` names `docs/pr-prompts/superseded/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md`
and its own text warns that *"a prompt whose `scope` does not name its own file is never retired by
the PR that builds it and stays armable forever."* It named the path and the build still ADDED it
while leaving the root copy tracked and intact — the same defect through a different mechanism.
Measured: root blob on the branch `dcfea8bb` = root blob on `origin/main` `dcfea8bb` (untouched);
`superseded/` blob `7ea7a4ce` (the rewritten retirement copy). Merging as-is breaks DOCTRINE 10.5
(one identity for an artifact's whole life) and 8.5 `QUEUE_LAYOUT_V1` (one location per prompt), and
leaves a permanent duplicate in every future HOLD census.
→ **ACTIONED** — `191a6e2a` deletes the root copy; read back from GitHub as the PR's head, with the
PR file list and a merge-base diff both showing the pair. One line of the PR's content changed and
no code.

### F6 — #2294 cannot be made green by any station: both its reds ARE the release gate

`CP-26 do-not-merge` fails *because* the label is present, and `Approval receipt (CP-26)` fails for
want of a receipt that Station 00 is forbidden to write — standing is not permitted on a PR ever
labelled `do-not-merge`, personal requires Marco's release. 13 of 15 checks pass; the substance is
sound (F4); the one real defect is fixed (F5). This also parks the follow-up slice:
`pr-sweep-escapee-crosscheck-and-completion-stamp-HOLD.md` is gated `requires_merged: 2294`.
**This is the one biggest blocker on the board.** I left the branch `BEHIND` on purpose —
`PR_WATCHER_AUTO_UPDATE` is OFF and `Merge-Pr` updates a BEHIND branch as the first step of merging,
so updating now buys only a CI rebuild on a PR that cannot merge.
→ **ESCALATED** — the two RULE-1 options are on the PR comment: (1) remove the label and let the next
Station 00 run update, merge and write the personal receipt naming the release — complete, additive,
nothing here touches data; (2) leave it labelled — fails the *immediately* half and keeps the
follow-up slice parked, but breaks nothing.

### F7 — nothing was admissible to arm, and the board's one ADMIT was a trap

`NO-OP: nothing armed.` 0 armed, 14 of 15 HOLDs REJECT on named gates, and the 15th is F2's spent
prompt. `MARCO_QUEUE_LINE_V1` figures, copied as required: **WAITING ON MARCO: 1** open PR
(oldest #2294, open 5h); **ALL OPEN (non-draft): 1**. Had anything been admissible I would have had
headroom to arm it; the constraint was admissibility, not Marco's queue.
→ **ACTIONED** (the decision is the action, and the NO-OP is stated rather than silent, per
DOCTRINE 6).

### F8 — 33 non-main worktrees and 3 registry escapees, several holding unpushed commits

[MEASURED] from the sweep: 33 non-main worktrees, the oldest `C:/po-wt/fv2drop` at 22595 min holding
**21 commits on no remote branch**; `C:/po-wt/s8h` 16; `C:/po-wt/rcpt-2183` 15. Two hold uncommitted
work (`C:/po-wt/sup-cwd-paths` 2 files, `C:/PR-Master/worktrees/sweep-dirty-untracked-v1` 1 file).
Registry escapees: `C:\PR-Master\worktrees\bootstrap-check`, `C:\PR-Master\worktrees\sweep-section5`,
`C:\po-wt\dispatch-register-v1`, all 0 KB with no `.lock`. Two of my own worktrees from this run
(`st00-1014-retire`, `st00-1014-board`) will add to that count until torn down.
→ **DEFERRED** — this is Station 03's lane (STATION-CAPABILITIES §5: 00 dispatches, 03 is
report-only) and 03's 2026-10-09 2303Z breadcrumb already covers the escapee half, including its
finding that the sweep brands a live worktree an escapee. Each line says *"Push or preserve before
pruning"*, and a squash-merged branch shows identically to a lost one, so pruning is not a
disposition anyone should take from a count. It becomes urgent if a worktree holding unpushed commits
is about to be reaped, or if the escapee count grows without 03 reporting.

## WHAT I DID NOT DO

- **Did not remove or alter the `do-not-merge` label on #2294, and did not write it a receipt.** Both
  are Marco's alone. A standing receipt is explicitly forbidden on a PR ever carrying that label.
- **Did not merge anything.** The only open PR is label-gated; there was nothing mergeable to put
  through `Assert-SmokedOrEscalate` → `Merge-Pr`.
- **Did not arm anything** (F7), and did not arm F2's new prompt in the same run that staged it.
- **Did not run `gh pr update-branch` on #2294**, though it is BEHIND — see F6.
- **Did not stage the one READY backlog item** (`rates-11c-blocked-consumers`). Its own note says the
  consumers are staged but unmerged and that 11c must not proceed until the parity proof has RUN
  clean, and the coupled design question `map-locations-waste-rate-coupling` is still unanswered by
  Marco and must be settled *before* 11c drops `estimate_waste_rates`, after which option (a)'s
  backfill becomes impossible. Staging into that ordering unasked is the kind of guess DOCTRINE 5.5
  forbids.
- **Did not touch `/sot/`** — Station 05's exclusively.
- **Did not run `git` through the device bridge**, the guard's exit 2 notwithstanding. The one-call
  `PATH=…` form was not needed: every git call went through the Windows host shell.
- **Did not prune, clear or touch any worktree but the two I created** (F8) — 03's lane.
- **Did not edit the verdict file** in the watcher clone (F4), and ran no git in
  `C:\po-watcher\ProjectOperations`.
- **Did not retire any `[STALE]` escalation row.** Section 5 produced no `[STALE]` lines this run:
  every needs-marco cross-check came back `[FILE] … cites #N (MERGED) as evidence — not its premise;
  does not clear the escalation`, which is explicitly not a clearance. 53 escalations remain open.
- **Did not re-run any check hoping for green** (DOCTRINE 2).
- **Left this breadcrumb untracked in the dev tree until this PR merges** — the PR carries it, so no
  sweep is needed, and the two worktrees above are torn down at the end of the run.

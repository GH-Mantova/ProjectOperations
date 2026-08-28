# Station 00 — Supervisor | 2026-08-28T02:08Z–2026-08-28T02:28Z

## GROUND

```
UTC            2026-08-28T02:08:48Z
origin/main    47aa0d28
dev tree       main @ faf3ff4c  ->  00921aff after this run's arm   C:\ProjectOperations2
doc version    1
bootstrap      1
```

Versions agree. Desktop Commander present — this run is **NOT blind**. PowerShell reached on the
first attempt (pid 19484).

## WHAT I MEASURED

**Board.** `gh pr list --state open` → **ZERO open PRs** [MEASURED]. `gh pr list --state all --limit 12`
shows #1353 and #1361 both merged since my 00:08Z run.

**Queue.** `Get-ChildItem docs\pr-prompts -Filter *-ready.md` (depth 1) → **0 armed** at start
[MEASURED]. The `dns-s4-checker-warn-only` arm from 00:08Z was consumed: its log records
`Started 00:13:37Z / Ended 00:27:42Z / Exit 0`, shipping PR #1361 [MEASURED].

**Watcher.** `Win32_Process` filtered by cmdline `pr-watcher[\\/]index\.mjs` → exactly **1** node,
**pid 12656**, started 2026-08-27T22:16:29Z — the same PID as the previous run, so this is process
identity, not a name match [MEASURED]. `wrapperCount=0`, as expected: §3b ENSURE-UP is dead weight.
`PO Watcher Keepalive` last ran 02:05:01Z **result=0**, next 12:15 local [MEASURED]. No `index.lock`
in the dev tree or the clone [MEASURED]. Heartbeat last ticked 00:35:02Z on `rev-1361-ready.md`; with
0 armed and 0 open PRs that staleness is the documented idle case (DOCTRINE §9.5 — the heartbeat only
ticks mid-run), not a wedge.

**Main is green.** `gh api .../commits/47aa0d28/check-runs` → 13 runs, **12 success, 1 skipped**
(`PR gates — diff checks`, which is skipped on a push to main by design). Read per-commit, never from
`status-sweep.ps1` or `gh run list --branch main` [MEASURED].

**Breadcrumb collector.** `check-breadcrumb.mjs --freshness` → all five stations `ok`, **zero
SILENT** (00 2.0h / 03 27.2h / 04 4.0h / 05 12.0h, each inside 2× cadence). Structure: 68 checked,
**9 malformed** — unchanged from the previous run, and unchanged in composition (7×06, 1×00, 1×04,
the 04 one being the known false positive). **No new 03/04/05/06 breadcrumb has appeared since my
00:08Z run**, so there was nothing new to collect this cycle [MEASURED].

**Do-not-arm grep, with both positive controls.** `Select-String -Path 'pr-*.md' -Pattern
'do-not-arm','DO NOT ARM' -CaseSensitive -List` → 6 files. Both controls fired:
`pr-524-rates-b-slice2-canonical-HOLD.md` and `pr-siteid-notnull-backfill-HOLD.md`. The instrument is
calibrated, and the prompt I armed is not among the 6 [MEASURED].

## WHAT CHANGED

**Armed `pr-sot-refs-s1-baseline-ratchet-and-discovery`** — one prompt, one at a time.

- Its gate `requires_on_main: scripts/pipeline/check-sot-refs.mjs` is now satisfied:
  `git cat-file -e origin/main:scripts/pipeline/check-sot-refs.mjs` → exit 0 [MEASURED].
- Its premise `! test -f docs/qa/sot-refs-baseline.json` is still TRUE — the file does not exist, so
  the work has not shipped [MEASURED].
- `lint-prompt.mjs` → **ADMIT**, exit 0. `escalates: false`. Not in the do-not-arm set. Scope carries
  no `sot/` path, so CP-24 does not fire.
- The HOLD was **UNTRACKED**, so the cure was `git add` then `git mv` — arming is a rename of a
  tracked file, never the creation of a `-ready.md` (`.gitignore:75` swallows those).
- Read back: armed count **0 → 1** on disk [MEASURED].
- Committed as `00921aff` **with a pathspec**, because the shared dev-tree index carried another
  actor's staged `R100` arming rename (`pr-crm-s2-nav-three-items-tabs-HOLD.md → -ready.md`). That
  entry was left exactly as found — not committed, and not `git reset` (LL-38 collision).

Nothing else was mutated. No merge was performed this run.

## FINDINGS

### 1. RULE 2 was breached twice more — #1353 and #1361. That is breaches 11 and 12.

Both PRs were routed to Marco by the watcher itself, and both were merged anyway, 74 minutes apart.

```
processed/pr-lessons-folder-s3-ref-checker-ready.md.log:17
  [watcher] merge result for PR #1353: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: .github/workflows/ci.yml"}

processed/pr-dns-s4-checker-warn-only-ready.md.log
  [watcher] merge result for PR #1361: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: .github/workflows/ci.yml"}
```

Both timelines carry **`merged` and `closed` and nothing else** — no `auto_merge_enabled`, no
`labeled`, no `unlabeled` [MEASURED via `gh api .../issues/<N>/timeline`]:

```
#1353  merged 2026-08-28T01:01:03Z  actor=GH-Mantova
#1361  merged 2026-08-28T01:15:21Z  actor=GH-Mantova
```

This is the identical shape as breach #10 (#1360), and it kills the same two excuses again: auto-merge
was not pre-armed, and no label was ever applied or stripped. These were direct, deliberate merges of
PRs the watcher had explicitly refused. `mergedBy=GH-Mantova` identifies nothing — every actor on this
repo merges under that account, so **RULE 2 has no audit trail at all.**

Twelve breaches now share one root cause, already measured on 2026-08-27: the ruleset on `main`
requires only CodeQL · API · Web · tendering-e2e. **The gate job that would read the `marco:true`
probe is not a required status check, so nothing mechanically prevents any of this.** Recording the
gate more loudly has now failed four times in a row (#1352, #1356, #1360, and now #1353/#1361).

**ESCALATED** — this is finding 3's escalation from 00:08Z, unchanged in substance and now with two
more data points. Marco, the question is which of these you want, and only you can grant it:

- **(A) Complete and additive — make the gate a required status check.** Add a check that reads the
  `processed/<prompt>.md.log` `marco:true` probe and fails while it is set, then add that check to the
  `Main` ruleset's required list. This satisfies both halves of RULE 1: it stops the next breach
  immediately, and it keeps stopping them, and it damages no existing or future data entry — a
  Marco-gated PR simply cannot merge until you clear it. It needs a ruleset change, which is an
  authorization grant, which is yours.
- **(B) Partial — a branch-protection rule requiring one approving review from a named human.** Fails
  the "immediately" half: every actor here authenticates as `GH-Mantova`, so a review approval is no
  more attributable than the merge was.
- **(C) Do nothing and keep recording.** Fails both halves. Four consecutive attempts have proved
  recording does not bind.

### 2. A decision that had been WITHDRAWN was reversed by another actor and merged past the gate.

My 20:08Z run recorded, explicitly: *the 14:08Z "land check-sot-refs non-blocking" escalation was
WITHDRAWN — keep it BLOCKING.* At **23:33:40Z**, three and a half hours later, commit `15dfd84c`
landed on #1353's branch:

```
15dfd84c  2026-08-27T23:33:40Z  ci(sot-refs): land check-sot-refs non-blocking until the baseline exists
```

and #1353 merged at 01:01Z. `git show origin/main:.github/workflows/ci.yml` now reads
[MEASURED]:

```
199: - name: check-sot-refs (non-blocking until baseline lands)
207:   echo "::warning::check-sot-refs found dangling references (exit $code) - not blocking yet; ..."
```

This is the part of the RULE-2 story that costs something real, and it is why I am not treating the
breaches as merely procedural. The out-of-lane merges are not just landing work early — **they are
landing the reversal of decisions this station recorded.** The 28 genuine dangling `sot/**` references
are now a CI warning annotation, which nobody reads, on a green main. That is exactly the failure mode
`docs/qa/qa-findings.md` produced (a real finding written to a gitignored file, unread for nine days)
reproduced through a different channel.

**ACTIONED, and the permanent fix is armed.** I did not re-block the checker: doing so now would turn
main red for every PR until all 28 refs are repaired, and they can only be repaired by Station 05
inside `sot/`, so it would block every workstream on one station's backlog. The complete-and-additive
answer is the ratchet, and its prompt already existed —
`pr-sot-refs-s1-baseline-ratchet-and-discovery`, which baselines the 28 known-dangling refs, fails on
any **new** one, and ratchets the baseline downward as 05 clears them. That is what I armed this run.
It fixes the immediate hole and the future one without breaking the board.

### 3. My own discriminator from the last run is REFUTED. Watcher PRs are not always `worktree-agent-*`.

At 00:08Z I recorded: *"the watcher's PRs use `worktree-agent-*` head refs; a hand-named `feat/*`
branch means a NON-WATCHER actor built it."* That is **false**, and believing it this run would have
made me report a clean watcher build as an out-of-lane intrusion.

#1361's head ref is `feat/d-namespace-s4-register-checker`, but its own processed log proves the
watcher built it from the prompt I armed [MEASURED]:

```
processed/pr-dns-s4-checker-warn-only-ready.md.log
  Started: 2026-08-28T00:13:37Z   Ended: 2026-08-28T00:27:42Z   Exit: 0
  Verified. D-namespace S4 shipped as PR #1361 (`feat/d-namespace-s4-register-checker`)
```

The watcher's agent names its branch from the prompt's intent; `worktree-agent-*` is what it falls
back to, not what it always does. **There is still no reliable discriminator for who built a PR.**
The only sound test remains the processed log: if a `processed/<prompt>.md.log` names the PR number,
the watcher built it.

**ACTIONED** — corrected in project memory, and stated here so no station inherits the bad rule.

### 4. `docs/qa/` is NOT gitignored. Five named files are. This claim is wrong in four places.

DOCTRINE, `00-supervisor.md` §1b, `STATION-CAPABILITIES.md` §7 and the station report contract all
say or imply the **directory** `docs/qa/` is excluded. Measured, with a positive control both ways:

```
git check-ignore -v docs/qa/qa-findings.md    -> .gitignore:107:docs/qa/qa-findings.md   exit 0
git check-ignore -v docs/qa/anything-new.md   -> (no output)                             exit 1
git check-ignore -v docs/qa/sot-refs-baseline.json -> (no output)                        exit 1
```

`.gitignore` lines 105–110 name exactly five patterns — `qa-checklist.md`, `qa-findings.md`,
`qa-test-data-registry.md`, `.qa-run.lock`, `qa-run-*.md` — under a comment that says the directory's
plan doc **stays committable**. The nine-day-unread incident was caused by that one filename, not by
the folder.

This is not academic. It is the reason the armed `sot-refs-s1` prompt is sound: its baseline artifact
`docs/qa/sot-refs-baseline.json` is committable, so the ratchet CI can actually read it. Had I trusted
the remembered claim I would have rejected the prompt as structurally inert. It is also why
`check-breadcrumb.mjs`'s rule — REJECT any breadcrumb quoting a `docs/qa/` path unless the word
"gitignor" sits within ±200 characters — is over-broad: it is enforcing a directory-wide exclusion
that does not exist, which is the same defect that made the 04 breadcrumb a false positive.

**DEFERRED** — real, and the correction belongs in the docs, but the wrong sentence sits inside the
hash-gated `station-contract` canonical block, so fixing it means editing six station docs and
re-recording the `lint-station.mjs` hash in one shipment. That is a prompt, not an inline edit, and I
have already armed my one prompt for this cycle. **It becomes urgent the moment a station needs to
write a genuinely new report file under `docs/qa/` and declines on a false premise.** Next arm slot.

### 5. Board empty, machinery healthy, nothing blocking.

Zero open PRs, zero dirty (vacuously), main green at `47aa0d28`, watcher alive and idle with a working
restarter. The single most important thing blocking progress right now is **not on the board — it is
that RULE 2 cannot be enforced mechanically** (finding 1).

**DEFERRED** — nothing to act on; re-measure next cycle.

## WHAT I DID NOT DO

- **Did not merge anything.** There was nothing open to merge, and both PRs that closed this window
  were Marco-gated and merged by someone else.
- **Did not re-block `check-sot-refs`.** Deliberate — see finding 2. Re-blocking would freeze the
  board on one station's backlog; the ratchet is the complete-and-additive path and it is armed.
- **Did not touch the other actor's staged `R100`** (`pr-crm-s2-nav-three-items-tabs`). Arming is
  00-only and that rename is not mine, but `git reset` is the LL-38 collision, so I committed with a
  pathspec and left it exactly where it sat.
- **Did not arm `pr-dns-s5-checker-flip-to-fail-HOLD.md`** even though #1361 landed its predecessor.
  Slice 5 flips `D_REGISTER_MODE` to fail, and the prompt's own premise is that Marco first triages
  the 36-finding warn output that #1361 produced. That is a Marco gate.
- **Did not fast-forward the dev tree or the clone.** The dev tree is now `00921aff`, ahead of
  `origin/main` by my arming commit and behind by what merged. Convergence of these trees is still
  unowned — escalated 2026-08-27, not re-raised here.
- **Did not chase the 9 malformed breadcrumbs.** Composition is unchanged since the last run and
  `check-breadcrumb.mjs` already runs in CI on main, so landing one malformed file reddens the
  Pipeline job board-wide. They stay held back.

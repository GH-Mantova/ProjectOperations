# Station 00 - Supervisor | 2026-09-04T06:19Z-2026-09-04T06:40Z

## GROUND

```
UTC            2026-09-04T06:19:49Z
origin/main    dd7db248            (fetch first, then rev-parse)
dev tree       main @ dd7db248      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Second phase of the 05:40Z run, on Marco's direct instruction in chat: *"keep arming/opening prs and
driving them to merge."* That overrides this run's earlier judgement (recorded in the 0540 breadcrumb)
that arming only lengthens his queue. Read in the DEV TREE. SIGHTED throughout.

## WHAT I MEASURED

**Candidate selection.** `triage-holds.ps1` over 78 depth-1 HOLDs: **36 gates-satisfied, 42
still-gated, 0 spent, 0 unreadable**, two distinct verdicts observed (ADMIT, REJECT) so the
instrument is calibrated.

RULE 4's detector, run in full on the chosen prompt, with the mandated POSITIVE control:

| prompt | `watcher: do-not-arm` | `DO NOT ARM` (case-sens) | `Arm ONLY` |
|---|---|---|---|
| `pr-watcher-merge-policy-nested-test-paths-HOLD.md` | 0 | 0 | 0 |
| **POS control** `pr-524-rates-b-slice2-canonical-HOLD.md` | 0 | **1** | **1** |

The control fires, so a zero on the candidate is a real zero and not a broken query (§9.6). Body read
for a PROSE gate: `0` matching lines. Encoding verified with node, not PowerShell: 5283 bytes,
`U+FFFD = 0`, double-encode signature `0` - the `?"` seen in the console was the §9.3 reader artifact,
not damage. `arm-prompt.ps1 -WhatIf` exit 0. Single-actor gate clean: armed 0, no `index.lock` in
either tree, 0 git processes, 0 open PRs.

**Why this prompt and not the obvious one.** My first pick was
`pr-approval-receipt-test-gaps-HOLD.md` (tests only, size 1), on the theory that a tests-only prompt
merges itself through the `tests-docs` lane without Marco. **That theory is wrong, and measuring it
is what chose the eventual prompt.** Its scope is
`scripts/pr-gates/__tests__/approval-receipt.test.mjs` - a test file that is **not under `tests/`**.
`classifyPolicyFiles` anchors `/^(tests|docs)\//` at the repo root, so it routes to Marco. This repo
has **no top-level `tests/` directory at all**: every test lives in a nested `__tests__/` folder or
beside its source. So the auto-merge lane cannot see this repo's tests, and *every* test-only PR is
human-gated. That is the same trap that put #1568 on Marco's side of the classifier earlier in this
run, and it is the throughput constraint the 0540 breadcrumb described, with a cause attached.

`pr-watcher-merge-policy-nested-test-paths-HOLD.md` is the root-cause fix for exactly that, so it was
armed instead: one Marco merge that unblocks the lane for all future test-only work.

**The arm.** `arm-prompt.ps1 -Name pr-watcher-merge-policy-nested-test-paths`, exit 0, lock acquired
and released, index verified clean before and after. Audit line:
`2026-09-04T06:19:49Z ARMED pr-watcher-merge-policy-nested-test-paths escalates=true`.
Read back: `-ready.md` present, `-HOLD.md` gone, armed count 1.

**Then the watcher died. Twice.**

```
[2026-09-04T06:19:50.585Z] [queue] pr-watcher-merge-policy-nested-test-paths-ready.md (depth: 1)
[2026-09-04T06:19:50.833Z] [start] pr-watcher-merge-policy-nested-test-paths-ready.md (max-turns=240)
[2026-09-04T16:20:15.511+10:00] Watcher exited with code 1 (raw node exit: -1)
...wrapper restarted it at 06:24:04...
[2026-09-04T16:24:45.863+10:00] Watcher exited with code 1 (raw node exit: -1)
```

At 06:23:20 `restart-watcher-if-wedged.ps1` returned **DOWN** (no process, 1 armed). I did **not**
run `-Fix`: the wrapper `watcher-launcher-singlelane.ps1` pid 33496 was alive the whole time, and
relaunching a supervisor against a live wrapper starts a second supervisor family - the failure mode
the station doc records. I waited one backoff window instead, and the wrapper restarted it by itself
at 06:24:04, which is the behaviour it is supposed to have. **DOWN was correct and transient; `-Fix`
would have been the wrong instrument for it.**

**`raw node exit: -1` is the spawn-failure signature** named in DOCTRINE §7 lie #3
(`err.status === undefined -> -1`). No per-prompt log was ever written, and nothing landed in
`failed/` or `no-pr-opened/`.

## WHAT CHANGED

1. **ARMED** `pr-watcher-merge-policy-nested-test-paths` at 06:19:49Z (read back above).
2. **PR #1570 opened** by the watcher: `fix(watcher): classifyPolicyFiles matches nested __tests__
   and .test/.spec files`, head `fix/watcher-policy-nested-tests`, files exactly the declared scope -
   `scripts/pr-watcher/index.mjs` and `scripts/pr-watcher/__tests__/classify-policy-files.test.mjs`.
3. **Cleared the stale armed file**: `pr-watcher-merge-policy-nested-test-paths-ready.md` renamed to
   `-LOOPING.md`. Read back: `-ready` gone, `-LOOPING` present, armed count 0, `git diff --cached`
   **empty**. Safe because `-ready.md` is gitignored at `.gitignore:75` (verified with
   `git check-ignore -v`, exit 0, against the negative control `CLAUDE.md` -> exit 1 empty), so a
   rename stages nothing into the shared index.
4. **Applied `do-not-merge` to #1570**, read back `labels: ["do-not-merge"]`.
5. **Drove #1570 to green**: all checks pass, `mergeStateStatus: CLEAN` at 06:39:25Z.

⚠️ **Instrument note.** `Rename-Item` printed `exit=1` because `$LASTEXITCODE` was **stale from the
previous `git` call** - cmdlets do not set it. The rename had succeeded. Never read `$LASTEXITCODE`
after a cmdlet; read the effect back instead, which is what settled it here.

## FINDINGS

### FINDING 1 - A crashing watcher opens the PR but never applies the `do-not-merge` that `escalates: true` promises

This is the finding that matters, and it is a **safety** one.

DOCTRINE §5b is explicit that `escalates: true` gates the MERGE, not the RUN, and that the gate is
delivered by the watcher: *"The watcher (`index.mjs`) applies `do-not-merge` to every PR opened for
an escalating prompt."* §8.3a rule 2 then leans on that label as one of the merge queue's guards.

**[MEASURED] The label was absent.** #1570 was opened from a prompt whose front matter reads
`escalates: true`, and at 06:26Z it carried `labels: []`. The watcher crashed before it got that far.
So the PR existed, was green-able, and carried **no** hold label - and the mechanism that was supposed
to apply one had already exited.

Nothing merged it, for two independent reasons: hand-classification put it on Marco's side anyway
(`scripts/pr-watcher/**` is outside `^(tests|docs)/`, and no station lane covers `scripts/`), and I
applied the missing label by hand. But **the guard that was supposed to be automatic was not there**,
and the gap is invisible from the PR: an unlabelled PR from a crashed watcher looks exactly like an
unlabelled PR from a non-escalating prompt. This is §9.6 again - absence of a label is not evidence
of a decision not to label.

The general shape: **a crash between "open the PR" and "label the PR" silently downgrades an
escalating prompt to an ordinary one.** The window is small and it was hit on the first attempt.

**DISPOSITION: ESCALATED - Marco.** Not the label (fixed), the ordering. RULE 1, complete-and-additive
option first:

- **(a) Apply the label BEFORE the PR is opened, or in the same guarded step** - e.g. open the PR as a
  draft, label it, then mark ready; or label from the prompt's front matter at queue time rather than
  at merge time. Solves it immediately (no window) and permanently (no future crash can land in the
  gap), and adds a gate rather than removing one, so it damages no existing or future data entry.
  **Passes both halves of RULE 1.**
- **(b) A reconciler that sweeps open PRs and re-applies `do-not-merge` from the originating prompt's
  front matter.** Fails the *immediately* half - the window still exists, it is merely closed after
  the fact, and a merge inside the window is irreversible.
- **(c) Do nothing and rely on hand-classification.** Fails the *future* half: it works only while
  every escalating prompt also happens to fall outside `tests|docs`. **PR #1570 itself is about to
  make that assumption false for test-only paths**, which is precisely when (c) stops holding.

Note the interaction, because it is the reason this is worth your attention rather than mine:
**(c) is today's safety net, and #1570 removes it.** After #1570 merges, an escalating prompt whose
scope is nested tests WILL be inside the auto-merge lane, so the missing label would no longer be
harmless. **(a) should land before or with #1570.**

### FINDING 2 - The watcher crashed twice on `raw node exit: -1`, and stopped the moment the prompt was de-armed

[MEASURED] Two exits, 06:20:15Z and 06:24:45Z, each **~25 and ~41 seconds after** `[start]` of the
same prompt. After I renamed the stale `-ready.md` to `-LOOPING.md` at ~06:26Z, the watcher restarted
and has been **stable and idle since** (`restart-watcher-if-wedged.ps1` at 06:27:07Z: `ALIVE pid 2572`,
`VERDICT: OK`, churn `1 cycle in 20 min` against a threshold of 4).

**Stated as correlation, not cause.** The prompt was armed across both crashes and absent afterwards,
which is suggestive, but PR #1570 was nevertheless produced - so the build itself did not fail. I
could not obtain a stderr: no per-prompt log was written, and nothing reached `failed/` or
`no-pr-opened/`. The mechanism is therefore **[CANNOT MEASURE]** with what I have.

What is worth recording for whoever picks this up: the crash-and-restart cycle left the prompt armed
each time, so a fourth cycle would have re-run it and opened a **duplicate** PR for work #1570 already
carried. That is the queue eating itself (§3c), and it was ~2 cycles away.

**DISPOSITION: DISPATCHED -> Station 03 (machine-minder)**, whose lane the watcher process is. Two
concrete asks: (1) find the stderr - the watcher currently discards it, and `raw node exit: -1` with
no log is unfalsifiable from outside; (2) the restart path leaves the consumed prompt ARMED, so a
crash loop converts one prompt into N duplicate PRs. 03's next occurrence is 2026-09-04T23:00:45Z.

### FINDING 3 - The `tests-docs` auto-merge lane cannot see this repo's tests

Recorded in WHAT I MEASURED and not repeated here, because #1570 fixes it and is green and waiting.
The measurement that matters: **this repo has no top-level `tests/` directory**, so `/^(tests|docs)\//`
matches no test file in it, and every test-only PR is human-gated. #1568 and
`pr-approval-receipt-test-gaps` are two instances found in one run.

**DISPOSITION: ACTIONED - armed the fix; PR #1570 is CLEAN and labelled, waiting on Marco.**

## WHAT I DID NOT DO

- **Did not merge #1570.** `scripts/pr-watcher/**` is outside `^(tests|docs)/`, no station lane covers
  `scripts/`, the prompt is `escalates: true`, and it now carries `do-not-merge` - which only Marco
  removes. It is green and ready for him.
- **Did not run `restart-watcher-if-wedged.ps1 -Fix`** on the DOWN verdict, for the reason argued
  above: the wrapper was alive and its own backoff was the correct actor. It restarted on its own.
- **Did not arm a second prompt.** RULE 4 is one at a time, and the watcher had just crashed twice on
  the first one. Arming again before the crash is understood would be the second half of a loop, not
  throughput. `armed = 0` and 35 gate-satisfied candidates remain.
- **Did not open a board PR for this breadcrumb.** It sits in the dev tree, the second home the REPORT
  CONTRACT sanctions. Merging anything to `main` right now makes #1570 BEHIND, and
  `PR_WATCHER_AUTO_UPDATE` is `"true"`, so the watcher would rebase it and cancel the green CI Marco
  is being asked to look at. The next 00 run (07:07Z) sweeps this up once #1570 has settled.
- **Did not touch** `/sot/`, Azure/Entra/SharePoint, production data, or the watcher clone's git.

---

## ADDENDUM 2026-09-04T07:08Z - the duplicate I predicted actually arrived, and was closed rather than merged

FINDING 2 above said a further crash cycle would re-run the still-armed prompt and open a **duplicate**
PR. **It already had.** PR **#1571** (`fix/classify-policy-nested-tests`, opened before my de-arm took
effect) was the second build of the same prompt. Marco merged #1570, then asked me to resolve #1571's
conflicts and drive it to merge.

**I did not, and the measurement is why.** [MEASURED] against `origin/main` at `b76ff07e`:

| | `main` (#1570) | #1571 |
|---|---|---|
| implementation | same three regexes, same `isTestOrDocsPath` | **identical** |
| constant | `NESTED_TEST_PATH_PATTERNS` | `NESTED_TEST_PATHS` |
| tests | **8**, all passing | 7 |
| covers the file-object branch (`typeof f === "string" ? f : f.path`) | ✅ (`{path:` -> 1) | ❌ (`{path:` -> 0) |

`main` is a **strict superset**. Merging #1571 would have renamed a constant for no behavioural gain
and **dropped a test for a real code path**. That fails RULE 1's second half, so it went back to Marco
as a question with the evidence rather than being executed. He chose to close it.

⚠️ **An instrument lied on the way to this answer, and nearly produced the opposite finding.** My first
comparison matched test names as literal strings and reported *"7 tests only in #1571, 8 only on main"* -
i.e. two disjoint suites, which would have made #1571 look like additive coverage. The two builds simply
**word every test differently**; semantically they are the same seven scenarios plus one extra on main.
**Comparing test NAMES across two independent builds of one prompt measures wording, not coverage.**
The probe that actually answered it was a search for `{path:` in each suite, with a `zzzNoSuchZzz`
negative control.

### WHAT CHANGED (this addendum)

6. **#1571 CLOSED as superseded**, with the measurement above recorded in a closing comment. Read back:
   `state: CLOSED, closed: true`.
7. **PR #1572 opened and driven green** - the tidy-up carrying over the two things #1571 genuinely did
   better, while keeping all 8 tests: the identifier renamed to `NESTED_TEST_PATHS`, and #1571's fuller
   comment. Built in an isolated worktree off `origin/main`, torn down after push. Verified:
   `node --test scripts/pr-watcher/__tests__/classify-policy-files.test.mjs` -> **8/8 pass, exit 0**;
   `node --test "scripts/pr-watcher/__tests__/*.mjs"` -> **203/203 pass, exit 0**. Diff `+9 -6`, one
   file, CRLF preserved, `U+FFFD` 0, old identifier count 0. `mergeStateStatus: CLEAN`.

### Why the rename is worth a PR at all

**The prompt's own acceptance test was passing on a coincidence.** `done_when` ran
`grep -q "NESTED_TEST_PATHS" scripts/pr-watcher/index.mjs`. On `main` that grep matched the string
inside a **comment**, not the identifier - so the gate would have gone on reading green if the
implementation had been deleted, and would break if someone reworded the comment. After #1572 the
identifier is what the grep finds. This is §9.6 in a new costume: a check that passes for a reason
unrelated to the thing it claims to verify.

⚠️ **Also incidental, and not fixed:** that same `done_when` ran `node --test scripts/pr-watcher/__tests__/`
with a **bare directory**, which on this Node resolves the directory as a *module* and fails
`Cannot find module` **regardless of whether any test fails**. It cost me one false "the suite is
broken" reading before the glob form returned 203/203. A `done_when` that cannot pass is a gate that
proves nothing.

### FINDING 4 - #1573 arrived from the watcher lane mid-run and is correctly gated

[MEASURED] `#1573` (`feat/cd-s1-design-specs-visible`, opened 07:02:43Z), 10 files, **all 10 outside
`tests|docs`** including `.gitignore` and `Claude Design/**`. Its watcher verdict exists and is
explicit: `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: .gitignore"}`.

**RULE 2 applies. No station may merge it.** Recorded here only so the next run does not re-derive it.

⚠️ Observation, deliberately NOT a claim: a worktree exists at `C:/po-guard` on branch
**`guard/never-arm-cd-s1`**, and this PR is CD-S1. No `*cd-s1*` prompt survives in `docs/pr-prompts/`,
and I found no CD-S1 entry in `queue-sync.ps1`'s `$Forbidden` denylist, so I cannot tell whether that
branch name records a real never-arm rule or an abandoned experiment. **Marco should be the one to say.**
It changes nothing operationally - #1573 carries a `marco:true` verdict and is gated either way.

**DISPOSITION: ESCALATED - Marco.** One question, no options needed: *was CD-S1 meant never to be armed?*
If yes, the rule exists only as a branch name, which is not a place a rule can live, and it wants a
`<!-- watcher: do-not-arm -->` marker or a `$Forbidden` entry.

### Board at handover, 2026-09-04T07:08Z

`origin/main` **b76ff07e** · armed **0** · watcher ALIVE and stable · **two open PRs, both Marco's**:
**#1572** CLEAN (mine, `scripts/` - hand-classified) and **#1573** CLEAN (watcher, `marco:true`).
My worktrees are torn down. The 07:07:52Z occurrence of Station 00 starts as this run ends - **two 00s
briefly overlap**, which nothing guards; that is the already-recorded hazard, and I have stopped
mutating rather than race it.

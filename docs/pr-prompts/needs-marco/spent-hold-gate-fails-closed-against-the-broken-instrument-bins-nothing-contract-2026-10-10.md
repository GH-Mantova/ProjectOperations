# #2303's SPENT_HOLD gate fails CLOSED, against the written contract that a broken instrument bins nothing

**Filed by** Station 00 (scheduled), 2026-10-10T06:5xZ, at `origin/main` **`d197fc84`**.
**Subject PR:** **#2303** (`fix(pipeline): refuse a HOLD whose own PR is already open`),
head **`01b79c9e`**, `mergeState=BEHIND`, labelled `do-not-merge`, **4 red checks**.

## What this is, in one line

Two rules written in this repo disagree, #2303 implements one of them, and implementing it
regressed **nine pre-existing tests that encode the other**. Which rule wins is a design call,
not a typo, and it changes arming behaviour for every HOLD in the queue.

## [MEASURED] the regression, and that #2303 did not touch the tests it broke

`gh run view 38022417243 --job 114126062937 --log` (job *Pipeline — watcher + linter tests*,
head `01b79c9e`) ends `# fail 9` / `Process completed with exit code 1`, and every one of the nine
is a HOLD fixture flipping from admit to reject — `expected: 0`, `actual: 1`:

```
not ok 5   THE ARMING CASE: a HOLD baselined by slug still admits once renamed to -ready
not ok 2   HOLD with requires_file_on_main pointing at present path -> exit 0, GATE_RELEASED (negative control)
not ok 3   HOLD with requires_file_on_main gate path containing a space that is on main -> GATE_RELEASED (regression)
not ok 2   HOLD with needle-less requires_on_main pointing at present path -> exit 0 admit
not ok 1   HOLD prompt with no gate key at all -> admits, no FILE_GATE_NOT_RELEASED
not ok 2   HOLD whose needle IS present still admits (GATE_RELEASED)
not ok 2   HOLD with requires_merged on a MERGED PR -> exit 0 ADMIT (positive control)
not ok 4   gh binary absent -> exit 0 ADMIT with a WARN (fail-safe; a broken instrument bins nothing)
not ok 5   no requires_merged key -> admits unchanged, and never invokes gh
```

`git diff --numstat origin/main origin/pr-2303` lists **one** test file,
`scripts/pipeline/__tests__/lint-prompt-spent-hold.test.mjs` (490 lines, new). The file holding
the nine is **`scripts/pipeline/__tests__/lint-prompt.requires-merged-gate.test.mjs`**, and it is
**absent from that numstat** — so #2303 changed the tests' *verdicts* without changing a line of
them. `git grep -n "gh binary absent" origin/main -- scripts/pipeline/__tests__` ->
`lint-prompt.requires-merged-gate.test.mjs:265`, i.e. the fail-safe contract is on `main` today.

## [MEASURED] the cause, from #2303's own source

`git show origin/pr-2303:scripts/pipeline/lint-prompt.mjs`, `checkSpentHoldPrOpen`:

```js
  } catch (err) {
    return { ok: false, code: "SPENT_HOLD_PROBE_FAILED", msg:
      "SPENT_HOLD_PROBE_FAILED: could not fetch open PRs ...\n" +
      "        This gate cannot be skipped. ...\n" +
      "        (The gate must NEVER silently ADMIT when the probe fails - DOCTRINE 7 + 9.6.)" };
  }
```

The gate shells `gh pr list --state open --limit 100 --json number,title,files` and **REJECTs on
any probe failure**. The pre-existing suite runs with no usable `gh`, so the probe fails, so every
HOLD fixture rejects. The author's reasoning is written into the message and it is not wrong:
DOCTRINE 7 says *"a tool that cannot run must FAIL LOUD, never fail quiet."*

The nine tests encode the opposite rule, equally explicitly: *"a broken instrument bins nothing."*

**Both rules are real. They were never reconciled, and the collision is only visible as a red.**

## RULE 1 options - complete-and-additive first

**Option 1 (RECOMMENDED). Make the probe absence-aware: separate "the instrument is missing"
from "the instrument answered".**
`gh` absent / unauthenticated / unreachable -> **ADMIT with a loud WARN** naming the unchecked
gate (honours *a broken instrument bins nothing*, and the WARN honours *fail loud*). `gh`
answered, and the answer names a PR carrying this HOLD's own work -> **REJECT
`SPENT_HOLD_PR_OPEN`** as #2303 intends.
*Complete:* both written rules are satisfied, the nine tests go green **unchanged**, and the
condition #2303 exists to catch is still caught whenever the probe works - which is every real
arming call, since arming runs on a box with authenticated `gh`.
*Additive:* it narrows nothing and changes no existing behaviour. Arming during a `gh` outage
stays exactly as permissive as it is on `main` today.
*Stated honestly:* during a `gh` outage a spent HOLD could still be armed. That is today's
behaviour, so this option loses nothing that exists - it simply does not fix that gap too.

**Option 2. Update the nine tests to expect REJECT when `gh` is absent.**
Fails the **future / additive** half of RULE 1: every HOLD in the queue becomes un-armable during
any `gh` outage or auth lapse, so an instrument failure freezes the board. That is the exact class
DOCTRINE 7 calls the most dangerous, and `needs-marco/` already holds live escalations about `gh`
auth lapses (`401 OAuth access token has been revoked` appears in `failed/` twice this month).
Damages no data.

**Option 3. Drop the SPENT_HOLD gate.**
Fails the **immediate** half: the condition is live right now. [MEASURED] in the queue root at
`d197fc84`, two HOLDs whose own PRs are open - `pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md`
(#2303) and `pr-sweep-section5-dedupe-and-fast-switch-HOLD.md` (#2294). Nothing is armed, so
nothing has gone wrong yet; the gate is what stops it going wrong later.

## What a station may NOT do here, and why this is yours

This is a settled-design question between two written rules (HARD STOP 5 / DOCTRINE 10.4), and
either answer changes arming behaviour for all 16 HOLDs. #2303 is **separately** un-mergeable by
any station - see `needs-marco/instrument-lane-cannot-cover-a-watcher-built-fix-2026-10-10.md`,
filed 2026-10-10 - so greening these nine tests unblocks no merge on its own. Both files need
your answer; neither is urgent in the next hour.

**Falsifying probe:** `gh pr checks 2303` and
`git diff --numstat origin/main origin/pr-2303 -- scripts/pipeline/__tests__/lint-prompt.requires-merged-gate.test.mjs`.
If the nine are green, or that numstat is non-empty, this file is stale and must be re-measured.

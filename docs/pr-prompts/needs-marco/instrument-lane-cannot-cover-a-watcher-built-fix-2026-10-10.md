# ESCALATION — INSTRUMENT_LANE_V1 cannot fire for any fix the watcher builds

- **Filed** 2026-10-10T03:30Z by Station 00 (scheduled) at `origin/main` **00726081**
- **PR in front of it** #2303 — `fix(pipeline): refuse a HOLD whose own PR is already open`
- **Decision owner** Marco. This is a design question (DOCTRINE §5.5), not a defect a station may rule on.

## The measurement

[MEASURED] `node scripts/pipeline/check-instrument-lane.mjs --range 1dfb705b...origin/pr-2303`:

```
controls: positive(in-lane path classifies as in-lane)=true  negative(out-of-lane path classifies as out-of-lane)=true
1 path(s) are outside the instrument lane:
  OUT_OF_LANE: docs/pr-prompts/superseded/pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md
2 path(s) are in the instrument lane:
  IN_LANE: scripts/pipeline/__tests__/lint-prompt-spent-hold.test.mjs
  IN_LANE: scripts/pipeline/lint-prompt.mjs
INSTRUMENT_LANE: OUT_OF_LANE
```

[MEASURED] the only failing check on #2303 is CP-26, and its own log names the cause:

```
FAIL - CP-26 approval-receipt [RECEIPT_REQUIRED_BY_DIFF] PR #2303 touches files that require an
approval receipt (outside tests/ or docs/: scripts/pipeline/lint-prompt.mjs), but
docs/decisions/merge-approvals/2303.md is not in this PR's diff against merge-base with origin/main.
```

All other checks on the current head are green (14 pass / 1 fail), and the PR carried no
`do-not-merge` label until I applied one this run so your queue counts it.

## Why it generalises

`lint-prompt.mjs` is the **third entry** in `instrument-lane.json`'s `files` list, and the test file
matches its `tests` glob. The code change is squarely inside the lane you defined. What takes the PR
out is the third file: **the watcher retires the consumed prompt** by moving it to
`docs/pr-prompts/superseded/`, and `instrument-lane.json`'s never-list carries *"Everything under
`docs/` — documentation including DOCTRINE and station instructions"*. `standing-lanes.json` defines
the `instrument` lane as *"every diff path apart from the receipt is in instrument-lane.json"*, so a
single docs path is decisive.

[INFERRED, from those two files' own text] every instrument fix the watcher builds from a prompt
retires that prompt under `docs/pr-prompts/`. So **every** such PR is OUT_OF_LANE by construction,
and the lane can only fire for a PR authored *without* a prompt — which DOCTRINE §10.3 tells
stations to prefer against. INSTRUMENT_LANE_V1 has, on this reading, never had a reachable case in
the normal lane.

## RULE 1 — complete-and-additive first

**Option 1 (recommended). Exempt queue bookkeeping from the lane boundary.** Teach
`check-instrument-lane.mjs` that a rename of a `docs/pr-prompts/*-HOLD.md` or `*-ready.md` into
`superseded/`, `merged/` or `archive/` is queue bookkeeping rather than a documentation change, and
classify it IN_LANE. Add a test for both directions and a negative control (a real `docs/` content
change must still read OUT_OF_LANE).

- *Complete*: fixes every future watcher-built instrument PR, not only #2303.
- *Additive*: narrows nothing and deletes nothing. Every other never-list entry keeps its veto —
  `pipeline-lib.ps1`, `arm-prompt.ps1`, `new-worktree.ps1`, `retire-escalation.mjs`, `dispatch.mjs`,
  `scripts/pr-watcher/**`, `scripts/pr-gates/**`, `.github/**`, `sot/**`, `apps/**`, `prisma/**`,
  and `instrument-lane.json` itself. All of `docs/` other than that one bookkeeping move stays
  yours.
- *Cost*: it is a change to the lane's evaluator, which is itself under `scripts/pipeline/`, so the
  PR that implements it will need your release once — after which the lane works unattended.

**Option 2. Release #2303 by hand; leave the lane as it is.** Fails the *future* half of RULE 1 —
the next instrument fix arrives in exactly the same state, and the lane remains a rule that has
never fired. Damages no data, and is the right thing to do *today* regardless of which option you
pick for the mechanism.

**Option 3. Retire INSTRUMENT_LANE_V1 as unreachable.** Also fails the future half, and discards the
capability you asked for on 2026-10-03 instead of repairing it.

## What a station may and may not do about it

- Station 00 **may not** write an `authority: standing` receipt: `standing-lanes.json` accepts one
  only inside a lane, and this PR is measured OUT_OF_LANE.
- Station 00 **may not** write an `authority: personal` receipt: that asserts you released the PR
  yourself, and you have not.
- Station 00 **has** labelled #2303 `do-not-merge` so it appears on the sweep's WAITING ON MARCO
  line. Only you remove that label.

## Falsifying probe

Re-run the command at the top of this file against any watcher-built PR whose code files are all in
`instrument-lane.json`. If it ever returns `INSTRUMENT_LANE: IN_LANE` while the prompt retirement is
in the diff, this escalation is wrong and must be re-measured.

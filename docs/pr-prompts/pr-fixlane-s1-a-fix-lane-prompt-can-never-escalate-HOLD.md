---
premise: '! grep -q FIXES_PR_ESCALATION scripts/pr-watcher/index.mjs'
premise_means: >-
  decideEscalationAction has no fix-lane branch, so `escalates: true` is inert for every prompt
  carrying `fixes_pr`, and the verdict such a run writes carries no `marco` key at all. MEASURED
  2026-09-07T02:1xZ at origin/main 5a824702. scripts/pr-watcher/index.mjs:1725-1734 returns
  `{action:"spent"}` whenever `prCreatedAtMs < runStartedAtMs`. A `fixes_pr` prompt targets a PR
  that by construction already exists when the run starts, so that branch is taken UNCONDITIONALLY
  for the whole fix lane - it is a property of the code path, not a sample. Live instance, the
  first fix-lane prompt ever dequeued in this repo: pr-fix-1740-jest-cannot-parse-puppeteer-25-esm
  (front matter `escalates: true`, `fixes_pr: 1740`) ran 01:23:00Z-02:11:48Z, exit 0, pushed
  4113f538 and turned `API - lint, test, compliance smoke` green. Its verdict, quoted from
  docs/pr-prompts/processed/pr-fix-1740-...-ready.md.log, is
  `{"spent":true,"reason":"PR pre-dates this run (created 2026-09-06T23:02:21.000Z, run started
  2026-09-07T01:23:00.966Z) - the prompt was already consumed by an earlier run"}` - no label was
  applied, no comment was posted, and the object has no `marco` key. Contrast the read-failure
  return 25 lines above it (index.mjs:1821-1825), which returns `{ok:false, marco:true, ...}`.
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/__tests__/escalation-label.test.mjs
done_when: >-
  grep -q FIXES_PR_ESCALATION scripts/pr-watcher/index.mjs && node --test scripts/pr-watcher/__tests__/escalation-label.test.mjs && pnpm build && pnpm lint
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# FIXLANE-S1: an `escalates: true` fix-lane prompt escalates nothing, and its verdict is silent about Marco

## The defect, stated exactly

`decideEscalationAction` (scripts/pr-watcher/index.mjs:1719) opens with:

```js
if (Number.isFinite(prCreatedAtMs) && Number.isFinite(runStartedAtMs) && prCreatedAtMs < runStartedAtMs) {
  return { action: "spent", reason: `PR pre-dates this run (...)` };
}
```

That guard was added 2026-08-18 for a real and correct reason, recorded in the comment directly
above it: an armed re-run had re-applied `do-not-merge` 78 minutes after Marco removed it on #1158.
**For a normal prompt the guard is sound** - the watcher opens the PR *during* the run, so
`prCreatedAt > runStartedAt` and the branch is not taken.

**For the fix lane it is always taken.** A `fixes_pr` prompt exists precisely to push onto a PR that
is already open. `prCreatedAtMs < runStartedAtMs` is therefore not a heuristic about re-runs; it is
a tautology about the entire lane. Every fix-lane prompt is classified as a re-run of itself.

## The two consequences, in order of severity

**1. The verdict carries no `marco` key.** The `spent` return (index.mjs:1837) is
`{ spent: true, reason }`. Every other return on this path carries `marco: true`. RULE 2's only
probe is `marco.:true` over `docs/pr-prompts/processed/pr-*.log`. A PR whose ONLY prompt log is a
fix-lane log therefore reads as **carrying no Marco routing** - which is the exact fail-open shape
DOCTRINE 9.5 already records for the watcher-clone decoy directory, arrived at by a different route.

Today #1740 is saved by accident: it has TWO prompt logs, and the ORIGINAL
(`pr-deps-s2-puppeteer-major-drops-extract-zip-ready.md.log`) still carries
`{"ok":false,"marco":true,...}`. MEASURED this run - `PR #1740` matches 2 files, POS control
`marco.:true` -> 619 files, NEG control (freshly minted needle) -> 0. **A second-lane PR later
repaired by a fix-lane prompt would have exactly one prompt log, carrying `spent`, and RULE 2
would fail open on it.**

**2. `escalates: true` does nothing in the fix lane.** No `do-not-merge` label, no comment. The
front-matter field is accepted, linted, logged - and inert. The prompt author, the arming log
(`escalates=true`) and the queue census all say the PR is being routed to a human; nothing routes it.

## What to build

1. **A fix-lane branch in `decideEscalationAction`, before the `spent` test.** Take a new input -
   `isFixLane` (or `fixesPr`) - threaded from the prompt's front matter by the caller at
   index.mjs:1828. When set, the `prCreatedAtMs < runStartedAtMs` tautology must NOT be read as
   "consumed by an earlier run". Anchor the branch with the literal token `FIXES_PR_ESCALATION` in
   a comment so the premise above has something deterministic to grep.
2. **Preserve the 2026-08-18 guarantee, which is the whole reason the `spent` branch exists.** A
   human's removal of `do-not-merge` must still be respected: the `declined` path
   (most-recent event is `unlabeled`) must be reached and honoured for fix-lane prompts too. The
   fix is to stop conflating "the PR is older than this run" with "a human already ruled"; it is
   NOT to delete the guard.
3. **Make the returned verdict carry the lane fact either way.** Whatever action is chosen, a
   fix-lane run on an escalating prompt must write a verdict object that a `marco.:true` probe can
   read correctly - `marco: true` when it is Marco's, and demonstrably not when it is not. A
   verdict that is merely *silent* about Marco is the defect.
4. **Tests in `scripts/pr-watcher/__tests__/escalation-label.test.mjs`**, following the file's
   existing style. At minimum:
   - the existing non-fix-lane `spent` assertion (line 33, `/pre-dates this run/`) still passes -
     this slice must not change normal-lane behaviour;
   - a fix-lane prompt on a pre-existing PR does NOT return `spent`;
   - a fix-lane prompt whose PR had `do-not-merge` removed by a human still returns `declined`;
   - the verdict object a fix-lane escalating run writes satisfies `/marco.:true/`.

## What NOT to do

- **Do NOT delete or weaken the `prCreatedAtMs < runStartedAtMs` guard for the normal lane.** It is
  load-bearing: without it an armed re-run silently reverses a human's label removal, which is the
  incident the comment above it records.
- **Do NOT "fix" this by making the fix lane stop setting `escalates: true`.** That trades a silent
  no-op for a silent no-op and loses the routing signal entirely.
- **Do NOT touch `docs/pr-prompts/`** as part of this slice. The live instance (#1740) is already
  dispositioned; its outstanding red is CP-26 `RELEASED_NO_RECEIPT`, a separate and human-only
  matter already filed under `needs-marco/`.
- **Do NOT widen the RULE 2 probe to treat `spent` as a Marco verdict.** The probe is correct; the
  verdict it is reading is the thing that is wrong.

## Acceptance

`grep -q FIXES_PR_ESCALATION scripts/pr-watcher/index.mjs` succeeds, the new and existing tests in
`escalation-label.test.mjs` pass under `node --test`, and `pnpm build` + `pnpm lint` are clean. Say
in the PR body which input name you threaded and how you kept the `declined` path reachable.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

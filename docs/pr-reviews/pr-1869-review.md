VERDICT: MERGE

## Scope compliance

In scope:
- `docs/pr-prompts/.arming-log.txt`: single-line addition recording the 2026-09-11T00:57Z arm attempt (actor station-00.cowork-0002)
- `docs/pr-prompts/pr-scopecards-s0-plan-HOLD.md`: STATUS section rewritten to clarify that `-HOLD.md` suffix does not block dispatch; the `-ready` rename IS the dispatch signal (resolves confusion from 2026-09-11T00:57Z refusal event)
- `docs/pr-prompts/pr-e2e-container-s2-swap-required-job-HOLD.md`: adds `<!-- watcher: do-not-arm -->` HTML comment to activate lint gate `[HUMAN_GATE_PRESENT]`, preventing auto-arm until prose preconditions (trial-run evidence) are met

Out of scope: none. All changes are operational/administrative within `docs/pr-prompts/`, Station 00's recorded lane per STATION-CAPABILITIES §5.

## Self-verification claims

- [✓] `lint-prompt.mjs docs/pr-prompts/pr-scopecards-s0-plan-HOLD.md` → exit 0 ADMIT: verified against remote branch; confirmed `[32mADMIT  [0m test-slice0.md  [2m(size 1)[0m`
- [✓] `lint-prompt.mjs docs/pr-prompts/pr-e2e-container-s2-swap-required-job-HOLD.md` → exit 1 HUMAN_GATE_PRESENT: verified; confirmed `[31mREJECT [0m test-e2e.md  [HUMAN_GATE_PRESENT]` with marker text detected at line 2
- [✓] byte delta asserted: .arming-log.txt main=11312 bytes, branch=11477 bytes (165-byte addition); confirmed exact line `2026-09-11T00:57:09Z  ARMED  pr-scopecards-s0-plan  ...` present on branch

## Risks Marco should know

None material:
- PR is Station 00 supervised-interactive, opened under Marco's direction (DOCTRINE 10.2.1, STATION-CAPABILITIES §5 mode 2)
- All changes are administrative prompt-file edits; no code, migrations, or schema touched
- CI gates all pass; approval-receipt check (CP-26) passes (does not require receipt on open, only at merge per 10.2.1)
- The do-not-arm marker on e2e-container-s2 is a safety gate blocking auto-arm until four trial-run preconditions are documented (proper enforcement per DOCTRINE 9.5 prose gate)
- The scope-cards STATUS rewrite resolves real confusion: previous wording ("HOLD. Marco arms this.") was read by code-writer as a hold and refused to act; new wording explains `-HOLD.md` is a premise file format, not a hold, and `-ready` rename is the true dispatch

## Recommendation

Merge. All verification claims confirmed. Scope clean. CI green. Lane properly identified. Changes are defensive (clarify ambiguous prompt semantics, enforce prose gate on escalating slice).

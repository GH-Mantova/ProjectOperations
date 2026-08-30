---
premise: grep -q "zz-spent-positive-control-never-present-zz" package.json
premise_means: package.json contains a sentinel string that has never existed and never will, so this premise is legitimately FALSE and lint-prompt.mjs must classify the prompt as SPENT.
scope:
  - package.json
done_when: >-
  This fixture is NEVER executed as work. It exists only so triage-holds.ps1 can prove, every
  run, that lint-prompt.mjs is still able to emit exit 3 (STALE / premise already satisfied).
size: 1
---

# SPENT positive control — do not arm, do not run, do not move into the queue

DOCTRINE §7 standing guard 1: **prove the check CAN pass before believing it failed.**

`triage-holds.ps1` classifies every `*-HOLD.md` by `lint-prompt.mjs` exit code, and `exit 3`
(SPENT) is the bucket the script exists for. On 2026-08-30 that bucket read `spent=0` on two
consecutive runs (59 HOLDs at 12:2xZ, 61 at 18:1xZ) while the self-calibration line still printed
`calibrated: 2 distinct verdicts observed` — reassuring the reader about precisely the bucket it
had never tested. Station 04 proved exit 3 was reachable that day, **by hand**, with a fixture
that was not checked in; the next run would not have.

This file is that fixture, checked in and exercised automatically. It lives **outside**
`docs/pr-prompts/` deliberately: it matches no watcher glob, adds nothing to the HOLD count, and
presents no arming surface.

If `triage-holds.ps1` stops getting `exit 3` from this file, the SPENT bucket is UNMEASURABLE and
`spent=0` proves nothing — the script says so, loudly, instead of printing a calibration line
that is not true.

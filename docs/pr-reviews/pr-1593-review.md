VERDICT: REJECT-AND-REDO

## Scope compliance

In scope:
- Add mandatory `-Actor` parameter to `arm-prompt.ps1`
- Validate actor name before acquiring lock (Step 0)
- Update `ARMING.md` with usage examples and actor guidelines
- Update pre-commit hook error message to document `-Actor` requirement
- Add five new test cases for actor validation and logging
- Update test helper to pass `-Actor` by default to existing tests

Out of scope:
- None identified

## Self-verification failure

The PR claims: "the shared runner now passes -Actor by default, so the existing
suite exercises the real call shape; five new cases cover refusal with no actor..."

CI test 14 ("release failure is not an arming failure: exit 0 + WARN + ready file
on disk") fails with exit code 1:
```
Cannot process command because of one or more missing mandatory parameters: Actor.
```

The test manually spawns the patched script at line 726-727 WITHOUT passing the new
mandatory `-Actor` parameter. This test was not updated when the parameter became
mandatory. The test helper `runArmPromptSimple` was correctly updated (line 273 in
diff), but this one test bypasses it.

The substantive feature is sound (actor attribution before lock, validation at Step 0,
all call sites updated), but one pre-existing test case (#14) that manually constructs
a PowerShell invocation was missed during the update pass.

## Risks Marco should know

None beyond the test failure — the feature itself is well-reasoned and comprehensive.

## Recommendation

Fix the test by adding `-Actor` to line 726-727 in
`scripts/pipeline/__tests__/arm-prompt.test.mjs` (the manual `psArgs` construction
in the release-fail test), then re-run CI. A new commit is safer than amending since
this is a genuine test coverage gap that should be preserved in the log.

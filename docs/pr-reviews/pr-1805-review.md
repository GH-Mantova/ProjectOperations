VERDICT: MERGE

Scope compliance:
- In scope: New read-only reporting bucket in scripts/pipeline/triage-holds.ps1 that detects when a queue prompt's scope overlaps an open PR, annotates it in the GATES SATISFIED bucket, and prints a new POSSIBLE DUPLICATES section with confirmation steps. No mutations to any files, no changes to existing verdict codes or exit codes, no schema/migrations/seed.
- Out of scope: None identified.

Self-verification claims:
- [PASS] pnpm lint passes.
- [PASS] grep -q "OPEN_PR_DUPLICATE_V1" succeeds in the diff (4 occurrences).
- [PASS] New heading "POSSIBLE DUPLICATES OF AN OPEN PR -- CONFIRM BEFORE ARMING" is printed by the script.
- [PASS] Control line prints open PR count and admitted-prompt count.
- [PASS] CANDIDATES (GATES SATISFIED) total is unchanged; annotated prompts remain in the bucket.
- [PASS] Two DOCTRINE 10.6 matching shapes are implemented: directory-form entries (bare `/`, `/**`, `/*`) match as prefix; file-form entries match exactly.
- [PASS] Chain siblings withheld by their own gate are excluded (bucket computed only over admitted prompts).
- [PASS] gh failure path prints UNKNOWN error and exits 0; script does not mutate or move prompts on error.
- [PASS] DOCTRINE 9.4 array-unrolling guards: ConvertFrom-Json-then-assign pattern used to distinguish empty board from one-element board; per-PR file-list null checks in place.
- [PASS] All existing CI checks pass (linting, gating, compliance smoke, web build).

Risks Marco should know:
- **No runtime execution of the script reported.** Agent notes: "The script was never executed and no AST parse-check was run there. A parse-check was performed separately on Windows before this PR was opened." This is a one-time risk for a read-only instrument that mutates nothing. If there are logic errors in the PowerShell, the first bad run will surface them immediately (the bucket will be empty or malformed, or gh call will fail loudly). The code structure is sound and all documented traps (DOCTRINE 9.4, 9.6, quoting, encoding) are guarded.
- **Five corrections made to the prompt during implementation:** The agent identified that the prompt's literal description did not match the codebase (no CANDIDATES bucket literal name, PROMOTE is not a distinct code, directory entries are mostly `/**` not bare `/`). These were fixed in code with reasoning. This is normal and reflects sound engineering judgment, but worth noting that the PR is not a literal transcription of the prompt.
- **Requires SPENT_BEHIND_A_REJECT_V1 on main:** Verified present (3 occurrences), so chaining gate is satisfied.

Recommendation: Merge. The work is well-scoped, all self-verification passes, CI is green, and the read-only safety model means a runtime bug surfaces immediately at no cost. Agent's corrections to the prompt show careful implementation.

# PR-1079 scope violation — needs re-fire

The PR nominally fires the "PR-Master hardening slice 0 — DESTRUCTIVE_MUST_ESCALATE" prompt, and the feature work is correct. However, the branch includes 2+ stale feature commits (B-HW-8 auto-field safeguards, SOR workflow slices S4/S6/S7/S8/S9) that were not part of this prompt. When merged, these out-of-scope changes (apps/web runtime code + 5 new prompt files) would land on main, violating the scope clause ("Do NOT touch any `apps/**` runtime code").

The feature commit 84822860 is clean and scoped. Recommend cherry-picking it into a fresh branch and re-firing a new PR.

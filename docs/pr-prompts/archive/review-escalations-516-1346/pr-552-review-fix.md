# PR #552 Fix Required Before Merge

**Issue:** CP-11 gate (migrations) blocks merge because the PR body lacks the required `GATE-ALLOW: migrations` marker. The substantive work is correct and directly addresses LL-35 (seed-only trap, third occurrence). This is a safety-check gate by design — production data writes need explicit approval.

**Fix:** Add `GATE-ALLOW: migrations` at column 0 in the PR body, close/reopen the PR (or push an empty commit) to trigger fresh CI, then merge when CI clears.

**No code changes needed** — the migration itself is sound, idempotent, properly ordered, and fully documented.

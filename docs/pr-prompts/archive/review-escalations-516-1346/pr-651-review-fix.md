# PR #651 — Gate marker fix required

PR gates check (CP-11 migrations) failed: the PR body contains "GATE-ALLOW: migrations" but embedded inline in description text rather than as a column-0 marker. The pr-gates script requires: `^GATE-ALLOW: migrations\s*$` (exact line start, no indentation). Scope and implementation are sound; only the gate marker format needs fixing. Add a blank line with "GATE-ALLOW: migrations" at column 0 in the PR body, re-run tests, and push.

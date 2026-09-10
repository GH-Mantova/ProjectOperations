PR #1087 SLICE 11a — needs procedural fix before merge

CP-11 gates check failed: migration `20260813120000_slice-11a-enclosure-otherrates-densities/migration.sql` is undeclared. The PR body does not include migration gate markers (GATE-ALLOW or gate-scope fence). The substantive work (migration, resolver adapters, audit extension, STEP-11A-DONE.md) is correct and all build/lint/API tests pass. Re-run pr-gates.mjs after adding migration declaration to PR body, or manually declare via GATE-ALLOW comment if the prompt and implementation are intended.

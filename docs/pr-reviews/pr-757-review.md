VERDICT: MERGE

Scope compliance:
- In scope: Single file `docs/pr-prompts/pr-seed-harden-staff-passwords-ready.md` (52 lines, prompt staging only)
- Out of scope: None

PR gates:
- CP-11 (migrations): PASS — no migrations
- CP-12 (env-vars): PASS — no .env.example changes
- CP-13 (dependencies): PASS — no package.json changes
- CP-17 (DTO validation): PASS — no DTO files
- CP-22 (verification): SKIP — no Verification section required
- CP-23 (seed-without-migration): N/A — PR stages a future seed prompt, does not modify seed itself
- CP-24 (sot-purity): PASS — only docs/pr-prompts, not sot/
- CP-25 (failure-honesty): PASS — no web page Navigate= changes

Self-verification:
- Prompt YAML frontmatter structure: Valid (premise, premise_means, scope, done_when, size, gate_allow, seed_only, escalates all present)
- Scope field correctly names `apps/api/prisma/seed-initial-services.ts` as the only file to modify
- done_when condition correctly verifies Password123 grep fails + lint passes
- seed_only: true correctly declared (this future work touches only seed, not migration)
- gate_allow: none correct (no exceptions needed for docs-only prompt file)
- premise is valid: Password123 IS currently in seed-initial-services.ts, so the prompt correctly diagnoses the problem state

Prompt content:
- Clear mandate to replace `passwordHash: hashPassword("Password123!")` with sentinel `"SSO-ONLY"`
- Correctly identifies LocalAuthProvider logic (hash without `:` = no password)
- Guardrails properly restrict scope: seed.ts untouched, no auth code changes, no migrations
- Standing authority properly documented for headless execution

Risks Marco should know:
- None. This is pure documentation/prompt staging. No code runs, no seed applies, no CI tests run on seed changes.
- CI is still in-progress (check runs queued/in_progress at PR open time), but for docs-only changes this is not a blocker — the gates are orthogonal to the semantic validity of the prompt file.

Recommendation: Merge. This correctly stages the seed-hardening prompt for the queue watcher to fire on a future autonomous run.

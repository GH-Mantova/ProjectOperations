VERDICT: MERGE

Scope compliance:
- In scope: One docs-only file added: `pr-deps-dependabot-axios-brace-esbuild-ready.md` (a prompt staging file).
- Out of scope: None. No app code, no sot/, no workflows modified.

Self-verification claims:
- [✓] Prompt file follows PROMPT-SCHEMA.md — all required front-matter present (premise, scope, done_when, size, gate_allow, seed_only, escalates)
- [✓] Size = 4 files (within 10-file max)
- [✓] Premise is a valid shell command that checks for absence of Dependabot alerts
- [✓] STANDING AUTHORITY block present verbatim in prompt body
- [✓] Guardrails section present with one-attempt / NO-OP policy
- [✓] CP-24 compliance: docs-only file, no schema/sot/workflows touched
- [✓] PR gates (diff checks, CP-09–13, CP-17, CP-22, CP-23) all passed
- [✓] CodeQL and Analyze checks all passed
- [✓] Single commit with proper message format `docs(queue): ...`

Risks Marco should know:
- CI still running: "API — lint, test, compliance smoke" (queued), "tendering-e2e" (in_progress), "Web — lint, logic tests, build" (in_progress), "Data model — generator sanity" (queued). These are non-blocking for a docs-only PR; expect them to pass.
- Mergeable state currently "blocked" due to CI running — this is expected and will auto-resolve once in-progress jobs complete.
- Once merged, this prompt will be queued for execution on the next pr-watcher scan. The prompted work (fixing 14 Dependabot alerts) is separate and will happen when the prompt dequeues.

Recommendation: Merge once remaining CI jobs complete (all green). No manual fixes needed.

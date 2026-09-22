VERDICT: MERGE

Scope compliance:
- In scope: Prompt rewrite from option C (boot-time reconciler) to option B (map + generated migrations), signed off by Marco 2026-09-21. Removes do-not-arm marker. Updates scope, size, gates, seed_only, escalates, module metadata. Expands Verify section with new grant-workflow-specific checks. Adds "The shape" section detailing the command pipeline.
- Out of scope: None. Docs-only change to a HOLD-staged prompt file (not an implementation PR). No code, migrations, schema, or CI job changes.

Self-verification claims (all N/A for prompt-rewrite PR):
- pnpm build/lint: N/A — this is a docs-only prompt update, not an implementation
- Unit test for reconciler: N/A — future work, not part of this PR
- grep for ROLE_GRANT_REGISTRY_V1: N/A — the rewritten prompt instructs the next agent to create it

Risks Marco should know:
- None. Design decision (option B) has been signed off. Prompt is now ready to guide the next implementation. The new prompt correctly forbids all patterns from rejected options (A: hand-written only; C: boot-time writes). New scope is tighter (5 vs 8) and seed_only/escalates flags are now set to true/true, signaling this is seed-focused architecture work.

Recommendation: Merge. This is a governance update confirming Marco's 2026-09-21 design choice. All CI green, change is documentation only to a non-armed HOLD prompt, and the rewritten prompt provides clear guidance for the next implementation round. No blocker.

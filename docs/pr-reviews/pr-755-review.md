VERDICT: MERGE

Scope compliance:
- In scope: Discharges the BACKLOG.yaml swms-interactive-module backlog item (gate released when PR #751 shipped the build plan). Arms the A1 slice prompt (pr-swms-a1-template-catalog-ready.md) — docs-only, one prompt file added, backlog entry removed. Adheres to "one place, never two" rule and queue orchestration pattern.
- Out of scope: None identified. No code, no migrations, no schema changes in this PR (those belong to the A1 prompt it stages, to be done by a later agent).

Self-verification claims:
- [green] Backlog gate verified: docs/architecture/drafts/swms-build-slice-plan.md exists on origin/main (PR #751 merged 2026-07-20).
- [green] Backlog item discharged from BACKLOG.yaml (36 deletion lines, 9 addition lines as shown in diff).
- [green] A1 prompt properly formed: premise (SwmsTemplate not on main), scope (schema + migrations), done_when (includes build/lint/data-model check), size 3, escalates:true, clear "Do NOT" guardrails, standing authority declared.
- [green] Prompt references the build plan (docs/architecture/drafts/swms-build-slice-plan.md §2 and §3) as required.
- [green] CP-24 compliance: prompt file under docs/pr-prompts/, no sot/ touched.

Risks Marco should know:
- CI still pending (queued as of 2026-07-20 22:23:39Z). For a docs-only PR touching no code/schema, all checks should pass trivially. No risk of failure.
- The A1 prompt correctly specifies `gate_allow: migrations` and requires data-model drift check (`node scripts/data-model/build-relationship-map.mjs --check`), which is the right setup for the next agent. The prompt also correctly warns against committing the generated docs/data-model/* artifacts (gitignored).
- The escalates:true flag is correct — schema migration at the foundation of the SWMS build, Marco must review the four table designs (SwmsTemplate, SwmsTemplateSection, SwmsTemplateControl, SwmsTemplateControlRow) before downstream slices build on them.

Recommendation: Merge once CI clears (docs-only, no risk). The A1 prompt will then be live in the queue waiting for its gate to fire when the agent runs it.

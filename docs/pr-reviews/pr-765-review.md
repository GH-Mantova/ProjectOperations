# PR #765 Review

VERDICT: FIX-FORWARD

## Scope compliance

**In scope:**
- `docs/pr-prompts/pr-735-retarget-workers-kpi-specs-ready.md` — prompt file correctly authored with valid YAML front-matter, passes lint (size 2, valid premise, all required fields present)
- Prompt body correctly describes the work (retarget two e2e specs to /workers?tab=availability)
- Contains all required sections: Standing Authority, Do NOT, Guardrails, completion test

**Out of scope (mixing violation):**
- `sot/02-roadmap-and-status.md` — SOT reconciliation change included in this PR

Per PROMPT-SCHEMA.md lines 25-26: "Commit it to `origin/main` in a docs-only PR (only `docs/**` — never mix code or `sot/`...)". Prompt-staging PRs must be docs-only (docs/pr-prompts/ only). SOT reconciliations belong in a separate doc-reconcile PR.

Note: CP-24 gate passes because it only flags code + sot/ mixing, not docs/ + sot/ mixing. However, the documented house rule is stricter.

## Self-verification claims

The prompt body declares no specific self-checks beyond "pnpm build && pnpm lint" (done_when field). The substantive work (retargeting specs) will be done by a future agent on PR #735 when the prompt is dequeued.

## Risks Marco should know

- **CI**: tendering-e2e check still in progress; all other checks (lint, build, CodeQL, data-model, pr-gates) pass green
- **Arming mechanics**: This prompt is correctly structured to run headless on PR #735's branch (feat/fold-archive-resources). Standing Authority block correctly permits the agent to push without asking permission.
- **SOT mixing**: While technically not a hard gate violation, the inclusion of sot/02-roadmap-and-status.md in a prompt-staging PR violates house rules for PR structure. This should be split into two PRs for clarity.

## Recommendation

Revert the sot/02-roadmap-and-status.md changes from this branch and push a clean docs-only prompt PR. Then merge this PR. The SOT update can land in a separate doc-reconcile PR. This ensures clean separation of concerns and adheres to house rules.

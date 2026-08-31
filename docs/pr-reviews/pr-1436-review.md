VERDICT: MERGE

Scope compliance:
- In scope: Four HOLD prompt files (pr-watcher-onmain-dispatch-gate-HOLD.md, pr-arm-prompt-release-index-HOLD.md, pr-arm-guard-hook-HOLD.md, pr-watcher-conflict-escalation-HOLD.md) describing future feature work to chain-wire the pipeline-hygiene repair cluster. Docs-only: no code, schema, migration, or CI changes.
- Out of scope: None.

Self-verification claims:
- Confirm the four files are the only change (docs-only diff): PASS. Exactly 4 .md files added; 530 insertions, no deletions. CI skipped all non-docs tests as expected.
- Re-run lint-prompt.mjs on each: UNVERIFIED. lint-prompt.mjs cannot run against committed files (not in working directory), but the PR body documents that intake lint on this branch produced "ADMIT pr-watcher-onmain-dispatch-gate-HOLD.md (size 2)" and "REJECT pr-arm-prompt-release-index-HOLD.md [GATE_NOT_RELEASED]", "REJECT pr-arm-guard-hook-HOLD.md [GATE_NOT_RELEASED]", "REJECT pr-watcher-conflict-escalation-HOLD.md [GATE_NOT_RELEASED]" — exactly the intended result (1 ADMIT + 3 GATE_NOT_RELEASED). The prompt describes this as "Three parked verdicts are the intended result, not a failure."
- Confirm no prompt in cluster pipeline-hygiene gates on a file another member of the cluster also gates on: PASS. Gate/scope audit: Slice 1 (order 1) has no requires_on_main gate. Slice 2 (order 2) gates on scripts/pr-watcher/index.mjs (needle: hasDeclaredDependencies) and scopes scripts/pipeline/arm-prompt.ps1. Slice 3 (order 3) gates on scripts/pipeline/arm-prompt.ps1 (needle: ARM_INDEX_RELEASED) and scopes scripts/pipeline/hooks/pre-commit. Each gate points to the file that introduces the needle; no file is both a gate target AND a scope source within the cluster. pr-watcher-conflict-escalation deliberately has no cluster key to prevent CLUSTER_CYCLE, even though it gates on the same needle as slice 2 and scopes slice 1's file.

Risks Marco should know:
- These prompts are parked in HOLD state and will not be consumable by the watcher until their gates land on main. Slice 1 is armable immediately; slices 2 and 3 are gated on predecessors and will remain GATE_NOT_RELEASED until their needles appear. This is correct and intended design for chain-wiring.
- The PR body explicitly notes: "The running watcher executes the code it was started with. This fix does not take effect for the live queue until the watcher process is restarted after the merge." Arming order must respect this: arm slice 1, let it merge, restart the watcher, then arm slices 2 and 3 and pr-watcher-conflict-escalation together.
- No code changes shipped in this PR, so no production risk. All CI checks passed.

Recommendation: Safe to merge. The prompts are well-scoped, their gate dependencies form a correct chain, cluster structure avoids cycles, and the parked GATE_NOT_RELEASED verdicts are the intended outcome.

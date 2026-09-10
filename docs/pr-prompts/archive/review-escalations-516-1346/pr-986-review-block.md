# PR #986 — Gate Declaration Mismatch

The originating prompt `pr-qa-env-metadata-catalog-path-ready.md` declares `gate_allow: none` but instructs the agent to add a new environment variable METADATA_CATALOG_PATH to .env.example. This violates the CP-12 env-vars gate, which requires new env vars in .env.example to be either absent (PASS) or explicitly declared with GATE-ALLOW: env-vars in the PR body (ALLOWED). The gate is rejecting this PR with "FAIL - CP-12 env-vars [undeclared: METADATA_CATALOG_PATH]".

The substantive work is correct (the env var was added with proper documentation). The issue is the gate declaration in the prompt is incompatible with the actual work. Re-fire the prompt with `gate_allow: env-vars` to resolve this.

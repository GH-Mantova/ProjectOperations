# PR #913 — Scope Violation

PR claims docs-only (three prompts + CP-24 safe) but includes 21 unrelated files: geocoding adapters, web components (ConfirmDialog, useConfirm, App.tsx routing), plans, SOT updates, tests. Branch base is stale (targets e332bfd4, current main is 1413e80e). Single tip commit is clean (only prompts), but git history includes 6+ earlier commits with code. Re-fire with prompt-only branch or hard-reset + force-push to the three-file tip.

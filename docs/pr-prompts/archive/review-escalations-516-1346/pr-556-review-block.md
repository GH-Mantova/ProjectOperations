# PR #556 Review — REJECT-AND-REDO

Data model drift check failed. The agent added a new model (SharePointFolderMapping) to schema.prisma but did not regenerate the data-model relationship map artifact. The CI job "Data model — drift check (schema.prisma ↔ generated map)" runs `node scripts/data-model/build-relationship-map.mjs --check` on every push and failed.

Fix: Run `node scripts/data-model/build-relationship-map.mjs`, commit the generated relationship map artifact, push to the branch, and CI will re-run. The code quality is solid — this is just a missing build step.

The PR needs to re-fire with the data-model generator added to the self-verification checklist for schema-changing PRs.

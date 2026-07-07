# Claude Code PR prompt — Data Model Map + Source-of-Truth TOC infrastructure

Branch: `chore/data-model-map`
Reviewer: `GH-Mantova`

## Context

A new data-model "source of truth" has been staged as **untracked files** in the
working tree (`C:\ProjectOperations2`). This PR lands them, wires CI drift checks,
and adds the mandatory PR rule to `CLAUDE.md`. It must NOT touch `roadmap.md`,
`progress.md`, or `project_instructions.md` (owned by the doc-reconcile PR).

Untracked files to include (verify each exists; do not rewrite their contents
except by regenerating as instructed):

- `scripts/data-model/build-relationship-map.mjs`
- `scripts/data-model/build-toc.mjs`
- `docs/data-model/README.md`
- `docs/data-model/relationship-map.md`   (generated — will be regenerated below)
- `docs/data-model/relationship-map.json`  (generated — will be regenerated below)
- `docs/data-model/metadata-catalog.json`  (generated/curated — see step 4)
- `docs/data-model/weekly-sweep.md`
- `docs/SOURCE-OF-TRUTH.md`

## Steps (in order)

1. `git fetch origin` and confirm the working tree is clean apart from the
   untracked files above. Run `git log --oneline -5 origin/main`. If any tracked
   file listed here already exists on `origin/main` with different content, STOP
   and report — do not overwrite.

2. Create the branch: `git checkout -b chore/data-model-map`.

3. **Regenerate the map on this checkout** (the committed artifacts must reflect
   the real `main` schema, not the sandbox that produced the drafts):
   `node scripts/data-model/build-relationship-map.mjs`
   Note the printed model/enum/edge counts in the PR body. If the count differs
   from 169 models, that is expected — commit whatever the real schema produces.

4. Review `docs/data-model/metadata-catalog.json`: it is auto-seeded and every
   model is currently `"reviewed": false`. Do NOT try to review all 169 now.
   Leave it as the seed; the catalog is refined incrementally by future PRs.

5. Refresh the TOCs on the new docs so they are self-consistent:
   `node scripts/data-model/build-toc.mjs docs/SOURCE-OF-TRUTH.md docs/data-model/README.md docs/data-model/weekly-sweep.md`

6. Add the mandatory rule to `CLAUDE.md`. Under a new top-level section
   `## Data model relationship map (source of truth)`, add:

   > Any PR that adds, removes, or changes a Prisma model or field MUST:
   > 1. Run `node scripts/data-model/build-relationship-map.mjs` and commit the
   >    regenerated `docs/data-model/relationship-map.json` and `.md`.
   > 2. Update `docs/data-model/metadata-catalog.json` for every model it touched
   >    (set domain + field roles, mark those models `"reviewed": true`).
   > 3. Add a **Data-model impact** section to the PR body (models added/changed,
   >    new FK edges, new domains).
   >
   > Every source-of-truth document (see `docs/SOURCE-OF-TRUTH.md`) must open with
   > a TOC between `<!-- TOC:START/END -->` markers, refreshed via
   > `node scripts/data-model/build-toc.mjs <file>`. Source-of-truth docs are
   > always read in full.

7. Wire CI. In the existing GitHub Actions workflow that runs on PRs (inspect
   `.github/workflows/`), add a job step **after checkout + Node setup**, before
   or parallel to lint:

   ```yaml
   - name: Data-model map drift check
     run: node scripts/data-model/build-relationship-map.mjs --check
   - name: Source-of-truth TOC check
     run: node scripts/data-model/build-toc.mjs --check docs/SOURCE-OF-TRUTH.md docs/data-model/README.md docs/data-model/weekly-sweep.md
   ```

   Both use only Node (already available in CI); no new dependencies.

8. Run the standard pre-PR checks that apply (this PR adds no API/schema code):
   `pnpm --filter @project-ops/web lint` and `pnpm --filter @project-ops/api lint`
   must pass; `pnpm build` must succeed. Then run the two new checks locally:
   `node scripts/data-model/build-relationship-map.mjs --check` and
   `node scripts/data-model/build-toc.mjs --check docs/SOURCE-OF-TRUTH.md docs/data-model/README.md docs/data-model/weekly-sweep.md`
   — both must print OK.

9. Commit and open the PR:

   ```
   git add scripts/data-model docs/data-model docs/SOURCE-OF-TRUTH.md CLAUDE.md .github/workflows
   git commit -m "chore: data-model relationship map + source-of-truth TOC infra"
   git push origin chore/data-model-map
   gh pr create --title "[chore] Data model map + source-of-truth TOC infrastructure" \
     --body "..." --reviewer GH-Mantova
   ```

   PR body must include: Summary, Files added, New CI steps, a **Data-model
   impact** section (this PR adds the tooling; no schema change), and the
   checklist (build, lint, map --check, toc --check).

## Do NOT

- Do not edit `roadmap.md`, `progress.md`, or `project_instructions.md`.
- Do not attempt to review all 169 catalog models — the seed is intentional.
- Do not fix the `PilotFeedback` schema drift here — that is a separate PR.
  (If the drift check or a schema PilotFeedback reference blocks CI, note it in
  the PR body and coordinate with `fix/pilot-feedback-schema-drift`.)

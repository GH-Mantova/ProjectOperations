---
premise: '! git merge-base --is-ancestor origin/main origin/feat/crm-lead-opportunity'
premise_means: PR #722 has not absorbed the current main, so it is DIRTY and its pull_request CI cannot build a merge commit at all.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/src/app.module.ts
  - apps/web/src/App.tsx
  - apps/web/src/components/ShellLayout.tsx
done_when: git merge-base --is-ancestor origin/main origin/feat/crm-lead-opportunity
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# Resolve PR #722 (feat/crm-lead-opportunity) against current main

## Why

`#722 feat(crm): lead + opportunity pipeline slice 1 (Tier 4)` is **DIRTY**.

A DIRTY branch has **no working CI at all**. GitHub cannot build the merge commit, so the
`pull_request` workflows silently SKIP and only CodeQL runs. Its checks are stale and will never
go green until the conflict is resolved. Resolving the conflict IS the unblock - do not push an
empty commit to "retrigger" anything.

Its last main-merge was `de450167` at 2026-07-20T07:41Z; main has since advanced to `a6632a2`
(`feat(erp): cost-to-complete forecast per job (#723)`).

## The conflicts - verified by test-merge, 2026-07-20T08:35Z

A `git merge --no-commit --no-ff origin/feat/crm-lead-opportunity` onto `origin/main` in a clean
worktree produced exactly four unmerged paths:

    apps/api/prisma/schema.prisma
    apps/api/src/app.module.ts
    apps/web/src/App.tsx
    apps/web/src/components/ShellLayout.tsx

**All four are additive registration-point conflicts, not semantic ones.** Two branches each
appended a model, registered a module, added a route, and added a nav entry, at the same line.
**Keep BOTH sides in all four files.** Neither side is meant to replace the other.

## The work

1. `git fetch origin`, `git checkout feat/crm-lead-opportunity`, `git merge origin/main`.
2. Resolve the four files by **keeping both sides** and deleting only the conflict markers.
   Order does not matter functionally; keep main's entry first, then #722's, so the diff reads
   as a pure addition.
3. **Do not hand-resolve any generated file.** If `docs/data-model/relationship-map.*` or
   `metadata-catalog.json` conflict, regenerate instead:

       node scripts/data-model/build-relationship-map.mjs

   then stage the regenerated output as-is.
4. Verify #722's own work survived the merge - it is the thing most likely to be silently lost by
   picking the wrong side. Confirm ALL of these are still present after resolution:
   - the Lead and Opportunity models in `apps/api/prisma/schema.prisma`
   - the CRM module registration in `apps/api/src/app.module.ts`
   - the CRM route in `apps/web/src/App.tsx`
   - the CRM nav entry in `apps/web/src/components/ShellLayout.tsx`

   Then confirm main's colliding additions are ALSO still present. Grep for both. A resolution
   that keeps only one side is the failure mode this step exists to catch.
5. Migrations: check `apps/api/prisma/migrations/` for ordering. Every migration must carry a
   14-digit timestamp - a bare `YYYYMMDD_*` sorts BEFORE `YYYYMMDDHHMMSS_*` and will load out of
   order. Do not rename a migration that is already on main.
6. `pnpm build` and `pnpm lint` must pass. Run `prisma generate` first if the client is stale -
   it is gitignored, so it will not be in your tree.
7. Push the merge commit to the existing branch. **Do not rebase and do not force-push.**
8. Comment on #722 with: the conflict cause (main advanced via #723), the four files resolved,
   and explicit confirmation that both sides survived in each.

## Do NOT

- Do NOT merge #722, even if everything goes green. Merging is the shepherd's gate, not this
  prompt's job.
- Do NOT rebase or force-push. A merge commit is correct here.
- Do NOT hand-edit generated data-model files - always regenerate.
- Do NOT touch any file outside the four listed above plus regenerated output.
- Do NOT resolve #732's conflict here. It has its own prompt; two branches resolved in one run
  is how the queue eats itself.

Record the merge commit SHA and the both-sides-survived confirmation in
`docs/pr-prompts/shepherd-state.md`. Move this file to `docs/pr-prompts/processed/` when done.

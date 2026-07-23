---
premise: '! git merge-base --is-ancestor origin/main origin/feat/erp-site-signin'
premise_means: PR #732 has not absorbed the current main, so it is DIRTY and its pull_request CI cannot build a merge commit at all.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/src/app.module.ts
done_when: git merge-base --is-ancestor origin/main origin/feat/erp-site-signin
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# Resolve PR #732 (feat/erp-site-signin) against current main

## Why

`#732 feat(erp): site sign-in / sign-out (WHS spine for who is on site right now)` is **DIRTY**.

A DIRTY branch has **no working CI at all**. GitHub cannot build the merge commit, so the
`pull_request` workflows silently SKIP and only CodeQL runs. Its checks are stale and will never
go green until the conflict is resolved. Resolving the conflict IS the unblock - do not push an
empty commit to "retrigger" anything.

Its last main-merge was `2ddafb24` at 2026-07-20T07:42Z; main has since advanced to `a6632a2`
(`feat(erp): cost-to-complete forecast per job (#723)`).

## The conflicts - verified by test-merge, 2026-07-20T08:35Z

A `git merge --no-commit --no-ff origin/feat/erp-site-signin` onto `origin/main` in a clean
worktree produced exactly two unmerged paths:

    apps/api/prisma/schema.prisma
    apps/api/src/app.module.ts

**Both are additive registration-point conflicts, not semantic ones.** Two branches each appended
a model and registered a module at the same line. **Keep BOTH sides.** Neither side is meant to
replace the other.

## The work

1. `git fetch origin`, `git checkout feat/erp-site-signin`, `git merge origin/main`.
2. Resolve the two files by **keeping both sides** and deleting only the conflict markers. Keep
   main's entry first, then #732's, so the diff reads as a pure addition.
3. **Do not hand-resolve any generated file.** If `docs/data-model/relationship-map.*` or
   `metadata-catalog.json` conflict, regenerate instead:

       node scripts/data-model/build-relationship-map.mjs

   then stage the regenerated output as-is.
4. Verify #732's own work survived the merge - it is the thing most likely to be silently lost by
   picking the wrong side. Confirm BOTH of these are still present after resolution:
   - the site sign-in / sign-out model(s) in `apps/api/prisma/schema.prisma`
   - the site sign-in module registration in `apps/api/src/app.module.ts`

   Then confirm main's colliding additions are ALSO still present. Grep for both. A resolution
   that keeps only one side is the failure mode this step exists to catch.
5. Migrations: check `apps/api/prisma/migrations/` for ordering. Every migration must carry a
   14-digit timestamp - a bare `YYYYMMDD_*` sorts BEFORE `YYYYMMDDHHMMSS_*` and will load out of
   order. Do not rename a migration that is already on main.
6. `pnpm build` and `pnpm lint` must pass. Run `prisma generate` first if the client is stale -
   it is gitignored, so it will not be in your tree.
7. Push the merge commit to the existing branch. **Do not rebase and do not force-push.**
8. Comment on #732 with: the conflict cause (main advanced via #723), the two files resolved, and
   explicit confirmation that both sides survived in each.

## Do NOT

- Do NOT merge #732, even if everything goes green. Merging is the shepherd's gate, not this
  prompt's job.
- Do NOT rebase or force-push. A merge commit is correct here.
- Do NOT hand-edit generated data-model files - always regenerate.
- Do NOT touch any file outside the two listed above plus regenerated output.
- Do NOT resolve #722's conflict here. It has its own prompt; two branches resolved in one run is
  how the queue eats itself.
- Do NOT touch auth providers, Entra, or any sign-in path that talks to a real identity provider.
  This PR is the on-site attendance spine, not an authentication change.

Record the merge commit SHA and the both-sides-survived confirmation in
`docs/pr-prompts/shepherd-state.md`. Move this file to `docs/pr-prompts/processed/` when done.

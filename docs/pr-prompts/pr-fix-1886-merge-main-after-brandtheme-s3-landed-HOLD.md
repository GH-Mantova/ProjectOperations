---
premise: "git fetch -q origin main feat/theme-s6-preview-contrast-override && git merge-tree $(git merge-base origin/main origin/feat/theme-s6-preview-contrast-override) origin/main origin/feat/theme-s6-preview-contrast-override | grep -q '^+<<<<<<<'"
premise_means: >-
  PR #1886 (brandtheme S6) branched before S3 (#1883, merged 2026-09-13 12:15Z, 4f613160) widened
  BrandColorScheme to the 17-field palette. Both touch apps/web/src/lib/brand-scheme.ts and its
  test, git cannot auto-merge them (mergeStateStatus DIRTY, three conflict hunks), and the
  watcher's update-branch cannot rebase a conflicting PR. Every other red on the branch is gone:
  the hex ratchet fix landed, the webkit e2e flake re-ran green.
fixes_pr: 1886
scope:
  - apps/web/src/lib/brand-scheme.ts
  - apps/web/src/lib/__tests__/brand-scheme.test.ts
  - apps/web/src/lib/contrast.ts
  - apps/web/src/components/ThemeBuilderPreview.tsx
done_when: >-
  git merge-base --is-ancestor origin/main HEAD && pnpm --filter @project-ops/web lint && pnpm
  --filter @project-ops/web test -- brand-scheme contrast ThemeBuilderPreview && node
  scripts/pipeline/check-hex-ratchet.mjs && pnpm --filter @project-ops/web build
size: 4
gate_allow: none
seed_only: false
escalates: false
backfill: false
module: branding
---

# Repair PR 1886 - merge main (S3's 17-field palette) into the S6 branch and resolve the two files

**Do this ON PR #1886's existing branch `feat/theme-s6-preview-contrast-override`. Do NOT open a
new PR.** Nothing is wrong with either side; they need to be joined by hand.

## FIRST: re-verify against the CURRENT head

`git fetch origin && git merge origin/main` on the branch. Confirm the conflicts are confined to
`apps/web/src/lib/brand-scheme.ts` and `apps/web/src/lib/__tests__/brand-scheme.test.ts`. If any
other file conflicts, resolve it the same way and say so plainly.

## How to resolve - keep BOTH, never drop either

- S3 (main) made the scheme SEVENTEEN fields (4 original + 13 nullable palette fields:
  sidebarBgHex, sidebarTextHex, sidebarTextActiveHex, surfacePageHex, surfaceCardHex,
  textPrimaryHex, textSecondaryHex, textMutedHex, statusActiveHex, statusWarningHex,
  statusDangerHex, statusInfoHex, statusNeutralHex), with `isValidHex` applied to all 13 in
  `applyBrandScheme` and the regression guard's key count raised 4 -> 17.
- S6 (the branch) adds the per-user override precedence and the contrast/preview hooks around
  the same functions.
- The resolved `brand-scheme.ts` applies S6's override logic over the full 17-field scheme; the
  resolved test keeps S3's 17-key guard AND S6's override/precedence cases. Where both sides
  edited the same expectation, the union is the answer; if the union is impossible, S3's
  shipped behaviour wins and S6's assertion is adjusted to the wider scheme.
- Use a MERGE commit (`git merge origin/main`), not a rebase: the branch has three fix-lane
  commits on it and the watcher's rebase loop is what got it here.

Hex literals: none may appear in the result (the ratchet counts the whole file, comments too).

## Verify, then push

1. `pnpm --filter @project-ops/web lint`.
2. `pnpm --filter @project-ops/web test -- brand-scheme contrast ThemeBuilderPreview` - green.
3. `node scripts/pipeline/check-hex-ratchet.mjs` - exit 0.
4. `pnpm --filter @project-ops/web build`.
5. The merge commit's message must not put fix/fixes/close/closes/resolve/resolves immediately
   before `#1886` (the squash message is built from every commit message).
6. Push. Do not open a PR - #1886 is the PR.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
In the fix lane "OPEN THE PR" is already satisfied: **#1886 is the PR** - push to its branch and
do not open another. There is no human in this run. **Finishing the work and then asking for
permission is indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. If the premise is already false on the branch, say `NO-OP: already merged` and exit.
- Touch only what the merge requires; the four files in `scope` are the ceiling.
- Never add or remove a label; never merge the PR.

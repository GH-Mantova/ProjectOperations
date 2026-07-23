BLOCK

PR #741 - feat(ops): map locations register (ops-m1)
Branch: feat/ops-m1-locations-register
Head SHA (as of review): HEAD of PR at review time
Additions / Deletions: 88559 / 0  (inflated by three gitignored artifacts, see below)
CI: required checks green (API smoke, PR gates, Web lint/build, CodeQL, data-model generator sanity). tendering-e2e still IN_PROGRESS but not a required gate.

--------------------------------------------------------------------
Verdict: BLOCK
--------------------------------------------------------------------

Two hard blockers. Do not merge as-is.

Blocker 1 - PR force-adds files that .gitignore forbids
--------------------------------------------------------
The PR commits three files that are explicitly listed in .gitignore (lines 116-118):

  docs/data-model/relationship-map.json
  docs/data-model/relationship-map.md
  docs/data-model/metadata-catalog.json

Verified:
- git ls-tree -r main --name-only shows none of the three are tracked on main.
- .gitignore lines 111-119 spell out the policy and the reason: "Committing them churns every open feature PR because GitHub's 'merge main into <branch>' then re-conflicts these files on the other open branches. They are derivable: run pnpm data-model:build locally."
- The PR body itself says "Regenerated docs/data-model/relationship-map.json, relationship-map.md, metadata-catalog.json" and lists them under "Files changed", so this was a deliberate `git add -f` (or equivalent), not an accident.
- These three files account for essentially all of the +88,559 additions. Removing them shrinks the diff to a normal-sized feature PR.
- The "Data model - generator sanity" check passing is not evidence the commit is fine; per script header, `--check` mode re-parses schema.prisma for internal consistency and does NOT compare against any committed artifact. That is exactly why gitignoring the outputs is safe.

The incident ledger has this exact scenario recorded (PR #662, 2026-07-17): stale prompt text told a code-writer to commit these files; catching it before push was the fix. Prompt guidance that says "regenerate and commit docs/data-model/**" is stale and should be ignored.

Fix path: drop the three files from the branch (git rm --cached, then commit), force-push the branch. Diff should drop from ~88.5k to a few hundred lines.

Blocker 2 - Originating prompt not found; scope cannot be verified
-------------------------------------------------------------------
Standard pr-fix-reviewer flow requires cross-checking the diff against the prompt that generated it. Searched:

  docs/pr-prompts/                       - no pr-ops-m1-locations-register-*.md
  docs/pr-prompts/processed/             - no match
  docs/pr-prompts/failed/                - no match
  docs/pr-prompts/paused/                - no match
  docs/pr-prompts/blocked/               - not enumerated but pattern absent from ls output
  docs/pr-prompts/binned-shipped-20260720/ - only pr-untrack-data-model-map-HOLD.md, which is a DIFFERENT prompt (about untracking the very files this PR just re-tracked - noteworthy)

Adjacent prompts that reference this work exist and confirm it is a real feature (pr-ops-m1b-map-page-HOLD.md gates on this PR merging; pr-ops-m2-* references ops-m1 as a prerequisite), but the originating prompt itself is missing. Without it, scope creep / missing-scope cannot be checked.

Also noteworthy
---------------
- pr-untrack-data-model-map-HOLD.md sitting in binned-shipped-20260720/ strongly suggests there was already a planned effort to REMOVE these artifacts from tracking. This PR moves in the opposite direction on the same files.

Feature code quality - not blocking, but observations for when Blockers 1-2 clear
--------------------------------------------------------------------------------
The application code itself (10 non-gitignored files) is coherent:
- Additive migration 20260720150000_add_map_locations with MapLocationKind enum + MapLocation model
- CRUD + orphan-facilities helper in apps/api/src/modules/map-locations/
- 409 rename-guard on TIP.facility PATCH when EstimateWasteRate rows reference the old string - correct default given the join is string-based
- Idempotent poi-categories seed in seed-reference.ts
- Settings > Admin > "Map locations" tab wired into AdminSettingsPage.tsx
- Permission guard cited as `masterdata.manage`

None of this was deeply scope-checked because the originating prompt is missing (Blocker 2). If the prompt is produced, a second pass can verify migration name, endpoint contract, seed key, and permission code all match spec.

Marco action
------------
1. Have the branch author drop the three docs/data-model/** files from the PR (Blocker 1) - this is the mechanical fix.
2. Produce or locate the originating prompt (Blocker 2) so scope compliance can be checked on the re-review.
3. Consider auditing pr-* prompt templates for stale "regenerate and commit docs/data-model/**" text - this is the second time it has surfaced (PR #662 caught it pre-push; #741 did not).

Reviewed on branch: doc-reconcile/sot-01-section9-nav-ia. No local state mutated; no checkout performed.

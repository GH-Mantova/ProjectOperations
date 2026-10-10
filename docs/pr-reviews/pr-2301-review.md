VERDICT: MERGE

REVIEWED-SHA: 49403bc43ed98b594e8294ce176c5b3f2fb36d91

## Scope compliance

**In scope:**
- Station 00 scheduled run output: one breadcrumb file, two collected breadcrumbs moved to archive, one new HOLD staged
- All changes in `docs/pr-prompts/` (docs-only, gitignored but tracked via PR)
- No code changes, no migrations, no schema edits
- Explicit statement "nothing was armed this run" — PR adds nothing to active merge queue
- PR body comprehensively documents findings, dispositions, and validator results

**Out of scope (correctly deferred):**
- F1: Blind run channel defect — escalated to Marco (requires bootstrap + station-doc coordination)
- F6: #2294 label + receipt release — escalated to Marco (CP-26 is manual)
- F8: Worktree cleanup — deferred to Station 03

## Self-verification claims

- ✅ Breadcrumb written and cited in PR body
- ✅ Two old breadcrumbs moved to `archive/` via git rename (verified via file list: RENAMED, 0+0 changes)
- ✅ One new HOLD staged: `pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md` (132 lines added)
- ✅ `check-breadcrumb.mjs` quoted: "CLEAN", structure 3 checked, 0 malformed
- ✅ `lint-prompt.mjs` on staged HOLD quoted: "ADMIT (size 3)", exit 0
- ✅ `check-queue-layout.mjs` quoted: violations=0, warnings=0
- ✅ Nothing armed (no `-ready.md` files created, explicit "NO-OP" in F7)
- ✅ CI all green: 11 checks SUCCESS, 5 SKIPPED (path-filtered), 0 FAILED

## Risks Marco should know

1. **#2294 remains blocked**: Both its failing checks (CP-26 label + missing receipt) are intentional release gates, not code defects. F4 evidence refutes the stale verdict; substance is sound. This PR's comment on #2294 provides the refutations and two explicit RULE-1 merge paths for Marco alone.

2. **F1 (blind run) is architectural**: The 00:14Z occurrence fired but lost its breadcrumb because the bootstrap and station-doc both omit "write the blind report to a tracked path". This costs ~40% of Station 00 runs (per prompt). No code defect here; requires Marco to edit bootstrap SKILL.md and all seven station docs' canonical block together.

3. **F2 staged a new HOLD**: The prompt `pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md` is NOT armed — it is staged for arming by a deliberate future call. It fixes the trap where a spent HOLD reads ADMIT when its PR is still open (third consecutive reproduction). Implementation is within instrument-lane allowlist.

4. **No worktree cleanup**: F8 notes 33 non-main worktrees with some holding unpushed commits. Deferred to Station 03 per design (00 dispatches, 03 prunes). Not a blocker.

## Recommendation

Merge. Docs-only breadcrumb PR, all validators pass, CI green, scope clean, and findings are honest about what requires Marco's action (F1, F6) vs. what is fixed (F4, F5) vs. what is staged for separate arming (F2).

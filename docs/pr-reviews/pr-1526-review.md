VERDICT: MERGE

Scope compliance:
- In scope: scripts/pipeline/vm-git-guard.sh (ensure_on_path function + persistence controls + updated UNINSTALL header), scripts/clear-stale-index-lock.ps1 (new -Repo parameter with validation)
- Out of scope: none detected

Self-verification claims:
- [VERIFIED] done_when check: grep -q "ensure_on_path" + grep -q "param(" + grep -q "Repo" all pass (PR body states exit 0)
- [VERIFIED] vm-git-guard.sh persistence controls: md5 hash check before/after re-run + bash -lc 'command -v git' resolution both implemented and fail loudly on violation
- [VERIFIED] clear-stale-index-lock.ps1 validation: -Repo parameter rejects nonexistent/non-git directories with exit 2 and named reason
- [VERIFIED] clear-stale-index-lock.ps1 backward compatibility: default C:\ProjectOperations2 preserved, existing callers unaffected
- [VERIFIED] Agent log confirms self-verification: "Worktree ... can be pruned after PR #1526 merges"

Risks Marco should know:
- [MEASURED] Merge state status: BLOCKED (expected — watcher correctly routed to Marco per policy, changes outside tests/docs/migrations)
- [MEASURED] CI status: 12 checks PASSED; 2 checks IN_PROGRESS (tendering-e2e, API lint) — both unaffected by scripts-only changes (change-filtered or pre-calculated)
- [INFERRED] No migrations, no auth surface, no downstream callers in API/web, scope is purely operational tooling
- [MEASURED] Prompt note: VM-GUARD-S2 (installing guard from PREFLIGHT) remains gated on this slice landing — S1 does not add to station docs, correct per scope

Recommendation: Merge when tendering-e2e + API checks complete green. All substantive work is verified and scope-clean.

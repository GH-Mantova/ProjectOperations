VERDICT: MERGE

Scope compliance:
- In scope: one file added (129 lines), check-pipeline-heartbeat.mjs, a liveness detector for the pipeline scheduler
- Out of scope: none

Self-verification claims:
- [x] File byte-hash verified against source in orphaned worktree C:\po-vg: 9c4587fbf4e906fca096941f014de8ef4671ebee matches
- [x] File syntax verified: node --check exits 0
- [x] File absent from main before this PR (git cat-file -e origin/main:scripts/pipeline/check-pipeline-heartbeat.mjs → exit 128)
- [x] Branch (fix/no-rebase-while-checks-run) deleted from remote; only copy exists in this PR
- [x] No workflow or schedule wired; file is inert on main — no existing behavior changes
- [x] CI: all completed checks green (CodeQL, lint, test suite, PR gates, data model sanity)

Lane classification (DOCTRINE §10.1):
- Originating prompt: Station 00 supervisor run 2026-09-04T11:09Z (00-00-supervisor-2026-09-04-1109-the-only-copy-of-the-outage-detector-sat-in-a-worktree-queued-for-pruning.md)
- PR opened by: Station 00 from isolated worktree (not watcher auto-open)
- File touches scripts/pipeline/ (outside ^(tests|docs)/) → classifyPolicyFiles returns "outside tests/ or docs/"
- §10.1 step 2 applies: no watcher verdict log, hand-classified by policy matrix
- Marco's authority: yes (via classifyPolicyFiles for scripts/ outside migrations/)

Risks Marco should know:
- The script is unreviewed (Station 00 notes this explicitly in PR body). It implements a 6-hour no-breadcrumb alarm for the pipeline heartbeat, designed to run as a GitHub Actions scheduled workflow (not in this PR). The logic is sound (exported functions testable, pure-function design) but carries the risk of an uninspected 129-line implementation going to main.
- Merging is additive (no code invokes it yet). Closing it destroys the only copy and leaves the hole it was meant to plug unfilled. The original escalation `needs-marco/all-stations-disabled-16h-and-the-only-detector-was-disabled-too-2026-09-03.md` remains unanswered.
- The file's future: a follow-on PR is already staged (per Station 00) to wire the companion GitHub Actions workflow. This PR is the preservation step; the wiring is the next step.

Recommendation: Merge. The substantive artifact is preserved and carries zero risk to existing behavior. The follow-on PR to wire the workflow is blocked on this one; arming and driving that prompt is the next board action (Station 00's F1a RULE 1 option (a) applies).

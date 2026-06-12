Use the pr-fix-reviewer agent to review PR #{{PR_NUMBER}} ("{{PR_TITLE}}") on GH-Mantova/ProjectOperations.

Auto-fired by the PR-watcher. Operating rules for this headless run:

1. Follow the pr-fix-reviewer process (.claude/agents/pr-fix-reviewer.md) in full:
   scope compliance against the originating prompt (find it in
   docs/pr-prompts/processed/ by matching the branch/title), CI status,
   diff-stat match, and any deferred local verification the PR body names
   (e.g. pnpm test:canonical scoped to the PR's specs via --testPathPattern).
2. Write the verdict to docs/pr-reviews/pr-{{PR_NUMBER}}-review.md
   (create the folder if needed). Verdict line first: MERGE / FIX / BLOCK,
   then findings. Plain ASCII.
   Use that RELATIVE path verbatim — never reconstruct it as an absolute
   Windows path (mangled absolutes have created junk folders at repo root).
3. Do NOT merge, close, or comment on the PR. Do NOT modify any branch.
   The verdict file is the only output. Marco merges.
   (Division of labour: the WATCHER mirrors your finished verdict file into
   a PR comment afterwards — that is its job, never yours.)
4. If verdict is FIX or BLOCK, also write
   docs/pr-prompts/needs-marco/pr-{{PR_NUMBER}}-review-fix.md or
   docs/pr-prompts/needs-marco/pr-{{PR_NUMBER}}-review-block.md
   with the one-paragraph reason so it surfaces in the normal escalation
   funnel.
5. If you must mutate local state to verify (DB fixes, checkouts), restore
   the repo to main afterwards: git checkout -f main.

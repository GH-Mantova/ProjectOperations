---
premise: '! grep -q "PR_NUMBER_FROM_THE_BOARD_V1" scripts/pr-watcher/index.mjs'
premise_means: >-
  extractPrNumber() in scripts/pr-watcher/index.mjs is the only thing that decides which PR a build
  produced, and it regexes the agent's prose. It fails both ways. FALSE POSITIVE (2026-09-11): a
  build that opened nothing mentioned "PR #1866" and the watcher ran its merge path against that
  unrelated PR. FALSE NEGATIVE (2026-09-11 #1870, and again 2026-10-02 #2196): the agent wrote
  "PR opened: **#2196**", `\s*#` does not match the markdown emphasis, the watcher concluded "no PR",
  skipped the escalates:true do-not-merge label, and re-armed the prompt as -b-ready.md, which
  started a second build of work already open as a PR. MEASURED 2026-10-02T07:00Z by Station 00
  interactive: the -b build was live at 07:00:49Z and was killed by hand before it pushed.
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/__tests__/pr-number-from-board.test.mjs
  - docs/pr-prompts/superseded/pr-watcher-pr-number-from-the-board-HOLD.md
done_when: >-
  grep -q "PR_NUMBER_FROM_THE_BOARD_V1" scripts/pr-watcher/index.mjs &&
  test -f scripts/pr-watcher/__tests__/pr-number-from-board.test.mjs &&
  node --test scripts/pr-watcher/__tests__/ &&
  ! test -f docs/pr-prompts/pr-watcher-pr-number-from-the-board-HOLD.md
size: 4
gate_allow: none
seed_only: false
escalates: true
module: watcher
---
Spec agreed by Marco in chat 2026-10-02 (~07:20Z, "Agree").

# Watcher: take the PR number from the board, not from the agent's prose

Answers `needs-marco/watcher-scrapes-the-pr-number-out-of-agent-prose-2026-09-11.md`, option (a).
Read that file first. It has the measured false-positive (#1866) and false-negative (#1870) cases.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## What to build

In `scripts/pr-watcher/index.mjs`, add `resolveBuiltPr({ agentOutput, runStartedAtMs, scope })` and
call it at the single build-path site that today reads `const prNumber = extractPrNumber(agentOutput)`.
Tag the function with the comment `// PR_NUMBER_FROM_THE_BOARD_V1`.

1. **Ask the board.** `gh pr list --state all --limit 30 --json number,createdAt,headRefName,files,author`.
   Candidates are the PRs with `createdAt >= runStartedAtMs - 60s` (allow for clock skew) whose
   changed `files` intersect the prompt's `scope` globs. The prompt's own `-HOLD.md` path counts,
   since every compliant prompt retires itself in its own PR.
2. **Decide:**
   - **Exactly one candidate.** That is the PR. If `extractPrNumber` (the old scrape, kept as a
     cross-check) returns a *different* number, log `[pr-resolve] DISAGREE board=#A prose=#B` and use
     the board's answer. Never use the prose number.
   - **Zero candidates.** No PR was opened. Return `null`, so the existing NO-OP / no-PR restage path
     runs unchanged.
   - **Two or more candidates.** Fail closed: return `{ ambiguous: [..] }`. The caller must NOT
     restage and must NOT run any merge path. Move the prompt to `failed/` with a `.report.md` that
     names every candidate, and log `[pr-resolve] AMBIGUOUS`.
   - **`gh` unreachable or errors.** Fail closed the same way as the ambiguous case
     (`[CANNOT MEASURE]` in the report). Never fall back to the prose scrape, and never restage. A
     restage on an unknown board state is exactly the duplicate-PR failure this prompt fixes.
3. **Review jobs (`rev-*`)** still skip the AUTO_MERGE block exactly as today. Do not change their path.
4. `writeQuarantineReport` may keep using `extractPrNumber`. It only labels a report, it never acts.
5. Make `resolveBuiltPr` pure apart from an injectable `listPrs` function, so it can be unit-tested
   without spawning `gh`. Export it.

## Tests: `scripts/pr-watcher/__tests__/pr-number-from-board.test.mjs` (node:test)

- Prose `PR opened: **#2196**` with the board holding #2196 created in-window and touching scope → **2196**.
- Prose mentions `PR #1866` (old, merged, out of scope), board has nothing in-window → **null**.
- Board has one in-window PR in scope, prose names a different number → board's number, with a DISAGREE log.
- Two in-window PRs both touching scope → `ambiguous`, and the caller neither restages nor merges.
- One in-window PR that does NOT touch scope (a second lane's PR opened during the build) → **null**.
- `listPrs` throws → fail-closed result, no restage.
- A regression test showing that `nextRestageName` is never reached when the board found a PR.

## Do NOT

- Do not change `nextRestageName`, the NO-PR ladder's bounds, `decideEscalationAction`, or the
  merge-wait logic. Only the source of `prNumber` changes.
- Do not touch `verdict-guard.mjs`, `lane-classify.mjs`, any station doc, DOCTRINE, or `sot/`.
- Do not require agents to print a magic line. That is option (b), rejected because it fails the
  additive half of RULE 1.
- Do not delete `extractPrNumber`. It stays as the cross-check and as the quarantine-report labeller.

## Guardrails

One attempt. Never exit silently: if you cannot do it, say `NO-OP: <reason>`. Never ask a question.
Run `node --test scripts/pr-watcher/__tests__/` and `pnpm lint` before opening the PR, and put the
test output in the PR body. Read the job log before diagnosing any CI failure.

## After merge (for Station 00, not the builder)

The watcher only adopts this on restart. Fast-forward `C:\po-watcher\ProjectOperations` to main
first, then restart (DOCTRINE 9.5).

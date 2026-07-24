---
premise: '! grep -q "fixes_pr" scripts/pr-watcher/index.mjs'
premise_means: >
  The watcher has no fix-lane: fix-forward prompts queue behind ordinary work even when they
  unblock the whole board. Dies when fixes_pr handling lands in the watcher.
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pipeline/lint-prompt.mjs
  - docs/pr-prompts/PROMPT-SCHEMA.md
  - scripts/pr-watcher/__tests__/fix-lane.spec.mjs
size: 4
escalates: false
done_when: >
  grep -q "fixes_pr" scripts/pr-watcher/index.mjs AND the fix-lane spec passes under node --test
  AND PROMPT-SCHEMA.md documents the key AND the PR is open with all required checks green.
---

# Watcher: FIX LANE - fix-forward prompts jump the queue (Marco, 2026-07-24)

## STATUS

When a merged regression or a red PR blocks other work, its fix-forward prompt currently queues
BEHIND ordinary prompts. Marco's rule: a fix that unblocks the board must be prioritised, and
dependent work must wait for the fix outcome. Half the machinery exists: review jobs already get
queue-FRONT insertion (rev- prefix), and PR #760 shipped `requires_merged` / `requires_file_on_main`
front-matter dependency gating. This prompt adds the missing lane.

## THE WORK

1. `scripts/pr-watcher/index.mjs`: recognise an optional front-matter key `fixes_pr: <N>` (int) on
   pr-* prompts. A prompt carrying it is a FIX prompt: insert it at the FRONT of the queue
   (immediately after any currently-running job), exactly the mechanism rev- jobs use. Log a
   distinct line: `[fix-lane] <name> jumped to front (fixes PR #N)`.
2. Dependency hold on the SAME PR: while a fix prompt for PR N is queued or running, any other
   armed prompt whose `requires_merged` includes N stays held (the #760 gating already does this -
   verify it treats "fix in flight" correctly and does NOT bin the dependent prompt; held is not
   binned).
3. `scripts/pipeline/lint-prompt.mjs`: accept `fixes_pr` as a valid optional key (int, must
   reference an OPEN PR at lint time - run `gh pr view N --json state` as part of the premise-style
   live check; a fix prompt for a merged/closed PR is stale and must REJECT with FIX_TARGET_SETTLED).
4. `docs/pr-prompts/PROMPT-SCHEMA.md`: document the key, the lane semantics, and the authoring
   rule: fix prompts SHOULD also instruct the agent to re-verify the failure on the current head
   before acting (errors drift; the fix may need to chase the log, not the original diagnosis).
5. `scripts/pr-watcher/__tests__/fix-lane.spec.mjs`: fixes_pr prompt inserts at front; ordinary
   prompt does not; lint rejects fixes_pr pointing at a merged PR.

## DO NOT

- Do not change dispatch for rev- jobs or ordinary prompts.
- Do not auto-generate fix prompts - authoring stays with humans/PR-Master/stations.
- No app code, no sot/.

## VERIFY

- `node --test scripts/pr-watcher/__tests__/fix-lane.spec.mjs` exits 0.
- `node scripts/pipeline/lint-prompt.mjs` on a fixture with `fixes_pr` pointing at an open PR
  ADMITs; pointing at a merged PR REJECTs.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED. It does not mean "wait for
approval before starting". There is no human in this run. Finishing the work and then asking
for permission is indistinguishable from failing - the work is discarded either way.

---
premise: '! grep -q "unlogged-arm" scripts/pipeline/hooks/pre-commit'
premise_means: >-
  Nothing refuses a staged HOLD->ready rename that has no matching line in .arming-log.txt. Station
  00's F10 measured the consequence: two prompts armed, one recorded, and RULE 4 unenforceable by
  reading the log.
scope:
  - scripts/pipeline/hooks/pre-commit
  - scripts/pipeline/__tests__/**
done_when: >-
  grep -q "unlogged-arm" scripts/pipeline/hooks/pre-commit && node --test
  scripts/pipeline/__tests__/
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: pipeline-hygiene
cluster_order: 3
rollback_strategy: >-
  One hook file plus tests. Hooks are not versioned into .git/hooks automatically, so reverting the
  commit removes the guard from the repo; any already-installed copy is removed by re-running the
  install step.
requires_on_main: scripts/pipeline/arm-prompt.ps1 :: ARM_INDEX_RELEASED
---

# Refuse an unlogged arming rename — the backstop, not the fix

## Why this is gated

Slice 3 of cluster `pipeline-hygiene`. This slice is deliberately parked behind
`pr-arm-prompt-release-index` (slice 2). Its rule — *any staged
`HOLD -> ready` rename pair is suspect* — is only clean once the wrapper stops leaving one of its
own. Land them in the other order and this hook rejects `arm-prompt.ps1`'s legitimate output.

The ordering is also the argument about which control matters. Removing the incentive to bypass the
wrapper is the fix; this hook is the backstop for the case where somebody bypasses it anyway.

## The defect

`.arming-log.txt` records only arms made through `arm-prompt.ps1`. A bare `git mv` writes nothing,
takes no lock, and leaves a rename that another chat's commit can sweep. Station 00 measured it on
2026-08-31 (#1426, F10):

```
04:19:51Z  arm-prompt.ps1 armed pr-watcher-verdict-sweep-skips-tracked  -> logged
04:26:37Z  filesystem shows TWO armed prompts
           pr-scopesub-s1-one-discipline-list-ready.md  -> no entry in .arming-log.txt
```

## Do

1. **Detect the pair, not the halves.** In `scripts/pipeline/hooks/pre-commit`, look at the staged
   name-status for a rename where the old path is `docs/pr-prompts/<slug>-HOLD.md` and the new path
   is `docs/pr-prompts/<slug>-ready.md`. Both sides must be present in the same commit.

2. **Refuse when the slug has no arming-log line**, with a message that says what to do:
   un-stage and re-arm via `scripts/pipeline/arm-prompt.ps1 -Name <slug>`. The literal token
   `unlogged-arm` must appear in the hook — the premise and `done_when` grep for it.

3. **Allow a bare HOLD deletion.** Once the watcher has consumed a prompt, Station 06's board PR
   commits the HOLD removal with no `-ready.md` counterpart. That is legitimate queue bookkeeping and
   must pass. This is the single most important thing not to get wrong.

4. **Say plainly what the hook cannot do.** Add a comment block: hooks live in `.git/hooks`, are not
   versioned, and are only present for whoever ran the install step — so this is a speed bump, not a
   gate, and the filesystem remains the only sound arm census.

## Do NOT

- Do **not** block a rename that DOES have a matching log line. The wrapper's own output must pass.
- Do **not** block a lone `-HOLD.md` deletion, a lone addition, or any path outside
  `docs/pr-prompts/`. Over-blocking a shared tree several chats commit in is worse than the hole.
- Do **not** parse `.arming-log.txt` strictly. It is append-only, best-effort, ASCII, and may carry
  the header comment the release-index slice adds. Match on the slug appearing in an `ARMED` line;
  do not require field positions.
- Do **not** make the hook fail when `.arming-log.txt` is absent — a fresh clone has no log. Absent
  log means "cannot judge": warn, allow, and say why.
- Do **not** touch `arm-prompt.ps1`. It is the previous slice's scope.

## Verification

Tests under `scripts/pipeline/__tests__/`, driving the hook over fixture indexes:

- **refuses an unlogged rename pair** — HOLD+ready staged, slug absent from the log -> non-zero exit,
  message naming the slug and the re-arm command.
- **allows a logged rename pair** — same staging, slug present in an `ARMED` line -> exit 0.
- **allows a bare HOLD deletion** — deletion staged with no `-ready.md` -> exit 0. The Station 06
  bookkeeping case.
- **allows unrelated paths** — a normal source commit is untouched.
- **absent log warns and allows** — no `.arming-log.txt` -> exit 0 with a warning.
- **header line tolerated** — a log whose first line is the `# WRAPPER ARMS ONLY` comment still
  matches its `ARMED` entries.

Negative control, recorded in the PR body: with the log-lookup removed so every rename is treated as
unlogged, the "allows a logged rename pair" and "allows a bare HOLD deletion" tests must both fail.

## STANDING AUTHORITY

You have **STANDING AUTHORITY to finish the work, commit, push** the branch and open the pull
request. Do not stop to ask. If a step in "Do" turns out to be wrong, fix it and say so in the PR
body — but do not exit 0 without a PR. An agent that exits without opening a PR has failed this
prompt, whatever its reasoning was.

---
premise: '! grep -q "check-queue-dirs" .github/workflows/ci.yml'
premise_means: >-
  Nothing in CI detects a pipeline script that reads a queue subdirectory no producer writes. That
  class of defect shipped three times and was found in one session on 2026-09-01
  status-sweep.ps1:224 and :254, supervise-watcher.ps1:582, and a station's own board script all
  counted docs/pr-prompts/in-progress/, a directory scripts/pr-watcher/index.mjs never writes, and
  all three reported 0 rather than "cannot measure". Two of the three fed a safety gate: the
  sweep's $boardBusy / DO NOT ACT verdict, and the watchdog's "a build is running, not hung"
  guard. Each was fixed by hand, one at a time, and nothing stops the fourth.
requires_on_main:
  - scripts/pipeline/status-sweep.ps1 :: buildRunning
  - scripts/pr-watcher/supervise-watcher.ps1 :: heartbeat-only
scope:
  - scripts/pipeline/check-queue-dirs.mjs
  - .github/workflows/ci.yml
done_when: >-
  grep -q "check-queue-dirs" .github/workflows/ci.yml && node scripts/pipeline/check-queue-dirs.mjs
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# CI must fail when a pipeline script reads a queue directory that nothing writes

## Why this exists

DOCTRINE section 9.6: *an empty result is not an empty world.* This is that rule with a specific,
recurring, mechanical shape - a script counts files in `docs/pr-prompts/<subdir>/`, the directory
has no producer, `Get-ChildItem` returns nothing, and the script prints `0`. A zero is
indistinguishable from a real measurement, so it propagates into gates.

Found on 2026-09-01 at `1efd079c`, three instances of one bug:

| Consumer | Line | What the dead read fed |
|---|---|---|
| `scripts/pipeline/status-sweep.ps1` | 224, 254 | `$boardBusy` and the `DO NOT ACT` verdict |
| `scripts/pr-watcher/supervise-watcher.ps1` | 582 | the watchdog's "a build is running: not hung" guard |
| a station's own board-sweep script | - | a report of "queue empty" while a prompt sat armed |

`scripts/pr-watcher/index.mjs` never mentions `in-progress` - `git grep` exits 1, with a passing
positive control (`classifyPolicyFiles` -> exit 0) and a passing negative control
(`qqzzxxnotarealtokenqqzzxx` -> exit 1). Its destinations are `processed/`, `failed/`,
`no-pr-opened/`, `blocked/` and `paused/`.

**The two hand-fixes are prompts A and B in this cluster. This prompt is the part that stops a
fourth.** It is chained behind both via `requires_on_main` on fixed strings each introduces, because
it would legitimately fail against today's `main`.

## What to build

### 1. `scripts/pipeline/check-queue-dirs.mjs` (new)

Model it on `scripts/pipeline/check-agent-doctrine.mjs`, which already exists in this repo and is
already wired into the same CI job. Match its shape: exit **0** clean, **1** violation, **2**
`[CANNOT MEASURE]`, and internal controls that run on every invocation.

**Producers.** Scan the pipeline's scripts for code that CREATES or WRITES a queue subdirectory -
`fs.mkdirSync` / `fs.renameSync` / `path.join(PROMPT_DIR, "<name>")` in `.mjs`, and
`New-Item -ItemType Directory` / `Move-Item` destinations in `.ps1`. Collect the set of subdirectory
names any script writes. `needs-marco/` must land in this set: `supervise-watcher.ps1` creates it in
`Write-Escalation` and in the orphan-escalation path. If it does not, your producer scan is wrong -
fix the scan, do not allowlist around it.

**Consumers.** Scan the same scripts for code that READS or COUNTS a queue subdirectory -
`Get-ChildItem (Join-Path $Queue "<name>...")`, `readdirSync(path.join(PROMPT_DIR, "<name>"))`, and
the literal subdirectory names in iteration lists such as
`@("in-progress","needs-marco","no-pr-opened","failed","blocked")`.

**The rule.** Every subdirectory name that appears as a CONSUMER must also appear as a PRODUCER.
Any that does not is a violation: print the consumer file, the line number, the subdirectory name,
and the sentence *"no producer writes this directory; a count from it is [CANNOT MEASURE], not 0"*.
Exit 1.

**Files to scan.** `scripts/pipeline/**/*.ps1`, `scripts/pipeline/**/*.mjs`,
`scripts/pr-watcher/**/*.ps1`, `scripts/pr-watcher/**/*.mjs`. Skip `__tests__` directories and this
checker itself. If the scan matches **zero** consumers in total, that is a broken instrument, not a
clean repo: exit **2** with `[CANNOT MEASURE] consumer scan matched nothing`.

**Internal controls, run every time, before the real scan (DOCTRINE section 7).**

- A **positive control**: a synthetic consumer string naming a subdirectory absent from the
  synthetic producer set MUST be detected. If it is not, exit 2 - the detector is broken.
- A **negative control**: a synthetic consumer naming a subdirectory that IS in the synthetic
  producer set MUST NOT be flagged. If it is, exit 2 - the detector false-positives.

Print both control outcomes on every run, pass or fail. A checker whose controls are silent is a
checker nobody can trust.

### 2. Wire it into CI

`.github/workflows/ci.yml` already runs `- run: node scripts/pipeline/check-agent-doctrine.mjs` at
line 187, inside the pipeline-tests job. Add
`- run: node scripts/pipeline/check-queue-dirs.mjs` immediately after it, with a short comment
saying what it prevents and naming the 2026-09-01 triple. Change nothing else in the workflow - no
new job, no new trigger, no matrix change.

## Prove it before you believe it

- Run the checker against current `main` BEFORE prompts A and B land: it must exit **1** and name
  `in-progress` in `status-sweep.ps1` and `supervise-watcher.ps1`. Paste that output in the PR body.
  This is the proof it can actually catch the bug it was written for.
- Then run it against the tree WITH A and B applied: it must exit **0**.
- Paste both control lines from a real run.

If `requires_on_main` held this prompt until A and B are on `main`, the first check above cannot be
run against `main` - reproduce it by temporarily reverting the two lines in a scratch copy, or say
`[CANNOT MEASURE]` in the PR body and show the control evidence instead. **Do not claim the gate
catches the bug without having watched it catch something.**

## Guard against the obvious way of getting this wrong

- **Do not hard-code the list of valid subdirectories.** A static allowlist is the same bug one
  level up: it goes stale the moment `index.mjs` adds or renames a destination, and it would have
  passed all three of the defects above if written today. Derive producers from the source.
- **Do not use `git ls-tree` to decide whether a directory exists.** With no trailing slash it
  returns one line; with a glob pathspec it returns 0 silently at exit 0, positive control and all
  (DOCTRINE section 9.2). Producer/consumer membership comes from reading the scripts, not from the
  filesystem or the index.
- Do not make the checker create any directory it finds missing.
- Keep it dependency-free - Node built-ins only, like `check-agent-doctrine.mjs`.

## Do NOT

- Do NOT modify `scripts/pipeline/status-sweep.ps1` or `scripts/pr-watcher/supervise-watcher.ps1`.
  Prompts A and B own those files; touching them here creates the collision the split exists to
  prevent.
- Do NOT create `docs/pr-prompts/in-progress/` or any other queue subdirectory.
- Do NOT touch `/sot/`, `apps/**`, `prisma/**`, or any file outside `scope`.
- Do NOT add the checker to any job other than the existing pipeline-tests job, and do not make it
  a required status check - that is a branch-protection change and belongs to Marco.
- Do NOT run `git checkout .`, `git checkout -- <dir>`, `reset --hard`, `stash pop` or `git clean`
  anywhere.

## If the premise no longer holds

If an equivalent gate has shipped under a different name, this prompt's premise will still read
true because it greps for `check-queue-dirs` specifically. **Do not build a second one.** Say
`NO-OP: an equivalent queue-directory gate already exists as <name>` and exit. That failure mode is
live in this repo right now: `pr-statussweep-orphan-worktree-dirs-HOLD.md` greps for
`orphanWorktreeDirs`, the feature shipped in #1460 as `REGISTRY-ESCAPEE`, and its premise can
therefore never die.

## VERIFY

```
node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-ci-gate-dead-queue-dir-reads-ready.md
node scripts/pipeline/check-queue-dirs.mjs
grep -q "check-queue-dirs" .github/workflows/ci.yml
```

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. Never exit silently - say `NO-OP: <reason>` if you do nothing.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the job log before diagnosing any CI failure; never reason a red out of the diff.
- Before you finish, ask: is there a PR number in my output?

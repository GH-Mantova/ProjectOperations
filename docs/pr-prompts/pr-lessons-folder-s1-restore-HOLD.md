---
premise: '! test -f docs/lessons-learned/README.md'
premise_means: >-
  sot/05-decisions-and-lessons.md:166 names docs/lessons-learned/README.md as the
  source of this project's lessons-learned conventions. The directory does not
  exist on main - git ls-tree returns zero files. The document that defines where
  lessons live points at nothing, so the "detail exceeds a ledger row" branch of
  its own rule has nowhere to write and every lesson falls through to ledger-only
  regardless of size.
scope:
  - docs/lessons-learned/README.md
  - docs/lessons-learned/2026-08-20-supervisor-lane-and-process-kill.md
  - docs/lessons-learned/2026-08-20-measurement-discipline.md
done_when: >-
  test -f docs/lessons-learned/README.md && grep -q "What happened"
  docs/lessons-learned/2026-08-20-supervisor-lane-and-process-kill.md && grep -q
  "Why it matters" docs/lessons-learned/2026-08-20-measurement-discipline.md &&
  grep -q "Get-Process"
  docs/lessons-learned/2026-08-20-supervisor-lane-and-process-kill.md
size: 3
gate_allow: none
escalates: false
backfill: false
cluster: sot-reference-hygiene
cluster_order: 1
rollback_strategy: >-
  Three new files in a new directory. Nothing existing is touched. Revert is a
  git revert of one commit and returns main to exactly today's state.
---

# SLICE 1 of 3 — restore `docs/lessons-learned/`

**Docs only. Do not touch `sot/`.** SLICE 2 does the `sot/05` work and it is a
separate PR because a doc-reconcile is always its own PR.

## The measurement

`sot/05-decisions-and-lessons.md:164-193` carries a section titled
*"Lessons-learned methodology & directory conventions"* whose first line is:

> *(Source: `docs/lessons-learned/README.md`. …)*

```
git ls-tree -r --name-only origin/main -- docs/lessons-learned   ->  0 files
```

The convention document cites a directory that is not in the repo. It is one of
**16 path-shaped references in `sot/05` that do not resolve — 44% of the 36
checked.** Nothing checks them, which is why they dangle with no signal. SLICE 3
adds that checker.

## What to write

### 1. `docs/lessons-learned/README.md`

Move the conventions out of `sot/05`'s prose and into the file `sot/05` says holds
them. **Do not delete the section from `sot/05` — that is SLICE 2's job and this
slice must not touch `sot/`.** Reproduce the rules faithfully:

- one markdown file per incident, named `YYYY-MM-DD-short-slug.md`;
- four parts, in this order: **What happened** (with PR/commit references) ·
  **Why it matters** (realistic blast radius) · **Lesson** (the rule going
  forward) · **References**;
- these are **war stories**, not architecture rules — architecture rules live in
  `sot/01-charter-and-architecture.md` §6;
- `sot/05` remains the canonical, append-only ledger. A standalone file is kept
  only when its detail exceeds what fits a ledger row, and **every standalone
  file must be cited by a ledger row** so the two cannot drift apart silently.

That last clause is new and is the point of the exercise: the drift this whole
cluster exists to fix happened because nothing tied the two together.

### 2. `2026-08-20-supervisor-lane-and-process-kill.md`

Two incidents, same day, both Supervisor.

**Lane violation.** The Supervisor authored PRs #1256, #1261 and #1263. PR
authoring is Station 06's. `LL-38`, quoted in the supervisor station's own
description, is *"it does not do the stations' work itself."* Blast radius: PR
Master's staging pass never ran, so that work reached main with no second pair of
eyes. Lesson: design and measure, then hand over; arming and merging stay with the
Supervisor, authoring does not.

**Near-miss process kill.** A draft guard script contained
`Get-Process node | Stop-Process -Force` and defined "quiet" as fewer than three
`node.exe`. Measured: the host runs **14 `node.exe` and exactly one is the
watcher** (parent `start-watcher.ps1`); the other 13 are MCP servers — prisma,
desktop-commander, chrome-devtools, `@playwright/mcp`,
`@modelcontextprotocol/*`. The command would have killed all of them including
the desktop bridge the session ran through, and the `<= 3` threshold could never
be satisfied, so the guard would spin to timeout — and "just raise the threshold"
is what detonates it. It never ran. Lesson: **never select a process to kill by
image name.** `node.exe` / `python.exe` / `powershell.exe` name the runtime, not
the job. Match on command line.

### 3. `2026-08-20-measurement-discipline.md`

Four measurement failures in one session, all the same shape.

- **Measured the wrong tree.** Reported two orphan prompts as "gone from the tree"
  after reading the dev-tree working copy, which the watcher mutates and which was
  13 commits behind. Both are on main, and there is a third. `queue-sync.ps1`
  prints a DRIFT warning saying *"local greps and lint runs from it will lie"* —
  it had been read the same hour. Lesson: **measure in a clean `origin/main`
  worktree; read arming state, and only arming state, from the dev tree.**
- **Reported the input, not the outcome.** Called the Playwright browser cache
  "confirmed working" from a 4-second restore. The install step still took 667s,
  because the cost is `--with-deps` installing 181 apt packages every run and only
  23 of the 181 are webkit-family. The prompt that added the cache said in its own
  body *"a cache that has only ever been observed missing has not been shown to
  work."*
- **One data point presented as a baseline.** A single pre-cache run at 40s nearly
  became a reported 16x regression. The distribution is bimodal **before and
  after**: `39 47 50 51 | 551 748` vs `40 123 | 344 579 665 667 1099`.
- **Armed a wave before diffing scopes.** Five of fifteen collided — four fv2
  prompts all edit `forms.module.ts`, `tr-s1` shares `schema.prisma` with `ew-s1`.
  Found only because a hash check on four files described as duplicates came back
  **not identical**. Lesson: **diff scopes pairwise before arming a wave.**

Close with the countermeasure that caught every one of these: **run a known-true
and a known-false probe through the same instrument before trusting any reading,
and discard the pass if either misbehaves.**

## What NOT to do

- Do **not** edit `sot/05` in this slice. CP-24 permits `sot/` + `docs/` in one
  PR, but the doctrine is one sot doc, one PR — and this slice's `done_when` does
  not assert anything about `sot/`, so a diff that touches it is out of scope.
- Do **not** invent incidents. Everything above is measured; if a figure cannot be
  re-derived from the repo or the cited run, leave it out rather than round it.
- Do **not** write architecture rules here. War stories only.

## Verification

State in the PR body: the three file paths created; that `git diff --name-only`
contains no `sot/` path; and the four-part heading structure present in both
incident files.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.

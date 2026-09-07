---
premise: 'grep -q "cwd: REPO_ROOT, shell: true" scripts/pr-watcher/index.mjs'
premise_means: >-
  The watcher spawns every git call with shell:true, so on Windows node hands the argv array to
  cmd.exe as an unquoted string and any argument containing a space is split. A dependency gate
  whose path contains a space therefore makes git exit 129 "too many arguments", and
  unmetDependencies catches every non-zero exit and writes the same sentence it writes for a
  genuine absence. A satisfied gate is reported as an unsatisfied one and the prompt is deferred
  forever. Measured 2026-09-05T17:1xZ on an armed prompt gated on "Claude Design/docs/01-commercial.md":
  twelve consecutive deferrals over 59 minutes on a file that has been on origin/main since 09-04.
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/__tests__/gate-path-space.test.mjs
done_when: >-
  ! grep -q "cwd: REPO_ROOT, shell: true" scripts/pr-watcher/index.mjs && test -f scripts/pr-watcher/__tests__/gate-path-space.test.mjs
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# The watcher reads gate paths through cmd.exe, so a space reads as "not on origin/main"

**Grounded against `origin/main` = `35c62eb6`, measured 2026-09-05T17:1xZ.**

## The defect

`scripts/pr-watcher/index.mjs`:

```js
function runGit(args) {
  const child = spawn("git", args, { cwd: REPO_ROOT, shell: true });
```

With `shell: true` node does **not** escape the argv array on Windows — it concatenates it into a
single command string for `cmd.exe`. Node itself warns about this (`DEP0190`). Every argument
containing a space is therefore re-split by the shell.

`unmetDependencies` then does:

```js
try { await runGit(["cat-file", "-e", `origin/main:${file}`]); }
catch { unmet.push(`file "${file}" not on origin/main`); }
```

so **any** non-zero exit becomes the same sentence — including exit 129, which is git's *usage*
error, not an absence.

## Measured, with both controls

Run from `C:\po-watcher\ProjectOperations`, same `spawn` shape as the watcher:

| call | `shell` | exit | meaning |
|---|---|---|---|
| `cat-file -e origin/main:Claude Design/docs/01-commercial.md` | `true` | **129** `fatal: too many arguments` | argument split — the bug |
| `cat-file -e origin/main:CLAUDE.md` | `true` | 0 | POSITIVE control: the shell form works when there is no space |
| `cat-file -e origin/main:zzzNoSuchNeedleZzz.md` | `true` | 128 | NEGATIVE control: a real absence |
| `cat-file -e origin/main:Claude Design/docs/01-commercial.md` | `false` | **0** | the file is present all along |
| `cat-file -e origin/main:zzzNoSuchNeedleZzz.md` | `false` | 128 | control still discriminates |

129 and 128 are both "non-zero" to the `catch`, and the watcher log cannot tell them apart.

## Why this is not already fixed

**PR #1589** (`fix/lint-gate-path-space`, merged 2026-09-04T20:48:58Z) is titled *"read origin/main
gate paths without a shell so paths with spaces work"* — and it corrected
`scripts/pipeline/lint-prompt.mjs` only. The identical defect in the watcher's own copy was not
touched. So `lint-prompt.mjs` reads the gate as SATISFIED and admits the prompt for arming, and the
watcher then reads the same gate as UNSATISFIED and defers it forever. **Two instruments, opposite
answers, and the arming instrument is the one that says go.**

## Blast radius

[MEASURED] `git ls-tree -r --name-only origin/main` = 3136 tracked files, of which **11** contain
whitespace, under two top-level directories: `Claude Design/` and `docs/`. Every future
`requires_file_on_main` or `requires_on_main` gate pointing into `Claude Design/**` — i.e. the rest
of the CD cluster — deadlocks the same way. [MEASURED] the live queue holds 89 prompt files and 37
dep-gate lines, of which **0** currently carry a spaced git path (the one that did was cleared by
hand at 17:16Z), so this is **latent, not currently firing**.

## The change

1. Remove `shell: true` from **every `spawn("git", …)`** in `scripts/pr-watcher/index.mjs`. There
   are four: the `runGit` helper, and three bare calls (`fetch origin`, `checkout main`, `pull`).
   `git` resolves without a shell on this box — measured above, `shell:false` exit 0 on both
   controls. Change nothing else about those calls.
2. Add `scripts/pr-watcher/__tests__/gate-path-space.test.mjs` (node:test, matching the eleven
   sibling tests already in that folder) asserting that a git argument containing a space survives
   the spawn: build a temp repo, commit a file at a path with a space, and assert
   `cat-file -e <ref>:<spaced path>` exits 0 — with the negative control that an absent path exits
   non-zero, so the test cannot pass by never running.

**Out of scope, deliberately.** `runGh` and the two non-git `spawn`s in the same file also pass
`shell: true`. No failure has been measured through them and their arguments are watcher-generated,
so widening this slice would be a change with no evidence behind it. Named here so the next reader
does not have to rediscover it.

## Rollback

Single-file revert. Nothing is generated, no schema, no data.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

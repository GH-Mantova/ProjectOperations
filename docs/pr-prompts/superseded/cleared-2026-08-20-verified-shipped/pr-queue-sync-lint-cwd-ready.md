---
premise: test -f scripts/pipeline/queue-sync.ps1 && test "$(grep -c LINT_REPO_ROOT scripts/pipeline/queue-sync.ps1)" = "0"
premise_means: queue-sync.ps1 calls lint-prompt.mjs without pinning the repo root, so every premise runs in the caller's cwd and the ADMIT/SHIPPED verdict depends on where the script was launched from.
scope:
  - scripts/pipeline/queue-sync.ps1
  - scripts/pipeline/lint-prompt.mjs
  - scripts/pipeline/test-lint-prompt.mjs
done_when: grep -q LINT_REPO_ROOT scripts/pipeline/queue-sync.ps1 && grep -q LINT_REPO_ROOT scripts/pipeline/test-lint-prompt.mjs && node scripts/pipeline/test-lint-prompt.mjs && pnpm build && pnpm lint
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# `queue-sync` lints every prompt in the caller's cwd — 8 of 11 verdicts flip

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## The defect

`lint-prompt.mjs:934` resolves the repo root as:

```js
const repoRoot = process.env.LINT_REPO_ROOT || process.cwd();
```

That `repoRoot` is passed straight into `runPremise(cmd, cwd)` (`:898` → `:630`
`execSync(cmd, { cwd, ... })`). Every prompt premise is therefore executed **in the invoking
process's current directory**.

`queue-sync.ps1:125` is the **only non-test caller** of `lint-prompt.mjs` in the repo:

```powershell
$null = node (Join-Path $GitRepo "scripts\pipeline\lint-prompt.mjs") $tmp 2>&1
```

It never sets `LINT_REPO_ROOT` and never `Push-Location`s into `$GitRepo`. The escape hatch that
would fix this **already exists and the sole caller does not turn it on.**

So a premise like `grep -q ... sot/02-roadmap-and-status.md` resolves against whatever directory
the operator happened to be in when they launched the script.

## Measured, with controls — origin/main `bcae790f`, 2026-08-20

Same file, same linter binary, only the cwd changed:

```
cwd = C:\po-scan-5848f3 (repo)   -> ADMIT   exit 0
cwd = C:\Users\...\Temp          -> REJECT  exit 1   [PREMISE_INVALID]
                                    "grep: sot/02-roadmap-and-status.md: No such file or directory"
```

Running the **stale dev-tree linter** and the **clean-worktree linter** against the same temp file
gave identical results, so this is **not** a linter-version drift.

## Blast radius — 8 of the 11 armed prompts flip verdict

All 11 `*-ready.md` committed on `origin/main`, linted twice (repo cwd vs foreign cwd):

| prompt | repo cwd | foreign cwd | direction |
|---|---|---|---|
| `pr-apierr-s3a-tendering-a` | 3 SHIPPED | 1 REJECT | fails safe |
| `pr-backlog-parser-fold-key-guard` | 3 SHIPPED | **0 ADMIT** | **re-runs shipped work** |
| `pr-ci-cache-playwright-browsers` | 3 SHIPPED | **0 ADMIT** | **re-runs shipped work** |
| `pr-rates-consumers-s1-resolver-list` | 3 SHIPPED | **0 ADMIT** | **re-runs shipped work** |
| `pr-waste-transport-rate-snapshot` | 3 SHIPPED | **0 ADMIT** | **re-runs shipped work** |
| `pr-deps-clear-high-advisories` | 0 ADMIT | 1 REJECT | real work refused |
| `pr-rates-drop-prompt-corrections` | 0 ADMIT | 1 REJECT | real work refused |
| `pr-sot-02-reconcile-2026-08-19` | 0 ADMIT | 1 REJECT | real work refused |

Both directions are live defects, and the second block is the dangerous one: **exit 3 is the gate
that exists to bin already-done work and save a whole agent run.** From the wrong cwd that gate
inverts and four merged prompts re-arm.

Today the `.queue-sync-ledger.txt` masks it — the 8 consumed prompts short-circuit before lint
runs. That ledger is **untracked and gitignored**. A fresh clone, a `git clean`, or a new machine
loses it, and the false-ADMITs are all that is left.

## The fix is proven

Setting `LINT_REPO_ROOT` and re-running all 11 from the foreign cwd reproduced the repo-cwd
verdicts **exactly** — 8 divergences went to 0.

## The work

1. In `scripts/pipeline/queue-sync.ps1`, pin the repo root for the lint call — set
   `$env:LINT_REPO_ROOT = $GitRepo` before the `node ... lint-prompt.mjs` invocation at `:125`
   (restore/clear it after). Leave a comment naming this defect so the marker is greppable.
2. Harden the default in `lint-prompt.mjs:934` so no future caller can get this wrong: when
   `LINT_REPO_ROOT` is unset, resolve the root from the **script's own location** via
   `git rev-parse --show-toplevel` rather than trusting `process.cwd()`. Keep `LINT_REPO_ROOT`
   as an explicit override.
3. Add a regression case to `scripts/pipeline/test-lint-prompt.mjs`: lint a fixture whose premise
   reads a repo-relative path, from a cwd outside the repo, and assert the verdict matches the
   repo-cwd verdict. It must fail without the fix.

## Rollback

Pure script change, no schema and no migration. Revert the commit; `queue-sync.ps1` returns to its
current behaviour and the ledger still guards the eight consumed prompts.

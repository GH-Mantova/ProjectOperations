---
premise: '! grep -q "GITPUSH_WORKTREE_MANDATORY_V1" scripts/pipeline/pipeline-lib.ps1'
premise_means: Invoke-GitPush still carries the silent-fallback default for -WorkTree, so a caller that mistypes the parameter name gets a push against the ambient current directory plus a well-formed SHA and exit 0.
scope:
  - scripts/pipeline/pipeline-lib.ps1
  - docs/pr-prompts/superseded/pr-gitpush-worktree-mandatory-HOLD.md
done_when: pnpm build && pnpm lint && grep -q "GITPUSH_WORKTREE_MANDATORY_V1" scripts/pipeline/pipeline-lib.ps1 && grep -q "Parameter(Mandatory" scripts/pipeline/pipeline-lib.ps1
size: 2
gate_allow: none
seed_only: false
escalates: true
module: pipeline
station: '01'
---

# Make `Invoke-GitPush -WorkTree` mandatory, and make a missing tree fail loud

Staged by Station 00, 2026-10-07T01:4xZ, against `origin/main` `d4c26df4`. Raised as **F10** in
breadcrumb `00-00-supervisor-2026-10-07-0014-collect-three-escalations-marco-already-answered-retired-and-05-is-the-only-station-still-silent.md`
(merged in #2256), where it was DISPATCHED to Station 06. **Station 06 has no cadence**
(`needs-marco/station-06-has-no-cadence-and-owns-the-only-remedy-2026-09-07.md`), so the dispatch had
no actor. Station 00 is staging it instead, which is inside 00's `docs/pr-prompts/` authority
(STATION-CAPABILITIES §5). Station 00 is **not** merging it — see "Do NOT" below.

## The defect, as measured

`scripts/pipeline/pipeline-lib.ps1`:

```
 33: $ErrorActionPreference = "Continue"
 37: $script:WORKTREE  = "C:\po-fix"     # our isolated worktree - safe to git-write
...
357: function Invoke-GitPush {
363:     param([string]$Branch, [string]$WorkTree = $script:WORKTREE)
364:
365:     Push-Location $WorkTree
366:     $local = (git rev-parse HEAD).Trim()
367:     git push origin $Branch 2>$null
368:     $code = $LASTEXITCODE
369:     git fetch origin --quiet 2>$null
370:     $remote = (git rev-parse ("origin/" + $Branch)).Trim()
371:     Pop-Location
```

[MEASURED] 2026-10-07T00:3xZ by Station 00, in a live run: `Test-Path C:\po-fix` -> **False**. The
parameter is `-WorkTree`; a caller that writes `-RepoPath` (the name four other helpers in this file
use) gets the default. `Push-Location C:\po-fix` then fails:

```
Push-Location : Cannot find path 'C:\po-fix' because it does not exist.
    at C:\ProjectOperations2\scripts\pipeline\pipeline-lib.ps1:365 char:5
```

**And the function keeps going.** `$ErrorActionPreference = "Continue"` is correct here and must
stay — DOCTRINE §7 guard 7 requires it in git scripts, because `"Stop"` aborts on git's harmless
CRLF warnings. The consequence is that lines 366-370 run against the **ambient current directory**
instead of `$WorkTree`, and the function returned `f873b089` with `$LASTEXITCODE` = `0`. In that run
the cwd happened to be the right worktree so the push genuinely landed; from any other cwd the
function would have pushed the wrong tree, or nothing, and still returned a well-formed 40-hex SHA
and exit 0.

This is DOCTRINE §1's own table entry reproduced inside the helper whose docstring exists to prevent
it. The read-back is real; what is unsound is that the read-back can be performed on a **different
tree than the caller named** with nothing warning.

[MEASURED] Blast radius: `Select-String -Path scripts/pipeline/*.ps1 -Pattern 'Invoke-GitPush'`
returns **one** hit — the definition at `pipeline-lib.ps1:357`. No `.ps1` in that directory calls
it, so every caller is an agent typing it by hand, which is exactly the population that gets a
parameter name wrong.

## What to build

In `scripts/pipeline/pipeline-lib.ps1`, in `Invoke-GitPush` **only**:

1. Make `-WorkTree` **mandatory** and drop the `$script:WORKTREE` default:

   ```powershell
   param(
       [Parameter(Mandatory)][string]$Branch,
       [Parameter(Mandatory)][string]$WorkTree
   )
   ```

2. **Before** `Push-Location`, assert the path exists and `throw` when it does not:

   ```powershell
   # GITPUSH_WORKTREE_MANDATORY_V1 - a missing tree must fail LOUD, never fall back to the
   # ambient cwd. With ErrorActionPreference=Continue (required by DOCTRINE section 7 guard 7)
   # a failed Push-Location does NOT stop this function, so every git call below would silently
   # run against whatever directory the caller happened to be in - and still return a
   # well-formed SHA and exit 0. Measured 2026-10-07, F10.
   if (-not (Test-Path -LiteralPath $WorkTree)) {
       throw ("Invoke-GitPush: WorkTree does not exist: " + $WorkTree)
   }
   ```

3. Add the marker string `GITPUSH_WORKTREE_MANDATORY_V1` in that comment (the `done_when` greps for
   it).

4. Update the function's docstring to say the read-back is only as good as `$WorkTree`, and that the
   parameter is mandatory for that reason.

That is the whole change. It is **additive and complete**: it removes a default that resolves to a
non-existent path, so **no working invocation changes behaviour** — any call that passed today either
named `-WorkTree` explicitly or was relying on the ambient-cwd accident this fixes.

## Do NOT

- **Do NOT change `$script:WORKTREE` at line 37**, and do NOT point it at a directory that exists.
  Repointing the default keeps a hidden default that silently pushes a tree the caller did not name,
  which is the actual defect. Other functions in this file read that variable; leave it alone.
- **Do NOT change `$ErrorActionPreference`** anywhere in this file. `"Continue"` is mandated by
  DOCTRINE §7 guard 7.
- **Do NOT touch any other function** in `pipeline-lib.ps1`, and do not reflow or re-indent the file.
- **Do NOT rename `Invoke-GitPush`** or add an alias — DOCTRINE §10.5, one identity for an artifact's
  whole life.
- **Do NOT add a `-RepoPath` alias.** Accepting the wrong name silently is the same class of bug;
  a mandatory parameter makes the mistake a loud error, which is the point.
- **Do NOT edit `scripts/pipeline/instrument-lane.json`.** `pipeline-lib.ps1` is on that file's
  NEVER-LIST and must stay there; changing the allowlist is Marco's alone.
- **Do NOT merge this PR.** `escalates: true`, so CP-26 applies a `do-not-merge` label and only
  Marco removes it. `pipeline-lib.ps1` is the core library every pipeline script depends on and is on
  the instrument lane's NEVER-LIST — it always requires Marco.
- **Do NOT touch `/sot/`**, Azure, Entra or SharePoint.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- **One attempt.** If it does not work, say `NO-OP: <reason>` and stop. Never re-run hoping for green
  (DOCTRINE §2).
- **Never exit silently.** If the work is already on `main` — i.e. the premise has gone false —
  say `NO-OP: GITPUSH_WORKTREE_MANDATORY_V1 already present` and stop. That is a correct outcome.
- **Never ask a question or stand by for approval.** There is no human in this run.
- **Read the job log before diagnosing any CI failure** (`gh run view <run-id> --job <job-id> --log`).
  Never reason a CI failure out of the diff (DOCTRINE §3).
- **Verify before you claim.** Re-read the changed function and confirm, in your PR body, that
  `Test-Path` precedes `Push-Location` and that both parameters are `Mandatory`.
- `pnpm build` and `pnpm lint` must both pass before the PR.
- Retire this prompt in the same PR: `git mv` it to
  `docs/pr-prompts/superseded/pr-gitpush-worktree-mandatory-HOLD.md`. A prompt whose PR does not
  retire it stays armable forever.

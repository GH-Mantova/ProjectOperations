---
premise: '! grep -q "SMOKE-ENV-MISSING" scripts/pipeline/smoke-pr.ps1'
premise_means: smoke-pr.ps1 creates a fresh git worktree and then runs pnpm prisma:migrate without ever provisioning a .env into it. Because .env and apps/api/.env are untracked (git ls-files returns empty for both), the fresh worktree never receives DATABASE_URL, so prisma dies with P1012 and the script reports "SMOKE FAILED - seed failed" on EVERY branch. The rule-6 smoke gate that doctrine leans on for "never merge unsmoked" is therefore non-functional, and it fails QUIETLY - it reports a branch defect when the real fault is a missing harness env.
scope:
  - scripts/pipeline/smoke-pr.ps1
done_when: 'grep -q "SMOKE-ENV-MISSING" scripts/pipeline/smoke-pr.ps1 && grep -q "Copy-Item" scripts/pipeline/smoke-pr.ps1'
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# PR prompt: smoke-pr.ps1 must provision .env into its worktree, and FAIL LOUD if it cannot

Branch: `fix/smoke-env-provisioning`. New PR.

## Why this PR exists (station 00-supervisor, 2026-07-18 / 2026-07-19)

`scripts/pipeline/smoke-pr.ps1` is the gate doctrine relies on for **"never merge unsmoked"**.
It cannot pass for **any** branch, and has been silently broken.

The script creates an isolated worktree and goes straight to migrate:

```powershell
git -C "C:\ProjectOperations2" worktree add $Worktree $Branch
Set-Location $Worktree
...
pnpm prisma:migrate
```

But the env files are **untracked**, so a fresh worktree never receives them:

```
git ls-files apps/api/.env .env      ->  (empty, both untracked)

.env present in main tree            :  True
.env present in watcher tree         :  True
.env present in a fresh smoke worktree: False   <-- the bug
```

Result, every time, on every branch:

```
Error code: P1012
error: Environment variable not found: DATABASE_URL.
SMOKE FAILED: seed failed - every e2e login depends on it
```

This is doctrine section 7 exactly: **a broken instrument handing back a confident, wrong verdict.**
Any agent that "ran the smoke" and saw a failure was reading a harness defect, not the branch.
A tool that cannot run must **fail loud, never fail quiet.**

## What to do

Edit **`scripts/pipeline/smoke-pr.ps1` only.**

1. Immediately after the worktree exists and `Set-Location $Worktree` has run, and **before**
   `pnpm prisma:migrate`, provision the env files by copying them from the main tree
   `C:\ProjectOperations2`:

   - `C:\ProjectOperations2\.env`          -> `$Worktree\.env`
   - `C:\ProjectOperations2\apps\api\.env` -> `$Worktree\apps\api\.env`

   Use `Copy-Item` with `-Force`. Copy a file only if the source exists. Create the
   `apps\api` destination directory first if it is somehow absent.

2. **Fail loud when the env cannot be provisioned.** After the copy, assert that
   `$Worktree\apps\api\.env` exists AND that a `DATABASE_URL=` line is present in one of the two
   copied files. If that assertion fails, call the script's existing `Die` helper with a message
   containing the exact token **`SMOKE-ENV-MISSING`**, for example:

   ```
   Die "SMOKE-ENV-MISSING: could not provision .env into the smoke worktree from C:\ProjectOperations2 - the smoke result would be meaningless, refusing to continue." 1
   ```

   The token `SMOKE-ENV-MISSING` must appear literally in the script (both `done_when` and the
   premise grep for it). Use the same non-zero-exit `Die` pattern the script already uses so the
   failure is unmistakable and never mistaken for a branch defect.

3. Echo a `Step` line stating that env was provisioned and from where, so the transcript shows it.

4. Read the file back and confirm both `done_when` greps match before opening the PR.

## Do NOT

- **Do NOT run `prisma migrate dev`, `migrate reset`, `db push`, or `pnpm seed` against the dev
  database as part of this work.** The dev DB being ~30 migrations behind is a **separate, open
  question already escalated to Marco** (`docs/pr-prompts/needs-marco/smoke-gate-broken-and-devdb-behind-20260719.md`).
  Resetting or reseeding it is destructive to Marco's local data and is a **hard stop**. This PR
  fixes env provisioning ONLY.
- Do NOT try to make the smoke actually pass end-to-end, and do NOT treat a remaining
  migrate/seed failure as your problem. Fixing the env plumbing is the whole job. If the smoke
  still fails afterwards for the migration-drift reason above, that is the expected, already-known
  state - say so and still open the PR.
- Do NOT commit `.env`, `apps/api/.env`, or any real secret, connection string, password or token.
  They are untracked on purpose. You are copying them at runtime, never adding them to git.
  Verify with `git status` that no `.env` file is staged before you commit.
- Do NOT change what the smoke runs (the playwright target, the spec selection) or any other
  pipeline script.
- Do NOT touch Azure, Entra, SharePoint, App Service settings, or any deploy config.

## PowerShell 5.1 constraint (LL-22 - this WILL break the script if ignored)

`smoke-pr.ps1` must stay **pure ASCII**. PowerShell 5.1 reads UTF-8-without-BOM as Windows-1252, so
a single em-dash, curly quote or emoji becomes a parser error and takes the whole gate down.
Before committing, grep the file for non-ASCII and confirm zero matches:

```powershell
Select-String -Path scripts/pipeline/smoke-pr.ps1 -Pattern '[^\x00-\x7F]'
```

Use plain hyphens and straight quotes only.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** -- the work is discarded either way.

## Guardrails

- One attempt. If blocked, say `NO-OP: <reason>` loudly -- never exit silently, never "stand by"
  for approval (there is no human in this run).
- `pnpm build` + `pnpm lint` must pass before you open the PR.
- Read the CI job log before diagnosing any CI failure; never re-run hoping for green.
- The completion test: is there a PR number in your output? If not because the work was already on
  main, say `NO-OP`. If not because you are waiting for someone -- there is nobody. Open the PR.

---
premise: 'grep -q "po-fix" scripts/pipeline/check-all-drift.ps1'
premise_means: check-all-drift.ps1 (and preflight.ps1) still Set-Location to "C:\po-fix", a directory that does not exist on this machine, with no guard - so the cd fails and every git/gh command after it runs from an unintended working directory.
scope:
  - scripts/pipeline/check-all-drift.ps1
  - scripts/pipeline/preflight.ps1
done_when: '! grep -q "po-fix" scripts/pipeline/check-all-drift.ps1 && ! grep -q "po-fix" scripts/pipeline/preflight.ps1 && grep -q "Test-Path" scripts/pipeline/check-all-drift.ps1 && grep -q "Test-Path" scripts/pipeline/preflight.ps1'
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# Guard the hard-coded Set-Location in check-all-drift.ps1 and preflight.ps1 (they cd to a directory that no longer exists)

## The defect (found by 04-scanner, audit sweep, 2026-07-20)

Both scripts open by changing directory to a hard-coded path and then immediately run `git` / `gh`
against whatever tree they land in:

- `scripts/pipeline/check-all-drift.ps1:2-4` - sets ErrorActionPreference to "Continue", then
  `Set-Location "C:\po-fix"`, then `git fetch origin --quiet`.
- `scripts/pipeline/preflight.ps1:87-89` - `Set-Location "C:\po-fix"`, then `git fetch origin --quiet`,
  then `gh pr list --state open --json ...` piped into ConvertFrom-Json.

**`C:\po-fix` does not exist.** Verified this run:

```
> if exist C:\po-fix (echo PO-FIX-EXISTS) else (echo PO-FIX-MISSING)
PO-FIX-MISSING
```

Because ErrorActionPreference is "Continue", the failed `Set-Location` does **not** stop the script.
It prints a red ItemNotFoundException and then **falls through and keeps going** from the caller's
current directory. Observed verbatim when 04-scanner ran the script as its own station brief
instructs:

```
Set-Location : Cannot find path 'C:\po-fix' because it does not exist.
At C:\po-scan-a1\scripts\pipeline\check-all-drift.ps1:3 char:1
+ Set-Location "C:\po-fix"
...
#718  (no schema change)
#717  (no schema change)
#708  map in sync
```

The report was still emitted. **It looked like a clean, authoritative result** - while the `git`
commands behind it ran against an unintended tree. That is precisely DOCTRINE section 7, "your
instrument lies": a checker that cannot tell you it measured the wrong thing is worse than one that
fails outright.

This is the read-only sibling of the already-learned rule *"a FAILED Set-Location falls through and
runs git in the WATCHER tree - guard every mutation with an explicit pwd check."* Here nothing is
mutated, so no damage has been done; the cost is **silently wrong diagnostics** from two scripts the
stations are told to trust. `check-all-drift.ps1` is listed in the 04-scanner brief under "Audit
sweep", and `preflight.ps1` is a station diagnostic.

Contrast with the healthy majority: the ~30 other pipeline scripts Set-Location to
`C:\po-watcher\ProjectOperations`, which **does** exist (verified this run: WATCHER-EXISTS). They are
not in scope here - only the two `C:\po-fix` callers are broken today.

## Five-angle evidence

1. **Reproduce** - ran check-all-drift.ps1; captured the ItemNotFoundException above. Confirmed
   deterministically by a direct existence test (PO-FIX-MISSING), not a one-off observation.
2. **Source** - read both files; the unguarded Set-Location is at `check-all-drift.ps1:3` and
   `preflight.ps1:87`, with ErrorActionPreference "Continue" set at `check-all-drift.ps1:2`.
3. **Ground truth** - DOCTRINE section 7 (evidence-not-assertion / your instrument lies), plus the
   existing guard-the-cd lesson.
4. **History** - findstr over `sot/05-decisions-and-lessons.md` and `docs/qa/qa-findings.md` for
   "check-all-drift" and "po-fix" returns **nothing**; not previously filed. Open PR #716 ("delete 15
   archaeology scripts") deletes `commit-pipeline-v2.ps1` but **not** these two - verified via
   `gh pr diff 716 --name-only`. No other open PR touches them.
5. **Blast radius** - every `C:\po-fix` reference in `scripts/`: `check-all-drift.ps1:3`,
   `preflight.ps1:87`, `commit-pipeline-v2.ps1:49` (deleted by #716), and the fix-544-*,
   resolve-538-*, dbg-538-validate, final-rebase, show-conflict, fix-gate-markers,
   fix-datamodel-drift, resolve-and-regen archaeology scripts (do-not-call; #716 territory).
   **Only the two in `scope` are live scripts a station is told to run.**

## What to build

For **each** of the two files, replace the bare `Set-Location "C:\po-fix"` with a guarded resolution
that fails loudly instead of falling through:

1. Resolve the repo directory to the first of these that exists, in order:
   `C:\po-watcher\ProjectOperations`, then `C:\ProjectOperations2`. Use `Test-Path`.
2. If neither exists, Write-Host a clear one-line error naming both candidates and `exit 1`.
   **Do not continue.** A checker that cannot locate its repo must report that it cannot run - it
   must not emit a report.
3. Set-Location to the resolved path, then **assert** it took, by comparing `(Get-Location).Path`
   against the resolved path and exiting 1 with a FATAL message if they differ.
4. Leave every other line of both scripts unchanged - same output format, same checks, same exit
   codes on the success path.

In preflight.ps1 note the cd at line 87 happens mid-script (section "3. GITHUB") after earlier
sections have already run; keep it in place, just guard it. Do not hoist it to the top.

preflight.ps1 also has a second `Set-Location "C:\po-watcher\ProjectOperations"` at line 52 - that
path exists and is out of scope; leave it alone.

## Do NOT

- Do NOT create `C:\po-fix`. The directory is gone on purpose; the bug is the unguarded assumption,
  not the missing folder.
- Do NOT touch the ~30 scripts that cd to `C:\po-watcher\ProjectOperations` (that path exists), and
  do NOT touch commit-pipeline-v2.ps1 or any fix-544-* / resolve-538-* archaeology script - they are
  PR #716's territory and touching them will conflict.
- Do NOT change what either script reports, its output format, or its success-path exit codes.
- Do NOT touch `sot/`, migrations, seeds, `.env`, or Azure/Entra/SharePoint.

## PowerShell 5.1 constraint (non-negotiable)

Both files must stay **pure ASCII**. No em-dashes, no curly quotes, no arrows, no box-drawing.
Before committing, verify that searching both files for the pattern `[^\x00-\x7F]` returns
**nothing**. Write files with a method that does not inject UTF-16 or U+FFFD.

## Verify before you open the PR

1. Run check-all-drift.ps1 from a directory that is **not** a repo - it must print the FATAL/exit-1
   message and emit **no** drift report, OR resolve to a real repo and run clean. It must **never**
   print a report after a failed cd.
2. Run it from `C:\ProjectOperations2` - it must produce the same per-PR drift lines as before.
3. Both grep clauses in `done_when` return 0.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. If blocked, say `NO-OP: <reason>` - never exit silently, never "stand by" for approval.
- Read the CI job log before diagnosing any red check (never from the diff alone).
- The completion test: is there a PR number in your output? If not because the work was already on
  `main`, say `NO-OP`. If not because you are waiting for someone - WRONG, there is nobody; open the PR.

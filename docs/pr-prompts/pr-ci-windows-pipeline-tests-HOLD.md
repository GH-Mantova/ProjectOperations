---
premise: '! grep -q "windows-latest" .github/workflows/ci.yml'
premise_means: No CI job runs on Windows, so the eight arm-prompt tests are skipped on every run and the arming serializer has zero real CI coverage.
scope:
  - .github/workflows/ci.yml
done_when: grep -q "windows-latest" .github/workflows/ci.yml && node --test "scripts/pipeline/__tests__/*.mjs"
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# The arming serializer has no CI coverage, and that is how it shipped broken

## The defect, measured 2026-08-26 against `1f3a3747`

`scripts/pipeline/__tests__/arm-prompt.test.mjs` holds eight tests for `arm-prompt.ps1` — the script
that serializes arming behind an OS lock and guards the shared git index. Every one of them is gated:

```js
const IS_WIN = process.platform === "win32";
const PWSH   = IS_WIN ? findPwsh() : null;
```

`ci.yml:153` runs the `pipeline-tests` job on `ubuntu-latest`. So on every CI run **all eight SKIP**,
and `ci.yml:174` (`node --test "scripts/pipeline/__tests__/*.mjs"`) goes green regardless of what
happened to the script.

That is not theoretical. On 2026-08-26 `arm-prompt.ps1` was found to declare `#Requires -Version 5.1`
while being **unparseable by 5.1** — BOM-less UTF-8 containing em dashes, which 5.1 decodes as
Windows-1252, turning `U+2014` into three characters ending in a double quote and terminating a
string mid-file. Measured: **3 parse errors under `powershell.exe`, 0 under `pwsh` 7.**
`powershell.exe` is the default shell on the dev box, so the tool built to prevent index collisions
had never been runnable by most of its callers. CI was green throughout. Three further defects in the
same script were found by hand in the same review.

Marco authorised the runner spend on 2026-08-26.

## What to build

Add ONE job to `.github/workflows/ci.yml`. Mirror the existing `pipeline-tests` job (`:148-175`) —
same `actions/checkout@v4.2.2` with **`fetch-depth: 0`**, same `actions/setup-node@v4.1.0` with
node 22 — but `runs-on: windows-latest`, and run **only** the pipeline suite:

```
node --test "scripts/pipeline/__tests__/*.mjs"
```

`fetch-depth: 0` is not tidiness: the comment at `:155-163` records that a shallow checkout has no
`origin/main` ref, the linter's gate probes then take their warn-and-skip fail-safe, and a rule that
quietly does nothing in CI is the exact failure this cluster exists to prevent.

Do **not** duplicate the API, web, e2e or CodeQL jobs onto Windows. One job, one suite.

### Two traps this job must not fall into

**1. The glob will not expand the same way.** On `windows-latest` the default shell is PowerShell,
which does not glob-expand arguments to external commands the way bash does. The Ubuntu job's own
comment (`:168-172`) records that a bare directory path makes `node --test` exit 1 having discovered
**zero** tests — a non-discovery that reads as a failure. The Windows inverse is worse: a literal
unexpanded pattern that discovers zero tests and exits **0**.

Set `shell: bash` on the run step (GitHub's Windows runners provide it) so the glob behaves exactly
as it does on Ubuntu. If you instead rely on Node's own glob handling, you must prove it discovered
the tests — see below.

**2. A job that discovers nothing must FAIL.** A green Windows job that ran zero tests recreates the
precise blindness this slice exists to remove, while looking like it fixed it. Assert the count: the
`node --test` output must show **8 passing and 0 skipped**, and the step must fail otherwise. A grep
on the summary line, or `--test-reporter` output checked for a non-zero pass count, is enough.

## Do NOT

- Do NOT add the new job to branch protection's required checks. That is a repo-settings change,
  it is Marco's, and a new job that instantly blocks every PR is not a good first impression.
  Note in the PR body that he may want to require it once it has run green a few times.
- Do NOT change `arm-prompt.ps1`, `arm-prompt.test.mjs`, or the `IS_WIN` / `PWSH` guards. The guards
  are correct — they exist so the suite skips cleanly off-Windows. The fix is to give it a Windows
  runner, not to weaken the guard.
- Do NOT touch the existing `pipeline-tests` job beyond leaving it exactly as it is.
- Do NOT add Windows runners to any other workflow.

## VERIFY

```bash
grep -n "windows-latest" .github/workflows/ci.yml
node --test "scripts/pipeline/__tests__/*.mjs"
```

The second command is the local control: it must report **8 pass, 0 fail, 0 skipped** when run on a
Windows host, and skip cleanly on Linux. Both are correct answers for their platform; what must never
happen is zero discovered.

## Guardrails

- One attempt. If `windows-latest` already appears in `ci.yml`, say `NO-OP: <reason>`.
- The workflow must remain valid YAML and the existing jobs must be untouched.
- Never exit silently. Never ask a question or stand by for approval - there is no human in this run.
- Read the job log before diagnosing any CI failure.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

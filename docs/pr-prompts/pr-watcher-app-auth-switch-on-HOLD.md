---
premise: '! grep -q "PO_WATCHER_APP_KEY" scripts/pr-watcher/start-watcher.ps1'
premise_means: >-
  PR #1510 landed scripts/pr-watcher/app-auth.mjs and wired it into index.mjs, but NOTHING SETS THE
  THREE ENVIRONMENT VARIABLES IT READS, so the capability is dead code on every machine. Measured
  2026-09-02T05:3xZ at origin/main 3a383e23 - grep for PO_WATCHER_APP_KEY across
  scripts/pr-watcher/start-watcher.ps1 returns zero hits, so index.mjs:3125 takes the branch that
  logs "app-auth OFF (PO_WATCHER_APP_KEY unset - running as ambient GH-Mantova)". The watcher
  therefore still pushes, labels and merges as GH-Mantova, which is the same account every Claude
  session authenticates as (verified the same day - gh api user returns GH-Mantova). That collision
  is the reason releases to date are unattributable, and it is why CP-26's own header comment says a
  released escalation is "indistinguishable in the audit trail from an agent clearing its own gate".
scope:
  - scripts/pr-watcher/start-watcher.ps1
  - docs/runbooks/watcher-identity-github-app.md
done_when: >-
  grep -q "PO_WATCHER_APP_KEY" scripts/pr-watcher/start-watcher.ps1 && grep -q "PO_WATCHER_APP_ID"
  scripts/pr-watcher/start-watcher.ps1 && grep -q "PO_WATCHER_INSTALLATION_ID"
  scripts/pr-watcher/start-watcher.ps1
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# The watcher's GitHub App identity is built, merged, and switched OFF

## The defect, measured

`scripts/pr-watcher/app-auth.mjs` reads exactly three environment variables:

| variable | what it holds | secret? |
|---|---|---|
| `PO_WATCHER_APP_ID` | the App's numeric id | no - a public identifier |
| `PO_WATCHER_INSTALLATION_ID` | the installation's numeric id | no - a public identifier |
| `PO_WATCHER_APP_KEY` | **a filesystem PATH to the private-key PEM** (`app-auth.mjs:141`, `const keyPath = env.PO_WATCHER_APP_KEY`) | the path is not secret; the file it names is |

`start-watcher.ps1` has a defaults block at lines 158-162 that sets five `PR_WATCHER_*` variables and
a startup banner at lines 191-195 that prints them. **None of the three App variables appears
anywhere in the file.** So `isAuthLive()` is false, and every push, label and merge the watcher makes
is attributed to `GH-Mantova`.

## What to build

**1. A defaults block for App auth, next to the existing one at `start-watcher.ps1:158-162`.**

Read the three values from a **machine-local** file that is NOT in this repository and never will be:
`C:\po-secrets\watcher-app-auth.ps1`. Dot-source it when it exists; do nothing when it does not.

    # App identity (optional). Absent file => auth stays OFF and the watcher runs as before.
    $AppAuthConfig = "C:\po-secrets\watcher-app-auth.ps1"
    if (Test-Path $AppAuthConfig) { . $AppAuthConfig }

That local file is Marco's to write and is out of scope for this prompt. Document its expected shape
in the runbook (see step 3) as three `$env:` assignments and nothing else.

**2. A banner line, next to `start-watcher.ps1:191-195`,** so the identity is visible at startup
without reading code. Print `configured` plus the App id when the key path is set, and
`OFF - ambient GH-Mantova` when it is not.

**3. Correct the runbook.** `docs/runbooks/watcher-identity-github-app.md` step 5 carries a command
that can never work: it is JWT-only and cannot be run with a user token. Replace that step with the
switch-on procedure this prompt implements, and state the verification line explicitly - after a
restart, `index.mjs:3106` must log:

    app-auth:    gh[installation] (projectops-watcher[bot], WATCHER_APP_AUTH_V1)

If it instead logs the `OFF` line from `:3125`, the switch-on did not take.

## Why it must stay OFF when the file is absent

CI, a fresh clone, and any second machine have no key. Making App auth mandatory would fail the
watcher closed on every one of them. **Absent config must be a silent no-op that preserves today's
behaviour exactly** - that is what makes this change additive rather than a migration.

## Do NOT

- Do not put the private key, or its contents, anywhere in this repository. `PO_WATCHER_APP_KEY` is
  a PATH. If your diff contains PEM material, you have failed.
- Do not commit `C:\po-secrets\watcher-app-auth.ps1` or add `C:\po-secrets\` to the repo in any form.
- Do not hard-code the App id or installation id into `start-watcher.ps1`. They are not secret, but
  they are machine-and-account facts and they belong in the local config beside the key path.
- Do not restart, kill or relaunch the watcher. A running watcher keeps the old code and the old
  identity until an idle-window restart, which is Station 00's to schedule, not this run's.
- Do not touch `PR_WATCHER_AUTO_UPDATE` at `:159`. Its value contradicts the documented default in
  `README.md:90` and `index.mjs:155`, which is a real and separate defect - leave it for its own PR
  so the two changes do not share a blame line.
- Do not change `app-auth.mjs` or `index.mjs`. They are correct; only the wiring is missing.

## Verification

- [ ] `grep -c "PO_WATCHER_APP_KEY" scripts/pr-watcher/start-watcher.ps1` is at least 1, and the same
      for `PO_WATCHER_APP_ID` and `PO_WATCHER_INSTALLATION_ID`.
- [ ] With `C:\po-secrets\watcher-app-auth.ps1` absent, `start-watcher.ps1` still parses and the
      banner prints the OFF form. Prove it, do not assert it.
- [ ] The diff contains no PEM material and no `C:\po-secrets\` file.
- [ ] `docs/runbooks/watcher-identity-github-app.md` no longer carries the JWT-only step 5 command.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.

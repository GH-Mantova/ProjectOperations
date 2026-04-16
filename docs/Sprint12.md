# Sprint 12 Handover

Date: 2026-04-14
Workspace: `C:\Dev\ProjectOperations`
Scope: Tendering hardening follow-through, Playwright/CI compatibility, GitHub publish/merge path, rollout planning handover

## Summary

This session closed the loop on the Tendering module's recent hardening work and moved the project from "locally validated" to "repo-backed and merged."

Key outcomes:

- confirmed the Tendering browser suite had passed locally through the reuse-runtime path
- completed the GitHub/repo wiring follow-through for the Playwright cross-platform startup fix
- published the Playwright CI compatibility update through the GitHub connector because local git branch creation was blocked by `.git/refs` permission issues
- opened PR `#1` and confirmed it was later merged into `main`
- updated the local handover documentation in `docs/continuation-log.md` to reflect the merged state
- prepared rollout guidance for launching Tendering online, including SharePoint positioning and pilot-user recommendations

No continuation-log update is required from the next AI agent unless the user explicitly requests it.

## What Was Done

### 1. Verified repo and remote state

- confirmed the workspace is connected to:
  - `https://github.com/GH-Mantova/ProjectOperations.git`
- confirmed the accessible GitHub repo is:
  - `GH-Mantova/ProjectOperations`
- confirmed the current branch/remote relationship was healthy enough to proceed

### 2. Checked the remaining local diff

At the time of GitHub publication, the only remaining local code diff was the Playwright configuration change in:

- [playwright.config.ts](C:\Dev\ProjectOperations\playwright.config.ts)

That diff made `webServer` startup OS-aware:

- Windows kept using:
  - `pnpm dev:api:e2e`
  - `pnpm dev:web:e2e`
- non-Windows runners switched to shell-native Linux-compatible env assignment

This was specifically to restore compatibility with the GitHub Actions workflow on Ubuntu while preserving the proven local Windows validation path.

### 3. Re-validated the safe local checks

The following checks were run and passed:

- `pnpm --filter @project-ops/web exec -- tsc -p . --noEmit`
- `pnpm test:web:logic`

These were treated as the safe validation path for the config-only follow-up.

### 4. Worked around managed-environment git write issues

Local git could read state, but branch creation failed due to permission issues when trying to create lockfiles under `.git/refs`.

Observed behavior:

- local branch creation failed with permission-denied lockfile errors
- direct local branch workflow was unreliable in this managed environment

Workaround used:

- created the remote branch through the GitHub connector
- published the code change through GitHub connector commit/tree APIs instead of relying on local branch creation

### 5. Published the CI compatibility branch and PR

Created remote branch:

- `codex/playwright-ci-compat`

Published a PR titled:

- `Make Playwright startup CI-compatible`

PR details:

- PR number: `#1`
- repo: `GH-Mantova/ProjectOperations`

The PR initially contained:

- OS-aware `playwright.config.ts`

Later, the PR also included an update to:

- [playwright.yml](C:\Dev\ProjectOperations\.github\workflows\playwright.yml)

That workflow adjustment added a Prisma generation step before API build:

- `pnpm --dir apps/api exec prisma generate`

### 6. Confirmed PR merge outcome

The user later confirmed that GitHub showed:

- PR `#1` marked ready for review
- PR `#1` merged into `main`
- merge commit `8feb303`

Meaning:

- the cross-platform Playwright startup fix is now landed on `main`
- the GitHub repo/PR flow has been exercised successfully
- the Tendering module is no longer blocked on repo/CI wiring

### 7. Updated project handover documentation

The session updated:

- [continuation-log.md](C:\Dev\ProjectOperations\docs\continuation-log.md)

The log was brought forward to reflect:

- PR `#1` merged
- cross-platform Playwright startup fix landed
- GitHub workflow now includes Prisma generate before API build
- next step is no longer repo wiring; it is optional Tendering UX refinement or moving on to the next high-value module/workflow

Important:

- the user has now explicitly requested that the next agent should **not** update the continuation log unless asked

## Key Fixes Landed Or Confirmed In This Session

### Playwright cross-platform startup compatibility

File:

- [playwright.config.ts](C:\Dev\ProjectOperations\playwright.config.ts)

Fix:

- made Playwright `webServer` startup commands OS-aware
- preserved working Windows scripts
- restored compatibility for Linux CI runners

Why it mattered:

- the repo's Playwright workflow runs on `ubuntu-latest`
- Windows-style `set ...&&` command patterns do not work there
- this change prevents the GitHub workflow from failing for environment-command reasons

### GitHub Actions Prisma generation

File:

- [playwright.yml](C:\Dev\ProjectOperations\.github\workflows\playwright.yml)

Fix:

- added a Prisma client generation step before API build

Why it mattered:

- the CI environment must have Prisma client generated before some API build/test steps
- this reduces the chance of workflow failure due to generated client absence

### GitHub connector publish fallback

No code file for this; this was a process fix.

Fix:

- used the GitHub connector instead of local git branching when `.git/refs` lockfile permissions blocked local branch creation

Why it mattered:

- it allowed progress and publication to continue despite local machine restrictions

## Files Created / Changed / Relevant In This Session

### Changed or published

- [playwright.config.ts](C:\Dev\ProjectOperations\playwright.config.ts)
  - OS-aware Playwright startup behavior for Windows vs non-Windows

- [playwright.yml](C:\Dev\ProjectOperations\.github\workflows\playwright.yml)
  - Prisma generate step added before API build

- [continuation-log.md](C:\Dev\ProjectOperations\docs\continuation-log.md)
  - updated to reflect merged PR state and next-step guidance

### Created in this session

- [Sprint12.md](C:\Dev\ProjectOperations\docs\Sprint12.md)
  - this handover file

### Important related files from the prior Tendering hardening effort

- [tendering.spec.ts](C:\Dev\ProjectOperations\tests\e2e\tendering.spec.ts)
  - broad Tendering browser coverage including:
    - route coverage
    - activity/workspace checks
    - board drag/drop prompts
    - stakeholder save/revert behavior
    - communication queue ordering and overdue labeling
    - dedicated workspace switching via direct links

- [playwright.reuse.config.ts](C:\Dev\ProjectOperations\playwright.reuse.config.ts)
  - reuse-runtime Playwright config for already-running local servers

- [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx)
  - CRM polish and workspace behavior improvements

- [apps/web/package.json](C:\Dev\ProjectOperations\apps\web\package.json)
  - includes `dev:e2e`

- [package.json](C:\Dev\ProjectOperations\package.json)
  - includes:
    - `dev:api:e2e`
    - `dev:web:e2e`
    - `test:tendering:e2e:reuse`

- [vite.config.js](C:\Dev\ProjectOperations\apps\web\vite.config.js)
  - made ESM-safe for native config loader behavior

## Current State

### Tendering product state

Tendering is now in a strong, pilot-ready state:

- dashboard / pipeline / create / workspace flow exists
- dedicated workspace and popup workspace both function
- unified activity workflow exists
- communication queue and stakeholder editing are in place
- lifecycle actions exist:
  - award
  - contract
  - convert
  - rollback
- local Tendering E2E coverage is broad and passing via the reuse path

### Repo / delivery state

- repo is connected to GitHub
- GitHub connector access is working
- PR flow has been exercised successfully
- PR `#1` was merged into `main`
- cross-platform Playwright startup fix is landed

### Environment constraints still relevant

- managed Windows environment
- local git branch creation may still fail due to `.git/refs` permission/lockfile behavior
- `spawn EPERM` remains a risk for some local tool/runtime paths
- detached background server launch remains unreliable
- PowerShell only

### Recommended local validation path when browser verification is needed

Use this manual sequence:

1. Terminal 1

```powershell
cd C:\Dev\ProjectOperations
pnpm dev:api:e2e
```

2. Terminal 2

```powershell
cd C:\Dev\ProjectOperations
pnpm dev:web:e2e
```

3. Terminal 3

```powershell
cd C:\Dev\ProjectOperations
pnpm test:tendering:e2e:reuse
```

## Rollout / Product Recommendations Captured In This Session

The user asked how to make Tendering accessible online and how SharePoint should fit into that plan.

Recommended deployment shape:

- host web app online
- host API online
- use PostgreSQL as the operational database
- keep SharePoint as:
  - Intranet launch surface
  - file repository / backup location

SharePoint locations discussed:

- Intranet entry point:
  - `https://initialservices.sharepoint.com/sites/Intranet`
- document/virtual-drive site:
  - `https://initialservices.sharepoint.com/sites/Initialservices`

Recommended usage:

- put a “Tendering CRM” link on the Intranet site
- store operational folders/backups under the `Initialservices` site

Recommended app URL:

- `https://tendering.initialservices.com.au`

Recommended hosting choice:

- Azure-hosted web + API

Recommended database choice:

- Azure Database for PostgreSQL

Recommended initial SharePoint folder structure:

- `Project Operations/`
- `Project Operations/Tendering/`
- `Project Operations/Tendering/Incoming Documents/`
- `Project Operations/Tendering/Submitted Tenders/`
- `Project Operations/Tendering/Awarded/`
- `Project Operations/Tendering/Lost/`
- `Project Operations/Jobs/`
- `Project Operations/Backups/`
- `Project Operations/Backups/App Exports/`
- `Project Operations/Backups/CSV Snapshots/`

Recommended pilot users:

- primary estimator / tender lead
- operations lead
- project delivery lead
- admin / coordination support
- reviewer / manager / director

### Important architecture limitation still in place

The app still uses a mock SharePoint adapter in the current codebase.

That means:

- SharePoint can support rollout operationally right away as entry point + file repository
- but the app does not yet perform live Microsoft Graph-backed SharePoint integration

Recommended rollout sequence:

1. launch Tendering online with Postgres as system-of-record
2. let users start entering real tender data
3. use SharePoint for file organization and backups
4. later replace the mock SharePoint adapter with real Graph integration
5. later add Microsoft 365 / Azure AD SSO

## Roadmap / Recommendations From Here

Now that Tendering is online-ready and the repo/PR path is proven, the next major development priorities should be:

### 1. Tendering production hardening

Only based on real pilot feedback:

- fix support issues
- refine fields or UX where users stumble
- improve audit/reporting where needed
- tighten permissions if required

### 2. Award-to-delivery handover refinement

This is the highest-value next workflow if the app is to become the front door of the ERP:

- make tender-to-job conversion even cleaner
- carry forward operational context without re-entry
- strengthen the contract / awarded-client / job-start pipeline

### 3. Jobs and Delivery maturation

Once tenders convert cleanly, jobs should become the next major active module:

- job register/detail depth
- delivery coordination
- issues/variations/progress workflow

### 4. Scheduler integration

Connect awarded/converted jobs into live planning:

- shifts
- workers
- assets
- conflicts and workload visibility

### 5. Real SharePoint integration

Replace the mock SharePoint adapter with real Graph-backed folder/document behavior.

### 6. Microsoft 365 SSO

Move from local JWT-only login toward enterprise-friendly Microsoft identity.

## Clear Instructions For The Next AI Agent

1. Work only in:
   - `C:\Dev\ProjectOperations`

2. Do not assume the next task is more Tendering code.
   - Tendering is in a strong state.
   - PR `#1` is already merged.
   - The next product step should be driven by live user friction or the next ERP workflow, not by redoing repo/CI work.

3. Do not update:
   - [continuation-log.md](C:\Dev\ProjectOperations\docs\continuation-log.md)
   unless the user explicitly asks.

4. Treat these as current truths:
   - local Tendering E2E is green via the reuse-runtime path
   - cross-platform Playwright startup compatibility is merged to `main`
   - GitHub PR flow works
   - local git branch creation may still fail because of `.git/refs` lockfile permissions

5. If browser validation is needed, prefer:

```powershell
pnpm dev:api:e2e
pnpm dev:web:e2e
pnpm test:tendering:e2e:reuse
```

6. If Git publication is needed again:
   - try local git first only if it behaves
   - if local branch creation fails again with `.git/refs` lockfile permission errors, prefer the GitHub connector path

7. The best next product direction is:
   - support Tendering pilot rollout
   - fix any real pilot friction
   - otherwise move into award-to-job handover, Jobs/Delivery, and Scheduler integration

8. If the user asks for deployment/go-live help:
   - assume SharePoint is the surrounding Microsoft environment
   - use Intranet as launch surface
   - use the Initialservices site for folders/backups
   - remember the current app-side SharePoint integration is still mock-based

## Direct Instruction To The Next AI Agent

Start from `C:\Dev\ProjectOperations` and treat Tendering as stable and pilot-ready unless the user shows fresh runtime evidence of friction. Do not revisit PR `#1` or repo-wiring tasks; those are already complete. Focus next on either rollout support, production-hardening issues discovered by real users, or the next high-value workflow after Tendering: award-to-job handover, Jobs/Delivery, Scheduler, or real SharePoint integration. Do not update the continuation log unless the user explicitly asks for it.

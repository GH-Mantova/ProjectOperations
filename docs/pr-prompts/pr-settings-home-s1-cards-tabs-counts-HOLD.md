---
premise: '! grep -q "tabs" apps/web/src/pages/settings/SettingsHomePage.tsx'
premise_means: >-
  The settings home renders no tab information at all. Measured 2026-09-01 on origin/main at
  000de2d9 - SettingsHomePage.tsx contains ZERO occurrences of "tabs", while
  apps/web/src/components/settings-nav-items.ts declares a fully populated tabs array on every
  item (Company 7, Admin settings 6, Reference data 4, Field definitions 3, AI 2 = 22 tabs across
  20 pages). settings-search.ts already matches on label, description AND tab (16 tab references),
  so search can find a tab today but the page cannot show one. The approved mock-up also shows a
  counts line and an All items / Grouped toggle - "All items" occurs 0 times in the page. The data
  and the search are built; the surface is not.
design_ref: https://claude.ai/code/artifact/524ef7db-7234-4254-8c7f-9e5da3d953c1
scope:
  - apps/web/src/components/settings-nav-items.ts
  - apps/web/src/components/SettingsShell.tsx
  - apps/web/src/pages/settings/SettingsHomePage.tsx
  - apps/web/src/pages/settings/__tests__/SettingsHomePage.test.tsx
  - apps/web/src/components/__tests__/settings-nav-model.test.ts
done_when: >-
  grep -q "tabs" apps/web/src/pages/settings/SettingsHomePage.tsx && grep -q "All items"
  apps/web/src/pages/settings/SettingsHomePage.tsx && grep -q "need access"
  apps/web/src/pages/settings/SettingsHomePage.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# Settings home: show the tabs that already exist, count what is really there, and use the approved copy

Marco approved a mock-up of this page (`erp-settings-home-mockup.pdf`, 2026-09-01). This slice builds
the card surface. It does NOT touch search behaviour, which already works.

**About the `design_ref`.** That approved PDF was never published and never committed - it is a
browser download on Marco's machine, which is why this prompt carried no `design_ref` and therefore
could not be armed at all once VS-S3's gate landed. The design was published as an artifact on
2026-09-05 (`524ef7db`), built from `docs/plans/settings-home-plan.md` and this prompt and then
checked against the recovered PDF. **Where the artifact and the PDF differ, this prompt is the
authority** - the artifact records the differences in its own build-notes panel rather than hiding
them. Cite the artifact in the PR body; do not go looking for the PDF.

## What is already right - do not rebuild it

- `settings-search.ts` already matches **label, description and tab name**. Do not change it.
- `settings-nav-items.ts` already declares `tabs` on every item, with ids, labels and descriptions.
- Locked cards, `Request access`, and the permission gating already exist in the page.

## The defect

**[MEASURED] origin/main 000de2d9:**

| probe | result |
|---|---|
| `tabs` in `SettingsHomePage.tsx` | **0** |
| `All items` in `SettingsHomePage.tsx` | **0** |
| `need access` in `SettingsHomePage.tsx` | **0** |
| `tabs` in `settings-nav-items.ts` | 24 |
| tab entries actually declared | 22, across 20 pages |

So the page shows no tab chips, no counts line, and only the `Grouped` half of a two-state toggle.
A user can search "GST", match the **Commercial defaults** tab inside Company profile, and be given
no indication of which tab matched.

## What to build

### 1. Tab chips on each card

Under each card description, render one small chip per entry in that item's `tabs` array. A card
with an empty `tabs` array renders no chip row at all - not an empty container.

When a search is active and the match came from a tab, **highlight that chip**. `searchSearch`
already returns which field matched; use it rather than re-deriving the match in the page.

### 2. The counts line

Directly under the search box, render the real counts in the form:

```
N settings you can open · N tabs · N need access
```

🔴 **Compute all three from the live, permission-filtered item list. Do NOT hard-code them.** The
mock-up shows `11 · 21 · 10` for one particular persona and states a total of "30 pages... 47
searchable entries"; **the real nav holds 20 pages and 22 tabs, and this slice adds 2 more pages
(below) for 22 and 22.** Marco decided 2026-09-01 that the page must report what actually exists,
because a number copied from a mock-up is a lie the page tells about itself. If your computed
numbers differ from the mock-up, the mock-up is the stale one - say so in the PR body, do not adjust
the code to match it.

### 3. The `All items` / `Grouped` toggle

`Grouped` already exists. Add the `All items` state and make it the default, matching the mock-up:
a flat list of every card the user can see. `Grouped` keeps the current
Personal / Company / Administration structure.

### 4. Show each card's route

Under the description, in a monospace style, show the item's `to` path (e.g. `/settings/account`).
For a locked card show `needs <permission>` instead, in the same monospace style, exactly as the
mock-up does.

### 5. Replace the GUESSED descriptions with the approved copy

Every description in `settings-nav-items.ts` carries a `// GUESS —` comment, and the file header
says they were *"inferred from reading the page code rather than from a written spec"*. **The
mock-up is that missing spec.** Replace each description with the approved wording below and delete
the corresponding `// GUESS —` comment. Leave the `tabs` arrays alone except where section 6 says
otherwise.

| item | approved description |
|---|---|
| Account | Your profile: name, contact details, email signature and the theme you see. Also where you view the permissions you hold and request ones you do not. |
| Notification preferences | Choose which alerts reach you, and whether each arrives in the app, by email, or both. |
| Calendar sync | Connect your work calendar so scheduled jobs and leave appear alongside your meetings. |
| Company | The business itself - legal details, addresses, the defaults used when pricing, how documents are numbered, branding, and the licences and insurances you must keep current. |
| AI settings | Which AI provider the assistants use, and the company-wide behaviour of the tendering and forms helpers. |
| Reference data & Lists | The numbers estimating runs on - rate tables, material densities, waste rates - plus the drop-down lists used across the system. |
| Admin settings | System-wide switches: notification triggers, outbound email, access requests awaiting approval, integration keys, and site geofences. |
| Users | Everyone with a login: invite, deactivate, and set which company and role each person belongs to. |
| Automations | Rules that react to changes - when something happens, notify someone or add a note. Currently limited: only notification events are wired in, so most rules will not fire yet. |
| Handover template | The template that defines what a job handover must capture before it can be signed off. |
| Data model | A live map of every entity in the system and how they relate. Regenerated automatically on each build. |
| Field definitions | Custom fields available on records, and which of them map to Xero. |
| Companies | Create and manage the companies hosted in this system, and assign people to them. |
| Roles & Permissions | Define what each role can see and do. Changing a role changes it for everyone who holds it. |
| Audit | A record of who changed what, and when. Read-only. |
| Platform | SharePoint connection and the folder structure the system creates for tenders and jobs. |
| Client versions | Which app version each device is running, and the minimum version you will support. |
| Map locations | Tips, depots, fuel stops and other places the system uses to work out travel and disposal costs. |
| Xero file exchange | Import and export the contact and invoice files that move between this system and Xero. |
| CRM drop reasons | Why an opportunity was dropped - the list your team picks from when they close one out. |

`CRM drop reasons` is not in the mock-up, because the mock-up predates it. **Keep the card, and use
the description above** - Marco approved that line on 2026-09-05, closing the one page the original
approved-copy table left on a guess. Silently dropping a real settings page from the index is the
failure this page exists to fix, so the card stays either way. That makes it **20 of 20** approved:
no `// GUESS -` comment may survive in `settings-nav-items.ts`, which the VERIFY block already
asserts.

### 6. Add the two settings that live outside /settings

Marco decided 2026-09-01: **link them in place, do not move them.** No new routes, no redirects,
no bookmark breakage.

| label | to | description | permission |
|---|---|---|---|
| Schedule of Rates | `/admin/schedule-of-rates` | Master schedules of rates and the per-client rate cards priced from them. | `rates.manage` |
| Job roles | `/workers/job-roles` | The roles people are booked as, and the qualifications each role requires before someone can be allocated. | `resources.view` |

**Those two permissions are measured, not invented - use them as given and do not re-derive them.**
The original instruction here was "read each route's guard in `App.tsx` and mirror it". That
instruction is unfollowable, and finding out why is the reason these values are now supplied:

**[MEASURED] 2026-09-05.** Neither route is wrapped in `RequirePermissions`. `App.tsx:613`
(`/admin/schedule-of-rates`) and `App.tsx:377` (`/workers/job-roles`) are bare `<Route>` elements,
unlike their neighbours at lines 528, 541, 549, 558 and 570. The guards exist - they are just not
on the route:

| page | where the guard actually lives | permission |
|---|---|---|
| Schedule of Rates | `ScheduleOfRatesAdminPage.tsx:319` computes `can(user, "rates.manage")`; `:514` returns `<NoAccess required="rates.manage" />` | `rates.manage` |
| Job roles | `JobRolesPage.tsx` has **no** check; the API does - `job-roles.controller.ts:26` requires `resources.view` to read, `:43/:53/:63` require `resources.manage` to write | `resources.view` |

So nothing is publicly exposed: a user without `resources.view` who opens Job roles gets a page
whose data request 403s. That is a UX defect, not a security one, and it is being fixed in its own
slice (`pr-jobroles-s1-noaccess-instead-of-a-dead-shell`) - **not here**. Do not add a permission
check to `JobRolesPage.tsx` in this slice; it is outside `scope`.

Marco ruled on 2026-09-05: the card carries the permission the user actually needs to get something
useful, which is the guard the page or its API enforces. **Do not invent a permission**, and do not
grant access the page would refuse - a card that opens into a 403 is worse than no card.

These two are not under `/settings`, so `SettingsNavItem` needs to express that. Add a boolean such
as `external` and use it only to decide styling/grouping - the link is a plain route link either way.

## The tab lists must stay TRUE to the code

🔴 **The mock-up shows tabs this app may not have.** It gives Account three tabs (Profile,
Permissions, Personal API keys) where `settings-nav-items.ts` declares `tabs: []`, and it gives
Reference data a fifth tab (Densities) where the code declares four.

**Do not add a tab unless you have opened the page component and confirmed the tab strip exists.**
A declared tab is searchable and deep-linkable; a tab that does not exist sends the user to nothing,
which is precisely the half-built behaviour being corrected. For each mock-up tab you cannot
confirm, leave it out and list it in the PR body under "tabs the mock-up shows that the app does not
have". That list is a finding for Marco, not a gap for you to fill.

## Prove it before you believe it

- Paste the computed counts line for a super user and for a permission-less user. They must differ,
  and the "need access" number must be non-zero for the second.
- Show a search for `GST` returning **Company profile** with the **Commercial defaults** chip
  highlighted, even though "GST" is not in the card title.
- Show a card with `tabs: []` rendering no chip row.
- Confirm both new cards resolve: `/admin/schedule-of-rates` and `/workers/job-roles` load for a
  user who holds their guard permission.

## Do NOT

- Do NOT modify `settings-search.ts`. Its matching is already correct.
- Do NOT hard-code 30, 47, 11, 21 or 10 anywhere.
- Do NOT move, redirect or re-path any settings page.
- Do NOT invent tabs or permissions.
- Do NOT touch `/sot/`, `apps/api/**`, `prisma/**`, or any file outside `scope`.
- Do NOT run `git checkout .`, `checkout -- <dir>`, `reset --hard`, `stash pop` or `git clean`.

## VERIFY

```
node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-settings-home-s1-cards-tabs-counts-ready.md
pnpm --filter web lint
pnpm --filter web test
pnpm --filter web build
grep -q "tabs" apps/web/src/pages/settings/SettingsHomePage.tsx
grep -q "All items" apps/web/src/pages/settings/SettingsHomePage.tsx
grep -q "need access" apps/web/src/pages/settings/SettingsHomePage.tsx
! grep -q "GUESS" apps/web/src/components/settings-nav-items.ts
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

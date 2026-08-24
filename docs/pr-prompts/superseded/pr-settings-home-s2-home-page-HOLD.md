---
premise: '! test -f apps/web/src/pages/settings/SettingsHomePage.tsx'
premise_means: /settings has no landing page - its index route redirects straight to the Account page, so there is nowhere that shows a user what settings exist or which ones they cannot open.
scope:
  - apps/web/src/pages/settings/SettingsHomePage.tsx
  - apps/web/src/pages/settings/LockedSettingCard.tsx
  - apps/web/src/App.tsx
  - apps/web/src/pages/settings/__tests__/SettingsHomePage.test.tsx
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/settings/SettingsHomePage.tsx && grep -q "SettingsHomePage" apps/web/src/App.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
cluster: settings-home
cluster_order: 2
requires_merged: 1228
---

# Settings Home SLICE 2 — the `SettingsHomePage`

Binding plan: **`docs/plans/settings-home-plan.md` §4 SLICE 2**. Decisions D43, D45, D46.

## HELD — do not arm this by hand

Slice 2 of the `settings-home` cluster. Its gate opens by itself once SLICE 1 puts
`partitionSettingsNavItems` on `main`. Arming it earlier builds a page against a function that does
not exist yet.

## Grounding — verified on origin/main

- `apps/web/src/pages/settings/SettingsHomePage.tsx` does **not** exist.
- The `/settings` index route is `<Route index element={<Navigate to="account" replace />} />`,
  currently at **`App.tsx:397`**. ⚠️ **Locate it by content, not by line number** — `App.tsx` moves
  constantly and there are four `<Route index …>` elements in the file. The one you want is inside
  the `/settings` route block. The other three (`:254` portal, `:311` field, `:651` crm) must not be
  touched.
- The precedent to mirror is `apps/web/src/pages/administration/AdministrationLandingPage.tsx` —
  it already reads a nav-items array and renders `Link` cards with a `NoAccess` fallback.
- The request-access endpoint exists: `POST request-access`,
  `apps/api/src/modules/access-requests/access-requests.controller.ts:19`.

## What to build

### 1. `SettingsHomePage.tsx`

Builds its card set from `SECTIONS` + `partitionSettingsNavItems` (SLICE 1). No second
hand-maintained list — if the page needs data the nav model does not carry, add it in the model, not
in the page.

- **Flat by default, with a Grouped toggle** (D43). Flat = all open cards in declaration order.
  Grouped = cards under "Personal", "Company", "Administration" headings.
- **Header: "N settings you can open"** where N = `open.length` (D46).
- **Locked items are SHOWN, not hidden** (D45) — greyed, lock icon, the permission code named, and a
  working **Request access** button posting to `request-access`.
- **Locked cards sit at the BOTTOM under a `Needs access — N` divider, in BOTH views** (D46). In
  grouped view they leave their section and join the bottom partition.
- **Mirror `AdministrationLandingPage`'s card grid and design tokens** (`var(--border)`,
  `var(--surface)`, `var(--text-primary)`, `var(--text-muted)`, `s7-type-page-heading`). Do not
  invent a second card pattern.

`LockedSettingCard.tsx` is in scope only if the locked-card markup is non-trivial. If it is small,
keep it inline and leave that file uncreated — an unnecessary file is not a free choice.

### 2. Repoint the `/settings` index route

Replace the `Navigate to="account"` index route **inside the `/settings` block** with
`<Route index element={<SettingsHomePage />} />`.

### 3. Tests

- Header count matches a mocked user's open-item count.
- Locked cards render the lock, the permission code, and the Request access button.
- The Grouped toggle changes the layout.
- Flat view puts locked items at the bottom regardless of their section.

## ⚠️ REQUIRED in the PR body — this is a visible change for real staff

For an ordinary staff member, roughly **17 of the 20 settings cards will now appear greyed with lock
icons** on a page that previously did not exist. That is deliberate under D45/D46 — users should be
able to see what exists and ask for it. **Say this explicitly in the PR body**, with the number you
measured, so nobody is surprised by it after deploy.

It changes only what `/settings` lands on. It grants nothing and takes nothing away.

## Do NOT

- Do NOT add search — that is SLICE 3.
- Do NOT modify `filterSettingsNavItems`, `AdministrationLandingPage.tsx`, or `SettingsShell`'s
  sub-nav rendering.
- Do NOT touch the other three `<Route index>` elements in `App.tsx`.
- Do NOT change any permission gate. Locked stays locked; this only makes it visible.
- Do NOT touch `/sot/` or anything outside the files in `scope`.

## Guardrails

- One attempt. If you cannot complete it, say `NO-OP: <reason>` and stop.
- Never exit silently. Never ask a question or stand by for approval.
- Read the job log before diagnosing any CI failure — never guess from the check name.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## The completion test

Is there a PR number in your output? If no because the work was already on `main`, say
`NO-OP: <reason>`. If no because you are waiting for someone — there is nobody. Open the PR.

---
premise: 'grep -lqE "window\.(confirm|alert)" apps/web/src/pages/admin/AutomationsPage.tsx apps/web/src/pages/admin/MapLocationsTab.tsx apps/web/src/pages/contracts/BillingTab.tsx'
premise_means: Three straggler surfaces (Automations, Map Locations, contracts Billing) still call native window.confirm / window.alert.
scope:
  - apps/web/src/pages/admin/AutomationsPage.tsx
  - apps/web/src/pages/admin/MapLocationsTab.tsx
  - apps/web/src/pages/contracts/BillingTab.tsx
done_when: pnpm build && pnpm lint && test -z "$(grep -lE 'window\.(confirm|alert)' apps/web/src/pages/admin/AutomationsPage.tsx apps/web/src/pages/admin/MapLocationsTab.tsx apps/web/src/pages/contracts/BillingTab.tsx)"
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# Migrate native dialogs -> useConfirm (straggler surfaces: Automations, Map Locations, Billing)

The `useConfirm()` foundation (`apps/web/src/hooks/useConfirm.tsx` + `components/ConfirmDialog.tsx`,
provider mounted in `ShellLayout.tsx`) already shipped, and PRs #807-812 migrated every other
surface. These THREE files were added/changed afterwards and still call native `window.confirm` /
`window.alert`. Same mechanical swap as those batches — preserve exact behaviour and messages.

## What to build

Replace `window.confirm` and `window.alert` in these 3 files with the shared hook, following the
exact pattern already on `main` in `apps/web/src/pages/admin/AdminUsersTab.tsx`
(`const confirm = useConfirm();` then `if (await confirm({ title, message, variant: 'danger' })) {...}`;
for alerts use the hook's `alert({ title, message })`):

- `admin/AutomationsPage.tsx` — the delete-rule `window.confirm` (danger variant) + the two
  `window.alert` calls (invalid-JSON message; test-fire-failed message).
- `admin/MapLocationsTab.tsx` — the deactivate `window.confirm` (danger variant).
- `contracts/BillingTab.tsx` — the delete-milestone `window.confirm` (danger variant).

Make the enclosing handlers `async` where a `confirm`/`alert` call now needs `await` (most already
are, since they call `fetch`). Keep every dialog's title/message wording exactly as the native call
phrased it.

## Do NOT

- **Do NOT touch the two `window.prompt()` calls** — `AutomationsPage` test-payload JSON input and
  `BillingTab` preview-month input. `useConfirm` has no text-input primitive; converting them is a
  separate follow-up. Leave them exactly as they are. (This is why the premise/`done_when` match
  only `window.(confirm|alert)`, not `prompt`.)
- Do NOT touch any file outside the three listed.
- Do NOT change dialog wording, the actions guarded, or unrelated logic.
- Do NOT restructure `AutomationsPage` — a separate settings-restructure slice plan owns its IA.
  Swap only its dialog calls; change nothing else in the file.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails
- One attempt. Never exit silently -- say `NO-OP: <reason>` if already migrated.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` must pass.

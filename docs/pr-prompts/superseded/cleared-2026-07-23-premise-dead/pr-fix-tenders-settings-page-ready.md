---
premise: grep -q "Save labels</button>" apps/web/src/pages/TenderingSettingsPage.tsx
premise_means: The Tendering Settings page still uses raw native form controls instead of the design-system components.
scope:
  - apps/web/src/pages/TenderingSettingsPage.tsx
  - apps/web/src/**
done_when: pnpm build && pnpm lint && ! grep -q "Save labels</button>" apps/web/src/pages/TenderingSettingsPage.tsx
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# Fix /tenders/settings visual consistency (design-system form controls)

`TenderingSettingsPage` (`/tenders/settings`, the "Tender Settings" label-rename surface) already
uses `AppCard` and the existing utility classes, but it renders raw native `<button>`, `<input>` and
`<label>` controls, so the form looks inconsistent with the rest of the app (the "broken page" report).

Replace the raw controls with the design-system form components used elsewhere (the same Button /
input field components other settings/admin forms use), keep the `s7-` typography/token classes for
headings, and confirm spacing/layout matches a compliant page (e.g. RatesListsAdminPage). Behaviour is
unchanged — this is a visual-consistency pass only.

## Do NOT
- Do NOT change what the page does (label rename via localStorage) or its data keys.
- Do NOT touch the FIELD (mobile) nav.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
Finishing the work and then asking for permission is indistinguishable from failing.

## Guardrails
One attempt. Never exit silently (`NO-OP: <reason>`). Never ask or stand by. `pnpm build` +
`pnpm lint` must pass. Read the CI job log before diagnosing any failure.

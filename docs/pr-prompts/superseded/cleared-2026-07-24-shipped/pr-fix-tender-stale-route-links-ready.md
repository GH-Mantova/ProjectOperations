---
premise: grep -rEq "/tenders/(create|pipeline)" apps/web/src/pages/TenderContactsPage.tsx apps/web/src/pages/TenderClientsPage.tsx
premise_means: The Tender Contacts/Clients pages still link to the retired /tenders/create and /tenders/pipeline routes (which now only redirect to /tenders).
scope:
  - apps/web/src/pages/TenderContactsPage.tsx
  - apps/web/src/pages/TenderClientsPage.tsx
done_when: pnpm build && pnpm lint
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# Repoint retired tender-route links to /tenders (audit B1–B4)

## What to do
In BOTH `apps/web/src/pages/TenderContactsPage.tsx` and
`apps/web/src/pages/TenderClientsPage.tsx`, the quick-action / empty-state link arrays point at
**`/tenders/create`** and **`/tenders/pipeline`**. Both of those routes are now redirect-only
(`App.tsx` renders `<Navigate to="/tenders">` for them), so the links bounce through a redirect.
Repoint every `/tenders/create` and `/tenders/pipeline` target in these two files directly to
**`/tenders`**. (Around TenderContactsPage.tsx:13–14 and TenderClientsPage.tsx:13–14, but grep each
file for both strings and fix all occurrences.)

## Do NOT
- Do NOT change any other file, route, or the redirect definitions in `App.tsx`.
- Do NOT touch backend/API paths.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does not mean wait for approval
before starting, and it does not mean do the work then ask permission to push. There is no human in
this run. Finishing the work and then asking for permission is indistinguishable from failing.

## Guardrails
- One honest attempt. Never exit silently — if you open no PR, say `NO-OP: <reason>` loudly.
- Never ask a question or stand by for approval.
- Read the job log before diagnosing any CI failure.
- Completion test: is there a PR number in your output? If the work was already on main, say
  `NO-OP: already done`.

---
premise: '! grep -q "openTransportByDefault" apps/web/src/pages/tendering/ScopeWasteTab.tsx'
premise_means: New waste rows in the Waste tab do not show the transport sub-row by default — the user must expand each new row to reach "pick a truck / transport". Marco wants it visible on creation, collapsible with the existing control.
scope:
  - apps/web/src/pages/tendering/ScopeWasteTab.tsx
done_when: pnpm build && pnpm lint && grep -q "openTransportByDefault" apps/web/src/pages/tendering/ScopeWasteTab.tsx
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# Waste rows: show the transport sub-row by default on a new row (collapsible)

## Context (verified on origin/main)
The waste-transport sub-row ("Transport item — pick a truck / transport", "Loads / truck / day",
"Engine idle — pick a transport item …") lives in `apps/web/src/pages/tendering/ScopeWasteTab.tsx`
(~line 754+). Today a freshly-created waste disposal row renders collapsed; the user must expand it to
reach the transport picker. Marco wants the transport sub-row **shown by default when a new waste row
is created**, with the existing "−" control to hide it.

## What to build
When a new waste row is created in `ScopeWasteTab.tsx`, initialise it so the transport sub-row is
expanded/visible by default. Reuse the existing per-row expand/collapse state and the existing "−"/"+"
toggle to hide/show it — do not add a second control. Name the mechanism clearly (e.g. an
`openTransportByDefault` flag or seeding the new row's id into the expanded set on create) so the
behaviour is greppable. Existing rows loaded from the server keep their current default (do not
force-expand every historical row).

## Do NOT
- Do NOT change the transport cost engine, the waste rate maths, or the API.
- Do NOT add a new toggle button — reuse the existing collapse control.
- Do NOT auto-expand pre-existing/loaded rows; this is about NEWLY created rows only.

## VERIFY
- `pnpm build && pnpm lint`
- `grep -q "openTransportByDefault" apps/web/src/pages/tendering/ScopeWasteTab.tsx`

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if already on main. Never ask a question or
"stand by" for approval. Read the CI job log before diagnosing any failure.

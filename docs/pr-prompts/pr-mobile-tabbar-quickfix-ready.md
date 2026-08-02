---
premise: grep -q "group.items.slice(0, 1)" apps/web/src/components/ShellLayout.tsx
premise_means: The mobile tab bar still takes the first item per group blindly — no Home tab, sub-group parents can render an unroutable path, gated targets dead-end.
scope:
  - apps/web/src/components/ShellLayout.tsx
  - apps/web/src/components/__tests__/ShellLayout.nav.test.ts
done_when: pnpm build && pnpm lint && ! grep -q "group.items.slice(0, 1)" apps/web/src/components/ShellLayout.tsx
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# Mobile tab bar quick fix (Marco 2026-08-03: quick fix now, real design later)

Audit findings on `ShellLayout.tsx` shell__tab-bar (~line 657):
- No Home tab — the Dashboards group renders outside NAV_GROUPS, so mobile users cannot
  reach `/` from the bar.
- `group.items.slice(0, 1)` picks whatever survives permission filtering: a collapsible
  sub-group parent (`to: "operations/assets-equipment"` — a RELATIVE non-route) can become
  the tab target -> unroutable URL.
- Tabs are labelled with the group name but link to one item; a permission-filtered group
  can produce a tab its user 403s on.

## What to build (quick fix ONLY — the designed mobile nav is a future brief)

1. Prepend a fixed Home tab (`to: "/"`, dashboard icon).
2. Per group, pick the first item that (a) is a real route (skip sub-group parents /
   relative paths), (b) passes the user's permission filter. If a group has no qualifying
   item, render no tab for it.
3. Keep labels as-is (group names) — labelling redesign belongs to the future design brief.
4. Nav test: add assertions for the Home tab and the no-relative-path rule; run locally.

## Do NOT
- Do NOT redesign the bar, add overflow menus, or touch FieldLayout.
- Do NOT change NAV_GROUPS content.

## VERIFY
- `pnpm build && pnpm lint`; nav test green locally (output in PR body).

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.

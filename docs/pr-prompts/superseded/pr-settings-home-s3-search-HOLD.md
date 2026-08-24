---
premise: '! grep -rq "settings-search" apps/web/src/pages/settings'
premise_means: The Settings Home screen has no search, so finding a setting still means knowing which of the 20 pages - or which of its tabs - it lives on.
scope:
  - apps/web/src/pages/settings/settings-search.ts
  - apps/web/src/pages/settings/SettingsHomePage.tsx
  - apps/web/src/pages/settings/__tests__/settings-search.test.ts
  - apps/web/src/pages/settings/__tests__/SettingsHomePage.test.tsx
done_when: pnpm build && pnpm lint && grep -rq "settings-search" apps/web/src/pages/settings
size: 4
gate_allow: none
seed_only: false
escalates: false
cluster: settings-home
cluster_order: 3
requires_on_main: apps/web/src/pages/settings/SettingsHomePage.tsx
---

# Settings Home SLICE 3 — search

Binding plan: **`docs/plans/settings-home-plan.md` §4 SLICE 3**. Decisions D44, D45, D46.

## HELD — do not arm this by hand

Slice 3 of the `settings-home` cluster. Its gate opens once SLICE 2 puts `SettingsHomePage.tsx` on
`main`. It edits that file, so arming it early has nothing to edit.

## What to build

### 1. The search itself

Put the matching logic in a **pure, separately testable module** —
`apps/web/src/pages/settings/settings-search.ts` — not inline in the component. The plan calls
search "load-bearing" (D44); a pure function is what makes it testable without rendering.

It searches, for every item in the full set (**open and locked, all three sections**):

- `item.label`
- `item.description`
- every `tab.label` and `tab.description`

Case-insensitive substring matching is sufficient. **Do not add fuzzy matching, ranking heuristics,
or a search library** — none is specified and each would need its own design decision.

### 2. Behaviour

- Results include **locked** items, still greyed with the lock and a working Request access button.
  D45/D46 apply inside search exactly as they do on the main view.
- An **empty query renders the full Home view** — search is additive, not a mode you get stuck in.
- Results respect the **current flat/grouped toggle**: the user's chosen layout survives typing.

### 3. Tab deep-linking

A tab hit links to `<parentRoute>?tab=<tab.id>`.

Query parameter, **not** a hash — decided in the plan: React Router's `useSearchParams` reads and
forwards it cleanly, the tab ids are already stable strings from SLICE 1, and a hash would force
every target page to read `window.location.hash` on mount.

⚠️ **SLICE 3 does not modify any tab-bearing page.** It emits correct links. Making each page read
`?tab` and open the right tab is deferred, per the plan. **Say this plainly in the PR body** — a
reviewer clicking a tab result will land on the page with the default tab selected, and that is
expected at this slice, not a bug.

### 4. Tests

- Typing a label surfaces the matching card.
- Typing a **tab name** surfaces the parent card with an href containing `?tab=`.
- Typing a description fragment surfaces the matching card.
- Locked items appear in results, greyed, with Request access.
- Empty query renders the full home view.
- A query matching nothing renders an empty state, not a blank page.

## Do NOT

- Do NOT modify any tab-bearing settings page to consume `?tab`. Out of scope by design.
- Do NOT change the nav model, `partitionSettingsNavItems`, or any permission gate.
- Do NOT add a search dependency. Plain string matching over data already in the model.
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

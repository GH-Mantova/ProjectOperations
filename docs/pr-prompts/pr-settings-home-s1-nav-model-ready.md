---
premise: '! grep -q "partitionSettingsNavItems" apps/web/src/components/SettingsShell.tsx'
premise_means: The settings nav model carries no per-item description and no tab list, and there is no partition function that returns locked items alongside open ones - so neither the Settings Home screen nor its search can be built from it.
scope:
  - apps/web/src/components/SettingsShell.tsx
  - apps/web/src/components/__tests__/settings-nav-model.test.ts
  - apps/web/src/components/__tests__/settings-nav-coverage.test.ts
done_when: pnpm build && pnpm lint && grep -q "partitionSettingsNavItems" apps/web/src/components/SettingsShell.tsx && grep -q "description" apps/web/src/components/SettingsShell.tsx
size: 4
gate_allow: none
seed_only: false
escalates: false
cluster: settings-home
cluster_order: 1
---

# Settings Home SLICE 1 — extend the nav model (data + pure functions, NO UI)

Binding plan: **`docs/plans/settings-home-plan.md` §4 SLICE 1** (on `main`, merged as #1167).
Read it before starting. Decisions D43–D47 are recorded there and in the PR body of #1149.

**No component renders anything new in this slice.** No UI, no route changes, no new pages.

## Grounding — verified on origin/main, do not re-derive

`apps/web/src/components/SettingsShell.tsx` today:

- `export type SettingsNavItem` (**line 15**) carries `to`, `label`, `requiresPermission?`,
  `requiresAnyPermission?`, `superUserOnly?`. **No `description`. No `tabs`.**
- `export const ADMINISTRATION_ITEMS` (**line 41**) — 10 items.
- `export function filterSettingsNavItems` (**line 74**) — filters locked items OUT.
- `const SECTIONS` (**line 86**) — `personal` (3 items), `company` (7 items),
  `administration` (= `ADMINISTRATION_ITEMS`, 10 items).

**Item count today = 20** (3 + 7 + 10). All three Personal items are ungated, so a user with no
permissions at all sees **3 open / 17 locked**.

⚠️ **Verify that count yourself before writing the test assertions.** The composition has already
drifted once since the plan was written — "Schedule of Rates" has left the Company section and
"Job roles" has been replaced by "CRM drop reasons". If the arrays have changed again, use the real
numbers and **say so in the PR body**. Do not copy 20/17/3 from this prompt if the code disagrees.

## What to build

### 1. Extend the type

Add to `SettingsNavItem`:

- `description: string` — **required**, so the TypeScript compiler flags any item missing one.
- `tabs?: { id: string; label: string; description: string }[]`

### 2. Populate `description` and `tabs` for every item

Every item in all three sections gets a plain-English `description` — what the page is for, in the
words a user would use, not the words the code uses. Every page that has tabs gets its `tabs` array,
with each tab's `id` matching the identifier that page already uses internally (SLICE 3 will
deep-link on it, so the ids must be real, not invented).

**D47 — flag your guesses.** Where you are inferring a page's purpose from its code rather than from
a written spec, mark that description with a `// GUESS —` comment on the line above. Marco does one
review pass over the guesses in this PR. **Do not silently invent confident copy for a page you had
to reverse-engineer** — an unmarked wrong description is worse than a marked uncertain one.

No description may be empty or a placeholder. The coverage test below enforces this.

If the populated arrays make `SettingsShell.tsx` unwieldy, extracting them to
`apps/web/src/components/settings-nav-items.ts` and re-exporting is acceptable and within scope —
but keep the existing export names working so no other file needs to change.

### 3. Add `partitionSettingsNavItems`

```ts
export function partitionSettingsNavItems(
  items: SettingsNavItem[],
  user: SafeUser | null
): { open: SettingsNavItem[]; locked: SettingsNavItem[] }
```

- `open` — items the user can access. Must apply **exactly** the same three rules
  `filterSettingsNavItems` applies (`superUserOnly`, `requiresPermission`, `requiresAnyPermission`).
- `locked` — everything else. Order within each array follows declaration order.
- **Do NOT modify `filterSettingsNavItems`,** and do NOT change `AdministrationLandingPage.tsx`.
  That page depends on the current hide-locked behaviour; changing it silently changes that screen.
  The whole reason this is a NEW function is to leave the old one alone.

### 4. Unit tests for `partitionSettingsNavItems`

- A super-user sees **no** locked items.
- A user with no permissions sees the Personal items open and everything else locked
  (3 / 17 today — verify).
- A user with `users.view` finds the Users item in `open`.
- An item with `requiresAnyPermission` lands in `open` when the user holds **any** listed code.
- `open` and `locked` together always contain every input item exactly once, and never overlap.

### 5. The coverage test — non-negotiable

A test that walks every item in every section and asserts:

- `description` is present and non-empty.
- `tabs` is present. **A page with genuinely no tabs must be named in an explicit
  expected-no-tabs list inside the test** — the test must not accept a blanket empty array, or it
  stops catching anything.

This is the test that fails the day someone adds a settings page and forgets a description. It is
the point of the slice, not a nicety. (It is the QA lens's OBJECT from run 3, folded in.)

## Do NOT

- Do NOT create `SettingsHomePage`, touch `App.tsx`, or change any route. That is SLICE 2.
- Do NOT add search. That is SLICE 3.
- Do NOT modify `filterSettingsNavItems` or `AdministrationLandingPage.tsx`.
- Do NOT change permission codes, gates, or which items are gated. This slice adds descriptive
  metadata and a pure function; it changes nobody's access to anything.
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

## For the PR body

List every `// GUESS —` description you marked, so Marco can review them in one pass without
reading the whole diff. State the item/locked counts you measured.

## The completion test

Is there a PR number in your output? If no because the work was already on `main`, say
`NO-OP: <reason>`. If no because you are waiting for someone — there is nobody. Open the PR.

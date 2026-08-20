---
premise: 'grep -q ">CRM</h1>" apps/web/src/pages/crm/CrmBoardPage.tsx'
premise_means: The Leads & opportunities page still renders a literal H1 reading "CRM", which contradicts its own nav label and breadcrumb.
scope:
  - apps/web/src/pages/crm/CrmBoardPage.tsx
  - apps/web/src/pages/crm/__tests__/CrmBoardPage.title.test.tsx
done_when: pnpm build && pnpm lint && bash -c '! grep -q ">CRM</h1>" apps/web/src/pages/crm/CrmBoardPage.tsx'
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# The Leads & opportunities page calls itself "CRM"

Marco reported this directly on 2026-08-20: the heading is misleading.

## The defect

`apps/web/src/pages/crm/CrmBoardPage.tsx:204`:

```tsx
<h1 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 24, margin: 0 }}>CRM</h1>
```

That component is mounted as `CrmBoardContent` at route `/tenders/leads` (`apps/web/src/App.tsx:344`).
Both the sidebar item (`ShellLayout.tsx:176-182`) and the breadcrumb map (`ShellLayout.tsx:483`) label
that route **"Leads & opportunities"**. So the user navigates to something called Leads &
opportunities, the breadcrumb says Leads & opportunities, and the page announces itself as CRM.

**The house rule already exists and this page is the one that escaped it.** PR #777 established
"sidebar label is canonical; each page's visible H1 matches it" and shipped it for five pages
(`sot/02-roadmap-and-status.md:47`). `CrmBoardPage` was not in that prompt's scope. A second pass at
the same class, PR #1024, was **closed without merging** (orphan branch, no common ancestor) and its
diff did not touch this file either.

Separately, `docs/plans/crm-leads-collapse-plan.md` §1.5 recorded the *identical* complaint —
*"'CRM' is a system-architecture term, not a label users recognise"* — but scoped the fix to the
**tab label**, which shipped as PR #1099. The H1 inside the component was never in anyone's scope.
Three attempts circled this string and none of them touched it.

## What to build

1. **Change the H1 to `Leads &amp; opportunities`** — matching `ShellLayout.tsx:483` exactly,
   including the ampersand. Read the label from the breadcrumb/nav source if a shared export exists;
   if it does not, hard-code it and do **not** invent a new constants module for one string.

2. **Use the established page-title class, not an inline style.** `TendersRegisterPage.tsx:98` is the
   model on this route family:
   ```tsx
   <h1 className="s7-type-page-title">Tenders register</h1>
   ```
   Drop the inline `fontFamily` / `fontSize` object. Keep `margin: 0` only if removing it visibly
   breaks the flex row at `CrmBoardPage.tsx:203` — check, do not assume.

3. **Add a regression test** `apps/web/src/pages/crm/__tests__/CrmBoardPage.title.test.tsx`:
   renders the page and asserts the heading text is `Leads & opportunities` **and** that no element
   with the text `CRM` is rendered as a heading. This string has survived three passes; leave
   something behind that fails if it comes back.

## Do NOT

- Do NOT rename the route, the nav item, the breadcrumb entry, or the component/file name. The nav
  label is canonical and already correct — the page is what is wrong.
- Do NOT touch the "+ Add new" button, the forecast strip, or `LeadsTriageList`.
- Do NOT rename the `crm` directory or the `/crm/*` routes. "CRM" is correct as a *module* name;
  it is only wrong as this *page's* title.
- Do NOT sweep other pages for title mismatches. If you spot one, name it in the PR body and leave
  it — a one-file fix that stays one file is the point.

## Guardrails

- One attempt. If the H1 already reads "Leads & opportunities", say `NO-OP: <reason>`.
- `pnpm build` and `pnpm lint` must pass.

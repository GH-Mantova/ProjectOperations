---
premise: '! grep -q RequirePermissions.*crm.view apps/web/src/App.tsx'
premise_means: The /crm/* web routes are declared as bare Route elements with no permission wrapper, so a user without crm.view gets a broken page instead of NoAccess.
scope:
  - apps/web/src/App.tsx
done_when: pnpm lint && pnpm build && grep -q RequirePermissions.*crm.view apps/web/src/App.tsx
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# The /crm web routes render for users the API will refuse

## The defect, measured — and what it is NOT

**This is not a security hole.** `crm.view` already exists in the registry
(`apps/api/src/common/permissions/permission-registry.ts:113`) and every CRM read controller enforces
it — `accounts.controller.ts:81,93,101,111`, plus the comms, pipeline, relationships and lead-intake
controllers. The API is gated.

What is missing is the **client-side route guard**. `App.tsx:657-681` declares `/crm`,
`/crm/opportunities/:id`, `/crm/accounts`, `/crm/accounts/:id`, `/crm/register`, `/crm/pipeline`,
`/crm/comms`, `/crm/relationships`, the `/crm/*` catch-all and the `/clients` alias as bare
`<Route>` elements. The only client-side gate is nav-item visibility
(`ShellLayout.tsx:201,246,255,263`), which a pasted URL walks straight past. (The premise deliberately greps for RequirePermissions and crm.view on the SAME line: the bare string crm.view already appears at App.tsx:565 inside a comment explaining why the drop-reason screen chose crm.manage instead, and a premise matching that comment would bin this work as already done.) The result is a blank or
error-strewn page instead of the `NoAccess` component the app already has for exactly this.

So the severity here is **bad failure mode**, not exposure. Fix it as such.

## What to build

Wrap the `/crm` route block in the existing guard, exactly as `App.tsx:570` already does for the
drop-reason admin page:

```tsx
<RequirePermissions perms={["crm.view"]}>
  …the /crm routes…
</RequirePermissions>
```

`RequirePermissions` is exported from `apps/web/src/components/SettingsShell.tsx:185` and is already
imported in `App.tsx` at line 91. It has OR semantics over `perms` and a super-user bypass via
`can()`. Render `NoAccess` is its own built-in behaviour — you do not need to add it.

Include the `/clients` alias route in the guard, since it redirects into `/crm/accounts`.
**Leave `/tenders/leads` alone** — it is a tendering route with its own audience, and changing its
gate is a separate decision.

**No new permission code is created.** `crm.view` already exists; use it.

## Do NOT

- Do NOT invent a new permission string, and do NOT edit `permission-registry.ts`.
- Do NOT add or change any API guard. The controllers are already correct.
- Do NOT touch `ShellLayout.tsx` or the nav visibility rules.
- Do NOT change `administration/crm-drop-reasons`, which is correctly gated on `crm.manage`.
- Do NOT wrap `/tenders/leads`.

## Guardrails

- One attempt. If the `/crm` block is already wrapped, say `NO-OP: <reason>`.
- `pnpm lint` and `pnpm build` must pass.
- Never exit silently. Never ask a question or stand by for approval — there is no human in this run.
- Read the job log before diagnosing any CI failure.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.


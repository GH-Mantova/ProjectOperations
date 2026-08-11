---
premise: "! test -f apps/web/src/pages/forms/FillAssistPanel.tsx"
premise_means: There is no fill-time AI assist panel (suggest-never-decide) on the form fill page yet.
scope:
  - apps/web/src/pages/forms/FillAssistPanel.tsx
  - apps/api/src/modules/forms/ai-form-fill-assist.service.ts
  - apps/api/src/modules/forms/forms-engine.controller.ts
  - apps/api/src/modules/personas/definitions/forms.persona.ts
  - apps/web/src/pages/forms/FormFillPage.tsx
  - apps/api/src/modules/forms/forms.module.ts
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/forms/FillAssistPanel.tsx && grep -q "AiFormFillAssistService" apps/api/src/modules/forms/ai-form-fill-assist.service.ts
size: 6
gate_allow: none
seed_only: false
escalates: false
---

# Fill-time AI assist — suggest-never-decide

AI order 3 of 4 (LOCKED, `sot/06-active-specs.md` section 6): fill-time assist offering
hazard → control suggestions and notifiable-incident flagging while the filler works through
`apps/web/src/pages/forms/FormFillPage.tsx`. **Suggest-never-decide** is LOCKED: the AI proposes,
the supervisor confirms, the suggestion is *visibly labelled* as AI in the UI, and nothing the AI
says can trigger a BLOCK or a push by itself — those remain exclusively the rules engine's job
(`rules-engine.service.ts`, extended by the system-values slice already on main by the time this
runs). This rides the same forms persona (`forms.persona.ts`) and provider infrastructure the
import/describe slices already wired up.

## What to build

1. **`apps/api/src/modules/forms/ai-form-fill-assist.service.ts`** (new) —
   `AiFormFillAssistService`, given the current submission's in-progress answers (hazard/incident
   related fields), calls the AI (via the `"forms"` persona scope) for control suggestions and a
   notifiable-incident flag; returns a plain suggestion payload — it must never write to the
   submission, never toggle a rule action, and never call the push executor.
2. **`forms-engine.controller.ts`** — add a `fill-assist`-style endpoint (POST, scoped to the
   in-progress submission/template) that calls the new service and returns suggestions.
3. **`forms.persona.ts`** — add a `fill-assist` sub-mode.
4. **`FillAssistPanel.tsx`** (new) — a labelled "AI suggestion" side panel/affordance on the fill
   page: shows suggested controls / the notifiable-incident flag, with explicit accept/dismiss
   controls the filler/supervisor drives; nothing auto-applies.
5. **`FormFillPage.tsx`** — mount `FillAssistPanel` for hazard/incident-bearing forms (gate on a
   field-type or category signal already available on the template/section, do not invent a new
   schema flag).
6. **`forms.module.ts`** — register the new service.

## Do NOT

- Do not let AI output trigger a BLOCK, WARN, push action, or approval-chain change — those stay
  exclusively rules-engine-driven and human-reviewed.
- Do not persist AI suggestions as submission values automatically.
- Do not touch `apps/api/prisma/schema.prisma` — this slice is schema-free.
- Do not touch Azure/Entra/SharePoint, the push engine, or output channels.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if genuinely nothing to do, say `NO-OP: <reason>` and stop.
- Never ask for or wait on approval.
- If CI fails, read the actual job log before diagnosing — do not guess.
- `pnpm build` and `pnpm lint` must both pass before opening the PR.

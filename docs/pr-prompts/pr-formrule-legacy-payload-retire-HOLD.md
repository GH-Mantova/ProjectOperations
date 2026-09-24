---
premise: 'grep -q "sourceFieldKey" apps/web/src/pages/forms/FormDesignerPage.tsx'
premise_means: The web app still sends and reads the retired flat FormRule shape, so the moment the API stops accepting it three screens start returning 400 - the rules builder save, the designer publish, and template creation.
scope:
  - apps/web/src/pages/FormsPage.tsx
  - apps/web/src/pages/forms/FormDesignerPage.tsx
  - apps/web/src/pages/forms/FormRulesBuilderPage.tsx
  - apps/web/src/pages/forms/formDesignerState.ts
  - apps/web/src/pages/forms/__tests__/formDesignerState.test.ts
  - docs/pr-prompts/superseded/pr-formrule-legacy-payload-retire-HOLD.md
done_when: pnpm build && pnpm lint && grep -q "FORMRULE_LEGACY_PAYLOAD_RETIRED_V1" apps/web/src/pages/forms/FormRulesBuilderPage.tsx && ! grep -q "sourceFieldKey" apps/web/src/pages/forms/FormDesignerPage.tsx && ! grep -q "sourceFieldKey" apps/web/src/pages/FormsPage.tsx && ! grep -q "sourceFieldKey" apps/web/src/pages/forms/formDesignerState.ts
size: 6
gate_allow: none
seed_only: false
escalates: false
module: forms
fixes_pr: 2158
---

# Stop the web sending the retired FormRule payload

**This slice unblocks PR #2158 and must merge BEFORE it.** #2158 removes `rules` from
`UpsertFormTemplateDto` on the API. The web app still sends that field from three places. The
global `ValidationPipe` runs with `forbidNonWhitelisted` (`apps/api/src/bootstrap/create-app.ts:22-26`),
so an undeclared property is a **400**, not a quietly ignored field.

`.github/workflows/deploy.yml` fires on every push to `main` and, in one job, runs the production
migrations, deploys the API, then deploys the web bundle **from that same commit**. So there is no
quiet window: if #2158 merges first, that merge deploys an API that rejects what the web it ships
alongside is still sending.

**This change is safe on its own, in this order, because `rules` is OPTIONAL on today's DTO.**
A payload that stops sending it is accepted by the API exactly as it stands on `main` right now.
Nothing breaks between this merge and #2158's.

## Ground truth - re-verify before you edit

Measured on `origin/main` at `0f13c399`:

- **Nothing evaluates legacy FormRule rows.** The only code that touches them is
  `formRule.createMany` (`apps/api/src/modules/forms/forms.service.ts:778`, a write) and
  `rules: true` in the include (`:30`, read for display). The engine that actually enforces rules
  reads per-field `conditions` / `actions` JSON - `forms-engine.service.ts:546` - and so do
  `FormFillPage` and `PublicFormFillPage`. A legacy rule is stored, echoed back on screen, and
  never enforced on a submission.
- **There is no legacy rule EDITOR anywhere.** `FormDesignerPage` only carries rules through a
  republish and links out to the real builder at `/forms/designer/:templateId/rules`
  (`FormDesignerPage.tsx:376-377`). The only way to create one from the UI is `FormsPage`'s
  create-template form, which hardcodes a rule into every template it makes.
- **No intent is lost.** Migration `20260804_fv2_formrule_expand` already copied every row's five
  columns into the `definition` JSON tree, idempotently, and #2158 keeps `definition`.

## What to build

1. **`apps/web/src/pages/forms/FormRulesBuilderPage.tsx`** - this is the REAL rules screen (660
   lines, writes per-field `actions`). Two changes only:
   - delete the vestigial `rules: []` from the publish payload (`:336`);
   - add `export const FORMRULE_LEGACY_PAYLOAD_RETIRED_V1 = "formrule-legacy-payload-retire";`
     near the top as the slice sentinel.
   Everything else on this page stays exactly as it is.

2. **`apps/web/src/pages/forms/FormDesignerPage.tsx`** - remove the pass-through, not the page:
   - the `rules` member of the local template type (`:67-73`);
   - `rules: []` in the initial draft (`:121`);
   - the load mapping `rules: latest.rules.map(...)` (`:160-167`);
   - the `rules:` block in the publish payload (`:298-304`).
   **Keep** the link to the rules builder at `:376-377` - that is the live path.

3. **`apps/web/src/pages/FormsPage.tsx`**:
   - remove `rules` from the `TemplateVersion` type (`:25`);
   - remove the `rules: [...]` literal from `emptyTemplateForm` (`:84-92`) - this is the hardcoded
     `fit_for_work -> hazard_notes` rule that has never fired;
   - remove the read-only **Rules** subsection (`~:271-281`), including its
     "No rules configured." empty state. It can only ever render blank after #2158, and a
     compliance screen that lists rules which do not enforce is worse than one that lists none.

4. **`apps/web/src/pages/forms/formDesignerState.ts`**:
   - remove the `DraftRule` type (`:138-145`);
   - remove `rules: DraftRule[]` from `DesignerDraft` (`:153`);
   - in the field-delete reducer (`:469-471`), drop the `rules` key from the returned draft
     entirely - do not leave `rules: []` behind.

5. **`apps/web/src/pages/forms/__tests__/formDesignerState.test.ts`** - update, do not delete:
   - `rules: []` in the draft fixture (`:54`);
   - the `rules: [...]` fixture with `sourceFieldKey: "machine"` (`:329-336`);
   - `expect(next.rules).toEqual([])` (`:342`) and `expect(next.rules).toBe(draft.rules)` (`:375`).
   Those two assertions exist to prove the field-delete reducer prunes rules referencing a deleted
   field, and preserves the array identity otherwise. With `rules` gone there is nothing to prune -
   delete the two assertions and any fixture data that exists only to feed them. **Keep every other
   assertion in the file.** If removing them empties a whole `it(...)` block, remove that block and
   say so in the PR body.

6. **Retire this prompt in the same PR**: `git mv docs/pr-prompts/pr-formrule-legacy-payload-retire-HOLD.md
   docs/pr-prompts/superseded/`. Never delete it.

Title the PR `refactor(forms): stop sending the retired FormRule payload from the web`.

## Do NOT

- Do **NOT** touch `apps/api/**`. This slice is web-only. The API half is #2158 and it is already
  open and awaiting Marco.
- Do **NOT** touch `CorrectiveActionDetailPage.tsx`, `CorrectiveActionsPage.tsx`, or anything else
  naming `sourceFieldKey` - `CorrectiveAction.sourceFieldKey` is a DIFFERENT model's column, it is
  staying, and #2158 leaves it alone. The three `done_when` greps are file-scoped for exactly this
  reason; a repo-wide grep would never go green and is not the test.
- Do **NOT** rewrite, restyle or "improve" `FormRulesBuilderPage` beyond the two changes listed.
  It is the working rules UI.
- Do **NOT** remove the `FormRule` table, its `definition` column, or any API model. Out of scope.
- Do **NOT** add a replacement rules panel, a migration path, or a "legacy rules" read-only view.
  If you think one is needed, say so in the PR body and build nothing.
- Do **NOT** touch `sot/` (CP-24 hard-fails any PR mixing code and `sot/`).
- Do **NOT** hand-merge, and do **NOT** wait for a human. This prompt is `escalates: false`:
  the watcher enables auto-merge and the PR lands itself once CI is green. Your job ends at
  `gh pr create`.

## Two notes for the reviewer, not for the agent

- **`fixes_pr: 2158` is deliberate and is not a way round the design gate.** This prompt has no
  mock-up because it removes UI rather than drawing any, and inventing a `design_ref` would be a
  lie recorded in the queue. The `fixes_pr` exemption is the honest route: this slice exists to
  unblock an open PR, and the fix lane is where it belongs. Consequence to know: the intake linter
  live-checks #2158 at dequeue and REJECTs `FIX_TARGET_SETTLED` if it has MERGED or CLOSED by then.
  That is the correct failure - if #2158 merged first, this prompt's premise has already been
  overtaken by an incident.
- **`escalates: false` is Marco's call, made 2026-09-25 in chat.** The slice was drafted `escalates: true` for a human eye on three screens; Marco flipped it, so the PR auto-merges on
  green with no label and no receipt. That is the right shape for the ordering this slice exists
  to protect: it must be on `main` BEFORE #2158, and a merge gate waiting on a human is the
  thing most likely to invert that order. #2158 keeps its own `do-not-merge`, so the human
  decision still sits where the risk is - on the column removal, not on this.

## Open question Marco has not answered yet

Whether anything OUTSIDE this monorepo posts to `/forms/templates` or
`/forms/templates/:id/versions` - a mobile client, an integration, a script. If something does, it
still sends `rules` and it will start failing when #2158 merges, and this slice does not fix it.
The agent should grep the repo for other callers and report what it finds in the PR body, but it
cannot answer for anything outside the repo. Do not block on this.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Do not loop.
- **Never exit silently.** If you cannot do the work, say `NO-OP: <reason>` and exit.
- **Never ask a question or "stand by" for approval.** There is no human in this run. A dismissed
  or unanswered question is the absence of a human, not a stop signal - proceed on best judgement
  and record the assumption in the PR body.
- Read the job log before diagnosing any CI failure. The exit code decides, not your reading of it.
- Hard stops still stop you: Azure / Entra / SharePoint, production auth or secrets, irreversible
  actions, anything needing a real human identity. Say `NO-OP: <reason>` and exit.

## The completion test

Before you finish, ask: **"Is there a PR number in my output?"**

- **Yes** → done.
- **No, because the work was already on `main`** → say `NO-OP: <reason>`. Correct.
- **No, because I could not do it** → say `NO-OP: <reason>`. Correct, and honest.
- **No, because I am waiting for someone** → **WRONG. There is nobody. Open the PR.**

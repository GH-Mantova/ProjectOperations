---
premise: '! grep -q "CRM_REGISTER_RESIDUAL_V1" apps/web/src/pages/crm/TendersRegisterPage.tsx'
premise_means: The Next action cell stacks its chip under the text when there is no task but inline ahead of the text when there is one, and the Stalled badge is display:block so it stretches the whole cell instead of hugging its label. The Value and Logged by chips the artboard draws are absent, and the Owner chip is labelled Estimator.
scope:
  - apps/web/src/pages/crm/TendersRegisterPage.tsx
  - apps/web/src/pages/crm/__tests__/crmvis-register-residual.test.ts
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test && grep -q "CRM_REGISTER_RESIDUAL_V1" apps/web/src/pages/crm/TendersRegisterPage.tsx && grep -q "valueMin" apps/web/src/pages/crm/TendersRegisterPage.tsx && grep -q "Logged by" apps/web/src/pages/crm/TendersRegisterPage.tsx && grep -q "Owner" apps/web/src/pages/crm/TendersRegisterPage.tsx && ! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/TendersRegisterPage.tsx
size: 4
gate_allow: none
seed_only: false
escalates: true
module: crm
requires_on_main: 'apps/web/src/pages/crm/TendersRegisterPage.tsx :: CRM_PARITY_REGISTER_V1'
design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
---

# CRM register residual - the Next action cell, the Value and Logged by chips, Owner

Follow-up to PR #1984, which landed the S4 visual parity slice. That slice named two artboard
chips as residual needing their own slice; a post-merge review against artboard
`Register.dc.html` then found two defects in the Next action cell. This slice carries both,
and nothing else.

**Gate:** `CRM_PARITY_REGISTER_V1` on main. Already satisfied.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

Scope discipline still applies: do not widen beyond the two files in `scope`.

## Guardrails

- One attempt. If `CRM_REGISTER_RESIDUAL_V1` is already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- `escalates: true` - a used screen changes again; Marco judges the screen before the label
  comes off. Do not treat CI green as acceptance.
- **Do NOT change `classifyNextAction` or the overdue classification** in
  `tendersRegisterPage.helpers.ts`. The sidebar Tenders badge shares it
  (`ShellLayout.crm-chrome.test.ts`). The helper file is deliberately out of `scope`.
- **Do NOT add an API parameter, a DTO field or a migration.** Everything here is either an
  existing query param with no control, or a client-side filter over rows already loaded.
- Suites that pin this page stay green untouched: `crmui-register-s1/s2.test.ts`,
  `crm-s8-register-helpers.test.ts`, `tenders-register-interaction.test.ts`,
  `ShellLayout.crm-chrome.test.ts`, `crmvis-s4-register.test.ts`.
- Tokens, not hex. Zero hex literals in the file, as it already is.

## 1. The Next action cell - two CSS defects

The artboard stacks the chip **under** the text in every state. The page does that in one
branch and not the other.

- **Populated branch** (there is a next action): the `s7-badge` currently renders inline
  **before** the text via `marginRight: 4`. Put the text in its own block and move the badge
  **under** it with `marginTop: 4`, keeping the badge's own `display: inline-flex`.
- **Empty branch** (*None set*): the `Stalled` badge currently carries `display: "block"`,
  which overrides `.s7-badge`'s `display: inline-flex` and stretches the badge across the whole
  cell. It must hug its label. Keep `marginTop: 4`; drop the `display` override and wrap the
  *None set* text in its own block instead.

**Wording is untouched.** The badges keep saying `Overdue` and `Due soon`. The artboard says
"3 days over" and "In 4 days", which would mean changing the shared classification - forbidden
above, and out of scope here.

## 2. Value chip - no API work

`valueMin` and `valueMax` are **already** in `FiltersForQuery`
(`apps/web/src/pages/tendering/tenderingPage.helpers.ts`), already serialised by
`buildQueryStringWithPage`, and already accepted by `tender-query.dto.ts`. They are initialised
to `""` on this page and have no control. Add one.

**Follow the Due chip exactly** - it is the in-repo pattern for a chip that opens a pair:
a `crm-filter-chip` button toggling open/closed, `aria-expanded`, then an inline pair of
`s7-input` controls with a `to` separator between them. Use `type="number"` with
`inputMode="numeric"`. The chip takes `crm-filter-chip--active` and shows the set bound when
either end is set, the same way `activeDueLabel` works.

## 3. Logged by chip - client-side

There is **no API parameter for this and none is added**. The page already calls
`fetchAllPages` and holds every row, and separately fetches interactions into a `Map` to render
the Logged by column. Filter over that, client-side, the way `Mine only` and the next-action
toggles already do.

**Follow the Client chip** - a `crm-filter-chip` `select`. Derive the options from the loaded
rows (the same `loggedByName` the column renders), sorted, de-duplicated. Include an explicit
**Never logged** option for rows with no interaction, because that is the state the Follow-ups
tab exists to surface.

**Known limit, and it goes in the PR body:** the option list can only name people who appear in
the rows currently loaded.

## 4. Owner - a relabel, not a new filter

The Estimator chip already **is** the artboard's Owner chip. Marco confirmed in chat on
2026-09-16: *"Estimator is the owner."*

Relabel the chip to `Owner`: its placeholder, its `aria-label`, and the `activeEstimatorLabel`
string. **The field stays `estimatorId`** - no rename of the query param, the row type, or
anything outside this page.

The comment above that chip currently reads *"Labelled 'Estimator' not 'Owner' because the
field is the tender's estimator, not an ownership field."* That reasoning is now overruled.
**Rewrite the comment** to record the decision and its date - do not leave a stale claim in the
file, and do not silently delete it either.

Scope is this page only. Other screens that say "Estimator" are not touched.

## Tests - `crmvis-register-residual.test.ts`

1. Populated Next action renders the text above the badge, and the badge keeps
   `inline-flex` - not `block`, and not `margin-right`.
2. Empty Next action renders *None set* above a `Stalled` badge that is `inline-flex`.
3. The Value chip round-trips `valueMin` / `valueMax` into the query string via
   `buildQueryStringWithPage`.
4. The Logged by filter narrows the rows, and its option list is derived from the rows rather
   than hard-coded - including the `Never logged` case.
5. The Owner chip's accessible name is `Owner`, and the query param it sets is still
   `estimatorId`.

## PR body must declare

- `Visual acceptance: scripts/pipeline/screens/crm.json -> register (artboard Register)`
- The Logged by option-list limit stated above.
- That the chip wording stays `Overdue` / `Due soon` and why.

---
premise: '! grep -rq "priceFromSubcontractor\|price.*from.*subbie\|price.*from.*subcontractor" apps/api/src/modules/tendering apps/web/src/pages/tendering'
premise_means: There is no explicit per-line action anywhere in tendering/scope-of-works to price an allocated scope line from the assigned subcontractor's rate card.
scope:
  - apps/api/src/modules/tendering/scope-line-subcontractor-pricing.service.ts
  - apps/api/src/modules/tendering/scope-of-works.service.ts
  - apps/api/src/modules/tendering/scope-of-works.controller.ts
  - apps/web/src/pages/tendering/**
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/tendering/scope-line-subcontractor-pricing.service.ts
size: 8
gate_allow: none
seed_only: false
escalates: true
rollback_strategy: ''
requires_merged:
  - 213
---

# RC-3 (PARKED/GATED): opt-in scope-line pricing from a subbie's rate card

**⚠ DO NOT ARM until the gate is verified for real — see "Gate correction needed" below.**

**Binding plan:** `docs/plans/subcontractor-rate-cards-slice-plan.md` on main. This is the third and
final subcontractor-rate-cards slice: "Explicit per-line action to price an allocated scope line from
the assigned subcontractor's card." It depends on RC-1 (`SubcontractorRate` model + CRUD, escalates)
and RC-2 (Rates tab UI) both being merged, AND on the subcontractor-assignment work (referred to in
the plan docs as "PR-213") having landed, because pricing a scope line "from the assigned
subcontractor" requires a scope line to actually record which subcontractor is assigned to it.

## Gate correction needed — read before arming
The plan docs (`docs/plans/subcontractor-rate-cards-slice-plan.md`, `sot/02-roadmap-and-status.md` §3
and §6 item 4) all reference this dependency as **"PR-213"**. `pull_request_read` on
GH-Mantova/ProjectOperations **PR #213 was checked and is NOT the subcontractor-assignment PR** — it
is `[5A.1] PR B follow-up — remove orphaned draft-scope helpers + log #212`, an unrelated dead-code
cleanup, already merged 2026-05-24. The real subcontractor-assignment model is still listed as
**unbuilt** in `sot/02-roadmap-and-status.md` §6 item 4 ("PR-213 subcontractor assignment model —
unblocks the subcontractor portal") under "⛔ Needs Marco (decisions blocking progress)" as of
2026-08-04 — i.e. "PR-213" is a roadmap placeholder label for work that has not been staged, opened,
or numbered yet, not a real GitHub PR number.

**Consequence:** the `requires_merged: [213]` gate above is technically satisfied right now (the real
#213 already merged) but does NOT mean the subcontractor-assignment work has landed — it would let
this prompt arm prematurely. **Do not arm this prompt until Marco identifies the real
subcontractor-assignment PR number** (once it exists) and this front-matter's `requires_merged` value
is corrected to that number. Until then this file should stay parked exactly as `pr-subbie-rate-cards-scope-pricing-ready.md`
is filed under staged-not-armed, and whoever arms slices for this repo must manually re-verify the
gate before firing it rather than trusting the number below.

## What to build (once actually unblocked)

### 1. API — `apps/api/src/modules/tendering/scope-line-subcontractor-pricing.service.ts` (new)
A small, explicit, **opt-in** service — not a resolver default — that:
- Given a scope-of-works line (`ScopeOfWorksItem` — confirm the exact model/field names against
  `apps/api/prisma/schema.prisma` on main at build time, they may have shifted since this prompt was
  written) that has a subcontractor assigned to it (via whatever field/relation the
  subcontractor-assignment work adds — confirm its real shape once that work has landed; do not guess
  it here), looks up that subcontractor's active `SubcontractorRate` rows (RC-1) matching the line's
  discipline/scope code (`DEM`/`CIV`/`ASB`/`Other`, `apps/api/src/modules/personas/definitions/disciplines.ts`).
- Presents the candidate rate(s) to the caller (list, since a subbie may have more than one active
  rate for the same discipline at different units) and, on explicit user confirmation of ONE rate,
  writes the chosen rate onto the scope line's pricing field(s) — this is a one-time explicit action
  the user triggers per line, not an automatic recompute.
- **Never routes through `RateResolverService`.** This stays a separate axis from the estimate-rate
  resolver per the plan doc's explicit instruction — confirm at build time that
  `apps/api/src/modules/rates/rate-resolver.service.ts` is untouched by this change.

### 2. Wire the action into scope-of-works
- Add a controller endpoint on `scope-of-works.controller.ts` (or a new small controller if that file
  is already large — check its current size on main first) exposing this as an explicit per-line
  action, e.g. `POST /tendering/scope-items/:id/price-from-subcontractor`.
- Guard it with whatever permission the subcontractor-assignment work introduced for reading the
  assignment, plus `subcontractors.rates.view` (RC-1) for reading the rate card — do not invent a new
  permission code without checking whether one already fits.

### 3. Web — the explicit per-line action
- Add a "Price from subbie" (or similar, keep it explicit and undoable-sounding — this is a pricing
  decision, not silent automation) button on the scope line row in whichever tendering page renders
  scope-of-works lines with an assigned subcontractor. Confirm the exact page/component at build time
  — it will depend on how the subcontractor-assignment slice surfaced the assignment in the UI.
- On click, show the candidate rate(s) from RC-2's data shape and let the user confirm one before it
  writes anything.

## Do NOT
- Do NOT make this automatic/default — it must remain an explicit, user-triggered, per-line action.
- Do NOT touch `RateResolverService` or route subbie rates through it.
- Do NOT touch RC-1's `SubcontractorRate` model/migration or RC-2's Rates tab beyond reading from
  RC-1's data.
- Do NOT arm/merge before the subcontractor-assignment work has actually landed and this file's
  `requires_merged` number has been corrected — see "Gate correction needed" above.
- Do NOT touch Azure/Entra/SharePoint.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if the subcontractor-assignment model this depends on does not
  actually exist on main when this fires, STOP and say `NO-OP: subcontractor-assignment model not
  found on main — gate PR number was wrong, do not guess the shape`. Do not invent a fake assignment
  field to force the slice through.
- Never ask a question or "stand by" for approval, but DO refuse to proceed (NO-OP, not a guess) if the
  assignment shape can't be confirmed on main.
- Read the CI job log before diagnosing a failure.
- `pnpm build` and `pnpm lint` must pass.

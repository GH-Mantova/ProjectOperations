---
premise: '! grep -rq "SCOPE_WASTE_SECTION_V1" apps/web/src/pages/tendering'
premise_means: >-
  Waste is a flat always-open block that predates the card redesign. It cannot be folded away on a
  card that does not dispose of anything, it shows no line count or subtotal until you scroll it,
  and it has no way to pull the measurements an estimator already ticked as waste on the items
  above - so the same tonnage gets typed twice, in two places, and the two drift.
scope:
  - apps/web/src/pages/tendering/ScopeWasteTab.tsx
  - apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx
  - apps/web/src/pages/tendering/__tests__/waste-section.test.tsx
  - tests/e2e/pr-acceptance/batch3-scope-items.spec.ts
  - tests/e2e/pr-acceptance/batch3-scope-waste.spec.ts
  - tests/e2e/pr-acceptance/batch8-misc.spec.ts
  - scripts/pr-gates/e2e-restoration-markers.mjs
  - .github/workflows/ci.yml
done_when: pnpm build && pnpm lint && grep -rq "SCOPE_WASTE_SECTION_V1" apps/web/src/pages/tendering
size: 9
gate_allow: none
seed_only: false
escalates: true
backfill: false
cluster: scope-card-redesign
cluster_order: 8
requires_on_main: 'apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx :: SCOPE_CUTTING_V1'
rollback_strategy: >-
  Web-only re-layout of one existing section plus its mount point. No API, no schema, no migration,
  and no waste line is created, changed or deleted - the same rows bind to the same records in a
  different container. Revert the commit and the flat block comes back with every line intact.
---

# The Waste section

Eighth and final slice of the card redesign. Approved mock-up:
`https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035` - `wasteSection(card)`.

**Why this slice exists at all, stated plainly:** the original seven slices missed it. The redesign
rebuilt the WBS table, Other operational costs and Cutting, and left Waste in its pre-redesign
shape sitting between two of them. This closes that hole.

## What to build

Rebuild `ScopeWasteTab.tsx` in the same visual language as the sections either side of it, matching
the mock-up's `.opsec.wsec`:

1. **Collapsible, with a summary that is readable while collapsed.** A fold caret; the section title;
   the line count rendered in words (`no lines`, `1 line`, `4 lines`); and on the right, the
   **subtotal and the `+ N% markup` figure**, both visible whether or not the section is open. A card
   that disposes of nothing should be one folded line, not a screenful of empty fields.

2. **`⇩ Sum from items above`.** Pulls the measurements ticked `Waste?` in the Measurement
   expandable that slice 5 built, and creates waste lines from them. **This is the point of the
   whole section:** without it the estimator types the same tonnage twice, in the measurement block
   and again here, and nothing reconciles the two.

   It must be **additive and non-destructive** - it never overwrites or deletes a waste line the
   estimator typed by hand, and running it twice must not double the tonnage. State in the PR body
   what happens on the second press; "it appends again" is a defect, not a behaviour.

3. **`+ add a waste line`** for disposal that no measurement produced.

4. **The Road / Straight distance basis toggle**, as in the mock-up's `.basisw`.
   **Check this one before building it.** The toggle only means something if the API returns both a
   road distance and a straight-line distance for the facility. If it returns one number, say
   `NO-OP: only one distance on the payload - the Road/Straight toggle would be decorative` and
   build the rest of the section without it. A control that changes nothing is worse than no
   control: it teaches an estimator that the number is a choice when it is not.

Mark the component with `SCOPE_WASTE_SECTION_V1`.

## Order inside the card is fixed by the mock-up

`WBS items -> Other operational costs -> Waste -> Concrete cutting -> + Add WBS item -> subtotal`.

Waste sits **after** Other operational costs and **before** Cutting. Both of those exist by the time
this runs. Put it in that position and say in the PR body that you checked the rendered order.

## Do NOT

- **Do not add, change or remove any API route, service method or DTO.** Web-only. If summing from
  measurements needs an endpoint that does not exist, say `NO-OP: <what is missing>` and stop -
  do not invent one.
- **Do not compute a waste price in the client.** Rate, transport and tonnage all come from the
  server, which snapshots the transport rate onto the row (`quotedTransportRatePerDay`). A second
  implementation in TypeScript is how the screen and the quote start disagreeing.
- Do not change the measurement block, the cutting take-off, the WBS table or `/sot/`.
- Do not change what a waste line costs. This slice moves a section; it does not reprice anything.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green, including: fold and unfold; summing from items;
      **summing twice and getting the same total**; a hand-typed line surviving a sum.
- [ ] Card subtotal identical before and after this slice for a card with existing waste lines.
      **Give both figures in the PR body.** If they differ, the slice is not done.
- [ ] Collapsed state still shows the line count and both money figures.
- [ ] Rendered order matches the mock-up's card order. Say how you checked.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN - open the PR and leave it unmerged for Marco.

## The restoration ratchet - this slice closes the coverage debt it inherited

Slice 2 migrated the acceptance suite onto the WBS table and could not keep every assertion,
because the affordances they exercised had not been built yet. Each dropped assertion was left
marked with the plant constant of the slice that would restore it:

```ts
// TODO(SCOPE_WBS_PLANT_V1): restore the plant-pill assertions when slice 4 lands the column group.
```

**This is the last slice in the chain, so this is where the debt has to be zero.**

1. **Restore the outstanding assertions.** Walk every remaining `TODO(SCOPE_*)` in
   `tests/e2e/pr-acceptance/` and reinstate the assertion against the finished UI. If an
   assertion is genuinely obsolete because the redesign removed the behaviour it tested - say
   so in the PR body and delete it with a one-line reason. Silent deletion is the failure mode
   this whole mechanism exists to prevent.

2. **Add `scripts/pr-gates/e2e-restoration-markers.mjs`.** It scans
   `tests/e2e/pr-acceptance/**` for `TODO(SCOPE_` and:
   - exits 0 while `SCOPE_WASTE_SECTION_V1` is NOT yet on `origin/main` (the chain is still
     running - outstanding markers are expected and correct);
   - exits 1 once it IS, listing every file and line still carrying a marker.

   Wire it as its own CI job named `E2E restoration markers`. It must be a separate job, not a
   line inside the diff-checks script: CP-26 already demonstrated that folding a new assertion
   into `pr-gates.mjs` makes one failure surface as two red checks and obscures which one broke.

3. **The check must fail loudly on its own trigger.** Do not gate it behind a label, an opt-in
   front-matter key or a changed-path filter. A ratchet that only runs when someone remembers to
   run it is not a ratchet.

Marco: this job is advisory until you add it to ruleset 15532058's required checks, the same way
`Approval receipt (CP-26)` is advisory today.

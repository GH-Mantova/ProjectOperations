# Tendering smoke-test plan — live Azure URL

Concrete walkthrough Sean, Raj, and Marco can run against the live Azure URL to
validate the Tendering deploy. Mirrors the May locally-run smoke. Four phases,
top-to-bottom. Each item has an expected behaviour. Tick the box, file a bug,
or move on.

> Companion docs: [`pre-deploy-checklist.md`](./pre-deploy-checklist.md) and
> [`onboarding-sean-raj.md`](./onboarding-sean-raj.md).

Preconditions:

- You've logged in via SSO and have the right role (Tendering Editor minimum).
- Seeded Initial Services data is present — `IS-T020` and friends are
  visible in the tender list.
- The companion checklist has been ticked through to section 7.

Bug-report format and channel are in
[`onboarding-sean-raj.md`](./onboarding-sean-raj.md#how-to-report-bugs).

---

## Phase 1 — Tender lifecycle

- [ ] **Create tender** (required + optional fields populated)
      → Lands on the new tender detail page, all entered values shown,
      tender code generated.
- [ ] **Edit tender** (change client, due date, internal notes)
      → Save returns success toast, values persist after page refresh.
- [ ] **Add multi-client** (≥ 2 clients on a single tender)
      → Each client appears in the client list, quotes can be created per client.
- [ ] **Status transition: DRAFT → SUBMITTED**
      → Status badge updates, activity log entry appended.
- [ ] **Status transition: SUBMITTED → AWARDED**
      → Status badge updates, award metadata captured.
- [ ] **Status transition: AWARDED → CONTRACT**
      → Contract section unlocks, status badge updates.
- [ ] **Status transition: CONTRACT → JOB**
      → Project number assigned, estimate snapshot taken (see Phase 4).
- [ ] **Rollback lifecycle** (e.g. AWARDED → SUBMITTED)
      → Rollback dialog shows correct impact summary, status reverts on confirm.
- [ ] **Delete tender** — cascade preflight dialog
      → Shows correct counts of dependent records (scope cards, quotes, clarifications, etc.)
      before delete. Cancel out — do NOT actually delete a seeded record unless
      you created it.

## Phase 2 — Scope of Works

- [ ] **Add scope cards across all 4 disciplines** — DEM, CIV, ASB, Other
      → One card per discipline, each saves cleanly and appears in the scope panel.
- [ ] **Add scope items with dimensions (length × height × depth)**
      → Auto-derived sqm / m³ / tonnes update live as dimensions change,
      values persist after save.
- [ ] **Cutting subtable — copy rows from parent**
      → Copy populates cutting rows from the parent scope items, values match.
- [ ] **Cutting subtable — add manual rows**
      → Manual rows save alongside copied rows, totals recompute.
- [ ] **Waste subtable — sum from parent rows**
      → Waste totals reflect parent scope volumes, recompute when parent rows change.
- [ ] **Per-card markup override**
      → Override applies to that card only, other cards unchanged, quote totals reflect.
- [ ] **Quote scope items — reset / push from scope**
      → Push pulls latest scope into the quote; reset clears quote-side edits;
      both leave the source scope untouched.

## Phase 3 — Quote + PDF export

- [ ] **Create a quote per client**
      → On a multi-client tender, each client gets its own quote document;
      quotes are independent (editing one does not affect the other).
- [ ] **Add cost lines, options, assumptions, exclusions**
      → All four section types save, reorder, edit, and delete cleanly.
- [ ] **Apply quote-level adjustment**
      → Adjustment recalculates internal totals. **Critical check:**
      the adjustment value does NOT appear on the PDF — it is internal only.
- [ ] **Generate quote PDF** — Sean's visual fidelity gate
      → PDF downloads, opens cleanly, branding correct, all sections present,
      no broken layouts or page-break weirdness.
- [ ] **Excel export**
      → Excel file downloads, opens in Excel / Sheets, structured data matches
      the quote on screen (cost lines, totals, etc.).

## Phase 4 — Clarifications, comms, conversion

- [ ] **Add clarifications across all 6 types**
      → Each clarification type saves with its own metadata, appears in the
      clarifications list, exportable.
- [ ] **Unified comms panel — log a call**
      → Call entry persists, timestamp + author captured, visible in activity log.
- [ ] **Unified comms panel — log an RFI**
      → RFI entry persists, linked to the tender, surfaces in the RFI list.
- [ ] **Unified comms panel — log a meeting**
      → Meeting entry persists, attendees + outcomes captured.
- [ ] **Unified comms panel — log a follow-up**
      → Follow-up entry persists, due date surfaces on the dashboard / list view.
- [ ] **Award + convert to job**
      → Project number assigned (format matches Initial Services convention),
      estimate snapshot captured (frozen copy of the quote at conversion time —
      check it can be opened from the new job).
- [ ] **Activity log captures every action above**
      → Open the activity log for the tender, confirm entries for the major
      actions in Phases 1-4 (create, status changes, quote generation, comms,
      conversion). Spot-check ≥ 5 entries.

---

## Sign-off

Initial when your scope is clean. Once both are signed, Marco closes out the
round.

| Tester | Scope | Status | Initials | Date |
|---|---|---|---|---|
| Sean | Phase 3 (quote PDF visual fidelity) | _pending_ | _____ | _____ |
| Raj | Phases 1, 2, 4 (lifecycle, scope, conversion) | _pending_ | _____ | _____ |
| Marco | Cross-check + go/no-go on next module | _pending_ | _____ | _____ |

If any phase comes back **not clean**, file the bugs per
[`onboarding-sean-raj.md`](./onboarding-sean-raj.md#how-to-report-bugs),
fix forward, redeploy, re-run the affected phase. Sign-off only after a clean run.

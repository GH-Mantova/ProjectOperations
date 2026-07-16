# ERP vs the competitor field — forensic gap analysis

**Author:** Cowork (Claude) · **Date:** 2026-07-15 · **Status:** DRAFT for Marco
**Benchmarks:** Microsoft 365 / Dynamics 365, Assignar, Intuit QuickBooks Time (TSheets), AssetTiger,
HammerTech, Procore. **Companion to:** `d365-m365-gap-analysis-v2.md` (365/D365 already covered there —
not repeated here), `form-inspection-engine-spec.md` (WHS/forms), `jotform-forms-gap-analysis.md`.
**Method:** same as the forms work — *grep the codebase first, then benchmark.* Every "gap" below was
checked against the actual `apps/api` modules + Prisma schema so we don't re-propose what's already built
(the forms engine was 75% done; this analysis avoids that trap). Nothing here is staged; it's for sign-off.

---

## 1. What the ERP already HAS (the honest baseline)

The forensic scan (60 API modules, 195 Prisma models) shows a genuinely broad system. Confirmed built,
so **out of scope for "gaps":**

- **Estimating / tendering / quoting** (`estimates`, `tendering`, `tender-*`, `quote`, `client-quotes`,
  `estimate-export`).
- **Jobs / projects** and **scheduling** — `scheduler`, `allocations`, `job-roles`, `resources`, with
  `Shift`, `ShiftWorkerAssignment`, **`ShiftAssetAssignment`** (plant *is* allocated alongside labour) and
  **competency-gated dispatch already wired** (`schedule-allocation.service` + `compliance/competency-gate`).
- **Workforce** — `workers`, `Competency` / `WorkerCompetency.expiresAt`, `JobRoleRequirement`, `Timesheet`.
- **Assets** — `assets`, `maintenance`, `inventory`.
- **Commercial** — `procurement`, **`ProgressClaim` / `ClaimLineItem` / retention** (progress claims are
  built — impressive for this size), **variations** (`variation`, the AU term for change orders, has models),
  **`RFI`**, **subcontractor** management.
- **Compliance / WHS** — `safety`, `compliance`, SWMS references, permits, `incident` models, plus the
  mature **forms/inspection engine** (PR #97: templates, rules, approvals, schedules, GPS, signatures).
- **Records & comms** — `documents`, `correspondence`, `email`, `comms-approvals`, `directory`, `contacts`.
- **Platform** — `auth`, `authorization`, `permissions`, `roles`, `security`, `audit`, `xero`, `rates`,
  `global-lists`, `calendar`, `pdf-rendering`, `portal`, `field` (PWA).

Also **already on the roadmap (excluded here):** everything in `d365-m365-gap-analysis-v2.md`
(Sustainability/waste-emissions ledger, financial dimensions, Power Pages portal, cases, etc.), the six
**forms-engine gap prompts** just staged (content library, scoring, corrective actions, public/kiosk/QR,
submission-PDF, AI-from-PDF), and the **Interactive SWMS** module.

**Takeaway:** this is not a thin ERP. The whitespace is narrow and specific — and, importantly, most of
the *WHS/site* competitor features collapse onto the **forms engine** (they are templates, not new
subsystems). The genuine net-new builds are concentrated in **commercial cost-control, asset/plant
lifecycle, and field time/dispatch.**

---

## 2. Net-new gaps by theme

Status key: **GAP** (near-zero in code) · **PARTIAL** (foundation exists, capability thin) · verdict
**TS** = table-stakes for this sector · **DIFF** = differentiator.

### Theme A — Commercial cost control & project delivery *(Procore whitespace)*
| Capability | Status | Verdict | Why it matters for demolition/civil |
|---|---|---|---|
| **Commitments** — subcontract/PO cost tracking live against budget + committed cost | **GAP** (`commitment`=0) | TS | Locks in tip/haulage/plant/subbie spend before it becomes a surprise; the missing half of cost control (claims exist on the revenue side, commitments don't on the cost side). |
| **Daily site diary / log** (labour, plant, weather, deliveries, events; GPS + photos) | **GAP** (`diary`=0) | TS | The #1 generic-ERP gap and the evidentiary spine for delay/variation/dispute defence. Highest value-to-effort. |
| **Punch / snag / defect list** (drawing-pinned, photos, owner, close-out) | **GAP** (`snag`=1, `defect`=8) | TS | Make-good/handover close-out on civil reinstatement. Note: partly expressible on the forms engine's new corrective-action loop. |
| **Cost-to-complete forecasting** (committed + actual + forecast vs budget) | **PARTIAL** | DIFF | Cash/margin visibility a small contractor rarely has; needs commitments (above) + the staged BI layer. |
| **Meetings / minutes with tracked actions** | **GAP** | TS(minor) | Toolbox/client-meeting accountability; small build, or a forms template. |
| **SOPA payment-schedule discipline** on progress claims (AU Security of Payment) | **PARTIAL** (`payment schedule`=1) | TS | Progress claims exist; the *statutory payment-schedule response within the window* may not. Legal exposure if missed — verify then close. |
| Drawing/plan **controlled revision register + markups** | **PARTIAL** (`revision`/`markup` present but look tender/pricing-oriented) | DIFF | Prevents work off superseded plans near live services/asbestos. Verify whether the existing revision/markup is document-grade before building. |

*Sources: Procore RFIs/Submittals/Drawings/Daily Log/Financials/Commitments (procore.com project-management & project-financials; AU progress-claims / SOPA payment program).*

### Theme B — Asset & plant lifecycle depth *(AssetTiger whitespace)*
| Capability | Status | Verdict | Why it matters |
|---|---|---|---|
| **Barcode / QR asset tagging + scan-to-identify** | **GAP** (`barcode`/`qr`=0) | TS | Tag every excavator, attachment, tool, skip bin, PPE item; scan in the field. No physical-tag layer today. |
| **Asset check-out / custody chain** ("who has it, due back when") | **GAP** (`checkout`=0) | TS | Currently done on a *Jotform* key-checkout form — bring it into the asset record with history. |
| **Asset reservations / forward bookings** | **GAP** (`reservation`=2) | DIFF | Reserve a machine/tool for a future window; prevents double-booking across jobs (asset-hire concept). |
| ~~Depreciation~~ | **DROPPED (decided 2026-07-15)** | — | **Xero-only. The ERP does NOT track depreciation** — Marco's decision. `pr-erp-asset-depreciation` prompt withdrawn. |
| **Plant pre-start + service history + operator authorisation on the asset** | **PARTIAL** | TS | Assets + maintenance exist; tie the pre-start (forms) + service history + operator ticket to the machine record. |
| **Warranty / insurance expiry alerts; consumable min-max** | **PARTIAL** | DIFF | Inventory exists; warranty/insurance expiry + insured-vs-uninsured flags are thin. |
| **Utilisation / hours / odometer / telematics-driven servicing** | **GAP** (`telematics`/`odometer`=0) | DIFF (defer heavy IoT) | Service plant by hours, not guesswork; full telematics is a later/optional integration. |

*Sources: AssetTiger features (assettiger.com/features — check-in/out, barcode/QR, depreciation, reservations, warranty, PM work orders).*

### Theme C — Field time capture & dispatch *(QuickBooks Time / Assignar whitespace)*
| Capability | Status | Verdict | Why it matters |
|---|---|---|---|
| **Geofenced / GPS mobile clock-in tied to job & site** | **GAP** (`geofence`=0) | TS | `Timesheet` exists but time isn't geofence-bound; the single biggest lever for accurate labour costing across multi-site crews. |
| **GPS breadcrumb / route + "who's working / nearest worker" live map** | **GAP** | DIFF | Attendance/dispute evidence + reactive dispatch (bin drops, breakdowns). |
| **Digital delivery / haulage dockets** (signature, real-time) | **GAP** (`docket`=0) | DIFF | The paper docket is the lifeblood of skip-bin/waste cartage and plant hire — a direct fit for the sister waste business. |
| **Est-vs-actual labour-hours job costing + overtime rules** | **PARTIAL** | TS | Timesheet + estimates exist; the variance view + rules-based OT flagging is thin. |

*Sources: QuickBooks Time GPS/geofencing/job-costing; Assignar scheduling + digital dockets + Xero export.*

### Theme D — WHS / site-compliance depth *(HammerTech whitespace — mostly forms-engine templates)*
| Capability | Status | Verdict | Note |
|---|---|---|---|
| **Proactive ticket/licence expiry ALERTING** (people + plant) | **PARTIAL** | TS | Register + scheduling-gate exist; proactive *alerts/digest before expiry* is the missing piece. An expired asbestos/demo-supervisor ticket must nag. Small, high-value — verify then build. |
| **Site sign-in / QR / live muster headcount** | **PARTIAL** | DIFF | The staged `pr-forms-public-kiosk-qr` covers sign-in; **live muster/evacuation headcount** is the extra. |
| **Subcontractor prequalification / insurance-compliance portal** | **PARTIAL** (`prequal`=6) | DIFF | Subcontractor mgmt exists; a self-service prequal + insurance-expiry portal protects head-contractor liability. |
| **Site bulletins / noticeboard with read-acknowledge** | **GAP** | DIFF(minor) | Proof-of-read safety comms; a small forms/comms feature. |
| Permits-to-work zones · pre-task/JHA · inductions | **PARTIAL** | TS | Deliverable as **forms-engine templates** (permit=8 already) — *not* net-new subsystems. Ship as template packs. |

*Sources: HammerTech modules (inductions, ticket-expiry, permits, pre-task plans, prequalification, site access/muster, plant register, bulletins).*

---

## 3. Priorities — what to build first

Ranked by value-to-effort for a 7-person demolition/asbestos/civil + waste shop:

1. **Daily site diary** (Theme A) — highest leverage; evidentiary spine; modest build.
2. **Geofenced/GPS timesheet capture** (Theme C) — accurate labour costing; builds on the existing `Timesheet`.
3. **Commitments → budget cost control** (Theme A) — closes the cost side to match the existing claims/revenue side.
4. **Asset barcode/QR + check-out custody** (Theme B) — retires the Jotform key form; real plant accountability.
5. **Proactive ticket/licence expiry alerting** (Theme D) — safety-critical; small; register already exists.
6. **Digital haulage/delivery dockets** (Theme C) — direct fit for Redcliffe waste cartage.
7. **Punch/snag list** (Theme A) — rides on the forms corrective-action loop just staged.
8. Then: subcontractor prequal portal, muster headcount, depreciation (decide vs Xero), reservations, cost-to-complete.

**Cross-cutting insight:** the WHS/site half of HammerTech is *mostly template work on the forms engine* — ship
it as seeded template packs (permit-to-work, pre-task/JHA, induction, prequal questionnaire) rather than new
modules. The genuinely new *builds* are the **commercial** (commitments, daily diary, snag, cost-to-complete)
and **asset/time** (barcode/checkout/depreciation, geofenced time, dockets) gaps. That is the real whitespace.

---

## 4. Deliberately NOT building (decide, don't assume)
- **BIM / coordination-issues** (Procore) — N/A at this scale.
- **Heavy telematics/IoT** — defer; a later integration, not a core build.
- **Depreciation** — **DECIDED 2026-07-15: Xero-only; the ERP does NOT track depreciation** (consistent with "keep Xero as the ledger"). Prompt dropped.
- Anything that duplicates the **forms engine** — permits, inductions, pre-task plans, SWMS, inspections,
  site sign-in are templates on the engine, not new subsystems.

---

## 5. Decisions to record (for Marco)
1. Confirm **daily site diary** + **commitments** as the next two commercial builds (highest-value gaps).
2. Confirm **geofenced timesheet** direction (extend `Timesheet`, GPS via the field PWA).
3. **Asset lifecycle**: barcode/QR + check-out custody + reservations approved. **Depreciation DECIDED: Xero-only — the ERP does not track it (prompt dropped).**
4. Treat HammerTech-class WHS features as **forms-engine template packs**, not modules.
5. Verify-then-close the two "PARTIAL/legal" items: **SOPA payment-schedule** response on claims, and
   **proactive competency-expiry alerting**.

Once you've picked from §3, I'll grep each to reconfirm it's a true gap (as with forms) and slice the
survivors into PR prompts.

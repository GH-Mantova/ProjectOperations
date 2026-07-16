# D365 / M365 gap analysis v2 — strengthened (net-new beyond what is already staged)

**Author:** Cowork (Claude) · **Date:** 2026-07-15 · **Status:** DRAFT for Marco
**Builds on:** `D365-vs-ProjectOperations-gap-analysis.md` and `d365-parity-program-DRAFT.md`.
**Grounding:** Microsoft Learn (Business Central, Field Service, Power Platform) — citations inline.
**Discipline:** this pass deliberately **excludes the ~23 items already staged** (listed in §0) so it
adds signal, not duplicates. Nothing here is staged; it is a strengthened backlog for Marco to
prioritise. Company context: ~7-person Brisbane demolition / asbestos / civil contractor + a sister
waste business (Redcliffe Skips), Xero as ledger of record, M365 SSO + SharePoint Graph in place.

---

## 0. Already staged — do NOT re-propose

Finance/ops parity (9): Expenses (slices 1-3), procurement three-way-match, RSO scheduling suggest,
BI/reporting layer, billing rigor (milestone/pro-forma), Xero-deepening, vendor-invoice OCR, CRM
lead/opportunity. UX (10): business-process-flow, universal-timeline, saved-views editable grid,
copilot-assist, command-bar search/quick-create, automation-engine, record-audit-history,
duplicate-detection, view-switcher, Fluent look + dark mode. Products (4): cases, knowledge-base,
HR-leave self-service, customer-voice surveys.

Everything below is **net-new** relative to that list.

---

## 1. Tier A — high strategic value, moat-aligned

### A1. Work-order + digital **inspection** engine  *(D365 Field Service parity — the big one)*
D365 Field Service **Inspections** are drag-and-drop digital forms attached to a **work order** and a
**customer asset**: offline-capable on mobile, pass/fail + multi-select + photo/file answers,
version-managed, and stored as **queryable data in Dataverse** (Copilot can even convert an existing
PDF/paper form into an inspection template). A work order threads Job → incidents/tasks → assigned
resource → asset → mobile capture → resolution.

Why it matters here: this is the productised version of what Initial Services hand-builds in **Jotform**
today (tool reports, site requests, credential capture, key checkout). Building a lightweight
work-order + inspection/form engine on the assets + worker spine:
- pulls field forms **in-app**, linked to Job/Asset/Worker, as structured auditable data;
- is the single largest structural gap vs D365; and
- closes most of the **forms gap** in the companion doc `jotform-forms-gap-analysis.md`.

*Refs: Field Service inspections overview, inspections on mobile, inspection builder (Copilot), work-order lifecycle.*
Builds on: assets module (#595), and complements the staged universal-timeline + automation-engine.

### A2. Sustainability — **Waste & Emissions ledger**  *(BC Sustainability parity)*
Business Central's Sustainability module tracks GHG **Scope 1/2/3** plus a **Water/Waste** intensity
category, using emission factors and sustainability journals, recalculated to **CO2e**, posted to a
**sustainability ledger**, with internal **carbon fees**, a role-center with KPIs/targets, and
built-in ESG reporting (CSRD/CBAM/EPR). Emissions can be captured directly on purchase invoices.

Why it matters here — this is unusually well-aligned to the business:
- **Tender differentiator.** ESG/carbon reporting is increasingly scored in government and tier-1
  construction tenders; almost no 7-person contractor can produce it. This defends the estimating/WHS
  moat by adding a credential competitors lack.
- **Natural extension of the R3 waste engine.** The tender engine already models tipping tonnages,
  recycling/diversion, and diesel/fuel — exactly the Scope 1 (mobile combustion) and Water/Waste
  intensity inputs. The data is largely already there.
- **Waste business fit.** Redcliffe skip tonnages by waste type map straight onto waste-intensity tracking.

*Refs: BC Sustainability management overview, sustainability reports, emissions on purchase invoices, CO2e setup.*
Builds on: R3 waste-transport cost engine + the staged BI layer.

### A3. Asset **service history + preventive-maintenance agreements**  *(Field Service assets parity)*
Field Service models **customer assets** with a functional-location hierarchy, a full **service
history** per asset (every inspection/repair/work order), and **agreements** that **auto-generate
recurring work orders and invoices** on a schedule (e.g. quarterly plant servicing, periodic test&tag,
routine inspections). Barcode/serial scanning ties a physical unit to its record.

Why it matters here: extends the in-flight assets module from a static register into a **lifecycle** —
what was serviced, when it is next due, and auto-created jobs for recurring maintenance. Directly
absorbs the tool test&tag / repair Jotform branches.

*Refs: Field Service customer assets, build service history, customer agreements overview, auto-generate work orders.*
Builds on: assets module (#595); pairs with A1.

---

## 2. Tier B — operational rigor & finance governance

### B1. Financial **dimensions** / cost-center tagging + cost accounting  *(BC parity)*
BC tags every transaction with analytical **dimensions** (department, project, cost center, activity)
and reports budget-vs-actual, cost allocation, and cost-center performance by dimension. For a
project contractor this is the difference between "we made money this quarter" and "job 4123 lost
margin on plant hire." Tag expenses, POs, timesheets, and invoices with Job / Cost-Center /
Activity, then slice by dimension.

Why it matters: gives the **staged BI layer** real analytical depth instead of flat totals, and is the
backbone of job-level profitability. *Refs: BC cost accounting reports, Dimensions-Total report.*
Builds on / feeds: the staged BI/reporting layer.

### B2. Document **approval workflows** + posting controls + number series  *(BC parity)*
Structured multi-step approval routing (beyond the current AuthorityService seam), sequential document
numbering, and posting-date/period locks with audit. Governance that a growing multi-user ERP needs
before it scales. Complements — does not replace — the staged automation-engine.

### B3. **External self-service portal**  *(Power Pages parity)*
A Dataverse-style external site with **web-roles** (role-based data access for external contacts) for
customers and subcontractors: skip **booking**, **credit application**, **document upload**, and job
status. This is the ERP-native replacement path for the customer-facing **Jotform** forms (Booking,
Credit apps). Larger build; external auth (Entra External ID / B2C pattern) and a clean public
surface. Flag as strategic + phased — and note it depends on **Marco** for any Azure/Entra identity
config (hard stop: no Azure/Entra without Marco).

*Refs: Power Pages capabilities, secure Power Pages (web roles / external auth).*

---

## 3. Tier C — CRM / service breadth (extends already-staged items)

- **C1. SLAs + entitlements on cases** — response/resolution timers and entitlement checks layered on
  the staged `cases` module.
- **C2. Product/service catalog + quote / light CPQ** — a structured catalog feeding quotes;
  complements the estimating moat and the staged CRM lead/opportunity work.
- **C3. Contract/agreement management + recurring billing** — service agreements and recurring
  invoices (skip hire, maintenance plans); overlaps A3's agreement engine on the billing side.

---

## 4. M365 opportunities — leverage what they already own

They already run **M365 SSO + SharePoint Graph** (Graph now on managed identity in prod). Cheap wins:

- **M1. Teams-based approvals & notifications** — surface ERP approvals/alerts where staff already
  live (Teams), instead of email-only.
- **M2. SharePoint document management deepening** — use the existing Graph integration as the doc
  store for onboarding packs, asset documents, and inspection attachments, retiring Jotform's
  file-upload sprawl.
- **M3. Outlook / Bookings scheduling** — external booking of site visits / skip deliveries.
- **M4. Power BI embedded** — the staged BI layer could embed Power BI given the M365 tenancy, rather
  than only rendering in-app charts.

---

## 5. Decision items (flag, not build)

- **Fixed-asset depreciation** (BC has it) — for owned plant/equipment. Low finance value and Xero may
  already cover it; **decide** rather than assume. Consistent with the "keep Xero as ledger" rule.
- **IoT / Connected Field Service** (asset sensors, IoT-triggered work orders) — **defer**; enterprise
  scope, low ROI at 7 people.
- **Dual-write / virtual entities** — **N/A**; the ERP is not on Dataverse. Listed only to close the loop
  on D365 architecture patterns so they are not mistaken for gaps.

---

## 6. The one cross-cutting recommendation

Items **A1 (work-order + inspection engine) + A3 (asset lifecycle) + A2 (waste/emissions ledger)**,
sitting on the **assets module (#595)** already in flight and absorbing the **Jotform field forms**,
form a single coherent **"field-operations spine."** It is simultaneously the biggest D365 Field
Service parity gap **and** the answer to the forms gap analysis. Suggested sequence:

1. Assets module (in flight) →
2. Worker ticket/competency register + expiry alerts (small, safety-critical) →
3. Work-order + inspection engine (A1) →
4. Migrate field Jotform forms onto it →
5. Asset service history + maintenance agreements (A3) →
6. Layer the waste/emissions ledger (A2) on the waste + fuel data already modelled →
7. Financial dimensions (B1) to make the BI layer analytical →
8. External portal (B3) for the customer-facing forms.

Tiers B/C/M and §5 are the deeper backlog once the spine exists.

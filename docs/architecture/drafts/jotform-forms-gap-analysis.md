# Jotform forms — usage analysis & gap analysis vs the ERP

**Author:** Cowork (Claude) · **Date:** 2026-07-15 · **Status:** DRAFT for Marco
**Scope:** deep functional analysis of the connected Jotform account, and a gap analysis
of how those forms map onto what the ProjectOperations ERP already does or should do. This is
analysis only — no prompts staged, no forms copied. Nothing here should be actioned without
Marco's sign-off.

---

## 1. What is in the account

Twenty assets across **two business lines** sharing one Jotform account:

- **Initial Services** — internal operations & HR capture forms.
- **Redcliffe Skips / Redcliffe Waste Pty Ltd (ACN 684 894 979)** — a sister waste/skip-bin
  business, customer-facing booking and credit-account forms. (Confirmed by the legal entity named
  in the credit-account guarantee text.) This is the same waste world the R3 tender engine and the
  waste-plant "moat" already touch.

### Initial Services (internal)

| Form | Fields | Subs | What it really is |
|---|---:|---:|---|
| **Action Request Form** | 35 | **455** | The workhorse. One form, five workflows, branched on "What is your request regarding?": Warehouse/Logistics, Purchase Request, Tool Damage Report, Tool Faulty Report, Repair Request, Test & Tag. |
| Tool Report & Request | 24 | 0 | A newer **split-out** of the tool-report branches (damage/fault/repair/test&tag). Evidence they already know Action Request is overloaded. |
| Grice Office Key Checkout | 14 | 11 | Key **custody**: recipient, key number/code, date issued, date due, responsibilities acknowledgment, e-signature. |
| Employee Credentials Form | 40 | 51 | **Ticket/licence/competency capture**: White Card, Asbestos A/B/S, Demolition Supervisor, Excavator/Skid Steer/Forklift/EWP, Manual Handling, CPR/First Aid, Silica, High-Risk Work; USI, vehicle licence, issue/expiry dates, conditions, document uploads. |
| Upload Documents Portal | 27 | 0 | **Onboarding document pack**: TFN declaration, super choice, signed job description, letter of offer, employment contract, health questionnaire, employee handbook + acknowledgment. |
| New Employee Details App | — | — | A Jotform **App** (mobile portal) bundling onboarding forms. |
| Product Order Form; Information Request Form | 13; 7 | 0; 0 | Generic templates, unused. |
| "Form" x2; "PDF Form" | — | 0 | Drafts / scratch. |

### Redcliffe Skips (customer-facing)

| Form | Fields | Subs | What it really is |
|---|---:|---:|---|
| **Redcliffe Skips Booking Request** | 18 | **221** | Clean customer skip booking: waste type (General/Budget/Asbestos), delivery date, billing/shipping address logic, placement photo, T&Cs. Explicitly "order request only — not confirmed"; notes a fuel surcharge. |
| Booking Form | **120** | 142 | The **old monster** (now DISABLED): full order-management-in-a-form — zone pricing (Zone 1/2/3 = $0/$53/$105), calendar IDs, EFT refs, COD, driver routing, bin swap-overs, weight caps, GST totals, bad-debtor flag. Superseded by the cleaner Booking Request. |
| 7-Day Business Credit Account | 68 | 9 | Heavy legal: full **Guarantee, Indemnity & Charge**, trade references x3, director/guarantor details, credit-check consent (Privacy Act), e-signatures, photo-ID upload. |
| 14-Day Business Credit (x2); Prepaid (30 Q); Credit Extension | — | ~9 ea | Variants of the credit-account application at different terms. |
| RS Employee Credentials + Clone | — | — | Redcliffe copies of the credentials form. |

---

## 2. How they actually use forms

**Functional capabilities the account leans on:** conditional/branching logic (Action Request
reveals sections per request type), multi-page wizards (page breaks), **e-signatures** (key
checkout, credit apps), **file upload** (licences, damage photos, ID, signed docs), **pricing
calculations** (Booking Form zone fees + GST + weight caps), address same-as toggles, product
pickers, **date/scheduling with calendar IDs** (delivery/pickup), payment capture (EFT ref, COD),
legal T&C acceptance, and **Jotform Apps** (bundling forms into a mobile portal).

**The strategic read.** Jotform is the company's **shadow front-end / capture layer** for
processes the ERP either has not yet exposed to the field and to customers, or has not built. It is
doing three distinct jobs:

1. **Field → office intake** (Action Request, Tool Report, Key Checkout) — internal operations that
   *should* be ERP transactions: requisitions, asset incidents, custody logs.
2. **HR credential + onboarding capture** (Employee Credentials, Upload Documents, New Employee App)
   — that *should* be an ERP worker-competency register and onboarding checklist.
3. **Customer-facing intake for the waste business** (Booking, Credit applications) — a genuine
   external-portal need.

**Pain signals visible in the data itself:**

- **Overloaded forms.** Action Request packs five workflows into 35 questions; the old Booking Form
  reached 120. Both the Tool Report split-out and the Booking Request rebuild are the team already
  fighting form bloat. Overloaded forms are error-prone and almost impossible to report on cleanly.
- **Sprawl / no governance.** Multiple 0-submission drafts, clones, and generic "Form" assets. No
  visible naming convention or ownership.
- **Data does not flow.** Submissions do not land in the ERP or Xero. There is no linkage to Job,
  Worker, Asset, or Client; no expiry alerting on tickets; no audit trail; and re-keying is manual.
- **Credentials are captured, not registered.** The Employee Credentials form holds ticket types and
  **expiry dates** as flat submissions — not a live register. That means the data cannot drive
  scheduler eligibility ("fit-the-bill") or WHS compliance alerts. For an asbestos/demolition
  contractor, an expired Asbestos Supervisor or Demolition Supervisor ticket is a genuine compliance
  exposure, and today nothing watches those dates.

---

## 3. Gap analysis — Jotform vs the ERP

| Jotform capture | Real business object | ERP status today | Gap / recommended action |
|---|---|---|---|
| Action Request — **Warehouse/Logistics (73% of use)** | Internal stock/delivery request | Procurement partly built; no field logistics-request intake | Build a field **site-request** intake → logistics/delivery task, linked to Job. |
| Action Request — **Purchase Request** (~11%) | Procurement requisition | requisition→PO (`issuePurchaseOrder`) exists | Route field purchase requests into a requisition; retire this branch. |
| Action Request / Tool Report — **Damage/Fault/Repair/Test&Tag** | Asset incident + maintenance / inspection record | Assets module in flight (#595 capacity/fuel) | Add **asset incident + maintenance/test&tag** records with photo upload and due-date scheduling. |
| **Key Checkout** | Asset custody / sign-out log | none | Build **asset custody** (issue/return, e-acknowledgment). |
| **Employee Credentials** | Worker competency/ticket register with **expiry** | WorkerProfile exists; ticket register partial | Build a **ticket/licence register with expiry alerts** feeding scheduler eligibility + WHS. *Highest single-value item.* |
| **Upload Documents / New Employee App** | Onboarding checklist + document store | HR-leave self-service staged; onboarding not | Build an **onboarding checklist** with a SharePoint-backed doc store + acknowledgments. |
| **Redcliffe Booking** (Request/Form) | Waste order / job booking | R3 waste engine + waste-plant moat adjacent | **Decision:** Redcliffe as an ERP customer-portal module vs. remaining a separate business. Near-term: ingest bookings. |
| **Credit account applications** | Customer credit onboarding + terms | Client entity exists; credit-terms model not | Build a **customer credit application** (AccountApplication + credit terms, e-sign, ID upload). |

### Two framing principles

**(a) The ERP should own the DATA; a form is just a capture surface.** The biggest wins are turning
the credential forms into a **live register with expiry alerting** (safety-critical) and turning
field requests into **ERP transactions linked to Job / Asset / Worker** (no re-keying, full audit).

**(b) Do not kill Jotform for external customer forms overnight.** The waste-business booking and
credit applications are genuinely external-facing, and Jotform does them well (e-sign, legal T&Cs,
payment capture). The ERP-native replacement is a Power-Pages-style external portal — a larger
build. **Near-term bridge:** wire Jotform webhooks / REST into an ERP ingestion endpoint so the
high-volume forms (Booking 221, Action Request 455) land structured data in Client/Job even before
the forms themselves are replaced.

---

## 4. Where to improve — two horizons

**Near-term (stay on Jotform, low effort):**

- Finish splitting the overloaded Action Request into task-scoped forms (the Tool Report split is
  the right instinct).
- Prefill Name / Job Number from a lookup to kill typos that make submissions un-joinable to ERP data.
- Enforce required-field + date-format validation on ticket **expiry** fields.
- Governance pass: archive the 0-submission drafts/clones, apply a naming convention, assign one owner.
- Wire webhooks → ERP ingestion for the two high-volume forms so the data stops dying in Jotform.

**Structural (the ERP build) — and this is the bridge to the D365 homework:** what Initial Services
is hand-building in Jotform is precisely **Dynamics 365 Field Service "Inspections"** — drag-and-drop
digital forms bound to a **work order** and a **customer asset**, offline-capable on mobile,
versioned, and stored as queryable data (Microsoft can even auto-generate an inspection template
from an uploaded PDF). The ERP answer is **not** "buy Field Service"; it is to build a **lightweight
work-order + inspection/form engine** on top of the assets and worker spine, so that:

- field forms (tool reports, site requests, inspections, credential capture) live **in-app**, linked
  to Job / Asset / Worker;
- submissions are **structured, queryable data** with an audit trail — not PDFs;
- **ticket expiries and test&tag dates raise alerts** and gate scheduling; and
- customer-facing capture (booking, credit apps) moves to an external portal when that build is ready.

That single spine closes most of the forms gap **and** is the largest missing piece versus D365 (see
the companion doc `d365-m365-gap-analysis-v2.md`, Tier A item 1).

---

## 5. Suggested sequence (for discussion, not staged)

1. **Worker ticket/competency register + expiry alerts** — safety-critical, feeds the scheduler, small.
2. **Asset incident + maintenance/test&tag + custody** — rides on the assets module already in flight.
3. **Field request intake** (logistics + purchase) → ERP transactions; retire those Action Request branches.
4. **Onboarding checklist + SharePoint doc store** — replaces Upload Documents Portal.
5. **Jotform → ERP ingestion webhook** for Booking + Action Request (bridge, do this early — cheap, high value).
6. **Work-order + inspection engine** — the unifying spine; then migrate remaining field forms.
7. **External customer portal** (booking, credit application) — largest build; decide Redcliffe scope first.

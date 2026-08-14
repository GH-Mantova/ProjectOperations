# CRM + Tendering navigation & IA re-model — SLICE-0 plan

**Status:** PLAN (slice-0). Authored 2026-08-14 by PR Master with Marco.
**Owner:** Marco.
**Area:** `apps/web/src/components/ShellLayout.tsx`, `apps/web/src/App.tsx`,
`apps/web/src/pages/crm/**`, `apps/web/src/pages/tendering/**`, redirects, e2e specs.
**Rule:** every code slice chains behind this doc (`requires_file_on_main`). Slices ship
independently, ≤ ~10 files, each CI-green. This is **navigation / IA only** — no transactional
logic changes except the explicit *view relocations* named below.

---

## 1. Why — the surfacing gap
The CRM module **backend + pages already shipped** (Account `#1055`, comms `#1064`, email-log
`#1068`, pipeline `#1065`, lead-intake `#1059`; pages `AccountDetailPage`, `CommsHubPage`,
`PipelineDashboardPage`, `LeadsTriageList`, `OpportunityDetailPage`, `CrmBoardPage`,
`crm-api.ts`). But there is **no cohesive CRM nav** — `App.tsx` says *"CRM lives ONLY as a tab on
the Tenders page; /crm is dead and falls through to NotFoundPage."* So the module is built but not
navigable. This plan surfaces it and rebalances the Tendering ↔ CRM split.

## 2. Marco's locked decisions (2026-08-14)
1. Rename top-level nav group **"Estimating" → "Tendering"** (Tender == estimating work).
2. New top-level **"CRM"** group, positioned **between Tendering and Projects**.
3. **Tendering** children (a left→right funnel): **Leads & opportunities** → **Tenders**
   (draft + pricing) → **Pipeline** (driving force) → Schedule of Rates → Contracts → Reports.
4. **CRM** children: **Accounts** (Client-360), **Tenders register**, **Comms hub**.
5. **Leads & Opportunities lives under Tendering** — promoting an opportunity (existing `#788`
   "generate draft tender") moves it out of L&O and into a Tender **Draft**.
6. **Pipeline stays under Tendering** — Draft→Estimating→Submitted; **Submitted** and
   **confirmed-Withdrawn** exit the Pipeline to the CRM **Tenders register**.
7. **Directory folds into CRM/Accounts** (clients become the Accounts surface); Subcontractor /
   Supplier move to **Procurement** — owned by the **site-dissolution plan**, not duplicated here.
8. CRM has **no separate "Leads & opportunities" tab** — client tender activity surfaces inside
   Account-360 roll-ups + the register.

## 3. Reconciliation (do NOT re-plan these)
- **tender-pipeline-register brainstorm** (`docs/architecture/drafts/tender-pipeline-register-plan.md`):
  one tender `status`, three *views*. Pipeline (Tendering) and CRM-lens/Register (CRM) are those
  views. The **withdrawn-review + exit-to-register lifecycle** is a **tender-lifecycle slice**
  (companion prompt `pr-tender-withdrawn-review-*`), NOT this nav plan.
- **site-dissolution plan** (`docs/plans/site-dissolution-plan.md`): owns Directory→Clients rename +
  Subcontractor/Supplier→Procurement. This plan only *surfaces* clients as CRM Accounts and adds
  redirects; the decommission stays there.

## 4. Ground truth (origin/main, verified 2026-08-14)
- `ShellLayout.tsx` groups: **"Estimating"** (`id:estimating`, L170) children Tenders/Contracts/
  Directory/Schedule of Rates/Reports; **"Projects"** (L223) children Jobs/Sites; then Operations/
  HR/Safety & Compliance/Settings.
- `App.tsx`: routes `/crm/opportunities/:id`, `/crm/accounts/:id`, `/crm/pipeline`, `/crm/comms`
  exist; `/crm` is dead; the CRM board is a tab on the Tenders page (`#789`/`#841`).
- CRM pages: `AccountDetailPage` is **detail only — there is NO Accounts index page yet**.

## 5. Slices (ordered; each ≤ ~10 files, `escalates:false` unless noted)

### NAV-1 — Tendering rename + CRM group shell  *(nav shell)*
- `ShellLayout.tsx`: rename group **Estimating → Tendering**; set children order = Leads &
  opportunities, Tenders, Pipeline, Schedule of Rates, Contracts, Reports; insert a new top-level
  **CRM** group **between Tendering and Projects** with items Accounts (`/crm/accounts`), Tenders
  register (`/crm/register`), Comms hub (`/crm/comms`), each `requiresPermission`.
- `App.tsx`: register `/crm` index → redirect to `/crm/accounts`; keep existing detail routes; add a
  `/crm/register` route placeholder (page lands in NAV-3).
- Update `ShellLayout.nav.test.ts` + `batch1-auth-shell.spec.ts`.
- **Requires:** this plan on main.

### NAV-2 — Accounts index (Client-360 landing)  *(the one genuinely-new page)*
- New `apps/web/src/pages/crm/AccountsListPage.tsx` at `/crm/accounts` — a list of accounts (name,
  type, lifecycle, win rate, open opps, last contact, going-cold flag) linking to the shipped
  `AccountDetailPage`. Consume the CRM-1 accounts API; add a **read-only list endpoint** to
  `accounts.service.ts`/`controller.ts` only if one does not already exist (no schema change).
- **Requires:** NAV-1 + CRM-1 `accounts.service.ts` (on main).

### NAV-3 — Relocate Leads & Opportunities + Tenders register  *(view moves + redirects)*
- Move the leads-collapse **Leads & opportunities** surface from the Tenders-page tab to its own
  route under **Tendering**; remove that tab from the Tenders page (Tenders page = draft entry +
  pricing + Pipeline).
- Surface the **Tenders register** (read-only, all tenders, all statuses; CLIENT + STATUS columns)
  at `/crm/register`.
- Add `Navigate` redirects from the old Tenders-tab URLs. Update `batch2-tendering` / `batch8` e2e.
- **Requires:** NAV-1.

### NAV-4 — Comms hub nav + dead-route cleanup  *(redirects)*
- Wire **Comms hub** into the CRM nav (route already exists). Add redirects: dead `/crm` →
  `/crm/accounts`; light redirect of the old directory/clients entry → `/crm/accounts` (the deep
  Directory decommission is owned by site-dissolution, referenced not duplicated).
- **Requires:** NAV-1.

### NAV-5 — sot/01 §9 nav-IA doc reconcile  *(docs-only, sot-keeper)*
- Reconcile `sot/01-charter-and-architecture.md` §9 (nav / IA) to the shipped structure. Docs-only,
  never mixed with code (CP-24 sot-purity gate). **Requires:** NAV-1..4 merged.

## 6. Out of scope
- Directory / Subcontractor / Supplier decommission (site-dissolution owns it).
- Tender **withdrawn-review + exit-to-register** lifecycle (separate tender-lifecycle slice).
- Any transactional/business logic — this is nav/IA + one read-only index page.

## 7. Chain map
`NAV-1` requires this plan · `NAV-2/3/4` require `NAV-1` (NAV-2 also CRM-1) · `NAV-5` requires
`NAV-1..4`. No `requires_merged`, no guessed PR numbers.

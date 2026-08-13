# Tender Pipeline & Register — lifecycle re-model + fixes

**Type:** SLICE-0 plan / design draft (for review — not yet staged to run).
**Owner:** Marco. **Area:** `apps/web/src/pages/tendering/*`, `apps/api/src/modules/tendering/*`, the new CRM module.
**Origin:** two reported bugs at 534 tenders (post estimating-tracker migration) that opened into a lifecycle re-model.

---

## 1. The model — one status, three lenses
A tender has **one `status`** at a time. "Pipeline", "CRM" and "Register" are not three places a tender lives — they are three views (filters) over that one status. This is already how the code is built, so most of this is view logic, not data migration.

| | 1 · Draft & Estimating | 2 · Submitted / Withdrawn | 3 · Awarded | 4 · Contract / Lost | 5 · Converted |
|---|---|---|---|---|---|
| **Tender status** (the board) | DRAFT, ESTIMATING | SUBMITTED *or* WITHDRAWN | AWARDED | CONTRACT *or* LOST | CONVERTED |
| **Per client** (`TenderClient`) | Add each tenderer (list at the bottom of the tender); set bid status PRICED / NO_BID / WATCHING; price PRICED clients' packages | Record `submissionDate` per PRICED client | Mark `isAwarded` on the one winner (even a WATCHING/NO_BID client); if winner was WATCHING → add a price now, same tender | On the awarded client we won: set `contractIssued`; else tender is LOST | `jobConversion` links the won client to the new Project/Job |
| **Shows in** | Pipeline · Register | SUB → Pipeline · CRM · Register; WD → Pipeline · Register | CRM · Register | Register (exits CRM) | Register |
| **Advances when** | Priced ≥1 client & lodged → Submitted; pursue none → Withdrawn | A winner is marked (`isAwarded`) → Awarded | We're issued the contract → Contract; we miss out → Lost | Contract converted → Converted | terminal |

**Areas defined:**
- **Pipeline** = the submission board. Only four columns: DRAFT, ESTIMATING, SUBMITTED, WITHDRAWN. Its job is to drive tenders to submission. Outcome statuses are NOT board columns.
- **CRM** = active-pursuit lens: SUBMITTED and AWARDED, until CONTRACT or LOST. **This is the NEW CRM being built via the CRM PR series (Account / Client-360 / leads-collapse) — NOT the legacy "+New Lead / +New Opportunity", which is being retired.**
- **Register** = archive: every tender, every status, always. One row per tender; the CLIENT column shows the primary/awarded client; the STATUS column shows the tender status.

## 2. Two tracks, one governing rule
- **Tender status track** = what the board/CRM/Register show (single value per tender; the detail-page dropdown keeps all statuses).
- **Per-client outcome track** = one `TenderClient` row per tendering party.
- **Governing rule:** a per-client action drives the tender status, so the views can never disagree (e.g. marking a client `contractIssued` advances the tender to CONTRACT).
- **One winner per tender** (confirmed): exactly one client gets `isAwarded`, at most one `contractIssued`. Outcome falls straight out of that single winner. Win/loss and Convert act on that one client. UI picks the winner as a single (radio-style) selection; enforce "at most one awarded/contract-issued per tender."

## 3. Withdrawn vs No-Bid (confirmed)
Two different levels, and they don't overlap: **WITHDRAWN** is the *tender-level* "we're not pursuing this at all." **NO_BID** is only ever a *per-client* skip on a tender we ARE pursuing (some priced, some watching). "All clients NO_BID" never happens — that situation is exactly what Withdrawn is for.

## 4. Per-client model (`TenderClient`)
**Already in the schema:** `clientId`, `contactId`, `isAwarded`, `contractIssued`(+`At`), `submissionDate`, `relationshipType`, `clientPackages`, `jobConversion`; plus `TenderOutcome` (WON/LOST/NO_BID, reason incl. DECLINED_TO_BID, `competitorOrWinner`, per-client attribution).
**The one new field:** a per-client **bid status** — `PRICED` / `NO_BID` / `WATCHING`. Additive & nullable. Distinguishes "we chose not to price this one but we're tracking them" (WATCHING) from a priced bid — which is what makes the market-intel view possible.
**Where it lives:** the per-client bid status + contact are managed in the **client list at the bottom of the tender detail** (one row per tenderer). The register does NOT get a bid-status column — its STATUS stays the tender status.

## 5. Client & contact capture at tender stage (lightweight)
Tender-stage capture is deliberately lighter than contract stage. Capture only:
- **Client name** — type-ahead against the existing Client list; optimise for **not duplicating** a client under a slightly different spelling. Pick existing or deliberately create new. (→ `TenderClient.clientId`.)
- **Contact** — name, email, phone (phone optional) — type-ahead against existing Contacts, but **collision-safe**: never auto-match on name alone (people share names). The suggester shows name **plus** distinguishing detail (email / phone / which client), and when creating a contact whose name already exists it warns "there's already a *Jane Smith* at *ClientCo* — reuse or create new?" so the user consciously picks rather than silently merges or duplicates. (→ `TenderClient.contactId`.)
- **Draft is allowed with no clients, but nudged:** a Draft/Estimating tender with no tenderers (or a client missing a contact) shows a soft "add the known tenderers + contacts" prompt / incomplete indicator — never a hard gate.

## 6. Market intelligence (the payoff)
Because `isAwarded` is marked on **every** tendering party (including WATCHING/NO_BID), we get per-client, across all tenders: **head-contract win-rate weighted by project heat/value**, split by priced vs watch-only — surfacing a **WATCHING client winning hot work** as a signal to start pricing them. Separate from *our* win-rate (priced clients only). Reuses the win/loss reporting already shipped; lands in CRM Client-360.

## 7. What already exists (grounding)
- **Frontend** `TenderingPage.tsx`: one shared `filters` state + one `/tenders` fetch **hard-capped at pageSize 100** (line ~395) feeds both views → the render + filter-bleed bugs. Header `$`/win-rate stats also computed from the capped ≤100 rows.
- **API**: the shared `PaginationQueryDto` **caps `pageSize`/`limit` at `@Max(100)`** — so the frontend cannot just ask for 534; the no-API-change render fix is **client-side loop-pagination**. Server-side sort is already wired.
- **Statuses today**: DRAFT, IN_PROGRESS(=Estimating), SUBMITTED, AWARDED, CONTRACT_ISSUED(=Contract), LOST, WITHDRAWN, CONVERTED (detail dropdown carries all but CONVERTED).

## 8. Sliced delivery plan (smallest visible pain first)
1. **Pipeline + Register fix** — *frontend only, no schema.* 4-stage submission board (DRAFT/ESTIMATING/SUBMITTED/WITHDRAWN); **independent per-view filters** (Pipeline vs Register each own their filter state + bar); **full-dataset render** via client-side loop-pagination (fixes kanban + the header stats). Ships the reported bugs and the board half of the model.
2. **Per-client bid status + capture UX** — *additive schema (escalates).* Add `TenderClient.bidStatus` (PRICED/NO_BID/WATCHING); the client type-ahead (dedup) + collision-safe contact picker in the tender's client list; the soft Draft nudge.
3. **Status ↔ per-client seam** — per-client actions drive tender status; enforce the one-winner rule (single `isAwarded`/`contractIssued`).
4. **CRM lens** — tenders surfacing as active opportunities (Submitted & Awarded) against the client Account in the **new CRM**. Ground against the CRM PR series first; do NOT wire to the legacy Lead/Opportunity.
5. **Market-intel view** — the "who should we start pricing?" client-performance report.

*Dependencies:* 2 before 3; 4 waits on the CRM series; 5 after 2 (needs bidStatus). Slices 2 and 3 touch schema → `escalates: true`.

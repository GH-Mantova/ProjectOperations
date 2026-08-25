# CRM module plan - Account spine + relationship + comms hub + pipeline intelligence

Status: PLAN (slice-0). Authored 2026-08-12 for Marco's ProjectOperations ERP.
This plan organises the CRM as the ERP's organising source of truth, layered OVER the
existing transactional spine. It defines the ownership matrix and six ordered, self-driving
slices (CRM-1..CRM-6). No product code lands in slice-0 - this document plus the chained
slice prompts under `docs/pr-prompts/pr-crm-s<N>-*-ready.md` only.

This EXTENDS what is already on main. It does NOT rebuild Client / Contact / Tender / Job /
Contract, it wraps and rolls them up. Closest reference models are AEC bid-management CRMs
(Followup CRM, Unanet/Cosential, BuildingConnected, Procore) - NOT a generic sales CRM.

## Ground truth (cited file:line against origin/main)

Transactional spine and adjacent facts, from `apps/api/prisma/schema.prisma`:

- `model Client`        - schema.prisma:673  (org identity: name, code, abn/acn, addresses;
  win/loss roll-up cache winCount:719, tenderCount:720, winRate:721, lastTenderAt:722,
  lastWonAt:723). This is the identity home the Account WRAPS.
- `model Contact`       - schema.prisma:755  (polymorphic organisationType/organisationId,
  role, isPrimary). The relationship layer CRM-2 links under Account.
- `model Tender`        - schema.prisma:1099 (price/scope/outcome owner).
- `model TenderOutcome` - schema.prisma:1362 (win/loss capture WL-1a/1b/WL-2: resultType,
  reason, tenderValue, ourPrice, competitorOrWinner). enum TenderOutcomeResult:1343,
  enum TenderOutcomeReason:1349. Read-only roll-up source for the CRM-6 dashboard.
- `model Job`           - schema.prisma:1409 (execution/status owner).
- `model Contract`      - schema.prisma:3884 (terms/claims owner; archive pattern
  archivedAt:3898 reusing JobCloseout.archivedAt:1639).
- `model Lead`          - schema.prisma:6390 and `model Opportunity` - schema.prisma:6429
  (won/lost, wonAt, lostAt, lostReason). enum LeadStatus:6365, OpportunityStage:6373,
  OpportunitySource:6381. The leads-collapse foundation CRM-3 extends.

Modules and seams:

- `apps/api/src/modules/master-data/**` (master-data.service.ts, master-data.controller.ts,
  client-stats.service.ts) - the Client/Contact identity home the Account wraps.
- `apps/api/src/modules/tendering|jobs|contracts/**` - the transactional owners rolled up
  read-only into the CRM.
- Archive + super-user-delete + in-use-guard pattern - Contract.archivedAt (schema.prisma:3898)
  + super-user tier gate `apps/api/src/modules/admin-users/admin-users.service.ts:16-17`
  (`tierOf`/`isSuperUser`). Reuse target for Account archive.
- `apps/api/src/modules/email/**` (email.service.ts, email-provider.interface.ts,
  email.module.ts) - the existing M365 / Microsoft Graph seam CRM-5 reuses WITHOUT touching
  Azure/Entra/SharePoint config.
- `apps/api/src/modules/crm/**` (crm.service.ts, crm.controller.ts, crm.module.ts) and the
  leads-collapse plan `docs/plans/crm-leads-collapse-plan.md` with slices
  `docs/pr-prompts/pr-crm-leads-s1..s6-*-ready.md` - what CRM-3 extends. Do NOT rework it.
- `scripts/data-model/build-relationship-map.mjs` - the data-model map generator every
  schema-touching slice must run and commit.

## Marco's locked decisions (2026-08-12) - bake in, do NOT re-litigate

> **SUPERSEDED IN PART — Marco, 2026-08-20.** Decision 2's ownership matrix stands for *writes*:
> the CRM still never edits a transactional fact. What no longer stands is the implication that the
> CRM is therefore the **thinner** surface. Marco: *"the CRM page should be much richer than the
> Tendering."* The CRM is where a tender's life continues after submission — follow-ups, chasing,
> relationship context — so its tender views may carry more capability than the Tendering register,
> not less. Read-only-on-writes and richer-in-view are not in conflict; the 2026-08-12 wording
> conflated them. The 2026-08-12 rules below are preserved in full so the history stays readable;
> the lines corrected by this supersession are annotated inline.

1. **CRM is the organising source of truth**, layered over the transactional spine - NOT a
   generic sales CRM. Closest models are AEC bid-management CRMs (Followup CRM,
   Unanet/Cosential, BuildingConnected, Procore).
2. **One home per fact - governed push/pull, NEVER free two-way sync** (same anti-drift rule
   as the rates program). Ownership matrix:
   - **CRM owns** (and pushes down): the organisation/relationship layer, contacts +
     relationship graph, lead/opportunity state, activities/tasks, and all communications.
   - **Transactional modules own** (and roll UP read-only into the CRM): Tender =
     price/scope/outcome; Job = execution/status; Contract = terms/claims. CRM references +
     surfaces these; never copies/edits them.
   - Org identity (name/ABN) stays homed on `Client` for now; the Account WRAPS it (see 3).
3. **Account spine, wrap-then-absorb (Option B).** New `Account` = CRM core entity for any
   organisation across its whole lifecycle (PROSPECT -> ACTIVE client -> PAST ->
   head-contractor-we-subcontract-under). It holds a **1:1 optional `clientId` FK to the
   existing `Client`**; `Client` stays the identity record and is backfilled 1:1 into
   Accounts. FULL absorption of Client identity (directory becomes a CRM surface) is the
   declared DESTINATION but is **explicitly deferred** - do NOT do that migration in this
   program.
4. **Comms: unified in UX, decoupled in code.** The internal communicator (Teams-style
   threads + To-Do) and email integration live inside the CRM experience but as a
   **self-contained sub-module** (own models + service boundary) so it can branch into its
   own product later without unpicking the CRM.
5. **Leads-collapse lands first** as the triage foundation; the CRM lead slice EXTENDS it
   (multi-source capture + Account linkage). No rework of the leads-collapse.
6. **Real client/tender data** (Marco's uploaded list) backfills Accounts once the Account
   foundation lands. Real-data backfill is deferred to after CRM-1.

## Ownership matrix (one canonical home per fact)

| Fact / domain                         | Canonical owner        | CRM relationship        |
|---------------------------------------|------------------------|-------------------------|
| Organisation / account lifecycle      | CRM (`Account`)        | owns, pushes down       |
| Org legal identity (name, ABN, ACN)   | `Client` (directory)   | Account wraps 1:1 (FK)  |
| Contacts + relationship graph         | CRM                    | owns                    |
| Lead / opportunity state              | CRM (leads-collapse)   | owns                    |
| Activities / tasks / to-dos           | CRM (comms sub-module) | owns                    |
| Communications (threads + email)      | CRM (comms sub-module) | owns                    |
| Tender price / scope / outcome        | Tendering (`Tender`)   | read-only on writes; CRM view may be richer (2026-08-20) |
| Job execution / status                | Jobs (`Job`)           | read-only on writes     |
| Contract terms / claims               | Contracts (`Contract`) | read-only on writes     |

Rule of the matrix: **transactional facts are read-only with respect to writes in the CRM
(the CRM never edits price, scope, or outcome); the Account WRAPS Client (never a second
identity copy); comms stays a decoupled sub-module.** No fact is edited in two places. The
CRM pulls transactional facts for display and pushes down organisation/relationship context;
it never writes into the transactional owners. *(Superseded in part 2026-08-20: read-only on
writes does NOT mean the CRM is the thinner surface — its tender views may carry more
capability than the Tendering register. See supersession note above.)*

## The six ordered slices (each <= ~10 files, keep this order)

### CRM-1 (S1) - Account foundation + Client-360 view
New `Account` (1:1 optional `clientId` FK to Client, `lifecycleStatus`
PROSPECT/ACTIVE/PAST, `accountType`, `source`, `owner`) + additive migration + **backfill one
Account per existing Client**. The client-360 page aggregates the Account's contacts +
**read-only roll-ups** (tenders/jobs/contracts). Schema -> `escalates: true`,
`gate_allow: migrations`. The spine everything hangs off.
- Primary new artifact: `apps/api/src/modules/crm/accounts/accounts.service.ts` + `model
  Account` in `apps/api/prisma/schema.prisma`.
- Prompt: `docs/pr-prompts/pr-crm-s1-account-foundation-ready.md`.

### CRM-2 (S2) - Relationship intelligence
Contacts linked under Account (role, isPrimary, `lastContactedAt`), relationship
notes/history (`model RelationshipNote`), "going cold" nudge + repeat-business surfacing
(derived). Schema -> `escalates: true`, `gate_allow: migrations`.
- Primary new artifact: `apps/api/src/modules/crm/relationships/relationships.service.ts`.
- Requires on main: `apps/api/src/modules/crm/accounts/accounts.service.ts` (CRM-1).

### CRM-3 (S3) - Lead front door (EXTENDS leads-collapse)
Multi-source capture (email/phone/portal/referral), triage -> Tender Draft / don't-pursue
structured reason, lead<->Account link (auto-create PROSPECT Account via additive `accountId`
FK on Lead/Opportunity). Gated on leads-collapse landing AND CRM-1. Changes schema ->
`escalates: true`, `gate_allow: migrations`.
- Primary new artifact: `apps/api/src/modules/crm/lead-intake/lead-intake.service.ts`.
- Requires on main: `apps/api/src/modules/crm/accounts/accounts.service.ts` (CRM-1) AND
  `docs/plans/crm-leads-collapse-plan.md` (leads-collapse artifact already on main).

### CRM-4 (S4) - Comms hub: internal threads + To-Do (decoupled sub-module)
`CommThread` / `CommMessage` / `CommTask` models with a **polymorphic link** to
Account/Tender/Job/Contract, @mention, assignment, due date. Ships WITHOUT Azure. Schema ->
`escalates: true`, `gate_allow: migrations`. Own models + service boundary so it can branch
into its own product later.
- Primary new artifact: `apps/api/src/modules/crm/comms/comms.service.ts`.
- Requires on main: `apps/api/src/modules/crm/accounts/accounts.service.ts` (CRM-1).

### CRM-5 (S5) - Comms hub: email integration
Outlook email auto-logged against Account/Tender via the EXISTING M365 / Graph seam only
(`apps/api/src/modules/email/**`), persisted through an additive `EmailLog` link model.
WARNING: depends on Marco's Azure/Entra/M365 provisioning (the one hard-stop) - do NOT
create/modify any Azure/Entra/SharePoint config. Schema -> `escalates: true`,
`gate_allow: migrations`, and the merge holds for Marco.
- Primary new artifact: `apps/api/src/modules/crm/comms/email-log.service.ts`.
- Requires on main: `apps/api/src/modules/crm/comms/comms.service.ts` (CRM-4).

### CRM-6 (S6) - Pipeline + win/loss dashboard
Pipeline by stage, win rate by client/sector/source/estimator, stalled-opportunity flags,
relationship coverage - read/aggregation over the existing win/loss capture
(`TenderOutcome` schema.prisma:1362, `Opportunity` won/lost fields) + Account roll-ups.
Read-only, no schema change. Non-escalating -> `escalates: false`, `gate_allow: none`.
- Primary new artifact: `apps/api/src/modules/crm/pipeline/pipeline-dashboard.service.ts`.
- Requires on main: `apps/api/src/modules/crm/accounts/accounts.service.ts` (CRM-1).

## Chain map (produces -> requires - a rooted DAG, no broken links)

Root: `docs/plans/crm-module-plan.md` lands on main via THIS slice-0 PR.

- CRM-1  requires `docs/plans/crm-module-plan.md` (on main after slice-0)
         produces `apps/api/src/modules/crm/accounts/accounts.service.ts` + `model Account`
- CRM-2  requires `apps/api/src/modules/crm/accounts/accounts.service.ts` (CRM-1)
         produces `apps/api/src/modules/crm/relationships/relationships.service.ts`
- CRM-3  requires `apps/api/src/modules/crm/accounts/accounts.service.ts` (CRM-1)
         AND `docs/plans/crm-leads-collapse-plan.md` (leads-collapse, on main)
         produces `apps/api/src/modules/crm/lead-intake/lead-intake.service.ts`
- CRM-4  requires `apps/api/src/modules/crm/accounts/accounts.service.ts` (CRM-1)
         produces `apps/api/src/modules/crm/comms/comms.service.ts`
- CRM-5  requires `apps/api/src/modules/crm/comms/comms.service.ts` (CRM-4)
         produces `apps/api/src/modules/crm/comms/email-log.service.ts`
- CRM-6  requires `apps/api/src/modules/crm/accounts/accounts.service.ts` (CRM-1)
         produces `apps/api/src/modules/crm/pipeline/pipeline-dashboard.service.ts`

Every `requires_file_on_main` names a NEW file its predecessor creates (or a file already on
main); the DAG roots at slice-0's plan doc. No `requires_merged`, no invented PR numbers.

## Do NOT (program-wide)

- Do NOT rebuild `Client`/`Contact`/`Tender`/`Job`/`Contract` - wrap and roll them up.
- Do NOT copy transactional facts into the CRM (roll-ups are read-only).
- Do NOT create a second identity record - Account wraps Client 1:1.
- Do NOT do the Client->Account absorption migration (deferred).
- Do NOT touch Azure/Entra/SharePoint config (CRM-5 reuses the existing Graph seam only).
- Do NOT edit `/sot/`. Do NOT use `requires_merged` with guessed PR numbers.

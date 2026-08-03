---
premise: '! test -f docs/plans/site-dissolution-plan.md'
premise_means: No plan exists yet to dissolve the Site entity (physical layer into Job, commercial layer into Client) and rename Directory to Clients; Site is still a first-class module and every Tender/Job/Project carries a NOT-NULL siteId.
scope:
  - docs/plans/**
done_when: pnpm build && pnpm lint && test -f docs/plans/site-dissolution-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: true
---

# SLICE-0 plan: dissolve Site — physical layer → Job, commercial layer → Client; Directory → Clients

Author `docs/plans/site-dissolution-plan.md` (house style of docs/plans/settings-restructure-plan.md).
Plan document ONLY — this is a schema + IA program; nothing irreversible in this PR.

## Marco's ruling (2026-08-02) — the locked shape
- **Site the entity dissolves.** Each job is its own worksite (confirmed: no meaningful "one physical
  place hosts many jobs" case), so Site's **physical/operational layer folds 1:1 into Job**, and Job
  manages all of it: worksite address + `centreLat/centreLng`, `SiteGeofence`, `SiteAttendance`
  (site sign-in), `MusterEvent` (+ `MusterAttendee`), `DailyDiary`, `AssetCheckout` site holder,
  `FormSubmission` site link, and the timesheet clock-on/off geofence relations.
- **Commercial layer folds into Client**: `Tender` and `Project` reference/group under **Client** —
  group tenders by Client, not Site.
- **Directory → renamed "Clients," clients-ONLY.** `Subcontractor` and `Supplier` (the other arms of
  the Unified Contact model, PR #75) **move out** to their own home — propose Procurement/Operations
  and RECONCILE with `docs/plans/assets-equipment-tabs-plan.md` (which already touches Procurement).
- **Add a client portfolio view** (a Client's tenders / projects / jobs in one place); the operational
  jobs list/board STAYS. Jobs-by-client is additive, not a move.
- **Site is removed as a standalone nav destination.**

## Ground first (cite file:line; positive controls before trusting a negative)
1. `model Site` (schema ~767) and EVERY `siteId` / Site relation — enumerate each and classify it
   Job-bound vs Client-bound vs inline-address: Tender (~1091, `siteId NOT NULL onDelete: Restrict`),
   Job (~1359, NOT NULL Restrict), Project, FormSubmission (~1912), AssetCheckout (~1027),
   DailyDiary (~2672), SiteGeofence (~807), SiteAttendance (~6362), MusterEvent (~6407), the
   SharePoint drive-item uniques (~409/433), and refs at ~2067/2605. Miss none.
2. The NOT-NULL `siteId` guard + its "Unassigned" system placeholder site
   (`migrations/20260717120000_tender_siteid_not_null`) — the dissolution must unwind this safely.
3. The Directory / Unified Contact model (Client/Subcontractor/Supplier, PR #75) + nav
   (`ShellLayout.tsx`), and the Sites module (`modules/sites`, master-data `listSites`, SitesListPage).
4. `docs/plans/model-merge-plan.md` (Job↔Project merge) — **HARD dependency**: "linked projects" only
   resolves once Job/Project are one. Also `sot/01` Job spine + §9 nav (definitive) + `sot/04`.

## The plan must decide/cover
1. **Reference redistribution table** — for every `siteId`, where it goes (Job FK / Client FK / inline
   address fields) and the migration to move it, preserving data.
2. **Site→Job physical fold** — move geofence/attendance/muster/diary/asset-checkout/form FKs to
   `jobId`; carry the worksite address + coordinates onto Job. Note WHS/compliance: geofence,
   attendance and muster are **append-only compliance state** (sot/01 movement rule) — the plan must
   preserve the audit trail across the move, not rewrite history.
3. **Site→Client commercial fold** — Tender/Project group under Client (they already carry a client);
   the client portfolio view; the tender register grouped by Client.
4. **Directory → Clients** rename (clients-only) + Subcontractor/Supplier rehome; the sidebar change
   lands via a dedicated **sot/01 §9 doc-reconcile slice** (never inline sot edits).
5. **Sequencing** — explicit `requires_merged` on the Job↔Project merge slices; interleave rather than
   fight them.
6. **Ordered slices** — each ≤ ~10 files; schema slices carry `gate_allow: migrations` +
   `rollback_strategy`; query-preserving redirects from dead `/sites` routes. Risks section: WHS
   audit-trail continuity, the NOT-NULL siteId placeholder unwind, dead links, and the Job↔Project
   collision.

## Do NOT
- Do NOT write schema/API/UI code in this slice — plan document only (`scope` is `docs/plans/**`).
- Do NOT edit `/sot/` here — the §9 nav change and the data-model change land via doc-reconcile slices.
- Do NOT propose discarding any compliance/WHS history (musters, attendance) — it moves, it is not lost.
- Do NOT require any Azure/Entra/SharePoint change to operate.

## VERIFY
- `pnpm build && pnpm lint`
- `test -f docs/plans/site-dissolution-plan.md`

## Merge gate (escalates: true)
This plan reshapes the core data model — Marco reviews the authored plan before it lands. Open the PR
and LEAVE IT UNMERGED; note it must carry `do-not-merge` for Marco.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if the plan already exists on main. Never ask
a question or "stand by" for approval. Read the CI job log before diagnosing any failure.

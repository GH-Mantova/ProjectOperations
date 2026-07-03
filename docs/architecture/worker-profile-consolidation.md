# Worker / WorkerProfile Consolidation — Survivor-Spine Design (B-P0b)

> **Status:** Design / analysis only. This document changes no schema, service,
> migration, or route. It is the proposed plan for collapsing the duplicated
> `Worker` and `WorkerProfile` staff entities into a single spine.
>
> **Survivor decision locked** (Master QA plan, WorkerProfile canonical);
> **section 7 decisions are NOT locked** — they are posed for Marco's review.
> **Scope owner:** WHS & Commercial Compliance.
> **Verified against:** `apps/api/prisma/schema.prisma` and the `workers` /
> `resources` / `master-data` / `scheduler` / `compliance` modules at commit
> `fae6f19` (`origin/main`). All line numbers below are from that tree.
> Companion doc: `docs/architecture/job-project-consolidation.md` (B-P0a).

---

## 1. Survivor + name decision

**`WorkerProfile` survives as the staff spine. `Worker` is folded into it and
retired.** This is locked per the Master QA plan — "P0b — Make `WorkerProfile`
canonical, fold `Worker` in" (`docs/qa/Master-QA-and-Consolidation-Program-Plan.md`
L189) — and the IA map's ownership table, which marks `WorkerProfile` as
"canonical per B-P0b" and freezes the legacy trio `Worker` / `WorkerCompetency`
/ `Crew` with "Do not add writers"
(`docs/architecture/module-ownership-ia-map.md` L70-71).

### Evidence (schema + service, this checkout)

- **The entire day-grain scheduler binds to `WorkerProfile`, not `Worker`.**
  `ScheduleAllocation.workerProfileId -> WorkerProfile` (schema L2158-2159) with
  the locked multi-role key `schedule_alloc_worker_uniq` (L2171). Choosing
  `Worker` would orphan the scheduler grid — the same argument that decided
  B-P0a for `Project`.
- **Range allocations, timesheets, and pre-starts bind to `WorkerProfile`.**
  `ProjectAllocation.workerProfileId` (L2115-2116),
  `PreStartChecklist.workerProfileId` (L2236-2237),
  `Timesheet.workerProfileId` (L2285-2286). None reference `Worker`.
- **The compliance layer binds to `WorkerProfile`.**
  `WorkerQualification.workerProfileId` (L3382-3383) carries qualType, licence,
  expiry, and document path — the effective-dated store the eligibility gate
  reads (`schedule-allocation.service.ts` L120-126).
- **Availability is already re-modelled on `WorkerProfile`.**
  `WorkerLeave` (L3504-3507) and `WorkerUnavailability` (L3526-3529) supersede
  the legacy `AvailabilityWindow` (which FKs `Worker`, L1202-1211).
- **Field experience and Gantt bind to `WorkerProfile`.**
  `WorkerLocationLog.workerProfileId` (L3548-3549);
  `GanttTask.assignedTo WorkerProfile?` (L3633).
- **Portal / login provisioning is `WorkerProfile`-native.**
  `WorkerProfile.internalUserId @unique -> User` (L2087-2088) plus
  `hasMobileAccess` (L2086); `workers.service.ts` provisions the field-worker
  login in a single transaction (`provisionMobileAccess`, L226-231). `Worker`
  has a parallel `userId @unique -> User` (L617, L629) — a link collision to
  reconcile (2.1).
- **`workers` module is the sole `WorkerProfile` writer** (create/update/soft
  delete — `workers.service.ts` L120, L152, L183), matching the IA map row
  (module-ownership-ia-map.md L71).

### What `Worker` uniquely contributes (must be preserved or consciously dropped)

- **Identity attributes with no `WorkerProfile` equivalent:**
  `employeeCode @unique` (L619), `employmentType` (L624), `notes` (L626), and
  the `resourceTypeId -> ResourceType` classification (L618, L630; back-relation
  `ResourceType.workers Worker[]` L550).
- **The normalised competency store:** `WorkerCompetency` (L704) joins `Worker`
  to `Competency` (L712-713, unique `[workerId, competencyId]` L715).
  `Competency` is also what `JobRoleRequirement` (L600-613) hangs off, so the
  *catalogue* survives regardless; only the worker-side join is legacy.
- **Crew membership:** `CrewWorker.workerId -> Worker` (L661, L665) under
  `Crew` (L644). The IA map defers Crew's fate to this doc
  (module-ownership-ia-map.md L374-375).
- **Legacy shift-board wiring:** `ShiftWorkerAssignment.workerId -> Worker`
  (L1165, L1169), `AvailabilityWindow` (L1202), `WorkerRoleSuitability` (L1218,
  unique `[workerId, roleLabel]` L1228) — all consumed only by the legacy
  scheduler (`scheduler.service.ts` L137, L206, L373, L552). See section 3.
- **Forms linkage:** `FormSubmission.workerId -> Worker` (L1449, L1462,
  index L1479).

### Current `Worker` readers/writers (all must be redirected before contract)

| Code site | Access | Notes |
|---|---|---|
| `master-data.service.ts` L371, L385, L405-406 | read + **write** (update/create) | The sole writer per IA map L70. |
| `resources.service.ts` L37, L97, L109 | read | Backs the `/resources` legacy page ("Workers (legacy)" breadcrumb — IA map L357-358). |
| `scheduler.service.ts` L206 (+ shift assignment paths L373, L447) | read + write via `ShiftWorkerAssignment` | Legacy shift board; retired with B-P0a-9. |
| `global-lists.service.ts` L267 | read | Dynamic-list proxy for workers. |

---

## 2. Field + relation inventory

### 2.1 Field collisions (exist on BOTH models)

| Field | On `Worker` | On `WorkerProfile` | Resolution |
|---|---|---|---|
| `firstName` / `lastName` | L620-621 | L2075-2076 | Same semantics -> keep `WorkerProfile`'s. On backfill, prefer the WorkerProfile value where a mapped pair disagrees (WorkerProfile is the HR record); log disagreements. |
| `email` | nullable, **not unique** (L622) | nullable, **`@unique`** (L2080) | **Constraint mismatch.** Two `Worker` rows may share an email; `WorkerProfile` forbids it. Backfill must dedupe before using email as a match key (see slice -2 and R2). |
| `phone` | L623 | L2079 | Direct copy where `WorkerProfile.phone` is null. |
| `status` (free string, default `"ACTIVE"`, L625) | — | `isActive Boolean` (L2089) | **Type collision.** Map `ACTIVE -> true`, everything else `-> false`, with the raw legacy value preserved in the migration report. Whether any non-ACTIVE value deserves richer semantics is **Q4** for Marco. |
| User link | `userId String? @unique` (L617), relation L629 | `internalUserId String? @unique` (L2087-2088) | **Link collision.** `User` carries both back-relations (`user.worker` L44, `user.workerProfile` L45). Backfill `internalUserId` from `Worker.userId` where the profile has no link. If both are set and disagree -> **Q7**. |
| `employmentType` (L624) vs `role` (L2078) | `Worker`-only | `WorkerProfile`-only | **Not the same thing** (employment basis vs trade role). Proposed: carry `employmentType` onto `WorkerProfile` as a new nullable column — **Q2**. |

### 2.2 `Worker`-only fields -> disposition

| Field (schema line) | Disposition on `WorkerProfile` |
|---|---|
| `employeeCode @unique` (L619) | **Move** as nullable-unique column (mirrors `Project.jobNumber` in B-P0a-1). Payroll-facing identity; must survive. |
| `employmentType` (L624) | **Move** as nullable column, pending Q2. |
| `notes` (L626) | **Move** as nullable column (no equivalent exists). |
| `resourceTypeId` (L618) | **Drop proposed** — `WorkerProfile.role` (L2078) + `JobRole` (L585) cover classification; `ResourceType` remains for `Asset` (L551). **Q3**. |

### 2.3 `Worker` relation inventory -> disposition

| Worker relation (schema line) | Target | Disposition |
|---|---|---|
| `user User?` (L629) | login | **Merge** into `internalUserId` per 2.1. Do not carry a second User FK. |
| `resourceType` (L630) | classification | **Drop** with the field, pending Q3. |
| `crewMemberships CrewWorker[]` (L631) | crews | **Decision needed (Q1).** Option A: re-point `CrewWorker.workerId -> workerProfileId` and keep `Crew` (L644) as a grouping tool. Option B: retire `Crew`/`CrewWorker` outright — IA map notes "minimal web usage (2 files)" (L374-375). |
| `competencies WorkerCompetency[]` (L632) | qualifications | **Merge into `WorkerQualification`.** The eligibility gate already compares `JobRoleRequirement -> competency.code` against `WorkerQualification.qualType` strings (`schedule-allocation.service.ts` L103-126), so converting each `WorkerCompetency` row to a `WorkerQualification` (`qualType = Competency.code`, `achievedAt -> issueDate`, `expiresAt -> expiryDate`, L708-709 -> L3387-3388) lands the data exactly where the gate reads it. Alternative (re-point the normalised join to WorkerProfile) is **Q5**. |
| `shiftAssignments ShiftWorkerAssignment[]` (L633) | legacy shifts | **Dies with the Shift cluster** (B-P0a-9). Do NOT move. See section 3. |
| `availabilityWindows AvailabilityWindow[]` (L634) | legacy availability | **Superseded** by `WorkerLeave` / `WorkerUnavailability` (L3504, L3526). Dies with the shift board; optional historical import is **Q8**. |
| `roleSuitabilities WorkerRoleSuitability[]` (L635) | legacy role fit | **Superseded** by `JobRole` + `JobRoleRequirement` + the computed eligibility gate. Dies with the shift board; no move. |
| `formSubmissions FormSubmission[]` (L636) | forms | **Re-point.** Add `FormSubmission.workerProfileId`, backfill from the -2 map, retire `workerId` (L1449, L1462) at contract. Coordinate with B-P0a-7, which touches the same table's `jobId`/`shiftId` edges (L1446, L1451). |

### 2.4 `WorkerProfile` relations that stay put (canonical)

`allocations` (L2093), `scheduleAllocations` (L2094), `preStartChecklists`
(L2095), `timesheets` (L2096), `qualifications` (L2097), `ganttTasks` (L2098),
`locationLogs` (L2099), `leaves` (L2100), `unavailabilities` (L2101),
`internalUser` (L2088). None move; the folded Worker data joins them.

---

## 3. The Shift-cluster interaction (B-P0a-9 boundary)

B-P0a section 4 retires the whole `Shift` cluster (`Shift` L1131,
`ShiftWorkerAssignment` L1162, `ShiftAssetAssignment` L1176,
`SchedulingConflict` L1189, `ShiftRoleRequirement` L1233) once
`ScheduleAllocation` covers its use. That decision cuts this consolidation's
work roughly in half. Explicitly:

**Dies with the Shift cluster — no migration to `WorkerProfile`:**

- `ShiftWorkerAssignment` (L1162-1174) — the only remaining structural
  dependency of any table on `Worker` once forms are re-pointed. Its
  `onDelete: Cascade` FK (L1169) means the `workers` table **cannot be dropped
  before B-P0a-9 lands** (or before ShiftWorkerAssignment is dropped early).
- `AvailabilityWindow` (L1202-1216) — read only by the legacy shift board's
  conflict check (`scheduler.service.ts` L552).
- `WorkerRoleSuitability` (L1218-1231) — legacy free-string role fit; the
  day-grain path uses `JobRole` FKs and computed eligibility instead.

**Must move (does NOT die with Shift):**

- `WorkerCompetency` -> merged into `WorkerQualification` (2.3). Although the
  shift board's `ShiftRoleRequirement` also references `Competency` (L579), the
  competency *data on workers* feeds the surviving eligibility gate and must
  not be lost when the cluster drops.
- `FormSubmission.workerId` -> `workerProfileId` (2.3). Forms outlive shifts;
  note `FormSubmission.shiftId` (L1451, L1464) itself dies with B-P0a-9 /
  B-P0a-7 coordination.
- `employeeCode` / `employmentType` / `notes` / User link -> onto
  `WorkerProfile` (2.1, 2.2).

**Ordering consequence:** B-P0a-9 and B-P0b's contract slice are mutually
gated — B-P0a-9 needs B-P0b to have redirected all non-shift readers of
`Worker` (B-P0a doc already flags "Coordinate with B-P0b", its section 6
slice -9), and B-P0b-7 (drop `workers`) needs B-P0a-9's table drops first.
Section 5 sequences this.

---

## 4. Allocation reconciliation touchpoints (verified)

No allocation model moves in B-P0b — this section verifies that the allocation
layer is already on the survivor, so the consolidation does not touch it:

- `ScheduleAllocation` (L2152) binds `workerProfileId -> WorkerProfile`
  (L2158-2159) with `onDelete: Cascade`, and carries the locked multi-role
  uniqueness `@@unique([date, projectId, workerProfileId, jobRoleId])` (L2171).
  **The key must not be narrowed** — same rule as B-P0a section 5; the
  regression spec exists (`scheduler/__tests__/schedule-allocation.multirole.spec.ts`).
- `ProjectAllocation` (L2110) binds `workerProfileId` (L2115-2116) and anchors
  timesheets, pre-starts, and `CompetencyOverride` (L2125-2127). Its
  derived-view future is **B-P0c**, out of scope here (IA map L267-269).
- The legacy `Worker` model has **zero** allocation relations to either table —
  its only scheduling linkage is `ShiftWorkerAssignment` (L633), handled in
  section 3.
- Eligibility for allocations is computed on read from `JobRoleRequirement`
  and `WorkerQualification` (`schedule-allocation.service.ts` L103-126), which
  is why the `WorkerCompetency` merge (2.3) is the one data move with
  allocation-facing consequences: done right, previously shift-board-only
  competencies start counting toward day-grain eligibility.

---

## 5. Phased migration plan

Small, individually shippable, reversible slices; **expand -> backfill ->
switch reads -> switch writes -> contract**. Migration folders use **full
14-digit `YYYYMMDDHHMMSS_` timestamps** (B-P0a risk R3 — alphabetical load
order). Each slice is its own PR with its own migration file(s).

| Slice | PR | Phase | Migration file(s) | What it does | Rollback |
|---|---|---|---|---|---|
| **B-P0b-1** | `improvement/s-bp0b1-profile-expand` | expand + guard | `YYYYMMDDHHMMSS_bp0b1_worker_profile_expand` | Add nullable columns to `WorkerProfile`: `employeeCode` (unique, nullable), `employmentType`, `notes`, and a `legacyWorkerId` back-pointer (unique, nullable) for backfill traceability — mirroring B-P0a-1's `legacyJobId`. No data moved. | Drop the new columns. |
| **B-P0b-2** | `improvement/s-bp0b2-backfill-map` | backfill (map + attributes) | `YYYYMMDDHHMMSS_bp0b2_backfill_worker_map` | Build the `Worker.id -> WorkerProfile.id` map, matched in priority order: (1) `Worker.userId = WorkerProfile.internalUserId`, (2) exact lower-cased email — **only where the email is unique on the Worker side** (L622 is not unique), (3) exact `firstName`+`lastName`. Create `WorkerProfile` shells for unmapped Workers (mirrors B-P0a-2b). Backfill `employeeCode`/`employmentType`/`notes`/`phone`, map `status -> isActive`, set `internalUserId` from `Worker.userId` where unset. Emit a duplicate/conflict report (R2, Q7). Inline SQL only. | Null the backfilled columns; delete shells by `legacyWorkerId IS NOT NULL AND created-by-shell` marker. |
| **B-P0b-3** | `improvement/s-bp0b3-merge-competencies` | backfill (merge) | `YYYYMMDDHHMMSS_bp0b3_merge_worker_competencies` | Merge `WorkerCompetency` rows into `WorkerQualification` via the -2 map: `qualType = Competency.code`, `achievedAt -> issueDate`, `expiresAt -> expiryDate`, note the provenance in `notes`. Skip rows whose `(workerProfileId, qualType)` already has a WorkerQualification with equal-or-later expiry. **Destructive-ish merge** — flagged R1; do not drop `WorkerCompetency` here. Pending **Q5**. | Delete migrated rows by provenance marker; source table untouched until -7. |
| **B-P0b-4** | `improvement/s-bp0b4-forms-repoint` | expand + backfill (edges) | `YYYYMMDDHHMMSS_bp0b4_form_submission_worker_profile` | Add `FormSubmission.workerProfileId` (nullable FK), backfill from the -2 map, switch the forms module read/write paths. Keep `workerId` populated in parallel until -7. **Sequence against B-P0a-7** (same table) — whichever lands second rebases. | Drop the new column; reads revert to `workerId`. |
| **B-P0b-5** | `improvement/s-bp0b5-switch-readers` | switch reads/writes | *(none — code only)* | Redirect `master-data` (write, L405-406), `resources` (L37, L97), `global-lists` (L267) to `WorkerProfile`. `/resources` page behaviour per **Q6** (freeze with legacy banner per IA map GAP-1 L424, or redirect to `/workers`). After this slice the legacy scheduler (section 3) is the only `Worker` client. | Revert the service redirects. |
| **B-P0b-6** | `improvement/s-bp0b6-crew-decision` | switch or contract (crews) | `YYYYMMDDHHMMSS_bp0b6_crew_repoint` *(or `_crew_retire`)* | Execute whichever **Q1** answer Marco picks: re-point `CrewWorker.workerId -> workerProfileId` via the -2 map, or drop `Crew`/`CrewWorker`. | Re-point: restore FK. Retire: snapshot restore only. |
| **B-P0b-7** | `improvement/s-bp0b7-drop-worker` | contract (drop) | `YYYYMMDDHHMMSS_bp0b7_drop_worker_tables` | **Gated on B-P0a-9.** Drop `worker_competencies`, `availability_windows`, `worker_role_suitabilities`, `FormSubmission.worker_id`, `ResourceType.workers` back-relation, and finally `workers`. Soak period + go/no-go first. | Snapshot restore only. |

### Sequencing against the remaining B-P0a slices (-5 .. -9)

- **Independent / parallel-safe:** B-P0b-1..-3 touch only `WorkerProfile`,
  `WorkerQualification`, and a new map — no overlap with B-P0a-5 (WBS),
  -6 (variations), or -8 (Job drop). They can start immediately.
- **B-P0b-4 vs B-P0a-7:** both modify `FormSubmission`. Land **B-P0a-7 first**
  (it re-points `jobId`/`shiftId`/correspondence in one slice), then B-P0b-4
  adds the worker edge — or vice versa, but never concurrently.
- **B-P0b-5** should land before **B-P0a-9** so that when the shift board is
  retired, `scheduler.service.ts` is already the *only* remaining `Worker`
  reader and -9's audit (B-P0a risk R9) is trivial.
- **B-P0b-7 strictly after B-P0a-9:** `ShiftWorkerAssignment.workerId` FKs
  `workers` (L1169); the drop order is shift cluster first, then `Worker`.
- **B-P0b-6 (crews)** has no B-P0a dependency; schedule per Marco's Q1 answer.

---

## 6. Risk + rollback register

| # | Risk | Likelihood | Impact | Mitigation / rollback |
|---|---|---|---|---|
| R1 | **Data loss on competency merge** (-3): collapsing `WorkerCompetency` into string-typed `WorkerQualification` loses the FK to `Competency` and can double-count or shadow existing quals. | Med | High | Provenance marker on every migrated row; skip-if-superior rule; source table retained until -7; DB snapshot before -3 and -7. Rollback -3 = delete by marker. |
| R2 | **Email match is unsafe as a primary key** (-2): `Worker.email` is not unique (L622) while `WorkerProfile.email` is (L2080); a shared email mis-maps two Workers onto one profile. | Med | High | Match priority puts `userId` first; email matching only where the email is unique among Workers; everything else falls to name match or an unmapped-shell, with a human-readable report. Rollback: null + delete shells. |
| R3 | **User-link conflict** (-2): a `User` referenced by a `Worker` (L617) *and* a different `WorkerProfile` (L2087) — or vice versa — makes the merged row ambiguous. | Low | High | -2 report lists all conflicts; **no automatic resolution** — held for Marco (Q7). -2 leaves conflicted rows unlinked rather than guessing. |
| R4 | **Dropping `Worker` before the shift cluster** breaks `ShiftWorkerAssignment`'s FK (L1169). | Low | High | -7 is hard-gated on B-P0a-9 (section 5). `prisma migrate status` + FK audit in the -7 PR checklist. |
| R5 | **`FormSubmission` migration collision** with B-P0a-7 (same table, two consolidation streams). | Med | Med | Explicit ordering rule in section 5; the second slice rebases and re-verifies with `prisma migrate status`. |
| R6 | **Multi-role rule regressed** by any index work near `ScheduleAllocation`. | Low | High | B-P0b touches no allocation table (section 4); the existing multirole regression spec stays green in CI. |
| R7 | **`/resources` page breaks or silently shows stale data** after -5 redirects its service. | Med | Low | Q6 decides freeze-vs-redirect before -5 ships; either way the page gets an explicit banner or a route redirect, never a silent behaviour change. |
| R8 | **`employeeCode` uniqueness collision** on backfill (-2): two Workers with the same code, or a code colliding with an existing profile value. | Low | Med | Column added nullable-unique in -1; -2 aborts on duplicate codes with a report, mirroring B-P0a-3's duplicate audit pattern. |
| R9 | **Migration ordering / alphabetical load** (inherited B-P0a R3). | Med | High | Full 14-digit timestamps on every folder; backfills inline in the migration; `prisma migrate status` before apply. |

### Rollback per slice (summary)

- **-1, -4, -5:** reversible — drop the added column / revert code.
- **-2:** reversible — null backfilled columns, delete marked shells.
- **-3:** reversible by provenance-marker delete until -7 drops the source.
- **-6:** reversible if re-point; snapshot-only if retire.
- **-7:** **destructive** — snapshot restore only; gated on B-P0a-9 + soak.

---

## 7. Open questions for Marco (NOT locked — decide before B-P0b-3/-5/-6)

Unlike the IA map, these have **no pre-made decision**. Each question lists the
default the plan assumes if you simply say "defaults fine".

1. **Crew / CrewWorker fate** *(blocks -6)* — Keep crews (re-point
   `CrewWorker` to `WorkerProfile`) or retire them? IA map notes minimal web
   usage (2 files, L374-375). **Default: retire.** Keeping them is cheap if
   crews are operationally real for Initial Services.
2. **`employmentType`** *(blocks -1)* — Carry it onto `WorkerProfile` as its
   own column (default), or is `role` (L2078) enough and employment basis
   belongs in a future HR/payroll integration instead?
3. **`ResourceType` link** *(blocks -2)* — Drop `Worker.resourceTypeId`
   outright (default — `ResourceType` stays for Assets only, L551), or does
   worker resource-classification matter for any report you use?
4. **Legacy `Worker.status` values** *(blocks -2)* — Plan maps
   `ACTIVE -> isActive=true`, all else `false`. Are there status values in use
   (e.g. `ON_LEAVE`, `INACTIVE`) that deserve their own representation rather
   than a boolean collapse? (Leave is now `WorkerLeave`, so **default: boolean
   collapse** with the raw value in the -2 report.)
5. **Competency merge shape** *(blocks -3)* — Convert `WorkerCompetency` rows
   into `WorkerQualification` strings (default — matches how the eligibility
   gate reads today, `schedule-allocation.service.ts` L120-126), or re-point
   the normalised `WorkerCompetency -> Competency` join to `WorkerProfile` and
   keep two stores? The default is simpler but gives up the FK to the
   `Competency` catalogue on historical rows.
6. **`/resources` legacy page** *(blocks -5)* — Freeze with a "legacy" banner
   until -7 (default, per GAP-1, IA map L424) or 308-redirect to `/workers`
   at -5?
7. **User-link conflicts** *(blocks -2 completion)* — When a `User` is claimed
   by a `Worker` and a *different* `WorkerProfile`, which link wins? Plan
   leaves them unlinked + reported (default), but you may prefer
   "WorkerProfile always wins".
8. **Historical `AvailabilityWindow` data** *(blocks nothing; decide by -7)* —
   Discard with the shift board (default), or import historical windows into
   `WorkerUnavailability` for record-keeping?

---

## Appendix — verified reference points (commit fae6f19)

- `Worker` model — schema **L615-642**; `userId @unique` L617; `employeeCode @unique` L619; `email` (non-unique) L622; `status` L625; relations L629-636.
- `WorkerProfile` model — schema **L2073-2108**; `email @unique` L2080; `hasMobileAccess` L2086; `internalUserId @unique` L2087; relations L2093-2101.
- `User.worker` / `User.workerProfile` back-relations — L44-45.
- `Crew` L644; `CrewWorker` L658 (FK L665); `WorkerCompetency` L704 (unique L715).
- `Shift` L1131; `ShiftWorkerAssignment` L1162 (FK L1169, unique L1171); `AvailabilityWindow` L1202; `WorkerRoleSuitability` L1218.
- `FormSubmission.workerId` L1449 / relation L1462 / index L1479; `shiftId` L1451.
- `ProjectAllocation` L2110 (`workerProfileId` L2115-2116); `ScheduleAllocation` L2152 (`workerProfileId` L2158-2159; `schedule_alloc_worker_uniq` L2171).
- `WorkerQualification` L3380; `WorkerLeave` L3504; `WorkerUnavailability` L3526; `WorkerLocationLog` L3546; `GanttTask.assignedTo` L3633.
- `JobRole` L585; `JobRoleRequirement` L600-613; `ResourceType.workers` L550.
- Eligibility bridge — `scheduler/schedule-allocation.service.ts` L103-126 (JobRoleRequirement competency codes vs `WorkerQualification.qualType`).
- `WorkerProfile` writer — `workers/workers.service.ts` L120 (create), L152 (update), L183 (soft delete), L226-231 (`provisionMobileAccess`).
- Legacy `Worker` clients — `master-data.service.ts` L371, L405-406; `resources.service.ts` L37, L97, L109; `scheduler.service.ts` L206, L373, L552; `global-lists.service.ts` L267.
- Locked decision — `docs/qa/Master-QA-and-Consolidation-Program-Plan.md` L189; `docs/architecture/module-ownership-ia-map.md` L70-71, L267-268.
- Crew deferral + `/resources` legacy — module-ownership-ia-map.md L374-375, L357-358; GAP-1 L424.

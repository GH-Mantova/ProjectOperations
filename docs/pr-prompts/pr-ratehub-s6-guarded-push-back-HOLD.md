---
premise: ! test -f apps/api/src/modules/rates/rate-push-back.service.ts
premise_means: The rate-push-back service does not exist yet — S6 guarded push-back work is still needed.
requires_file_on_main: apps/api/src/modules/rates/rate-xlsm-import.service.ts
scope:
  - apps/api/src/modules/rates/rate-push-back.service.ts
  - apps/api/src/modules/rates/rates.controller.ts
  - apps/api/src/modules/rates/rates.module.ts
  - apps/api/src/common/auth/permissions.ts
  - apps/web/src/pages/ScheduleOfRatesAdminPage.tsx
done_when:
  - pnpm build
  - pnpm lint
  - test -f apps/api/src/modules/rates/rate-push-back.service.ts
  - grep -q "rates.push-back\|rates\.push-back\|pushBack" apps/api/src/common/auth/permissions.ts
size: 8
gate_allow: none
seed_only: false
escalates: false
---

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. If the premise is already satisfied on main, say `NO-OP: premise already satisfied`
  and exit.
- Never ask a question. Decide from the evidence, or write to `needs-marco/` and stop.
- Before diagnosing any CI failure, read the job log via `gh run view <run-id> --log`.
- Say `NO-OP: <reason>` loudly if you cannot finish. A silent exit is treated as success by the
  watcher — that is the worst outcome.

## Context

Plan: `docs/plans/rate-hub-sor-integration-plan.md` (read it, especially §Locked Decisions #8).

Push-back lets a user promote a locally-edited SoR rate back to the master hub (internal `RateRow`
or vendor `SubcontractorRate`). It is permission-gated, change-logged, shows an impact preview of
affected UNLOCKED tenders before confirm, and NEVER mutates locked snapshots (`TenderRateSet`).

Pull direction (hub → SoR/tender) is already the default read+snapshot path and needs no new code.
Only the push direction (local SoR edit → master) is built here.

## Ground first — read these files (cite line numbers)

1. `apps/api/prisma/schema.prisma` — `TenderRateSet` (line ~5510): the locked snapshot model.
   Confirm it has a `lockedAt` or `status` field to determine if it is locked.
2. `apps/api/prisma/schema.prisma` lines 5471–5500 (`RateRow`) — append-only pattern: create a new
   active row and set old row `isActive = false` in one transaction.
3. `apps/api/prisma/schema.prisma` lines 4360–4400 (`SubcontractorRate`) — same append-only pattern.
4. `apps/api/src/common/auth/permissions.ts` — how existing permissions are declared; add
   `rates.push-back` following the same pattern.
5. `apps/web/src/pages/ScheduleOfRatesAdminPage.tsx` — the SoR admin page; add push-back UI here.
6. `apps/api/src/modules/schedule-of-rates/sor-source-markup.service.ts` (from S3) — the
   `sourceType` / `sourceRateRowId` / `sourceSubRateId` fields used to route push-back correctly.

## What to build

### 1. New permission
In `apps/api/src/common/auth/permissions.ts`:
Add `"rates.push-back"` to the permissions list/enum (follow the existing pattern exactly).

### 2. New service
Create `apps/api/src/modules/rates/rate-push-back.service.ts`:

**`getImpactPreview(sorRateId: string): Promise<ImpactPreview>`**
- Finds the `SorRate` by id; reads `sourceType`, `sourceRateRowId`/`sourceSubRateId`.
- Throws `BadRequestException` if `sourceType === MANUAL` (no hub target to push to).
- Finds all `TenderRateEntry` rows that reference the same source rate AND belong to UNLOCKED
  tenders (i.e. tenders whose `TenderRateSet.lockedAt` is null or `TenderRateSet` does not exist).
- Returns: `{ affectedUnlockedTenders: { tenderId, tenderName, currentValue }[] }`.

**`pushBack(sorRateId: string, actorId: string, newRate: number): Promise<void>`**
- Calls `getImpactPreview` — caller must confirm before calling this.
- Determines target: INTERNAL → `RateRow`; SUBBIE/SUPPLIER → `SubcontractorRate`.
- **INTERNAL push-back:** in a single transaction, set old `RateRow.isActive = false`,
  create a new `RateRow` with the updated cells; write audit log
  (`action: "rates.pushBack"`, metadata: `{ sorRateId, oldValue, newValue }`).
- **VENDOR push-back:** in a single transaction, set old `SubcontractorRate.isActive = false`,
  create a new `SubcontractorRate` with updated `rate`; write audit log.
- **Locked snapshots are NEVER touched.** Verify before acting: if the `SorPeriod.status` is
  "LOCKED" (or equivalent), throw `ForbiddenException("Locked SoR snapshot cannot push back.")`.
- Inject `PrismaService`, `AuditService`.

### 3. Controller endpoint
Add to `apps/api/src/modules/rates/rates.controller.ts`:
- `GET /rates/push-back/:sorRateId/preview` — returns impact preview; guard: `rates.push-back`.
- `POST /rates/push-back/:sorRateId` — body `{ newRate: number }`; calls `pushBack`;
  guard: `rates.push-back`.

### 4. Web UI
In `apps/web/src/pages/ScheduleOfRatesAdminPage.tsx`:
- For each SoR rate row where `sourceType !== MANUAL`, add a "Push back to hub" button
  (only visible to users with the `rates.push-back` permission).
- On click: call the preview endpoint; show a modal with:
  - The new rate value the user will be pushing.
  - A table of affected UNLOCKED tenders (name, current value from their `TenderRateEntry`).
  - A "Confirm push" button that calls the push-back endpoint.
- On success: toast "Rate updated in hub. X unlocked tenders may be affected."
- If `affectedUnlockedTenders` is empty: modal still shows for confirmation but with
  "No unlocked tenders reference this rate."

## Do NOT
- Do NOT mutate any `TenderRateSet` row (locked snapshots are frozen).
- Do NOT mutate `SorClientRateEntry` rows (per-client cards are snapshots).
- Do NOT push back MANUAL source rates (they have no hub anchor).
- Do NOT change the schema — this slice has no migrations.
- Do NOT edit `/sot/`.

## VERIFY
```
pnpm build && pnpm lint
test -f apps/api/src/modules/rates/rate-push-back.service.ts
grep -q "rates.push-back\|pushBack" apps/api/src/common/auth/permissions.ts
grep -q "pushBack\|push-back" apps/api/src/modules/rates/rates.controller.ts
```
All must pass before you open the PR.

Open the PR with a title like:
`feat(rate-hub): S6 — guarded push-back (SoR local edit → master hub rate, locked snapshots frozen)`

Leave it UNMERGED.

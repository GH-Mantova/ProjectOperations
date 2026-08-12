---
premise: '! grep -q "model AgreedRecord" apps/api/prisma/schema.prisma'
premise_means: The Agreed-Record (AR / dayworks) models do not exist yet — field crews cannot capture dayworks against a job's locked SoR. S4 (Job SoR snapshot) is on main.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/agreed-records/agreed-records.service.ts
  - apps/api/src/modules/agreed-records/agreed-records.controller.ts
  - apps/api/src/modules/agreed-records/agreed-records.module.ts
  - apps/api/src/modules/agreed-records/__tests__/agreed-records.service.spec.ts
  - apps/web/src/pages/AgreedRecordCapturePage.tsx
  - apps/web/src/App.tsx
done_when: pnpm build && pnpm lint && grep -q "model AgreedRecord" apps/api/prisma/schema.prisma && test -f apps/api/src/modules/agreed-records/agreed-records.service.ts
size: 9
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: Additive migration only — three new tables (AgreedRecord, AgreedRecordLine, AgreedRecordAttachment) + one enum (AgreedRecordStatus). Nothing existing altered. Safe to leave on main; down migration drops the three tables and the enum. Forward-only otherwise.
backfill: false
requires_file_on_main: apps/api/src/modules/schedule-of-rates/job-sor-snapshot.service.ts
---

# SoR S7 — Agreed Record (AR / dayworks) field capture

Slice S7 (`docs/plans/sor-program-plan.md` on main; design in memory `project_sor_program`). AR =
**NET-NEW** dayworks record captured on the EXISTING field/mobile app. **Site crews see NO rates and
NO $** — the field surface captures resources, hours/qty, photos, and BOTH signatures. Office pricing
+ review is S8; the register / progress-claim feed is S9. VC (S6) is a separate flow.

## Grounded (read first — on main today)
- `apps/api/prisma/schema.prisma` — `Job` (line 1420) is the parent; S4's `JobSorSnapshot` is the
  rate-lock the office side reads later.
- `apps/api/src/modules/schedule-of-rates/job-sor-snapshot.service.ts` — call
  `POST job-sor-snapshot/attach` on the FIRST AR against a job if the job has no snapshot yet (this
  is the "first VC/AR locks it" rule from S4 and S6). AR itself stores only `sorVersion` + snapshot
  FK; pricing happens in S8.
- The existing field/mobile app surfaces (pre-start, GPS clock-on, docket capture) — mirror their
  fetch layer, upload path, and design tokens; do NOT invent a parallel mobile shell.

## What to build

1. **`apps/api/prisma/schema.prisma`** — add ONE enum and THREE models:
   ```prisma
   enum AgreedRecordStatus {
     DRAFT              // worker started but not yet submitted
     SUBMITTED          // worker submitted with both signatures + photos
     OFFICE_REVIEW      // WHS & CC picked it up (S8 transitions this)
     PRICED             // priced from locked SoR (S8)
     APPROVED           // Ops signed off (S8)
     SENT_BACK          // office rejected — back to worker (S8)
     VOID
   }

   model AgreedRecord {
     id                    String              @id @default(cuid())
     jobId                 String              @map("job_id")
     job                   Job                 @relation(fields: [jobId], references: [id], onDelete: Cascade)
     recordNumber          String              @unique @map("record_number")
     description           String
     workDate              DateTime            @map("work_date")
     status                AgreedRecordStatus  @default(DRAFT)
     // Rate lock (populated on first-submit — S8 reads this to price)
     jobSorSnapshotId      String?             @map("job_sor_snapshot_id")
     sorVersion            String?             @map("sor_version")
     // Field-captured signatures — both required to submit
     workerSignaturePath   String?             @map("worker_signature_path")   // /uploads/... or blob key
     workerSignedById      String?             @map("worker_signed_by_id")
     workerSignedAt        DateTime?           @map("worker_signed_at")
     clientRepName         String?             @map("client_rep_name")
     clientRepSignaturePath String?            @map("client_rep_signature_path")
     clientRepSignedAt     DateTime?           @map("client_rep_signed_at")
     submittedAt           DateTime?           @map("submitted_at")
     createdById           String              @map("created_by_id")
     createdAt             DateTime            @default(now()) @map("created_at")
     updatedAt             DateTime            @updatedAt @map("updated_at")
     lines                 AgreedRecordLine[]
     attachments           AgreedRecordAttachment[]
     @@index([jobId, status])
     @@map("agreed_records")
   }

   model AgreedRecordLine {
     id                String        @id @default(cuid())
     agreedRecordId    String        @map("agreed_record_id")
     agreedRecord      AgreedRecord  @relation(fields: [agreedRecordId], references: [id], onDelete: Cascade)
     // NO rates on the field-side write — captured category / resource / hours or qty only.
     category          SorCategory
     resourceName      String        @map("resource_name")  // e.g. "Labourer" or "Bobcat"
     class             String?
     unit              String?
     quantity          Decimal       @db.Decimal(12, 2)
     tier              String        @default("ORDINARY")   // ORDINARY | ONE_AND_HALF | DOUBLE (labour OT)
     notes             String?
     sortOrder         Int           @default(0) @map("sort_order")
     @@index([agreedRecordId])
     @@map("agreed_record_lines")
   }

   model AgreedRecordAttachment {
     id              String        @id @default(cuid())
     agreedRecordId  String        @map("agreed_record_id")
     agreedRecord    AgreedRecord  @relation(fields: [agreedRecordId], references: [id], onDelete: Cascade)
     kind            String        @default("PHOTO")   // PHOTO | SIGNATURE | OTHER
     filePath        String        @map("file_path")
     uploadedById    String?       @map("uploaded_by_id")
     uploadedAt      DateTime      @default(now()) @map("uploaded_at")
     @@index([agreedRecordId])
     @@map("agreed_record_attachments")
   }
   ```
   Add the back-ref `agreedRecords AgreedRecord[]` on `Job`. Nothing else altered.
2. **Migration** — additive; bare `GATE-ALLOW: migrations` at column 0 of the PR body.
3. Regenerate `docs/data-model/**` via `node scripts/data-model/build-relationship-map.mjs`.
4. **`apps/api/src/modules/agreed-records/`** (new module) — service/controller/module, guarded by the
   field-app worker permission (reuse whichever guard the existing docket / pre-start endpoints use;
   do NOT invent a new permission):
   - `POST agreed-records` — create DRAFT for a job (worker).
   - `PATCH agreed-records/:id` — edit description / workDate / lines while DRAFT.
   - `POST agreed-records/:id/lines` / `PATCH .../lines/:lineId` / `DELETE .../lines/:lineId` —
     resource / hours / qty edits ONLY. **No rate / $ field accepted or returned by these endpoints.**
   - `POST agreed-records/:id/attachments` — file upload (photo / signature), mirrors the docket
     attachment path.
   - `POST agreed-records/:id/submit` — validates BOTH worker & client-rep signatures + ≥1 photo, then:
     1. if job has no `JobSorSnapshot`, calls S4's `POST job-sor-snapshot/attach` for the current
        active period, 2. stamps `jobSorSnapshotId` + `sorVersion` on the AR, 3. transitions status to
     `SUBMITTED`. This is the rate-lock moment on the AR side. **Rejects if either signature is missing.**
   - `GET agreed-records/for-job/:jobId` — list (field crew view — still no $).
5. **`apps/web/src/pages/AgreedRecordCapturePage.tsx`** — mobile-first capture screen: pick job →
   description + work date → add lines (category / resource / hours or qty, tier for labour) → attach
   photos → capture worker signature → capture client-rep name + signature → submit. **The page must
   render NO rate or dollar value anywhere** (even in a hidden read-only column) — that is the crew
   confidentiality rule from the plan. Route it in `App.tsx` under `/field/agreed-records` behind the
   field-worker guard the sibling docket screen uses. Follow the existing field-app design tokens.
6. **Spec** `apps/api/src/modules/agreed-records/__tests__/agreed-records.service.spec.ts`: (a) submit
   rejects if either signature missing, (b) first submit against a job triggers snapshot attach,
   (c) subsequent submits reuse the same snapshot+sorVersion, (d) lines never carry a rate/amount
   field in returned DTOs.

## Do NOT
- Do NOT show rates, dollar amounts, or any pricing to the field-side (crew) surface — anywhere.
- Do NOT price the AR here — pricing is S8 (office review lane, from the locked snapshot).
- Do NOT build the office review queue, notifications, or the register — S8 / S9.
- Do NOT touch tender pricing, or the S3 client rate card write paths.
- Do NOT hard-depend on the rate-hub slices.
- Do NOT touch Azure/Entra/SharePoint or `/sot/`.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. If the models already exist on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval.
- Read the CI job log before diagnosing a failure.
- Regenerate the data-model map up front.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.

# Files of interest

Quick-reference index of files the MAIN chat needs context on when planning
work. One line per file: path, last touched PR, why it matters.

Maintained by Claude Code — append when a PR touches a file MAIN had to
attach to write the prompt. Don't remove entries; they're historical.

| Path | Last PR | Why it matters |
|---|---|---|
| `apps/api/src/modules/jobs/jobs.service.ts` | B05 | All Job CRUD + tender→job conversion. Canonical job-number resolution + race-fix live here. |
| `apps/api/src/modules/jobs/jobs.controller.ts` | B02 (#197) | POST /jobs handler — frontend NewJobSlideOver hits this. |
| `apps/api/src/modules/jobs/jobs.module.ts` | B05 | Registers JobsService + JobNumberService providers. |
| `apps/api/src/modules/jobs/job-number.service.ts` | B05 | Canonical J-YYYY-NNN generator. Per-year sequence row, Brisbane TZ. |
| `apps/api/src/modules/jobs/dto/job-delivery.dto.ts` | B05 | CreateJobDto — `jobNumber` is now optional (server-generated when omitted). |
| `apps/api/src/modules/jobs/dto/job-conversion.dto.ts` | B05 | ConvertTenderToJobDto — `jobNumber` optional (same semantics as CreateJobDto). ReuseArchivedJobConversionDto re-declares it required because that path looks the archived row up by number. |
| `apps/api/src/modules/jobs/__tests__/create-job.spec.ts` | B05 | Specs for createJob covering generation, validation, pre-check 409, P2002 race 409. |
| `apps/api/src/modules/jobs/__tests__/job-number.service.spec.ts` | B05 | Specs for JobNumberService (format / validate / generate). |
| `apps/api/src/modules/jobs/jobs.service.spec.ts` | B05 | Specs for the wider JobsService surface; gained B05 convertTenderToJob specs (generator, non-canonical 400, P2002 race 409). |
| `apps/api/src/modules/tendering/tendering.service.ts` | (pre-B05) | Tender CRUD. `tenderInclude` returns `sourceJob.jobNumber` — read path benefits from B05 canonicalisation automatically. |
| `apps/api/prisma/schema.prisma` | B05 | `Job.jobNumber` is `@unique`. `JobNumberSequence` added in B05 (per-year sequence row keyed by `year`). |
| `apps/api/prisma/seed-initial-services.ts` | (pre-B05) | Seeds J-2025-001 / J-2025-002. Upsert-by-id so the canonicalisation migration doesn't conflict on re-run. |
| `apps/api/prisma/migrations/20260519_feat_job_number_canonicalisation/migration.sql` | B05 | Normalises `JOB-YYYY-NNN` → `J-YYYY-NNN` and `JOB-COMP-*` → `J-2026-NNN` starting at MAX(existing 2026)+1, seeds JobNumberSequence per year, asserts no non-canonical rows remain. |

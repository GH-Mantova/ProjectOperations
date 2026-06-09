import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

/**
 * Payload for `PATCH /jobs/:id`. All fields optional — only supplied
 * fields are written; `jobNumber`, `clientId`, and `status` are
 * intentionally immutable on this path (status changes go through
 * `PATCH /jobs/:id/status`).
 */
export class UpdateJobDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() siteId?: string;
  @IsOptional() @IsString() projectManagerId?: string;
  @IsOptional() @IsString() supervisorId?: string;
}

/**
 * Payload for `POST /jobs` — manual job creation without a tender source
 * (PR B05). `jobNumber` is optional: omit to let the server generate a
 * canonical `J-YYYY-NNN` via {@link JobNumberService.generate}; when
 * supplied, it's validated against the canonical pattern. `status`
 * defaults to `"PLANNING"`. `name` and `clientId` are required.
 */
export class CreateJobDto {
  @IsOptional() @IsString() jobNumber?: string;
  @IsString() name!: string;
  @IsString() clientId!: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() siteId?: string;
  @IsOptional() @IsString() projectManagerId?: string;
  @IsOptional() @IsString() supervisorId?: string;
}

/**
 * Payload for `PATCH /jobs/:id/status`. The supplied `status` is written
 * to the job and a {@link JobStatusHistory} row is appended; `note` is
 * stored against that history row for audit/context.
 */
export class UpdateJobStatusDto {
  @IsString()
  status!: string;

  @IsOptional() @IsString() note?: string;
}

/**
 * Payload for `POST /jobs/:id/stages` (create — `name` required) and
 * `PATCH /jobs/:id/stages/:stageId` (update, via {@link UpdateJobStageDto}).
 * `stageOrder` defaults to 0 and `status` to `"PLANNED"` server-side
 * when omitted on create. Date fields accept ISO strings and are
 * parsed server-side.
 */
export class CreateJobStageDto {
  @IsString()
  name!: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsInt() stageOrder?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}

/** Payload for `PATCH /jobs/:id/stages/:stageId`. Shape mirrors {@link CreateJobStageDto}. */
export class UpdateJobStageDto extends CreateJobStageDto {}

/**
 * Payload for `POST /jobs/:id/activities` (create — `jobStageId` and
 * `name` required) and `PATCH /jobs/:id/activities/:activityId`
 * (update, via {@link UpdateJobActivityDto}). Supplying a different
 * `jobStageId` on update moves the activity between stages; the target
 * stage is verified to belong to the same job server-side. `status`
 * defaults to `"PLANNED"`, `activityOrder` to 0.
 */
export class CreateJobActivityDto {
  @IsString()
  jobStageId!: string;

  @IsString()
  name!: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsInt() activityOrder?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsDateString() plannedDate?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() ownerUserId?: string;
}

/** Payload for `PATCH /jobs/:id/activities/:activityId`. Shape mirrors {@link CreateJobActivityDto}. */
export class UpdateJobActivityDto extends CreateJobActivityDto {}

/**
 * Payload for `POST /jobs/:id/issues` (create — `title` required) and
 * `PATCH /jobs/:id/issues/:issueId` (update, via {@link UpdateJobIssueDto}).
 * `severity` defaults to `"MEDIUM"` and `status` to `"OPEN"` server-side
 * when omitted on create. `reportedById` is stamped from the caller and
 * is not settable from the DTO.
 */
export class CreateJobIssueDto {
  @IsString()
  title!: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() severity?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsDateString() dueDate?: string;
}

/** Payload for `PATCH /jobs/:id/issues/:issueId`. Shape mirrors {@link CreateJobIssueDto}. */
export class UpdateJobIssueDto extends CreateJobIssueDto {}

/**
 * Payload for `POST /jobs/:id/variations` (create — `reference` and
 * `title` required) and `PATCH /jobs/:id/variations/:variationId`
 * (update, via {@link UpdateJobVariationDto}). `reference` is enforced
 * unique within a single job server-side. `amount` arrives as a
 * numeric string and is parsed into a `Prisma.Decimal`; `status`
 * defaults to `"PROPOSED"`.
 */
export class CreateJobVariationDto {
  @IsString()
  reference!: string;

  @IsString()
  title!: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsNumberString() amount?: string;
  @IsOptional() @IsString() approvedById?: string;
  @IsOptional() @IsDateString() approvedAt?: string;
}

/** Payload for `PATCH /jobs/:id/variations/:variationId`. Shape mirrors {@link CreateJobVariationDto}. */
export class UpdateJobVariationDto extends CreateJobVariationDto {}

/**
 * Payload for `POST /jobs/:id/progress-entries`. `entryType` defaults to
 * `"PROGRESS"`; the typical other value is `"DAILY_NOTE"`. `entryDate`
 * is required and arrives as an ISO string; `percentComplete` is
 * 0–100 (validated). `authorUserId` is stamped from the caller and is
 * not settable from the DTO.
 */
export class CreateJobProgressEntryDto {
  @IsOptional() @IsString() entryType?: string;
  @IsDateString() entryDate!: string;
  @IsString() summary!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) percentComplete?: number;
  @IsOptional() @IsString() details?: string;
}

/**
 * Payload for `PATCH /jobs/:id/closeout`. Upserts the job's closeout
 * record. `status` defaults to `"CLOSED"`; `"CLOSED"` and `"ARCHIVED"`
 * both force the job's own status to `"COMPLETE"`. `archivedAt` and
 * `readOnlyFrom` default to "now" when omitted — once `readOnlyFrom`
 * is in the past, subsequent writes to this job are rejected with 403.
 * `checklistJson` is a free-form object persisted as Prisma JSON.
 */
export class CloseoutJobDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() checklistJson?: Record<string, unknown>;
  @IsOptional() @IsString() summary?: string;
  @IsOptional() @IsDateString() archivedAt?: string;
  @IsOptional() @IsDateString() readOnlyFrom?: string;
}

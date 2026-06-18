import { Type } from "class-transformer";
import { IsDateString, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

/**
 * Query parameters for the scheduler workspace endpoint.
 *
 * Extends {@link PaginationQueryDto} for `page`/`pageSize`/`limit`, though
 * the workspace handler returns the full dataset and only echoes
 * pagination values back.
 */
export class SchedulerQueryDto extends PaginationQueryDto {
  /** Optional workspace view hint (e.g. `board`, `calendar`). */
  @IsOptional() @IsString() view?: string;
  /** Optional workspace mode hint (e.g. `day`, `week`). */
  @IsOptional() @IsString() mode?: string;
}

/**
 * Payload for creating a shift under a job activity.
 *
 * Date fields are ISO-8601 strings; the service converts them with `new
 * Date(...)` so callers should send UTC timestamps (or include an explicit
 * offset) to avoid server-local interpretation. `endAt` must be strictly
 * after `startAt`.
 */
export class CreateShiftDto {
  /** Parent job id. `jobActivityId` must belong to this job. */
  @IsString()
  jobId!: string;

  /** Job activity the shift belongs to; drives default stage. */
  @IsString()
  jobActivityId!: string;

  /** Optional explicit stage; defaults to the activity's stage when omitted. */
  @IsOptional() @IsString() jobStageId?: string;
  /** Human-readable shift title. */
  @IsString() title!: string;
  /** Shift start (ISO-8601). */
  @IsDateString() startAt!: string;
  /** Shift end (ISO-8601). Must be after `startAt`. */
  @IsDateString() endAt!: string;
  /** Optional shift status; defaults to `PLANNED` on create. */
  @IsOptional() @IsString() status?: string;
  /** Free-text scheduler notes. */
  @IsOptional() @IsString() notes?: string;
  /** Free-text work instructions surfaced to the crew. */
  @IsOptional() @IsString() workInstructions?: string;
  /** Optional shift lead (user id). */
  @IsOptional() @IsString() leadUserId?: string;
}

/**
 * Payload for replacing a shift. Mirrors {@link CreateShiftDto} as a full
 * update (not a sparse patch); omitted `status` falls back to the existing
 * value.
 */
export class UpdateShiftDto extends CreateShiftDto {}

/**
 * Payload for assigning a worker to a shift.
 */
export class AssignWorkerDto {
  /** Worker to assign. Must be unique per shift. */
  @IsString()
  workerId!: string;

  /** Optional role label matched against the shift's role requirements. */
  @IsOptional() @IsString() roleLabel?: string;
}

/**
 * Payload for assigning an asset to a shift.
 */
export class AssignAssetDto {
  /** Asset to assign. Must be unique per shift. */
  @IsString()
  assetId!: string;
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested
} from "class-validator";

export const SCHEDULE_TARGETS = ["WORKER", "ASSET"] as const;
export type ScheduleTargetType = (typeof SCHEDULE_TARGETS)[number];

export const SCHEDULE_ORIENTATIONS = ["project", "resource"] as const;
export type ScheduleOrientation = (typeof SCHEDULE_ORIENTATIONS)[number];

/**
 * Override sub-object for the "showAll" allocation path — a `scheduler.manage`
 * actor wants to allocate an ineligible worker (missing/expired qualification,
 * on leave, double-booked). `reason` is mandatory; the service emits a
 * `schedule.unqualified_override` AuditLog row and stores the reason on the
 * row itself.
 */
export class ScheduleOverrideDto {
  @ApiProperty({ description: "Required reason when allocating an ineligible worker via the showAll path." })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

/**
 * Upsert payload for a single day-grain cell.
 *
 * Exactly one of `workerProfileId` / `assetId` must be supplied — paired with
 * `targetType`. The service enforces the mapping.
 */
export class UpsertScheduleAllocationDto {
  @ApiProperty({ description: "ISO date (YYYY-MM-DD) — day grain." })
  @IsDateString()
  date!: string;

  @ApiProperty()
  @IsString()
  projectId!: string;

  @ApiProperty({ enum: SCHEDULE_TARGETS })
  @IsEnum(SCHEDULE_TARGETS)
  targetType!: ScheduleTargetType;

  @ApiPropertyOptional() @IsOptional() @IsString() workerProfileId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assetId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() jobRoleId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;

  @ApiPropertyOptional({ type: ScheduleOverrideDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleOverrideDto)
  override?: ScheduleOverrideDto;
}

/**
 * Fill or clear a date range for one resource on one project.
 *
 * When `clear === true` every existing cell in `[from, to]` for this
 * resource is deleted (other resources untouched). Otherwise the cell is
 * upserted for each date in the range.
 */
export class RangeScheduleAllocationDto {
  @ApiProperty({ description: "Range start (inclusive) ISO date." })
  @IsDateString()
  from!: string;

  @ApiProperty({ description: "Range end (inclusive) ISO date." })
  @IsDateString()
  to!: string;

  @ApiProperty()
  @IsString()
  projectId!: string;

  @ApiProperty({ enum: SCHEDULE_TARGETS })
  @IsEnum(SCHEDULE_TARGETS)
  targetType!: ScheduleTargetType;

  @ApiPropertyOptional() @IsOptional() @IsString() workerProfileId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assetId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() jobRoleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;

  @ApiPropertyOptional({ description: "When true, deletes cells in the range instead of upserting." })
  @IsOptional() @IsBoolean() clear?: boolean;

  @ApiPropertyOptional({ type: ScheduleOverrideDto })
  @IsOptional() @ValidateNested() @Type(() => ScheduleOverrideDto)
  override?: ScheduleOverrideDto;
}

/**
 * Query parameters for the grid read endpoint.
 */
export class ScheduleAllocationQueryDto {
  @ApiProperty({ description: "Window start (inclusive) ISO date." })
  @IsDateString() from!: string;

  @ApiProperty({ description: "Window end (inclusive) ISO date." })
  @IsDateString() to!: string;

  @ApiPropertyOptional({ enum: SCHEDULE_ORIENTATIONS, default: "project" })
  @IsOptional() @IsEnum(SCHEDULE_ORIENTATIONS) orientation?: ScheduleOrientation;

  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
}

/**
 * Query for the "fit the bill" eligibility endpoint.
 */
export class EligibleWorkersQueryDto {
  @ApiProperty() @IsString() jobRoleId!: string;
  @ApiProperty() @IsDateString() date!: string;
  @ApiProperty() @IsString() projectId!: string;

  @ApiPropertyOptional({ description: "When true, returns all available workers (eligible+ineligible) tagged with reasons." })
  @IsOptional() @IsBoolean() showAll?: boolean;
}

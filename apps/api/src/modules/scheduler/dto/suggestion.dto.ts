import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { SCHEDULE_TARGETS, type ScheduleTargetType } from "./schedule-allocation.dto";

/**
 * §9 Scheduler — Suggest engine query (D365 Field Service RSO parity, phase 1).
 *
 * Phase 1 is ASSISTIVE: rank eligible workers (and assets) for an open slot on
 * a given date/project/role. The planner picks; the engine never auto-commits.
 * Phase 2 (auto-assign) is a separate, gated flow.
 */
export class SchedulerSuggestQueryDto {
  @ApiProperty({ description: "ISO date (YYYY-MM-DD) — day grain of the open slot." })
  @IsDateString()
  date!: string;

  @ApiProperty({ description: "Project the slot belongs to." })
  @IsString()
  projectId!: string;

  @ApiPropertyOptional({ description: "Job role the slot is for. Omit for role-agnostic suggestions." })
  @IsOptional()
  @IsString()
  jobRoleId?: string;

  @ApiPropertyOptional({ enum: SCHEDULE_TARGETS, default: "WORKER" })
  @IsOptional()
  @IsEnum(SCHEDULE_TARGETS)
  targetType?: ScheduleTargetType;

  @ApiPropertyOptional({ description: "Max suggestions to return (1..25).", default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number;

  @ApiPropertyOptional({ description: "When true, include ineligible candidates ranked below eligible ones." })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeIneligible?: boolean;
}

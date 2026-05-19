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

export class UpdateJobDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() siteId?: string;
  @IsOptional() @IsString() projectManagerId?: string;
  @IsOptional() @IsString() supervisorId?: string;
}

// PR B05 — manual job creation. Fields match what the
// `NewJobSlideOver` modal (apps/web/src/pages/jobs/JobsListPage.tsx)
// sends. jobNumber is now optional — server generates canonical
// J-YYYY-NNN via JobNumberService when omitted; when supplied, it's
// validated against the canonical pattern. status defaults to
// "PLANNING" if omitted.
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

export class UpdateJobStatusDto {
  @IsString()
  status!: string;

  @IsOptional() @IsString() note?: string;
}

export class CreateJobStageDto {
  @IsString()
  name!: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsInt() stageOrder?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}

export class UpdateJobStageDto extends CreateJobStageDto {}

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

export class UpdateJobActivityDto extends CreateJobActivityDto {}

export class CreateJobIssueDto {
  @IsString()
  title!: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() severity?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsDateString() dueDate?: string;
}

export class UpdateJobIssueDto extends CreateJobIssueDto {}

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

export class UpdateJobVariationDto extends CreateJobVariationDto {}

export class CreateJobProgressEntryDto {
  @IsOptional() @IsString() entryType?: string;
  @IsDateString() entryDate!: string;
  @IsString() summary!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) percentComplete?: number;
  @IsOptional() @IsString() details?: string;
}

export class CloseoutJobDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() checklistJson?: Record<string, unknown>;
  @IsOptional() @IsString() summary?: string;
  @IsOptional() @IsDateString() archivedAt?: string;
  @IsOptional() @IsDateString() readOnlyFrom?: string;
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsISO8601, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";
import { Transform, Type } from "class-transformer";

const PRIORITIES = ["low", "medium", "high", "critical"] as const;
const STATUSES = ["open", "in_progress", "closed"] as const;

export class ListCorrectiveActionsDto {
  @ApiPropertyOptional({ description: "Filter by status", enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: string;

  @ApiPropertyOptional({ description: "Filter by originating submission id" })
  @IsOptional()
  @IsString()
  submissionId?: string;

  @ApiPropertyOptional({ description: "Filter by assignedToId" })
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional({ description: "When true, return only overdue open/in_progress actions" })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;
}

export class CreateCorrectiveActionDto {
  @ApiProperty({ description: "Short descriptive title" })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional({ description: "Originating submission id (optional — can be raised ad-hoc)" })
  @IsOptional()
  @IsString()
  submissionId?: string;

  @ApiPropertyOptional({ description: "Field key that triggered this action" })
  @IsOptional()
  @IsString()
  sourceFieldKey?: string;

  @ApiPropertyOptional({ description: "Full description of the required corrective work" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "User assigned to resolve this action" })
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional({ description: "Role assigned when no specific user is known" })
  @IsOptional()
  @IsString()
  assignedToRole?: string;

  @ApiPropertyOptional({ description: "ISO 8601 due date" })
  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @ApiPropertyOptional({ enum: PRIORITIES, default: "medium" })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: string;
}

export class UpdateCorrectiveActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedToRole?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: string;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(["open", "in_progress"])
  status?: string;
}

export class CloseCorrectiveActionDto {
  @ApiProperty({ description: "Note explaining the close-out action taken" })
  @IsString()
  @MinLength(1)
  closeOutNote!: string;

  @ApiPropertyOptional({ description: "Path to supporting evidence (photo, document URL)" })
  @IsOptional()
  @IsString()
  evidencePath?: string;
}

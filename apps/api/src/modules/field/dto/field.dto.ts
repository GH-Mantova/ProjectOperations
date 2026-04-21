import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { Type } from "class-transformer";

export class CreatePreStartDto {
  @ApiProperty() @IsString() allocationId!: string;
  @ApiProperty() @IsDateString() date!: string;
}

export class UpdatePreStartDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) supervisorName?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() siteHazardsAcknowledged?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) hazardNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() ppeHelmet?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() ppeGloves?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() ppeBoots?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() ppeHighVis?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() ppeRespirator?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) ppeOther?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() plantChecksCompleted?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) plantCheckNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() fitForWork?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) fitForWorkDeclaration?: string;
  @ApiPropertyOptional({ description: "base64-encoded signature image (data URL)" })
  @IsOptional()
  @IsString()
  workerSignature?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() asbEnclosureInspection?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() asbAirMonitoring?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() asbDeconOperational?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() civExcavationPermit?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() civUndergroundClearance?: boolean;
}

export class CreateTimesheetDto {
  @ApiProperty() @IsString() allocationId!: string;
  @ApiProperty() @IsDateString() date!: string;
  @ApiProperty({ minimum: 0.5, maximum: 24 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(24)
  hoursWorked!: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  breakMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() clockOnTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() clockOffTime?: string;
}

export class UpdateTimesheetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(24)
  hoursWorked?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  breakMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() clockOnTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() clockOffTime?: string;
}

export class FieldListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() page?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() limit?: string;
}

export class ManageTimesheetQueryDto {
  @ApiPropertyOptional({ enum: ["DRAFT", "SUBMITTED", "APPROVED"] })
  @IsOptional()
  @IsString()
  status?: "DRAFT" | "SUBMITTED" | "APPROVED";
  @ApiPropertyOptional() @IsOptional() @IsString() workerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() page?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() limit?: string;
}

export class TimesheetSummaryQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateTo?: string;
}

export class RejectTimesheetDto {
  @ApiProperty({ minLength: 10, maxLength: 1000 })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}

export class BulkApproveTimesheetsDto {
  @ApiProperty({ description: "Up to 50 SUBMITTED timesheet IDs to approve in a single transaction." })
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  timesheetIds!: string[];
}

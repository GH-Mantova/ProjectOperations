import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

export const LEAVE_TYPES = [
  "annual",
  "sick",
  "personal",
  "long_service",
  "unpaid",
  "other"
] as const;

export const LEAVE_STATUSES = ["PENDING", "APPROVED", "DECLINED", "CANCELLED"] as const;

export class CreateWorkerLeaveDto {
  @ApiProperty() @IsString() workerProfileId!: string;
  @ApiProperty({ enum: LEAVE_TYPES }) @IsIn(LEAVE_TYPES as never) leaveType!: string;
  @ApiProperty() @IsDateString() startDate!: string;
  @ApiProperty() @IsDateString() endDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateWorkerLeaveStatusDto {
  @ApiProperty({ enum: LEAVE_STATUSES }) @IsIn(LEAVE_STATUSES as never) status!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class CreateWorkerUnavailabilityDto {
  @ApiProperty() @IsString() workerProfileId!: string;
  @ApiProperty() @IsString() @MaxLength(500) reason!: string;
  @ApiProperty() @IsDateString() startDate!: string;
  @ApiProperty() @IsDateString() endDate!: string;
  @ApiPropertyOptional({ description: "0=Sun ... 6=Sat (weekly recurrence)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  recurringDay?: number;
}

export class AvailabilityRangeQueryDto {
  @ApiProperty() @IsDateString() from!: string;
  @ApiProperty() @IsDateString() to!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() workerProfileId?: string;
}

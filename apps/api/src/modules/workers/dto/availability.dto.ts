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

/**
 * Payload for lodging a worker leave request. Status defaults to PENDING
 * via the schema. Ownership is enforced server-side: non-super-users may
 * only lodge for their own linked worker profile.
 */
export class CreateWorkerLeaveDto {
  /** Target WorkerProfile id. */
  @ApiProperty() @IsString() workerProfileId!: string;
  /** Leave category — see LEAVE_TYPES. */
  @ApiProperty({ enum: LEAVE_TYPES }) @IsIn(LEAVE_TYPES as never) leaveType!: string;
  /** Inclusive start date (ISO). */
  @ApiProperty() @IsDateString() startDate!: string;
  /** Inclusive end date (ISO); must be on or after startDate. */
  @ApiProperty() @IsDateString() endDate!: string;
  /** Optional notes from the requester. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

/**
 * Payload for changing a leave request's status. Self-approval is blocked
 * server-side; CANCELLED is allowed self-serve.
 */
export class UpdateWorkerLeaveStatusDto {
  /** New status — see LEAVE_STATUSES. */
  @ApiProperty({ enum: LEAVE_STATUSES }) @IsIn(LEAVE_STATUSES as never) status!: string;
  /** Optional notes; falls back to the existing notes when omitted. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

/**
 * Payload for creating a worker unavailability block (RDO, training,
 * weekly hold). recurringDay turns it into a weekly recurrence within
 * the date range.
 */
export class CreateWorkerUnavailabilityDto {
  /** Target WorkerProfile id. */
  @ApiProperty() @IsString() workerProfileId!: string;
  /** Short reason shown to the scheduler (e.g. "RDO", "Training"). */
  @ApiProperty() @IsString() @MaxLength(500) reason!: string;
  /** Inclusive start date (ISO). */
  @ApiProperty() @IsDateString() startDate!: string;
  /** Inclusive end date (ISO); must be on or after startDate. */
  @ApiProperty() @IsDateString() endDate!: string;
  /** 0=Sun ... 6=Sat (weekly recurrence). When set, the overlay expands one-day bars on matching days within the range. */
  @ApiPropertyOptional({ description: "0=Sun ... 6=Sat (weekly recurrence)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  recurringDay?: number;
}

/**
 * Query parameters for the scheduler availability overlay endpoint.
 */
export class AvailabilityRangeQueryDto {
  /** Window start (ISO date). */
  @ApiProperty() @IsDateString() from!: string;
  /** Window end (ISO date); must be on or after from. */
  @ApiProperty() @IsDateString() to!: string;
  /** Optional filter to a single worker. */
  @ApiPropertyOptional() @IsOptional() @IsString() workerProfileId?: string;
}

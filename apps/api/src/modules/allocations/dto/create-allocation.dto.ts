import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * The two allocation target kinds. `WORKER` allocations carry a
 * `workerProfileId`; `ASSET` allocations carry an `assetId`. The pairing is
 * enforced in {@link AllocationsService.create} — supplying both or
 * neither is rejected with 400.
 */
export const ALLOCATION_TARGETS = ["WORKER", "ASSET"] as const;
export type AllocationTargetType = (typeof ALLOCATION_TARGETS)[number];

/**
 * Payload for `POST /projects/:projectId/allocations` — creates either a
 * worker or asset allocation depending on `type`.
 *
 * The DTO permits both `workerProfileId` and `assetId` to be absent because
 * exactly one of them is required for each `type`, and the pairing is
 * enforced at the service layer (not via class-validator) so the error
 * message can describe the type-specific rule. See
 * {@link AllocationsService.create} for the exact contract and side
 * effects (overlap warnings, competency soft-warn, activity log,
 * notification email).
 */
export class CreateAllocationDto {
  /** Target kind. WORKER → must set workerProfileId. ASSET → must set assetId. */
  @ApiProperty({ enum: ALLOCATION_TARGETS }) @IsEnum(ALLOCATION_TARGETS) type!: AllocationTargetType;

  /** Worker profile id. REQUIRED when `type === 'WORKER'`; forbidden otherwise. */
  @ApiPropertyOptional() @IsOptional() @IsString() workerProfileId?: string;

  /** Asset id. REQUIRED when `type === 'ASSET'`; forbidden otherwise. */
  @ApiPropertyOptional() @IsOptional() @IsString() assetId?: string;

  /** Free-text role on this project (e.g. "Site supervisor", "Excavator operator"). Display only — not validated against a role enum. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) roleOnProject?: string;

  /** Allocation start (inclusive). ISO date — `YYYY-MM-DD` or full ISO accepted. */
  @ApiProperty({ description: "ISO date string (YYYY-MM-DD or full ISO)." })
  @IsDateString()
  startDate!: string;

  /** Allocation end (inclusive). Omit for an open-ended allocation. When present must be on or after `startDate`. */
  @ApiPropertyOptional({ description: "ISO date string. Omit for open-ended allocations." })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  /** Operator free-text notes. Capped at 500 chars to keep the row compact. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

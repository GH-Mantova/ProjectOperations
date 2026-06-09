import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Payload for `PATCH /projects/:projectId/allocations/:allocId`.
 *
 * Notably ABSENT: `type`, `workerProfileId`, `assetId`. These are immutable
 * after create — a re-target is a delete + create so the activity-log
 * lineage stays clean. Only the operational fields below are mutable.
 *
 * Date order is re-validated against the EFFECTIVE values (incoming if
 * provided, else stored) in {@link AllocationsService.update}, so a partial
 * PATCH that supplies only `startDate` cannot invert the allocation
 * window.
 */
export class UpdateAllocationDto {
  /** New role label. Same semantics as on create — free text, ≤120 chars. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) roleOnProject?: string;

  /** New start date (inclusive). Omit to leave the stored value unchanged. */
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;

  /**
   * New end date (inclusive). Omit to leave unchanged. NOTE: the API does
   * not currently expose a "clear end date" semantics through this DTO —
   * to reopen a closed allocation the row must be deleted and recreated.
   */
  @ApiPropertyOptional({ description: "Pass null via omission to leave unchanged; pass value to set." })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  /** New notes. Same 500-char cap as create. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

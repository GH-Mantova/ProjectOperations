// ASB_ENCLOSURE_LINES_V1 -- DTOs for ScopeItemEnclosureLine CRUD.

import { IsNumber, IsOptional, IsString, Min } from "class-validator";

/**
 * Body for POST enclosure-lines.
 * Only enclosureType and qty are required; unit and rate are resolved
 * server-side from the rate table.
 */
export class CreateEnclosureLineDto {
  @IsString()
  enclosureType!: string;

  @IsNumber()
  @Min(0)
  qty!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

/**
 * Body for PATCH enclosure-lines/:lineId.
 * All fields optional; type change is not allowed (delete + re-add).
 */
export class PatchEnclosureLineDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  qty?: number;

  /**
   * Per-line rate override. null clears the override (revert to snapshotted rate).
   * 0 is a real value (free line).
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  rateOverride?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

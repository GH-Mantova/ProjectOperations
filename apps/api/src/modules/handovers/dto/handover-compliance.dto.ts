// B-HW-9: DTOs for the compliance-items endpoints.

import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";

// ─── Add manual item ──────────────────────────────────────────────────────────

/**
 * Body for `POST /handovers/:id/compliance-items`.
 *
 * Creates a manual compliance obligation row on the given handover.
 */
export class AddManualComplianceItemDto {
  /** Human-readable obligation label, e.g. "SWMS — Electrical". */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  type!: string;

  /** Which party is responsible for this obligation. */
  @IsIn(["us", "client"])
  responsibleParty!: "us" | "client";

  /** Initial lifecycle status (defaults to "pending" in the service). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  status?: string;

  /** Optional document reference (SharePoint path, doc ID, etc.). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  docRef?: string;
}

// ─── Update item ──────────────────────────────────────────────────────────────

/**
 * Body for `PATCH /handovers/:id/compliance-items/:itemId`.
 *
 * All fields are optional; only supplied fields are changed.
 */
export class UpdateComplianceItemDto {
  /** Replacement obligation label. Must not be an empty string when supplied. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  type?: string;

  /** Override responsible party. */
  @IsOptional()
  @IsIn(["us", "client"])
  responsibleParty?: "us" | "client";

  /** Override lifecycle status. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  status?: string;

  /** Override or clear the document reference. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  docRef?: string;
}

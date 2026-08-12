import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * Body for `POST /handovers` — create a handover for a contract.
 *
 * The service resolves tenderId from the contract's linked project.
 * `templateVersionId` is optional; when omitted the currently-active
 * HandoverTemplate version is pinned automatically.
 */
export class CreateHandoverBodyDto {
  /** Contract to create the handover for. */
  @IsString() @IsNotEmpty() contractId!: string;

  /**
   * Optional: pin a specific template version. Omit to use the current active.
   */
  @IsOptional() @IsString() templateVersionId?: string;
}

// ─── Patch values ────────────────────────────────────────────────────────────

/**
 * One item in a batch PATCH of handover field values.
 *
 * - `fieldKey`   — stable key matching a HandoverTemplateField.key.
 * - `value`      — the new JSON value (text, number, date string, etc.).
 * - `sectionDone?` — when present, sets the `sectionDone` flag on this
 *   value row. Use this to mark/unmark a section as complete.
 */
export class PatchValueItemDto {
  @IsString() @IsNotEmpty() fieldKey!: string;
  // value is deliberately untyped — any valid JSON is accepted.
  value!: unknown;
  @IsOptional() @IsBoolean() sectionDone?: boolean;
}

/**
 * Body for `PATCH /handovers/:id/values` — upsert one or more field values.
 */
export class PatchHandoverValuesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PatchValueItemDto)
  values!: PatchValueItemDto[];
}

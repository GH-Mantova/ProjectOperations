import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsNumber, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Payload for `POST /forms/submissions` — creates a draft against the
 * latest version of the named template.
 */
export class CreateDraftDto {
  /** Template id to draft against; the latest version is selected by the service. */
  @ApiProperty()
  @IsString()
  templateId!: string;
}

/**
 * Payload for `PATCH /forms/submissions/:id/values` — partial update of
 * a draft submission's field values.
 */
export class UpdateSubmissionValuesDto {
  /** fieldKey → value map. Only fields included are updated; omitted keys keep their stored values. */
  @ApiProperty({ description: "fieldKey → value map. Only fields included are updated." })
  @IsObject()
  values!: Record<string, unknown>;

  /**
   * F-3 — Per-repeating-section entries: `{ [sectionKey]: [{ fieldKey: value }, ...] }`.
   * Each array element becomes one entry (entryIndex = array position). Sending
   * an empty array for a section clears that section's entries; omitting a
   * section key leaves its stored entries untouched. Non-repeating sections'
   * values continue to go through the flat `values` map above.
   */
  @ApiPropertyOptional({
    description:
      "Per-repeating-section entries. Object keyed by sectionKey; each value is an array of per-entry {fieldKey: value} maps."
  })
  @IsOptional()
  @IsObject()
  sectionEntries?: Record<string, Array<Record<string, unknown>>>;
}

/**
 * Payload for `POST /forms/submissions/:id/submit` — finalises a draft
 * and runs the validation/compliance/approval pipeline.
 */
export class SubmitSubmissionDto {
  /** Optional latitude captured at submit time when the template enables geolocation. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gpsLat?: number;

  /** Optional longitude captured at submit time when the template enables geolocation. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gpsLng?: number;

  /**
   * F-2c — keys of WARN-typed on_submit rule actions the submitter has
   * acknowledged. Empty/omitted when no warnings match; the engine bounces
   * the submit with a 422 whose body lists the missing acknowledgements so
   * the client can prompt and re-submit.
   */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  acknowledgedWarnings?: string[];
}

/**
 * Payload for `POST /forms/submissions/:id/approve` — advances the
 * next pending step in the approval chain.
 */
export class ApproveSubmissionDto {
  /** Optional approver comment stored on the approval step (max 2000 chars). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

/**
 * Payload for `POST /forms/submissions/:id/reject` — rejects the next
 * pending step and moves the submission to `rejected`. The comment is
 * mandatory and relayed to the submitter.
 */
export class RejectSubmissionDto {
  /** Required — sent to submitter as the rejection reason (max 2000 chars). */
  @ApiProperty({ description: "Required — sent to submitter as the rejection reason." })
  @IsString()
  @MaxLength(2000)
  comment!: string;
}

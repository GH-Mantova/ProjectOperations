import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

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

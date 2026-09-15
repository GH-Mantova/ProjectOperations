import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { UpsertFormTemplateDto } from "./forms.dto";

/**
 * Response returned by `POST /forms/templates/build-from-pdf` -- the
 * caller navigates to `/forms/designer/:id` to review and publish the
 * generated draft. Templates are always created in DRAFT status;
 * publishing is a separate, human-driven step.
 */
export class BuildFormFromPdfResponseDto {
  @ApiProperty({ description: "Id of the newly created DRAFT FormTemplate." })
  id!: string;

  @ApiProperty({ description: "Human-readable name derived from the PDF." })
  name!: string;

  @ApiProperty({
    description:
      "AI provider that produced the draft (audit hint only -- the caller should not branch on this)."
  })
  provider!: string;

  @ApiProperty({ description: "Number of fields the AI proposed across all sections." })
  fieldCount!: number;

  @ApiProperty({ description: "Number of sections the AI proposed." })
  sectionCount!: number;
}

/**
 * Request body for `POST /forms/templates/build-from-description`.
 */
export class BuildFormFromDescriptionDto {
  @ApiProperty({
    description:
      "Plain-language description of the form to generate (e.g. \"a working-at-heights permit with 2-stage sign-off\"). Max 2000 characters.",
    example: "A working-at-heights permit with hazard identification, risk controls, and 2-stage supervisor sign-off."
  })
  @IsString()
  description!: string;
}

/**
 * Response returned by `POST /forms/templates/build-from-description` --
 * identical shape to BuildFormFromPdfResponseDto.
 */
export class BuildFormFromDescriptionResponseDto {
  @ApiProperty({ description: "Id of the newly created DRAFT FormTemplate." })
  id!: string;

  @ApiProperty({ description: "Human-readable name derived from the description." })
  name!: string;

  @ApiProperty({
    description:
      "AI provider that produced the draft (audit hint only -- the caller should not branch on this)."
  })
  provider!: string;

  @ApiProperty({ description: "Number of fields the AI proposed across all sections." })
  fieldCount!: number;

  @ApiProperty({ description: "Number of sections the AI proposed." })
  sectionCount!: number;
}

/**
 * One field descriptor in the `fields` array for `POST /forms/templates/draft-rule`.
 */
export class RuleDraftFieldDto {
  @ApiProperty({ description: "Stable machine key for this field." })
  @IsString()
  fieldKey!: string;

  @ApiProperty({ description: "Human-readable label shown to form authors." })
  @IsString()
  label!: string;

  @ApiProperty({ description: "Field type (e.g. text, checkbox, signature)." })
  @IsString()
  fieldType!: string;
}

/**
 * Request body for `POST /forms/templates/draft-rule`.
 */
export class DraftRuleDto {
  @ApiProperty({
    description:
      "Plain-language description of the rule to draft (e.g. \"when hazard severity is Critical, require supervisor sign-off\"). Max 1000 characters.",
    example: "When the worker marks a hazard as critical, require a supervisor signature and warn before submit."
  })
  @IsString()
  ruleDescription!: string;

  @ApiProperty({
    type: [RuleDraftFieldDto],
    description:
      "The current form's field list. The AI will only reference fieldKey values from this list."
  })
  fields!: RuleDraftFieldDto[];
}

// ── FV2-S2: Preview-import DTOs ────────────────────────────────────────────

/**
 * Response from `POST /forms/templates/preview-import` and
 * `GET /forms/templates/preview-import/:jobId`.
 *
 * The `proposal` is the reviewer-editable UpsertFormTemplateDto; `provenance`
 * is a flat map of fieldKey -> provenance metadata (review-only, never
 * persisted).
 */
export class PreviewImportResponseDto {
  @ApiProperty({ description: "Unique job identifier. Valid for 30 minutes." })
  jobId!: string;

  @ApiProperty({ description: "Full extracted text from the document, including page markers." })
  extractedText!: string;

  @ApiProperty({ description: "Number of pages detected in the document." })
  pages!: number;

  @ApiProperty({ description: "AI-generated form template proposal. Editable by the reviewer." })
  proposal!: UpsertFormTemplateDto;

  @ApiProperty({
    description:
      "Per-field provenance metadata (review-only, never persisted). Key is fieldKey."
  })
  provenance!: Record<string, unknown>;
}

/**
 * Request body for `POST /forms/templates/preview-import/:jobId/create`.
 *
 * The reviewer's (possibly edited) UpsertFormTemplateDto is sent back here.
 * `code` is honoured as sent; a collision produces the existing 409.
 */
export class PreviewImportCreateDto {
  @ApiProperty({ description: "The reviewed (and possibly edited) form template proposal." })
  @IsObject()
  @ValidateNested()
  @Type(() => UpsertFormTemplateDto)
  proposal!: UpsertFormTemplateDto;
}

/**
 * Response from `POST /forms/templates/preview-import/:jobId/create`.
 */
export class PreviewImportCreateResponseDto {
  @ApiProperty({ description: "Id of the newly created DRAFT FormTemplate." })
  id!: string;
}

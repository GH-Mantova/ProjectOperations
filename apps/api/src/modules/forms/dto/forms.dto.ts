import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

/**
 * Query parameters for listing form templates or submissions — extends
 * pagination with optional free-text search and exact-status filters.
 */
export class FormsQueryDto extends PaginationQueryDto {
  /** Free-text term matched case-insensitively against name/code (templates) or summary/template-name (submissions). */
  @IsOptional() @IsString() q?: string;
  /** Exact-match status filter (e.g. "ACTIVE", "submitted"). */
  @IsOptional() @IsString() status?: string;
}

/**
 * One field definition inside a FormSectionInputDto when creating or
 * appending a template version.
 */
export class FormFieldInputDto {
  /** Stable machine key — used by submissions and rule references. */
  @IsString() fieldKey!: string;
  /** Human label shown to the worker filling the form. */
  @IsString() label!: string;
  /**
   * Field type identifier (text/number/date/select/etc.); shapes value coercion at submit.
   *
   * Includes the `existing_site` picker — a dropdown of `Site` rows whose value
   * is a Site.id. When `isRequired`, submit enforces "must choose a site"
   * per-form at validation time; the DB column `FormSubmission.siteId` remains
   * nullable (per-form choice, not a schema constraint).
   */
  @IsString() fieldType!: string;
  /** Render order within the section (ascending). */
  @Type(() => Number) @IsInt() fieldOrder!: number;
  /** When true, the submit pipeline rejects submissions missing this field. */
  @IsOptional() @IsBoolean() isRequired?: boolean;
  /** Optional placeholder shown in the input. */
  @IsOptional() @IsString() placeholder?: string;
  /** Optional help text rendered beneath the field. */
  @IsOptional() @IsString() helpText?: string;
  /** Field-type-specific options blob (e.g. select choices). */
  @IsOptional() optionsJson?: unknown;
  /**
   * Field-type-specific config blob (e.g. `{ maxRating }` for star ratings,
   * `{ min, max, minLabel, maxLabel }` for scale, `{ imageUrl }` for static
   * image blocks). Mirrors the `FormField.config` column added by PR #97.
   */
  @IsOptional() config?: unknown;
  /**
   * For `content_block` fields: the unique code of a FormContentSnippet
   * whose bodyHtml is rendered at fill time. Resolved and attached as
   * `_snippet` on the field when a template version is fetched.
   */
  @IsOptional() @IsString() snippetCode?: string;
}

/**
 * One section in an UpsertFormTemplateDto — a titled group of ordered
 * fields.
 */
export class FormSectionInputDto {
  /** Section heading. */
  @IsString() title!: string;
  /** Optional descriptive blurb under the heading. */
  @IsOptional() @IsString() description?: string;
  /** Render order within the template version (ascending). */
  @Type(() => Number) @IsInt() sectionOrder!: number;
  /** Ordered field definitions belonging to this section. */
  @IsArray() @ValidateNested({ each: true }) @Type(() => FormFieldInputDto) fields!: FormFieldInputDto[];
}

/**
 * Legacy show/hide-style rule stored as a FormRule row — distinct from
 * the richer JSON FieldRule contract evaluated by RulesEngineService.
 */
export class FormRuleInputDto {
  /** Field key whose value triggers the rule. */
  @IsString() sourceFieldKey!: string;
  /** Field key the effect is applied to. */
  @IsString() targetFieldKey!: string;
  /** Comparison operator name (string-typed; semantics are interpreted downstream). */
  @IsString() operator!: string;
  /** Optional comparison value (text-serialised). */
  @IsOptional() @IsString() comparisonValue?: string;
  /** Effect applied when the comparison matches; defaults to "SHOW". */
  @IsOptional() @IsString() effect?: string;
}

/**
 * Payload for createTemplate (new template + version 1) and
 * createNextVersion (template metadata patch + new version). Templates
 * are immutable-by-version — every edit produces a new
 * FormTemplateVersion rather than mutating prior versions.
 */
export class UpsertFormTemplateDto {
  /** Display name of the template; must be unique within the tenant. */
  @IsString() name!: string;
  /** Short machine code; must be unique within the tenant. */
  @IsString() code!: string;
  /** Optional template description. */
  @IsOptional() @IsString() description?: string;
  /** Template status (e.g. "ACTIVE", "ARCHIVED"); defaults to "ACTIVE". */
  @IsOptional() @IsString() status?: string;
  /** Whether the engine captures GPS at submit. */
  @IsOptional() @IsBoolean() geolocationEnabled?: boolean;
  /** Entity types this template may be linked to (e.g. ["job", "asset"]). */
  @IsOptional() @IsArray() associationScopes?: string[];
  /** Sections, ordered; at least one required. */
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => FormSectionInputDto) sections!: FormSectionInputDto[];
  /** Optional legacy FormRule[] for the version. */
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FormRuleInputDto) rules?: FormRuleInputDto[];
}

/**
 * Metadata-only patch for an existing form template — never touches
 * versions/sections/fields. Used by `PATCH /forms/templates/:id`.
 */
export class UpdateFormTemplateMetadataDto {
  /** Display name; must remain unique within the tenant. */
  @IsOptional() @IsString() name?: string;
  /** Optional description. */
  @IsOptional() @IsString() description?: string;
  /** Category slug (safety|asbestos|plant|...); see FormTemplate.category. */
  @IsOptional() @IsString() category?: string;
  /** Whether the engine captures GPS at submit. */
  @IsOptional() @IsBoolean() geolocationEnabled?: boolean;
  /** Free-form settings blob (approvalChain, complianceGate, pdfExport, etc.). */
  @IsOptional() settings?: unknown;
}

/**
 * One field value inside a SubmitFormDto. Exactly one of the value*
 * columns is populated according to the field type; the rest are null.
 */
export class FormSubmissionValueInputDto {
  /** Field key on the template version being submitted against. */
  @IsString() fieldKey!: string;
  /** Text value for text/select/textarea fields. */
  @IsOptional() @IsString() valueText?: string;
  /** Numeric value for number/currency/percentage/rating fields. */
  @IsOptional() valueNumber?: number;
  /** ISO date-time string for date/datetime/time fields. */
  @IsOptional() @IsDateString() valueDateTime?: string;
  /** Structured value for repeating/choice-array/JSON fields. */
  @IsOptional() valueJson?: unknown;
}

/**
 * One attachment row associated with a submission — typically uploaded
 * client-side ahead of submit, then referenced here by URL.
 */
export class FormAttachmentInputDto {
  /** Optional field key this attachment is associated with. */
  @IsOptional() @IsString() fieldKey?: string;
  /** Original file name. */
  @IsString() fileName!: string;
  /** Storage URL (SharePoint / CDN); optional when only metadata is captured. */
  @IsOptional() @IsString() fileUrl?: string;
}

/**
 * One captured signature on a submission. Defaults signedAt to now when
 * omitted.
 */
export class FormSignatureInputDto {
  /** Optional field key this signature is associated with. */
  @IsOptional() @IsString() fieldKey?: string;
  /** Display name of the signer. */
  @IsString() signerName!: string;
  /** ISO timestamp when signed; defaults to submit time. */
  @IsOptional() @IsDateString() signedAt?: string;
}

/**
 * Payload for the raw `POST /forms/versions/:versionId/submissions`
 * endpoint — bypasses the worker draft/submit pipeline. Used by import
 * tooling and tests; the engine pipeline lives in FormsEngineService.
 */
export class SubmitFormDto {
  /** Submission status; defaults to "SUBMITTED". */
  @IsOptional() @IsString() status?: string;
  /** Optional link to a job. */
  @IsOptional() @IsString() jobId?: string;
  /** Optional link to a client. */
  @IsOptional() @IsString() clientId?: string;
  /** Optional link to an asset. */
  @IsOptional() @IsString() assetId?: string;
  /** Optional link to a worker. */
  @IsOptional() @IsString() workerId?: string;
  /** Optional link to a site. */
  @IsOptional() @IsString() siteId?: string;
  /** Optional link to a shift. */
  @IsOptional() @IsString() shiftId?: string;
  /** Free-text supplier name for forms that aren't bound to a directory record. */
  @IsOptional() @IsString() supplierName?: string;
  /** Captured GPS string (lat,lng) when the template enables geolocation. */
  @IsOptional() @IsString() geolocation?: string;
  /** Optional human-readable summary stored on the row for list views. */
  @IsOptional() @IsString() summary?: string;
  /** Field values for the submission; required fields on the template must all be present. */
  @IsArray() @ValidateNested({ each: true }) @Type(() => FormSubmissionValueInputDto) values!: FormSubmissionValueInputDto[];
  /** Optional attachments captured with the submission. */
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FormAttachmentInputDto) attachments?: FormAttachmentInputDto[];
  /** Optional signatures captured with the submission. */
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FormSignatureInputDto) signatures?: FormSignatureInputDto[];
}

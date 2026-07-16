import { IsBoolean, IsInt, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

/**
 * Query parameters for listing content snippets.
 */
export class SnippetsQueryDto extends PaginationQueryDto {
  /** Free-text search matched case-insensitively against name or code. */
  @IsOptional() @IsString() q?: string;
  /** Filter by category. */
  @IsOptional() @IsString() category?: string;
  /** When true, include inactive snippets (default: only active). */
  @IsOptional() @IsBoolean() @Type(() => Boolean) includeInactive?: boolean;
}

/**
 * Payload for creating a new FormContentSnippet.
 */
export class CreateSnippetDto {
  /** Unique machine code (e.g. "GUARANTEE_14DAY", "PRIVACY_NOTICE"). */
  @IsString() code!: string;
  /** Human-readable display name. */
  @IsString() name!: string;
  /** Category slug (e.g. "legal", "privacy", "safety", "general"). */
  @IsOptional() @IsString() category?: string;
  /** Full HTML content of the snippet. */
  @IsString() bodyHtml!: string;
}

/**
 * Payload for updating an existing FormContentSnippet.
 * Bumps the version counter on save.
 */
export class UpdateSnippetDto {
  /** Updated display name. */
  @IsOptional() @IsString() name?: string;
  /** Updated category. */
  @IsOptional() @IsString() category?: string;
  /** Updated HTML content. */
  @IsOptional() @IsString() bodyHtml?: string;
  /** Whether this snippet is active (shown to form designers). */
  @IsOptional() @IsBoolean() isActive?: boolean;
}

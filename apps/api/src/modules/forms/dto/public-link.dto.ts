import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";

/**
 * Payload to mint a new public/kiosk link for a form template.
 * Requires `forms.manage` permission.
 */
export class CreatePublicLinkDto {
  /** Template to generate the link for. */
  @ApiProperty()
  @IsString()
  templateId!: string;

  /** "public" = single-or-multi submit tokenised link; "kiosk" = shared-device repeated submit. */
  @ApiPropertyOptional({ enum: ["public", "kiosk"], default: "public" })
  @IsOptional()
  @IsIn(["public", "kiosk"])
  mode?: "public" | "kiosk";

  /** Optional human label shown in the admin link list. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  /** Optional ISO date after which the link rejects submissions. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  /** Optional site context pre-applied to every submission via this link. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  /** Optional job context pre-applied to every submission via this link. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobId?: string;

  /** Cap on total submissions before the link auto-deactivates. Null = unlimited. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxSubmissions?: number;
}

/**
 * Patch payload: toggle isActive or update label / expiry.
 */
export class UpdatePublicLinkDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxSubmissions?: number;
}

/**
 * Body for an anonymous public-link submission.
 * The templateVersion is resolved server-side from the token.
 */
export class PublicSubmitDto {
  /** fieldKey -> value map for all filled fields. */
  @ApiProperty({ description: "fieldKey -> value map" })
  values!: Record<string, unknown>;

  /** Optional submitter display name (stored in context for sign-in sheets). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  submitterName?: string;

  /** Optional GPS latitude at submit time. */
  @ApiPropertyOptional()
  @IsOptional()
  gpsLat?: number;

  /** Optional GPS longitude at submit time. */
  @ApiPropertyOptional()
  @IsOptional()
  gpsLng?: number;
}

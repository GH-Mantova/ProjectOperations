import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsInt, IsObject, IsOptional } from "class-validator";

/**
 * `cells` is a JSON map keyed by RateColumn.id → typed value. Structural
 * type-checking happens in the validation service (it needs the column
 * definitions to know what to expect per key).
 */
export class CreateRateRowDto {
  @ApiProperty({ type: "object", additionalProperties: true })
  @IsObject()
  cells!: Record<string, unknown>;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveFrom?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveTo?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateRateRowDto {
  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  cells?: Record<string, unknown>;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveFrom?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveTo?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

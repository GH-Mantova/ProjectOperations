import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export enum RateTableCategoryDto {
  INITIAL_SERVICES = "INITIAL_SERVICES",
  SUBCONTRACTOR = "SUBCONTRACTOR"
}

export class CreateRateTableDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(160) name!: string;

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(160) slug!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;

  @ApiProperty({ enum: RateTableCategoryDto }) @IsEnum(RateTableCategoryDto) category!: RateTableCategoryDto;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) subcontractorType?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() supplierId?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isSystem?: boolean;

  @ApiPropertyOptional({
    description:
      "Reference tables hold factors (production rates, densities…) — resolvable via the seam but excluded from the priced tender snapshot."
  })
  @IsOptional()
  @IsBoolean()
  isReference?: boolean;
}

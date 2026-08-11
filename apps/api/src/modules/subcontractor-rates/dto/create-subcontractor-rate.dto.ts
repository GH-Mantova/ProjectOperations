import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsDecimal, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { IS_DISCIPLINE_CODES } from "../../personas/definitions/disciplines";

export class CreateSubcontractorRateDto {
  @ApiProperty({
    description: "Discipline scope code. One of DEM / CIV / ASB / Other.",
    enum: IS_DISCIPLINE_CODES
  })
  @IsString()
  @IsIn([...IS_DISCIPLINE_CODES], {
    message: `discipline must be one of: ${IS_DISCIPLINE_CODES.join(", ")}`
  })
  discipline!: string;

  @ApiProperty({
    description: 'Free-text unit, e.g. "hr", "day", "m2", "tonne".',
    example: "hr"
  })
  @IsString()
  @MaxLength(50)
  unit!: string;

  @ApiProperty({
    description: "Rate in AUD per unit. Stored as Decimal(10,2).",
    example: "125.00"
  })
  @IsDecimal({ decimal_digits: "0,2" })
  rate!: string;

  @ApiPropertyOptional({
    description: "Inclusive start date for this rate (ISO 8601 date string, e.g. 2026-08-11).",
    example: "2026-08-11"
  })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({
    description: "Inclusive end date for this rate. Leave blank for open-ended.",
    example: "2026-12-31"
  })
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional({ description: "Free-text notes about this rate." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ default: true, description: "Whether this rate is the active rate." })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

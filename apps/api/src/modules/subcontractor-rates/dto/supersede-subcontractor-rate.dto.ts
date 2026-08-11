import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsDecimal, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { IS_DISCIPLINE_CODES } from "../../personas/definitions/disciplines";

/**
 * Superseding a rate is the ONLY allowed "edit" path (append-only supersede rule,
 * sot/01-charter-and-architecture.md, 2026-07-23).
 *
 * The old rate's isActive is set to false (and optionally its validTo is closed)
 * in the same transaction that creates the new row. The new row carries the
 * revised rate/unit/discipline/notes.
 *
 * Fields that are omitted copy forward from the old row.
 */
export class SupersedeSubcontractorRateDto {
  @ApiPropertyOptional({
    description: "New discipline scope code. One of DEM / CIV / ASB / Other.",
    enum: IS_DISCIPLINE_CODES
  })
  @IsOptional()
  @IsString()
  @IsIn([...IS_DISCIPLINE_CODES], {
    message: `discipline must be one of: ${IS_DISCIPLINE_CODES.join(", ")}`
  })
  discipline?: string;

  @ApiPropertyOptional({
    description: 'New free-text unit, e.g. "hr", "day", "m2", "tonne".',
    example: "hr"
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @ApiProperty({
    description: "New rate in AUD per unit. Stored as Decimal(10,2).",
    example: "140.00"
  })
  @IsDecimal({ decimal_digits: "0,2" })
  rate!: string;

  @ApiPropertyOptional({
    description: "Inclusive start date for the new rate row (ISO 8601 date string).",
    example: "2026-09-01"
  })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({
    description: "Inclusive end date for the new rate row. Leave blank for open-ended.",
    example: "2027-06-30"
  })
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional({ description: "Notes for the new rate row." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    description: "If supplied, sets the old rate's validTo to this date when superseding.",
    example: "2026-08-31"
  })
  @IsOptional()
  @IsDateString()
  closeOldValidTo?: string;
}

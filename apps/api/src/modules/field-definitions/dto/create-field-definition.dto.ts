import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { FieldAppliesTo } from "@prisma/client";

export class CreateFieldDefinitionDto {
  /**
   * Kebab-slug key — letters, digits and hyphens only.
   * Immutable once created (service enforces; DTO narrows the write path).
   */
  @ApiProperty({ example: "purchase-order-number", description: "Kebab-slug key (immutable after creation)." })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "key must be a kebab-slug: lowercase letters, digits, and hyphens only (e.g. my-field-name)."
  })
  key!: string;

  @ApiProperty({ example: "Purchase Order Number" })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @ApiPropertyOptional({ example: "Finance", description: "Display group / section heading." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  group?: string;

  @ApiPropertyOptional({ enum: FieldAppliesTo })
  @IsEnum(FieldAppliesTo)
  appliesTo!: FieldAppliesTo;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

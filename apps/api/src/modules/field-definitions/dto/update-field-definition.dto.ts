import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

/**
 * Only the mutable fields are declared here.
 * key, source, and appliesTo are immutable — the service rejects them if
 * supplied, but omitting them from the DTO gives a clean 400 from the
 * ValidationPipe before the service even runs.
 */
export class UpdateFieldDefinitionDto {
  @ApiPropertyOptional({ example: "Purchase Order Number" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label?: string;

  @ApiPropertyOptional({ example: "Finance" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  group?: string;

  @ApiPropertyOptional({ example: 10, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

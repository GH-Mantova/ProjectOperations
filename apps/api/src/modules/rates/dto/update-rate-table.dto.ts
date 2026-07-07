import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateRateTableDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) subcontractorType?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() supplierId?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isSystem?: boolean;
}

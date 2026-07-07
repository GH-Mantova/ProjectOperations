import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";

export enum RateColumnDataTypeDto {
  TEXT = "TEXT",
  NUMBER = "NUMBER",
  CURRENCY = "CURRENCY",
  DATE = "DATE",
  BOOL = "BOOL",
  LIST_REF = "LIST_REF"
}

export enum RateColumnRoleDto {
  KEY = "KEY",
  VALUE = "VALUE",
  INFO = "INFO"
}

export class CreateRateColumnDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name!: string;

  @ApiProperty({ enum: RateColumnDataTypeDto })
  @IsEnum(RateColumnDataTypeDto)
  dataType!: RateColumnDataTypeDto;

  @ApiProperty({ enum: RateColumnRoleDto }) @IsEnum(RateColumnRoleDto) role!: RateColumnRoleDto;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) unit?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) listSlug?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() required?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsNumber() min?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() max?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateRateColumnDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) name?: string;

  @ApiPropertyOptional({ enum: RateColumnDataTypeDto })
  @IsOptional()
  @IsEnum(RateColumnDataTypeDto)
  dataType?: RateColumnDataTypeDto;

  @ApiPropertyOptional({ enum: RateColumnRoleDto })
  @IsOptional()
  @IsEnum(RateColumnRoleDto)
  role?: RateColumnRoleDto;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) unit?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) listSlug?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() required?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsNumber() min?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() max?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

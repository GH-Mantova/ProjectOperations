import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";

export type CredentialScope = "company" | "user";

export class CreateApiCredentialDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  typeId!: string;

  @IsIn(["company", "user"])
  scope!: CredentialScope;

  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  adapter?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  validate?: boolean;
}

export class UpdateApiCredentialDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  typeId?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  adapter?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  key?: string;
}

export class ReorderApiCredentialsDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}

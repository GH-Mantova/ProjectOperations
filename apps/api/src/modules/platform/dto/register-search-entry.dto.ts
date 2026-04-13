import { IsOptional, IsString } from "class-validator";

export class RegisterSearchEntryDto {
  @IsString()
  entityType!: string;

  @IsString()
  entityId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsString()
  module!: string;

  @IsOptional()
  @IsString()
  url?: string;
}

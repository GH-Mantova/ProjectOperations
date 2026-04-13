import { IsOptional, IsString } from "class-validator";

export class EnsureSharePointFolderDto {
  @IsString()
  name!: string;

  @IsString()
  relativePath!: string;

  @IsString()
  module!: string;

  @IsOptional()
  @IsString()
  linkedEntityType?: string;

  @IsOptional()
  @IsString()
  linkedEntityId?: string;
}

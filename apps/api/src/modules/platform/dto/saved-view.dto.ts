import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";

export class SavedViewSortDto {
  @IsString()
  key!: string;

  @IsIn(["asc", "desc"])
  dir!: "asc" | "desc";
}

export class CreateSavedViewDto {
  @IsString()
  @MaxLength(60)
  entityType!: string;

  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  columns?: unknown[];

  @IsOptional()
  @IsObject()
  sort?: { key: string; dir: "asc" | "desc" } | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateSavedViewDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  columns?: unknown[];

  @IsOptional()
  @IsObject()
  sort?: { key: string; dir: "asc" | "desc" } | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class ListSavedViewsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entityType?: string;
}

import { Transform, Type } from "class-transformer";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class DocumentsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() linkedEntityType?: string;
  @IsOptional() @IsString() linkedEntityId?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() module?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() tag?: string;
}

export class DocumentAccessRuleInputDto {
  @IsString() accessType!: string;
  @IsOptional() @IsString() roleName?: string;
  @IsOptional() @IsString() permissionCode?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() canView?: boolean;
  @IsOptional() @Type(() => Boolean) @IsBoolean() canDownload?: boolean;
  @IsOptional() @Type(() => Boolean) @IsBoolean() canOpenLink?: boolean;
}

export class CreateDocumentDto {
  @IsString() linkedEntityType!: string;
  @IsString() linkedEntityId!: string;
  @IsString() category!: string;
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() fileName!: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() versionLabel?: string;
  @IsOptional() @IsString() versionOfDocumentId?: string;
  @IsOptional() @IsString() documentFamilyKey?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentAccessRuleInputDto)
  accessRules?: DocumentAccessRuleInputDto[];
}

export class CreateDocumentVersionDto {
  @IsString() fileName!: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @IsString() versionLabel?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

export class DocumentAccessQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value ?? 0))
  @IsInt()
  @Min(0)
  mode = 0;
}

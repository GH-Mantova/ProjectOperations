import { Type } from "class-transformer";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class AssetsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() status?: string;
}

export class UpsertAssetCategoryDto {
  @IsString() name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
}

export class UpsertAssetDto {
  @IsOptional() @IsString() assetCategoryId?: string;
  @IsOptional() @IsString() resourceTypeId?: string;
  @IsString() name!: string;
  @IsString() assetCode!: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() homeBase?: string;
  @IsOptional() @IsString() currentLocation?: string;
  @IsOptional() @IsString() notes?: string;
}

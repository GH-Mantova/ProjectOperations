import { Type } from "class-transformer";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

/**
 * Query parameters for listing assets, layered on top of standard pagination.
 */
export class AssetsQueryDto extends PaginationQueryDto {
  /** Free-text search across name, assetCode, serialNumber, homeBase, currentLocation. */
  @IsOptional() @IsString() q?: string;
  /** Filter to assets in this AssetCategory id. */
  @IsOptional() @IsString() categoryId?: string;
  /** Filter to assets with this status (e.g. AVAILABLE, MAINTENANCE, OUT_OF_SERVICE). */
  @IsOptional() @IsString() status?: string;
}

/**
 * Payload for creating or updating an asset category.
 */
export class UpsertAssetCategoryDto {
  /** Unique category name (case-sensitive match). */
  @IsString() name!: string;
  /** Optional short code used in reports and exports. */
  @IsOptional() @IsString() code?: string;
  /** Optional human-readable description. */
  @IsOptional() @IsString() description?: string;
  /** Whether the category is selectable on new assets; defaults to true. */
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
}

/**
 * Payload for creating or updating an asset.
 */
export class UpsertAssetDto {
  /** Owning AssetCategory id, or null to leave uncategorised. */
  @IsOptional() @IsString() assetCategoryId?: string;
  /** Linked ResourceType id used by the scheduler to match requirements. */
  @IsOptional() @IsString() resourceTypeId?: string;
  /** Display name of the asset. */
  @IsString() name!: string;
  /** Unique internal asset code (collision rejected by service). */
  @IsString() assetCode!: string;
  /** Manufacturer serial number; if set must be unique across all assets. */
  @IsOptional() @IsString() serialNumber?: string;
  /** Operational status (AVAILABLE, MAINTENANCE, OUT_OF_SERVICE, ...); defaults to AVAILABLE. */
  @IsOptional() @IsString() status?: string;
  /** Yard / depot the asset is normally based at. */
  @IsOptional() @IsString() homeBase?: string;
  /** Current physical location, typically the active job site. */
  @IsOptional() @IsString() currentLocation?: string;
  /** Free-text notes for operators and maintainers. */
  @IsOptional() @IsString() notes?: string;
}

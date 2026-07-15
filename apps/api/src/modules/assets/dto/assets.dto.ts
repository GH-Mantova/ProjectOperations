import { Type } from "class-transformer";
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from "class-validator";
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
  /**
   * Category-level default fuel consumption (litres per 100 km). Used as a
   * fallback by the waste-transport cost calculator when a specific Asset
   * has no fuelConsumptionLPer100km. Nullable.
   */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  defaultFuelConsumptionLPer100km?: number;
  /** Category-level default nominal load capacity (tonnes). Fallback only. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  defaultNominalLoadTonnes?: number;
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
  /**
   * Per-truck fuel consumption (litres per 100 km). Marco 2026-07-15:
   * fuel burn is a property of the individual truck, not the material
   * carried. Feeds the T-1 waste-transport cost calculator; nullable.
   */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  fuelConsumptionLPer100km?: number;
  /**
   * Nominal load capacity (tonnes) as a fallback. The authoritative
   * capacity source is the Transport Capacity reference table (material
   * class × transport type) — this field only applies when no matrix row
   * matches. Nullable.
   */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  nominalLoadTonnes?: number;
}

import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

/**
 * Query parameters for listing stock items on top of standard pagination.
 */
export class InventoryItemsQueryDto extends PaginationQueryDto {
  /** Free-text search across name and sku. */
  @IsOptional() @IsString() q?: string;
  /** Filter to items in this StockCategory id. */
  @IsOptional() @IsString() categoryId?: string;
  /** When "true", only return items where quantityOnHand <= reorderLevel (and reorderLevel is set). */
  @IsOptional() @IsString() lowStockOnly?: string;
}

/**
 * Payload for creating or updating a stock category.
 */
export class UpsertStockCategoryDto {
  @IsString() name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
}

/**
 * Payload for creating or updating a stock item.
 */
export class UpsertStockItemDto {
  @IsString() name!: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsString() unit!: string;
  @IsOptional() @Type(() => Number) @IsNumber() reorderLevel?: number;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
}

/**
 * Enum mirrored from Prisma; declared here so the DTO does not import from
 * @prisma/client (keeps class-validator metadata lean).
 */
export enum StockMovementTypeDto {
  RECEIVE = "RECEIVE",
  ISSUE = "ISSUE",
  ADJUST = "ADJUST",
  RETURN = "RETURN"
}

/**
 * Payload for posting a stock movement.
 *
 * Quantity is always supplied as a positive magnitude for RECEIVE / ISSUE /
 * RETURN. For ADJUST the value is a signed delta (positive count-up,
 * negative count-down). The service applies the appropriate sign before
 * updating StockItem.quantityOnHand.
 */
export class CreateStockMovementDto {
  @IsEnum(StockMovementTypeDto) type!: StockMovementTypeDto;
  @Type(() => Number) @IsNumber() quantity!: number;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() refType?: string;
  @IsOptional() @IsString() refId?: string;
}

/**
 * Payload for opening a new stocktake session.
 */
export class CreateStocktakeDto {
  @IsOptional() @IsString() notes?: string;
}

/**
 * Payload for recording a physical count row inside a stocktake session.
 */
export class UpsertStocktakeCountDto {
  @IsString() stockItemId!: string;
  @Type(() => Number) @IsNumber() countedQty!: number;
}

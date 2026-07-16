import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { AssetsService } from "./assets.service";
import { AssetsQueryDto, CheckinAssetDto, CheckoutAssetDto, UpsertAssetCategoryDto, UpsertAssetDto } from "./dto/assets.dto";

/**
 * REST endpoints for asset and asset-category management under /assets.
 *
 * All routes require a JWT plus either `assets.view` (reads) or
 * `assets.manage` (writes). Create/update routes pass the acting user's id
 * to the service so every mutation is audit-logged.
 *
 * Checkout/check-in endpoints implement the custody chain that retires the
 * Jotform "Grice Office Key Checkout" form. Scan endpoint supports barcode
 * or QR scanner integrations (AssetTiger parity).
 */
@ApiTags("Assets")
@ApiBearerAuth()
@Controller("assets")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssetsController {
  constructor(private readonly service: AssetsService) {}

  /**
   * List asset categories.
   *
   * @returns all asset categories ordered by name ascending
   */
  @Get("categories")
  @RequirePermissions("assets.view")
  @ApiOperation({ summary: "List asset categories" })
  @ApiResponse({ status: 200, description: "List asset categories." })
  listCategories() {
    return this.service.listCategories();
  }

  /**
   * Create asset category.
   *
   * @param dto - category name, code, description, and active flag
   * @returns the created category record
   * @throws ConflictException when a category with the same name exists
   */
  @Post("categories")
  @RequirePermissions("assets.manage")
  @ApiOperation({ summary: "Create asset category" })
  @ApiResponse({ status: 201, description: "Create asset category." })
  createCategory(@Body() dto: UpsertAssetCategoryDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertCategory(undefined, dto, actor.sub);
  }

  /**
   * Update asset category.
   *
   * @param id - category id to update
   * @param dto - replacement category fields
   * @returns the updated category record
   * @throws ConflictException when another category already uses the name
   */
  @Patch("categories/:id")
  @RequirePermissions("assets.manage")
  @ApiOperation({ summary: "Update asset category" })
  @ApiResponse({ status: 200, description: "Update asset category." })
  updateCategory(@Param("id") id: string, @Body() dto: UpsertAssetCategoryDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertCategory(id, dto, actor.sub);
  }

  /**
   * Scan lookup: resolve a barcode / QR / asset-code to an asset.
   *
   * Matches Asset.barcode OR Asset.qrValue OR (fallback) Asset.assetCode.
   * Route placed before /:id to avoid the colon param swallowing "scan".
   *
   * @param code - scanned value
   * @returns full asset detail (same shape as GET /assets/:id)
   * @throws NotFoundException when no asset matches
   */
  @Get("scan/:code")
  @RequirePermissions("assets.view")
  @ApiOperation({ summary: "Resolve a barcode, QR value, or asset code to an asset" })
  @ApiResponse({ status: 200, description: "Asset found." })
  @ApiResponse({ status: 404, description: "No asset matches the scanned code." })
  scanAsset(@Param("code") code: string) {
    return this.service.scanAsset(code);
  }

  /**
   * List assets with assignment visibility.
   *
   * @param query - free-text search, category/status filters, and pagination
   * @returns paginated assets, each with a derived maintenanceSummary
   */
  @Get()
  @RequirePermissions("assets.view")
  @ApiOperation({ summary: "List assets with assignment visibility" })
  @ApiResponse({ status: 200, description: "List assets with assignment visibility." })
  listAssets(@Query() query: AssetsQueryDto) {
    return this.service.listAssets(query);
  }

  /**
   * Get asset detail including job and shift visibility.
   *
   * @param id - asset id
   * @returns the asset with linked jobs, maintenance summary, and documents
   * @throws NotFoundException when the asset does not exist
   */
  @Get(":id")
  @RequirePermissions("assets.view")
  @ApiOperation({ summary: "Get asset detail including job and shift visibility" })
  @ApiResponse({ status: 200, description: "Get asset detail including job and shift visibility." })
  getAsset(@Param("id") id: string) {
    return this.service.getAsset(id);
  }

  /**
   * Create asset.
   *
   * @param dto - asset fields including unique assetCode / serialNumber / barcode / qrValue
   * @returns the full asset detail of the created record
   * @throws ConflictException when assetCode, serialNumber, barcode, or qrValue already exists
   */
  @Post()
  @RequirePermissions("assets.manage")
  @ApiOperation({ summary: "Create asset" })
  @ApiResponse({ status: 201, description: "Create asset." })
  createAsset(@Body() dto: UpsertAssetDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertAsset(undefined, dto, actor.sub);
  }

  /**
   * Update asset.
   *
   * @param id - asset id to update
   * @param dto - replacement asset fields
   * @returns the full asset detail after update
   * @throws ConflictException when assetCode, serialNumber, barcode, or qrValue clashes with another asset
   */
  @Patch(":id")
  @RequirePermissions("assets.manage")
  @ApiOperation({ summary: "Update asset" })
  @ApiResponse({ status: 200, description: "Update asset." })
  updateAsset(@Param("id") id: string, @Body() dto: UpsertAssetDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertAsset(id, dto, actor.sub);
  }

  // ---------------------------------------------------------------------------
  // Checkout / check-in (custody chain)
  // ---------------------------------------------------------------------------

  /**
   * Check out an asset to a holder.
   *
   * Rejects with 409 if the asset already has an open checkout.
   *
   * @param id - asset id
   * @param dto - holder (workerId / userId / siteId / jobId), optional dueBackAt, notes
   * @returns the created AssetCheckout record
   */
  @Post(":id/checkout")
  @RequirePermissions("assets.manage")
  @ApiOperation({ summary: "Check out an asset to a holder" })
  @ApiResponse({ status: 201, description: "Checkout created." })
  @ApiResponse({ status: 409, description: "Asset already has an open checkout." })
  checkoutAsset(@Param("id") id: string, @Body() dto: CheckoutAssetDto, @CurrentUser() actor: { sub: string }) {
    return this.service.checkoutAsset(id, dto, actor.sub);
  }

  /**
   * Check in an asset (close the open checkout).
   *
   * @param id - asset id
   * @param dto - optional return notes
   * @returns the updated AssetCheckout record with checkedInAt set
   * @throws NotFoundException when the asset has no open checkout
   */
  @Post(":id/checkin")
  @RequirePermissions("assets.manage")
  @ApiOperation({ summary: "Check in an asset (close the open checkout)" })
  @ApiResponse({ status: 200, description: "Asset checked in." })
  @ApiResponse({ status: 404, description: "No open checkout for this asset." })
  checkinAsset(@Param("id") id: string, @Body() dto: CheckinAssetDto, @CurrentUser() actor: { sub: string }) {
    return this.service.checkinAsset(id, dto, actor.sub);
  }

  /**
   * Get custody history for an asset.
   *
   * @param id - asset id
   * @returns all checkouts for this asset, newest first
   */
  @Get(":id/checkouts")
  @RequirePermissions("assets.view")
  @ApiOperation({ summary: "List custody history for an asset" })
  @ApiResponse({ status: 200, description: "Custody history." })
  listCheckouts(@Param("id") id: string) {
    return this.service.listCheckouts(id);
  }
}

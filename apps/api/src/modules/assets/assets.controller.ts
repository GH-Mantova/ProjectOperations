import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { AssetsService } from "./assets.service";
import { AssetsQueryDto, UpsertAssetCategoryDto, UpsertAssetDto } from "./dto/assets.dto";

/**
 * REST endpoints for asset and asset-category management under /assets.
 *
 * All routes require a JWT plus either `assets.view` (reads) or
 * `assets.manage` (writes). Create/update routes pass the acting user's id
 * to the service so every mutation is audit-logged.
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
  updateCategory(@Param("id") id: string, @Body() dto: UpsertAssetCategoryDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertCategory(id, dto, actor.sub);
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
  getAsset(@Param("id") id: string) {
    return this.service.getAsset(id);
  }

  /**
   * Create asset.
   *
   * @param dto - asset fields including unique assetCode / serialNumber
   * @returns the full asset detail of the created record
   * @throws ConflictException when assetCode or serialNumber already exists
   */
  @Post()
  @RequirePermissions("assets.manage")
  @ApiOperation({ summary: "Create asset" })
  createAsset(@Body() dto: UpsertAssetDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertAsset(undefined, dto, actor.sub);
  }

  /**
   * Update asset.
   *
   * @param id - asset id to update
   * @param dto - replacement asset fields
   * @returns the full asset detail after update
   * @throws ConflictException when assetCode or serialNumber clashes with another asset
   */
  @Patch(":id")
  @RequirePermissions("assets.manage")
  @ApiOperation({ summary: "Update asset" })
  updateAsset(@Param("id") id: string, @Body() dto: UpsertAssetDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertAsset(id, dto, actor.sub);
  }
}

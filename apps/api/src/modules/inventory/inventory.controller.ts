import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { InventoryService } from "./inventory.service";
import {
  CreateStockMovementDto,
  CreateStocktakeDto,
  InventoryItemsQueryDto,
  UpsertStockCategoryDto,
  UpsertStockItemDto,
  UpsertStocktakeCountDto
} from "./dto/inventory.dto";

/**
 * REST endpoints for the native inventory / stock layer under /inventory.
 *
 * Reads require `inventory.view`; writes require `inventory.manage`. All
 * mutations pass the acting user's id to the service so movements and
 * stocktake events are audit-logged and traceable back to a person.
 */
@ApiTags("Inventory")
@ApiBearerAuth()
@Controller("inventory")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  // ── Categories ─────────────────────────────────────────────────────────

  @Get("categories")
  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "List stock categories" })
  @ApiResponse({ status: 200, description: "List stock categories." })
  listCategories() {
    return this.service.listCategories();
  }

  @Post("categories")
  @RequirePermissions("inventory.manage")
  @ApiOperation({ summary: "Create stock category" })
  @ApiResponse({ status: 201, description: "Create stock category." })
  createCategory(@Body() dto: UpsertStockCategoryDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertCategory(undefined, dto, actor.sub);
  }

  @Patch("categories/:id")
  @RequirePermissions("inventory.manage")
  @ApiOperation({ summary: "Update stock category" })
  @ApiResponse({ status: 200, description: "Update stock category." })
  updateCategory(
    @Param("id") id: string,
    @Body() dto: UpsertStockCategoryDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.upsertCategory(id, dto, actor.sub);
  }

  // ── Items ──────────────────────────────────────────────────────────────

  @Get("items")
  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "List stock items" })
  @ApiResponse({ status: 200, description: "List stock items." })
  listItems(@Query() query: InventoryItemsQueryDto) {
    return this.service.listItems(query);
  }

  @Get("items/:id")
  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "Get stock item detail with recent movements" })
  @ApiResponse({ status: 200, description: "Get stock item detail." })
  getItem(@Param("id") id: string) {
    return this.service.getItem(id);
  }

  @Post("items")
  @RequirePermissions("inventory.manage")
  @ApiOperation({ summary: "Create stock item" })
  @ApiResponse({ status: 201, description: "Create stock item." })
  createItem(@Body() dto: UpsertStockItemDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertItem(undefined, dto, actor.sub);
  }

  @Patch("items/:id")
  @RequirePermissions("inventory.manage")
  @ApiOperation({ summary: "Update stock item" })
  @ApiResponse({ status: 200, description: "Update stock item." })
  updateItem(
    @Param("id") id: string,
    @Body() dto: UpsertStockItemDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.upsertItem(id, dto, actor.sub);
  }

  // ── Movements ──────────────────────────────────────────────────────────

  @Post("items/:id/movements")
  @RequirePermissions("inventory.manage")
  @ApiOperation({ summary: "Post a stock movement (RECEIVE / ISSUE / ADJUST / RETURN)" })
  @ApiResponse({ status: 201, description: "Post a stock movement." })
  postMovement(
    @Param("id") id: string,
    @Body() dto: CreateStockMovementDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.postMovement(id, dto, actor.sub);
  }

  @Get("items/:id/movements")
  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "List stock movements for an item" })
  @ApiResponse({ status: 200, description: "List stock movements for an item." })
  listMovements(@Param("id") id: string) {
    return this.service.listMovements(id);
  }

  // ── Stocktakes ─────────────────────────────────────────────────────────

  @Post("stocktakes")
  @RequirePermissions("inventory.manage")
  @ApiOperation({ summary: "Open a stocktake session" })
  @ApiResponse({ status: 201, description: "Open a stocktake session." })
  openStocktake(@Body() dto: CreateStocktakeDto, @CurrentUser() actor: { sub: string }) {
    return this.service.openStocktake(dto, actor.sub);
  }

  @Get("stocktakes")
  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "List stocktake sessions" })
  @ApiResponse({ status: 200, description: "List stocktake sessions." })
  listStocktakes() {
    return this.service.listStocktakes();
  }

  @Get("stocktakes/:id")
  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "Get stocktake session detail with counts" })
  @ApiResponse({ status: 200, description: "Get stocktake session detail with counts." })
  getStocktake(@Param("id") id: string) {
    return this.service.getStocktake(id);
  }

  @Post("stocktakes/:id/counts")
  @RequirePermissions("inventory.manage")
  @ApiOperation({ summary: "Record a physical count row for a stocktake" })
  @ApiResponse({ status: 201, description: "Record a physical count row." })
  recordCount(
    @Param("id") id: string,
    @Body() dto: UpsertStocktakeCountDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.recordCount(id, dto, actor.sub);
  }

  @Post("stocktakes/:id/commit")
  @RequirePermissions("inventory.manage")
  @ApiOperation({ summary: "Commit a stocktake — write ADJUST movements for variances" })
  @ApiResponse({ status: 200, description: "Commit a stocktake." })
  commitStocktake(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.commitStocktake(id, actor.sub);
  }

  @Post("stocktakes/:id/cancel")
  @RequirePermissions("inventory.manage")
  @ApiOperation({ summary: "Cancel an OPEN stocktake" })
  @ApiResponse({ status: 200, description: "Cancel a stocktake." })
  cancelStocktake(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.cancelStocktake(id, actor.sub);
  }
}

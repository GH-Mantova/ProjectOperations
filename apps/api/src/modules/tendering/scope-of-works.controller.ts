import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import {
  CreateScopeItemDto,
  ReorderScopeItemsDto,
  UpdateScopeHeaderDto,
  UpdateScopeItemDto
} from "./dto/scope-of-works.dto";
import { ScopeOfWorksService } from "./scope-of-works.service";

type RequestUser = { sub: string };

@ApiTags("Scope of Works")
@ApiBearerAuth()
@Controller("tenders/:tenderId/scope")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ScopeOfWorksController {
  constructor(private readonly service: ScopeOfWorksService) {}

  // ── Header ────────────────────────────────────────────────────────────
  @Get("header")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "Get the site context header for the scope sheet (lazily created)." })
  getHeader(@Param("tenderId") tenderId: string) {
    return this.service.getHeader(tenderId);
  }

  @Patch("header")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Update the site context header (auto-saved from the collapsible form)." })
  @ApiResponse({ status: 200, description: "Updated header." })
  updateHeader(@Param("tenderId") tenderId: string, @Body() dto: UpdateScopeHeaderDto) {
    return this.service.updateHeader(tenderId, dto);
  }

  // ── Items ─────────────────────────────────────────────────────────────
  @Get("items")
  @RequirePermissions("estimates.view")
  @ApiOperation({
    summary: "List scope items sorted SO → Str → Asb → Civ → Prv with per-discipline summary totals."
  })
  list(@Param("tenderId") tenderId: string) {
    return this.service.listItems(tenderId);
  }

  @Post("items")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary: "Create a confirmed scope item. Auto-assigns wbsCode and itemNumber within the discipline."
  })
  @ApiResponse({ status: 201, description: "Created scope item." })
  @ApiResponse({ status: 400, description: "Unknown discipline." })
  create(
    @Param("tenderId") tenderId: string,
    @Body() dto: CreateScopeItemDto,
    @CurrentUser() actor: RequestUser
  ) {
    return this.service.createItem(tenderId, dto, actor.sub);
  }

  @Patch("items/:itemId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary:
      "Partial update of any scope item field. Transitioning status from draft → confirmed triggers estimate item creation."
  })
  update(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateScopeItemDto,
    @CurrentUser() actor: RequestUser
  ) {
    return this.service.updateItem(tenderId, itemId, dto, actor.sub);
  }

  @Delete("items/:itemId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary:
      "Hard delete the scope item. Returns a warning string when the item had a linked estimate line (the estimate line is NOT removed)."
  })
  remove(@Param("tenderId") tenderId: string, @Param("itemId") itemId: string) {
    return this.service.deleteItem(tenderId, itemId);
  }

  @Post("items/reorder")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Bulk update of sortOrder across multiple scope items." })
  reorder(@Param("tenderId") tenderId: string, @Body() dto: ReorderScopeItemsDto) {
    return this.service.reorder(tenderId, dto);
  }

  @Post("items/:itemId/confirm")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary: "Confirm a draft (AI-proposed) scope item. Creates an EstimateItem + lines from the row's fields."
  })
  @ApiResponse({ status: 200, description: "{ scopeItem, estimateItem }" })
  confirm(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @CurrentUser() actor: RequestUser
  ) {
    return this.service.confirmItem(tenderId, itemId, actor.sub);
  }

  @Post("items/:itemId/exclude")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Exclude an AI-proposed scope item. Does not create an estimate line." })
  exclude(@Param("tenderId") tenderId: string, @Param("itemId") itemId: string) {
    return this.service.excludeItem(tenderId, itemId);
  }

  @Post("items/confirm-all")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary: "Confirm every draft scope item on the tender in one call. Creates estimate lines for each."
  })
  confirmAll(@Param("tenderId") tenderId: string, @CurrentUser() actor: RequestUser) {
    return this.service.confirmAllDrafts(tenderId, actor.sub);
  }
}

import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ScopeRedesignService } from "./scope-redesign.service";

class UpsertViewConfigDto {
  @IsString() discipline!: string;
  @IsArray() columns!: string[];
}

class CreateCuttingItemDto {
  @IsString() wbsRef!: string;
  @IsOptional() @IsString() description?: string;
  @IsIn(["saw-cut", "core-hole", "other-rate"]) itemType!: "saw-cut" | "core-hole" | "other-rate";
  @IsOptional() @IsString() equipment?: string;
  @IsOptional() @IsString() elevation?: string;
  @IsOptional() @IsString() material?: string;
  @IsOptional() @IsInt() depthMm?: number;
  @IsOptional() @IsInt() diameterMm?: number;
  @IsOptional() @Type(() => Number) @IsNumber() quantityLm?: number;
  @IsOptional() @IsInt() quantityEach?: number;
  @IsOptional() @IsString() shift?: string;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @Type(() => Number) @IsNumber() shiftLoading?: number;
  @IsOptional() @IsString() otherRateId?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  // PR B4b — link the manually-added row to a specific scope card so
  // the per-card cutting subtable can scope its list query by cardId.
  @IsOptional() @IsString() cardId?: string | null;
}

// Exported so the B4b.1 contract spec can assert that cardId is no
// longer a declared property on this DTO (silent-no-op prevention).
export class UpdateCuttingItemDto {
  @IsOptional() @IsString() wbsRef?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsIn(["saw-cut", "core-hole", "other-rate"]) itemType?: "saw-cut" | "core-hole" | "other-rate";
  @IsOptional() @IsString() equipment?: string | null;
  @IsOptional() @IsString() elevation?: string | null;
  @IsOptional() @IsString() material?: string | null;
  @IsOptional() @IsInt() depthMm?: number | null;
  @IsOptional() @IsInt() diameterMm?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() quantityLm?: number | null;
  @IsOptional() @IsInt() quantityEach?: number | null;
  @IsOptional() @IsString() shift?: string | null;
  @IsOptional() @IsString() method?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() shiftLoading?: number | null;
  @IsOptional() @IsString() otherRateId?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsInt() sortOrder?: number | null;
}

@ApiTags("Scope of Works — redesign")
@ApiBearerAuth()
@Controller("tenders/:tenderId/scope")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ScopeRedesignController {
  constructor(private readonly service: ScopeRedesignService) {}

  // PR B4a.4 — same controller-boundary assertion as ScopeOfWorksController.
  // The cutting create/update sinks construct Prisma.Decimal from
  // quantityLm + shiftLoading inside scope-redesign.service.ts; this
  // assertion sanitizes the @Body source so CodeQL stops tracking taint.
  private assertObjectBody(dto: unknown): asserts dto is Record<string, unknown> {
    if (typeof dto !== "object" || dto === null || Array.isArray(dto)) {
      throw new BadRequestException("Request body must be a JSON object.");
    }
  }

  @Get("columns")
  @RequirePermissions("estimates.view")
  @ApiOperation({
    summary:
      "Available + required columns for a given rowType. Server is source of truth for column availability."
  })
  @ApiQuery({ name: "rowType", description: "e.g. demolition, asbestos-removal, waste-disposal" })
  getColumns(@Query("rowType") rowType: string) {
    return this.service.getColumnsForRowType(rowType);
  }

  @Get("view-config")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "Get the user-chosen optional column set for (tender × discipline). Defaults when unset." })
  @ApiQuery({ name: "discipline", enum: ["SO", "Str", "Asb", "Civ", "Prv"] })
  getViewConfig(@Param("tenderId") tenderId: string, @Query("discipline") discipline: string) {
    return this.service.getViewConfig(tenderId, discipline);
  }

  @Patch("view-config")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Upsert the optional column set for (tender × discipline)." })
  patchViewConfig(@Param("tenderId") tenderId: string, @Body() rawDto: unknown) {
    this.assertObjectBody(rawDto);
    const dto = rawDto as unknown as UpsertViewConfigDto;
    return this.service.upsertViewConfig(tenderId, dto.discipline, dto.columns);
  }

  @Get("cutting-items")
  @RequirePermissions("estimates.view")
  @ApiOperation({
    summary:
      "List concrete cutting items on the tender, ordered by WBS ref then sort order. PR B4b — optional ?cardId= filter scopes the list to a single scope card."
  })
  @ApiQuery({ name: "cardId", required: false, type: String })
  listCuttingItems(
    @Param("tenderId") tenderId: string,
    @Query("cardId") cardId?: string
  ) {
    return this.service.listCuttingItems(tenderId, { cardId });
  }

  @Post("cutting-items")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary:
      "Add a saw-cut or core-hole. Rate is looked up from the Cutrite matrix and lineTotal is calculated server-side."
  })
  @ApiResponse({ status: 201, description: "Created item with resolved rate and lineTotal." })
  @ApiResponse({ status: 400, description: "Invalid itemType or missing wbsRef." })
  createCuttingItem(
    @Param("tenderId") tenderId: string,
    @Body() dto: unknown,
    @CurrentUser() actor: { sub: string }
  ) {
    this.assertObjectBody(dto);
    return this.service.createCuttingItem(tenderId, actor.sub, dto as unknown as CreateCuttingItemDto);
  }

  @Patch("cutting-items/:itemId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Patch a cutting item. Re-runs rate lookup + lineTotal if pricing fields changed." })
  updateCuttingItem(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: unknown
  ) {
    this.assertObjectBody(dto);
    return this.service.updateCuttingItem(tenderId, itemId, dto as UpdateCuttingItemDto);
  }

  @Delete("cutting-items/:itemId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Hard-delete a cutting item." })
  deleteCuttingItem(@Param("tenderId") tenderId: string, @Param("itemId") itemId: string) {
    return this.service.deleteCuttingItem(tenderId, itemId);
  }

  @Get("summary")
  @RequirePermissions("estimates.view")
  @ApiOperation({
    summary:
      "Per-discipline subtotals (server-calculated), cutting total, and tender price. Frontend displays only."
  })
  summary(@Param("tenderId") tenderId: string) {
    return this.service.summary(tenderId);
  }
}

// PR B4b — Per-card cutting controller. Sibling of ScopeCardWasteController.
// Mounted at the per-card path so "Copy from above" sits naturally under
//   POST /tenders/:tenderId/scope/cards/:cardId/cutting/copy-from-above
// Shares the same ScopeRedesignService instance.
@ApiTags("Scope of Works — Cutting")
@ApiBearerAuth()
@Controller("tenders/:tenderId/scope/cards/:cardId/cutting")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ScopeCardCuttingController {
  constructor(private readonly service: ScopeRedesignService) {}

  @Post("copy-from-above")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary:
      "PR B4b — read scope items on the card where cuttingIncluded=true and create/replace autoCopied=true saw-cut rows. Manual rows + core-hole + other-rate rows preserved."
  })
  @ApiResponse({
    status: 200,
    description:
      "{ replaced, created, warnings } — `warnings` flags any rows with computed depth > 2000mm so the estimator can verify."
  })
  copyFromAbove(
    @Param("tenderId") tenderId: string,
    @Param("cardId") cardId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.copyFromAbove(tenderId, cardId, actor.sub);
  }
}

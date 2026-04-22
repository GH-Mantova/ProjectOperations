import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
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
  @IsIn(["saw-cut", "core-hole"]) itemType!: "saw-cut" | "core-hole";
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
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

class UpdateCuttingItemDto {
  @IsOptional() @IsString() wbsRef?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsIn(["saw-cut", "core-hole"]) itemType?: "saw-cut" | "core-hole";
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
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsInt() sortOrder?: number | null;
}

@ApiTags("Scope of Works — redesign")
@ApiBearerAuth()
@Controller("tenders/:tenderId/scope")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ScopeRedesignController {
  constructor(private readonly service: ScopeRedesignService) {}

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
  patchViewConfig(@Param("tenderId") tenderId: string, @Body() dto: UpsertViewConfigDto) {
    return this.service.upsertViewConfig(tenderId, dto.discipline, dto.columns);
  }

  @Get("cutting-items")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List concrete cutting items on the tender, ordered by WBS ref then sort order." })
  listCuttingItems(@Param("tenderId") tenderId: string) {
    return this.service.listCuttingItems(tenderId);
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
    @Body() dto: CreateCuttingItemDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.createCuttingItem(tenderId, actor.sub, dto);
  }

  @Patch("cutting-items/:itemId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Patch a cutting item. Re-runs rate lookup + lineTotal if pricing fields changed." })
  updateCuttingItem(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateCuttingItemDto
  ) {
    return this.service.updateCuttingItem(tenderId, itemId, dto);
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

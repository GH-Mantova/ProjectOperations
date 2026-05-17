import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ScopeWasteService } from "./scope-waste.service";
import { IS_DISCIPLINE_CODES } from "../personas/definitions/disciplines";

// PR B1.5.1 — DTO validator uses the canonical 4-code list. The legacy
// 5-code constant ["SO", "Str", "Asb", "Civ", "Prv"] was a leftover that
// PR A1 missed; any waste-item POST/PATCH carrying a current discipline
// (DEM/CIV/ASB/Other) was rejected with a validation error.
class UpsertWasteDto {
  @IsOptional() @IsIn(IS_DISCIPLINE_CODES as readonly string[]) discipline?: string;
  // PR B3 — parent card for per-card scoping. Nullable in the DTO so
  // legacy whole-tender callers still work.
  @IsOptional() @IsString() cardId?: string | null;
  @IsOptional() @IsString() wbsRef?: string | null;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() wasteGroup?: string | null;
  @IsOptional() @IsString() wasteType?: string | null;
  @IsOptional() @IsString() wasteFacility?: string | null;
  // PR B3 — unit drives the facility filter on the summary subtable.
  @IsOptional() @IsString() unit?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() wasteTonnes?: number | null;
  // PR B4a.2 — m³ companion to wasteTonnes. Without this on the
  // controller-side DTO, PATCH bodies carrying `m3` were silently
  // stripped by class-validator's whitelist (the service-side type
  // accepts it but never received it from the wire).
  @IsOptional() @Type(() => Number) @IsNumber() m3?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() wasteLoads?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() ratePerTonne?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() ratePerLoad?: number | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}

class ReorderEntryDto {
  @IsString() itemId!: string;
  @Type(() => Number) @IsInt() @Min(0) sortOrder!: number;
}

class ReorderDto {
  @IsArray() order!: ReorderEntryDto[];
}

@ApiTags("Scope of Works — Waste")
@ApiBearerAuth()
@Controller("tenders/:tenderId/scope/waste")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ScopeWasteController {
  constructor(private readonly service: ScopeWasteService) {}

  // PR B4a.4 — same controller-boundary assertion as ScopeOfWorksController.
  // See that controller for the rationale; the CodeQL alert chain reaches
  // this service via the m3 / wasteTonnes Decimal sinks.
  private assertObjectBody(dto: unknown): asserts dto is Record<string, unknown> {
    if (typeof dto !== "object" || dto === null || Array.isArray(dto)) {
      throw new BadRequestException("Request body must be a JSON object.");
    }
  }

  @Get()
  @RequirePermissions("estimates.view")
  @ApiOperation({
    summary:
      "List waste disposal rows on the tender. Optional ?cardId= filter (PR B3 per-card) or ?discipline= (legacy whole-tender)."
  })
  list(
    @Param("tenderId") tenderId: string,
    @Query("discipline") discipline?: string,
    @Query("cardId") cardId?: string
  ) {
    return this.service.list(tenderId, { discipline, cardId });
  }

  @Post()
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Create a waste row. truckDays + lineTotal are derived server-side." })
  create(
    @Param("tenderId") tenderId: string,
    @Body() dto: unknown,
    @CurrentUser() actor: { sub: string }
  ) {
    this.assertObjectBody(dto);
    return this.service.create(tenderId, actor.sub, dto as UpsertWasteDto);
  }

  @Patch(":itemId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Partial update of a waste row. Re-derives truckDays + lineTotal." })
  update(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: unknown
  ) {
    this.assertObjectBody(dto);
    return this.service.update(tenderId, itemId, dto as UpsertWasteDto);
  }

  @Delete(":itemId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Delete a waste row." })
  remove(@Param("tenderId") tenderId: string, @Param("itemId") itemId: string) {
    return this.service.remove(tenderId, itemId);
  }

  @Post("reorder")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Bulk update sortOrder across multiple waste rows." })
  reorder(@Param("tenderId") tenderId: string, @Body() dto: unknown) {
    this.assertObjectBody(dto);
    return this.service.reorder(tenderId, (dto as unknown as ReorderDto).order);
  }
}

// PR B3 — Second controller mounted at the per-card path so the
// "Sum from above" endpoint can sit naturally under
//   POST /tenders/:tenderId/scope/cards/:cardId/waste/sum-from-above
// Shares the same ScopeWasteService instance.
@ApiTags("Scope of Works — Waste")
@ApiBearerAuth()
@Controller("tenders/:tenderId/scope/cards/:cardId/waste")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ScopeCardWasteController {
  constructor(private readonly service: ScopeWasteService) {}

  @Post("sum-from-above")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary:
      "PR B3 — aggregate scope items (wasteIncluded=true) by (wasteGroup, wasteItem, unit) and write/replace autoSummed waste rows for the card. Manual rows preserved."
  })
  sumFromAbove(
    @Param("tenderId") tenderId: string,
    @Param("cardId") cardId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.sumFromAbove(tenderId, cardId, actor.sub);
  }
}

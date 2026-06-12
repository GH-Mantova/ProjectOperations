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

/**
 * Tender-level waste disposal CRUD + reorder endpoints.
 *
 * JWT-guarded; reads require `estimates.view`, writes require
 * `estimates.manage`. Write bodies arrive as `unknown` and are
 * shape-asserted at the controller boundary (CodeQL taint
 * sanitisation) before being cast to their DTOs. truckDays and
 * lineTotal are always derived server-side.
 */
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

  /**
   * List waste disposal rows on the tender. Optional ?cardId= filter (PR B3 per-card) or ?discipline= (legacy whole-tender).
   *
   * @param tenderId - tender to list waste rows for
   * @param discipline - optional discipline filter
   * @param cardId - optional scope-card filter; when supplied, cardless legacy rows are excluded
   * @returns waste rows ordered by discipline, sortOrder, createdAt
   */
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

  /**
   * Create a waste row. truckDays + lineTotal are derived server-side.
   *
   * @param tenderId - tender the row belongs to
   * @param dto - body asserted to be an object, then cast to UpsertWasteDto
   * @param actor - JWT principal; `sub` recorded as createdById
   * @returns the created ScopeWasteItem row
   * @throws BadRequestException when the body is invalid or description/discipline/cardId is missing
   */
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

  /**
   * Partial update of a waste row. Re-derives truckDays + lineTotal.
   *
   * @param tenderId - tender the row must belong to
   * @param itemId - waste row to update
   * @param dto - body asserted to be an object, then cast to UpsertWasteDto
   * @returns the updated ScopeWasteItem row
   * @throws BadRequestException when the body is not a JSON object
   * @throws NotFoundException when the row is missing or belongs to another tender
   */
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

  /**
   * Delete a waste row.
   *
   * @param tenderId - tender the row must belong to
   * @param itemId - waste row to delete
   * @returns `{ deleted: true }`
   * @throws NotFoundException when the row is missing or belongs to another tender
   */
  @Delete(":itemId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Delete a waste row." })
  remove(@Param("tenderId") tenderId: string, @Param("itemId") itemId: string) {
    return this.service.remove(tenderId, itemId);
  }

  /**
   * Bulk update sortOrder across multiple waste rows.
   *
   * @param tenderId - tender scoping the updateMany so foreign rows are untouched
   * @param dto - body asserted to be an object, then cast to ReorderDto
   * @returns `{ reordered }` — count of entries submitted
   * @throws BadRequestException when the body is not a JSON object
   */
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
/**
 * Per-card waste controller (PR B3) — hosts the "Sum from above"
 * aggregator under the per-card path. Shares the same ScopeWasteService
 * instance as ScopeWasteController.
 *
 * JWT-guarded; the single endpoint requires `estimates.manage`.
 */
@ApiTags("Scope of Works — Waste")
@ApiBearerAuth()
@Controller("tenders/:tenderId/scope/cards/:cardId/waste")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ScopeCardWasteController {
  constructor(private readonly service: ScopeWasteService) {}

  /**
   * PR B3 — aggregate scope items (wasteIncluded=true) by (wasteGroup, wasteItem, unit) and write/replace autoSummed waste rows for the card. Manual rows preserved.
   *
   * @param tenderId - tender owning the card
   * @param cardId - scope card whose autoSummed rows are regenerated
   * @param actor - JWT principal; `sub` recorded as createdById on new rows
   * @returns `{ replaced, created }` row counts
   * @throws NotFoundException when the card is missing or belongs to another tender
   */
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

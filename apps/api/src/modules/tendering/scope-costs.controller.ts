import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ScopeCostsService } from "./scope-costs.service";
import { UpsertOperationalCostLineDto } from "./dto/scope-costs.dto";

/**
 * SCOPE_OPERATIONAL_COSTS_V1 — per-card operational-cost line CRUD.
 *
 * Mounted under the per-card path, the way ScopeCardWasteController is, and
 * guarded the same way: JWT throughout, reads require `estimates.view`,
 * writes require `estimates.manage`. Write bodies arrive as `unknown` and are
 * shape-asserted at the controller boundary (CodeQL taint sanitisation)
 * before being cast to their DTO — the same pattern ScopeWasteController
 * documents, and for the same reason: the qty / rate Decimal sinks.
 *
 * No total is returned or stored. The line total is
 * `qty × (rateOverride ?? rate)`.
 */
@ApiTags("Scope of Works — Operational Costs")
@ApiBearerAuth()
@Controller("tenders/:tenderId/scope/cards/:cardId/operational-costs")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ScopeCostsController {
  constructor(private readonly service: ScopeCostsService) {}

  private assertObjectBody(dto: unknown): asserts dto is Record<string, unknown> {
    if (typeof dto !== "object" || dto === null || Array.isArray(dto)) {
      throw new BadRequestException("Request body must be a JSON object.");
    }
  }

  /**
   * List the operational-cost lines on a card, in sortOrder.
   *
   * @param tenderId - tender owning the card
   * @param cardId - scope card to list lines for
   * @returns the card's ScopeOperationalCostLine rows
   * @throws NotFoundException when the card is missing or on another tender
   */
  @Get()
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List the operational-cost lines on a scope card, in sortOrder." })
  @ApiResponse({ status: 200, description: "List the operational-cost lines on a scope card, in sortOrder." })
  list(@Param("tenderId") tenderId: string, @Param("cardId") cardId: string) {
    return this.service.list(tenderId, cardId);
  }

  /**
   * Create an operational-cost line on a card.
   *
   * @param dto - body asserted to be an object, then cast to the DTO
   * @param actor - JWT principal; `sub` recorded as createdById
   * @returns the created ScopeOperationalCostLine row
   * @throws BadRequestException when the body is not an object, description is
   *   missing, or a non-duration unit carries days other than 1
   * @throws NotFoundException when the card is missing or on another tender
   */
  @Post()
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary:
      "Create an operational-cost line on a scope card. A unit carrying no duration (Ea, Lump sum) rejects days other than 1."
  })
  @ApiResponse({ status: 201, description: "Create an operational-cost line on a scope card. A unit carrying no duration (Ea, Lump sum) rejects days other than 1." })
  create(
    @Param("tenderId") tenderId: string,
    @Param("cardId") cardId: string,
    @Body() dto: unknown,
    @CurrentUser() actor: { sub: string }
  ) {
    this.assertObjectBody(dto);
    return this.service.create(tenderId, cardId, actor.sub, dto as UpsertOperationalCostLineDto);
  }

  /**
   * Partial update of an operational-cost line.
   *
   * @param lineId - the line to patch
   * @param dto - body asserted to be an object, then cast to the DTO
   * @returns the updated ScopeOperationalCostLine row
   * @throws BadRequestException when the body is not an object, or the
   *   resulting unit/days pair breaks the lump-sum rule
   * @throws NotFoundException when the line or its card does not match
   */
  @Patch(":lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary:
      "Partial update of an operational-cost line. The lump-sum rule is checked against the resulting unit/days pair."
  })
  @ApiResponse({ status: 200, description: "Partial update of an operational-cost line. The lump-sum rule is checked against the resulting unit/days pair." })
  update(
    @Param("tenderId") tenderId: string,
    @Param("cardId") cardId: string,
    @Param("lineId") lineId: string,
    @Body() dto: unknown
  ) {
    this.assertObjectBody(dto);
    return this.service.update(tenderId, cardId, lineId, dto as UpsertOperationalCostLineDto);
  }

  /**
   * Delete an operational-cost line.
   *
   * @returns `{ deleted: true }`
   * @throws NotFoundException when the line or its card does not match
   */
  @Delete(":lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Delete an operational-cost line." })
  @ApiResponse({ status: 200, description: "Delete an operational-cost line." })
  remove(
    @Param("tenderId") tenderId: string,
    @Param("cardId") cardId: string,
    @Param("lineId") lineId: string
  ) {
    return this.service.remove(tenderId, cardId, lineId);
  }
}

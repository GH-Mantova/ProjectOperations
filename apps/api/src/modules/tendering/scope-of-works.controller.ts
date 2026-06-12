import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import {
  CreateScopeCardDto,
  CreateScopeItemDto,
  CreateScopeItemInCardDto,
  ReorderScopeCardsDto,
  ReorderScopeItemsDto,
  UpdateScopeCardDto,
  UpdateScopeHeaderDto,
  UpdateScopeItemDto
} from "./dto/scope-of-works.dto";
import { ScopeOfWorksService } from "./scope-of-works.service";

type RequestUser = { sub: string };

/**
 * REST controller for the per-tender scope sheet under
 * /tenders/:tenderId/scope — header, scope items, and scope cards.
 *
 * JWT + permission gated: reads need `estimates.view`, writes need
 * `estimates.manage`. Every @Body() handler accepts `unknown` and runs
 * assertObjectBody before casting (CodeQL parameter-tampering
 * mitigation); ValidationPipe still applies per-field validation after.
 */
@ApiTags("Scope of Works")
@ApiBearerAuth()
@Controller("tenders/:tenderId/scope")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ScopeOfWorksController {
  constructor(private readonly service: ScopeOfWorksService) {}

  // PR B4a.4 — controller-boundary assertion (GitHub Security suggested
  // fix for the CodeQL js/type-confusion-through-parameter-tampering
  // alerts). Every @Body() handler types its DTO parameter as `unknown`
  // and calls this assertion before forwarding. CodeQL recognises the
  // `Array.isArray` check as a sanitization point and stops tracking
  // taint past it; ValidationPipe still runs after this method to do
  // class-validator's per-field validation, so the cast that follows
  // is sound. Defense-in-depth: narrowToNumber + toDecimal inside the
  // service layer still narrow each numeric field before it reaches
  // the Prisma.Decimal constructor.
  private assertObjectBody(dto: unknown): asserts dto is Record<string, unknown> {
    if (typeof dto !== "object" || dto === null || Array.isArray(dto)) {
      throw new BadRequestException("Request body must be a JSON object.");
    }
  }

  // ── Header ────────────────────────────────────────────────────────────
  /**
   * Get the site context header for the scope sheet (lazily created).
   *
   * @returns the existing header, or a freshly created empty one
   */
  @Get("header")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "Get the site context header for the scope sheet (lazily created)." })
  getHeader(@Param("tenderId") tenderId: string) {
    return this.service.getHeader(tenderId);
  }

  /**
   * Update the site context header (auto-saved from the collapsible form).
   *
   * @param dto - site address/contact, access constraints, start date, duration, special conditions
   * @returns the updated (or newly created) header
   */
  @Patch("header")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Update the site context header (auto-saved from the collapsible form)." })
  @ApiResponse({ status: 200, description: "Updated header." })
  updateHeader(@Param("tenderId") tenderId: string, @Body() dto: unknown) {
    this.assertObjectBody(dto);
    return this.service.updateHeader(tenderId, dto as UpdateScopeHeaderDto);
  }

  // ── Items ─────────────────────────────────────────────────────────────
  /**
   * List scope items sorted DEM → CIV → ASB → Other with per-discipline summary totals.
   *
   * @returns { items: rows with lineTotal/lineTotalWithMarkup, summary: per-discipline counts + totals }
   */
  @Get("items")
  @RequirePermissions("estimates.view")
  @ApiOperation({
    summary: "List scope items sorted DEM → CIV → ASB → Other with per-discipline summary totals."
  })
  list(@Param("tenderId") tenderId: string) {
    return this.service.listItems(tenderId);
  }

  /**
   * Create a confirmed scope item. Auto-assigns wbsCode and itemNumber within the discipline.
   *
   * @param dto - discipline, rowType, description, plus optional dimension/labour/plant fields
   * @returns the created scope item
   */
  @Post("items")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary: "Create a confirmed scope item. Auto-assigns wbsCode and itemNumber within the discipline."
  })
  @ApiResponse({ status: 201, description: "Created scope item." })
  @ApiResponse({ status: 400, description: "Unknown discipline." })
  create(
    @Param("tenderId") tenderId: string,
    @Body() dto: unknown,
    @CurrentUser() actor: RequestUser
  ) {
    this.assertObjectBody(dto);
    return this.service.createItem(tenderId, dto as unknown as CreateScopeItemDto, actor.sub);
  }

  /**
   * Partial update of any scope item field. Transitioning status from
   * draft → confirmed triggers estimate item creation.
   *
   * @param dto - any subset of scope item fields
   * @returns { scopeItem, estimateItem } — estimateItem is null unless a draft→confirmed transition occurred
   */
  @Patch("items/:itemId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary:
      "Partial update of any scope item field. Transitioning status from draft → confirmed triggers estimate item creation."
  })
  update(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: unknown,
    @CurrentUser() actor: RequestUser
  ) {
    this.assertObjectBody(dto);
    return this.service.updateItem(tenderId, itemId, dto as UpdateScopeItemDto, actor.sub);
  }

  /**
   * Hard delete the scope item. Returns a warning string when the item
   * had a linked estimate line (the estimate line is NOT removed).
   *
   * @returns { deleted: true, warning: string | null }
   */
  @Delete("items/:itemId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary:
      "Hard delete the scope item. Returns a warning string when the item had a linked estimate line (the estimate line is NOT removed)."
  })
  remove(@Param("tenderId") tenderId: string, @Param("itemId") itemId: string) {
    return this.service.deleteItem(tenderId, itemId);
  }

  /**
   * Bulk update of sortOrder across multiple scope items.
   *
   * @param dto - { order: [{ itemId, sortOrder }] }
   * @returns { updated: count }
   */
  @Post("items/reorder")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Bulk update of sortOrder across multiple scope items." })
  reorder(@Param("tenderId") tenderId: string, @Body() dto: unknown) {
    this.assertObjectBody(dto);
    return this.service.reorder(tenderId, dto as unknown as ReorderScopeItemsDto);
  }

  /**
   * Confirm a draft (AI-proposed) scope item. Creates an EstimateItem + lines from the row's fields.
   *
   * Idempotent: confirming an already-confirmed item returns it with estimateItem null.
   *
   * @returns { scopeItem, estimateItem }
   */
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

  /**
   * Exclude an AI-proposed scope item. Does not create an estimate line.
   *
   * @returns the scope item with status "excluded"
   */
  @Post("items/:itemId/exclude")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Exclude an AI-proposed scope item. Does not create an estimate line." })
  exclude(@Param("tenderId") tenderId: string, @Param("itemId") itemId: string) {
    return this.service.excludeItem(tenderId, itemId);
  }

  /**
   * Confirm every draft scope item on the tender in one call. Creates estimate lines for each.
   *
   * @returns { confirmed: count, estimates: [{ scopeItemId, estimateItemId }] }
   */
  @Post("items/confirm-all")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary: "Confirm every draft scope item on the tender in one call. Creates estimate lines for each."
  })
  confirmAll(@Param("tenderId") tenderId: string, @CurrentUser() actor: RequestUser) {
    return this.service.confirmAllDrafts(tenderId, actor.sub);
  }

  // ── Cards (PR B1) ─────────────────────────────────────────────────────
  /**
   * List scope cards for the tender with item counts. Ordered by sortOrder (user-controlled).
   *
   * @returns card summaries including itemCount and markupOverride as plain number | null
   */
  @Get("cards")
  @RequirePermissions("estimates.view")
  @ApiOperation({
    summary: "List scope cards for the tender with item counts. Ordered by sortOrder (user-controlled)."
  })
  listCards(@Param("tenderId") tenderId: string) {
    return this.service.listCards(tenderId);
  }

  /**
   * Create a new scope card. cardNumber auto-assigned as MAX(cardNumber)+1 in (tenderId, discipline).
   *
   * @param dto - { name, discipline }
   * @returns the created card (placed at the end of the tab row)
   */
  @Post("cards")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary: "Create a new scope card. cardNumber auto-assigned as MAX(cardNumber)+1 in (tenderId, discipline)."
  })
  @ApiResponse({ status: 201, description: "Created card." })
  createCard(
    @Param("tenderId") tenderId: string,
    @Body() dto: unknown,
    @CurrentUser() actor: RequestUser
  ) {
    this.assertObjectBody(dto);
    return this.service.createCard(tenderId, actor.sub, dto as unknown as CreateScopeCardDto);
  }

  /**
   * Update a scope card — dispatches to ONE service operation per call.
   *
   * Precedence when multiple fields are sent: discipline >
   * plantColumnCount > cutting/waste notes > markupOverride > header
   * overrides > name. Discipline change cascades item wbsCode +
   * cutting/waste wbsRef rewrites.
   *
   * @param rawDto - exactly one logical field group from UpdateScopeCardDto
   * @returns shape varies by operation (card, or cascade summary for discipline change)
   * @throws BadRequestException when no recognised field is provided
   */
  @Patch("cards/:cardId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary:
      "Update a scope card. Pass `name` to rename, `discipline` to change discipline (cascades item wbsCode + cutting/waste wbsRef updates), or `plantColumnCount` to grow/shrink the Plant column count (PR B1.6)."
  })
  updateCard(
    @Param("tenderId") tenderId: string,
    @Param("cardId") cardId: string,
    @Body() rawDto: unknown
  ) {
    this.assertObjectBody(rawDto);
    const dto = rawDto as UpdateScopeCardDto;
    if (dto.discipline) {
      return this.service.changeCardDiscipline(tenderId, cardId, dto.discipline);
    }
    if (dto.plantColumnCount !== undefined) {
      return this.service.setPlantColumnCount(tenderId, cardId, dto.plantColumnCount);
    }
    // PR B1.7 — accept either or both notes fields in a single PATCH.
    if (dto.cuttingNotes !== undefined || dto.wasteNotes !== undefined) {
      return this.service.setCardNotes(tenderId, cardId, {
        cuttingNotes: dto.cuttingNotes,
        wasteNotes: dto.wasteNotes
      });
    }
    // PR B2 — per-card markup override. Pass null to clear.
    if (dto.markupOverride !== undefined) {
      return this.service.setCardMarkupOverride(tenderId, cardId, dto.markupOverride);
    }
    // Card-header summary overrides.
    if (
      dto.peakCrewOverride !== undefined ||
      dto.labourDaysOverride !== undefined ||
      dto.plantSummaryOverride !== undefined ||
      dto.durationOverride !== undefined
    ) {
      return this.service.updateCardHeaderOverrides(tenderId, cardId, {
        peakCrewOverride: dto.peakCrewOverride,
        labourDaysOverride: dto.labourDaysOverride,
        plantSummaryOverride: dto.plantSummaryOverride,
        durationOverride: dto.durationOverride,
      });
    }
    if (dto.name !== undefined) {
      return this.service.renameCard(tenderId, cardId, dto.name);
    }
    throw new BadRequestException(
      "Provide name, discipline, plantColumnCount, cuttingNotes, wasteNotes, markupOverride, or header overrides."
    );
  }

  /**
   * Compute auto-derived card-header summary values + return any user overrides.
   *
   * @returns { computed: { peakCrew, labourDays, plantSummary, duration }, overrides: {...} }
   */
  @Get("cards/:cardId/summary")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "Compute auto-derived card-header summary values + return any user overrides." })
  @ApiResponse({ status: 200, description: "Card summary with computed and override values." })
  getCardSummary(
    @Param("tenderId") tenderId: string,
    @Param("cardId") cardId: string
  ) {
    return this.service.getCardSummary(tenderId, cardId);
  }

  /**
   * Reset every card's markupOverride to null in one call.
   *
   * @returns { cardsReset: count of cards that actually had an override }
   */
  @Post("markup/reset-all")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary: "PR B2 — Reset every card's markupOverride to null in one call. Returns { cardsReset: count }."
  })
  @ApiResponse({ status: 200, description: "All card overrides cleared for the tender." })
  resetAllCardMarkup(@Param("tenderId") tenderId: string) {
    return this.service.resetAllCardMarkup(tenderId);
  }

  /**
   * Delete a scope card. 409 if the card has scope items — move or delete items first.
   *
   * @returns nothing (204)
   */
  @Delete("cards/:cardId")
  @HttpCode(204)
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary: "Delete a scope card. 409 if the card has scope items — move or delete items first."
  })
  @ApiResponse({ status: 204, description: "Card deleted." })
  @ApiResponse({ status: 409, description: "Card has items — cannot delete." })
  async deleteCard(
    @Param("tenderId") tenderId: string,
    @Param("cardId") cardId: string
  ): Promise<void> {
    await this.service.deleteCard(tenderId, cardId);
  }

  /**
   * Bulk-update card sortOrder. Each card receives sortOrder = its index in cardIds.
   *
   * @param rawDto - { cardIds: ordered array of card ids on this tender }
   * @returns nothing (204)
   */
  @Post("cards/reorder")
  @HttpCode(204)
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Bulk-update card sortOrder. Each card receives sortOrder = its index in cardIds." })
  async reorderCards(
    @Param("tenderId") tenderId: string,
    @Body() rawDto: unknown
  ): Promise<void> {
    this.assertObjectBody(rawDto);
    const dto = rawDto as unknown as ReorderScopeCardsDto;
    await this.service.reorderCards(tenderId, dto.cardIds);
  }

  /**
   * Create a scope item inside a specific card.
   * wbsCode = `${discipline}${cardNumber}.${itemNumber}` with itemNumber per-card.
   *
   * @param dto - optional description and rowType (defaults to "general-labour")
   * @returns the created scope item with parent card included
   */
  @Post("cards/:cardId/items")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary:
      "Create a scope item inside a specific card. wbsCode = `${discipline}${cardNumber}.${itemNumber}` with itemNumber per-card."
  })
  @ApiResponse({ status: 201, description: "Created scope item with parent card included." })
  createItemInCard(
    @Param("tenderId") tenderId: string,
    @Param("cardId") cardId: string,
    @Body() dto: unknown,
    @CurrentUser() actor: RequestUser
  ) {
    this.assertObjectBody(dto);
    return this.service.createItemInCard(tenderId, actor.sub, cardId, dto as CreateScopeItemInCardDto);
  }
}

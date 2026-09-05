import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { narrowToNumber, toDecimal } from "./scope-of-works.service";
import {
  UpsertOperationalCostLineDto,
  assertDaysAllowedForUnit
} from "./dto/scope-costs.dto";

/**
 * SCOPE_OPERATIONAL_COSTS_V1 — CRUD for ScopeOperationalCostLine.
 *
 * Every cost on a card that is neither a crew nor a machine — permits,
 * traffic control, scaffolding, site fees — lives here. Rows are addressed
 * only through their card; the tender is verified by loading the card and
 * checking its tenderId, the same guard `ScopeWasteService.sumFromAbove`
 * uses.
 *
 * NO TOTAL IS STORED OR COMPUTED. The line total is
 * `qty × (rateOverride ?? rate)` and belongs to whoever renders it; a stored
 * copy would be a second source of truth that drifts. Nothing in the pricing
 * path, the card subtotal or the discipline roll-up reads this table yet, so
 * no tender price can move.
 */
@Injectable()
export class ScopeCostsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Loads the card and asserts it belongs to the tender in the path.
   *
   * @throws NotFoundException when the card is missing or on another tender
   */
  private async assertCard(tenderId: string, cardId: string) {
    const card = await this.prisma.scopeCard.findFirst({
      where: { id: cardId, tenderId },
      select: { id: true }
    });
    if (!card) throw new NotFoundException("Card not found on this tender.");
    return card;
  }

  /**
   * Lists the operational-cost lines on a card, ordered by sortOrder then
   * createdAt — the same ordering every sibling card-child uses.
   *
   * @returns the card's ScopeOperationalCostLine rows
   * @throws NotFoundException when the card is missing or on another tender
   */
  async list(tenderId: string, cardId: string) {
    await this.assertCard(tenderId, cardId);
    return this.prisma.scopeOperationalCostLine.findMany({
      where: { cardId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  }

  /**
   * Creates an operational-cost line on a card.
   *
   * DTO numerics are narrowed at the call site (narrowToNumber) before they
   * reach a Prisma.Decimal sink — the CodeQL mitigation ScopeWasteService
   * documents. The lump-sum rule is enforced here as well as on the wire:
   * a unit carrying no duration cannot be given days other than 1.
   *
   * @param actorId - recorded as createdById
   * @returns the created row
   * @throws BadRequestException when description is missing/blank, or when a
   *   non-duration unit carries a days value other than 1
   * @throws NotFoundException when the card is missing or on another tender
   */
  async create(
    tenderId: string,
    cardId: string,
    actorId: string,
    dto: UpsertOperationalCostLineDto
  ) {
    await this.assertCard(tenderId, cardId);
    if (typeof dto.description !== "string" || dto.description.trim() === "") {
      throw new BadRequestException("description is required.");
    }

    const qtyN = narrowToNumber(dto.qty);
    const daysN = narrowToNumber(dto.days);
    const rateN = narrowToNumber(dto.rate);
    const rateOverrideN = narrowToNumber(dto.rateOverride);
    const unit = dto.unit ?? null;

    assertDaysAllowedForUnit(unit, daysN);

    return this.prisma.scopeOperationalCostLine.create({
      data: {
        cardId,
        description: dto.description.trim(),
        qty: toDecimal(qtyN),
        unit,
        days: toDecimal(daysN),
        rate: toDecimal(rateN),
        rateOverride: toDecimal(rateOverrideN),
        plantRateId: dto.plantRateId ?? null,
        sortOrder: dto.sortOrder ?? 0,
        createdById: actorId
      }
    });
  }

  /**
   * Partially updates an operational-cost line. Fields absent from the DTO
   * keep their existing values.
   *
   * The lump-sum rule is checked against the EFFECTIVE unit and days — the
   * values the row will hold after the patch, not the ones in the body — so
   * a PATCH that changes only the unit to `Lump sum` on a row already
   * carrying days=3 is rejected rather than quietly leaving an illegal row.
   *
   * @returns the updated row
   * @throws BadRequestException when description is patched to blank, or when
   *   the resulting unit/days pair breaks the lump-sum rule
   * @throws NotFoundException when the row or its card is missing, or the
   *   card is on another tender
   */
  async update(
    tenderId: string,
    cardId: string,
    lineId: string,
    dto: UpsertOperationalCostLineDto
  ) {
    await this.assertCard(tenderId, cardId);
    const existing = await this.prisma.scopeOperationalCostLine.findUnique({
      where: { id: lineId }
    });
    if (!existing || existing.cardId !== cardId) {
      throw new NotFoundException("Operational cost line not found on this card.");
    }

    const data: Record<string, unknown> = {};

    if (dto.description !== undefined) {
      if (typeof dto.description !== "string" || dto.description.trim() === "") {
        throw new BadRequestException("description cannot be blank.");
      }
      data.description = dto.description.trim();
    }
    if (dto.qty !== undefined) data.qty = toDecimal(narrowToNumber(dto.qty));
    if (dto.rate !== undefined) data.rate = toDecimal(narrowToNumber(dto.rate));
    if (dto.rateOverride !== undefined) {
      data.rateOverride = toDecimal(narrowToNumber(dto.rateOverride));
    }
    if (dto.plantRateId !== undefined) data.plantRateId = dto.plantRateId ?? null;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    // Effective unit/days AFTER the patch, then the lump-sum rule against
    // that pair — not against whichever half the body happened to carry.
    const effectiveUnit = dto.unit !== undefined ? dto.unit ?? null : existing.unit;
    const effectiveDays =
      dto.days !== undefined
        ? narrowToNumber(dto.days)
        : existing.days == null
          ? null
          : Number(existing.days);
    assertDaysAllowedForUnit(effectiveUnit, effectiveDays);

    if (dto.unit !== undefined) data.unit = effectiveUnit;
    if (dto.days !== undefined) data.days = toDecimal(narrowToNumber(dto.days));

    return this.prisma.scopeOperationalCostLine.update({
      where: { id: lineId },
      data
    });
  }

  /**
   * Hard-deletes an operational-cost line after verifying it belongs to the
   * card, and the card to the tender.
   *
   * @returns `{ deleted: true }`
   * @throws NotFoundException when the row or its card does not match
   */
  async remove(tenderId: string, cardId: string, lineId: string) {
    await this.assertCard(tenderId, cardId);
    const existing = await this.prisma.scopeOperationalCostLine.findUnique({
      where: { id: lineId }
    });
    if (!existing || existing.cardId !== cardId) {
      throw new NotFoundException("Operational cost line not found on this card.");
    }
    await this.prisma.scopeOperationalCostLine.delete({ where: { id: lineId } });
    return { deleted: true };
  }
}

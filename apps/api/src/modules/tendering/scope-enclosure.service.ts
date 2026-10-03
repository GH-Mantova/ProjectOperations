// scope-enclosure.service.ts
//
// ASB_ENCLOSURE_LINES_V1 -- CRUD for ScopeItemEnclosureLine.
//
// Enclosure, air monitoring and clearance lines on an ASB scope item,
// priced from the enclosure rate table. Lines follow their parent item:
// they inherit its quoteDestination and its markup chain.
//
// Marco's decisions (2026-10-02):
//   - Enclosure rates are materials/hire only; labour (build/strip) stays
//     as men x days on the existing line type.
//   - These lines are ADDED ON TOP of the item's existing cost.
//   - ASB discipline only -- enforced here, not by a DB constraint.
//
// Rate resolution: resolveRate("enclosure", { enclosureType }, { tenderId })
// so a tender with a locked rate set uses the snapshot, not the live table.
// Unit and rate are snapshotted at create; editing the rate table later does
// NOT change existing lines (test 5).

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RateResolverService } from "../rates/rate-resolver.service";
import { CreateEnclosureLineDto, PatchEnclosureLineDto } from "./dto/scope-enclosure.dto";
import { resolveEffectiveMarkup } from "./scope-item-pricing";

/**
 * ASB_ENCLOSURE_LINES_V1 -- marker that enclosure, air monitoring and
 * clearance lines can be priced on an ASB scope item. S2 (web UI) arms
 * only when this string is on main.
 */
export const ASB_ENCLOSURE_LINES_V1 = "asb-enclosure-s1";

/** Computed money fields attached to every response row. */
type WithMoney<T> = T & {
  lineTotal: number;
  effectiveMarkup: number;
  lineTotalWithMarkup: number;
};

@Injectable()
export class ScopeEnclosureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateResolver: RateResolverService
  ) {}

  // ── Guards ──────────────────────────────────────────────────────────

  /**
   * Loads the scope item and verifies it belongs to the tender.
   * Also confirms the item's card discipline is ASB.
   *
   * @throws NotFoundException when the item is missing or on another tender
   * @throws BadRequestException when the card discipline is not ASB
   */
  private async assertAsbItem(tenderId: string, itemId: string) {
    const item = await this.prisma.scopeOfWorksItem.findFirst({
      where: { id: itemId, tenderId },
      select: {
        id: true,
        tenderId: true,
        quoteDestination: true,
        markupOverride: true,
        card: { select: { discipline: true, markupOverride: true } }
      }
    });
    if (!item) throw new NotFoundException("Scope item not found on this tender.");
    const discipline = item.card?.discipline ?? "";
    if (discipline !== "ASB") {
      throw new BadRequestException(
        "Enclosure lines are only available on asbestos items."
      );
    }
    return item;
  }

  /**
   * Verifies a line belongs to the given item.
   *
   * @throws NotFoundException when the line is missing or on another item
   */
  private async assertLine(itemId: string, lineId: string) {
    const line = await this.prisma.scopeItemEnclosureLine.findUnique({
      where: { id: lineId }
    });
    if (!line || line.scopeItemId !== itemId) {
      throw new NotFoundException("Enclosure line not found on this item.");
    }
    return line;
  }

  /**
   * Load the tender's markup fallback.
   * Matches the 30-default used by scope-redesign.service.ts summary().
   */
  private async tenderMarkup(tenderId: string): Promise<number> {
    const est = await this.prisma.tenderEstimate.findUnique({
      where: { tenderId },
      select: { markup: true }
    });
    return est ? Number(est.markup) : 30;
  }

  /**
   * Compute the three money fields for a line, given the item's markup
   * context. The item's quoteDestination is NOT replicated here -- it is
   * read at list/summary time, not stored on the line.
   */
  private computeMoney(
    line: {
      qty: Prisma.Decimal;
      rate: Prisma.Decimal;
      rateOverride: Prisma.Decimal | null;
    },
    itemMarkupOverride: Prisma.Decimal | null,
    cardMarkupOverride: Prisma.Decimal | null,
    tenderMarkupPct: number
  ): { lineTotal: number; effectiveMarkup: number; lineTotalWithMarkup: number } {
    const effectiveRate =
      line.rateOverride !== null
        ? Number(line.rateOverride)
        : Number(line.rate);
    const lineTotal = Number(line.qty) * effectiveRate;
    const effectiveMarkup = resolveEffectiveMarkup(
      itemMarkupOverride !== null ? Number(itemMarkupOverride) : null,
      cardMarkupOverride !== null ? Number(cardMarkupOverride) : null,
      tenderMarkupPct
    );
    const lineTotalWithMarkup = lineTotal * (1 + effectiveMarkup / 100);
    return {
      lineTotal: Number(lineTotal.toFixed(2)),
      effectiveMarkup: Number(effectiveMarkup.toFixed(2)),
      lineTotalWithMarkup: Number(lineTotalWithMarkup.toFixed(2))
    };
  }

  private withMoney<T extends {
    qty: Prisma.Decimal;
    rate: Prisma.Decimal;
    rateOverride: Prisma.Decimal | null;
  }>(
    row: T,
    item: { markupOverride: Prisma.Decimal | null; card: { markupOverride: Prisma.Decimal | null } | null },
    tenderMarkupPct: number
  ): WithMoney<T> {
    const money = this.computeMoney(
      row,
      item.markupOverride,
      item.card?.markupOverride ?? null,
      tenderMarkupPct
    );
    return { ...row, ...money };
  }

  // ── CRUD ─────────────────────────────────────────────────────────────

  /**
   * Lists the enclosure lines on a scope item, ordered by sortOrder, createdAt.
   *
   * @returns the item's ScopeItemEnclosureLine rows (with money fields)
   * @throws NotFoundException when the item is missing or on another tender
   * @throws BadRequestException when the card discipline is not ASB
   */
  async list(tenderId: string, itemId: string) {
    const item = await this.assertAsbItem(tenderId, itemId);
    const tenderMk = await this.tenderMarkup(tenderId);
    const rows = await this.prisma.scopeItemEnclosureLine.findMany({
      where: { scopeItemId: itemId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
    return rows.map((r) => this.withMoney(r, item as { markupOverride: Prisma.Decimal | null; card: { markupOverride: Prisma.Decimal | null } | null }, tenderMk));
  }

  /**
   * Creates an enclosure line on an ASB scope item.
   *
   * Resolves unit and rate via RateResolverService slug "enclosure",
   * honouring a locked rate set on the tender. Snapshots both.
   *
   * @param actorId - unused in this model (no createdBy FK) but carried for
   *   consistency and future audit wiring.
   * @returns the created ScopeItemEnclosureLine row (with money fields)
   * @throws NotFoundException when the item is missing or on another tender
   * @throws BadRequestException when the discipline is not ASB or the
   *   enclosureType is unknown or inactive
   */
  async create(tenderId: string, itemId: string, _actorId: string, dto: CreateEnclosureLineDto) {
    const item = await this.assertAsbItem(tenderId, itemId);

    // Resolve via rate resolver -- honours locked rate set.
    const resolved = await this.rateResolver.resolveRate(
      "enclosure",
      { enclosureType: dto.enclosureType },
      { tenderId }
    );
    if (!resolved) {
      throw new BadRequestException(
        `Enclosure type "${dto.enclosureType}" is unknown or inactive.`
      );
    }

    const tenderMk = await this.tenderMarkup(tenderId);

    const row = await this.prisma.scopeItemEnclosureLine.create({
      data: {
        scopeItemId: itemId,
        enclosureType: dto.enclosureType,
        qty: new Prisma.Decimal(dto.qty),
        unit: resolved.unit,
        rate: new Prisma.Decimal(resolved.value),
        rateOverride: null,
        sortOrder: dto.sortOrder ?? 0
      }
    });

    return this.withMoney(row, item as { markupOverride: Prisma.Decimal | null; card: { markupOverride: Prisma.Decimal | null } | null }, tenderMk);
  }

  /**
   * Partially updates a line. Only qty, rateOverride, and sortOrder may be
   * changed. Changing the enclosureType requires delete + add (the type
   * determines the snapshotted unit/rate; silent re-resolve is not permitted).
   *
   * @returns the updated row (with money fields)
   * @throws NotFoundException when the item or line is missing
   * @throws BadRequestException when the discipline is not ASB
   */
  async update(tenderId: string, itemId: string, lineId: string, dto: PatchEnclosureLineDto) {
    const item = await this.assertAsbItem(tenderId, itemId);
    await this.assertLine(itemId, lineId);

    const data: Record<string, unknown> = {};
    if (dto.qty !== undefined) data.qty = new Prisma.Decimal(dto.qty);
    if (dto.rateOverride !== undefined) {
      data.rateOverride =
        dto.rateOverride === null ? null : new Prisma.Decimal(dto.rateOverride);
    }
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    const tenderMk = await this.tenderMarkup(tenderId);
    const row = await this.prisma.scopeItemEnclosureLine.update({
      where: { id: lineId },
      data
    });

    return this.withMoney(row, item as { markupOverride: Prisma.Decimal | null; card: { markupOverride: Prisma.Decimal | null } | null }, tenderMk);
  }

  /**
   * Hard-deletes an enclosure line after verifying it belongs to the item.
   *
   * @returns `{ deleted: true }`
   * @throws NotFoundException when the item or line is missing
   * @throws BadRequestException when the discipline is not ASB
   */
  async remove(tenderId: string, itemId: string, lineId: string) {
    await this.assertAsbItem(tenderId, itemId);
    const existing = await this.prisma.scopeItemEnclosureLine.findUnique({
      where: { id: lineId }
    });
    if (!existing || existing.scopeItemId !== itemId) {
      throw new NotFoundException("Enclosure line not found on this item.");
    }
    await this.prisma.scopeItemEnclosureLine.delete({ where: { id: lineId } });
    return { deleted: true };
  }

  /**
   * Returns the sum of all enclosure lines on a scope item.
   * Used by pricing aggregators to include the enclosure total
   * before markup in the item subtotal.
   *
   * Returns { subtotal, withMarkup } rounded to 2 dp, honouring
   * the item's markup chain.
   *
   * An INTERNAL item's enclosure lines contribute to internalSubtotal only
   * (the caller routes by quoteDestination, not here).
   */
  async itemEnclosureTotal(
    itemId: string,
    itemMarkupOverride: Prisma.Decimal | null,
    cardMarkupOverride: Prisma.Decimal | null,
    tenderMarkupPct: number
  ): Promise<{ subtotal: number; withMarkup: number }> {
    const rows = await this.prisma.scopeItemEnclosureLine.findMany({
      where: { scopeItemId: itemId },
      select: { qty: true, rate: true, rateOverride: true }
    });
    let subtotal = 0;
    let withMarkup = 0;
    for (const row of rows) {
      const m = this.computeMoney(row, itemMarkupOverride, cardMarkupOverride, tenderMarkupPct);
      subtotal += m.lineTotal;
      withMarkup += m.lineTotalWithMarkup;
    }
    return {
      subtotal: Number(subtotal.toFixed(2)),
      withMarkup: Number(withMarkup.toFixed(2))
    };
  }
}

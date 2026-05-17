import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type UpsertWasteDto = {
  discipline?: string;
  cardId?: string | null;
  wbsRef?: string | null;
  description?: string;
  wasteGroup?: string | null;
  wasteType?: string | null;
  wasteFacility?: string | null;
  unit?: string | null;
  wasteTonnes?: number | null;
  wasteLoads?: number | null;
  ratePerTonne?: number | null;
  ratePerLoad?: number | null;
  notes?: string | null;
  sortOrder?: number;
};

// Waste disposal rows live on their own table (ScopeWasteItem). Each row's
// truckDays and lineTotal are derived server-side so the UI only submits
// raw inputs — never a calculated value. Rule: 3 loads per truck day,
// rounded up to the nearest half-day.
@Injectable()
export class ScopeWasteService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenderId: string, opts?: { discipline?: string; cardId?: string }) {
    return this.prisma.scopeWasteItem.findMany({
      where: {
        tenderId,
        ...(opts?.discipline ? { discipline: opts.discipline } : {}),
        // PR B3 — when cardId is supplied, return ONLY rows attached
        // to that card. Cardless legacy rows are deliberately excluded
        // (covered by Q7 in B3 investigation — follow-up cleanup).
        ...(opts?.cardId ? { cardId: opts.cardId } : {})
      },
      orderBy: [{ discipline: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
    });
  }

  async create(tenderId: string, actorId: string, dto: UpsertWasteDto) {
    if (!dto.description) throw new BadRequestException("description is required.");
    if (!dto.discipline) throw new BadRequestException("discipline is required.");
    const { truckDays, lineTotal } = this.deriveTotals(dto.wasteTonnes, dto.wasteLoads, dto.ratePerTonne, dto.ratePerLoad);
    return this.prisma.scopeWasteItem.create({
      data: {
        tenderId,
        cardId: dto.cardId ?? null,
        discipline: dto.discipline,
        wbsRef: dto.wbsRef ?? null,
        description: dto.description,
        wasteGroup: dto.wasteGroup ?? null,
        wasteType: dto.wasteType ?? null,
        wasteFacility: dto.wasteFacility ?? null,
        unit: dto.unit ?? null,
        wasteTonnes: dto.wasteTonnes !== undefined && dto.wasteTonnes !== null ? new Prisma.Decimal(dto.wasteTonnes) : null,
        wasteLoads: dto.wasteLoads ?? null,
        truckDays: truckDays !== null ? new Prisma.Decimal(truckDays) : null,
        ratePerTonne: dto.ratePerTonne !== undefined && dto.ratePerTonne !== null ? new Prisma.Decimal(dto.ratePerTonne) : null,
        ratePerLoad: dto.ratePerLoad !== undefined && dto.ratePerLoad !== null ? new Prisma.Decimal(dto.ratePerLoad) : null,
        lineTotal: lineTotal !== null ? new Prisma.Decimal(lineTotal) : null,
        notes: dto.notes ?? null,
        sortOrder: dto.sortOrder ?? 0,
        // PR B3 — manual creates default autoSummed=false. Only
        // sumFromAbove flips this to true on aggregator-created rows.
        autoSummed: false,
        createdById: actorId
      }
    });
  }

  async update(tenderId: string, id: string, dto: UpsertWasteDto) {
    const existing = await this.prisma.scopeWasteItem.findUnique({ where: { id } });
    if (!existing || existing.tenderId !== tenderId) {
      throw new NotFoundException("Waste item not found on this tender.");
    }
    const tonnes = dto.wasteTonnes !== undefined ? dto.wasteTonnes : existing.wasteTonnes ? Number(existing.wasteTonnes) : null;
    const loads = dto.wasteLoads !== undefined ? dto.wasteLoads : existing.wasteLoads;
    const ratePerTonne = dto.ratePerTonne !== undefined ? dto.ratePerTonne : existing.ratePerTonne ? Number(existing.ratePerTonne) : null;
    const ratePerLoad = dto.ratePerLoad !== undefined ? dto.ratePerLoad : existing.ratePerLoad ? Number(existing.ratePerLoad) : null;
    const { truckDays, lineTotal } = this.deriveTotals(tonnes, loads, ratePerTonne, ratePerLoad);
    const data: Prisma.ScopeWasteItemUpdateInput = {};
    if (dto.discipline !== undefined) data.discipline = dto.discipline;
    if (dto.wbsRef !== undefined) data.wbsRef = dto.wbsRef;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.wasteGroup !== undefined) data.wasteGroup = dto.wasteGroup;
    if (dto.wasteType !== undefined) data.wasteType = dto.wasteType;
    if (dto.wasteFacility !== undefined) data.wasteFacility = dto.wasteFacility;
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.wasteTonnes !== undefined)
      data.wasteTonnes = dto.wasteTonnes === null ? null : new Prisma.Decimal(dto.wasteTonnes);
    if (dto.wasteLoads !== undefined) data.wasteLoads = dto.wasteLoads;
    if (dto.ratePerTonne !== undefined)
      data.ratePerTonne = dto.ratePerTonne === null ? null : new Prisma.Decimal(dto.ratePerTonne);
    if (dto.ratePerLoad !== undefined)
      data.ratePerLoad = dto.ratePerLoad === null ? null : new Prisma.Decimal(dto.ratePerLoad);
    data.truckDays = truckDays !== null ? new Prisma.Decimal(truckDays) : null;
    data.lineTotal = lineTotal !== null ? new Prisma.Decimal(lineTotal) : null;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    return this.prisma.scopeWasteItem.update({ where: { id }, data });
  }

  async remove(tenderId: string, id: string) {
    const existing = await this.prisma.scopeWasteItem.findUnique({ where: { id } });
    if (!existing || existing.tenderId !== tenderId) {
      throw new NotFoundException("Waste item not found on this tender.");
    }
    await this.prisma.scopeWasteItem.delete({ where: { id } });
    return { deleted: true };
  }

  async reorder(tenderId: string, entries: Array<{ itemId: string; sortOrder: number }>) {
    await this.prisma.$transaction(
      entries.map((e) =>
        this.prisma.scopeWasteItem.updateMany({
          where: { id: e.itemId, tenderId },
          data: { sortOrder: e.sortOrder }
        })
      )
    );
    return { reordered: entries.length };
  }

  // CEILING(loads / 3) rounded up to nearest half-day.
  // line total = tonnes * ratePerTonne + loads * ratePerLoad.
  private deriveTotals(
    tonnes: number | null | undefined,
    loads: number | null | undefined,
    ratePerTonne: number | null | undefined,
    ratePerLoad: number | null | undefined
  ): { truckDays: number | null; lineTotal: number | null } {
    const truckDays =
      loads === null || loads === undefined ? null : Math.ceil((loads / 3) * 2) / 2;
    let lineTotal: number | null = null;
    if ((tonnes !== null && tonnes !== undefined && ratePerTonne !== null && ratePerTonne !== undefined) ||
        (loads !== null && loads !== undefined && ratePerLoad !== null && ratePerLoad !== undefined)) {
      const t = tonnes ?? 0;
      const rt = ratePerTonne ?? 0;
      const l = loads ?? 0;
      const rl = ratePerLoad ?? 0;
      lineTotal = Math.round((t * rt + l * rl) * 100) / 100;
    }
    return { truckDays, lineTotal };
  }

  /**
   * PR B3 — "Sum from above" aggregator. Reads canonical scope items
   * for the card, groups items where wasteIncluded=true by
   * (wasteGroup, wasteItem, unit), sums their `value`, picks the first
   * active EstimateWasteRate matching (group, type, unit), and
   * REPLACES the existing autoSummed=true waste rows for the card in a
   * single transaction.
   *
   * Manual rows (autoSummed=false) are untouched. Returns the count of
   * rows replaced and the count of new rows created.
   */
  async sumFromAbove(tenderId: string, cardId: string, actorId: string) {
    const card = await this.prisma.scopeCard.findFirst({
      where: { id: cardId, tenderId },
      select: { id: true, discipline: true }
    });
    if (!card) throw new NotFoundException("Card not found.");

    const [items, rates] = await Promise.all([
      this.prisma.scopeOfWorksItem.findMany({
        where: { tenderId, cardId, status: { not: "excluded" } },
        select: {
          wasteIncluded: true,
          wasteGroup: true,
          wasteItem: true,
          unit: true,
          value: true
        }
      }),
      this.prisma.estimateWasteRate.findMany({ where: { isActive: true } })
    ]);

    // Aggregate by (wasteGroup, wasteItem, unit). Skip items missing
    // any required field — they can't be summarised meaningfully.
    type GroupKey = string;
    const totals = new Map<
      GroupKey,
      { wasteGroup: string; wasteType: string; unit: string; qty: number }
    >();
    for (const i of items) {
      if (!i.wasteIncluded) continue;
      if (!i.wasteGroup || !i.wasteItem || !i.unit) continue;
      const qty = i.value == null ? 0 : Number(i.value);
      if (!(qty > 0)) continue;
      const key = `${i.wasteGroup} ${i.wasteItem} ${i.unit}`;
      const existing = totals.get(key);
      if (existing) {
        existing.qty += qty;
      } else {
        totals.set(key, {
          wasteGroup: i.wasteGroup,
          wasteType: i.wasteItem,
          unit: i.unit,
          qty
        });
      }
    }

    // Resolve a facility + tonRate per group, picking the first active
    // (group, type, unit) match. null when no rate exists — frontend
    // renders the row with an amber warning tint.
    const rowsToInsert = Array.from(totals.values()).map((g, index) => {
      const rate = rates.find(
        (r) => r.wasteGroup === g.wasteGroup && r.wasteType === g.wasteType && r.unit === g.unit
      );
      const tonRate = rate ? Number(rate.tonRate) : null;
      const lineTotal = tonRate != null ? Math.round(g.qty * tonRate * 100) / 100 : null;
      return {
        tenderId,
        cardId,
        discipline: card.discipline,
        wbsRef: null as string | null,
        description: `${g.wasteType} (${g.unit})`,
        wasteGroup: g.wasteGroup,
        wasteType: g.wasteType,
        wasteFacility: rate?.facility ?? null,
        unit: g.unit,
        wasteTonnes: new Prisma.Decimal(g.qty), // column-name lie: qty-in-unit
        wasteLoads: null as number | null,
        truckDays: null as Prisma.Decimal | null,
        ratePerTonne: tonRate != null ? new Prisma.Decimal(tonRate) : null,
        ratePerLoad: null as Prisma.Decimal | null,
        lineTotal: lineTotal != null ? new Prisma.Decimal(lineTotal) : null,
        notes: null as string | null,
        sortOrder: index,
        autoSummed: true,
        createdById: actorId
      };
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.scopeWasteItem.deleteMany({
        where: { tenderId, cardId, autoSummed: true }
      });
      let created = 0;
      for (const data of rowsToInsert) {
        await tx.scopeWasteItem.create({ data });
        created += 1;
      }
      return { replaced: deleted.count, created };
    });

    return result;
  }
}

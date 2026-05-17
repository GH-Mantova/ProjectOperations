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
  // PR B4a — m³ companion to wasteTonnes. Manual create/edit accepts
  // either; the sumFromAbove aggregator writes both.
  m3?: number | null;
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
    const { truckDays, lineTotal } = this.deriveTotals(
      dto.wasteTonnes,
      dto.m3,
      dto.wasteLoads,
      dto.ratePerTonne,
      dto.ratePerLoad,
      dto.unit
    );
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
        m3: dto.m3 !== undefined && dto.m3 !== null ? new Prisma.Decimal(dto.m3) : null,
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
    const m3 = dto.m3 !== undefined ? dto.m3 : existing.m3 ? Number(existing.m3) : null;
    const loads = dto.wasteLoads !== undefined ? dto.wasteLoads : existing.wasteLoads;
    const ratePerTonne = dto.ratePerTonne !== undefined ? dto.ratePerTonne : existing.ratePerTonne ? Number(existing.ratePerTonne) : null;
    const ratePerLoad = dto.ratePerLoad !== undefined ? dto.ratePerLoad : existing.ratePerLoad ? Number(existing.ratePerLoad) : null;
    const unit = dto.unit !== undefined ? dto.unit : existing.unit;
    const { truckDays, lineTotal } = this.deriveTotals(tonnes, m3, loads, ratePerTonne, ratePerLoad, unit);
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
    if (dto.m3 !== undefined)
      data.m3 = dto.m3 === null ? null : new Prisma.Decimal(dto.m3);
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
  // PR B4a — line total now bills against EITHER tonnes OR m³ depending
  // on the row's unit (which mirrors the facility's rate.unit). The
  // `ratePerTonne` field name is a legacy column name; semantically it's
  // "rate per billing unit" — same number regardless of which side the
  // qty comes from.
  //   unit === "m³":  qty = m3,          lineTotal = m3 * ratePerTonne + loads * ratePerLoad
  //   else (default): qty = wasteTonnes, lineTotal = tonnes * ratePerTonne + loads * ratePerLoad
  private deriveTotals(
    tonnes: number | null | undefined,
    m3: number | null | undefined,
    loads: number | null | undefined,
    ratePerTonne: number | null | undefined,
    ratePerLoad: number | null | undefined,
    unit: string | null | undefined
  ): { truckDays: number | null; lineTotal: number | null } {
    const truckDays =
      loads === null || loads === undefined ? null : Math.ceil((loads / 3) * 2) / 2;
    const qty = unit === "m³" ? m3 : tonnes;
    let lineTotal: number | null = null;
    if ((qty !== null && qty !== undefined && ratePerTonne !== null && ratePerTonne !== undefined) ||
        (loads !== null && loads !== undefined && ratePerLoad !== null && ratePerLoad !== undefined)) {
      const q = qty ?? 0;
      const rt = ratePerTonne ?? 0;
      const l = loads ?? 0;
      const rl = ratePerLoad ?? 0;
      lineTotal = Math.round((q * rt + l * rl) * 100) / 100;
    }
    return { truckDays, lineTotal };
  }

  /**
   * "Sum from above" aggregator. Reads canonical scope items for the
   * card, groups items where wasteIncluded=true by (wasteGroup,
   * wasteItem), sums both `tonnes` and `m3`, picks the first active
   * EstimateWasteRate matching (group, type), and REPLACES the existing
   * autoSummed=true waste rows for the card in a single transaction.
   *
   * Manual rows (autoSummed=false) are untouched. Returns the count of
   * rows replaced and the count of new rows created.
   *
   * PR B4a — the group key dropped `unit` (a single group can now sum
   * across different scope items regardless of how they were
   * dimensioned), the per-row qty is now BOTH tonnes and m³, and the
   * line total bills against whichever side matches the facility's
   * rate.unit. Items missing both tonnes AND m³ are skipped.
   *
   * Existing autoSummed rows that were created under the B3 contract
   * are deleted on first regeneration — see PR body for the migration
   * note (user re-runs Sum from above per card after the upgrade).
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
          tonnes: true,
          m3: true
        }
      }),
      this.prisma.estimateWasteRate.findMany({ where: { isActive: true } })
    ]);

    // Aggregate by (wasteGroup, wasteItem). Skip items missing the
    // group/item pair or with neither tonnes nor m³ contributing.
    type GroupKey = string;
    const totals = new Map<
      GroupKey,
      { wasteGroup: string; wasteType: string; tonnes: number; m3: number }
    >();
    for (const i of items) {
      if (!i.wasteIncluded) continue;
      if (!i.wasteGroup || !i.wasteItem) continue;
      const tonnes = i.tonnes == null ? 0 : Number(i.tonnes);
      const m3 = i.m3 == null ? 0 : Number(i.m3);
      if (!(tonnes > 0) && !(m3 > 0)) continue;
      const key = `${i.wasteGroup} ${i.wasteItem}`;
      const existing = totals.get(key);
      if (existing) {
        existing.tonnes += tonnes;
        existing.m3 += m3;
      } else {
        totals.set(key, {
          wasteGroup: i.wasteGroup,
          wasteType: i.wasteItem,
          tonnes,
          m3
        });
      }
    }

    // Resolve a facility + rate per group, picking the first active
    // (group, type) match. Unit no longer narrows the rate lookup; the
    // billing side comes from the rate's own unit. null when no rate
    // exists; frontend renders the row with an amber warning tint.
    const rowsToInsert = Array.from(totals.values()).map((g, index) => {
      const rate = rates.find(
        (r) => r.wasteGroup === g.wasteGroup && r.wasteType === g.wasteType
      );
      const tonRate = rate ? Number(rate.tonRate) : null;
      const billingUnit = rate?.unit ?? null;
      const qtyForBilling = billingUnit === "m³" ? g.m3 : g.tonnes;
      const lineTotal = tonRate != null ? Math.round(qtyForBilling * tonRate * 100) / 100 : null;
      // Round persisted tonnes/m³ to match Decimal column precision.
      const tonnesRounded = Math.round(g.tonnes * 1000) / 1000;
      const m3Rounded = Math.round(g.m3 * 100) / 100;
      return {
        tenderId,
        cardId,
        discipline: card.discipline,
        wbsRef: null as string | null,
        description: g.wasteType,
        wasteGroup: g.wasteGroup,
        wasteType: g.wasteType,
        wasteFacility: rate?.facility ?? null,
        unit: billingUnit,
        wasteTonnes: new Prisma.Decimal(tonnesRounded),
        m3: new Prisma.Decimal(m3Rounded),
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

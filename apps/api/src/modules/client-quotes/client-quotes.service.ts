import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ClientQuoteStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ScopeRedesignService } from "../tendering/scope-redesign.service";

const DISCIPLINE_LABEL: Record<string, string> = {
  SO: "Strip-out & demolition works",
  Str: "Structural demolition",
  Asb: "Asbestos removal",
  Civ: "Civil works",
  Prv: "Provisional sums"
};

export type SummaryResult = {
  baseTotalCostLines: number;
  adjustmentAmount: number;
  adjustedTotal: number;
  provisionalTotal: number;
  costOptionsTotal: number;
  clientFacingTotal: number;
};

type CostLineInput = { label: string; description: string; price: number; sortOrder?: number };

type PrismaDecimal = Prisma.Decimal;

function toDec(v: number | string): PrismaDecimal {
  return new Prisma.Decimal(typeof v === "number" ? v : Number(v));
}

function toNum(v: Prisma.Decimal | number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = Number((v as { toString(): string }).toString());
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class ClientQuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeRedesignService
  ) {}

  // ── Quote CRUD ──────────────────────────────────────────────────────
  async listByTender(tenderId: string) {
    await this.requireTender(tenderId);
    return this.prisma.clientQuote.findMany({
      where: { tenderId },
      orderBy: [{ clientId: "asc" }, { revision: "desc" }],
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { costLines: true, provisionalLines: true, costOptions: true } }
      }
    });
  }

  async getOne(tenderId: string, quoteId: string) {
    const quote = await this.prisma.clientQuote.findUnique({
      where: { id: quoteId },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        costLines: { orderBy: { sortOrder: "asc" } },
        provisionalLines: { orderBy: { sortOrder: "asc" } },
        costOptions: { orderBy: { sortOrder: "asc" } },
        assumptions: { orderBy: [{ costLineId: "asc" }, { sortOrder: "asc" }] },
        exclusions: { orderBy: { sortOrder: "asc" } }
      }
    });
    if (!quote || quote.tenderId !== tenderId) throw new NotFoundException("Quote not found.");
    return quote;
  }

  async create(
    tenderId: string,
    actorId: string,
    dto: { clientId: string; copyFromQuoteId?: string }
  ) {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true, tenderNumber: true }
    });
    if (!tender) throw new NotFoundException("Tender not found.");

    // Revision = previous revision for this tenderId+clientId + 1. The max
    // across existing rows gives us R2 / R3 / etc; missing = R1.
    const prior = await this.prisma.clientQuote.findMany({
      where: { tenderId, clientId: dto.clientId },
      orderBy: { revision: "desc" },
      take: 1
    });
    const nextRevision = (prior[0]?.revision ?? 0) + 1;
    const quoteRef =
      nextRevision > 1 ? `${tender.tenderNumber}-R${nextRevision}` : tender.tenderNumber;

    // Mark the previous revision SUPERSEDED when we mint a new one so the
    // Quote tab can render a clean version history.
    if (prior[0] && prior[0].status !== "SUPERSEDED") {
      await this.prisma.clientQuote.update({
        where: { id: prior[0].id },
        data: { status: ClientQuoteStatus.SUPERSEDED }
      });
    }

    const quote = await this.prisma.clientQuote.create({
      data: {
        tenderId,
        clientId: dto.clientId,
        revision: nextRevision,
        quoteRef,
        createdById: actorId
      }
    });

    if (dto.copyFromQuoteId) {
      await this.deepCopyFrom(quote.id, dto.copyFromQuoteId);
    } else {
      await this.seedSuggestedCostLines(quote.id, tenderId);
    }

    return this.getOne(tenderId, quote.id);
  }

  async update(
    tenderId: string,
    quoteId: string,
    dto: Partial<{
      adjustmentPct: number | null;
      adjustmentAmt: number | null;
      adjustmentNote: string | null;
      assumptionMode: "free" | "linked";
      showProvisional: boolean;
      showCostOptions: boolean;
      status: ClientQuoteStatus;
      detailLevel: "simple" | "detailed";
    }>
  ) {
    await this.requireQuote(tenderId, quoteId);
    const data: Prisma.ClientQuoteUpdateInput = {};
    if (dto.adjustmentPct !== undefined)
      data.adjustmentPct = dto.adjustmentPct === null ? null : toDec(dto.adjustmentPct);
    if (dto.adjustmentAmt !== undefined)
      data.adjustmentAmt = dto.adjustmentAmt === null ? null : toDec(dto.adjustmentAmt);
    if (dto.adjustmentNote !== undefined) data.adjustmentNote = dto.adjustmentNote;
    if (dto.assumptionMode !== undefined) data.assumptionMode = dto.assumptionMode;
    if (dto.showProvisional !== undefined) data.showProvisional = dto.showProvisional;
    if (dto.showCostOptions !== undefined) data.showCostOptions = dto.showCostOptions;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.detailLevel !== undefined) data.detailLevel = dto.detailLevel;
    await this.prisma.clientQuote.update({ where: { id: quoteId }, data });
    return this.getOne(tenderId, quoteId);
  }

  async delete(tenderId: string, quoteId: string) {
    const q = await this.requireQuote(tenderId, quoteId);
    if (q.status !== "DRAFT") {
      throw new ForbiddenException("Only DRAFT quotes can be deleted.");
    }
    await this.prisma.clientQuote.delete({ where: { id: quoteId } });
    return { id: quoteId };
  }

  // ── Summary (clientFacingTotal is safe to render on the PDF) ────────
  async summary(tenderId: string, quoteId: string): Promise<SummaryResult> {
    const q = await this.prisma.clientQuote.findUnique({
      where: { id: quoteId },
      include: {
        costLines: true,
        provisionalLines: true,
        costOptions: true
      }
    });
    if (!q || q.tenderId !== tenderId) throw new NotFoundException("Quote not found.");
    const baseTotalCostLines = q.costLines.reduce((s, l) => s + toNum(l.price), 0);
    // Dollar adjustment wins over percentage when both are set — the UI
    // shouldn't really set both but we pick a deterministic order.
    let adjustmentAmount = 0;
    if (q.adjustmentAmt !== null) adjustmentAmount = toNum(q.adjustmentAmt);
    else if (q.adjustmentPct !== null) adjustmentAmount = baseTotalCostLines * (toNum(q.adjustmentPct) / 100);
    const adjustedTotal = baseTotalCostLines + adjustmentAmount;
    const provisionalTotal = q.provisionalLines.reduce((s, l) => s + toNum(l.price), 0);
    const costOptionsTotal = q.costOptions.reduce((s, l) => s + toNum(l.price), 0);
    return {
      baseTotalCostLines: round2(baseTotalCostLines),
      adjustmentAmount: round2(adjustmentAmount),
      adjustedTotal: round2(adjustedTotal),
      provisionalTotal: round2(provisionalTotal),
      costOptionsTotal: round2(costOptionsTotal),
      clientFacingTotal: round2(adjustedTotal)
    };
  }

  // ── Cost lines ──────────────────────────────────────────────────────
  async listCostLines(tenderId: string, quoteId: string) {
    await this.requireQuote(tenderId, quoteId);
    return this.prisma.quoteCostLine.findMany({
      where: { quoteId },
      orderBy: { sortOrder: "asc" }
    });
  }

  async createCostLine(tenderId: string, quoteId: string, dto: CostLineInput) {
    await this.requireQuote(tenderId, quoteId);
    const sortOrder =
      dto.sortOrder ??
      (await this.prisma.quoteCostLine.count({ where: { quoteId } }));
    return this.prisma.quoteCostLine.create({
      data: {
        quoteId,
        label: dto.label,
        description: dto.description,
        price: toDec(dto.price),
        sortOrder
      }
    });
  }

  async updateCostLine(
    tenderId: string,
    quoteId: string,
    lineId: string,
    dto: Partial<CostLineInput>
  ) {
    await this.requireCostLine(tenderId, quoteId, lineId);
    const data: Prisma.QuoteCostLineUpdateInput = {};
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = toDec(dto.price);
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    return this.prisma.quoteCostLine.update({ where: { id: lineId }, data });
  }

  async deleteCostLine(tenderId: string, quoteId: string, lineId: string) {
    await this.requireCostLine(tenderId, quoteId, lineId);
    await this.prisma.quoteCostLine.delete({ where: { id: lineId } });
    return { id: lineId };
  }

  async reorderCostLines(tenderId: string, quoteId: string, order: Array<{ lineId: string; sortOrder: number }>) {
    await this.requireQuote(tenderId, quoteId);
    await this.prisma.$transaction(
      order.map((o) =>
        this.prisma.quoteCostLine.update({ where: { id: o.lineId }, data: { sortOrder: o.sortOrder } })
      )
    );
    return { updated: order.length };
  }

  // ── Provisional lines ──────────────────────────────────────────────
  async listProvisional(tenderId: string, quoteId: string) {
    await this.requireQuote(tenderId, quoteId);
    return this.prisma.quoteProvisionalLine.findMany({
      where: { quoteId },
      orderBy: { sortOrder: "asc" }
    });
  }
  async createProvisional(
    tenderId: string,
    quoteId: string,
    dto: { description: string; price: number; notes?: string | null; sortOrder?: number }
  ) {
    await this.requireQuote(tenderId, quoteId);
    const sortOrder =
      dto.sortOrder ?? (await this.prisma.quoteProvisionalLine.count({ where: { quoteId } }));
    return this.prisma.quoteProvisionalLine.create({
      data: {
        quoteId,
        description: dto.description,
        price: toDec(dto.price),
        notes: dto.notes ?? null,
        sortOrder
      }
    });
  }
  async updateProvisional(
    tenderId: string,
    quoteId: string,
    lineId: string,
    dto: Partial<{ description: string; price: number; notes: string | null; sortOrder: number }>
  ) {
    await this.requireProvisional(tenderId, quoteId, lineId);
    const data: Prisma.QuoteProvisionalLineUpdateInput = {};
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = toDec(dto.price);
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    return this.prisma.quoteProvisionalLine.update({ where: { id: lineId }, data });
  }
  async deleteProvisional(tenderId: string, quoteId: string, lineId: string) {
    await this.requireProvisional(tenderId, quoteId, lineId);
    await this.prisma.quoteProvisionalLine.delete({ where: { id: lineId } });
    return { id: lineId };
  }

  // ── Cost options ───────────────────────────────────────────────────
  async listOptions(tenderId: string, quoteId: string) {
    await this.requireQuote(tenderId, quoteId);
    return this.prisma.quoteCostOption.findMany({
      where: { quoteId },
      orderBy: { sortOrder: "asc" }
    });
  }
  async createOption(
    tenderId: string,
    quoteId: string,
    dto: { label: string; description: string; price: number; notes?: string | null; sortOrder?: number }
  ) {
    await this.requireQuote(tenderId, quoteId);
    const sortOrder =
      dto.sortOrder ?? (await this.prisma.quoteCostOption.count({ where: { quoteId } }));
    return this.prisma.quoteCostOption.create({
      data: {
        quoteId,
        label: dto.label,
        description: dto.description,
        price: toDec(dto.price),
        notes: dto.notes ?? null,
        sortOrder
      }
    });
  }
  async updateOption(
    tenderId: string,
    quoteId: string,
    lineId: string,
    dto: Partial<{ label: string; description: string; price: number; notes: string | null; sortOrder: number }>
  ) {
    await this.requireOption(tenderId, quoteId, lineId);
    const data: Prisma.QuoteCostOptionUpdateInput = {};
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = toDec(dto.price);
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    return this.prisma.quoteCostOption.update({ where: { id: lineId }, data });
  }
  async deleteOption(tenderId: string, quoteId: string, lineId: string) {
    await this.requireOption(tenderId, quoteId, lineId);
    await this.prisma.quoteCostOption.delete({ where: { id: lineId } });
    return { id: lineId };
  }

  // ── Assumptions (can be linked to a cost line or free-form) ──────────
  async listAssumptions(tenderId: string, quoteId: string) {
    await this.requireQuote(tenderId, quoteId);
    const rows = await this.prisma.quoteAssumption.findMany({
      where: { quoteId },
      orderBy: [{ sortOrder: "asc" }]
    });
    // Linked ones first, grouped by cost line label; free-form last.
    rows.sort((a, b) => {
      if ((a.costLineId === null) !== (b.costLineId === null)) return a.costLineId === null ? 1 : -1;
      return a.sortOrder - b.sortOrder;
    });
    return rows;
  }
  async createAssumption(
    tenderId: string,
    quoteId: string,
    dto: { text: string; costLineId?: string | null; sortOrder?: number }
  ) {
    await this.requireQuote(tenderId, quoteId);
    if (dto.costLineId) {
      await this.requireCostLine(tenderId, quoteId, dto.costLineId);
    }
    const sortOrder =
      dto.sortOrder ?? (await this.prisma.quoteAssumption.count({ where: { quoteId } }));
    return this.prisma.quoteAssumption.create({
      data: {
        quoteId,
        text: dto.text,
        costLineId: dto.costLineId ?? null,
        sortOrder
      }
    });
  }
  async updateAssumption(
    tenderId: string,
    quoteId: string,
    id: string,
    dto: Partial<{ text: string; costLineId: string | null; sortOrder: number }>
  ) {
    const row = await this.prisma.quoteAssumption.findUnique({ where: { id } });
    if (!row || row.quoteId !== quoteId) throw new NotFoundException("Assumption not found.");
    await this.requireQuote(tenderId, quoteId);
    const data: Prisma.QuoteAssumptionUpdateInput = {};
    if (dto.text !== undefined) data.text = dto.text;
    if (dto.costLineId !== undefined) {
      if (dto.costLineId) await this.requireCostLine(tenderId, quoteId, dto.costLineId);
      data.costLine = dto.costLineId ? { connect: { id: dto.costLineId } } : { disconnect: true };
    }
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    return this.prisma.quoteAssumption.update({ where: { id }, data });
  }
  async deleteAssumption(tenderId: string, quoteId: string, id: string) {
    const row = await this.prisma.quoteAssumption.findUnique({ where: { id } });
    if (!row || row.quoteId !== quoteId) throw new NotFoundException("Assumption not found.");
    await this.prisma.quoteAssumption.delete({ where: { id } });
    return { id };
  }
  async copyAssumptionsFromTender(tenderId: string, quoteId: string) {
    await this.requireQuote(tenderId, quoteId);
    const src = await this.prisma.tenderAssumption.findMany({
      where: { tenderId },
      orderBy: { sortOrder: "asc" }
    });
    if (src.length === 0) return { copied: 0 };
    const base = await this.prisma.quoteAssumption.count({ where: { quoteId } });
    await this.prisma.$transaction(
      src.map((a, i) =>
        this.prisma.quoteAssumption.create({
          data: { quoteId, text: a.text, costLineId: null, sortOrder: base + i }
        })
      )
    );
    return { copied: src.length };
  }

  // ── Exclusions ─────────────────────────────────────────────────────
  async listExclusions(tenderId: string, quoteId: string) {
    await this.requireQuote(tenderId, quoteId);
    return this.prisma.quoteExclusion.findMany({
      where: { quoteId },
      orderBy: { sortOrder: "asc" }
    });
  }
  async createExclusion(
    tenderId: string,
    quoteId: string,
    dto: { text: string; sortOrder?: number }
  ) {
    await this.requireQuote(tenderId, quoteId);
    const sortOrder = dto.sortOrder ?? (await this.prisma.quoteExclusion.count({ where: { quoteId } }));
    return this.prisma.quoteExclusion.create({
      data: { quoteId, text: dto.text, sortOrder }
    });
  }
  async updateExclusion(
    tenderId: string,
    quoteId: string,
    id: string,
    dto: Partial<{ text: string; sortOrder: number }>
  ) {
    const row = await this.prisma.quoteExclusion.findUnique({ where: { id } });
    if (!row || row.quoteId !== quoteId) throw new NotFoundException("Exclusion not found.");
    await this.requireQuote(tenderId, quoteId);
    const data: Prisma.QuoteExclusionUpdateInput = {};
    if (dto.text !== undefined) data.text = dto.text;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    return this.prisma.quoteExclusion.update({ where: { id }, data });
  }
  async deleteExclusion(tenderId: string, quoteId: string, id: string) {
    const row = await this.prisma.quoteExclusion.findUnique({ where: { id } });
    if (!row || row.quoteId !== quoteId) throw new NotFoundException("Exclusion not found.");
    await this.prisma.quoteExclusion.delete({ where: { id } });
    return { id };
  }
  async copyExclusionsFromTender(tenderId: string, quoteId: string) {
    await this.requireQuote(tenderId, quoteId);
    const src = await this.prisma.tenderExclusion.findMany({
      where: { tenderId },
      orderBy: { sortOrder: "asc" }
    });
    if (src.length === 0) return { copied: 0 };
    const base = await this.prisma.quoteExclusion.count({ where: { quoteId } });
    await this.prisma.$transaction(
      src.map((e, i) =>
        this.prisma.quoteExclusion.create({
          data: { quoteId, text: e.text, sortOrder: base + i }
        })
      )
    );
    return { copied: src.length };
  }

  // ── Suggested adjustment based on preferenceScore + winRate ─────────
  async suggestion(clientId: string): Promise<{ suggestedAdjustmentPct: number; rationale: string }> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { preferenceScore: true, winRate: true, winCount: true, tenderCount: true }
    });
    if (!client) throw new NotFoundException("Client not found.");
    let base = 0;
    const parts: string[] = [];
    switch (client.preferenceScore) {
      case 5: base = -7.5; parts.push("most preferred client (5★)"); break;
      case 4: base = -2.5; parts.push("preferred client (4★)"); break;
      case 3: base = 0; parts.push("neutral client (3★)"); break;
      case 2: base = 7.5; parts.push("low preference (2★)"); break;
      case 1: base = 12.5; parts.push("least preferred (1★)"); break;
      default: parts.push("no preference score set — starting at 0%");
    }
    const winRate = client.winRate ? toNum(client.winRate) : null;
    if (winRate !== null) {
      if (winRate < 10) {
        base += 5;
        parts.push(`win rate ${winRate.toFixed(1)}% < 10% → +5%`);
      } else if (winRate > 50) {
        base -= 5;
        parts.push(`win rate ${winRate.toFixed(1)}% > 50% → −5%`);
      } else {
        parts.push(`win rate ${winRate.toFixed(1)}% (neutral range)`);
      }
    }
    return {
      suggestedAdjustmentPct: Number(base.toFixed(2)),
      rationale: parts.join("; ")
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────
  private async requireTender(tenderId: string) {
    const t = await this.prisma.tender.findUnique({ where: { id: tenderId }, select: { id: true } });
    if (!t) throw new NotFoundException("Tender not found.");
    return t;
  }
  private async requireQuote(tenderId: string, quoteId: string) {
    const q = await this.prisma.clientQuote.findUnique({ where: { id: quoteId } });
    if (!q || q.tenderId !== tenderId) throw new NotFoundException("Quote not found.");
    return q;
  }
  private async requireCostLine(tenderId: string, quoteId: string, lineId: string) {
    await this.requireQuote(tenderId, quoteId);
    const line = await this.prisma.quoteCostLine.findUnique({ where: { id: lineId } });
    if (!line || line.quoteId !== quoteId) throw new NotFoundException("Cost line not found.");
    return line;
  }
  private async requireProvisional(tenderId: string, quoteId: string, lineId: string) {
    await this.requireQuote(tenderId, quoteId);
    const line = await this.prisma.quoteProvisionalLine.findUnique({ where: { id: lineId } });
    if (!line || line.quoteId !== quoteId) throw new NotFoundException("Provisional line not found.");
    return line;
  }
  private async requireOption(tenderId: string, quoteId: string, lineId: string) {
    await this.requireQuote(tenderId, quoteId);
    const line = await this.prisma.quoteCostOption.findUnique({ where: { id: lineId } });
    if (!line || line.quoteId !== quoteId) throw new NotFoundException("Cost option not found.");
    return line;
  }

  private async deepCopyFrom(targetQuoteId: string, sourceQuoteId: string) {
    const source = await this.prisma.clientQuote.findUnique({
      where: { id: sourceQuoteId },
      include: {
        costLines: true,
        provisionalLines: true,
        costOptions: true,
        assumptions: true,
        exclusions: true
      }
    });
    if (!source) throw new BadRequestException("Source quote for copy not found.");
    // Map old cost-line IDs to new ones so we can re-link assumptions.
    const lineIdMap = new Map<string, string>();
    for (const cl of source.costLines) {
      const created = await this.prisma.quoteCostLine.create({
        data: {
          quoteId: targetQuoteId,
          label: cl.label,
          description: cl.description,
          price: cl.price,
          sortOrder: cl.sortOrder
        }
      });
      lineIdMap.set(cl.id, created.id);
    }
    for (const pv of source.provisionalLines) {
      await this.prisma.quoteProvisionalLine.create({
        data: {
          quoteId: targetQuoteId,
          description: pv.description,
          price: pv.price,
          notes: pv.notes,
          sortOrder: pv.sortOrder
        }
      });
    }
    for (const op of source.costOptions) {
      await this.prisma.quoteCostOption.create({
        data: {
          quoteId: targetQuoteId,
          label: op.label,
          description: op.description,
          price: op.price,
          notes: op.notes,
          sortOrder: op.sortOrder
        }
      });
    }
    for (const a of source.assumptions) {
      await this.prisma.quoteAssumption.create({
        data: {
          quoteId: targetQuoteId,
          costLineId: a.costLineId ? lineIdMap.get(a.costLineId) ?? null : null,
          text: a.text,
          sortOrder: a.sortOrder
        }
      });
    }
    for (const e of source.exclusions) {
      await this.prisma.quoteExclusion.create({
        data: {
          quoteId: targetQuoteId,
          text: e.text,
          sortOrder: e.sortOrder
        }
      });
    }
    // Copy the adjustment values too — revisions usually start from the
    // prior commercial position rather than zero.
    await this.prisma.clientQuote.update({
      where: { id: targetQuoteId },
      data: {
        adjustmentPct: source.adjustmentPct,
        adjustmentAmt: source.adjustmentAmt,
        adjustmentNote: source.adjustmentNote,
        assumptionMode: source.assumptionMode,
        showProvisional: source.showProvisional,
        showCostOptions: source.showCostOptions
      }
    });
  }

  private async seedSuggestedCostLines(quoteId: string, tenderId: string) {
    const summary = (await this.scope.summary(tenderId)) as unknown as Record<
      string,
      { itemCount: number; subtotal: number; withMarkup: number } | { itemCount: number; subtotal: number } | number
    >;
    const disciplines = ["SO", "Str", "Asb", "Civ"] as const;
    let sort = 0;
    const letters = ["A", "B", "C", "D", "E", "F"];
    for (const d of disciplines) {
      const b = summary[d] as { itemCount: number; subtotal: number; withMarkup: number };
      if (!b || b.itemCount === 0 || !b.withMarkup) continue;
      await this.prisma.quoteCostLine.create({
        data: {
          quoteId,
          label: letters[sort] ?? String(sort + 1),
          description: DISCIPLINE_LABEL[d],
          price: toDec(Number(b.withMarkup.toFixed(2))),
          sortOrder: sort
        }
      });
      sort += 1;
    }
    const cutting = summary.cutting as { itemCount: number; subtotal: number } | undefined;
    if (cutting && (cutting.itemCount > 0 || cutting.subtotal > 0)) {
      await this.prisma.quoteCostLine.create({
        data: {
          quoteId,
          label: letters[sort] ?? String(sort + 1),
          description: "Concrete cutting",
          price: toDec(Number(cutting.subtotal.toFixed(2))),
          sortOrder: sort
        }
      });
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

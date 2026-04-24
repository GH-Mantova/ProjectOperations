import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

// Client-facing scope table on a ClientQuote. Each entry is a copy of a
// scope/cutting/waste row with independently editable label / description /
// qty / unit / notes / isVisible. Source references are tracked so reset +
// push-from-scope can tell which quote rows are already linked.

type UpsertDto = {
  sourceItemId?: string | null;
  sourceItemType?: "scope" | "cutting" | "waste" | string | null;
  label?: string | null;
  description?: string;
  qty?: string | null;
  unit?: string | null;
  notes?: string | null;
  isVisible?: boolean;
  sortOrder?: number;
};

@Injectable()
export class QuoteScopeItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenderId: string, quoteId: string) {
    await this.requireQuote(tenderId, quoteId);
    return this.prisma.quoteScopeItem.findMany({
      where: { quoteId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  }

  async create(tenderId: string, quoteId: string, dto: UpsertDto) {
    await this.requireQuote(tenderId, quoteId);
    if (!dto.description) throw new BadRequestException("description is required.");
    return this.prisma.quoteScopeItem.create({
      data: {
        quoteId,
        sourceItemId: dto.sourceItemId ?? null,
        sourceItemType: dto.sourceItemType ?? null,
        label: dto.label ?? null,
        description: dto.description,
        qty: dto.qty ?? null,
        unit: dto.unit ?? null,
        notes: dto.notes ?? null,
        isVisible: dto.isVisible ?? true,
        sortOrder: dto.sortOrder ?? 0
      }
    });
  }

  async update(tenderId: string, quoteId: string, id: string, dto: UpsertDto) {
    await this.requireQuote(tenderId, quoteId);
    const existing = await this.prisma.quoteScopeItem.findUnique({ where: { id } });
    if (!existing || existing.quoteId !== quoteId) {
      throw new NotFoundException("Quote scope item not found.");
    }
    return this.prisma.quoteScopeItem.update({
      where: { id },
      data: {
        label: dto.label !== undefined ? dto.label : undefined,
        description: dto.description !== undefined ? dto.description : undefined,
        qty: dto.qty !== undefined ? dto.qty : undefined,
        unit: dto.unit !== undefined ? dto.unit : undefined,
        notes: dto.notes !== undefined ? dto.notes : undefined,
        isVisible: dto.isVisible !== undefined ? dto.isVisible : undefined,
        sortOrder: dto.sortOrder !== undefined ? dto.sortOrder : undefined
      }
    });
  }

  async remove(tenderId: string, quoteId: string, id: string) {
    await this.requireQuote(tenderId, quoteId);
    const existing = await this.prisma.quoteScopeItem.findUnique({ where: { id } });
    if (!existing || existing.quoteId !== quoteId) {
      throw new NotFoundException("Quote scope item not found.");
    }
    await this.prisma.quoteScopeItem.delete({ where: { id } });
    return { deleted: true };
  }

  async reorder(tenderId: string, quoteId: string, entries: Array<{ itemId: string; sortOrder: number }>) {
    await this.requireQuote(tenderId, quoteId);
    await this.prisma.$transaction(
      entries.map((e) =>
        this.prisma.quoteScopeItem.updateMany({
          where: { id: e.itemId, quoteId },
          data: { sortOrder: e.sortOrder }
        })
      )
    );
    return { reordered: entries.length };
  }

  // Rebuild the quote's scope list from current scope/waste/cutting data.
  // reset = wipe + recreate; push = add only items that aren't already
  // linked (sourceItemId match).
  async rebuild(tenderId: string, quoteId: string, mode: "reset" | "push") {
    await this.requireQuote(tenderId, quoteId);
    if (mode === "reset") {
      await this.prisma.quoteScopeItem.deleteMany({ where: { quoteId } });
    }

    const [scopeItems, wasteItems, cuttingItems, existing] = await Promise.all([
      this.prisma.scopeOfWorksItem.findMany({
        where: { tenderId, status: { not: "excluded" } },
        orderBy: [{ discipline: "asc" }, { sortOrder: "asc" }, { itemNumber: "asc" }]
      }),
      this.prisma.scopeWasteItem.findMany({
        where: { tenderId },
        orderBy: [{ discipline: "asc" }, { sortOrder: "asc" }]
      }),
      this.prisma.cuttingSheetItem.findMany({
        where: { tenderId },
        orderBy: [{ wbsRef: "asc" }, { sortOrder: "asc" }]
      }),
      mode === "push"
        ? this.prisma.quoteScopeItem.findMany({ where: { quoteId }, select: { sourceItemId: true } })
        : Promise.resolve([] as Array<{ sourceItemId: string | null }>)
    ]);
    const seen = new Set(existing.map((e) => e.sourceItemId).filter((x): x is string => !!x));

    let order = mode === "reset" ? 0 : (await this.prisma.quoteScopeItem.count({ where: { quoteId } }));
    const rows: Array<{
      quoteId: string;
      sourceItemId: string;
      sourceItemType: string;
      label: string | null;
      description: string;
      qty: string | null;
      unit: string | null;
      notes: string | null;
      isVisible: boolean;
      sortOrder: number;
    }> = [];

    for (const s of scopeItems) {
      if (seen.has(s.id)) continue;
      rows.push({
        quoteId,
        sourceItemId: s.id,
        sourceItemType: "scope",
        label: s.wbsCode,
        description: s.description,
        qty: s.measurementQty !== null ? s.measurementQty.toString() : null,
        unit: s.measurementUnit ?? null,
        notes: s.notes ?? null,
        isVisible: true,
        sortOrder: order++
      });
    }
    for (const w of wasteItems) {
      if (seen.has(w.id)) continue;
      rows.push({
        quoteId,
        sourceItemId: w.id,
        sourceItemType: "waste",
        label: w.wbsRef,
        description: w.description,
        qty: w.wasteTonnes !== null ? w.wasteTonnes.toString() : null,
        unit: w.wasteTonnes !== null ? "T" : null,
        notes: w.notes ?? null,
        isVisible: true,
        sortOrder: order++
      });
    }
    for (const c of cuttingItems) {
      if (seen.has(c.id)) continue;
      const description = c.description ?? c.itemType ?? "Cutting item";
      const qty = c.quantityLm !== null ? c.quantityLm.toString() : c.quantityEach !== null ? c.quantityEach.toString() : null;
      const unit = c.quantityLm !== null ? "Lm" : c.quantityEach !== null ? "ea" : null;
      rows.push({
        quoteId,
        sourceItemId: c.id,
        sourceItemType: "cutting",
        label: c.wbsRef,
        description,
        qty,
        unit,
        notes: c.notes ?? null,
        isVisible: true,
        sortOrder: order++
      });
    }

    if (rows.length === 0) return { created: 0 };
    await this.prisma.quoteScopeItem.createMany({ data: rows });
    return { created: rows.length };
  }

  private async requireQuote(tenderId: string, quoteId: string) {
    const quote = await this.prisma.clientQuote.findUnique({
      where: { id: quoteId },
      select: { id: true, tenderId: true }
    });
    if (!quote || quote.tenderId !== tenderId) {
      throw new NotFoundException("Quote not found on this tender.");
    }
    return quote;
  }
}

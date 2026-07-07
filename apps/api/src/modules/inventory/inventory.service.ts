import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, StockMovementType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  CreateStockMovementDto,
  CreateStocktakeDto,
  InventoryItemsQueryDto,
  StockMovementTypeDto,
  UpsertStockCategoryDto,
  UpsertStockItemDto,
  UpsertStocktakeCountDto
} from "./dto/inventory.dto";

const ALLOWED_STATUSES = new Set(["OPEN", "COMMITTED", "CANCELLED"]);

/**
 * Business logic for the native inventory / stock layer (PR-486).
 *
 * Enforces unique category names and unique SKUs, atomically updates
 * StockItem.quantityOnHand on every posted movement, and refuses to drive
 * on-hand below zero on an ISSUE. Stocktake commits produce a single
 * signed ADJUST movement per item whose counted quantity differs from the
 * system quantity.
 */
@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  // ── Categories ─────────────────────────────────────────────────────────

  async listCategories() {
    return this.prisma.stockCategory.findMany({ orderBy: { name: "asc" } });
  }

  async upsertCategory(id: string | undefined, dto: UpsertStockCategoryDto, actorId?: string) {
    const clash = await this.prisma.stockCategory.findFirst({
      where: {
        name: dto.name,
        ...(id ? { NOT: { id } } : {})
      }
    });
    if (clash) {
      throw new ConflictException("Stock category with that name already exists.");
    }

    const record = id
      ? await this.prisma.stockCategory.update({
          where: { id },
          data: {
            name: dto.name,
            code: dto.code ?? null,
            description: dto.description ?? null,
            isActive: dto.isActive ?? true
          }
        })
      : await this.prisma.stockCategory.create({
          data: {
            name: dto.name,
            code: dto.code ?? null,
            description: dto.description ?? null,
            isActive: dto.isActive ?? true
          }
        });

    await this.auditService.write({
      actorId,
      action: id ? "inventory.category.update" : "inventory.category.create",
      entityType: "StockCategory",
      entityId: record.id
    });

    return record;
  }

  // ── Items ──────────────────────────────────────────────────────────────

  async listItems(query: InventoryItemsQueryDto) {
    const where: Prisma.StockItemWhereInput = {
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { sku: { contains: query.q, mode: "insensitive" } }
            ]
          }
        : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {})
    };

    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockItem.findMany({
        where,
        include: { category: true },
        orderBy: [{ name: "asc" }],
        skip,
        take: query.pageSize
      }),
      this.prisma.stockItem.count({ where })
    ]);

    // lowStockOnly is a post-filter — reorderLevel is nullable and Prisma
    // where clauses can't compare two nullable Decimal columns cleanly.
    const filtered =
      query.lowStockOnly === "true"
        ? items.filter(
            (item) =>
              item.reorderLevel !== null &&
              new Prisma.Decimal(item.quantityOnHand).lte(new Prisma.Decimal(item.reorderLevel))
          )
        : items;

    return {
      items: filtered,
      total: query.lowStockOnly === "true" ? filtered.length : total,
      page: query.page,
      pageSize: query.pageSize
    };
  }

  async getItem(id: string) {
    const item = await this.prisma.stockItem.findUnique({
      where: { id },
      include: {
        category: true,
        movements: {
          orderBy: { createdAt: "desc" },
          take: 50
        }
      }
    });
    if (!item) throw new NotFoundException("Stock item not found.");
    return item;
  }

  async upsertItem(id: string | undefined, dto: UpsertStockItemDto, actorId?: string) {
    if (dto.sku) {
      const clash = await this.prisma.stockItem.findFirst({
        where: {
          sku: dto.sku,
          ...(id ? { NOT: { id } } : {})
        }
      });
      if (clash) {
        throw new ConflictException("Stock item with that SKU already exists.");
      }
    }

    const data = {
      name: dto.name,
      sku: dto.sku ?? null,
      categoryId: dto.categoryId ?? null,
      unit: dto.unit,
      reorderLevel: dto.reorderLevel !== undefined ? new Prisma.Decimal(dto.reorderLevel) : null,
      location: dto.location ?? null,
      isActive: dto.isActive ?? true
    };

    const record = id
      ? await this.prisma.stockItem.update({ where: { id }, data })
      : await this.prisma.stockItem.create({ data });

    await this.auditService.write({
      actorId,
      action: id ? "inventory.item.update" : "inventory.item.create",
      entityType: "StockItem",
      entityId: record.id
    });

    return this.getItem(record.id);
  }

  // ── Movements ──────────────────────────────────────────────────────────

  /**
   * Signed delta applied to StockItem.quantityOnHand for a given movement.
   *
   * RECEIVE / RETURN → positive; ISSUE → negative; ADJUST → caller-provided
   * signed delta passed straight through.
   */
  private signedDelta(type: StockMovementTypeDto, quantity: number): Prisma.Decimal {
    if (type === StockMovementTypeDto.ISSUE) {
      return new Prisma.Decimal(-Math.abs(quantity));
    }
    if (type === StockMovementTypeDto.RECEIVE || type === StockMovementTypeDto.RETURN) {
      return new Prisma.Decimal(Math.abs(quantity));
    }
    // ADJUST — signed delta straight through.
    return new Prisma.Decimal(quantity);
  }

  async postMovement(itemId: string, dto: CreateStockMovementDto, actorId?: string) {
    const item = await this.prisma.stockItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException("Stock item not found.");

    const delta = this.signedDelta(dto.type, dto.quantity);
    const nextQty = new Prisma.Decimal(item.quantityOnHand).add(delta);

    if (nextQty.lt(0)) {
      throw new BadRequestException(
        "Movement would drive quantity on hand below zero. Adjust the source figure or record an ADJUST instead."
      );
    }

    const [movement] = await this.prisma.$transaction([
      this.prisma.stockMovement.create({
        data: {
          stockItemId: itemId,
          type: dto.type as StockMovementType,
          quantity: delta,
          reason: dto.reason ?? null,
          refType: dto.refType ?? null,
          refId: dto.refId ?? null,
          movedByUserId: actorId ?? null
        }
      }),
      this.prisma.stockItem.update({
        where: { id: itemId },
        data: { quantityOnHand: nextQty }
      })
    ]);

    await this.auditService.write({
      actorId,
      action: "inventory.movement.create",
      entityType: "StockMovement",
      entityId: movement.id
    });

    return movement;
  }

  async listMovements(itemId: string) {
    return this.prisma.stockMovement.findMany({
      where: { stockItemId: itemId },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }

  // ── Stocktakes ─────────────────────────────────────────────────────────

  async openStocktake(dto: CreateStocktakeDto, actorId?: string) {
    const session = await this.prisma.stocktakeSession.create({
      data: {
        startedByUserId: actorId ?? null,
        notes: dto.notes ?? null,
        status: "OPEN"
      }
    });

    await this.auditService.write({
      actorId,
      action: "inventory.stocktake.open",
      entityType: "StocktakeSession",
      entityId: session.id
    });

    return session;
  }

  async listStocktakes() {
    return this.prisma.stocktakeSession.findMany({
      orderBy: { startedAt: "desc" },
      take: 100
    });
  }

  async getStocktake(id: string) {
    const session = await this.prisma.stocktakeSession.findUnique({
      where: { id },
      include: {
        counts: {
          include: { stockItem: true },
          orderBy: { createdAt: "asc" }
        }
      }
    });
    if (!session) throw new NotFoundException("Stocktake session not found.");
    return session;
  }

  async recordCount(sessionId: string, dto: UpsertStocktakeCountDto, actorId?: string) {
    const session = await this.prisma.stocktakeSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException("Stocktake session not found.");
    if (session.status !== "OPEN") {
      throw new BadRequestException("Only OPEN stocktakes accept new counts.");
    }

    const item = await this.prisma.stockItem.findUnique({ where: { id: dto.stockItemId } });
    if (!item) throw new NotFoundException("Stock item not found.");

    const record = await this.prisma.stocktakeCount.upsert({
      where: {
        sessionId_stockItemId: { sessionId, stockItemId: dto.stockItemId }
      },
      update: {
        systemQty: item.quantityOnHand,
        countedQty: new Prisma.Decimal(dto.countedQty)
      },
      create: {
        sessionId,
        stockItemId: dto.stockItemId,
        systemQty: item.quantityOnHand,
        countedQty: new Prisma.Decimal(dto.countedQty)
      }
    });

    await this.auditService.write({
      actorId,
      action: "inventory.stocktake.count",
      entityType: "StocktakeCount",
      entityId: record.id
    });

    return record;
  }

  async commitStocktake(sessionId: string, actorId?: string) {
    const session = await this.prisma.stocktakeSession.findUnique({
      where: { id: sessionId },
      include: { counts: true }
    });
    if (!session) throw new NotFoundException("Stocktake session not found.");
    if (!ALLOWED_STATUSES.has(session.status)) {
      throw new BadRequestException(`Unexpected stocktake status: ${session.status}`);
    }
    if (session.status !== "OPEN") {
      throw new BadRequestException("Only OPEN stocktakes can be committed.");
    }

    const variances = session.counts
      .map((count) => ({
        stockItemId: count.stockItemId,
        systemQty: new Prisma.Decimal(count.systemQty),
        countedQty: new Prisma.Decimal(count.countedQty),
        delta: new Prisma.Decimal(count.countedQty).sub(new Prisma.Decimal(count.systemQty))
      }))
      .filter((row) => !row.delta.equals(0));

    // Apply each variance as an ADJUST movement. Kept as separate writes
    // (not one big $transaction) so a partial failure surfaces cleanly and
    // the operator can see which items applied.
    for (const variance of variances) {
      await this.prisma.$transaction([
        this.prisma.stockMovement.create({
          data: {
            stockItemId: variance.stockItemId,
            type: "ADJUST",
            quantity: variance.delta,
            reason: `STOCKTAKE ${sessionId}`,
            refType: "StocktakeSession",
            refId: sessionId,
            movedByUserId: actorId ?? null
          }
        }),
        this.prisma.stockItem.update({
          where: { id: variance.stockItemId },
          data: { quantityOnHand: variance.countedQty }
        })
      ]);
    }

    const updated = await this.prisma.stocktakeSession.update({
      where: { id: sessionId },
      data: { status: "COMMITTED", committedAt: new Date() }
    });

    await this.auditService.write({
      actorId,
      action: "inventory.stocktake.commit",
      entityType: "StocktakeSession",
      entityId: sessionId
    });

    return { session: updated, variancesApplied: variances.length };
  }

  async cancelStocktake(sessionId: string, actorId?: string) {
    const session = await this.prisma.stocktakeSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException("Stocktake session not found.");
    if (session.status !== "OPEN") {
      throw new BadRequestException("Only OPEN stocktakes can be cancelled.");
    }

    const updated = await this.prisma.stocktakeSession.update({
      where: { id: sessionId },
      data: { status: "CANCELLED" }
    });

    await this.auditService.write({
      actorId,
      action: "inventory.stocktake.cancel",
      entityType: "StocktakeSession",
      entityId: sessionId
    });

    return updated;
  }
}

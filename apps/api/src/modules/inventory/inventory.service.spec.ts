import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { InventoryService } from "./inventory.service";
import { StockMovementTypeDto } from "./dto/inventory.dto";

describe("InventoryService", () => {
  it("posts a RECEIVE movement and updates quantityOnHand atomically", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: "item-1",
      quantityOnHand: new Prisma.Decimal(10)
    });
    const $transaction = jest.fn().mockResolvedValue([
      { id: "mv-1", stockItemId: "item-1", quantity: new Prisma.Decimal(5) }
    ]);
    const movementCreate = jest.fn();
    const itemUpdate = jest.fn();

    const service = new InventoryService(
      {
        stockItem: { findUnique, update: itemUpdate },
        stockMovement: { create: movementCreate },
        $transaction
      } as never,
      { write: jest.fn() } as never
    );

    const result = await service.postMovement(
      "item-1",
      { type: StockMovementTypeDto.RECEIVE, quantity: 5 },
      "user-1"
    );

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(result.id).toBe("mv-1");
  });

  it("rejects an ISSUE that would drive quantityOnHand below zero", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: "item-1",
      quantityOnHand: new Prisma.Decimal(3)
    });

    const service = new InventoryService(
      {
        stockItem: { findUnique, update: jest.fn() },
        stockMovement: { create: jest.fn() },
        $transaction: jest.fn()
      } as never,
      { write: jest.fn() } as never
    );

    await expect(
      service.postMovement(
        "item-1",
        { type: StockMovementTypeDto.ISSUE, quantity: 5 },
        "user-1"
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("stocktake commit writes ADJUST movements only for variances", async () => {
    const sessionFindUnique = jest.fn().mockResolvedValue({
      id: "s-1",
      status: "OPEN",
      counts: [
        // exact match — no variance
        {
          stockItemId: "item-a",
          systemQty: new Prisma.Decimal(10),
          countedQty: new Prisma.Decimal(10)
        },
        // variance +2
        {
          stockItemId: "item-b",
          systemQty: new Prisma.Decimal(5),
          countedQty: new Prisma.Decimal(7)
        }
      ]
    });
    const sessionUpdate = jest.fn().mockResolvedValue({ id: "s-1", status: "COMMITTED" });
    const $transaction = jest.fn().mockResolvedValue([{}, {}]);

    const service = new InventoryService(
      {
        stocktakeSession: { findUnique: sessionFindUnique, update: sessionUpdate },
        stockMovement: { create: jest.fn() },
        stockItem: { update: jest.fn() },
        $transaction
      } as never,
      { write: jest.fn() } as never
    );

    const result = await service.commitStocktake("s-1", "user-1");

    // Only the variance should have produced a transaction call.
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(result.variancesApplied).toBe(1);
    expect(sessionUpdate).toHaveBeenCalledTimes(1);
  });

  it("rejects a duplicate SKU on stock item upsert", async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: "existing-item" });

    const service = new InventoryService(
      {
        stockItem: {
          findFirst,
          create: jest.fn(),
          update: jest.fn(),
          findUnique: jest.fn()
        }
      } as never,
      { write: jest.fn() } as never
    );

    await expect(
      service.upsertItem(
        undefined,
        { name: "Bolt M10", sku: "BOLT-M10", unit: "ea" },
        "user-1"
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ProcurementService } from "./procurement.service";
import {
  ProcurementLineCategoryDto,
  ProcurementRequestStatusDto
} from "./dto/procurement.dto";

describe("ProcurementService", () => {
  const buildPrismaMock = (overrides: Record<string, unknown> = {}) => ({
    procurementRequest: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      ...(overrides.procurementRequest as object | undefined)
    },
    procurementLine: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      ...(overrides.procurementLine as object | undefined)
    },
    purchaseOrder: {
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      ...(overrides.purchaseOrder as object | undefined)
    },
    procurementConfig: {
      findUnique: jest.fn().mockResolvedValue(null),
      ...(overrides.procurementConfig as object | undefined)
    },
    subcontractorSupplier: {
      findUnique: jest.fn(),
      ...(overrides.subcontractorSupplier as object | undefined)
    },
    notification: {
      create: jest.fn(),
      ...(overrides.notification as object | undefined)
    },
    $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops))
  });

  const auditMock = () => ({ write: jest.fn() });

  it("routes an under-limit submit to APPROVED via AuthorityService", async () => {
    const prisma = buildPrismaMock({
      procurementRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: "req-1",
          status: "DRAFT",
          reference: "PR-000001",
          quoteEvidenceRef: null,
          lines: [
            {
              id: "l1",
              stockItemId: null,
              quantity: new Prisma.Decimal(2),
              unitPrice: new Prisma.Decimal(100),
              lineTotal: new Prisma.Decimal(200)
            }
          ],
          purchaseOrders: []
        }),
        update: jest.fn().mockImplementation(({ data }) => ({
          id: "req-1",
          status: data.status,
          lines: [],
          purchaseOrders: []
        }))
      }
    });

    const authority = {
      check: jest.fn().mockResolvedValue({
        allowed: true,
        requiresEscalation: false
      })
    };

    const svc = new ProcurementService(
      prisma as never,
      auditMock() as never,
      authority as never,
      { resolveProvider: jest.fn() } as never,
      { postMovement: jest.fn() } as never
    );

    const result = await svc.submitRequest("req-1", {}, "user-1");

    expect(authority.check).toHaveBeenCalledWith({
      userId: "user-1",
      action: "procurement.purchase.approve",
      amount: 200
    });
    expect(result.status).toBe("APPROVED");
  });

  it("routes an over-limit submit to SUBMITTED and records the approver", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: "req-2",
      status: "DRAFT",
      reference: "PR-000002",
      quoteEvidenceRef: "QUOTE-2026-07-07-42",
      lines: [
        {
          id: "l1",
          stockItemId: null,
          quantity: new Prisma.Decimal(1),
          unitPrice: new Prisma.Decimal(9000),
          lineTotal: new Prisma.Decimal(9000)
        }
      ],
      purchaseOrders: []
    });
    const update = jest.fn().mockImplementation(({ data }) => ({
      id: "req-2",
      status: data.status,
      approverUserId: data.approverUserId,
      requiresEscalation: data.requiresEscalation,
      lines: [],
      purchaseOrders: []
    }));

    const prisma = buildPrismaMock({
      procurementRequest: { findUnique, update }
    });

    const authority = {
      check: jest.fn().mockResolvedValue({
        allowed: false,
        requiresEscalation: true,
        escalateToUserId: "approver-1",
        matchedRuleId: "rule-1"
      })
    };

    const svc = new ProcurementService(
      prisma as never,
      auditMock() as never,
      authority as never,
      { resolveProvider: jest.fn() } as never,
      { postMovement: jest.fn() } as never
    );

    const result = await svc.submitRequest("req-2", {}, "user-2");

    expect(result.status).toBe("SUBMITTED");
    expect(result.approverUserId).toBe("approver-1");
    expect(result.requiresEscalation).toBe(true);
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it("sourcing gate: blocks submit at or above min threshold without quote evidence", async () => {
    const prisma = buildPrismaMock({
      procurementRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: "req-3",
          status: "DRAFT",
          reference: "PR-000003",
          quoteEvidenceRef: null,
          lines: [
            {
              id: "l1",
              stockItemId: null,
              quantity: new Prisma.Decimal(1),
              unitPrice: new Prisma.Decimal(6000),
              lineTotal: new Prisma.Decimal(6000)
            }
          ],
          purchaseOrders: []
        })
      }
    });

    const authority = { check: jest.fn() };

    const svc = new ProcurementService(
      prisma as never,
      auditMock() as never,
      authority as never,
      { resolveProvider: jest.fn() } as never,
      { postMovement: jest.fn() } as never
    );

    await expect(svc.submitRequest("req-3", {}, "user-3")).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(authority.check).not.toHaveBeenCalled();
  });

  it("issue emails supplier and creates PurchaseOrder", async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    const prisma = buildPrismaMock({
      procurementRequest: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: "req-4",
            status: "APPROVED",
            reference: "PR-000004",
            supplierId: "sup-1",
            lines: [],
            purchaseOrders: []
          })
          .mockResolvedValueOnce({
            id: "req-4",
            status: "ISSUED",
            reference: "PR-000004",
            supplierId: "sup-1",
            lines: [],
            purchaseOrders: [{ id: "po-1", poNumber: "PO-000001" }]
          }),
        update: jest.fn().mockResolvedValue({ id: "req-4", status: "ISSUED" })
      },
      purchaseOrder: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "po-1", poNumber: "PO-000001" }),
        update: jest.fn()
      },
      subcontractorSupplier: {
        findUnique: jest.fn().mockResolvedValue({
          id: "sup-1",
          name: "Acme Steel",
          email: "orders@acme.example"
        })
      }
    });

    const svc = new ProcurementService(
      prisma as never,
      auditMock() as never,
      { check: jest.fn() } as never,
      { resolveProvider: jest.fn().mockResolvedValue({ sendMail }) } as never,
      { postMovement: jest.fn() } as never
    );

    await svc.issuePurchaseOrder("req-4", {}, "user-4");

    expect(prisma.purchaseOrder.create).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].to).toEqual(["orders@acme.example"]);
  });

  it("receive posts a RECEIVE StockMovement for every line with a stockItemId", async () => {
    const postMovement = jest.fn().mockResolvedValue({ id: "mv-1" });
    const prisma = buildPrismaMock({
      procurementRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: "req-5",
          status: "ISSUED",
          reference: "PR-000005",
          lines: [
            {
              id: "l1",
              stockItemId: "item-a",
              quantity: new Prisma.Decimal(3)
            },
            {
              // No stockItemId — hire/subcontract line, receive is a no-op.
              id: "l2",
              stockItemId: null,
              quantity: new Prisma.Decimal(1)
            }
          ],
          purchaseOrders: []
        }),
        update: jest.fn().mockResolvedValue({ id: "req-5", status: "RECEIVED" })
      }
    });

    const svc = new ProcurementService(
      prisma as never,
      auditMock() as never,
      { check: jest.fn() } as never,
      { resolveProvider: jest.fn() } as never,
      { postMovement } as never
    );

    const result = await svc.receiveRequest("req-5", "user-5");

    expect(postMovement).toHaveBeenCalledTimes(1);
    expect(postMovement.mock.calls[0][0]).toBe("item-a");
    expect(postMovement.mock.calls[0][1].type).toBe("RECEIVE");
    expect(result.status).toBe("RECEIVED");
  });

  it("createRequest sets DRAFT and computes lineTotal from quantity × unitPrice", async () => {
    const create = jest.fn().mockResolvedValue({
      id: "req-6",
      status: "DRAFT",
      reference: "PR-000001",
      lines: [],
      purchaseOrders: []
    });
    const prisma = buildPrismaMock({
      procurementRequest: {
        count: jest.fn().mockResolvedValue(0),
        create
      }
    });

    const svc = new ProcurementService(
      prisma as never,
      auditMock() as never,
      { check: jest.fn() } as never,
      { resolveProvider: jest.fn() } as never,
      { postMovement: jest.fn() } as never
    );

    await svc.createRequest(
      {
        lines: [
          {
            description: "Bolts M10",
            category: ProcurementLineCategoryDto.CONSUMABLE,
            quantity: 4,
            unit: "ea",
            unitPrice: 2.5
          }
        ]
      },
      "user-6"
    );

    const passedLines = (create.mock.calls[0][0] as { data: { lines: { create: unknown[] } } })
      .data.lines.create as Array<{ lineTotal: Prisma.Decimal }>;
    expect(passedLines[0].lineTotal.toString()).toBe("10");
  });

  it("DTO enum surface stays aligned with Prisma", () => {
    expect(Object.values(ProcurementRequestStatusDto)).toEqual([
      "DRAFT",
      "SUBMITTED",
      "APPROVED",
      "ISSUED",
      "RECEIVED",
      "CANCELLED"
    ]);
  });
});

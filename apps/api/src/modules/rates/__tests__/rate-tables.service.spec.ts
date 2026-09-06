import { ConflictException, NotFoundException } from "@nestjs/common";
import { RateTablesService } from "../rate-tables.service";

function makePrisma(overrides: Record<string, unknown> = {}) {
  const prisma = {
    rateTable: {
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({})
    },
    rateColumn: {
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({})
    },
    rateRow: { count: jest.fn().mockResolvedValue(0) },
    tenderRateEntry: { count: jest.fn().mockResolvedValue(0) },
    subcontractorSupplier: { findUnique: jest.fn() },
    ...overrides
  };
  return prisma;
}

function makeAudit() {
  return { write: jest.fn().mockResolvedValue(undefined) };
}

const VALIDATION_STUB = { assertStructure: jest.fn(), validateRow: jest.fn() };

function build(prisma: ReturnType<typeof makePrisma>, audit = makeAudit()) {
  return {
    service: new RateTablesService(prisma as never, VALIDATION_STUB as never, audit as never),
    prisma,
    audit
  };
}

const RATE_TABLE = {
  id: "rt-1",
  name: "Excavator production",
  slug: "excavator-production",
  description: null,
  category: "SUBCONTRACTOR",
  subcontractorType: null,
  supplierId: null,
  isSystem: false,
  isReference: false,
  columns: [{ id: "c-1" }],
  rows: []
};

describe("RateTablesService.deleteTable", () => {
  test("throws NotFound when the table does not exist", async () => {
    const prisma = makePrisma();
    const { service } = build(prisma);
    await expect(service.deleteTable("missing", "actor-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  test("refuses with 409 when any RateRow references the table and writes no audit", async () => {
    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockResolvedValue(RATE_TABLE);
    prisma.rateRow.count.mockResolvedValue(2);
    const { service, audit } = build(prisma);
    await expect(service.deleteTable("rt-1", "actor-1")).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.rateTable.delete).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  test("refuses with 409 when a TenderRateSet snapshot still references the table", async () => {
    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockResolvedValue(RATE_TABLE);
    prisma.rateRow.count.mockResolvedValue(0);
    prisma.tenderRateEntry.count.mockResolvedValue(1);
    const { service, audit } = build(prisma);
    await expect(service.deleteTable("rt-1", "actor-1")).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.rateTable.delete).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  test("hard-deletes when unused and writes an audit row with the payload", async () => {
    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockResolvedValue(RATE_TABLE);
    const { service, audit } = build(prisma);
    await expect(service.deleteTable("rt-1", "actor-1")).resolves.toEqual({ deleted: true });
    expect(prisma.rateTable.delete).toHaveBeenCalledWith({ where: { id: "rt-1" } });
    expect(audit.write).toHaveBeenCalledTimes(1);
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "actor-1",
        action: "rateTable.delete",
        entityType: "RateTable",
        entityId: "rt-1",
        metadata: expect.objectContaining({
          slug: "excavator-production",
          category: "SUBCONTRACTOR",
          columnCount: 1
        })
      })
    );
  });
});

describe("RateTablesService.deleteColumn", () => {
  const COLUMN = {
    id: "col-1",
    rateTableId: "rt-1",
    name: "region",
    dataType: "TEXT",
    role: "KEY",
    unit: null,
    listSlug: null,
    required: false,
    min: null,
    max: null,
    sortOrder: 0
  };

  test("throws NotFound when the column is not on the table", async () => {
    const prisma = makePrisma();
    prisma.rateColumn.findUnique.mockResolvedValue({ ...COLUMN, rateTableId: "rt-other" });
    const { service } = build(prisma);
    await expect(service.deleteColumn("rt-1", "col-1", "actor-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  test("refuses with 409 when the parent table still has rows (cells would orphan)", async () => {
    const prisma = makePrisma();
    prisma.rateColumn.findUnique.mockResolvedValue(COLUMN);
    prisma.rateRow.count.mockResolvedValue(3);
    const { service, audit } = build(prisma);
    await expect(service.deleteColumn("rt-1", "col-1", "actor-1")).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(prisma.rateColumn.delete).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  test("hard-deletes when the table has no rows and writes an audit row", async () => {
    const prisma = makePrisma();
    prisma.rateColumn.findUnique.mockResolvedValue(COLUMN);
    const { service, audit } = build(prisma);
    await expect(service.deleteColumn("rt-1", "col-1", "actor-1")).resolves.toEqual({
      deleted: true
    });
    expect(prisma.rateColumn.delete).toHaveBeenCalledWith({ where: { id: "col-1" } });
    expect(audit.write).toHaveBeenCalledTimes(1);
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "actor-1",
        action: "rateColumn.delete",
        entityType: "RateColumn",
        entityId: "col-1",
        metadata: expect.objectContaining({ rateTableId: "rt-1", name: "region", role: "KEY" })
      })
    );
  });
});

// ── RATE_LINE_FIELDS_V1 ───────────────────────────────────────────────────
//
// The acceptance set is the approved mock-up's four tables. Before this slice
// not one of them could be entered: `Depth` is not a column on `Core holes`,
// so step 1 was a 400 and the other six steps were never reached.

const CORE_HOLES_COLUMNS = [
  { id: "c-diameter", name: "Diameter" },
  { id: "c-rate", name: "Rate" }
];

/** The three line fields the mock-up declares on `Core holes`. */
const CORE_HOLES_LINE_FIELDS = [
  { name: "Depth", kind: "number", unit: "mm", sample: 18 },
  {
    name: "Elevation",
    kind: "text",
    options: ["Floor", "Wall", "Inverted"],
    sample: "Inverted"
  },
  { name: "Holes", kind: "number", sample: 12 }
];

/** `Depth / 10 -> round -> never less than 1 -> x Rate -> x2 if inverted -> x Holes`. */
const CORE_HOLES_STEPS = [
  { op: "start", field: "Depth" },
  { op: "divide", field: 10 },
  { op: "round", direction: "nearest", interval: 1 },
  { op: "floor", value: 1 },
  { op: "multiply", field: "Rate" },
  { op: "multiply", field: 2, when: { field: "Elevation", cmp: "is", value: "Inverted" } },
  { op: "multiply", field: "Holes" }
];

function makeLineFieldPrisma(
  table: Record<string, unknown> = {},
  columns = CORE_HOLES_COLUMNS
) {
  const stored = {
    ...RATE_TABLE,
    id: "rt-core",
    name: "Core holes",
    columns,
    rows: [{ id: "row-32", cells: { "c-diameter": 32, "c-rate": 1.7 } }],
    lineFields: null,
    ...table
  };
  return {
    rateTable: {
      findUnique: jest.fn().mockResolvedValue(stored),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          ...stored,
          ...data
        })),
      delete: jest.fn().mockResolvedValue({})
    },
    rateColumn: { findUnique: jest.fn(), delete: jest.fn() },
    rateRow: { count: jest.fn().mockResolvedValue(0) },
    tenderRateEntry: { count: jest.fn().mockResolvedValue(0) },
    subcontractorSupplier: { findUnique: jest.fn() }
  };
}

/** Same wiring as `build`, for the line-field prisma double. */
function buildLineFieldService(prisma: ReturnType<typeof makeLineFieldPrisma>) {
  const audit = makeAudit();
  return {
    service: new RateTablesService(prisma as never, VALIDATION_STUB as never, audit as never),
    prisma,
    audit
  };
}

/** Run a PATCH that must be refused, and return the 400's exact message. */
async function patchRejection(
  steps: unknown[],
  lineFields?: unknown,
  prismaTable: Record<string, unknown> = {}
): Promise<string> {
  const prisma = makeLineFieldPrisma(prismaTable);
  const { service } = buildLineFieldService(prisma);
  try {
    await service.patchChargeSteps("actor-1", "rt-core", steps, lineFields);
  } catch (err) {
    expect(prisma.rateTable.update).not.toHaveBeenCalled();
    return (err as Error).message;
  }
  throw new Error("expected patchChargeSteps to throw");
}

describe("RateTablesService.patchChargeSteps — line fields (RATE_LINE_FIELDS_V1)", () => {
  test("accepts the mock-up's Core holes rule and stores the declaration", async () => {
    const prisma = makeLineFieldPrisma();
    const { service, audit } = buildLineFieldService(prisma);

    const updated = await service.patchChargeSteps(
      "actor-1",
      "rt-core",
      CORE_HOLES_STEPS,
      CORE_HOLES_LINE_FIELDS
    );

    const write = prisma.rateTable.update.mock.calls[0][0];
    expect(write.data.chargeSteps).toEqual(CORE_HOLES_STEPS);
    expect(write.data.lineFields).toEqual([
      { name: "Depth", kind: "number", unit: "mm", sample: 18 },
      {
        name: "Elevation",
        kind: "text",
        options: ["Floor", "Wall", "Inverted"],
        sample: "Inverted"
      },
      { name: "Holes", kind: "number", sample: 12 }
    ]);
    expect(updated).toBeDefined();
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { stepCount: 7, lineFieldCount: 3 } })
    );
  });

  test("the same PATCH without the declaration is still refused, naming the step", async () => {
    const message = await patchRejection(
      CORE_HOLES_STEPS
    );
    expect(message).toBe(
      'Step 0 (op: start): field "Depth" is not a column or line field on this table.'
    );
  });

  test("a line-field name that clashes with a column is refused, naming both", async () => {
    const message = await patchRejection(
      [{ op: "start", field: "Rate" }],
      [{ name: "rate", kind: "number", sample: 1 }]
    );
    expect(message).toContain('Line field "rate" clashes with the column "Rate"');
  });

  test("a line field declared twice is refused", async () => {
    const message = await patchRejection(
      [{ op: "start", field: "Depth" }],
      [
        { name: "Depth", kind: "number" },
        { name: "depth", kind: "number" }
      ]
    );
    expect(message).toContain('Line field "depth" is declared twice');
  });

  test("text in the sum and a name that does not exist are DIFFERENT messages", async () => {
    const textInSum = await patchRejection(
      [
        { op: "start", field: "Rate" },
        { op: "multiply", field: "Elevation" }
      ],
      CORE_HOLES_LINE_FIELDS
    );
    const noSuchName = await patchRejection(
      [
        { op: "start", field: "Rate" },
        { op: "multiply", field: "Elevatoin" }
      ],
      CORE_HOLES_LINE_FIELDS
    );

    expect(textInSum).toBe(
      'Step 1 (op: multiply): line field "Elevation" is text, so it can only be used in an "only when" condition, not in the sum.'
    );
    expect(noSuchName).toBe(
      'Step 1 (op: multiply): field "Elevatoin" is not a column or line field on this table.'
    );
    expect(textInSum).not.toEqual(noSuchName);
  });

  test("a text line field IS allowed as a condition field", async () => {
    const prisma = makeLineFieldPrisma();
    const { service } = buildLineFieldService(prisma);
    await expect(
      service.patchChargeSteps(
        "actor-1",
        "rt-core",
        [
          { op: "start", field: "Rate" },
          { op: "multiply", field: 2, when: { field: "Elevation", cmp: "is", value: "Inverted" } }
        ],
        CORE_HOLES_LINE_FIELDS
      )
    ).resolves.toBeDefined();
  });

  test("omitting lineFields keeps the stored declaration and validates against it", async () => {
    const prisma = makeLineFieldPrisma({ lineFields: CORE_HOLES_LINE_FIELDS });
    const { service } = buildLineFieldService(prisma);

    await service.patchChargeSteps("actor-1", "rt-core", CORE_HOLES_STEPS);

    const write = prisma.rateTable.update.mock.calls[0][0];
    expect(write.data.chargeSteps).toEqual(CORE_HOLES_STEPS);
    expect(write.data).not.toHaveProperty("lineFields");
  });

  test("an empty array clears the declaration, and steps must then stand alone", async () => {
    const message = await patchRejection(
      CORE_HOLES_STEPS,
      [],
      { lineFields: CORE_HOLES_LINE_FIELDS }
    );
    expect(message).toContain('field "Depth" is not a column or line field');
  });

  test("options belong to a text field, and a sample must match its kind", async () => {
    await expect(
      patchRejection([{ op: "start", field: "Rate" }], [
        { name: "Depth", kind: "number", options: ["a", "b"] }
      ])
    ).resolves.toContain('only a "text" line field may carry "options"');

    await expect(
      patchRejection([{ op: "start", field: "Rate" }], [
        { name: "Depth", kind: "number", sample: "eighteen" }
      ])
    ).resolves.toContain('"sample" must be a finite number');

    await expect(
      patchRejection([{ op: "start", field: "Rate" }], [
        { name: "Elevation", kind: "text", options: ["Floor"], sample: "Inverted" }
      ])
    ).resolves.toContain('"sample" must be one of its options');
  });

  test("an unknown kind is refused", async () => {
    const message = await patchRejection(
      [{ op: "start", field: "Rate" }],
      [{ name: "Depth", kind: "decimal" }]
    );
    expect(message).toContain('"kind" must be "number" or "text"');
  });

  test("a step list naming only columns is unaffected", async () => {
    const prisma = makeLineFieldPrisma({ lineFields: CORE_HOLES_LINE_FIELDS });
    const { service } = buildLineFieldService(prisma);
    const columnsOnly = [
      { op: "start", field: "Rate" },
      { op: "multiply", field: "Diameter" }
    ];
    await expect(
      service.patchChargeSteps("actor-1", "rt-core", columnsOnly)
    ).resolves.toBeDefined();
    expect(prisma.rateTable.update.mock.calls[0][0].data.chargeSteps).toEqual(columnsOnly);
  });

  test("the first-step-must-be-start rule is NOT relaxed", async () => {
    const message = await patchRejection(
      [{ op: "multiply", field: "Depth" }],
      CORE_HOLES_LINE_FIELDS
    );
    expect(message).toBe('Step 0: first step must have op "start" (got "multiply").');
  });
});

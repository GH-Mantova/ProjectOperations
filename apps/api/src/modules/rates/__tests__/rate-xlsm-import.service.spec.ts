/**
 * rate-xlsm-import.service.spec.ts
 *
 * S4 spec coverage:
 *  1. Zero-column table + header row → N columns created via createColumn, data rows imported.
 *  2. Table with existing columns → match-and-warn path unchanged; shipped strings survive.
 *  3. Empty header row → shipped error string survives.
 *  4. createColumn throws (e.g. duplicate heading) → error propagates, not swallowed.
 *  5. Type inference: all-numeric → NUMBER; numeric + currency hint → CURRENCY; else → TEXT.
 *  6. Role inference: rightmost CURRENCY → VALUE; TEXT → KEY; else → INFO.
 */

import ExcelJS from "exceljs";
import { NotFoundException } from "@nestjs/common";
import { RateXlsmImportService } from "../rate-xlsm-import.service";

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a minimal ExcelJS buffer with the given header cells and optional
 * data rows. Returns a Node Buffer.
 */
async function makeXlsxBuffer(
  headerCells: string[],
  dataRows: (string | number | null)[][] = []
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(headerCells);
  for (const row of dataRows) {
    ws.addRow(row);
  }
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab);
}

// ── Stubs ────────────────────────────────────────────────────────────────────

function makePrisma(tableOverride: Record<string, unknown> | null = null) {
  const baseTable = {
    id: "rt-1",
    name: "Test Table",
    slug: "test-table",
    columns: [] as unknown[]
  };

  return {
    rateTable: {
      findUnique: jest.fn().mockImplementation(() =>
        Promise.resolve(tableOverride !== null ? tableOverride : { ...baseTable })
      )
    },
    rateRow: {
      findMany: jest.fn().mockResolvedValue([])
    }
  };
}

function makeAudit() {
  return { write: jest.fn().mockResolvedValue(undefined) };
}

/**
 * Build a RateTablesService stub. createColumn resolves with a fake column
 * carrying the name passed to it, unless an override is provided.
 */
function makeRateTables(
  createColumnImpl?: (tableId: string, dto: { name: string; sortOrder?: number }) => Promise<unknown>
) {
  const defaultImpl = (_tableId: string, dto: { name: string; sortOrder?: number }) =>
    Promise.resolve({ id: `col-${dto.name}`, name: dto.name, role: "KEY", dataType: "TEXT" });
  return {
    createColumn: jest.fn().mockImplementation(createColumnImpl ?? defaultImpl)
  };
}

function buildService(
  prisma: ReturnType<typeof makePrisma>,
  rateTables: ReturnType<typeof makeRateTables>
) {
  return new RateXlsmImportService(
    prisma as never,
    makeAudit() as never,
    rateTables as never
  );
}

// ── Suite 1: zero-column table — create path ─────────────────────────────────

describe("RateXlsmImportService — zero-column table (createColumnsFromHeader)", () => {
  test("calls createColumn for each header cell in sheet order and then imports data rows", async () => {
    const buf = await makeXlsxBuffer(
      ["Region", "Rate"],
      [["North", 10], ["South", 20]]
    );

    // After column creation, the re-fetch must return the newly created columns
    // so the match path can resolve them. Simulate this by having findUnique
    // return the empty table on the first call and the populated table on the
    // second (re-fetch after createColumn calls).
    const createdColumns = [
      { id: "col-Region", name: "Region", role: "KEY", dataType: "TEXT", required: false },
      { id: "col-Rate", name: "Rate", role: "VALUE", dataType: "CURRENCY", required: false }
    ];
    const emptyTable = { id: "rt-1", name: "Test Table", slug: "test-table", columns: [] };
    const populatedTable = { ...emptyTable, columns: createdColumns };

    const prisma = {
      rateTable: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(emptyTable)   // initial fetch
          .mockResolvedValueOnce(populatedTable) // re-fetch after column creation
      },
      rateRow: { findMany: jest.fn().mockResolvedValue([]) }
    };

    const rateTables = makeRateTables();
    const svc = buildService(prisma as never, rateTables);

    const result = await svc.stageImport(buf, "test-table");

    // createColumn should have been called once per header cell, in order.
    expect(rateTables.createColumn).toHaveBeenCalledTimes(2);
    expect(rateTables.createColumn).toHaveBeenNthCalledWith(
      1,
      "rt-1",
      expect.objectContaining({ name: "Region", sortOrder: 0 })
    );
    expect(rateTables.createColumn).toHaveBeenNthCalledWith(
      2,
      "rt-1",
      expect.objectContaining({ name: "Rate", sortOrder: 1 })
    );

    // Import succeeds; data rows are parsed.
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.preview).toHaveLength(2);
  });

  test("throws when createColumn throws (e.g. assertStructure rejects)", async () => {
    const buf = await makeXlsxBuffer(["Region", "Region"]);

    const emptyTable = { id: "rt-1", name: "T", slug: "t", columns: [] };
    const prisma = {
      rateTable: { findUnique: jest.fn().mockResolvedValue(emptyTable) },
      rateRow: { findMany: jest.fn() }
    };

    const error = new Error("Column \"Region\" already exists on this table.");
    const rateTables = makeRateTables(() => Promise.reject(error));
    const svc = buildService(prisma as never, rateTables);

    await expect(svc.stageImport(buf, "t")).rejects.toThrow(
      "Column \"Region\" already exists on this table."
    );
  });
});

// ── Suite 2: table with existing columns — match-and-warn path unchanged ─────

describe("RateXlsmImportService — existing columns (match-and-warn path)", () => {
  const existingColumns = [
    {
      id: "c-key",
      name: "Region",
      role: "KEY",
      dataType: "TEXT",
      required: true
    },
    {
      id: "c-val",
      name: "Rate",
      role: "VALUE",
      dataType: "CURRENCY",
      required: true
    }
  ];

  test("does NOT call createColumn when the table already has columns", async () => {
    const buf = await makeXlsxBuffer(["Region", "Rate"], [["North", 10]]);

    const prisma = makePrisma({
      id: "rt-1",
      name: "Existing",
      slug: "existing",
      columns: existingColumns
    });
    const rateTables = makeRateTables();
    const svc = buildService(prisma as never, rateTables);

    await svc.stageImport(buf, "existing");

    expect(rateTables.createColumn).not.toHaveBeenCalled();
  });

  test("warns on unmatched header column (shipped string ~line 139)", async () => {
    const buf = await makeXlsxBuffer(["Region", "Rate", "Unknown"], [["North", 10, "x"]]);

    const prisma = makePrisma({
      id: "rt-1",
      name: "T",
      slug: "t",
      columns: existingColumns
    });
    const svc = buildService(prisma as never, makeRateTables());

    const result = await svc.stageImport(buf, "t");

    expect(result.warnings.some((w) => w.includes("Unknown") && w.includes("will be ignored"))).toBe(true);
  });

  test("errors on missing required column (shipped string ~line 148)", async () => {
    // Header has 'Region' but not 'Rate', and Rate is required.
    const buf = await makeXlsxBuffer(["Region"], [["North"]]);

    const prisma = makePrisma({
      id: "rt-1",
      name: "T",
      slug: "t",
      columns: existingColumns
    });
    const svc = buildService(prisma as never, makeRateTables());

    const result = await svc.stageImport(buf, "t");

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Rate") && e.includes("missing from the sheet header"))).toBe(true);
  });
});

// ── Suite 3: empty header row ─────────────────────────────────────────────────

describe("RateXlsmImportService — empty header row", () => {
  test("returns the shipped error string when row 1 has no cells (shipped ~line 128)", async () => {
    // A workbook with one blank row.
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("S");
    ws.addRow([]);
    const ab = await wb.xlsx.writeBuffer();
    const buf = Buffer.from(ab);

    const prisma = makePrisma({ id: "rt-1", name: "T", slug: "t", columns: [] });
    const svc = buildService(prisma as never, makeRateTables());

    const result = await svc.stageImport(buf, "t");

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Header row \(row 1\) is empty/);
  });
});

// ── Suite 4: table not found ──────────────────────────────────────────────────

describe("RateXlsmImportService — table not found", () => {
  test("throws NotFoundException when the table slug does not exist", async () => {
    const buf = await makeXlsxBuffer(["A"]);
    const prisma = {
      rateTable: { findUnique: jest.fn().mockResolvedValue(null) },
      rateRow: { findMany: jest.fn() }
    };
    const svc = buildService(prisma as never, makeRateTables());

    await expect(svc.stageImport(buf, "ghost")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── Suite 5: type inference ───────────────────────────────────────────────────

describe("RateXlsmImportService — type inference", () => {
  async function inferTypes(
    headings: string[],
    rows: (string | number | null)[][]
  ): Promise<{ name: string; dataType: string }[]> {
    const buf = await makeXlsxBuffer(headings, rows);

    // Capture the dto passed to createColumn for each heading.
    const captured: { name: string; dataType: string }[] = [];

    const emptyTable = { id: "rt-1", name: "T", slug: "t", columns: [] };
    const populatedTable = {
      ...emptyTable,
      columns: headings.map((h, i) => ({
        id: `col-${i}`,
        name: h,
        role: "KEY",
        dataType: "TEXT",
        required: false
      }))
    };
    const prisma = {
      rateTable: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(emptyTable)
          .mockResolvedValueOnce(populatedTable)
      },
      rateRow: { findMany: jest.fn().mockResolvedValue([]) }
    };

    const rateTables = makeRateTables((_tableId, dto) => {
      captured.push({ name: dto.name, dataType: (dto as { dataType?: string }).dataType ?? "" });
      return Promise.resolve({ id: `col-${dto.name}`, name: dto.name });
    });

    const svc = buildService(prisma as never, rateTables);
    await svc.stageImport(buf, "t");
    return captured;
  }

  test("all-numeric column → NUMBER", async () => {
    const cols = await inferTypes(["Count"], [[1], [2], [3]]);
    expect(cols[0].dataType).toBe("NUMBER");
  });

  test("numeric column with currency hint in heading → CURRENCY", async () => {
    const cols = await inferTypes(["Rate"], [[10.5], [20.0]]);
    expect(cols[0].dataType).toBe("CURRENCY");
  });

  test("numeric column with currency heading 'Cost' → CURRENCY", async () => {
    const cols = await inferTypes(["Cost"], [[100], [200]]);
    expect(cols[0].dataType).toBe("CURRENCY");
  });

  test("mixed text/number column → TEXT", async () => {
    const cols = await inferTypes(["Region"], [["North"], ["South"]]);
    expect(cols[0].dataType).toBe("TEXT");
  });

  test("empty data column → TEXT (no values to confirm numeric)", async () => {
    const cols = await inferTypes(["Empty"], []);
    expect(cols[0].dataType).toBe("TEXT");
  });
});

// ── Suite 6: role inference ───────────────────────────────────────────────────

describe("RateXlsmImportService — role inference", () => {
  async function inferRoles(
    headings: string[],
    rows: (string | number | null)[][]
  ): Promise<{ name: string; role: string }[]> {
    const buf = await makeXlsxBuffer(headings, rows);

    const captured: { name: string; role: string }[] = [];

    const emptyTable = { id: "rt-1", name: "T", slug: "t", columns: [] };
    const populatedTable = {
      ...emptyTable,
      columns: headings.map((h, i) => ({
        id: `col-${i}`,
        name: h,
        role: "KEY",
        dataType: "TEXT",
        required: false
      }))
    };
    const prisma = {
      rateTable: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(emptyTable)
          .mockResolvedValueOnce(populatedTable)
      },
      rateRow: { findMany: jest.fn().mockResolvedValue([]) }
    };

    const rateTables = makeRateTables((_tableId, dto) => {
      captured.push({ name: dto.name, role: (dto as { role?: string }).role ?? "" });
      return Promise.resolve({ id: `col-${dto.name}`, name: dto.name });
    });

    const svc = buildService(prisma as never, rateTables);
    await svc.stageImport(buf, "t");
    return captured;
  }

  test("text column → KEY", async () => {
    const roles = await inferRoles(["Region", "Rate"], [["North", 10]]);
    expect(roles.find((r) => r.name === "Region")?.role).toBe("KEY");
  });

  test("rightmost CURRENCY column → VALUE", async () => {
    const roles = await inferRoles(["Region", "Rate"], [["North", 10]]);
    expect(roles.find((r) => r.name === "Rate")?.role).toBe("VALUE");
  });

  test("non-rightmost numeric column → INFO", async () => {
    const roles = await inferRoles(["Count", "Rate"], [[5, 10]]);
    expect(roles.find((r) => r.name === "Count")?.role).toBe("INFO");
  });

  test("rightmost-only CURRENCY is VALUE even when there are multiple CURRENCY columns", async () => {
    const roles = await inferRoles(
      ["Cost A", "Cost B"],
      [[10, 20], [30, 40]]
    );
    expect(roles.find((r) => r.name === "Cost A")?.role).toBe("INFO");
    expect(roles.find((r) => r.name === "Cost B")?.role).toBe("VALUE");
  });
});

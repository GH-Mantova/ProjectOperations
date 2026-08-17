import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  XeroContactImportService,
  parseCsv,
  validateAbn,
  validateBsb,
  pickWritableKeys,
  CLIENT_WRITABLE_KEYS,
  type ImportPreview
} from "../xero-contact-import.service";

// ── CSV helper ────────────────────────────────────────────────────────────────

/** Minimal CSV builder for test fixtures. */
function makeCsv(header: string[], rows: string[][]): Buffer {
  const lines = [header, ...rows].map((cells) => cells.join(",")).join("\r\n");
  return Buffer.from(lines + "\r\n", "utf-8");
}

// ── parseCsv unit tests ───────────────────────────────────────────────────────

describe("parseCsv", () => {
  it("parses a simple two-row CSV", () => {
    const rows = parseCsv("a,b,c\r\n1,2,3\r\n");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(["a", "b", "c"]);
    expect(rows[1]).toEqual(["1", "2", "3"]);
  });

  it("handles quoted fields containing commas", () => {
    const rows = parseCsv('"Acme, Inc.",foo\r\n');
    expect(rows[0]).toEqual(["Acme, Inc.", "foo"]);
  });

  it("handles doubled quotes inside a quoted field", () => {
    const rows = parseCsv('"He said ""hello""",bar\r\n');
    expect(rows[0]).toEqual(['He said "hello"', "bar"]);
  });

  it("suppresses trailing empty row from files that end with CRLF", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n");
    expect(rows).toHaveLength(2);
  });
});

// ── validateAbn ───────────────────────────────────────────────────────────────

describe("validateAbn", () => {
  it("accepts a valid AU ABN", () => {
    // 51 824 753 556 is a public ABN that passes the checksum.
    expect(validateAbn("51824753556")).toBeNull();
  });

  it("rejects ABN with wrong digit count", () => {
    expect(validateAbn("1234567890")).not.toBeNull();
  });

  it("rejects ABN that fails checksum", () => {
    // One digit incremented so checksum fails.
    expect(validateAbn("51824753557")).not.toBeNull();
  });

  it("includes the bad value in the rejection reason", () => {
    const reason = validateAbn("badabn");
    expect(reason).toContain("badabn");
  });
});

// ── validateBsb ───────────────────────────────────────────────────────────────

describe("validateBsb", () => {
  it("accepts a valid 6-digit BSB", () => {
    expect(validateBsb("084424")).toBeNull();
  });

  it("accepts BSB with hyphens (stripped to 6 digits)", () => {
    expect(validateBsb("084-424")).toBeNull();
  });

  it("rejects BSB that is not 6 digits after stripping hyphens", () => {
    const reason = validateBsb("foo");
    expect(reason).not.toBeNull();
    expect(reason).toContain("foo");
  });
});

// ── Prisma mock factory ───────────────────────────────────────────────────────

type MockPrisma = {
  client: {
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  subcontractorSupplier: {
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

function makePrisma(overrides: Partial<MockPrisma> = {}): MockPrisma {
  const base: MockPrisma = {
    client: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: "new-id" }),
      update: jest.fn().mockResolvedValue({ id: "existing-id" })
    },
    subcontractorSupplier: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: "new-vendor-id" }),
      update: jest.fn().mockResolvedValue({ id: "existing-vendor-id" })
    },
    $transaction: jest.fn()
  };

  return { ...base, ...overrides };
}

function makeService(prisma: MockPrisma): XeroContactImportService {
  return new XeroContactImportService(prisma as never);
}

// ── Column map helpers ────────────────────────────────────────────────────────

/** Minimal valid column map: maps each BUILTIN key to the same-named CSV header. */
const BASIC_COLUMN_MAP: Record<string, string> = {
  name: "name",
  email: "email"
};

// ── Tests: previewImport ──────────────────────────────────────────────────────

describe("XeroContactImportService.previewImport", () => {
  it("dry-run: returns diffs without writing (no Prisma create/update called)", async () => {
    const existing = {
      id: "client-1",
      name: "Acme Constructions",
      email: "old@acme.example",
      xeroContactId: null,
      bankName: null,
      bankAccountName: null,
      bankBsb: null,
      bankAccountNumber: null
    };
    const prisma = makePrisma();
    prisma.client.findMany.mockResolvedValue([existing]);

    // $transaction is NOT called during preview.
    const service = makeService(prisma);
    const csv = makeCsv(["name", "email"], [["Acme Constructions", "new@acme.example"]]);

    const preview = await service.previewImport({
      fileBytes: csv,
      appliesTo: "CLIENT",
      columnMap: BASIC_COLUMN_MAP,
      actorUserId: "user-1"
    });

    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]?.action).toBe("matched-by-name");
    expect(preview.rows[0]?.diffs).toHaveLength(1);
    expect(preview.rows[0]?.diffs?.[0]?.field).toBe("email");

    // No write operations during preview.
    expect(prisma.client.create).not.toHaveBeenCalled();
    expect(prisma.client.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects required column 'name' not mapped", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    const csv = makeCsv(["email"], [["foo@bar.com"]]);

    await expect(
      service.previewImport({
        fileBytes: csv,
        appliesTo: "CLIENT",
        columnMap: { email: "email" }, // name not mapped
        actorUserId: "user-1"
      })
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.previewImport({
        fileBytes: csv,
        appliesTo: "CLIENT",
        columnMap: { email: "email" },
        actorUserId: "user-1"
      })
    ).rejects.toThrow(/required column 'name'/);
  });

  it("rejects unknown keys in columnMap (custom fields cannot be written)", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    const csv = makeCsv(["name", "myCustomField"], [["Acme", "SomeValue"]]);

    await expect(
      service.previewImport({
        fileBytes: csv,
        appliesTo: "CLIENT",
        columnMap: { name: "name", myCustomField: "myCustomField" },
        actorUserId: "user-1"
      })
    ).rejects.toThrow(BadRequestException);
  });

  it("header not in columnMap is ignored — custom fields cannot be written from an import", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    // CSV has a 'custom-field' column that is NOT included in columnMap.
    const csv = makeCsv(["name", "email", "custom-field"], [["Acme", "x@y.com", "ignored-value"]]);

    const preview = await service.previewImport({
      fileBytes: csv,
      appliesTo: "CLIENT",
      columnMap: { name: "name", email: "email" }, // custom-field not in map
      actorUserId: "user-1"
    });

    // Should complete without error; custom-field value must not appear anywhere.
    expect(preview.rows[0]?.action).toBe("new");
    // Verify no diff references the custom field.
    const allDiffFields = (preview.rows[0]?.diffs ?? []).map((d) => d.field);
    expect(allDiffFields).not.toContain("custom-field");
  });

  it("matches by xeroContactId before matching by name", async () => {
    const existing = {
      id: "client-xero",
      name: "Acme Constructions",
      email: "billing@acme.example",
      xeroContactId: "xero-abc-123",
      bankName: null,
      bankAccountName: null,
      bankBsb: null,
      bankAccountNumber: null
    };
    const prisma = makePrisma();
    prisma.client.findMany.mockResolvedValue([existing]);

    const service = makeService(prisma);
    const csv = makeCsv(
      ["name", "xeroContactId"],
      [["Acme Constructions", "xero-abc-123"]]
    );

    const preview = await service.previewImport({
      fileBytes: csv,
      appliesTo: "CLIENT",
      columnMap: { name: "name", xeroContactId: "xeroContactId" },
      actorUserId: "user-1"
    });

    expect(preview.rows[0]?.action).toBe("matched-by-xero-id");
    expect(preview.rows[0]?.matchedRecordId).toBe("client-xero");
  });

  it("row with existing bank details → wouldOverwriteBank:true in diffs", async () => {
    const existing = {
      id: "client-bank",
      name: "Bank Corp",
      email: "a@b.com",
      xeroContactId: null,
      bankName: "ANZ",
      bankAccountName: "Bank Corp Pty Ltd",
      bankBsb: "084-424",
      bankAccountNumber: "12345678"
    };
    const prisma = makePrisma();
    prisma.client.findMany.mockResolvedValue([existing]);

    const service = makeService(prisma);
    const csv = makeCsv(
      ["name", "bankBsb"],
      [["Bank Corp", "999-999"]]
    );

    const preview = await service.previewImport({
      fileBytes: csv,
      appliesTo: "CLIENT",
      columnMap: { name: "name", bankBsb: "bankBsb" },
      actorUserId: "user-1"
    });

    const row = preview.rows[0];
    expect(row?.action).toBe("matched-by-name");
    const bankDiff = row?.diffs?.find((diff) => diff.field === "bankBsb");
    expect(bankDiff).toBeDefined();
    expect(bankDiff?.wouldOverwriteBank).toBe(true);
  });

  it("rejects a row with a malformed ABN", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    const csv = makeCsv(["name", "abn"], [["Acme", "12345"]]);

    const preview = await service.previewImport({
      fileBytes: csv,
      appliesTo: "CLIENT",
      columnMap: { name: "name", abn: "abn" },
      actorUserId: "user-1"
    });

    expect(preview.rows[0]?.action).toBe("rejected");
    expect(preview.rows[0]?.reason).toContain("ABN");
  });

  it("assigns action 'new' for rows with no matching record", async () => {
    const prisma = makePrisma();
    // No existing clients.
    prisma.client.findMany.mockResolvedValue([]);

    const service = makeService(prisma);
    const csv = makeCsv(["name"], [["Brand New Client"]]);

    const preview = await service.previewImport({
      fileBytes: csv,
      appliesTo: "CLIENT",
      columnMap: { name: "name" },
      actorUserId: "user-1"
    });

    expect(preview.rows[0]?.action).toBe("new");
  });
});

// ── Tests: commitImport ────────────────────────────────────────────────────────

describe("XeroContactImportService.commitImport", () => {
  /** Run a preview + commit in sequence using the given prisma mock. */
  async function previewThenCommit(
    prisma: MockPrisma,
    options: {
      csvBuffer: Buffer;
      columnMap: Record<string, string>;
      appliesTo?: "CLIENT" | "VENDOR";
      confirmedOverwriteBankRecordIds?: string[];
    }
  ): Promise<{ preview: ImportPreview; result: { inserted: number; updated: number; skipped: number; droppedFields: Record<string, number> } }> {
    const service = makeService(prisma);

    // Wire $transaction so it executes the callback immediately with the tx delegate.
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      await cb(prisma);
    });

    const preview = await service.previewImport({
      fileBytes: options.csvBuffer,
      appliesTo: options.appliesTo ?? "CLIENT",
      columnMap: options.columnMap,
      actorUserId: "user-1"
    });

    const result = await service.commitImport({
      previewId: preview.previewId,
      actorUserId: "user-1",
      confirmedOverwriteBankRecordIds: options.confirmedOverwriteBankRecordIds
    });

    return { preview, result };
  }

  it("throws NotFound for an unknown/expired previewId", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    await expect(
      service.commitImport({ previewId: "does-not-exist", actorUserId: "user-1" })
    ).rejects.toThrow(NotFoundException);
  });

  it("inserts a new record on commit for a 'new' action row", async () => {
    const prisma = makePrisma();
    prisma.client.findMany.mockResolvedValue([]);

    const csv = makeCsv(["name", "email"], [["New Client Co", "new@client.com"]]);
    const { result } = await previewThenCommit(prisma, {
      csvBuffer: csv,
      columnMap: { name: "name", email: "email" }
    });

    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(0);
    expect(prisma.client.create).toHaveBeenCalledTimes(1);
  });

  it("updates a matched record on commit", async () => {
    const existing = {
      id: "client-1",
      name: "Acme",
      email: "old@acme.com",
      xeroContactId: null,
      bankName: null,
      bankAccountName: null,
      bankBsb: null,
      bankAccountNumber: null
    };
    const prisma = makePrisma();
    prisma.client.findMany.mockResolvedValue([existing]);

    const csv = makeCsv(["name", "email"], [["Acme", "new@acme.com"]]);
    const { result } = await previewThenCommit(prisma, {
      csvBuffer: csv,
      columnMap: { name: "name", email: "email" }
    });

    expect(result.updated).toBe(1);
    expect(result.inserted).toBe(0);
    expect(prisma.client.update).toHaveBeenCalledTimes(1);
    expect(prisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "client-1" } })
    );
  });

  it("commit update payload does NOT include bank fields for a matched record with existing bank data (not confirmed)", async () => {
    const existing = {
      id: "client-bank",
      name: "Bank Corp",
      email: "a@b.com",
      xeroContactId: null,
      bankName: "ANZ",
      bankAccountName: "Bank Corp Pty Ltd",
      bankBsb: "084-424",
      bankAccountNumber: "12345678"
    };
    const prisma = makePrisma();
    prisma.client.findMany.mockResolvedValue([existing]);

    const csv = makeCsv(["name", "bankBsb"], [["Bank Corp", "999-999"]]);
    await previewThenCommit(prisma, {
      csvBuffer: csv,
      columnMap: { name: "name", bankBsb: "bankBsb" }
      // confirmedOverwriteBankRecordIds omitted — bank should not be written
    });

    // The update call must NOT include bankBsb in its data payload.
    if (prisma.client.update.mock.calls.length > 0) {
      const updateArgs = prisma.client.update.mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(updateArgs?.data).not.toHaveProperty("bankBsb");
    } else {
      // No diff at all (nothing to change aside from bank) → skipped.
      // This is also acceptable behaviour.
      expect(prisma.client.update).not.toHaveBeenCalled();
    }
  });

  // ── Allow-list / droppedFields tests ─────────────────────────────────────

  describe("pickWritableKeys unit", () => {
    it("passes allowed keys through and drops unknown keys", () => {
      const data = { name: "Acme", email: "a@b.com", someArbitraryKey: "injected" };
      const allowed: ReadonlySet<string> = new Set(["name", "email"]);
      const { picked, dropped } = pickWritableKeys(data, allowed);
      expect(picked).toEqual({ name: "Acme", email: "a@b.com" });
      expect(dropped).toEqual(["someArbitraryKey"]);
    });

    it("returns empty dropped array when all keys are allowed", () => {
      const data = { name: "Acme" };
      const { dropped } = pickWritableKeys(data, CLIENT_WRITABLE_KEYS);
      expect(dropped).toHaveLength(0);
    });
  });

  it("non-allow-listed key ('code') is dropped for VENDOR inserts and counted in droppedFields", async () => {
    // 'code' is in BUILTIN_FIELD_KEYS but NOT in SUBCONTRACTOR_WRITABLE_KEYS
    // (SubcontractorSupplier has no 'code' column).
    const prisma = makePrisma();
    prisma.subcontractorSupplier.findMany.mockResolvedValue([]);

    const csv = makeCsv(["name", "code"], [["Vendor A", "V001"]]);
    const { result } = await previewThenCommit(prisma, {
      csvBuffer: csv,
      columnMap: { name: "name", code: "code" },
      appliesTo: "VENDOR"
    });

    expect(result.inserted).toBe(1);
    // droppedFields must record 'code' was dropped for 1 row.
    expect(result.droppedFields["code"]).toBe(1);
    // The Prisma create must NOT have received a 'code' key.
    const createArgs = prisma.subcontractorSupplier.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(createArgs?.data).not.toHaveProperty("code");
  });

  it("droppedFields is empty when all written keys are allow-listed", async () => {
    const prisma = makePrisma();
    prisma.client.findMany.mockResolvedValue([]);

    const csv = makeCsv(["name", "email"], [["Fresh Client", "fresh@client.com"]]);
    const { result } = await previewThenCommit(prisma, {
      csvBuffer: csv,
      columnMap: { name: "name", email: "email" }
    });

    expect(result.inserted).toBe(1);
    expect(result.droppedFields).toEqual({});
  });

  it("commit DOES write bank fields when record id is in confirmedOverwriteBankRecordIds", async () => {
    const existing = {
      id: "client-bank",
      name: "Bank Corp",
      email: "a@b.com",
      xeroContactId: null,
      bankName: "ANZ",
      bankAccountName: "Bank Corp Pty Ltd",
      bankBsb: "084-424",
      bankAccountNumber: "12345678"
    };
    const prisma = makePrisma();
    prisma.client.findMany.mockResolvedValue([existing]);

    const csv = makeCsv(["name", "bankBsb"], [["Bank Corp", "999-999"]]);
    await previewThenCommit(prisma, {
      csvBuffer: csv,
      columnMap: { name: "name", bankBsb: "bankBsb" },
      confirmedOverwriteBankRecordIds: ["client-bank"]
    });

    expect(prisma.client.update).toHaveBeenCalledTimes(1);
    const updateArgs = prisma.client.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateArgs?.data).toHaveProperty("bankBsb", "999-999");
  });
});

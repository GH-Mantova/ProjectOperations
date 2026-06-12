// Mock-based unit tests for QuoteService (the standalone quote module —
// T&Cs, assumptions, exclusions, export history). Mirrors the patterns
// used by jobs.service.spec.ts: Prisma is mocked per-test as a plain
// object of jest.fn()s, and the service is instantiated directly with
// `as never` casts on the injected dependencies. No TestingModule, no DB.
//
// Scope note: this service has no revisions / cost-line / totals math —
// the commercial $ calculations live in the estimates module. Coverage
// here is the full public surface of QuoteService: T&C get/update/reset,
// assumption and exclusion CRUD + reorder + standard-set seeding, and
// export-history listing, plus the NotFound/BadRequest guard paths.

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { QuoteService } from "../quote.service";
import { parseDefaultClauses, type TcClause } from "../tc-parser";

// ─── Shared fixtures ───────────────────────────────────────────────────────

const TENDER_ID = "tender-1";

const assumptionRow = (overrides: Record<string, unknown> = {}) => ({
  id: "assump-1",
  tenderId: TENDER_ID,
  text: "Standard hours apply",
  sortOrder: 0,
  ...overrides
});

const exclusionRow = (overrides: Record<string, unknown> = {}) => ({
  id: "excl-1",
  tenderId: TENDER_ID,
  text: "Traffic control",
  sortOrder: 0,
  ...overrides
});

// Per-test mock builder. Tests override individual mock methods on the
// returned `prisma` object before driving the service.
function buildService(extraPrisma: Record<string, unknown> = {}) {
  const prisma: Record<string, unknown> = {
    tender: {
      findUnique: jest.fn().mockResolvedValue({ id: TENDER_ID })
    },
    tenderTandC: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "tandc-1", ...args.data })
      ),
      update: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "tandc-1", tenderId: TENDER_ID, ...args.data })
      ),
      upsert: jest.fn().mockResolvedValue({ id: "tandc-1", tenderId: TENDER_ID })
    },
    tenderAssumption: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(assumptionRow()),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "assump-new", ...args.data })
      ),
      update: jest.fn().mockResolvedValue(assumptionRow()),
      delete: jest.fn().mockResolvedValue(assumptionRow())
    },
    tenderExclusion: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(exclusionRow()),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "excl-new", ...args.data })
      ),
      update: jest.fn().mockResolvedValue(exclusionRow()),
      delete: jest.fn().mockResolvedValue(exclusionRow())
    },
    estimateExport: {
      findMany: jest.fn().mockResolvedValue([])
    },
    $transaction: jest.fn().mockImplementation((input: unknown) => {
      if (typeof input === "function") {
        return (input as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(input as Array<Promise<unknown>>);
    }),
    ...extraPrisma
  };

  const service = new QuoteService(prisma as never);

  return { service, prisma };
}

// ─── getTandC ──────────────────────────────────────────────────────────────

describe("QuoteService.getTandC", () => {
  it("creates and returns the default clause set on first load (isModified=false everywhere)", async () => {
    const { service, prisma } = buildService();

    const result = await service.getTandC(TENDER_ID);

    const defaults = parseDefaultClauses();
    expect((prisma.tenderTandC as { create: jest.Mock }).create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenderId: TENDER_ID })
      })
    );
    expect(result.clauses).toHaveLength(defaults.length);
    expect((result.clauses as Array<{ isModified: boolean }>).every((c) => c.isModified === false)).toBe(true);
  });

  it("flags edited clauses as isModified when a stored set diverges from the defaults", async () => {
    const defaults = parseDefaultClauses();
    const edited = defaults.map((c) =>
      c.number === "2" ? { ...c, body: "Custom acceptance wording." } : { ...c }
    );
    const { service, prisma } = buildService();
    (prisma.tenderTandC as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce({
      id: "tandc-1",
      tenderId: TENDER_ID,
      clauses: edited
    });

    const result = await service.getTandC(TENDER_ID);

    const clauses = result.clauses as Array<TcClause & { isModified: boolean }>;
    expect(clauses.find((c) => c.number === "2")?.isModified).toBe(true);
    expect(clauses.find((c) => c.number === "1")?.isModified).toBe(false);
    expect((prisma.tenderTandC as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });

  it("falls back to the default clauses when the stored JSON is not a valid clause array", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderTandC as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce({
      id: "tandc-1",
      tenderId: TENDER_ID,
      clauses: { corrupted: true }
    });

    const result = await service.getTandC(TENDER_ID);

    const defaults = parseDefaultClauses();
    expect(result.clauses).toHaveLength(defaults.length);
    expect((result.clauses as Array<{ isModified: boolean }>).every((c) => c.isModified === false)).toBe(true);
  });

  it("throws NotFoundException when the tender does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.tender as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.getTandC("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── updateTandC ───────────────────────────────────────────────────────────

describe("QuoteService.updateTandC", () => {
  const validClauses: TcClause[] = [{ number: "1", heading: "DEFINITIONS", body: "Custom body" }];

  it("creates a new record when none exists for the tender", async () => {
    const { service, prisma } = buildService();

    await service.updateTandC(TENDER_ID, validClauses);

    expect((prisma.tenderTandC as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: { tenderId: TENDER_ID, clauses: validClauses }
    });
    expect((prisma.tenderTandC as { update: jest.Mock }).update).not.toHaveBeenCalled();
  });

  it("updates the existing record when one already exists", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderTandC as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce({
      id: "tandc-1",
      tenderId: TENDER_ID,
      clauses: []
    });

    await service.updateTandC(TENDER_ID, validClauses);

    expect((prisma.tenderTandC as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { tenderId: TENDER_ID },
      data: { clauses: validClauses }
    });
    expect((prisma.tenderTandC as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });

  it("throws BadRequestException when clauses are not a valid { number, heading, body } array", async () => {
    const { service } = buildService();
    await expect(
      service.updateTandC(TENDER_ID, [{ number: 1, heading: "x" }] as never)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws NotFoundException when the tender does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.tender as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.updateTandC("missing", validClauses)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});

// ─── resetAllTandC / resetClause ───────────────────────────────────────────

describe("QuoteService.resetAllTandC", () => {
  it("upserts the full default clause set", async () => {
    const { service, prisma } = buildService();

    await service.resetAllTandC(TENDER_ID);

    const defaults = parseDefaultClauses();
    const upsertArgs = (prisma.tenderTandC as { upsert: jest.Mock }).upsert.mock.calls[0]?.[0] as {
      where: { tenderId: string };
      create: { clauses: TcClause[] };
      update: { clauses: TcClause[] };
    };
    expect(upsertArgs.where).toEqual({ tenderId: TENDER_ID });
    expect(upsertArgs.create.clauses).toEqual(defaults);
    expect(upsertArgs.update.clauses).toEqual(defaults);
  });

  it("throws NotFoundException when the tender does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.tender as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.resetAllTandC("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("QuoteService.resetClause", () => {
  it("replaces only the targeted clause with its default body, keeping other edits", async () => {
    const defaults = parseDefaultClauses();
    const edited = defaults.map((c) => {
      if (c.number === "2") return { ...c, body: "Edited clause two." };
      if (c.number === "3") return { ...c, body: "Edited clause three." };
      return { ...c };
    });
    const { service, prisma } = buildService();
    (prisma.tenderTandC as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
      id: "tandc-1",
      tenderId: TENDER_ID,
      clauses: edited
    });

    await service.resetClause(TENDER_ID, "2");

    const updateArgs = (prisma.tenderTandC as { update: jest.Mock }).update.mock.calls[0]?.[0] as {
      where: { tenderId: string };
      data: { clauses: TcClause[] };
    };
    expect(updateArgs.where).toEqual({ tenderId: TENDER_ID });
    const next = updateArgs.data.clauses;
    expect(next.find((c) => c.number === "2")?.body).toBe(
      defaults.find((c) => c.number === "2")?.body
    );
    // The other edited clause must be untouched.
    expect(next.find((c) => c.number === "3")?.body).toBe("Edited clause three.");
  });

  it("throws NotFoundException when the clause number is not in the standard T&Cs", async () => {
    const { service } = buildService();
    await expect(service.resetClause(TENDER_ID, "999")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws NotFoundException when the tender does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.tender as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.resetClause("missing", "1")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── listAssumptions ───────────────────────────────────────────────────────

describe("QuoteService.listAssumptions", () => {
  it("returns existing rows without seeding when the tender already has assumptions", async () => {
    const rows = [assumptionRow(), assumptionRow({ id: "assump-2", sortOrder: 1 })];
    const { service, prisma } = buildService();
    (prisma.tenderAssumption as { findMany: jest.Mock }).findMany.mockResolvedValueOnce(rows);

    const result = await service.listAssumptions(TENDER_ID);

    expect(result).toEqual(rows);
    expect((prisma.tenderAssumption as { create: jest.Mock }).create).not.toHaveBeenCalled();
    expect((prisma.$transaction as jest.Mock)).not.toHaveBeenCalled();
  });

  it("seeds the 6 standard assumptions in a transaction on first load, then re-queries", async () => {
    const seeded = [assumptionRow({ text: "All works to be completed during standard working hours Monday to Friday 6:30am to 4:30pm unless otherwise stated" })];
    const { service, prisma } = buildService();
    const findMany = (prisma.tenderAssumption as { findMany: jest.Mock }).findMany;
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(seeded);

    const result = await service.listAssumptions(TENDER_ID);

    expect((prisma.tenderAssumption as { create: jest.Mock }).create).toHaveBeenCalledTimes(6);
    expect((prisma.tenderAssumption as { create: jest.Mock }).create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenderId: TENDER_ID, sortOrder: 0 })
      })
    );
    expect(prisma.$transaction as jest.Mock).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(result).toEqual(seeded);
  });

  it("throws NotFoundException when the tender does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.tender as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.listAssumptions("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── createAssumption / updateAssumption / deleteAssumption ────────────────

describe("QuoteService.createAssumption", () => {
  it("uses the supplied sortOrder without counting existing rows", async () => {
    const { service, prisma } = buildService();

    await service.createAssumption(TENDER_ID, "No weekend work", 7);

    expect((prisma.tenderAssumption as { count: jest.Mock }).count).not.toHaveBeenCalled();
    expect((prisma.tenderAssumption as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: { tenderId: TENDER_ID, text: "No weekend work", sortOrder: 7 }
    });
  });

  it("appends at the end (count) when sortOrder is omitted", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderAssumption as { count: jest.Mock }).count.mockResolvedValueOnce(4);

    await service.createAssumption(TENDER_ID, "Crane access available");

    expect((prisma.tenderAssumption as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: { tenderId: TENDER_ID, text: "Crane access available", sortOrder: 4 }
    });
  });

  it("coerces nullish text to an empty string", async () => {
    const { service, prisma } = buildService();

    await service.createAssumption(TENDER_ID, null as never, 0);

    expect((prisma.tenderAssumption as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: { tenderId: TENDER_ID, text: "", sortOrder: 0 }
    });
  });

  it("throws NotFoundException when the tender does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.tender as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.createAssumption("missing", "x")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});

describe("QuoteService.updateAssumption", () => {
  it("applies the patch when the assumption belongs to the tender", async () => {
    const { service, prisma } = buildService();

    await service.updateAssumption(TENDER_ID, "assump-1", { text: "Updated", sortOrder: 2 });

    expect((prisma.tenderAssumption as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: "assump-1" },
      data: { text: "Updated", sortOrder: 2 }
    });
  });

  it("throws NotFoundException when the assumption does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderAssumption as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(
      service.updateAssumption(TENDER_ID, "missing", { text: "x" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws NotFoundException when the assumption belongs to a different tender", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderAssumption as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      assumptionRow({ tenderId: "other-tender" })
    );
    await expect(
      service.updateAssumption(TENDER_ID, "assump-1", { text: "x" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("QuoteService.deleteAssumption", () => {
  it("deletes the row and echoes the id", async () => {
    const { service, prisma } = buildService();

    const result = await service.deleteAssumption(TENDER_ID, "assump-1");

    expect((prisma.tenderAssumption as { delete: jest.Mock }).delete).toHaveBeenCalledWith({
      where: { id: "assump-1" }
    });
    expect(result).toEqual({ id: "assump-1" });
  });

  it("throws NotFoundException when the assumption belongs to a different tender", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderAssumption as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      assumptionRow({ tenderId: "other-tender" })
    );
    await expect(service.deleteAssumption(TENDER_ID, "assump-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect((prisma.tenderAssumption as { delete: jest.Mock }).delete).not.toHaveBeenCalled();
  });
});

// ─── reorderAssumptions ────────────────────────────────────────────────────

describe("QuoteService.reorderAssumptions", () => {
  it("short-circuits with { updated: 0 } for an empty order array", async () => {
    const { service, prisma } = buildService();

    const result = await service.reorderAssumptions(TENDER_ID, []);

    expect(result).toEqual({ updated: 0 });
    expect((prisma.tenderAssumption as { findMany: jest.Mock }).findMany).not.toHaveBeenCalled();
  });

  it("updates each row's sortOrder in a transaction when all ids belong to the tender", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderAssumption as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      { id: "assump-1" },
      { id: "assump-2" }
    ]);

    const result = await service.reorderAssumptions(TENDER_ID, [
      { id: "assump-1", sortOrder: 1 },
      { id: "assump-2", sortOrder: 0 }
    ]);

    expect(result).toEqual({ updated: 2 });
    expect((prisma.tenderAssumption as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: "assump-1" },
      data: { sortOrder: 1 }
    });
    expect((prisma.tenderAssumption as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: "assump-2" },
      data: { sortOrder: 0 }
    });
    expect(prisma.$transaction as jest.Mock).toHaveBeenCalledTimes(1);
  });

  it("throws BadRequestException listing the ids that are not on this tender", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderAssumption as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      { id: "assump-1" }
    ]);

    await expect(
      service.reorderAssumptions(TENDER_ID, [
        { id: "assump-1", sortOrder: 0 },
        { id: "rogue-id", sortOrder: 1 }
      ])
    ).rejects.toMatchObject({
      response: expect.objectContaining({ invalid: ["rogue-id"] })
    });
    expect((prisma.tenderAssumption as { update: jest.Mock }).update).not.toHaveBeenCalled();
  });
});

// ─── listExclusions ────────────────────────────────────────────────────────

describe("QuoteService.listExclusions", () => {
  it("returns existing rows without seeding when the tender already has exclusions", async () => {
    const rows = [exclusionRow()];
    const { service, prisma } = buildService();
    (prisma.tenderExclusion as { findMany: jest.Mock }).findMany.mockResolvedValueOnce(rows);

    const result = await service.listExclusions(TENDER_ID);

    expect(result).toEqual(rows);
    expect((prisma.tenderExclusion as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });

  it("seeds the 11 standard exclusions in a transaction on first load", async () => {
    const seeded = [exclusionRow({ text: "Dilapidation reports" })];
    const { service, prisma } = buildService();
    const findMany = (prisma.tenderExclusion as { findMany: jest.Mock }).findMany;
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(seeded);

    const result = await service.listExclusions(TENDER_ID);

    expect((prisma.tenderExclusion as { create: jest.Mock }).create).toHaveBeenCalledTimes(11);
    expect((prisma.tenderExclusion as { create: jest.Mock }).create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenderId: TENDER_ID,
          text: "Dilapidation reports",
          sortOrder: 0
        })
      })
    );
    expect(result).toEqual(seeded);
  });

  it("throws NotFoundException when the tender does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.tender as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.listExclusions("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── createExclusion / updateExclusion / deleteExclusion ───────────────────

describe("QuoteService.createExclusion", () => {
  it("appends at the end (count) when sortOrder is omitted", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderExclusion as { count: jest.Mock }).count.mockResolvedValueOnce(11);

    await service.createExclusion(TENDER_ID, "Asbestos removal");

    expect((prisma.tenderExclusion as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: { tenderId: TENDER_ID, text: "Asbestos removal", sortOrder: 11 }
    });
  });

  it("uses the supplied sortOrder without counting existing rows", async () => {
    const { service, prisma } = buildService();

    await service.createExclusion(TENDER_ID, "Night works", 3);

    expect((prisma.tenderExclusion as { count: jest.Mock }).count).not.toHaveBeenCalled();
    expect((prisma.tenderExclusion as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: { tenderId: TENDER_ID, text: "Night works", sortOrder: 3 }
    });
  });
});

describe("QuoteService.updateExclusion", () => {
  it("applies the patch when the exclusion belongs to the tender", async () => {
    const { service, prisma } = buildService();

    await service.updateExclusion(TENDER_ID, "excl-1", { text: "Updated exclusion" });

    expect((prisma.tenderExclusion as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: "excl-1" },
      data: { text: "Updated exclusion" }
    });
  });

  it("throws NotFoundException when the exclusion belongs to a different tender", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderExclusion as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      exclusionRow({ tenderId: "other-tender" })
    );
    await expect(
      service.updateExclusion(TENDER_ID, "excl-1", { text: "x" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("QuoteService.deleteExclusion", () => {
  it("deletes the row and echoes the id", async () => {
    const { service, prisma } = buildService();

    const result = await service.deleteExclusion(TENDER_ID, "excl-1");

    expect((prisma.tenderExclusion as { delete: jest.Mock }).delete).toHaveBeenCalledWith({
      where: { id: "excl-1" }
    });
    expect(result).toEqual({ id: "excl-1" });
  });

  it("throws NotFoundException when the exclusion does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderExclusion as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.deleteExclusion(TENDER_ID, "missing")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});

// ─── reorderExclusions ─────────────────────────────────────────────────────

describe("QuoteService.reorderExclusions", () => {
  it("short-circuits with { updated: 0 } for an empty order array", async () => {
    const { service, prisma } = buildService();

    const result = await service.reorderExclusions(TENDER_ID, []);

    expect(result).toEqual({ updated: 0 });
    expect((prisma.tenderExclusion as { findMany: jest.Mock }).findMany).not.toHaveBeenCalled();
  });

  it("updates each row's sortOrder when all ids belong to the tender", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderExclusion as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      { id: "excl-1" },
      { id: "excl-2" }
    ]);

    const result = await service.reorderExclusions(TENDER_ID, [
      { id: "excl-1", sortOrder: 1 },
      { id: "excl-2", sortOrder: 0 }
    ]);

    expect(result).toEqual({ updated: 2 });
    expect((prisma.tenderExclusion as { update: jest.Mock }).update).toHaveBeenCalledTimes(2);
  });

  it("throws BadRequestException listing ids not on this tender", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderExclusion as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([]);

    await expect(
      service.reorderExclusions(TENDER_ID, [{ id: "rogue-id", sortOrder: 0 }])
    ).rejects.toMatchObject({
      response: expect.objectContaining({ invalid: ["rogue-id"] })
    });
  });
});

// ─── listExports ───────────────────────────────────────────────────────────

describe("QuoteService.listExports", () => {
  it("returns the 20 most recent exports with the generating user included", async () => {
    const rows = [{ id: "export-1", generatedAt: new Date("2026-06-01") }];
    const { service, prisma } = buildService();
    (prisma.estimateExport as { findMany: jest.Mock }).findMany.mockResolvedValueOnce(rows);

    const result = await service.listExports(TENDER_ID);

    expect(result).toEqual(rows);
    expect((prisma.estimateExport as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith({
      where: { tenderId: TENDER_ID },
      orderBy: { generatedAt: "desc" },
      take: 20,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });
  });

  it("throws NotFoundException when the tender does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.tender as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.listExports("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

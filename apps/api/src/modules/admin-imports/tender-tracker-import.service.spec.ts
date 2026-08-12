/**
 * MIG-2 — Unit tests for TenderTrackerImportService.
 *
 * Uses synthetic fixtures only (D9 — no real tracker data).
 * Prisma is fully mocked.
 */

import { Test, TestingModule } from "@nestjs/testing";
import * as fs from "fs";
import * as path from "path";
import { TenderTrackerImportService, TenderTrackerImportReport } from "./tender-tracker-import.service";
import { PrismaService } from "../../prisma/prisma.service";

// ---------------------------------------------------------------------------
// Prisma mock factory
// ---------------------------------------------------------------------------

function makePrismaMock(overrides: Record<string, unknown> = {}): jest.Mocked<PrismaService> {
  const base = {
    user: {
      findMany: jest.fn().mockResolvedValue([
        { id: "u1", firstName: "Sean", lastName: "Lattin" },
        { id: "u2", firstName: "Raj", lastName: "Pudasaini" },
        { id: "u3", firstName: "Marco", lastName: "Mantovanini" },
        { id: "u4", firstName: "Russel", lastName: "Cummings" },
      ]),
      findUnique: jest.fn().mockResolvedValue({ isSuperUser: true }),
    },
    client: {
      upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: `client-${create.name}` })),
    },
    site: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `site-${data.name}` })),
    },
    tender: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `tender-${data.tenderNumber}` })),
      update: jest.fn().mockResolvedValue({}),
    },
    tenderClient: {
      upsert: jest.fn().mockResolvedValue({}),
    },
    tenderClientNote: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
  };

  return { ...base, ...overrides } as unknown as jest.Mocked<PrismaService>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function csvToBuffer(csv: string): Buffer {
  return Buffer.from(csv, "utf-8");
}

const HEADER = "Project Name,Client Company Name,Estimator,Tender Price,Quote Due Date,Date Submitted,Lead time,Probability,Decision,Follow Up Notes\n";

function makeRow(fields: {
  projectName?: string;
  clientName?: string;
  estimator?: string;
  tenderPrice?: string;
  quoteDueDate?: string;
  dateSubmitted?: string;
  leadTime?: string;
  probability?: string;
  decision?: string;
  followUpNotes?: string;
}): string {
  return [
    fields.projectName ?? "T2001 — Test Project",
    fields.clientName ?? "Test Client Pty Ltd",
    fields.estimator ?? "Sean Lattin",
    fields.tenderPrice ?? "100000",
    fields.quoteDueDate ?? "2024-03-01",
    fields.dateSubmitted ?? "",
    fields.leadTime ?? "14",
    fields.probability ?? "Quoting",
    fields.decision ?? "",
    fields.followUpNotes ?? "",
  ].join(",") + "\n";
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TenderTrackerImportService", () => {
  let service: TenderTrackerImportService;
  let prismaMock: jest.Mocked<PrismaService>;

  async function buildService(prismaMockOverride?: jest.Mocked<PrismaService>): Promise<void> {
    prismaMock = prismaMockOverride ?? makePrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenderTrackerImportService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(TenderTrackerImportService);
  }

  beforeEach(async () => {
    await buildService();
  });

  // =========================================================================
  // Dry-run: happy path
  // =========================================================================

  describe("dry-run: happy path", () => {
    it("returns correct counts for two valid rows and writes nothing", async () => {
      const csv = HEADER
        + makeRow({ projectName: "T2001 — Alpha Works", clientName: "Alpha Corp", probability: "Quoting" })
        + makeRow({ projectName: "T2002 — Beta Works", clientName: "Beta Ltd", probability: "Won", decision: "Won" });

      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", true, "actor-1");

      expect(report.dryRun).toBe(true);
      expect(report.rowsRead).toBe(2);
      expect(report.badRows).toHaveLength(0);
      // Dry-run writes nothing
      expect(prismaMock.client.upsert).not.toHaveBeenCalled();
      expect(prismaMock.tender.create).not.toHaveBeenCalled();
      expect(prismaMock.tenderClientNote.create).not.toHaveBeenCalled();
    });

    it("reads the synthetic fixture CSV without error", async () => {
      const fixturePath = path.join(__dirname, "__fixtures__", "synthetic-tracker.csv");
      const buffer = fs.readFileSync(fixturePath);
      const report = await service.import(buffer, "synthetic-tracker.csv", "text/csv", true, "actor-1");

      expect(report.dryRun).toBe(true);
      expect(report.rowsRead).toBeGreaterThan(0);
      // The fixture has a row with no T-number — should appear in badRows
      const noTNumber = report.badRows.find((b) => b.reason.includes("No T-number"));
      expect(noTNumber).toBeDefined();
    });
  });

  // =========================================================================
  // Dry-run: unmatched estimators
  // =========================================================================

  describe("dry-run: unmatched estimators", () => {
    it("surfaces an unmatched estimator name", async () => {
      const csv = HEADER
        + makeRow({ projectName: "T2003 — Gamma", clientName: "Gamma Co", estimator: "John Nobody" });

      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", true, "actor-1");

      expect(report.unmatchedEstimators).toContain("John Nobody");
    });

    it("does not flag a matched estimator", async () => {
      const csv = HEADER
        + makeRow({ projectName: "T2004 — Delta", clientName: "Delta Co", estimator: "Sean Lattin" });

      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", true, "actor-1");

      expect(report.unmatchedEstimators).not.toContain("Sean Lattin");
    });
  });

  // =========================================================================
  // Dry-run: bad rows
  // =========================================================================

  describe("dry-run: bad rows", () => {
    it("flags a row with missing Project Name", async () => {
      const csv = HEADER + ",Test Client Pty Ltd,Sean Lattin,100000,,,14,Quoting,,\n";

      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", true, "actor-1");

      const badRow = report.badRows.find((b) => b.reason.includes("Project Name"));
      expect(badRow).toBeDefined();
    });

    it("flags a row with bad Decimal in Tender Price (row not skipped)", async () => {
      const csv = HEADER
        + makeRow({ projectName: "T2005 — Epsilon", clientName: "Eps Co", tenderPrice: "not-a-number" });

      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", true, "actor-1");

      // Row is included in rowsRead (not skipped), but badRows contains a warning
      const badRow = report.badRows.find((b) => b.reason.includes("Tender Price"));
      expect(badRow).toBeDefined();
      expect(report.rowsRead).toBe(1); // Row was parsed (not skipped)
    });

    it("flags a row with no T-number in Project Name", async () => {
      const csv = HEADER + "No T-number here,Some Client,,100000,,,,,\n";

      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", true, "actor-1");

      const badRow = report.badRows.find((b) => b.reason.includes("No T-number"));
      expect(badRow).toBeDefined();
    });
  });

  // =========================================================================
  // Commit: status mapping (D2)
  // =========================================================================

  describe("commit: status mapping", () => {
    const statusCases: Array<{ probability: string; decision: string; expectedStatus: string }> = [
      { probability: "Won", decision: "", expectedStatus: "WON" },
      { probability: "Lost", decision: "", expectedStatus: "LOST" },
      { probability: "Not quoting", decision: "", expectedStatus: "WITHDRAWN" },
      { probability: "Submitted", decision: "", expectedStatus: "SUBMITTED" },
      { probability: "Quoting", decision: "", expectedStatus: "DRAFT" },
      { probability: "Chasing", decision: "", expectedStatus: "DRAFT" },
      { probability: "Hot", decision: "", expectedStatus: "DRAFT" },
      { probability: "Warm", decision: "", expectedStatus: "DRAFT" },
      { probability: "Cold", decision: "", expectedStatus: "DRAFT" },
    ];

    for (const { probability, decision, expectedStatus } of statusCases) {
      it(`maps Probability="${probability}" Decision="${decision}" → status "${expectedStatus}"`, async () => {
        const csv = HEADER
          + makeRow({ projectName: `T3001 — Status Test`, clientName: "Status Co", probability, decision });

        const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");

        const createCall = (prismaMock.tender.create as unknown as jest.Mock).mock.calls[0]?.[0];
        expect(createCall?.data?.status).toBe(expectedStatus);
        expect(report.tendersCreated).toBe(1);
      });

      // Reset mocks between each case
      afterEach(() => {
        jest.clearAllMocks();
        prismaMock = makePrismaMock();
      });
    }
  });

  // =========================================================================
  // Commit: Decision overrides Probability
  // =========================================================================

  describe("commit: Decision=Won overrides Probability=Cold", () => {
    it("sets status to WON when Decision=Won and Probability=Cold", async () => {
      const csv = HEADER
        + makeRow({ projectName: "T4001 — Override Test", clientName: "Override Co", probability: "Cold", decision: "Won" });

      await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");

      const createCall = (prismaMock.tender.create as unknown as jest.Mock).mock.calls[0]?.[0];
      expect(createCall?.data?.status).toBe("WON");
    });
  });

  // =========================================================================
  // Commit: Client dedupe on normalised name
  // =========================================================================

  describe("commit: client dedupe on normalised name", () => {
    it("calls client.upsert once per normalised name even if raw names differ in case/whitespace", async () => {
      // "Acme" and "  ACME  " → same normalised name → one upsert
      const csv = HEADER
        + makeRow({ projectName: "T5001 — Acme A", clientName: "Acme" })
        + makeRow({ projectName: "T5002 — Acme B", clientName: "  ACME  " });

      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");

      // Both rows parsed
      expect(report.rowsRead).toBe(2);
      // The second row hits the cache — upsert called only once for the client
      expect(prismaMock.client.upsert).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Commit: T-number idempotency (re-run updates rather than duplicates)
  // =========================================================================

  describe("commit: T-number idempotency", () => {
    it("calls tender.update when an existing tender with the same T-number is found", async () => {
      prismaMock = makePrismaMock();
      (prismaMock.tender.findFirst as unknown as jest.Mock).mockResolvedValueOnce({ id: "existing-tender-id", tenderNumber: "T6001" } as never);
      (prismaMock.site.findFirst as unknown as jest.Mock).mockResolvedValueOnce({ id: "existing-site-id" } as never);
      await buildService(prismaMock);

      const csv = HEADER
        + makeRow({ projectName: "T6001 — Re-run Test", clientName: "Re-run Co" });

      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");

      expect(prismaMock.tender.update).toHaveBeenCalled();
      expect(prismaMock.tender.create).not.toHaveBeenCalled();
      expect(report.tendersUpdated).toBe(1);
      expect(report.tendersCreated).toBe(0);
    });
  });

  // =========================================================================
  // Commit: Mantovaninni alias → Marco Mantovanini (D6)
  // =========================================================================

  describe("commit: Mantovaninni alias matches Marco Mantovanini", () => {
    it("resolves the misspelled estimator to Marco Mantovanini's user id", async () => {
      const csv = HEADER
        + makeRow({ projectName: "T7001 — Alias Test", clientName: "Alias Co", estimator: "Marco Mantovaninni" });

      await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");

      const createCall = (prismaMock.tender.create as unknown as jest.Mock).mock.calls[0]?.[0];
      expect(createCall?.data?.estimatorUserId).toBe("u3"); // Marco's mocked id
    });
  });

  // =========================================================================
  // Commit: Unmatched estimator → estimatorUserId null, no User created
  // =========================================================================

  describe("commit: unmatched estimator → estimatorUserId null", () => {
    it("sets estimatorUserId to null and does not call user.create", async () => {
      const csv = HEADER
        + makeRow({ projectName: "T8001 — Nobody Test", clientName: "Nobody Co", estimator: "Jane Nobody" });

      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");

      const createCall = (prismaMock.tender.create as unknown as jest.Mock).mock.calls[0]?.[0];
      expect(createCall?.data?.estimatorUserId).toBeNull();
      expect(report.unmatchedEstimators).toContain("Jane Nobody");
      // No user creation
      expect((prismaMock.user as unknown as Record<string, jest.Mock>)["create"]).toBeUndefined();
    });
  });

  // =========================================================================
  // Commit: Stub Site created with NULL address fields and imported-flag notes
  // =========================================================================

  describe("commit: stub Site created with NULL address fields", () => {
    it("creates a Site with no address fields and IMPORTED notes", async () => {
      const csv = HEADER
        + makeRow({ projectName: "T9001 — Site Test", clientName: "Site Co" });

      await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");

      const siteCreateCall = (prismaMock.site.create as unknown as jest.Mock).mock.calls[0]?.[0];
      expect(siteCreateCall?.data?.notes).toBe("IMPORTED — address to be completed");
      // No address fields should be set
      expect(siteCreateCall?.data?.addressLine1).toBeUndefined();
      expect(siteCreateCall?.data?.suburb).toBeUndefined();
      expect(siteCreateCall?.data?.state).toBeUndefined();
      expect(siteCreateCall?.data?.postcode).toBeUndefined();
    });
  });
});

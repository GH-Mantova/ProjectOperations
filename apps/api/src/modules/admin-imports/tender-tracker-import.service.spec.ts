/**
 * MIG-2 -- Unit tests for TenderTrackerImportService.
 * Synthetic fixtures only (D9). Prisma fully mocked.
 */

import { Test, TestingModule } from "@nestjs/testing";
import * as fs from "fs";
import * as path from "path";
import { TenderTrackerImportService } from "./tender-tracker-import.service";
import { PrismaService } from "../../prisma/prisma.service";

function makePrismaMock(overrides: Record<string, unknown> = {}): jest.Mocked<PrismaService> {
  const base = {
    user: {
      findMany: jest.fn().mockResolvedValue([
        { id: "u1", firstName: "Sean", lastName: "Lattin" },
        { id: "u2", firstName: "Raj", lastName: "Pudasaini" },
        { id: "u3", firstName: "Marco", lastName: "Mantovanini" },
      ]),
      findUnique: jest.fn().mockResolvedValue({ isSuperUser: true }),
    },
    client: {
      upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: `client-${create.name}` })),
    },
    site: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `site-${data.name}` })),
      update: jest.fn().mockResolvedValue({}),
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

function csvToBuffer(csv: string): Buffer {
  return Buffer.from(csv, "utf-8");
}

const HEADER = "Tender No.,Project Name,Client Company Name,Estimator,Tender Price,Quote Due Date,Date Submitted,Lead time,Probability,Decision,Client Project Status,Started quoting,Follow Up Notes\n";

function makeRow(f: {
  tenderNo?: string; projectName?: string; clientName?: string; estimator?: string;
  tenderPrice?: string; quoteDueDate?: string; dateSubmitted?: string; leadTime?: string;
  probability?: string; decision?: string; clientProjectStatus?: string;
  startedQuoting?: string; followUpNotes?: string;
}): string {
  return [
    f.tenderNo ?? "T2001",
    f.projectName ?? "Test Project",
    f.clientName ?? "Test Client Pty Ltd",
    f.estimator ?? "Sean Lattin",
    f.tenderPrice ?? "100000",
    f.quoteDueDate ?? "2024-03-01",
    f.dateSubmitted ?? "",
    f.leadTime ?? "14",
    f.probability ?? "",
    f.decision ?? "Quoting",
    f.clientProjectStatus ?? "",
    f.startedQuoting ?? "",
    f.followUpNotes ?? "",
  ].join(",") + "\n";
}

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

  describe("dry-run", () => {
    it("returns correct counts for two valid rows and writes nothing", async () => {
      const csv = HEADER
        + makeRow({ tenderNo: "T2001", projectName: "Alpha Works", clientName: "Alpha Corp", decision: "Quoting" })
        + makeRow({ tenderNo: "T2002", projectName: "Beta Works", clientName: "Beta Ltd", probability: "Won" });
      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", true, "actor-1");
      expect(report.dryRun).toBe(true);
      expect(report.rowsRead).toBe(2);
      expect(report.badRows).toHaveLength(0);
      expect(prismaMock.client.upsert).not.toHaveBeenCalled();
      expect(prismaMock.tender.create).not.toHaveBeenCalled();
    });

    it("reads the synthetic fixture CSV without error", async () => {
      const fixturePath = path.join(__dirname, "__fixtures__", "synthetic-tracker.csv");
      const buffer = fs.readFileSync(fixturePath);
      const report = await service.import(buffer, "synthetic-tracker.csv", "text/csv", true, "actor-1");
      expect(report.dryRun).toBe(true);
      expect(report.rowsRead).toBeGreaterThan(0);
    });
  });

  describe("estimators", () => {
    it("surfaces an unmatched estimator name", async () => {
      const csv = HEADER + makeRow({ tenderNo: "T2003", projectName: "Gamma", clientName: "Gamma Co", estimator: "John Nobody" });
      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", true, "actor-1");
      expect(report.unmatchedEstimators).toContain("John Nobody");
    });

    it("does not flag a matched estimator", async () => {
      const csv = HEADER + makeRow({ tenderNo: "T2004", projectName: "Delta", clientName: "Delta Co", estimator: "Sean Lattin" });
      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", true, "actor-1");
      expect(report.unmatchedEstimators).not.toContain("Sean Lattin");
    });

    it("reassigns Russel Cummings to Sean Lattin (not unmatched)", async () => {
      const csv = HEADER + makeRow({ tenderNo: "T2010", projectName: "Reassign", clientName: "Reassign Co", estimator: "Russel Cummings" });
      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");
      expect(report.unmatchedEstimators).not.toContain("Russel Cummings");
      const createCall = (prismaMock.tender.create as unknown as jest.Mock).mock.calls[0]?.[0];
      expect(createCall?.data?.estimatorUserId).toBe("u1");
    });
  });

  describe("bad rows", () => {
    it("flags a row with missing Project Name", async () => {
      const csv = HEADER + "T2005,,Test Client Pty Ltd,Sean Lattin,100000,,,14,,Quoting,,,\n";
      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", true, "actor-1");
      expect(report.badRows.find((b) => b.reason.includes("Project Name"))).toBeDefined();
    });

    it("flags a bad Decimal Tender Price without skipping the row", async () => {
      const csv = HEADER + makeRow({ tenderNo: "T2006", projectName: "Epsilon", clientName: "Eps Co", tenderPrice: "not-a-number" });
      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", true, "actor-1");
      expect(report.badRows.find((b) => b.reason.includes("Tender Price"))).toBeDefined();
      expect(report.rowsRead).toBe(1);
    });

    it("flags a row with no T-number anywhere", async () => {
      const csv = HEADER + ",No T-number here,Some Client,,100000,,,,,,,,\n";
      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", true, "actor-1");
      expect(report.badRows.find((b) => b.reason.includes("No T-number"))).toBeDefined();
    });
  });

  describe("commit: status mapping", () => {
    const cases: Array<{ probability: string; decision: string; cps: string; expected: string }> = [
      { probability: "Won", decision: "Submitted", cps: "", expected: "CONTRACT_ISSUED" },
      { probability: "Lost", decision: "Submitted", cps: "", expected: "LOST" },
      { probability: "", decision: "Submitted", cps: "Won", expected: "AWARDED" },
      { probability: "", decision: "Submitted", cps: "In Progress", expected: "AWARDED" },
      { probability: "", decision: "Not quoting", cps: "", expected: "WITHDRAWN" },
      { probability: "", decision: "Submitted", cps: "", expected: "SUBMITTED" },
      { probability: "Cold", decision: "Submitted", cps: "", expected: "SUBMITTED" },
      { probability: "", decision: "Quoting", cps: "", expected: "IN_PROGRESS" },
      { probability: "", decision: "", cps: "", expected: "DRAFT" },
    ];
    for (const c of cases) {
      it(`Prob="${c.probability}" Dec="${c.decision}" CPS="${c.cps}" -> ${c.expected}`, async () => {
        const csv = HEADER + makeRow({
          tenderNo: "T3001", projectName: "Status Test", clientName: "Status Co",
          probability: c.probability, decision: c.decision, clientProjectStatus: c.cps,
        });
        await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");
        const createCall = (prismaMock.tender.create as unknown as jest.Mock).mock.calls[0]?.[0];
        expect(createCall?.data?.status).toBe(c.expected);
      });
      afterEach(() => { jest.clearAllMocks(); prismaMock = makePrismaMock(); });
    }
  });

  describe("commit: probability rating -> numeric %", () => {
    it("maps Cold -> 20", async () => {
      const csv = HEADER + makeRow({ tenderNo: "T3100", projectName: "Cold Test", clientName: "Cold Co", probability: "Cold", decision: "Submitted" });
      await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");
      const createCall = (prismaMock.tender.create as unknown as jest.Mock).mock.calls[0]?.[0];
      expect(createCall?.data?.probability).toBe(20);
    });
  });

  describe("commit: client dedupe on normalised name", () => {
    it("upserts a client once for case/whitespace variants", async () => {
      const csv = HEADER
        + makeRow({ tenderNo: "T5001", projectName: "Acme A", clientName: "Acme" })
        + makeRow({ tenderNo: "T5002", projectName: "Acme B", clientName: "  ACME  " });
      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");
      expect(report.rowsRead).toBe(2);
      expect(prismaMock.client.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe("commit: T-number idempotency", () => {
    it("updates (not creates) when an existing tender matches the T-number", async () => {
      prismaMock = makePrismaMock();
      (prismaMock.tender.findFirst as unknown as jest.Mock).mockResolvedValueOnce({ id: "existing-tender-id", tenderNumber: "T6001", siteId: "existing-site-id" } as never);
      await buildService(prismaMock);
      const csv = HEADER + makeRow({ tenderNo: "T6001", projectName: "Re-run Test", clientName: "Re-run Co" });
      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");
      expect(prismaMock.tender.update).toHaveBeenCalled();
      expect(prismaMock.tender.create).not.toHaveBeenCalled();
      expect(prismaMock.site.update).toHaveBeenCalled();
      expect(report.tendersUpdated).toBe(1);
    });
  });

  describe("commit: Mantovaninni alias -> Marco", () => {
    it("resolves the misspelling to Marco's user id", async () => {
      const csv = HEADER + makeRow({ tenderNo: "T7001", projectName: "Alias Test", clientName: "Alias Co", estimator: "Marco Mantovaninni" });
      await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");
      const createCall = (prismaMock.tender.create as unknown as jest.Mock).mock.calls[0]?.[0];
      expect(createCall?.data?.estimatorUserId).toBe("u3");
    });
  });

  describe("commit: unmatched estimator -> null", () => {
    it("sets estimatorUserId null and never creates a user", async () => {
      const csv = HEADER + makeRow({ tenderNo: "T8001", projectName: "Nobody Test", clientName: "Nobody Co", estimator: "Jane Nobody" });
      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");
      const createCall = (prismaMock.tender.create as unknown as jest.Mock).mock.calls[0]?.[0];
      expect(createCall?.data?.estimatorUserId).toBeNull();
      expect(report.unmatchedEstimators).toContain("Jane Nobody");
      expect((prismaMock.user as unknown as Record<string, jest.Mock>)["create"]).toBeUndefined();
    });
  });

  describe("commit: stub Site with null address + IMPORTED note", () => {
    it("creates a Site with no address fields", async () => {
      const csv = HEADER + makeRow({ tenderNo: "T9001", projectName: "Site Test", clientName: "Site Co" });
      await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");
      const siteCreateCall = (prismaMock.site.create as unknown as jest.Mock).mock.calls[0]?.[0];
      expect(siteCreateCall?.data?.notes).toContain("IMPORTED");
      expect(siteCreateCall?.data?.addressLine1).toBeUndefined();
    });
  });

  describe("commit: Tender No. column + non-doubled title", () => {
    it("uses the Tender No. column and builds a single-prefixed title", async () => {
      const csv = HEADER + makeRow({ tenderNo: "T1234", projectName: "50 Ann St Building upgrade", clientName: "Buildcorp", probability: "Lost", decision: "Submitted" });
      await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");
      const createCall = (prismaMock.tender.create as unknown as jest.Mock).mock.calls[0]?.[0];
      expect(createCall?.data?.tenderNumber).toBe("T1234");
      expect(createCall?.data?.title).toBe("T1234 — 50 Ann St Building upgrade");
    });

    it("does not double the T-number when already embedded in the Project Name", async () => {
      const csv = HEADER + makeRow({ tenderNo: "", projectName: "T1234 — 50 Ann St", clientName: "Buildcorp" });
      await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");
      const createCall = (prismaMock.tender.create as unknown as jest.Mock).mock.calls[0]?.[0];
      expect(createCall?.data?.title).toBe("T1234 — 50 Ann St");
      expect(createCall?.data?.tenderNumber).toBe("T1234");
    });
  });
});

/**
 * MIG-2 -- Unit tests for TenderTrackerImportService.
 * Synthetic fixtures only (D9). Prisma fully mocked.
 */

import { Test, TestingModule } from "@nestjs/testing";
import * as fs from "fs";
import * as path from "path";
import { TenderTrackerImportService } from "./tender-tracker-import.service";
import { PrismaService } from "../../prisma/prisma.service";
import { TenderNumberService } from "../tendering/tender-number.service";

const tenderNumbersMock = {
  generate: jest.fn().mockResolvedValue({
    tenderNumber: "T240101-TEST-Rev1",
    clientSlugSnapshot: "TEST",
    revisionNumber: 1,
  }),
};

function makePrismaMock(overrides: Record<string, unknown> = {}): jest.Mocked<PrismaService> {
  const base = {
    user: {
      findMany: jest.fn().mockResolvedValue([
        { id: "u1", firstName: "Sean", lastName: "Lattin" },
        { id: "u2", firstName: "Raj", lastName: "Pudasaini" },
        { id: "u3", firstName: "Marco", lastName: "Mantovanini" },
      ]),
      findUnique: jest.fn().mockResolvedValue({
        id: "u1", firstName: "Sean", lastName: "Lattin", isSuperUser: true,
      }),
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
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: `tender-${data.tenderNumber}`, createdAt: TENDER_CREATED_AT })),
      update: jest.fn().mockResolvedValue({}),
    },
    tenderClient: {
      upsert: jest.fn().mockResolvedValue({}),
    },
    tenderClientNote: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
    },
    tenderClarificationNote: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  return { ...base, ...overrides } as unknown as jest.Mocked<PrismaService>;
}

/** Fixed so date-fallback assertions are deterministic. */
const TENDER_CREATED_AT = new Date("2023-01-15T00:00:00.000Z");

/**
 * Spreadsheet dates are parsed into LOCAL time, so asserting on toISOString()
 * shifts the day by the machine's UTC offset and the test would pass in UTC and
 * fail in Brisbane. Compare local calendar parts instead.
 */
function localYmd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
        { provide: TenderNumberService, useValue: tenderNumbersMock },
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
      expect(createCall?.data?.tenderNumber).toBe("T240101-TEST-Rev1");
      expect(createCall?.data?.title).toBe("T1234 — 50 Ann St Building upgrade");
    });

    it("does not double the T-number when already embedded in the Project Name", async () => {
      const csv = HEADER + makeRow({ tenderNo: "", projectName: "T1234 — 50 Ann St", clientName: "Buildcorp" });
      await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");
      const createCall = (prismaMock.tender.create as unknown as jest.Mock).mock.calls[0]?.[0];
      expect(createCall?.data?.title).toBe("T1234 — 50 Ann St");
      expect(createCall?.data?.tenderNumber).toBe("T240101-TEST-Rev1");
    });

    it("keeps an already-canonical tender number on re-run (idempotent)", async () => {
      prismaMock = makePrismaMock();
      (prismaMock.tender.findFirst as unknown as jest.Mock).mockResolvedValueOnce({ id: "t-existing", tenderNumber: "T240101-TEST-Rev1", siteId: "s-existing" } as never);
      await buildService(prismaMock);
      tenderNumbersMock.generate.mockClear();
      const csv = HEADER + makeRow({ tenderNo: "T1234", projectName: "50 Ann St", clientName: "Buildcorp" });
      await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");
      expect(tenderNumbersMock.generate).not.toHaveBeenCalled();
      const updateCall = (prismaMock.tender.update as unknown as jest.Mock).mock.calls[0]?.[0];
      expect(updateCall?.data?.tenderNumber).toBeUndefined();
    });
  });

  // ===========================================================================
  // Follow-up notes -> Activity & communications
  //
  // Regression guard: these notes used to be written to TenderClientNote, which
  // the Activity panel never reads, so every imported note was invisible.
  // ===========================================================================

  const clarificationCreateCalls = () =>
    (prismaMock.tenderClarificationNote.create as unknown as jest.Mock).mock.calls;

  describe("commit: Follow Up Notes land in the feed the UI actually reads", () => {
    it("writes a TenderClarificationNote and never a TenderClientNote", async () => {
      const csv = HEADER + makeRow({ followUpNotes: "Demex won it" });
      await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");

      expect(prismaMock.tenderClarificationNote.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.tenderClientNote.create).not.toHaveBeenCalled();
    });

    it("logs the note as an internal note carrying the exact text", async () => {
      const csv = HEADER + makeRow({ followUpNotes: "Demex won it" });
      await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");

      expect(clarificationCreateCalls()[0]?.[0]?.data).toEqual(
        expect.objectContaining({ noteType: "note", direction: "internal", text: "Demex won it" })
      );
    });

    it("attributes the note to the row's estimator, not the import actor", async () => {
      const csv = HEADER + makeRow({ estimator: "Raj Pudasaini", followUpNotes: "Priced low" });
      await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");

      expect(clarificationCreateCalls()[0]?.[0]?.data?.createdById).toBe("u2");
    });

    it("falls back to the import actor when the estimator cannot be resolved", async () => {
      const csv = HEADER + makeRow({ estimator: "Nobody At All", followUpNotes: "Orphan note" });
      await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");

      expect(clarificationCreateCalls()[0]?.[0]?.data?.createdById).toBe("actor-1");
    });

    it("skips a note whose text already exists on the tender", async () => {
      (prismaMock.tenderClarificationNote.findFirst as unknown as jest.Mock)
        .mockResolvedValueOnce({ id: "already-there" } as never);

      const csv = HEADER + makeRow({ followUpNotes: "Demex won it" });
      const report = await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");

      expect(prismaMock.tenderClarificationNote.create).not.toHaveBeenCalled();
      expect(report.notesCreated).toBe(0);
    });

    it("writes nothing at all when the Follow Up Notes cell is empty", async () => {
      const csv = HEADER + makeRow({ followUpNotes: "" });
      await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");

      expect(prismaMock.tenderClarificationNote.create).not.toHaveBeenCalled();
    });
  });

  describe("commit: follow-up note date fallback chain", () => {
    it("prefers Date Submitted", async () => {
      const csv = HEADER + makeRow({
        dateSubmitted: "2024-05-06", quoteDueDate: "2024-03-01", followUpNotes: "n",
      });
      await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");

      const occurredAt = clarificationCreateCalls()[0]?.[0]?.data?.occurredAt as Date;
      expect(localYmd(occurredAt)).toBe("2024-05-06");
    });

    it("falls back to Quote Due Date when Date Submitted is blank", async () => {
      const csv = HEADER + makeRow({
        dateSubmitted: "", quoteDueDate: "2024-03-01", followUpNotes: "n",
      });
      await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");

      const occurredAt = clarificationCreateCalls()[0]?.[0]?.data?.occurredAt as Date;
      expect(localYmd(occurredAt)).toBe("2024-03-01");
    });

    it("falls back to Started quoting when both submitted and due dates are blank", async () => {
      const csv = HEADER + makeRow({
        dateSubmitted: "", quoteDueDate: "", startedQuoting: "2024-02-02", followUpNotes: "n",
      });
      await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");

      const occurredAt = clarificationCreateCalls()[0]?.[0]?.data?.occurredAt as Date;
      expect(localYmd(occurredAt)).toBe("2024-02-02");
    });

    it("uses the tender's createdAt when the row carries no date at all -- never today", async () => {
      const csv = HEADER + makeRow({
        dateSubmitted: "", quoteDueDate: "", startedQuoting: "", followUpNotes: "undated note",
      });
      await service.import(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");

      const occurredAt = clarificationCreateCalls()[0]?.[0]?.data?.occurredAt as Date;
      expect(occurredAt).toEqual(TENDER_CREATED_AT);
    });
  });

  describe("importFollowUpNotes -- notes-only mode (Stage B)", () => {
    function withExistingTender(extra: Record<string, unknown> = {}) {
      const mock = makePrismaMock();
      (mock.tender.findFirst as unknown as jest.Mock).mockResolvedValue({
        id: "t-1",
        title: "T2001 — Test Project",
        estimatorUserId: "u1",
        createdAt: TENDER_CREATED_AT,
        tenderClients: [{ clientId: "c-1", client: { name: "Test Client Pty Ltd" } }],
        ...extra,
      } as never);
      return mock;
    }

    it("writes ONLY notes -- no tender, client, site or link writes", async () => {
      await buildService(withExistingTender());
      const csv = HEADER + makeRow({ followUpNotes: "Top-up note" });

      const report = await service.importFollowUpNotes(
        csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1"
      );

      expect(report.mode).toBe("notesOnly");
      expect(report.notesCreated).toBe(1);
      expect(prismaMock.tender.create).not.toHaveBeenCalled();
      expect(prismaMock.tender.update).not.toHaveBeenCalled();
      expect(prismaMock.client.upsert).not.toHaveBeenCalled();
      expect(prismaMock.site.create).not.toHaveBeenCalled();
      expect(prismaMock.site.update).not.toHaveBeenCalled();
      expect(prismaMock.tenderClient.upsert).not.toHaveBeenCalled();
      expect(prismaMock.tenderClientNote.create).not.toHaveBeenCalled();
    });

    it("attaches the note to the matching linked client", async () => {
      await buildService(withExistingTender());
      const csv = HEADER + makeRow({ clientName: "Test Client Pty Ltd", followUpNotes: "n" });

      await service.importFollowUpNotes(csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1");

      expect(clarificationCreateCalls()[0]?.[0]?.data?.clientId).toBe("c-1");
    });

    it("leaves clientId null when no linked client matches, and never creates one", async () => {
      await buildService(withExistingTender({
        tenderClients: [{ clientId: "c-9", client: { name: "Some Other Builder" } }],
      }));
      const csv = HEADER + makeRow({ clientName: "Test Client Pty Ltd", followUpNotes: "n" });

      const report = await service.importFollowUpNotes(
        csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1"
      );

      expect(clarificationCreateCalls()[0]?.[0]?.data?.clientId).toBeNull();
      expect(report.notesWithoutClient).toBe(1);
      expect(prismaMock.client.upsert).not.toHaveBeenCalled();
      expect(prismaMock.tenderClient.upsert).not.toHaveBeenCalled();
    });

    it("reports a row whose tender does not exist instead of creating one", async () => {
      const mock = makePrismaMock();
      (mock.tender.findFirst as unknown as jest.Mock).mockResolvedValue(null as never);
      await buildService(mock);
      const csv = HEADER + makeRow({ tenderNo: "T9999", followUpNotes: "orphan" });

      const report = await service.importFollowUpNotes(
        csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1"
      );

      expect(report.notesSkippedNoTenderMatch).toBe(1);
      expect(report.notesCreated).toBe(0);
      expect(prismaMock.tender.create).not.toHaveBeenCalled();
      expect(report.badRows.some((b) => b.reason.includes("T9999"))).toBe(true);
    });

    it("counts duplicates instead of writing them", async () => {
      const mock = withExistingTender();
      (mock.tenderClarificationNote.findFirst as unknown as jest.Mock)
        .mockResolvedValue({ id: "dup" } as never);
      await buildService(mock);
      const csv = HEADER + makeRow({ followUpNotes: "already migrated" });

      const report = await service.importFollowUpNotes(
        csvToBuffer(csv), "test.csv", "text/csv", false, "actor-1"
      );

      expect(report.notesSkippedDuplicate).toBe(1);
      expect(report.notesCreated).toBe(0);
      expect(prismaMock.tenderClarificationNote.create).not.toHaveBeenCalled();
    });

    it("dry-run previews without writing anything", async () => {
      await buildService(withExistingTender());
      const csv = HEADER + makeRow({ followUpNotes: "Preview me please" });

      const report = await service.importFollowUpNotes(
        csvToBuffer(csv), "test.csv", "text/csv", true, "actor-1"
      );

      expect(report.dryRun).toBe(true);
      expect(report.notesCreated).toBe(1);
      expect(prismaMock.tenderClarificationNote.create).not.toHaveBeenCalled();
      expect(report.sample).toHaveLength(1);
      expect(report.sample[0]).toEqual(expect.objectContaining({
        tenderTitle: "T2001 — Test Project",
        clientName: "Test Client Pty Ltd",
        author: "Sean Lattin",
        textPreview: "Preview me please",
      }));
    });
  });

  describe("migrateFollowUpNotes -- Stage A", () => {
    const sourceNote = {
      id: "tcn-1",
      tenderId: "t-1",
      clientId: "c-1",
      noteType: "note",
      subject: null,
      body: "  Gave a stupidly high price  ",
      occurredAt: new Date("2024-01-15T00:00:00.000Z"),
      createdById: "actor-old",
      tender: { title: "T1683 — 10 Gretty lane", estimatorUserId: "u2" },
      client: { name: "Brenacon" },
    };

    function withSourceNotes(notes: unknown[]) {
      const mock = makePrismaMock();
      (mock.tenderClientNote.findMany as unknown as jest.Mock).mockResolvedValue(notes as never);
      return mock;
    }

    it("copies a source row into the feed without deleting or updating it", async () => {
      await buildService(withSourceNotes([sourceNote]));

      const report = await service.migrateFollowUpNotes("actor-1", false);

      expect(report.mode).toBe("migrate");
      expect(report.notesCreated).toBe(1);
      expect(clarificationCreateCalls()[0]?.[0]?.data).toEqual(
        expect.objectContaining({
          tenderId: "t-1",
          clientId: "c-1",
          direction: "internal",
          noteType: "note",
          text: "Gave a stupidly high price",
          createdById: "u2",
        })
      );
      expect((prismaMock.tenderClientNote as unknown as Record<string, unknown>).delete).toBeUndefined();
      expect(prismaMock.tenderClientNote.create).not.toHaveBeenCalled();
    });

    it("preserves the original occurredAt", async () => {
      await buildService(withSourceNotes([sourceNote]));

      await service.migrateFollowUpNotes("actor-1", false);

      expect(clarificationCreateCalls()[0]?.[0]?.data?.occurredAt)
        .toEqual(new Date("2024-01-15T00:00:00.000Z"));
    });

    it("folds a subject into the single text field the feed renders", async () => {
      await buildService(withSourceNotes([{ ...sourceNote, subject: "Site visit" }]));

      await service.migrateFollowUpNotes("actor-1", false);

      expect(clarificationCreateCalls()[0]?.[0]?.data?.text)
        .toBe("Site visit — Gave a stupidly high price");
    });

    it("maps site_visit to a renderable note type", async () => {
      await buildService(withSourceNotes([{ ...sourceNote, noteType: "site_visit" }]));

      await service.migrateFollowUpNotes("actor-1", false);

      expect(clarificationCreateCalls()[0]?.[0]?.data?.noteType).toBe("note");
    });

    it("passes a renderable note type through unchanged", async () => {
      await buildService(withSourceNotes([{ ...sourceNote, noteType: "email" }]));

      await service.migrateFollowUpNotes("actor-1", false);

      expect(clarificationCreateCalls()[0]?.[0]?.data?.noteType).toBe("email");
    });

    it("falls back through source author to actor when the tender has no estimator", async () => {
      await buildService(withSourceNotes([
        { ...sourceNote, tender: { title: "T1 — x", estimatorUserId: null } },
      ]));

      const report = await service.migrateFollowUpNotes("actor-1", false);

      expect(clarificationCreateCalls()[0]?.[0]?.data?.createdById).toBe("actor-old");
      expect(report.notesWithoutEstimator).toBe(1);
    });

    it("uses the actor when neither estimator nor source author exists", async () => {
      await buildService(withSourceNotes([
        { ...sourceNote, createdById: null, tender: { title: "T1 — x", estimatorUserId: null } },
      ]));

      await service.migrateFollowUpNotes("actor-1", false);

      expect(clarificationCreateCalls()[0]?.[0]?.data?.createdById).toBe("actor-1");
    });

    it("skips a row already present in the feed", async () => {
      const mock = withSourceNotes([sourceNote]);
      (mock.tenderClarificationNote.findFirst as unknown as jest.Mock)
        .mockResolvedValue({ id: "dup" } as never);
      await buildService(mock);

      const report = await service.migrateFollowUpNotes("actor-1", false);

      expect(report.notesSkippedDuplicate).toBe(1);
      expect(report.notesCreated).toBe(0);
      expect(prismaMock.tenderClarificationNote.create).not.toHaveBeenCalled();
    });

    it("dry-run reports what it would write and writes nothing", async () => {
      await buildService(withSourceNotes([sourceNote]));

      const report = await service.migrateFollowUpNotes("actor-1", true);

      expect(report.dryRun).toBe(true);
      expect(report.rowsRead).toBe(1);
      expect(report.notesCreated).toBe(1);
      expect(prismaMock.tenderClarificationNote.create).not.toHaveBeenCalled();
      expect(report.sample[0]).toEqual(expect.objectContaining({
        tenderTitle: "T1683 — 10 Gretty lane",
        clientName: "Brenacon",
        textPreview: "Gave a stupidly high price",
      }));
    });

    it("reports an empty-bodied source row instead of writing a blank note", async () => {
      await buildService(withSourceNotes([{ ...sourceNote, body: "   " }]));

      const report = await service.migrateFollowUpNotes("actor-1", false);

      expect(report.notesCreated).toBe(0);
      expect(prismaMock.tenderClarificationNote.create).not.toHaveBeenCalled();
      expect(report.badRows).toHaveLength(1);
    });
  });
});

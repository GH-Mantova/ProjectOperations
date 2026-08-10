import { BadRequestException } from "@nestjs/common";
import { TenderingService } from "./tendering.service";

describe("TenderingService", () => {
  const tenderNumberServiceMock = () => ({
    generate: jest.fn().mockResolvedValue({
      tenderNumber: "T260612-ACME-Rev1",
      clientSlugSnapshot: "ACME",
      revisionNumber: 1
    }),
    bumpRevision: jest.fn(),
    validate: jest.fn(() => null)
  });

  it("rejects more than one awarded tender client", async () => {
    const service = new TenderingService(
      {
        tender: { findFirst: jest.fn(), create: jest.fn() }
      } as never,
      { write: jest.fn() } as never,
      { sendNotificationEmail: jest.fn() } as never,
      { ensureTenderFolderStructure: jest.fn().mockResolvedValue(undefined) } as never,
      tenderNumberServiceMock() as never,
      { recordTenderOutcome: jest.fn().mockResolvedValue(undefined) } as never,
      { convertFromTender: jest.fn().mockResolvedValue(undefined) } as never,
      { createFromTender: jest.fn().mockResolvedValue(undefined) } as never,
      { recordOutcome: jest.fn().mockResolvedValue({ id: "o-1", supersedesId: null }), normalizeOutcome: jest.fn((v) => v ?? {}) } as never
    );

    await expect(
      service.create(
        {
          tenderNumber: "T-001",
          title: "Test tender",
          siteId: "site-unassigned",
          tenderClients: [
            { clientId: "client-1", isAwarded: true },
            { clientId: "client-2", isAwarded: true }
          ]
        },
        "user-1"
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("previews CSV import rows", () => {
    const prisma = {
      tender: {
        findMany: jest.fn().mockResolvedValue([])
      }
    };
    const service = new TenderingService(
      prisma as never,
      { write: jest.fn() } as never,
      { sendNotificationEmail: jest.fn() } as never,
      { ensureTenderFolderStructure: jest.fn().mockResolvedValue(undefined) } as never,
      tenderNumberServiceMock() as never,
      { recordTenderOutcome: jest.fn().mockResolvedValue(undefined) } as never,
      { convertFromTender: jest.fn().mockResolvedValue(undefined) } as never,
      { createFromTender: jest.fn().mockResolvedValue(undefined) } as never,
      { recordOutcome: jest.fn().mockResolvedValue({ id: "o-1", supersedesId: null }), normalizeOutcome: jest.fn((v) => v ?? {}) } as never
    );

    return expect(
      service.previewImport([
        "tenderNumber,title,clientNames,status",
        "TEN-1,Example Tender,Client A|Client B,IN_PROGRESS"
      ].join("\n"))
    ).resolves.toMatchObject({
      totalRows: 1,
      rows: [
        expect.objectContaining({
          tenderNumber: "TEN-1",
          title: "Example Tender",
          valid: true
        })
      ]
    });
  });

  it("marks duplicate tender numbers during import preview", async () => {
    const service = new TenderingService(
      {
        tender: {
          findMany: jest.fn().mockResolvedValue([{ tenderNumber: "TEN-1" }])
        }
      } as never,
      { write: jest.fn() } as never,
      { sendNotificationEmail: jest.fn() } as never,
      { ensureTenderFolderStructure: jest.fn().mockResolvedValue(undefined) } as never,
      tenderNumberServiceMock() as never,
      { recordTenderOutcome: jest.fn().mockResolvedValue(undefined) } as never,
      { convertFromTender: jest.fn().mockResolvedValue(undefined) } as never,
      { createFromTender: jest.fn().mockResolvedValue(undefined) } as never,
      { recordOutcome: jest.fn().mockResolvedValue({ id: "o-1", supersedesId: null }), normalizeOutcome: jest.fn((v) => v ?? {}) } as never
    );

    const result = await service.previewImport([
      "tenderNumber,title,clientNames,status",
      "TEN-1,Example Tender,Client A|Client B,IN_PROGRESS"
    ].join("\n"));

    expect(result.rows[0]).toMatchObject({
      tenderNumber: "TEN-1",
      duplicate: true,
      valid: false
    });
  });

  it("routes unified note activity creation through note handling", async () => {
    const service = new TenderingService(
      {} as never,
      { write: jest.fn() } as never,
      { sendNotificationEmail: jest.fn() } as never,
      { ensureTenderFolderStructure: jest.fn().mockResolvedValue(undefined) } as never,
      tenderNumberServiceMock() as never,
      { recordTenderOutcome: jest.fn().mockResolvedValue(undefined) } as never,
      { convertFromTender: jest.fn().mockResolvedValue(undefined) } as never,
      { createFromTender: jest.fn().mockResolvedValue(undefined) } as never,
      { recordOutcome: jest.fn().mockResolvedValue({ id: "o-1", supersedesId: null }), normalizeOutcome: jest.fn((v) => v ?? {}) } as never
    );

    const addNoteSpy = jest.spyOn(service, "addNote").mockResolvedValue({ id: "tender-1" } as never);

    await service.addActivity(
      "tender-1",
      {
        activityType: "NOTE",
        title: "Commercial review complete",
        details: "Pricing assumptions confirmed"
      },
      "user-1"
    );

    expect(addNoteSpy).toHaveBeenCalledWith(
      "tender-1",
      {
        body: "Commercial review complete\n\nPricing assumptions confirmed"
      },
      "user-1"
    );
  });

  it("auto-creates the contract when a tender moves into CONTRACT_ISSUED", async () => {
    const projects = { convertFromTender: jest.fn().mockResolvedValue(undefined) };
    const contracts = { createFromTender: jest.fn().mockResolvedValue({ id: "contract-new" }) };
    const audit = { write: jest.fn().mockResolvedValue(undefined) };
    const service = new TenderingService(
      {
        tender: {
          findUnique: jest.fn().mockResolvedValue({
            id: "t-1",
            status: "AWARDED",
            submittedAt: new Date(),
            ratesSnapshotAt: new Date(),
            wonAt: null,
            lostAt: null,
            tenderScoreCounted: true
          }),
          update: jest.fn().mockResolvedValue({
            id: "t-1",
            tenderNumber: "T260612-ACME-Rev1",
            title: "x",
            estimatedValue: null,
            tenderClients: []
          })
        },
        project: { findFirst: jest.fn().mockResolvedValue({ id: "project-1" }) }
      } as never,
      audit as never,
      { sendNotificationEmail: jest.fn() } as never,
      { ensureTenderFolderStructure: jest.fn().mockResolvedValue(undefined) } as never,
      tenderNumberServiceMock() as never,
      { recordTenderOutcome: jest.fn().mockResolvedValue(undefined) } as never,
      projects as never,
      contracts as never,
      { recordOutcome: jest.fn().mockResolvedValue({ id: "o-1", supersedesId: null }), normalizeOutcome: jest.fn((v) => v ?? {}) } as never
    );

    await service.updateStatus("t-1", "CONTRACT_ISSUED", "user-1");

    // Project already existed — convertFromTender is skipped, contract auto-create runs.
    expect(projects.convertFromTender).not.toHaveBeenCalled();
    expect(contracts.createFromTender).toHaveBeenCalledWith("t-1", "user-1");
  });

  it("converts first, then auto-creates the contract when the tender has no project yet", async () => {
    const projects = { convertFromTender: jest.fn().mockResolvedValue({ id: "project-new" }) };
    const contracts = { createFromTender: jest.fn().mockResolvedValue({ id: "contract-new" }) };
    const service = new TenderingService(
      {
        tender: {
          findUnique: jest.fn().mockResolvedValue({
            id: "t-1",
            status: "AWARDED",
            submittedAt: new Date(),
            ratesSnapshotAt: new Date(),
            wonAt: null,
            lostAt: null,
            tenderScoreCounted: true
          }),
          update: jest.fn().mockResolvedValue({
            id: "t-1",
            tenderNumber: "T260612-ACME-Rev1",
            title: "x",
            estimatedValue: null,
            tenderClients: []
          })
        },
        project: { findFirst: jest.fn().mockResolvedValue(null) }
      } as never,
      { write: jest.fn().mockResolvedValue(undefined) } as never,
      { sendNotificationEmail: jest.fn() } as never,
      { ensureTenderFolderStructure: jest.fn().mockResolvedValue(undefined) } as never,
      tenderNumberServiceMock() as never,
      { recordTenderOutcome: jest.fn().mockResolvedValue(undefined) } as never,
      projects as never,
      contracts as never,
      { recordOutcome: jest.fn().mockResolvedValue({ id: "o-1", supersedesId: null }), normalizeOutcome: jest.fn((v) => v ?? {}) } as never
    );

    await service.updateStatus("t-1", "CONTRACT_ISSUED", "user-1");

    expect(projects.convertFromTender).toHaveBeenCalledWith(
      "t-1",
      expect.objectContaining({ userId: "user-1" })
    );
    expect(contracts.createFromTender).toHaveBeenCalledWith("t-1", "user-1");
  });

  it("swallows contract auto-create failures and records a warning audit entry", async () => {
    const contracts = { createFromTender: jest.fn().mockRejectedValue(new Error("boom")) };
    const audit = { write: jest.fn().mockResolvedValue(undefined) };
    const service = new TenderingService(
      {
        tender: {
          findUnique: jest.fn().mockResolvedValue({
            id: "t-1",
            status: "AWARDED",
            submittedAt: new Date(),
            ratesSnapshotAt: new Date(),
            wonAt: null,
            lostAt: null,
            tenderScoreCounted: true
          }),
          update: jest.fn().mockResolvedValue({
            id: "t-1",
            tenderNumber: "T260612-ACME-Rev1",
            title: "x",
            estimatedValue: null,
            tenderClients: []
          })
        },
        project: { findFirst: jest.fn().mockResolvedValue({ id: "project-1" }) }
      } as never,
      audit as never,
      { sendNotificationEmail: jest.fn() } as never,
      { ensureTenderFolderStructure: jest.fn().mockResolvedValue(undefined) } as never,
      tenderNumberServiceMock() as never,
      { recordTenderOutcome: jest.fn().mockResolvedValue(undefined) } as never,
      { convertFromTender: jest.fn().mockResolvedValue(undefined) } as never,
      contracts as never,
      { recordOutcome: jest.fn().mockResolvedValue({ id: "o-1", supersedesId: null }), normalizeOutcome: jest.fn((v) => v ?? {}) } as never
    );

    const result = await service.updateStatus("t-1", "CONTRACT_ISSUED", "user-1");

    expect(result).toMatchObject({ contractAutoCreateWarning: "boom" });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "tenders.contract-autocreate.failed" })
    );
  });

  it("requires due dates for follow-up style unified activities", async () => {
    const service = new TenderingService(
      {} as never,
      { write: jest.fn() } as never,
      { sendNotificationEmail: jest.fn() } as never,
      { ensureTenderFolderStructure: jest.fn().mockResolvedValue(undefined) } as never,
      tenderNumberServiceMock() as never,
      { recordTenderOutcome: jest.fn().mockResolvedValue(undefined) } as never,
      { convertFromTender: jest.fn().mockResolvedValue(undefined) } as never,
      { createFromTender: jest.fn().mockResolvedValue(undefined) } as never,
      { recordOutcome: jest.fn().mockResolvedValue({ id: "o-1", supersedesId: null }), normalizeOutcome: jest.fn((v) => v ?? {}) } as never
    );

    await expect(
      service.addActivity(
        "tender-1",
        {
          activityType: "CALL",
          title: "Call estimator"
        },
        "user-1"
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // WL-1a — capture is prompted at close but SKIPPABLE (Marco 2026-08-10).
  // Closing a tender with NO outcome payload must return normally and must
  // NOT create an outcome row and must NOT throw. This is the headline
  // behaviour of the slice.
  it("closing to LOST with no outcome payload succeeds and creates no outcome row", async () => {
    const outcomeCapture = {
      recordOutcome: jest.fn().mockResolvedValue({ id: "o-1", supersedesId: null }),
      normalizeOutcome: jest.fn((v) => v ?? {})
    };
    const service = new TenderingService(
      {
        tender: {
          findUnique: jest.fn().mockResolvedValue({
            id: "t-1",
            status: "SUBMITTED",
            submittedAt: new Date(),
            ratesSnapshotAt: new Date(),
            wonAt: null,
            lostAt: null,
            tenderScoreCounted: true
          }),
          update: jest.fn().mockResolvedValue({
            id: "t-1",
            tenderNumber: "T260612-ACME-Rev1",
            title: "x",
            estimatedValue: null,
            tenderClients: []
          })
        }
      } as never,
      { write: jest.fn().mockResolvedValue(undefined) } as never,
      { sendNotificationEmail: jest.fn() } as never,
      { ensureTenderFolderStructure: jest.fn().mockResolvedValue(undefined) } as never,
      tenderNumberServiceMock() as never,
      { recordTenderOutcome: jest.fn().mockResolvedValue(undefined) } as never,
      { convertFromTender: jest.fn().mockResolvedValue(undefined) } as never,
      { createFromTender: jest.fn().mockResolvedValue(undefined) } as never,
      outcomeCapture as never
    );

    await expect(service.updateStatus("t-1", "LOST", "user-1")).resolves.toBeDefined();

    expect(outcomeCapture.recordOutcome).not.toHaveBeenCalled();
  });

  it("closing with a valid outcome payload appends exactly one outcome row with the sent fields", async () => {
    const outcomeCapture = {
      recordOutcome: jest.fn().mockResolvedValue({ id: "o-new", supersedesId: null }),
      normalizeOutcome: jest.fn((v) => v ?? {})
    };
    const service = new TenderingService(
      {
        tender: {
          findUnique: jest.fn().mockResolvedValue({
            id: "t-1",
            status: "SUBMITTED",
            submittedAt: new Date(),
            ratesSnapshotAt: new Date(),
            wonAt: null,
            lostAt: null,
            tenderScoreCounted: true
          }),
          update: jest.fn().mockResolvedValue({
            id: "t-1",
            tenderNumber: "T260612-ACME-Rev1",
            title: "x",
            estimatedValue: null,
            tenderClients: []
          })
        }
      } as never,
      { write: jest.fn().mockResolvedValue(undefined) } as never,
      { sendNotificationEmail: jest.fn() } as never,
      { ensureTenderFolderStructure: jest.fn().mockResolvedValue(undefined) } as never,
      tenderNumberServiceMock() as never,
      { recordTenderOutcome: jest.fn().mockResolvedValue(undefined) } as never,
      { convertFromTender: jest.fn().mockResolvedValue(undefined) } as never,
      { createFromTender: jest.fn().mockResolvedValue(undefined) } as never,
      outcomeCapture as never
    );

    const outcome = {
      resultType: "LOST" as const,
      reason: "PRICE_TOO_HIGH" as const,
      tenderValue: "125000.00",
      ourPrice: "132500.00",
      clientId: "client-1",
      scopeSummary: "Two floors of demo",
      competitorOrWinner: "Rival Ltd"
    };

    await service.updateStatus("t-1", "LOST", "user-1", outcome);

    expect(outcomeCapture.recordOutcome).toHaveBeenCalledTimes(1);
    expect(outcomeCapture.recordOutcome).toHaveBeenCalledWith(
      expect.anything(),
      "t-1",
      outcome,
      "user-1"
    );
  });

  it("recordTenderOutcome appends and links supersedesId to the prior outcome on a closed tender", async () => {
    // Simulate an already-closed tender with one existing outcome, then a
    // backfill call. The service delegates to the capture service inside a
    // transaction; the capture service is where the supersedesId link is
    // formed. The unit-level assertion here is that the newly created row
    // returned by capture carries a supersedesId pointing at the prior row
    // and that no prior outcome was updated or deleted.
    const priorOutcomeId = "outcome-prior";
    const outcomeCapture = {
      recordOutcome: jest
        .fn()
        .mockResolvedValue({ id: "outcome-new", supersedesId: priorOutcomeId, resultType: "LOST", reason: "OTHER" }),
      normalizeOutcome: jest.fn((v) => v ?? {})
    };
    const tenderOutcome = {
      deleteMany: jest.fn(),
      update: jest.fn()
    };
    const service = new TenderingService(
      {
        tender: { findUnique: jest.fn().mockResolvedValue({ id: "t-1" }) },
        tenderOutcome,
        $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
          cb({ tenderOutcome })
        )
      } as never,
      { write: jest.fn().mockResolvedValue(undefined) } as never,
      { sendNotificationEmail: jest.fn() } as never,
      { ensureTenderFolderStructure: jest.fn().mockResolvedValue(undefined) } as never,
      tenderNumberServiceMock() as never,
      { recordTenderOutcome: jest.fn().mockResolvedValue(undefined) } as never,
      { convertFromTender: jest.fn().mockResolvedValue(undefined) } as never,
      { createFromTender: jest.fn().mockResolvedValue(undefined) } as never,
      outcomeCapture as never
    );

    const result = await service.recordTenderOutcome(
      "t-1",
      { resultType: "LOST" as const, reason: "OTHER" as const },
      "user-1"
    );

    expect(result).toMatchObject({ id: "outcome-new", supersedesId: priorOutcomeId });
    expect(outcomeCapture.recordOutcome).toHaveBeenCalledTimes(1);
    // Prior row is untouched — no update, no delete on the outcomes table
    // from the tender service side.
    expect(tenderOutcome.deleteMany).not.toHaveBeenCalled();
    expect(tenderOutcome.update).not.toHaveBeenCalled();
  });
});

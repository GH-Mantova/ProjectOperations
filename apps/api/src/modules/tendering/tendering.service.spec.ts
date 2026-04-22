import { BadRequestException } from "@nestjs/common";
import { TenderingService } from "./tendering.service";

describe("TenderingService", () => {
  it("rejects more than one awarded tender client", async () => {
    const service = new TenderingService(
      {
        tender: { findFirst: jest.fn(), create: jest.fn() }
      } as never,
      { write: jest.fn() } as never,
      { sendNotificationEmail: jest.fn() } as never
    );

    await expect(
      service.create(
        {
          tenderNumber: "T-001",
          title: "Test tender",
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
      { sendNotificationEmail: jest.fn() } as never
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
      { sendNotificationEmail: jest.fn() } as never
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
      { sendNotificationEmail: jest.fn() } as never
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

  it("requires due dates for follow-up style unified activities", async () => {
    const service = new TenderingService(
      {} as never,
      { write: jest.fn() } as never,
      { sendNotificationEmail: jest.fn() } as never
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
});

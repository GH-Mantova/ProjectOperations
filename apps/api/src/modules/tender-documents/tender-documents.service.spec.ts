import { TenderDocumentsService } from "./tender-documents.service";

describe("TenderDocumentsService", () => {
  it("creates a tender document link against the SharePoint foundation", async () => {
    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1", tenderNumber: "TEN-1", title: "Tender A" }) },
      sharePointFileLink: { create: jest.fn().mockResolvedValue({ id: "file-1" }) },
      tenderDocumentLink: { create: jest.fn().mockResolvedValue({ id: "doc-1" }), findMany: jest.fn() },
      documentLink: { create: jest.fn().mockResolvedValue({ id: "link-1" }) }
    };

    const service = new TenderDocumentsService(
      prisma as never,
      { write: jest.fn().mockResolvedValue(undefined) } as never,
      { ensureFolder: jest.fn().mockResolvedValue({ id: "folder-1", siteId: "site", driveId: "drive", relativePath: "Project Operations/Tendering/TEN-1_tender-a" }) } as never
    );

    const result = await service.create(
      "tender-1",
      {
        category: "Pricing",
        title: "Submission PDF",
        fileName: "submission.pdf"
      },
      "user-1"
    );

    expect(result.id).toBe("doc-1");
  });
});

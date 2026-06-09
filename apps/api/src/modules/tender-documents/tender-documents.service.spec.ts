import { TenderDocumentsService } from "./tender-documents.service";

describe("TenderDocumentsService", () => {
  it("creates a tender document link routed into the category subfolder", async () => {
    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1", tenderNumber: "TEN-1", title: "Tender A" }) },
      sharePointFileLink: { create: jest.fn().mockResolvedValue({ id: "file-1" }) },
      tenderDocumentLink: { create: jest.fn().mockResolvedValue({ id: "doc-1" }), findMany: jest.fn() },
      documentLink: { create: jest.fn().mockResolvedValue({ id: "link-1" }) }
    };

    const ensureCategory = jest.fn().mockResolvedValue({
      id: "folder-drawings",
      siteId: "site",
      driveId: "drive",
      relativePath: "Project Operations/Tenders/TEN-1/Drawings"
    });

    const service = new TenderDocumentsService(
      prisma as never,
      { write: jest.fn().mockResolvedValue(undefined) } as never,
      { ensureTenderCategoryFolder: ensureCategory } as never
    );

    const result = await service.create(
      "tender-1",
      {
        category: "Drawings",
        title: "Site plan",
        fileName: "site-plan.pdf"
      },
      "user-1"
    );

    expect(result.id).toBe("doc-1");
    expect(ensureCategory).toHaveBeenCalledWith(
      { id: "tender-1", tenderNumber: "TEN-1" },
      "Drawings",
      "user-1"
    );
    // Persisted category matches what the DTO sent — no silent rewrite.
    expect(prisma.tenderDocumentLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ category: "Drawings" })
      })
    );
  });
});

// Mock-based unit tests for TenderDocumentsService. Mirrors the house
// pattern from apps/api/src/modules/jobs/__tests__/jobs.service.spec.ts:
// Prisma is a plain object of jest.fn()s built per-test, $transaction
// invokes the callback with the same prisma object, and the service is
// instantiated directly with `as never` casts on the injected deps.
//
// Covers all three public methods (list / create / remove), the
// SharePoint adapter interactions (ensureTenderCategoryFolder +
// uploadFile), and the canonical category list helpers in
// tender-document-categories.ts. Category validation itself lives on
// CreateTenderDocumentDto via @IsIn(DOCUMENT_CATEGORIES) — the service
// trusts the DTO — so the helper tests below pin the canonical list the
// DTO validates against.

import { NotFoundException } from "@nestjs/common";
import {
  DOCUMENT_CATEGORIES,
  isDocumentCategory,
  normaliseDocumentCategory,
  resolveUploadPath,
  TENDER_FOLDER_STRUCTURE
} from "./tender-document-categories";
import { TenderDocumentsService } from "./tender-documents.service";

// ─── Shared fixtures ───────────────────────────────────────────────────────

const tenderRow = (overrides: Record<string, unknown> = {}) => ({
  id: "tender-1",
  tenderNumber: "TEN-1",
  title: "Tender A",
  ...overrides
});

const folderRow = (overrides: Record<string, unknown> = {}) => ({
  id: "folder-drawings",
  itemId: "folder-item-1",
  siteId: "site",
  driveId: "drive",
  relativePath: "Project Operations/Tenders/TEN-1/Drawings",
  ...overrides
});

const documentRow = (overrides: Record<string, unknown> = {}) => ({
  id: "doc-1",
  tenderId: "tender-1",
  category: "Drawings",
  title: "Site plan",
  fileLinkId: "file-1",
  fileLink: { id: "file-1" },
  ...overrides
});

// Per-test mock builder. Tests override individual mock methods on the
// returned `prisma` / `sharepoint` objects before driving the service.
function buildService(extraPrisma: Record<string, unknown> = {}) {
  const auditWrite = jest.fn().mockResolvedValue(undefined);

  const prisma: Record<string, unknown> = {
    tender: {
      findUnique: jest.fn().mockResolvedValue(tenderRow())
    },
    tenderDocumentLink: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(documentRow()),
      create: jest.fn().mockResolvedValue(documentRow()),
      delete: jest.fn().mockResolvedValue({})
    },
    sharePointFileLink: {
      create: jest.fn().mockResolvedValue({ id: "file-1" }),
      delete: jest.fn().mockResolvedValue({})
    },
    documentLink: {
      create: jest.fn().mockResolvedValue({ id: "link-1" }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 })
    },
    $transaction: jest.fn().mockImplementation((input: unknown) => {
      if (typeof input === "function") {
        return (input as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(input as Array<Promise<unknown>>);
    }),
    ...extraPrisma
  };

  const audit = { write: auditWrite };
  const sharepoint = {
    ensureTenderCategoryFolder: jest.fn().mockResolvedValue(folderRow()),
    ensureTenderQuoteClientFolder: jest.fn().mockResolvedValue({
      folderId: "client-folder-item",
      folderPath: "Project Operations/Tenders/TEN-1/Quotes/Client A",
      record: folderRow({ id: "folder-quotes-client", relativePath: "Project Operations/Tenders/TEN-1/Quotes/Client A" })
    }),
    uploadFile: jest.fn().mockResolvedValue({
      id: "graph-item-1",
      webUrl: "https://graph.sharepoint.com/drawings/site-plan.pdf",
      eTag: "etag-1"
    })
  };

  const service = new TenderDocumentsService(
    prisma as never,
    audit as never,
    sharepoint as never
  );

  return { service, prisma, audit, auditWrite, sharepoint };
}

// ─── list ──────────────────────────────────────────────────────────────────

describe("TenderDocumentsService.list", () => {
  it("scopes the query to the tenderId and includes folder/file links, newest first", async () => {
    const rows = [documentRow()];
    const { service, prisma } = buildService();
    (prisma.tenderDocumentLink as { findMany: jest.Mock }).findMany.mockResolvedValueOnce(rows);

    const result = await service.list("tender-1");

    expect(result).toBe(rows);
    expect((prisma.tenderDocumentLink as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith({
      where: { tenderId: "tender-1" },
      include: {
        folderLink: true,
        fileLink: true
      },
      orderBy: { createdAt: "desc" }
    });
  });
});

// ─── create ────────────────────────────────────────────────────────────────

describe("TenderDocumentsService.create", () => {
  it("creates a tender document link routed into the category subfolder", async () => {
    const { service, prisma, sharepoint } = buildService();

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
    // TFM-S4: "Drawings" resolves to the nested path "1. Plans, Scopes & Specs/01. Drawings"
    // via resolveUploadPath before being passed to ensureTenderCategoryFolder.
    expect(sharepoint.ensureTenderCategoryFolder).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tender-1", tenderNumber: "TEN-1" }),
      "1. Plans, Scopes & Specs/01. Drawings",
      "user-1"
    );
    // Persisted category matches what the DTO sent — no silent rewrite.
    expect((prisma.tenderDocumentLink as { create: jest.Mock }).create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenderId: "tender-1",
          category: "Drawings",
          title: "Site plan",
          folderLinkId: "folder-drawings",
          fileLinkId: "file-1"
        }),
        include: { folderLink: true, fileLink: true }
      })
    );
  });

  it("throws NotFoundException (and skips SharePoint) when the tender does not exist", async () => {
    const { service, prisma, sharepoint } = buildService();
    (prisma.tender as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);

    await expect(
      service.create(
        "missing",
        { category: "Drawings", title: "x", fileName: "x.pdf" },
        "user-1"
      )
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(sharepoint.ensureTenderCategoryFolder).not.toHaveBeenCalled();
    expect((prisma.sharePointFileLink as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });

  it("metadata-only path: skips uploadFile and persists a mock file link with defaulted mimeType", async () => {
    const { service, prisma, sharepoint } = buildService();

    await service.create(
      "tender-1",
      { category: "Drawings", title: "Site plan", fileName: "site-plan.pdf" },
      "user-1"
    );

    expect(sharepoint.uploadFile).not.toHaveBeenCalled();
    const fileLinkArgs = (prisma.sharePointFileLink as { create: jest.Mock }).create.mock
      .calls[0]?.[0] as { data: Record<string, unknown> };
    expect(fileLinkArgs.data).toMatchObject({
      folderLinkId: "folder-drawings",
      siteId: "site",
      driveId: "drive",
      name: "site-plan.pdf",
      relativePath: "Project Operations/Tenders/TEN-1/Drawings/site-plan.pdf",
      webUrl: "https://sharepoint.local/Project Operations/Tenders/TEN-1/Drawings/site-plan.pdf",
      mimeType: "application/octet-stream",
      sizeBytes: null,
      linkedEntityType: "Tender",
      linkedEntityId: "tender-1",
      metadata: { uploadMode: "mock", eTag: null }
    });
    // Unique per-request id so two fast metadata-only requests can't
    // collide on the SharePointFileLink unique index.
    expect(fileLinkArgs.data.itemId).toMatch(/^mock-file-\d+-[0-9a-f]{8}$/);
  });

  it("file path: uploads via the SharePoint adapter and persists the graph item details", async () => {
    const { service, prisma, sharepoint } = buildService();
    const buffer = Buffer.from("pdf-bytes");
    const file = {
      originalname: "uploaded-plan.pdf",
      mimetype: "application/pdf",
      size: 9,
      buffer
    };

    await service.create(
      "tender-1",
      { category: "Drawings", title: "Site plan", fileName: "ignored-when-file-present.pdf" },
      "user-1",
      file as never
    );

    expect(sharepoint.uploadFile).toHaveBeenCalledWith({
      folderId: "folder-item-1",
      siteId: "site",
      driveId: "drive",
      name: "uploaded-plan.pdf",
      content: buffer,
      mimeType: "application/pdf"
    });
    const fileLinkArgs = (prisma.sharePointFileLink as { create: jest.Mock }).create.mock
      .calls[0]?.[0] as { data: Record<string, unknown> };
    expect(fileLinkArgs.data).toMatchObject({
      itemId: "graph-item-1",
      name: "uploaded-plan.pdf",
      webUrl: "https://graph.sharepoint.com/drawings/site-plan.pdf",
      mimeType: "application/pdf",
      sizeBytes: 9,
      metadata: { uploadMode: "graph", eTag: "etag-1" }
    });
  });

  it("mirrors the document into the cross-module documentLink registry", async () => {
    const { service, prisma } = buildService();

    await service.create(
      "tender-1",
      { category: "Specifications", title: "Spec pack", description: "Rev B", fileName: "spec.pdf" },
      "user-1"
    );

    expect((prisma.documentLink as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: {
        linkedEntityType: "Tender",
        linkedEntityId: "tender-1",
        module: "tendering",
        category: "Specifications",
        title: "Spec pack",
        description: "Rev B",
        folderLinkId: "folder-drawings",
        fileLinkId: "file-1"
      }
    });
  });

  it("writes a tenderdocuments.create audit entry with tender/category metadata", async () => {
    const { service, auditWrite } = buildService();

    await service.create(
      "tender-1",
      { category: "Drawings", title: "Site plan", fileName: "site-plan.pdf" },
      "user-1"
    );

    expect(auditWrite).toHaveBeenCalledWith({
      actorId: "user-1",
      action: "tenderdocuments.create",
      entityType: "TenderDocumentLink",
      entityId: "doc-1",
      metadata: {
        tenderId: "tender-1",
        category: "Drawings",
        fileName: "site-plan.pdf"
      }
    });
  });
});

// ─── remove ────────────────────────────────────────────────────────────────

describe("TenderDocumentsService.remove", () => {
  it("deletes the link, the mirrored documentLink rows, and the file link in a transaction", async () => {
    const { service, prisma, auditWrite } = buildService();

    const result = await service.remove("tender-1", "doc-1", "user-1");

    expect(result).toEqual({ id: "doc-1" });
    expect((prisma.$transaction as jest.Mock)).toHaveBeenCalledTimes(1);
    expect((prisma.tenderDocumentLink as { delete: jest.Mock }).delete).toHaveBeenCalledWith({
      where: { id: "doc-1" }
    });
    expect((prisma.documentLink as { deleteMany: jest.Mock }).deleteMany).toHaveBeenCalledWith({
      where: {
        fileLinkId: "file-1",
        linkedEntityType: "Tender",
        linkedEntityId: "tender-1"
      }
    });
    expect((prisma.sharePointFileLink as { delete: jest.Mock }).delete).toHaveBeenCalledWith({
      where: { id: "file-1" }
    });
    expect(auditWrite).toHaveBeenCalledWith({
      actorId: "user-1",
      action: "tenderdocuments.delete",
      entityType: "TenderDocumentLink",
      entityId: "doc-1",
      metadata: { tenderId: "tender-1", title: "Site plan" }
    });
  });

  it("skips documentLink/file cleanup for metadata-only links without a fileLinkId", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderDocumentLink as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      documentRow({ fileLinkId: null, fileLink: null })
    );

    await service.remove("tender-1", "doc-1", "user-1");

    expect((prisma.tenderDocumentLink as { delete: jest.Mock }).delete).toHaveBeenCalled();
    expect((prisma.documentLink as { deleteMany: jest.Mock }).deleteMany).not.toHaveBeenCalled();
    expect((prisma.sharePointFileLink as { delete: jest.Mock }).delete).not.toHaveBeenCalled();
  });

  it("swallows a failed sharePointFileLink delete (already-gone file is not an error)", async () => {
    const { service, prisma } = buildService();
    (prisma.sharePointFileLink as { delete: jest.Mock }).delete.mockRejectedValueOnce(
      new Error("P2025: record not found")
    );

    await expect(service.remove("tender-1", "doc-1", "user-1")).resolves.toEqual({ id: "doc-1" });
  });

  it("throws NotFoundException when the document does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderDocumentLink as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);

    await expect(service.remove("tender-1", "missing", "user-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect((prisma.tenderDocumentLink as { delete: jest.Mock }).delete).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when the document belongs to a different tender (scoped delete)", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderDocumentLink as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(
      documentRow({ tenderId: "other-tender" })
    );

    await expect(service.remove("tender-1", "doc-1", "user-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect((prisma.$transaction as jest.Mock)).not.toHaveBeenCalled();
  });
});

// ─── TFM-S4: upload path routing ──────────────────────────────────────────

describe("TenderDocumentsService.create (TFM-S4 routing)", () => {
  it("legacy category 'Drawings' routes to '1. Plans, Scopes & Specs/01. Drawings' via resolveUploadPath", async () => {
    const { service, sharepoint } = buildService();

    await service.create(
      "tender-1",
      { category: "Drawings", title: "Plan", fileName: "plan.pdf" },
      "user-1"
    );

    // resolveUploadPath maps "Drawings" -> "1. Plans, Scopes & Specs/01. Drawings"
    expect(sharepoint.ensureTenderCategoryFolder).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tender-1" }),
      "1. Plans, Scopes & Specs/01. Drawings",
      "user-1"
    );
  });

  it("Quotes/{Client} path routes through ensureTenderQuoteClientFolder", async () => {
    const { service, sharepoint } = buildService();

    // Cast needed: the DTO type is the legacy DocumentCategory union; at
    // runtime the API accepts any string and routes via resolveUploadPath.
    await service.create(
      "tender-1",
      { category: "Quotes/Client A" as never, title: "Quote", fileName: "quote.pdf" },
      "user-1"
    );

    expect(sharepoint.ensureTenderQuoteClientFolder).toHaveBeenCalledWith(
      "tender-1",
      "Client A",
      "user-1"
    );
    expect(sharepoint.ensureTenderCategoryFolder).not.toHaveBeenCalled();
  });

  it("unknown legacy value falls through to '7. Other'", async () => {
    const { service, sharepoint } = buildService();

    await service.create(
      "tender-1",
      { category: "some-random-value" as never, title: "Doc", fileName: "doc.pdf" },
      "user-1"
    );

    expect(sharepoint.ensureTenderCategoryFolder).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tender-1" }),
      "7. Other",
      "user-1"
    );
  });
});

// ─── TFM-S4: resolveUploadPath helper ─────────────────────────────────────

describe("resolveUploadPath (TFM-S4)", () => {
  it("maps legacy 'Drawings' to nested path", () => {
    expect(resolveUploadPath("Drawings")).toBe("1. Plans, Scopes & Specs/01. Drawings");
  });

  it("passes through paths already in TENDER_FOLDER_STRUCTURE", () => {
    expect(resolveUploadPath("7. Other")).toBe("7. Other");
    expect(resolveUploadPath("2. Photos")).toBe("2. Photos");
    expect(resolveUploadPath("1. Plans, Scopes & Specs/01. Drawings")).toBe(
      "1. Plans, Scopes & Specs/01. Drawings"
    );
  });

  it("passes through Quotes/{Client} paths unchanged", () => {
    expect(resolveUploadPath("Quotes/Acme Corp")).toBe("Quotes/Acme Corp");
  });

  it("falls back to '7. Other' for null, undefined, and unknown values", () => {
    expect(resolveUploadPath(null)).toBe("7. Other");
    expect(resolveUploadPath(undefined)).toBe("7. Other");
    expect(resolveUploadPath("not-a-category")).toBe("7. Other");
  });

  it("TENDER_FOLDER_STRUCTURE contains the expected top-level paths including Quotes sentinel", () => {
    const topPaths = TENDER_FOLDER_STRUCTURE.map((n) => n.path);
    expect(topPaths).toContain("1. Plans, Scopes & Specs");
    expect(topPaths).toContain("7. Other");
    expect(topPaths).toContain("Quotes");
  });
});

// ─── Category helpers (the list the DTO @IsIn validates against) ──────────

describe("tender-document-categories", () => {
  it("pins the canonical 11-category list the DTO and SharePoint folders rely on", () => {
    expect(DOCUMENT_CATEGORIES).toHaveLength(11);
    expect(DOCUMENT_CATEGORIES[0]).toBe("Tender Documents");
    expect(DOCUMENT_CATEGORIES).toContain("Drawings");
    expect(DOCUMENT_CATEGORIES).toContain("Compliance & WHS");
    expect(DOCUMENT_CATEGORIES[DOCUMENT_CATEGORIES.length - 1]).toBe("Other");
  });

  it("isDocumentCategory accepts canonical values and rejects free-form ones", () => {
    expect(isDocumentCategory("Drawings")).toBe(true);
    expect(isDocumentCategory("drawings")).toBe(false);
    expect(isDocumentCategory("Random")).toBe(false);
  });

  it("normaliseDocumentCategory maps legacy aliases, passes canonical values through, and falls back to Other", () => {
    expect(normaliseDocumentCategory("tender")).toBe("Tender Documents");
    expect(normaliseDocumentCategory("SWMS")).toBe("Compliance & WHS");
    expect(normaliseDocumentCategory("boq")).toBe("Bill of Quantities");
    expect(normaliseDocumentCategory("Drawings")).toBe("Drawings");
    expect(normaliseDocumentCategory("not-a-category")).toBe("Other");
    expect(normaliseDocumentCategory(null)).toBe("Other");
    expect(normaliseDocumentCategory(undefined)).toBe("Other");
  });
});

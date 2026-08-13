/**
 * MIG-3 — Unit tests for SharepointLegacyCopyService.
 *
 * All Graph seam calls are mocked via ISharePointCopySeam.
 * No real folder names, file names, or client data (D9).
 *
 * Covers:
 *   - plan() returns match candidates, unmatchedTenders, unmatchedLegacyFolders
 *   - plan() — tender without T#### in title is silently ignored (no crash)
 *   - plan() — tender with T#### but no SharePointFolderLink → noDestination
 *   - execute() — happy path: N legacy files → N copy calls
 *   - execute() — idempotency: existing dest file (same name+size) is skipped
 *   - execute() — tender with no destination surfaced under noDestinationCount
 */

import { Test, TestingModule } from "@nestjs/testing";
import {
  SharepointLegacyCopyService,
  SHAREPOINT_COPY_SEAM,
  SeamExtensionRequiredError,
  extractTNumber,
  type ISharePointCopySeam,
  type FolderChildItem,
} from "./sharepoint-legacy-copy.service";
import { PrismaService } from "../../prisma/prisma.service";

// ---------------------------------------------------------------------------
// Synthetic config
// ---------------------------------------------------------------------------

const SYNTHETIC_CONFIG = {
  mode: "mock",
  siteId: "synthetic-site-id",
  driveId: "synthetic-drive-id",
  tendersRoot: "Synthetic Tenders",
};

// ---------------------------------------------------------------------------
// Synthetic data
// ---------------------------------------------------------------------------

const TENDER_WITH_MATCH = {
  id: "tender-t1001",
  title: "T1001 — Synthetic Bridge Project",
  tenderNumber: "T1001",
};

const TENDER_NO_T_NUMBER = {
  id: "tender-no-t",
  title: "Some project without a T number",
  tenderNumber: "T0000",
};

const TENDER_NO_DESTINATION = {
  id: "tender-t1002",
  title: "T1002 — Synthetic Road Project",
  tenderNumber: "T1002",
};

const TENDER_ANOTHER_MATCH = {
  id: "tender-t1003",
  title: "T1003 — Synthetic Dam Project",
  tenderNumber: "T1003",
};

const FOLDER_LINK_T1001 = {
  linkedEntityId: "tender-t1001",
  itemId: "dest-folder-item-t1001",
  relativePath: "Synthetic Tenders/T1001",
  siteId: "synthetic-site-id",
  driveId: "synthetic-drive-id",
};

const FOLDER_LINK_T1003 = {
  linkedEntityId: "tender-t1003",
  itemId: "dest-folder-item-t1003",
  relativePath: "Synthetic Tenders/T1003",
  siteId: "synthetic-site-id",
  driveId: "synthetic-drive-id",
};

const LEGACY_FILE_A: FolderChildItem = {
  name: "synthetic-spec-a.pdf",
  fileId: "legacy-file-id-a",
  size: 1024,
  eTag: "etag-a",
};

const LEGACY_FILE_B: FolderChildItem = {
  name: "synthetic-drawing-b.dwg",
  fileId: "legacy-file-id-b",
  size: 2048,
};

// ---------------------------------------------------------------------------
// Prisma mock factory
// ---------------------------------------------------------------------------

function makePrismaMock(
  tenders: Array<{ id: string; title: string; tenderNumber: string }>,
  folderLinks: Array<{
    linkedEntityId: string;
    itemId: string;
    relativePath: string;
    siteId: string;
    driveId: string;
  }>
): jest.Mocked<PrismaService> {
  return {
    tender: {
      findMany: jest.fn().mockResolvedValue(
        tenders.map((t) => ({ id: t.id, title: t.title, tenderNumber: t.tenderNumber }))
      ),
    },
    sharePointFolderLink: {
      findMany: jest.fn().mockResolvedValue(folderLinks),
    },
  } as unknown as jest.Mocked<PrismaService>;
}

// ---------------------------------------------------------------------------
// Seam mock factory
// ---------------------------------------------------------------------------

function makeSeamMock(overrides: Partial<ISharePointCopySeam> = {}): jest.Mocked<ISharePointCopySeam> {
  return {
    getResolvedConfig: jest.fn().mockResolvedValue(SYNTHETIC_CONFIG),
    listFolderChildren: jest.fn().mockResolvedValue([]),
    downloadFileBytes: jest.fn().mockResolvedValue(Buffer.from("synthetic-bytes")),
    listDestinationFolderChildren: jest.fn().mockResolvedValue([]),
    uploadFile: jest.fn().mockResolvedValue({
      id: "new-uploaded-id",
      webUrl: "https://sharepoint.local/mock/new-uploaded-id",
      eTag: '"mock-new"',
    }),
    ...overrides,
  } as jest.Mocked<ISharePointCopySeam>;
}

// ---------------------------------------------------------------------------
// Helper: build module
// ---------------------------------------------------------------------------

async function buildModule(
  prismaMock: jest.Mocked<PrismaService>,
  seamMock: jest.Mocked<ISharePointCopySeam>
): Promise<SharepointLegacyCopyService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SharepointLegacyCopyService,
      { provide: PrismaService, useValue: prismaMock },
      { provide: SHAREPOINT_COPY_SEAM, useValue: seamMock },
    ],
  }).compile();

  return module.get(SharepointLegacyCopyService);
}

// ===========================================================================
// extractTNumber unit tests
// ===========================================================================

describe("extractTNumber", () => {
  it("extracts a 4-digit T-number from a typical title", () => {
    expect(extractTNumber("T1001 — Synthetic Bridge Project")).toBe("T1001");
  });

  it("extracts a 3-digit T-number", () => {
    expect(extractTNumber("T123 — Short Project")).toBe("T123");
  });

  it("extracts a 5-digit T-number", () => {
    expect(extractTNumber("T12345 — Long Project")).toBe("T12345");
  });

  it("returns null when no T-number is present", () => {
    expect(extractTNumber("Some project without a T number")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractTNumber("")).toBeNull();
  });
});

// ===========================================================================
// SharepointLegacyCopyService — plan()
// ===========================================================================

describe("SharepointLegacyCopyService.plan()", () => {
  it("returns match candidates and unmatchedTenders, zero writes to seam", async () => {
    // T1001 has folder link → should match
    // T1002 has no folder link → noDestination
    // T1003 has folder link but listFolderChildren returns [] initially
    // no-T-number tender → silently ignored

    const seam = makeSeamMock({
      listFolderChildren: jest
        .fn()
        .mockImplementation(({ relativePath }: { relativePath: string }) => {
          if (relativePath.includes("T1001")) return Promise.resolve([LEGACY_FILE_A, LEGACY_FILE_B]);
          // T1002 has no folder link so listFolderChildren won't be called
          // T1003 folder does not exist (404-like)
          return Promise.reject(new Error("itemNotFound: folder not found"));
        }),
    });

    const prisma = makePrismaMock(
      [TENDER_WITH_MATCH, TENDER_NO_T_NUMBER, TENDER_NO_DESTINATION, TENDER_ANOTHER_MATCH],
      [FOLDER_LINK_T1001, FOLDER_LINK_T1003]
    );

    const svc = await buildModule(prisma, seam);
    const plan = await svc.plan();

    // T1001 matched
    expect(plan.matched).toHaveLength(1);
    expect(plan.matched[0].tNumber).toBe("T1001");
    expect(plan.matched[0].legacyFileCount).toBe(2);

    // T1003 had a link but folder returned 404 → unmatched
    expect(plan.unmatchedTenders).toHaveLength(1);
    expect(plan.unmatchedTenders[0].tNumber).toBe("T1003");

    // T1002 has no link → noDestination
    expect(plan.noDestination).toHaveLength(1);
    expect(plan.noDestination[0].tNumber).toBe("T1002");

    // No-T-number tender counted silently
    expect(plan.noTNumberCount).toBe(1);

    // plan() must NOT call uploadFile or downloadFileBytes
    expect(seam.uploadFile).not.toHaveBeenCalled();
    expect(seam.downloadFileBytes).not.toHaveBeenCalled();
  });

  it("tender without T#### in title is silently ignored — does not crash", async () => {
    const seam = makeSeamMock();
    const prisma = makePrismaMock([TENDER_NO_T_NUMBER], []);

    const svc = await buildModule(prisma, seam);
    const plan = await svc.plan();

    expect(plan.noTNumberCount).toBe(1);
    expect(plan.matched).toHaveLength(0);
    expect(plan.unmatchedTenders).toHaveLength(0);
    expect(plan.noDestination).toHaveLength(0);
  });

  it("re-throws SeamExtensionRequiredError from listFolderChildren", async () => {
    const seam = makeSeamMock({
      listFolderChildren: jest.fn().mockRejectedValue(
        new SeamExtensionRequiredError("listFolderChildren")
      ),
    });

    const prisma = makePrismaMock([TENDER_WITH_MATCH], [FOLDER_LINK_T1001]);
    const svc = await buildModule(prisma, seam);

    await expect(svc.plan()).rejects.toBeInstanceOf(SeamExtensionRequiredError);
  });
});

// ===========================================================================
// SharepointLegacyCopyService — execute()
// ===========================================================================

describe("SharepointLegacyCopyService.execute()", () => {
  it("happy path: N legacy files → N copy calls (download + upload per file)", async () => {
    const seam = makeSeamMock({
      listFolderChildren: jest.fn().mockResolvedValue([LEGACY_FILE_A, LEGACY_FILE_B]),
      listDestinationFolderChildren: jest.fn().mockResolvedValue([]), // empty dest
    });

    const prisma = makePrismaMock([TENDER_WITH_MATCH], [FOLDER_LINK_T1001]);
    const svc = await buildModule(prisma, seam);
    const report = await svc.execute();

    expect(report.matchesAttempted).toBe(1);
    expect(report.totalCopied).toBe(2);
    expect(report.totalAlreadyPresent).toBe(0);
    expect(report.totalErrors).toBe(0);

    // Each legacy file: one download + one upload
    expect(seam.downloadFileBytes).toHaveBeenCalledTimes(2);
    expect(seam.uploadFile).toHaveBeenCalledTimes(2);

    // Verify file names passed to upload
    const uploadCalls = (seam.uploadFile as jest.Mock).mock.calls.map((c: unknown[]) => (c[0] as { name: string }).name);
    expect(uploadCalls).toContain(LEGACY_FILE_A.name);
    expect(uploadCalls).toContain(LEGACY_FILE_B.name);
  });

  it("idempotency: existing dest file (same name+size) is skipped, not re-uploaded", async () => {
    // Dest already has LEGACY_FILE_A (same name+size)
    const seam = makeSeamMock({
      listFolderChildren: jest.fn().mockResolvedValue([LEGACY_FILE_A, LEGACY_FILE_B]),
      listDestinationFolderChildren: jest
        .fn()
        .mockResolvedValue([
          {
            name: LEGACY_FILE_A.name,
            fileId: "dest-version-of-a",
            size: LEGACY_FILE_A.size,
          },
        ]),
    });

    const prisma = makePrismaMock([TENDER_WITH_MATCH], [FOLDER_LINK_T1001]);
    const svc = await buildModule(prisma, seam);
    const report = await svc.execute();

    expect(report.totalCopied).toBe(1); // only LEGACY_FILE_B
    expect(report.totalAlreadyPresent).toBe(1); // LEGACY_FILE_A skipped
    expect(report.totalErrors).toBe(0);

    expect(seam.downloadFileBytes).toHaveBeenCalledTimes(1);
    expect(seam.uploadFile).toHaveBeenCalledTimes(1);
    const uploadCall = (seam.uploadFile as jest.Mock).mock.calls[0][0] as { name: string };
    expect(uploadCall.name).toBe(LEGACY_FILE_B.name);
  });

  it("tender with no SharePointFolderLink → surfaced under noDestinationCount", async () => {
    const seam = makeSeamMock();
    const prisma = makePrismaMock([TENDER_NO_DESTINATION], []);

    const svc = await buildModule(prisma, seam);
    const report = await svc.execute();

    expect(report.matchesAttempted).toBe(0);
    expect(report.noDestinationCount).toBe(1);
    expect(report.totalCopied).toBe(0);

    // No copy operations at all
    expect(seam.downloadFileBytes).not.toHaveBeenCalled();
    expect(seam.uploadFile).not.toHaveBeenCalled();
  });

  it("all files already present → zero copies, all skipped", async () => {
    const destFiles: FolderChildItem[] = [
      { name: LEGACY_FILE_A.name, fileId: "dest-a", size: LEGACY_FILE_A.size },
      { name: LEGACY_FILE_B.name, fileId: "dest-b", size: LEGACY_FILE_B.size },
    ];

    const seam = makeSeamMock({
      listFolderChildren: jest.fn().mockResolvedValue([LEGACY_FILE_A, LEGACY_FILE_B]),
      listDestinationFolderChildren: jest.fn().mockResolvedValue(destFiles),
    });

    const prisma = makePrismaMock([TENDER_WITH_MATCH], [FOLDER_LINK_T1001]);
    const svc = await buildModule(prisma, seam);
    const report = await svc.execute();

    expect(report.totalCopied).toBe(0);
    expect(report.totalAlreadyPresent).toBe(2);
    expect(seam.uploadFile).not.toHaveBeenCalled();
  });
});

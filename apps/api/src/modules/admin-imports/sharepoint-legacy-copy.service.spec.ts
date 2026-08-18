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
 *
 * TFM-S6 additions:
 *   - listLegacyTenderFolders() — month folder holding three tender folders
 *     returns all three with the correct monthFolder label
 *   - listLegacyTenderFolders() — non-folder file inside a month folder is
 *     skipped without error
 *   - plan() — uses two-level walk; legacy root not found → empty result
 *
 * TFM-S7 additions:
 *   - plan() — folderProvisioningStatus === "failed" → unready, empty wouldCopy
 *   - plan() — destination folder missing per adapter probe → unready
 *   - plan() — successful status + folder exists → ready, wouldCopy populated
 *   - execute() — skips unready tender at run time even if plan called it ready
 */

import { Test, TestingModule } from "@nestjs/testing";
import {
  SharepointLegacyCopyService,
  SHAREPOINT_COPY_SEAM,
  LEGACY_TENDERS_ROOT_PATH,
  SeamExtensionRequiredError,
  extractTNumber,
  type ISharePointCopySeam,
  type FolderChildItem,
  type LegacyFolderItem,
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

const SYNTHETIC_LEGACY_ROOT = "2. Quotes/Quotes 2026";

// ---------------------------------------------------------------------------
// Synthetic data
// ---------------------------------------------------------------------------

const TENDER_WITH_MATCH = {
  id: "tender-t1001",
  title: "T1001 — Synthetic Bridge Project",
  tenderNumber: "T1001",
  folderProvisioningStatus: "ok" as string | null,
  projectName: null as string | null,
};

const TENDER_NO_T_NUMBER = {
  id: "tender-no-t",
  title: "Some project without a T number",
  tenderNumber: "T0000",
  folderProvisioningStatus: null as string | null,
  projectName: null as string | null,
};

const TENDER_NO_DESTINATION = {
  id: "tender-t1002",
  title: "T1002 — Synthetic Road Project",
  tenderNumber: "T1002",
  folderProvisioningStatus: null as string | null,
  projectName: null as string | null,
};

const TENDER_ANOTHER_MATCH = {
  id: "tender-t1003",
  title: "T1003 — Synthetic Dam Project",
  tenderNumber: "T1003",
  folderProvisioningStatus: "ok" as string | null,
  projectName: null as string | null,
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
// Synthetic legacy folder tree items (TFM-S6)
// ---------------------------------------------------------------------------

const MONTH_FOLDER_AUG: LegacyFolderItem = {
  id: "month-aug-item-id",
  name: "8. Aug",
  isFolder: true,
};

const MONTH_FOLDER_SEP: LegacyFolderItem = {
  id: "month-sep-item-id",
  name: "9. Sep",
  isFolder: true,
};

const TENDER_FOLDER_T1001: LegacyFolderItem = {
  id: "legacy-t1001-item-id",
  name: "T1001 - Synthetic Bridge Project",
  isFolder: true,
};

const TENDER_FOLDER_T1002: LegacyFolderItem = {
  id: "legacy-t1002-item-id",
  name: "T1002 - Synthetic Road Project",
  isFolder: true,
};

const TENDER_FOLDER_T1003: LegacyFolderItem = {
  id: "legacy-t1003-item-id",
  name: "T1003 - Synthetic Dam Project",
  isFolder: true,
};

/** A non-folder file that might appear inside a month folder — must be skipped. */
const NON_FOLDER_FILE_IN_MONTH: LegacyFolderItem = {
  id: "stray-file-item-id",
  name: "stray-document.pdf",
  isFolder: false,
};

// ---------------------------------------------------------------------------
// Prisma mock factory
// ---------------------------------------------------------------------------

function makePrismaMock(
  tenders: Array<{
    id: string;
    title: string;
    tenderNumber: string;
    folderProvisioningStatus?: string | null;
    projectName?: string | null;
  }>,
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
        tenders.map((t) => ({
          id: t.id,
          title: t.title,
          tenderNumber: t.tenderNumber,
          folderProvisioningStatus: t.folderProvisioningStatus ?? null,
          projectName: t.projectName ?? null,
        }))
      ),
      // TFM-S7: execute() re-fetches each tender by id to get a fresh status.
      // Default implementation: look up by id from the provided tenders array.
      findUnique: jest.fn().mockImplementation(
        (args: { where: { id: string }; select?: unknown }) => {
          const found = tenders.find((t) => t.id === args.where.id);
          if (!found) return Promise.resolve(null);
          return Promise.resolve({
            id: found.id,
            tenderNumber: found.tenderNumber,
            folderProvisioningStatus: found.folderProvisioningStatus ?? null,
            projectName: found.projectName ?? null,
          });
        }
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
    listFolderItemsById: jest.fn().mockResolvedValue([]),
    resolveItemIdByPath: jest.fn().mockResolvedValue("synthetic-legacy-root-item-id"),
    downloadFileBytes: jest.fn().mockResolvedValue(Buffer.from("synthetic-bytes")),
    listDestinationFolderChildren: jest.fn().mockResolvedValue([]),
    uploadFile: jest.fn().mockResolvedValue({
      id: "new-uploaded-id",
      webUrl: "https://sharepoint.local/mock/new-uploaded-id",
      eTag: '"mock-new"',
    }),
    // TFM-S7: default to true (destination exists) so existing tests pass unchanged.
    folderExists: jest.fn().mockResolvedValue(true),
    ...overrides,
  } as jest.Mocked<ISharePointCopySeam>;
}

// ---------------------------------------------------------------------------
// Helper: build module
// ---------------------------------------------------------------------------

async function buildModule(
  prismaMock: jest.Mocked<PrismaService>,
  seamMock: jest.Mocked<ISharePointCopySeam>,
  legacyRootPath: string = SYNTHETIC_LEGACY_ROOT
): Promise<SharepointLegacyCopyService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SharepointLegacyCopyService,
      { provide: PrismaService, useValue: prismaMock },
      { provide: SHAREPOINT_COPY_SEAM, useValue: seamMock },
      { provide: LEGACY_TENDERS_ROOT_PATH, useValue: legacyRootPath },
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
// SharepointLegacyCopyService — listLegacyTenderFolders() (TFM-S6)
// ===========================================================================

describe("SharepointLegacyCopyService.listLegacyTenderFolders()", () => {
  it("returns all three tender folders with correct monthFolder label when a month folder holds three tender folders", async () => {
    const rootItemId = "synthetic-root-item-id";

    const seam = makeSeamMock({
      resolveItemIdByPath: jest.fn().mockResolvedValue(rootItemId),
      listFolderItemsById: jest
        .fn()
        .mockImplementation((_siteId: string, _driveId: string, itemId: string) => {
          if (itemId === rootItemId) {
            // Root level: one month folder
            return Promise.resolve([MONTH_FOLDER_AUG]);
          }
          if (itemId === MONTH_FOLDER_AUG.id) {
            // August: three tender folders
            return Promise.resolve([
              TENDER_FOLDER_T1001,
              TENDER_FOLDER_T1002,
              TENDER_FOLDER_T1003,
            ]);
          }
          return Promise.resolve([]);
        }),
    });

    const prisma = makePrismaMock([], []);
    const svc = await buildModule(prisma, seam);

    const result = await svc.listLegacyTenderFolders();

    expect(result).toHaveLength(3);

    // All three tender folders should have the August month label
    const monthLabels = result.map((r) => r.monthFolder);
    expect(monthLabels).toEqual(["8. Aug", "8. Aug", "8. Aug"]);

    // Names should match the folder names
    const names = result.map((r) => r.name);
    expect(names).toContain(TENDER_FOLDER_T1001.name);
    expect(names).toContain(TENDER_FOLDER_T1002.name);
    expect(names).toContain(TENDER_FOLDER_T1003.name);

    // IDs should match
    const ids = result.map((r) => r.id);
    expect(ids).toContain(TENDER_FOLDER_T1001.id);
    expect(ids).toContain(TENDER_FOLDER_T1002.id);
    expect(ids).toContain(TENDER_FOLDER_T1003.id);
  });

  it("skips non-folder files inside a month folder without error", async () => {
    const rootItemId = "synthetic-root-item-id";

    const seam = makeSeamMock({
      resolveItemIdByPath: jest.fn().mockResolvedValue(rootItemId),
      listFolderItemsById: jest
        .fn()
        .mockImplementation((_siteId: string, _driveId: string, itemId: string) => {
          if (itemId === rootItemId) {
            return Promise.resolve([MONTH_FOLDER_AUG]);
          }
          if (itemId === MONTH_FOLDER_AUG.id) {
            // Mix of folder and non-folder items — non-folder must be skipped
            return Promise.resolve([TENDER_FOLDER_T1001, NON_FOLDER_FILE_IN_MONTH]);
          }
          return Promise.resolve([]);
        }),
    });

    const prisma = makePrismaMock([], []);
    const svc = await buildModule(prisma, seam);

    const result = await svc.listLegacyTenderFolders();

    // Only the folder item is returned; the file is silently skipped
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe(TENDER_FOLDER_T1001.name);
    expect(result[0].monthFolder).toBe(MONTH_FOLDER_AUG.name);
  });

  it("returns empty list when the legacy root folder cannot be resolved", async () => {
    const seam = makeSeamMock({
      resolveItemIdByPath: jest.fn().mockResolvedValue(null),
      listFolderItemsById: jest.fn(),
    });

    const prisma = makePrismaMock([], []);
    const svc = await buildModule(prisma, seam);

    const result = await svc.listLegacyTenderFolders();

    expect(result).toHaveLength(0);
    // listFolderItemsById must not be called if root resolution failed
    expect(seam.listFolderItemsById).not.toHaveBeenCalled();
  });

  it("collects tender folders across multiple month folders", async () => {
    const rootItemId = "synthetic-root-item-id";

    const seam = makeSeamMock({
      resolveItemIdByPath: jest.fn().mockResolvedValue(rootItemId),
      listFolderItemsById: jest
        .fn()
        .mockImplementation((_siteId: string, _driveId: string, itemId: string) => {
          if (itemId === rootItemId) {
            // Two month folders
            return Promise.resolve([MONTH_FOLDER_AUG, MONTH_FOLDER_SEP]);
          }
          if (itemId === MONTH_FOLDER_AUG.id) {
            return Promise.resolve([TENDER_FOLDER_T1001]);
          }
          if (itemId === MONTH_FOLDER_SEP.id) {
            return Promise.resolve([TENDER_FOLDER_T1002]);
          }
          return Promise.resolve([]);
        }),
    });

    const prisma = makePrismaMock([], []);
    const svc = await buildModule(prisma, seam);

    const result = await svc.listLegacyTenderFolders();

    expect(result).toHaveLength(2);
    const t1001Entry = result.find((r) => r.name === TENDER_FOLDER_T1001.name);
    const t1002Entry = result.find((r) => r.name === TENDER_FOLDER_T1002.name);
    expect(t1001Entry?.monthFolder).toBe(MONTH_FOLDER_AUG.name);
    expect(t1002Entry?.monthFolder).toBe(MONTH_FOLDER_SEP.name);
  });
});

// ===========================================================================
// SharepointLegacyCopyService — plan()
// ===========================================================================

describe("SharepointLegacyCopyService.plan()", () => {
  it("returns match candidates and unmatchedTenders via two-level walk, zero writes to seam", async () => {
    // T1001 has folder link and a legacy folder → should match
    // T1002 has no folder link → noDestination
    // T1003 has folder link but no legacy folder → unmatchedTenders
    // no-T-number tender → silently ignored

    const rootItemId = "synthetic-root-item-id";

    const seam = makeSeamMock({
      resolveItemIdByPath: jest.fn().mockResolvedValue(rootItemId),
      listFolderItemsById: jest
        .fn()
        .mockImplementation((_siteId: string, _driveId: string, itemId: string) => {
          if (itemId === rootItemId) {
            return Promise.resolve([MONTH_FOLDER_AUG]);
          }
          if (itemId === MONTH_FOLDER_AUG.id) {
            // Only T1001 and T1002 have legacy folders; T1003 has none
            return Promise.resolve([TENDER_FOLDER_T1001, TENDER_FOLDER_T1002]);
          }
          return Promise.resolve([]);
        }),
      listFolderChildren: jest
        .fn()
        .mockResolvedValue([LEGACY_FILE_A, LEGACY_FILE_B]),
    });

    const prisma = makePrismaMock(
      [TENDER_WITH_MATCH, TENDER_NO_T_NUMBER, TENDER_NO_DESTINATION, TENDER_ANOTHER_MATCH],
      [FOLDER_LINK_T1001, FOLDER_LINK_T1003]
    );

    const svc = await buildModule(prisma, seam);
    const plan = await svc.plan();

    // T1001 matched (legacy folder + destination link found)
    expect(plan.matched).toHaveLength(1);
    expect(plan.matched[0].tNumber).toBe("T1001");
    // TFM-S7: destinationReady from folderExists (mocked true by default)
    expect(plan.matched[0].destinationReady).toBe(true);
    expect(plan.matched[0].destinationReason).toBeNull();
    // wouldCopy lists the two legacy files
    expect(plan.matched[0].wouldCopy).toHaveLength(2);
    // Path encodes the two-level legacy structure
    expect(plan.matched[0].legacyFolderPath).toContain(MONTH_FOLDER_AUG.name);
    expect(plan.matched[0].legacyFolderPath).toContain(TENDER_FOLDER_T1001.name);

    // T1003 has a destination link but no legacy folder → unmatched
    expect(plan.unmatchedTenders).toHaveLength(1);
    expect(plan.unmatchedTenders[0].tNumber).toBe("T1003");

    // T1002 has no folder link → noDestination
    expect(plan.noDestination).toHaveLength(1);
    expect(plan.noDestination[0].tNumber).toBe("T1002");

    // No-T-number tender counted silently
    expect(plan.noTNumberCount).toBe(1);

    // plan() must NOT call uploadFile or downloadFileBytes
    expect(seam.uploadFile).not.toHaveBeenCalled();
    expect(seam.downloadFileBytes).not.toHaveBeenCalled();
  });

  it("tender without T#### in title is silently ignored — does not crash", async () => {
    const rootItemId = "synthetic-root-item-id";

    const seam = makeSeamMock({
      resolveItemIdByPath: jest.fn().mockResolvedValue(rootItemId),
      listFolderItemsById: jest.fn().mockResolvedValue([]),
    });
    const prisma = makePrismaMock([TENDER_NO_T_NUMBER], []);

    const svc = await buildModule(prisma, seam);
    const plan = await svc.plan();

    expect(plan.noTNumberCount).toBe(1);
    expect(plan.matched).toHaveLength(0);
    expect(plan.unmatchedTenders).toHaveLength(0);
    expect(plan.noDestination).toHaveLength(0);
  });

  it("re-throws SeamExtensionRequiredError from listFolderItemsById", async () => {
    const rootItemId = "synthetic-root-item-id";

    const seam = makeSeamMock({
      resolveItemIdByPath: jest.fn().mockResolvedValue(rootItemId),
      listFolderItemsById: jest.fn().mockRejectedValue(
        new SeamExtensionRequiredError("listFolderItemsById")
      ),
    });

    const prisma = makePrismaMock([TENDER_WITH_MATCH], [FOLDER_LINK_T1001]);
    const svc = await buildModule(prisma, seam);

    await expect(svc.plan()).rejects.toBeInstanceOf(SeamExtensionRequiredError);
  });

  it("populates unmatchedLegacyFolders with legacy T-numbers that have no imported tender", async () => {
    const rootItemId = "synthetic-root-item-id";

    // Legacy has T1001 and T9999; only T1001 is imported
    const ORPHAN_FOLDER: LegacyFolderItem = {
      id: "orphan-item-id",
      name: "T9999 - Orphaned Legacy Project",
      isFolder: true,
    };

    const seam = makeSeamMock({
      resolveItemIdByPath: jest.fn().mockResolvedValue(rootItemId),
      listFolderItemsById: jest
        .fn()
        .mockImplementation((_siteId: string, _driveId: string, itemId: string) => {
          if (itemId === rootItemId) return Promise.resolve([MONTH_FOLDER_AUG]);
          if (itemId === MONTH_FOLDER_AUG.id)
            return Promise.resolve([TENDER_FOLDER_T1001, ORPHAN_FOLDER]);
          return Promise.resolve([]);
        }),
      listFolderChildren: jest.fn().mockResolvedValue([LEGACY_FILE_A]),
    });

    const prisma = makePrismaMock([TENDER_WITH_MATCH], [FOLDER_LINK_T1001]);
    const svc = await buildModule(prisma, seam);
    const plan = await svc.plan();

    expect(plan.matched).toHaveLength(1);
    expect(plan.unmatchedLegacyFolders).toHaveLength(1);
    expect(plan.unmatchedLegacyFolders[0].tNumber).toBe("T9999");
    expect(plan.unmatchedLegacyFolders[0].legacyFolderPath).toContain(ORPHAN_FOLDER.name);
  });
});

// ===========================================================================
// SharepointLegacyCopyService — execute()
// ===========================================================================

describe("SharepointLegacyCopyService.execute()", () => {
  it("happy path: N legacy files → N copy calls (download + upload per file)", async () => {
    const rootItemId = "synthetic-root-item-id";

    const seam = makeSeamMock({
      resolveItemIdByPath: jest.fn().mockResolvedValue(rootItemId),
      listFolderItemsById: jest
        .fn()
        .mockImplementation((_siteId: string, _driveId: string, itemId: string) => {
          if (itemId === rootItemId) return Promise.resolve([MONTH_FOLDER_AUG]);
          if (itemId === MONTH_FOLDER_AUG.id) return Promise.resolve([TENDER_FOLDER_T1001]);
          return Promise.resolve([]);
        }),
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
    const rootItemId = "synthetic-root-item-id";

    // Dest already has LEGACY_FILE_A (same name+size)
    const seam = makeSeamMock({
      resolveItemIdByPath: jest.fn().mockResolvedValue(rootItemId),
      listFolderItemsById: jest
        .fn()
        .mockImplementation((_siteId: string, _driveId: string, itemId: string) => {
          if (itemId === rootItemId) return Promise.resolve([MONTH_FOLDER_AUG]);
          if (itemId === MONTH_FOLDER_AUG.id) return Promise.resolve([TENDER_FOLDER_T1001]);
          return Promise.resolve([]);
        }),
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
    const rootItemId = "synthetic-root-item-id";

    const seam = makeSeamMock({
      resolveItemIdByPath: jest.fn().mockResolvedValue(rootItemId),
      listFolderItemsById: jest.fn().mockResolvedValue([]),
    });
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
    const rootItemId = "synthetic-root-item-id";

    const destFiles: FolderChildItem[] = [
      { name: LEGACY_FILE_A.name, fileId: "dest-a", size: LEGACY_FILE_A.size },
      { name: LEGACY_FILE_B.name, fileId: "dest-b", size: LEGACY_FILE_B.size },
    ];

    const seam = makeSeamMock({
      resolveItemIdByPath: jest.fn().mockResolvedValue(rootItemId),
      listFolderItemsById: jest
        .fn()
        .mockImplementation((_siteId: string, _driveId: string, itemId: string) => {
          if (itemId === rootItemId) return Promise.resolve([MONTH_FOLDER_AUG]);
          if (itemId === MONTH_FOLDER_AUG.id) return Promise.resolve([TENDER_FOLDER_T1001]);
          return Promise.resolve([]);
        }),
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

// ===========================================================================
// TFM-S7 — assertDestinationExists (via plan() and execute())
// ===========================================================================

describe("TFM-S7 — destination precondition", () => {
  it("plan(): folderProvisioningStatus=failed → unready, reason 'folder provisioning failed', empty wouldCopy", async () => {
    const rootItemId = "synthetic-root-item-id";

    const failedTender = {
      ...TENDER_WITH_MATCH,
      folderProvisioningStatus: "failed" as string | null,
    };

    const seam = makeSeamMock({
      resolveItemIdByPath: jest.fn().mockResolvedValue(rootItemId),
      listFolderItemsById: jest
        .fn()
        .mockImplementation((_siteId: string, _driveId: string, itemId: string) => {
          if (itemId === rootItemId) return Promise.resolve([MONTH_FOLDER_AUG]);
          if (itemId === MONTH_FOLDER_AUG.id) return Promise.resolve([TENDER_FOLDER_T1001]);
          return Promise.resolve([]);
        }),
      listFolderChildren: jest.fn().mockResolvedValue([LEGACY_FILE_A, LEGACY_FILE_B]),
      // folderExists should NOT be called when status is "failed" (short-circuit)
      folderExists: jest.fn().mockResolvedValue(true),
    });

    const prisma = makePrismaMock([failedTender], [FOLDER_LINK_T1001]);
    const svc = await buildModule(prisma, seam);
    const plan = await svc.plan();

    expect(plan.matched).toHaveLength(1);
    expect(plan.matched[0].destinationReady).toBe(false);
    expect(plan.matched[0].destinationReason).toBe("folder provisioning failed");
    expect(plan.matched[0].wouldCopy).toHaveLength(0);
    expect(plan.unreadyCount).toBe(1);

    // Short-circuit: Graph existence check must not be called when status is failed
    expect(seam.folderExists).not.toHaveBeenCalled();
  });

  it("plan(): destination folder missing per adapter probe → unready, reason 'destination folder missing'", async () => {
    const rootItemId = "synthetic-root-item-id";

    const seam = makeSeamMock({
      resolveItemIdByPath: jest.fn().mockResolvedValue(rootItemId),
      listFolderItemsById: jest
        .fn()
        .mockImplementation((_siteId: string, _driveId: string, itemId: string) => {
          if (itemId === rootItemId) return Promise.resolve([MONTH_FOLDER_AUG]);
          if (itemId === MONTH_FOLDER_AUG.id) return Promise.resolve([TENDER_FOLDER_T1001]);
          return Promise.resolve([]);
        }),
      listFolderChildren: jest.fn().mockResolvedValue([LEGACY_FILE_A]),
      // Simulate destination folder not yet provisioned
      folderExists: jest.fn().mockResolvedValue(false),
    });

    const prisma = makePrismaMock([TENDER_WITH_MATCH], [FOLDER_LINK_T1001]);
    const svc = await buildModule(prisma, seam);
    const plan = await svc.plan();

    expect(plan.matched).toHaveLength(1);
    expect(plan.matched[0].destinationReady).toBe(false);
    expect(plan.matched[0].destinationReason).toBe("destination folder missing");
    expect(plan.matched[0].wouldCopy).toHaveLength(0);
    expect(plan.unreadyCount).toBe(1);
  });

  it("plan(): ok status + folderExists=true → ready, wouldCopy populated with legacy files", async () => {
    const rootItemId = "synthetic-root-item-id";

    const seam = makeSeamMock({
      resolveItemIdByPath: jest.fn().mockResolvedValue(rootItemId),
      listFolderItemsById: jest
        .fn()
        .mockImplementation((_siteId: string, _driveId: string, itemId: string) => {
          if (itemId === rootItemId) return Promise.resolve([MONTH_FOLDER_AUG]);
          if (itemId === MONTH_FOLDER_AUG.id) return Promise.resolve([TENDER_FOLDER_T1001]);
          return Promise.resolve([]);
        }),
      listFolderChildren: jest.fn().mockResolvedValue([LEGACY_FILE_A, LEGACY_FILE_B]),
      folderExists: jest.fn().mockResolvedValue(true),
    });

    const prisma = makePrismaMock([TENDER_WITH_MATCH], [FOLDER_LINK_T1001]);
    const svc = await buildModule(prisma, seam);
    const plan = await svc.plan();

    expect(plan.matched).toHaveLength(1);
    expect(plan.matched[0].destinationReady).toBe(true);
    expect(plan.matched[0].destinationReason).toBeNull();
    expect(plan.matched[0].wouldCopy).toHaveLength(2);
    expect(plan.unreadyCount).toBe(0);

    // Each wouldCopy entry carries sizeBytes from the legacy file
    const sizes = plan.matched[0].wouldCopy.map((e) => e.sizeBytes);
    expect(sizes).toContain(LEGACY_FILE_A.size);
    expect(sizes).toContain(LEGACY_FILE_B.size);
  });

  it("execute(): skips unready tender at run time even if plan was called first (adapter re-checked between plan and execute)", async () => {
    const rootItemId = "synthetic-root-item-id";

    // First call (plan phase): folderExists returns true → ready
    // Second call (execute re-check): folderExists returns false → skip
    let folderExistsCallCount = 0;
    const seam = makeSeamMock({
      resolveItemIdByPath: jest.fn().mockResolvedValue(rootItemId),
      listFolderItemsById: jest
        .fn()
        .mockImplementation((_siteId: string, _driveId: string, itemId: string) => {
          if (itemId === rootItemId) return Promise.resolve([MONTH_FOLDER_AUG]);
          if (itemId === MONTH_FOLDER_AUG.id) return Promise.resolve([TENDER_FOLDER_T1001]);
          return Promise.resolve([]);
        }),
      listFolderChildren: jest.fn().mockResolvedValue([LEGACY_FILE_A]),
      listDestinationFolderChildren: jest.fn().mockResolvedValue([]),
      folderExists: jest.fn().mockImplementation(() => {
        folderExistsCallCount++;
        // First call is from plan() — return true so it appears in matched.
        // Second call is from execute() re-check — return false to trigger skip.
        return Promise.resolve(folderExistsCallCount === 1);
      }),
    });

    const prisma = makePrismaMock([TENDER_WITH_MATCH], [FOLDER_LINK_T1001]);
    const svc = await buildModule(prisma, seam);
    const report = await svc.execute();

    // The tender appeared as ready in the plan but was skipped at execute time
    expect(report.matchesAttempted).toBe(1);
    expect(report.skippedUnreadyCount).toBe(1);
    expect(report.totalCopied).toBe(0);

    // No actual copy operations
    expect(seam.downloadFileBytes).not.toHaveBeenCalled();
    expect(seam.uploadFile).not.toHaveBeenCalled();

    // folderExists must have been called at least twice (plan + execute re-check)
    expect(folderExistsCallCount).toBeGreaterThanOrEqual(2);
  });
});

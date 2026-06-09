import { SharePointService } from "./sharepoint.service";
import { SharePointFileNotFoundError } from "./sharepoint.adapter";

describe("SharePointService", () => {
  it("returns mock-backed configuration and ensures a folder", async () => {
    const configService = {
      get: jest.fn((key: string, fallback: string) => fallback)
    };

    const prisma = {
      sharePointFolderLink: {
        upsert: jest.fn().mockResolvedValue({ id: "folder-1", relativePath: "Project Operations/Jobs" })
      }
    };

    const auditService = {
      write: jest.fn().mockResolvedValue(undefined)
    };

    const adapter = {
      ensureFolder: jest.fn().mockResolvedValue({
        siteId: "site",
        driveId: "drive",
        itemId: "folder-item",
        name: "Jobs",
        relativePath: "Project Operations/Jobs"
      })
    };

    const service = new SharePointService(
      configService as never,
      prisma as never,
      auditService as never,
      adapter as never
    );

    expect(service.getConfiguration().mode).toBe("mock");

    const result = await service.ensureFolder({
      name: "Jobs",
      relativePath: "Project Operations/Jobs",
      module: "jobs"
    });

    expect(result.id).toBe("folder-1");
  });

  // PR #146 — downloadFileBytes routes through the adapter and audits
  // every read.
  describe("downloadFileBytes (PR #146)", () => {
    function buildService(adapterOverrides: Record<string, unknown> = {}) {
      const configService = {
        get: jest.fn((_key: string, fallback: string) => fallback)
      };
      const prisma = {} as never;
      const auditWrite = jest.fn().mockResolvedValue(undefined);
      const auditService = { write: auditWrite };
      const adapter = {
        ensureFolder: jest.fn(),
        uploadFile: jest.fn(),
        getDownloadUrl: jest.fn(),
        downloadFileBytes: jest.fn().mockResolvedValue(Buffer.from("file-bytes")),
        ...adapterOverrides
      };
      const service = new SharePointService(
        configService as never,
        prisma,
        auditService as never,
        adapter as never
      );
      return { service, adapter, auditWrite };
    }

    it("delegates to adapter.downloadFileBytes with the provided ids", async () => {
      const { service, adapter } = buildService();
      await service.downloadFileBytes(
        { siteId: "s", driveId: "d", fileId: "f" },
        "actor-1"
      );
      expect(adapter.downloadFileBytes).toHaveBeenCalledWith({
        siteId: "s",
        driveId: "d",
        fileId: "f"
      });
    });

    it("audits each read with sizeBytes metadata, never the content itself", async () => {
      const { service, auditWrite } = buildService({
        downloadFileBytes: jest.fn().mockResolvedValue(Buffer.alloc(2048))
      });
      await service.downloadFileBytes(
        { siteId: "s", driveId: "d", fileId: "f" },
        "actor-2"
      );
      expect(auditWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "actor-2",
          action: "sharepoint.file.download",
          entityType: "SharePointFileLink",
          entityId: "f",
          metadata: expect.objectContaining({ sizeBytes: 2048 })
        })
      );
    });

    it("propagates SharePointFileNotFoundError unchanged from the adapter", async () => {
      const { service } = buildService({
        downloadFileBytes: jest
          .fn()
          .mockRejectedValue(new SharePointFileNotFoundError("missing", "s", "d"))
      });
      await expect(
        service.downloadFileBytes({ siteId: "s", driveId: "d", fileId: "missing" })
      ).rejects.toBeInstanceOf(SharePointFileNotFoundError);
    });
  });

  // PR-64 — per-tender folder provisioning. ensureTenderFolderStructure
  // walks the configured tenders root, then creates the tender folder
  // and one subfolder per canonical document category.
  describe("ensureTenderFolderStructure (PR-64)", () => {
    function buildService(envOverrides: Record<string, string> = {}) {
      const env: Record<string, string> = {
        SHAREPOINT_MODE: "mock",
        SHAREPOINT_TENDERS_ROOT: "Org/Tenders",
        ...envOverrides
      };
      const configService = {
        get: jest.fn((key: string, fallback?: string) => env[key] ?? fallback)
      };
      const prisma = {
        sharePointFolderLink: {
          upsert: jest
            .fn()
            .mockImplementation((args: { create: { relativePath: string } }) =>
              Promise.resolve({ id: `folder-${args.create.relativePath}`, relativePath: args.create.relativePath })
            )
        }
      };
      const auditService = { write: jest.fn().mockResolvedValue(undefined) };
      const adapter = {
        ensureFolder: jest
          .fn()
          .mockImplementation(({ relativePath, name }: { relativePath: string; name: string }) =>
            Promise.resolve({
              siteId: "site",
              driveId: "drive",
              itemId: `item-${relativePath}`,
              name,
              relativePath
            })
          ),
        uploadFile: jest.fn(),
        getDownloadUrl: jest.fn(),
        downloadFileBytes: jest.fn(),
        resolveSiteId: jest.fn().mockResolvedValue("resolved-site"),
        resolveDriveId: jest.fn().mockResolvedValue("resolved-drive")
      };
      const service = new SharePointService(
        configService as never,
        prisma as never,
        auditService as never,
        adapter as never
      );
      return { service, adapter, prisma };
    }

    it("ensures parent chain + tender folder + every canonical category", async () => {
      const { service, adapter } = buildService();
      await service.ensureTenderFolderStructure({ id: "t-1", tenderNumber: "T-001" });

      const paths = adapter.ensureFolder.mock.calls.map(
        ([input]: [{ relativePath: string }]) => input.relativePath
      );
      // 2 parent segments + 1 tender folder + 11 categories = 14 calls.
      expect(paths).toHaveLength(14);
      expect(paths[0]).toBe("Org");
      expect(paths[1]).toBe("Org/Tenders");
      expect(paths[2]).toBe("Org/Tenders/T-001");
      // Spot-check first + last category folder routing.
      expect(paths[3]).toBe("Org/Tenders/T-001/Tender Documents");
      expect(paths[13]).toBe("Org/Tenders/T-001/Other");
    });

    it("logs but does not throw when an individual category folder fails", async () => {
      const { service, adapter } = buildService();
      adapter.ensureFolder.mockImplementationOnce(
        ({ relativePath, name }: { relativePath: string; name: string }) =>
          Promise.resolve({ siteId: "site", driveId: "drive", itemId: "p1", name, relativePath })
      ); // Org
      adapter.ensureFolder.mockImplementationOnce(
        ({ relativePath, name }: { relativePath: string; name: string }) =>
          Promise.resolve({ siteId: "site", driveId: "drive", itemId: "p2", name, relativePath })
      ); // Org/Tenders
      adapter.ensureFolder.mockImplementationOnce(
        ({ relativePath, name }: { relativePath: string; name: string }) =>
          Promise.resolve({ siteId: "site", driveId: "drive", itemId: "t1", name, relativePath })
      ); // Org/Tenders/T-001
      // First category fails, the remaining 10 still attempt.
      adapter.ensureFolder.mockRejectedValueOnce(new Error("Graph transient"));
      adapter.ensureFolder.mockImplementation(
        ({ relativePath, name }: { relativePath: string; name: string }) =>
          Promise.resolve({ siteId: "site", driveId: "drive", itemId: `i-${relativePath}`, name, relativePath })
      );

      await expect(
        service.ensureTenderFolderStructure({ id: "t-2", tenderNumber: "T-002" })
      ).resolves.toBeUndefined();
      // 3 prefix calls + 11 category attempts (one failed but counted).
      expect(adapter.ensureFolder).toHaveBeenCalledTimes(14);
    });

    it("returns the category folder link from ensureTenderCategoryFolder", async () => {
      const { service, adapter } = buildService();
      const folder = await service.ensureTenderCategoryFolder(
        { id: "t-1", tenderNumber: "T-001" },
        "Drawings"
      );
      expect(folder.relativePath).toBe("Org/Tenders/T-001/Drawings");
      expect(adapter.ensureFolder).toHaveBeenCalledTimes(1);
    });
  });
});

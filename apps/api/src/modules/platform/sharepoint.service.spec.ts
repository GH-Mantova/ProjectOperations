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

  // PR-64 / TFM-S4 — per-tender folder provisioning. ensureTenderFolderStructure
  // walks the configured tenders root, then creates the tender folder and
  // the TFM-S4 hierarchical folder structure.
  describe("ensureTenderFolderStructure (PR-64 / TFM-S4)", () => {
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
            .mockImplementation((args: { create: { relativePath: string; itemId: string } }) =>
              Promise.resolve({
                id: `folder-${args.create.relativePath}`,
                itemId: args.create.itemId,
                siteId: "site",
                driveId: "drive",
                relativePath: args.create.relativePath
              })
            )
        },
        tender: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: "t-1",
            tenderNumber: "T-001",
            projectName: null,
            site: null
          })
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

    it("ensures parent chain + tender folder + every S4 hierarchical category + Quotes/ when no clients", async () => {
      const { service, adapter } = buildService();
      await service.ensureTenderFolderStructure({ id: "t-1", tenderNumber: "T-001", tenderClients: [] });

      const paths = adapter.ensureFolder.mock.calls.map(
        ([input]: [{ relativePath: string }]) => input.relativePath
      );
      // 2 parent + 1 tender + folders from TENDER_FOLDER_STRUCTURE (8 top-level + 5 children) + 1 Quotes/ = 17 calls.
      // Exact count: Org, Org/Tenders, Org/Tenders/T-001,
      //   1. Plans..., 1. Plans.../01. Drawings, /02. Specs, /03. Registers, /04. As Builts,
      //   2. Photos, 3. Estimates..., 3. Estimates.../Superseded,
      //   4. Suppliers, 5. Compliance..., 6. Correspondence, 7. Other,
      //   Quotes (from TENDER_FOLDER_STRUCTURE sentinel), Quotes (from the no-client branch)
      // Actually Quotes from flattenFolderPaths + then the guard path = 2 calls for Quotes.
      // Let's just check critical paths instead of exact count.
      expect(paths).toContain("Org");
      expect(paths).toContain("Org/Tenders");
      expect(paths).toContain("Org/Tenders/T-001");
      expect(paths).toContain("Org/Tenders/T-001/1. Plans, Scopes & Specs");
      expect(paths).toContain("Org/Tenders/T-001/1. Plans, Scopes & Specs/01. Drawings");
      expect(paths).toContain("Org/Tenders/T-001/3. Estimates & Calcs/Superseded");
      expect(paths).toContain("Org/Tenders/T-001/7. Other");
      expect(paths).toContain("Org/Tenders/T-001/Quotes");
    });

    it("creates per-client Quotes subfolders when tenderClients is provided", async () => {
      const { service, adapter, prisma } = buildService();
      // findUniqueOrThrow is called inside ensureTenderQuoteClientFolder.
      (prisma.tender as { findUniqueOrThrow: jest.Mock }).findUniqueOrThrow
        .mockResolvedValue({ id: "t-1", tenderNumber: "T-001", projectName: null, site: null });

      await service.ensureTenderFolderStructure({
        id: "t-1",
        tenderNumber: "T-001",
        tenderClients: [
          { client: { name: "Acme Corp" } },
          { client: { name: "Northshore Builders" } }
        ]
      });

      const paths = adapter.ensureFolder.mock.calls.map(
        ([input]: [{ relativePath: string }]) => input.relativePath
      );
      expect(paths).toContain("Org/Tenders/T-001/Quotes");
      expect(paths).toContain("Org/Tenders/T-001/Quotes/Acme Corp");
      expect(paths).toContain("Org/Tenders/T-001/Quotes/Northshore Builders");
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
      // First category fails, the rest still attempt.
      adapter.ensureFolder.mockRejectedValueOnce(new Error("Graph transient"));
      adapter.ensureFolder.mockImplementation(
        ({ relativePath, name }: { relativePath: string; name: string }) =>
          Promise.resolve({ siteId: "site", driveId: "drive", itemId: `i-${relativePath}`, name, relativePath })
      );

      // TFM-S5: returns partial (not undefined) because one path failed and others succeeded.
      const result = await service.ensureTenderFolderStructure({ id: "t-2", tenderNumber: "T-002", tenderClients: [] });
      expect(result.status).toBe("partial");
      expect(result.failures.length).toBeGreaterThan(0);
      // Should have attempted calls for prefix + all category paths + Quotes guard.
      expect(adapter.ensureFolder.mock.calls.length).toBeGreaterThan(3);
    });

    // TFM-S5 -- accumulator tests
    it("TFM-S5: returns status ok and null failures on full success", async () => {
      const { service } = buildService();
      const result = await service.ensureTenderFolderStructure({ id: "t-1", tenderNumber: "T-001", tenderClients: [] });
      expect(result.status).toBe("ok");
      expect(result.failures).toHaveLength(0);
    });

    it("TFM-S5: returns status partial when one nested path fails and others succeed", async () => {
      const { service, adapter } = buildService();
      // Allow parent + tender folder creation (3 calls: Org, Org/Tenders, Org/Tenders/T-003)
      adapter.ensureFolder
        .mockImplementationOnce(({ relativePath, name }: { relativePath: string; name: string }) =>
          Promise.resolve({ siteId: "site", driveId: "drive", itemId: "p1", name, relativePath })
        )
        .mockImplementationOnce(({ relativePath, name }: { relativePath: string; name: string }) =>
          Promise.resolve({ siteId: "site", driveId: "drive", itemId: "p2", name, relativePath })
        )
        .mockImplementationOnce(({ relativePath, name }: { relativePath: string; name: string }) =>
          Promise.resolve({ siteId: "site", driveId: "drive", itemId: "t3", name, relativePath })
        )
        // One specific category path fails (e.g. "1. Plans, Scopes & Specs")
        .mockRejectedValueOnce(new Error("Nested create refused"))
        // All others succeed
        .mockImplementation(({ relativePath, name }: { relativePath: string; name: string }) =>
          Promise.resolve({ siteId: "site", driveId: "drive", itemId: `i-${relativePath}`, name, relativePath })
        );

      const result = await service.ensureTenderFolderStructure({ id: "t-3", tenderNumber: "T-003", tenderClients: [] });
      expect(result.status).toBe("partial");
      expect(result.failures.length).toBe(1);
      expect(result.failures[0].message).toBe("Nested create refused");
    });

    it("TFM-S5: returns status failed when root parent creation fails", async () => {
      const { service, adapter } = buildService();
      adapter.ensureFolder.mockRejectedValueOnce(new Error("Site unreachable"));

      const result = await service.ensureTenderFolderStructure({ id: "t-4", tenderNumber: "T-004", tenderClients: [] });
      expect(result.status).toBe("failed");
      expect(result.failures.length).toBe(1);
      expect(result.failures[0].message).toBe("Site unreachable");
    });

    it("ensureTenderCategoryFolder: single-segment path creates one folder at the right path", async () => {
      const { service, adapter } = buildService();
      const folder = await service.ensureTenderCategoryFolder(
        { id: "t-1", tenderNumber: "T-001" },
        "7. Other"
      );
      expect(folder.relativePath).toBe("Org/Tenders/T-001/7. Other");
      expect(adapter.ensureFolder).toHaveBeenCalledTimes(1);
    });

    it("ensureTenderCategoryFolder: two-segment path ensures both segments in order", async () => {
      const { service, adapter } = buildService();
      const folder = await service.ensureTenderCategoryFolder(
        { id: "t-1", tenderNumber: "T-001" },
        "1. Plans, Scopes & Specs/01. Drawings"
      );
      expect(folder.relativePath).toBe("Org/Tenders/T-001/1. Plans, Scopes & Specs/01. Drawings");
      expect(adapter.ensureFolder).toHaveBeenCalledTimes(2);
      const paths = adapter.ensureFolder.mock.calls.map(
        ([input]: [{ relativePath: string }]) => input.relativePath
      );
      expect(paths[0]).toBe("Org/Tenders/T-001/1. Plans, Scopes & Specs");
      expect(paths[1]).toBe("Org/Tenders/T-001/1. Plans, Scopes & Specs/01. Drawings");
    });

    it("ensureTenderQuoteClientFolder: sanitises client name using the S2 helper and returns folderId+folderPath", async () => {
      const { service, adapter } = buildService();
      const result = await service.ensureTenderQuoteClientFolder("t-1", "Acme/Corp?Ltd");
      // sanitiseSharePointName strips "?" and "/" from client names.
      expect(result.folderPath).toBe("Org/Tenders/T-001/Quotes/AcmeCorpLtd");
      expect(result.folderId).toBe("item-Org/Tenders/T-001/Quotes/AcmeCorpLtd");
      // Quotes/ ensured first, then client folder.
      const paths = adapter.ensureFolder.mock.calls.map(
        ([input]: [{ relativePath: string }]) => input.relativePath
      );
      expect(paths).toContain("Org/Tenders/T-001/Quotes");
      expect(paths).toContain("Org/Tenders/T-001/Quotes/AcmeCorpLtd");
    });
  });
});

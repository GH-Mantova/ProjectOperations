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
});

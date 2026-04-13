import { ConfigService } from "@nestjs/config";
import { SharePointService } from "./sharepoint.service";

describe("SharePointService", () => {
  it("returns mock-backed configuration and ensures a folder", async () => {
    const configService = {
      get: jest.fn((key: string, fallback: string) => fallback)
    } as unknown as ConfigService;

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
      configService,
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
});

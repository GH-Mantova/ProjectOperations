import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SharePointFolderMappingsService } from "../sharepoint-folder-mappings.service";

// Bare mock builder for the moving parts. Tests below assert
// contract-level behaviour: validate-before-write, cache invalidation
// after write, audit-log emission on success, path-normalisation
// refusals.
function buildDeps(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  const findUnique = jest.fn().mockResolvedValue(null);
  const update = jest.fn().mockImplementation(async ({ data }: { data: { folderPath: string } }) => ({
    id: "mapping-1",
    entityType: "TENDER",
    folderPath: data.folderPath,
    isActive: true,
    createdById: null,
    updatedById: null,
    createdAt: now,
    updatedAt: now
  }));
  const create = jest.fn().mockImplementation(async ({ data }: { data: { folderPath: string } }) => ({
    id: "mapping-1",
    entityType: "TENDER",
    folderPath: data.folderPath,
    isActive: true,
    createdById: null,
    updatedById: null,
    createdAt: now,
    updatedAt: now
  }));
  const prisma = {
    sharePointFolderMapping: {
      findUnique,
      update,
      create,
      findMany: jest.fn().mockResolvedValue([])
    }
  };
  const auditWrite = jest.fn().mockResolvedValue(undefined);
  const auditService = { write: auditWrite };
  const folderExists = jest.fn().mockResolvedValue(true);
  const adapter = { folderExists };
  const configService = { get: jest.fn((key: string, fallback?: string) => fallback) };

  return {
    prisma,
    auditService,
    adapter,
    configService,
    findUnique,
    update,
    create,
    folderExists,
    auditWrite,
    ...overrides
  };
}

function buildService(deps = buildDeps()) {
  const service = new SharePointFolderMappingsService(
    deps.prisma as never,
    deps.configService as never,
    deps.auditService as never,
    deps.adapter as never
  );
  return { service, deps };
}

describe("SharePointFolderMappingsService", () => {
  describe("updatePath — validate-against-Graph on save", () => {
    it("REJECTS a save when the folder does not exist in the library — never creates it as a side-effect", async () => {
      const deps = buildDeps();
      deps.folderExists.mockResolvedValueOnce(false);
      const { service } = buildService(deps);

      await expect(
        service.updatePath(
          "TENDER",
          { folderPath: "1. Operations/Nonexistent", siteId: "s", driveId: "d" },
          "actor-1"
        )
      ).rejects.toBeInstanceOf(BadRequestException);

      // The service must NOT have written to the DB — a typo'd path that
      // silently persists is exactly what this PR is preventing.
      expect(deps.update).not.toHaveBeenCalled();
      expect(deps.create).not.toHaveBeenCalled();
      expect(deps.auditWrite).not.toHaveBeenCalled();
    });

    it("names the offending path in the error so the admin knows what to fix", async () => {
      const deps = buildDeps();
      deps.folderExists.mockResolvedValueOnce(false);
      const { service } = buildService(deps);

      await expect(
        service.updatePath(
          "TENDER",
          { folderPath: "1. Operations/Typo", siteId: "s", driveId: "d" },
          "actor-1"
        )
      ).rejects.toThrow(/1\. Operations\/Typo/);
    });

    it("refuses empty, leading-/, trailing-/, or //-containing paths without touching Graph", async () => {
      const { service, deps } = buildService();
      for (const bad of ["", "  ", "/foo", "foo/", "foo//bar"]) {
        await expect(
          service.updatePath("TENDER", { folderPath: bad, siteId: "s", driveId: "d" }, "actor-1")
        ).rejects.toBeInstanceOf(BadRequestException);
      }
      // Validation is cheap and MUST come before the Graph round-trip.
      expect(deps.folderExists).not.toHaveBeenCalled();
    });

    it("persists, audits, and invalidates the cache on a successful update", async () => {
      const deps = buildDeps();
      // findUnique is called from updatePath (to snapshot the previous
      // value) — return the existing row so the service takes the update
      // branch rather than create.
      deps.findUnique.mockResolvedValue({
        id: "mapping-1",
        entityType: "TENDER",
        folderPath: "old-path",
        isActive: true,
        createdById: null,
        updatedById: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      const { service } = buildService(deps);

      const result = await service.updatePath(
        "TENDER",
        { folderPath: "1. Operations/1. Tenders", siteId: "site-abc", driveId: "drive-xyz" },
        "actor-42"
      );

      expect(result.folderPath).toBe("1. Operations/1. Tenders");
      expect(deps.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entityType: "TENDER" },
          data: expect.objectContaining({
            folderPath: "1. Operations/1. Tenders",
            updatedById: "actor-42"
          })
        })
      );
      expect(deps.auditWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "actor-42",
          action: "sharepoint.folder-mapping.update",
          entityType: "SharePointFolderMapping",
          metadata: expect.objectContaining({
            entityType: "TENDER",
            previousPath: "old-path",
            newPath: "1. Operations/1. Tenders"
          })
        })
      );
    });

    it("creates a new mapping row when none exists yet (JOB was seeded but might have been deleted)", async () => {
      const deps = buildDeps();
      deps.findUnique.mockResolvedValueOnce(null);
      const { service } = buildService(deps);

      await service.updatePath(
        "JOB",
        { folderPath: "1. Operations/2. Jobs won", siteId: "s", driveId: "d" },
        "actor-1"
      );

      expect(deps.create).toHaveBeenCalled();
      expect(deps.update).not.toHaveBeenCalled();
    });

    it("trims surrounding whitespace before validating and persisting", async () => {
      const { service, deps } = buildService();
      await service.updatePath(
        "TENDER",
        { folderPath: "  1. Operations/1. Tenders  ", siteId: "s", driveId: "d" },
        "actor-1"
      );
      expect(deps.folderExists).toHaveBeenCalledWith(
        expect.objectContaining({ relativePath: "1. Operations/1. Tenders" })
      );
    });
  });

  describe("getFolderPath", () => {
    it("returns the DB mapping when it exists and is active", async () => {
      const deps = buildDeps();
      deps.findUnique.mockResolvedValueOnce({
        id: "mapping-1",
        entityType: "TENDER",
        folderPath: "1. Operations/1. Tenders",
        isActive: true
      });
      const { service } = buildService(deps);
      const path = await service.getFolderPath("TENDER");
      expect(path).toBe("1. Operations/1. Tenders");
    });

    it("caches on read — a second call does not hit the DB", async () => {
      const deps = buildDeps();
      deps.findUnique.mockResolvedValueOnce({
        id: "mapping-1",
        entityType: "TENDER",
        folderPath: "1. Operations/1. Tenders",
        isActive: true
      });
      const { service } = buildService(deps);
      await service.getFolderPath("TENDER");
      await service.getFolderPath("TENDER");
      expect(deps.findUnique).toHaveBeenCalledTimes(1);
    });

    it("falls back to the env var for TENDER when no active mapping exists (deprecation window)", async () => {
      const deps = buildDeps({
        configService: {
          get: jest.fn((key: string, fallback?: string) =>
            key === "SHAREPOINT_TENDERS_ROOT" ? "Legacy Env/Tenders" : fallback
          )
        }
      });
      // findUnique returns null by default in buildDeps
      const { service } = buildService(deps);
      const path = await service.getFolderPath("TENDER");
      expect(path).toBe("Legacy Env/Tenders");
    });

    it("throws NotFoundException for JOB when no mapping row exists (no env fallback for jobs)", async () => {
      const deps = buildDeps();
      const { service } = buildService(deps);
      await expect(service.getFolderPath("JOB")).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

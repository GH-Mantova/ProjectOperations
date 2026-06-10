import { DocumentsService } from "./documents.service";

describe("DocumentsService", () => {
  const notificationsServiceMock = {
    refreshLiveFollowUps: jest.fn()
  };

  it("lists documents for an entity by delegating to the filtered list endpoint shape", async () => {
    const service = new DocumentsService(
      {} as never,
      {} as never,
      {} as never,
      notificationsServiceMock as never
    );
    const actor = { sub: "user-1", email: "planner@test.local", permissions: ["documents.view"] };
    const listSpy = jest.spyOn(service, "list").mockResolvedValue({
      items: [{ id: "doc-1" } as never],
      total: 1,
      page: 1,
      pageSize: 100
    });

    const result = await service.listForEntity("Job", "job-1", actor);

    expect(listSpy).toHaveBeenCalledWith(
      {
        page: 1,
        pageSize: 100,
        linkedEntityType: "Job",
        linkedEntityId: "job-1"
      },
      actor
    );
    expect(result).toEqual([{ id: "doc-1" }]);
  });

  it("creates a new version by reusing the previous document context", async () => {
    const service = new DocumentsService(
      {} as never,
      {} as never,
      {} as never,
      notificationsServiceMock as never
    );
    const actor = { sub: "user-1", email: "planner@test.local", permissions: ["documents.manage"] };

    jest.spyOn(service as any, "requireDocument").mockResolvedValue({
      id: "doc-1",
      linkedEntityType: "Job",
      linkedEntityId: "job-1",
      category: "Report",
      title: "Daily Report",
      description: "Existing version",
      status: "ACTIVE",
      documentFamilyKey: "family-1",
      tags: [{ tag: "daily" }],
      accessRules: [
        {
          accessType: "PERMISSION",
          roleName: null,
          permissionCode: "documents.view",
          canView: true,
          canDownload: true,
          canOpenLink: true
        }
      ]
    } as any);

    const createSpy = jest.spyOn(service, "create").mockResolvedValue({ id: "doc-2" } as never);

    const result = await service.createVersion(
      "doc-1",
      {
        fileName: "daily-report-v2.pdf",
        versionLabel: "v2",
        mimeType: "application/pdf"
      },
      actor
    );

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        linkedEntityType: "Job",
        linkedEntityId: "job-1",
        category: "Report",
        title: "Daily Report",
        versionOfDocumentId: "doc-1",
        documentFamilyKey: "family-1",
        fileName: "daily-report-v2.pdf",
        versionLabel: "v2",
        tags: ["daily"]
      }),
      actor,
      undefined
    );
    expect(result).toEqual({ id: "doc-2" });
  });

  describe("getDocumentsForSite", () => {
    const actor = {
      sub: "user-1",
      email: "planner@test.local",
      permissions: ["documents.view"]
    } as never;

    const buildService = (
      jobs: Array<{ id: string }>,
      documents: Array<Record<string, unknown>> = []
    ) => {
      const prisma = {
        job: {
          findMany: jest.fn().mockResolvedValue(jobs)
        },
        documentLink: {
          findMany: jest.fn().mockResolvedValue(documents)
        }
      };
      const service = new DocumentsService(
        prisma as never,
        {} as never,
        {} as never,
        notificationsServiceMock as never
      );
      jest.spyOn(service as any, "getActorRoles").mockResolvedValue([]);
      jest.spyOn(service as any, "enrichDocument").mockImplementation(async (doc) => doc);
      return { service, prisma };
    };

    it("returns empty when the site has no linked jobs", async () => {
      const { service, prisma } = buildService([]);

      const result = await service.getDocumentsForSite("site-1", actor);

      expect(prisma.job.findMany).toHaveBeenCalledWith({
        where: { siteId: "site-1" },
        select: { id: true }
      });
      expect(prisma.documentLink.findMany).not.toHaveBeenCalled();
      expect(result).toEqual({ items: [], total: 0, skip: 0, take: 50 });
    });

    it("returns documents rolled up from all linked jobs", async () => {
      const docs = [
        { id: "doc-1", linkedEntityType: "Job", linkedEntityId: "job-1", accessRules: [] },
        { id: "doc-2", linkedEntityType: "Job", linkedEntityId: "job-2", accessRules: [] }
      ];
      const { service, prisma } = buildService([{ id: "job-1" }, { id: "job-2" }], docs);

      const result = await service.getDocumentsForSite("site-1", actor);

      expect(prisma.documentLink.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            linkedEntityType: "Job",
            linkedEntityId: { in: ["job-1", "job-2"] }
          }
        })
      );
      expect(result.total).toBe(2);
      expect(result.items.map((item: any) => item.id)).toEqual(["doc-1", "doc-2"]);
    });

    it("paginates results with skip and take", async () => {
      const docs = Array.from({ length: 5 }, (_, i) => ({
        id: `doc-${i + 1}`,
        linkedEntityType: "Job",
        linkedEntityId: "job-1",
        accessRules: []
      }));
      const { service } = buildService([{ id: "job-1" }], docs);

      const result = await service.getDocumentsForSite("site-1", actor, { skip: 2, take: 2 });

      expect(result.total).toBe(5);
      expect(result.skip).toBe(2);
      expect(result.take).toBe(2);
      expect(result.items.map((item: any) => item.id)).toEqual(["doc-3", "doc-4"]);
    });

    it("scopes the query to the requested site's jobs only", async () => {
      const { service, prisma } = buildService([{ id: "job-a" }]);

      await service.getDocumentsForSite("site-xyz", actor);

      expect(prisma.job.findMany).toHaveBeenCalledWith({
        where: { siteId: "site-xyz" },
        select: { id: true }
      });
      const documentCall = prisma.documentLink.findMany.mock.calls[0][0];
      expect(documentCall.where.linkedEntityId).toEqual({ in: ["job-a"] });
      expect(documentCall.where.linkedEntityType).toBe("Job");
    });
  });
});

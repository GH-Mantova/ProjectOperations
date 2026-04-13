import { DocumentsService } from "./documents.service";

describe("DocumentsService", () => {
  it("lists documents for an entity by delegating to the filtered list endpoint shape", async () => {
    const service = new DocumentsService({} as never, {} as never, {} as never);
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
    const service = new DocumentsService({} as never, {} as never, {} as never);
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
      actor
    );
    expect(result).toEqual({ id: "doc-2" });
  });
});

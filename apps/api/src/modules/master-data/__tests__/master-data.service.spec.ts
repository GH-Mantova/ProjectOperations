// Mock-based unit tests for MasterDataService.
// Mirrors PR #283 (ProjectsService), PR #298 (FormsService), PR #311 (SchedulerService).
//
// Drives the service directly with plain-object Prisma / Audit stubs. The
// pre-existing master-data.service.spec.ts (one level up) covers the Xero
// paymentTermsDay/paymentTermsType invariants from PR #277 only — this spec
// adds broad coverage across every public method without touching it.

import { BadRequestException, ConflictException } from "@nestjs/common";
import { MasterDataService } from "../master-data.service";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;
type AnyDto = Record<string, unknown>;

// ─── Mock builders ─────────────────────────────────────────────────────────

const passthroughCreate = async ({ data }: { data: AnyDto }) => ({ id: "new-id", ...data });
const passthroughUpdate = async ({
  where,
  data
}: {
  where: { id: string };
  data: AnyDto;
}) => ({ id: where.id, ...data });

function tableCRUD() {
  return {
    findFirst: jest.fn().mockResolvedValue(null) as AsyncMock,
    findMany: jest.fn().mockResolvedValue([]) as AsyncMock,
    findUnique: jest.fn().mockResolvedValue(null) as AsyncMock,
    count: jest.fn().mockResolvedValue(0) as AsyncMock,
    create: jest.fn(passthroughCreate) as AsyncMock,
    update: jest.fn(passthroughUpdate) as AsyncMock
  };
}

function buildPrismaMock() {
  return {
    client: tableCRUD(),
    contact: tableCRUD(),
    site: tableCRUD(),
    tender: { findMany: jest.fn().mockResolvedValue([]) as AsyncMock },
    resourceType: tableCRUD(),
    competency: tableCRUD(),
    worker: tableCRUD(),
    crew: tableCRUD(),
    crewWorker: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }) as AsyncMock,
      createMany: jest.fn().mockResolvedValue({ count: 0 }) as AsyncMock
    },
    asset: tableCRUD(),
    workerCompetency: tableCRUD(),
    lookupValue: tableCRUD()
  };
}

function buildAudit() {
  return { write: jest.fn().mockResolvedValue(undefined) as AsyncMock };
}

function makeService() {
  const prisma = buildPrismaMock();
  const audit = buildAudit();
  const service = new MasterDataService(prisma as never, audit as never);
  return { service, prisma, audit };
}

const PAGE_QUERY: { page: number; pageSize: number } = { page: 1, pageSize: 10 };

// ─── listClients ────────────────────────────────────────────────────────────

describe("MasterDataService — listClients", () => {
  it("calls findMany with no where when q is absent and orders by name asc", async () => {
    const { service, prisma } = makeService();
    prisma.client.findMany.mockResolvedValueOnce([{ id: "c-1", name: "Acme" }]);
    prisma.client.count.mockResolvedValueOnce(1);

    const result = await service.listClients(PAGE_QUERY);

    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: undefined,
        orderBy: { name: "asc" },
        include: expect.objectContaining({ sites: true })
      })
    );
    expect(prisma.client.count).toHaveBeenCalledWith({ where: undefined });
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it("builds case-insensitive name contains filter when q is supplied", async () => {
    const { service, prisma } = makeService();
    await service.listClients({ ...PAGE_QUERY, q: "acme" } as never);

    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: "acme", mode: "insensitive" } }
      })
    );
    expect(prisma.client.count).toHaveBeenCalledWith({
      where: { name: { contains: "acme", mode: "insensitive" } }
    });
  });

  it("hydrates polymorphic contacts onto each client by organisationId", async () => {
    const { service, prisma } = makeService();
    prisma.client.findMany.mockResolvedValueOnce([
      { id: "c-1", name: "Acme" },
      { id: "c-2", name: "Beta" }
    ]);
    prisma.client.count.mockResolvedValueOnce(2);
    prisma.contact.findMany.mockResolvedValueOnce([
      { id: "ct-1", organisationId: "c-1", lastName: "Smith" },
      { id: "ct-2", organisationId: "c-1", lastName: "Jones" },
      { id: "ct-3", organisationId: "c-2", lastName: "Brown" }
    ]);

    const result = await service.listClients(PAGE_QUERY);

    expect(prisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationType: "CLIENT", organisationId: { in: ["c-1", "c-2"] } }
      })
    );
    const items = result.items as unknown as Array<{ id: string; contacts: unknown[] }>;
    expect(items[0].contacts).toHaveLength(2);
    expect(items[1].contacts).toHaveLength(1);
  });

  it("skips the polymorphic contact query when there are zero clients on the page", async () => {
    const { service, prisma } = makeService();
    prisma.client.findMany.mockResolvedValueOnce([]);
    prisma.client.count.mockResolvedValueOnce(0);

    await service.listClients(PAGE_QUERY);

    expect(prisma.contact.findMany).not.toHaveBeenCalled();
  });
});

// ─── upsertClient ───────────────────────────────────────────────────────────

describe("MasterDataService — upsertClient", () => {
  it("creates when id is undefined and writes a create audit entry", async () => {
    const { service, prisma, audit } = makeService();
    prisma.client.create.mockResolvedValueOnce({ id: "client-new", name: "Acme" });

    await service.upsertClient(undefined, { name: "Acme" } as never, "user-1");

    expect(prisma.client.create).toHaveBeenCalledWith({ data: { name: "Acme" } });
    expect(prisma.client.update).not.toHaveBeenCalled();
    expect(audit.write).toHaveBeenCalledWith({
      actorId: "user-1",
      action: "masterdata.client.create",
      entityType: "Client",
      entityId: "client-new"
    });
  });

  it("updates when id is provided and writes an update audit entry", async () => {
    const { service, prisma, audit } = makeService();
    prisma.client.update.mockResolvedValueOnce({ id: "client-1", name: "Acme" });

    await service.upsertClient("client-1", { name: "Acme" } as never, "user-1");

    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: { name: "Acme" }
    });
    expect(prisma.client.create).not.toHaveBeenCalled();
    expect(audit.write).toHaveBeenCalledWith({
      actorId: "user-1",
      action: "masterdata.client.update",
      entityType: "Client",
      entityId: "client-1"
    });
  });

  it("throws ConflictException when another client already uses the name (create)", async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst.mockResolvedValueOnce({ id: "client-existing", name: "Acme" });

    await expect(
      service.upsertClient(undefined, { name: "Acme" } as never)
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.client.create).not.toHaveBeenCalled();
  });

  it("excludes the current id from the uniqueness check on update (allows self-rename)", async () => {
    const { service, prisma } = makeService();
    await service.upsertClient("client-1", { name: "Acme" } as never);

    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { name: "Acme", NOT: { id: "client-1" } }
    });
  });

  it("throws BadRequestException when only paymentTermsDay is supplied", async () => {
    const { service } = makeService();
    await expect(
      service.upsertClient(undefined, { name: "Acme", paymentTermsDay: 20 } as never)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("forwards the full DTO to Prisma on create — no field stripping", async () => {
    const { service, prisma } = makeService();
    const dto = {
      name: "Acme",
      code: "ACM",
      email: "info@acme.test",
      abn: "12345678901",
      bankBsb: "082-082",
      legalName: "Acme Holdings Pty Ltd"
    };

    await service.upsertClient(undefined, dto as never);

    expect(prisma.client.create).toHaveBeenCalledWith({ data: dto });
  });
});

// ─── listContacts ───────────────────────────────────────────────────────────

describe("MasterDataService — listContacts", () => {
  it("scopes the where clause to CLIENT-owned contacts by default", async () => {
    const { service, prisma } = makeService();
    await service.listContacts(PAGE_QUERY);

    expect(prisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationType: "CLIENT" },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      })
    );
  });

  it("scopes to a single client when clientId is supplied", async () => {
    const { service, prisma } = makeService();
    await service.listContacts({ ...PAGE_QUERY, clientId: "c-7" } as never);

    expect(prisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationType: "CLIENT", organisationId: "c-7" }
      })
    );
  });

  it("builds OR(firstName | lastName) contains search when q is supplied", async () => {
    const { service, prisma } = makeService();
    await service.listContacts({ ...PAGE_QUERY, q: "bo" } as never);

    expect(prisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organisationType: "CLIENT",
          OR: [
            { firstName: { contains: "bo", mode: "insensitive" } },
            { lastName: { contains: "bo", mode: "insensitive" } }
          ]
        }
      })
    );
  });

  it("hydrates contact.client + contact.clientId from the polymorphic organisationId", async () => {
    const { service, prisma } = makeService();
    prisma.contact.findMany.mockResolvedValueOnce([
      { id: "ct-1", organisationId: "c-1", firstName: "Bo", lastName: "Brown" }
    ]);
    prisma.contact.count.mockResolvedValueOnce(1);
    prisma.client.findMany.mockResolvedValueOnce([
      { id: "c-1", name: "Acme", code: "ACM", status: "ACTIVE" }
    ]);

    const result = await service.listContacts(PAGE_QUERY);
    const items = result.items as unknown as Array<{
      clientId: string;
      client: { id: string; name: string; code: string; status: string } | null;
    }>;

    expect(items[0].clientId).toBe("c-1");
    expect(items[0].client).toEqual({ id: "c-1", name: "Acme", code: "ACM", status: "ACTIVE" });
  });

  it("returns clientId / client=null when the joined client row is missing", async () => {
    const { service, prisma } = makeService();
    prisma.contact.findMany.mockResolvedValueOnce([
      { id: "ct-1", organisationId: "c-orphan", firstName: "Bo", lastName: "Brown" }
    ]);
    prisma.contact.count.mockResolvedValueOnce(1);
    prisma.client.findMany.mockResolvedValueOnce([]);

    const result = await service.listContacts(PAGE_QUERY);
    const items = result.items as unknown as Array<{ clientId: string; client: unknown }>;

    expect(items[0].clientId).toBe("c-orphan");
    expect(items[0].client).toBeNull();
  });
});

// ─── upsertContact ──────────────────────────────────────────────────────────

describe("MasterDataService — upsertContact", () => {
  it("creates a CLIENT-anchored contact, maps deprecated position→role, stamps createdById", async () => {
    const { service, prisma, audit } = makeService();
    prisma.contact.create.mockResolvedValueOnce({ id: "ct-new" });

    await service.upsertContact(
      undefined,
      {
        clientId: "client-1",
        firstName: "Bo",
        lastName: "Brown",
        position: "Project Manager"
      } as never,
      "user-1"
    );

    expect(prisma.contact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firstName: "Bo",
        lastName: "Brown",
        role: "Project Manager",
        organisationType: "CLIENT",
        organisationId: "client-1",
        createdById: "user-1",
        isPrimary: false,
        hasPortalAccess: false
      })
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "masterdata.contact.create", entityId: "ct-new" })
    );
  });

  it("prefers dto.position over dto.role when both are present (deprecated alias wins)", async () => {
    const { service, prisma } = makeService();
    await service.upsertContact(
      undefined,
      {
        clientId: "client-1",
        firstName: "Bo",
        lastName: "Brown",
        position: "Director",
        role: "Manager"
      } as never
    );

    const passed = (prisma.contact.create.mock.calls[0]?.[0] as { data: AnyDto }).data;
    expect(passed.role).toBe("Director");
  });

  it("falls back to dto.role when position is absent", async () => {
    const { service, prisma } = makeService();
    await service.upsertContact(
      undefined,
      { clientId: "client-1", firstName: "Bo", lastName: "Brown", role: "Manager" } as never
    );

    const passed = (prisma.contact.create.mock.calls[0]?.[0] as { data: AnyDto }).data;
    expect(passed.role).toBe("Manager");
  });

  it("nulls role when neither position nor role is supplied", async () => {
    const { service, prisma } = makeService();
    await service.upsertContact(
      undefined,
      { clientId: "client-1", firstName: "Bo", lastName: "Brown" } as never
    );

    const passed = (prisma.contact.create.mock.calls[0]?.[0] as { data: AnyDto }).data;
    expect(passed.role).toBeNull();
  });

  it("updates without re-anchoring organisationType / organisationId / createdById", async () => {
    const { service, prisma, audit } = makeService();
    prisma.contact.update.mockResolvedValueOnce({ id: "ct-1" });

    await service.upsertContact(
      "ct-1",
      { clientId: "client-1", firstName: "Bo", lastName: "Brown" } as never,
      "user-1"
    );

    const passed = (prisma.contact.update.mock.calls[0]?.[0] as { data: AnyDto }).data;
    expect(passed).not.toHaveProperty("organisationType");
    expect(passed).not.toHaveProperty("organisationId");
    expect(passed).not.toHaveProperty("createdById");
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "masterdata.contact.update" })
    );
  });

  it("omits includeInInvoiceEmails when DTO key is absent (Prisma default applies)", async () => {
    const { service, prisma } = makeService();
    await service.upsertContact(
      undefined,
      { clientId: "client-1", firstName: "Bo", lastName: "Brown" } as never
    );

    const passed = (prisma.contact.create.mock.calls[0]?.[0] as { data: AnyDto }).data;
    expect("includeInInvoiceEmails" in passed).toBe(false);
  });

  it("forwards includeInInvoiceEmails=false explicitly when supplied", async () => {
    const { service, prisma } = makeService();
    await service.upsertContact(
      undefined,
      {
        clientId: "client-1",
        firstName: "Bo",
        lastName: "Brown",
        includeInInvoiceEmails: false
      } as never
    );

    const passed = (prisma.contact.create.mock.calls[0]?.[0] as { data: AnyDto }).data;
    expect(passed.includeInInvoiceEmails).toBe(false);
  });

  it("nulls actor on audit + createdById when no actorId is given", async () => {
    const { service, prisma, audit } = makeService();
    await service.upsertContact(
      undefined,
      { clientId: "client-1", firstName: "Bo", lastName: "Brown" } as never
    );

    const passed = (prisma.contact.create.mock.calls[0]?.[0] as { data: AnyDto }).data;
    expect(passed.createdById).toBeNull();
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: undefined })
    );
  });
});

// ─── listSites + upsertSite + getSite ───────────────────────────────────────

describe("MasterDataService — listSites", () => {
  it("includes client and orders by name asc", async () => {
    const { service, prisma } = makeService();
    await service.listSites(PAGE_QUERY);

    expect(prisma.site.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { client: true },
        orderBy: { name: "asc" }
      })
    );
  });

  it("applies q filter when supplied", async () => {
    const { service, prisma } = makeService();
    await service.listSites({ ...PAGE_QUERY, q: "depot" } as never);

    expect(prisma.site.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: "depot", mode: "insensitive" } }
      })
    );
  });
});

describe("MasterDataService — upsertSite", () => {
  it("creates and writes audit when id is undefined", async () => {
    const { service, prisma, audit } = makeService();
    prisma.site.create.mockResolvedValueOnce({ id: "site-new" });

    await service.upsertSite(undefined, { name: "Depot A" } as never, "user-1");

    expect(prisma.site.create).toHaveBeenCalledWith({ data: { name: "Depot A" } });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "masterdata.site.create",
        entityType: "Site",
        entityId: "site-new"
      })
    );
  });

  it("updates and writes update audit when id is provided", async () => {
    const { service, prisma, audit } = makeService();
    prisma.site.update.mockResolvedValueOnce({ id: "site-1" });

    await service.upsertSite("site-1", { name: "Depot A" } as never, "user-1");

    expect(prisma.site.update).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: { name: "Depot A" }
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "masterdata.site.update" })
    );
  });

  it("throws ConflictException when name collides", async () => {
    const { service, prisma } = makeService();
    prisma.site.findFirst.mockResolvedValueOnce({ id: "site-other", name: "Depot A" });

    await expect(
      service.upsertSite(undefined, { name: "Depot A" } as never)
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("MasterDataService — getSite", () => {
  it("returns null when the site does not exist", async () => {
    const { service, prisma } = makeService();
    prisma.site.findUnique.mockResolvedValueOnce(null);

    const result = await service.getSite("missing");

    expect(result).toBeNull();
    expect(prisma.tender.findMany).not.toHaveBeenCalled();
  });

  it("scopes tender lookup to siteId only when suburb is empty", async () => {
    const { service, prisma } = makeService();
    prisma.site.findUnique.mockResolvedValueOnce({
      id: "site-1",
      name: "Depot",
      suburb: null,
      client: null
    });

    await service.getSite("site-1");

    expect(prisma.tender.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ siteId: "site-1" }] },
        take: 50
      })
    );
  });

  it("adds suburb-contains notes branch when suburb is populated", async () => {
    const { service, prisma } = makeService();
    prisma.site.findUnique.mockResolvedValueOnce({
      id: "site-1",
      name: "Depot",
      suburb: "Brisbane",
      client: null
    });

    await service.getSite("site-1");

    expect(prisma.tender.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { siteId: "site-1" },
            { notes: { contains: "Brisbane", mode: "insensitive" } }
          ]
        }
      })
    );
  });

  it("de-duplicates projects reached via multiple tenders", async () => {
    const { service, prisma } = makeService();
    prisma.site.findUnique.mockResolvedValueOnce({
      id: "site-1",
      name: "Depot",
      suburb: null,
      client: null
    });
    const sharedProject = { id: "p-shared", projectNumber: "IS-P1", name: "P", status: "X", plannedStartDate: null };
    prisma.tender.findMany.mockResolvedValueOnce([
      { id: "t-1", tenderNumber: "T-1", title: "A", status: "OPEN", dueDate: null, projects: [sharedProject] },
      { id: "t-2", tenderNumber: "T-2", title: "B", status: "OPEN", dueDate: null, projects: [sharedProject] }
    ]);

    const result = await service.getSite("site-1");

    const projects = (result as { projects: unknown[] }).projects;
    expect(projects).toHaveLength(1);
    expect(projects[0]).toEqual(sharedProject);
  });

  it("strips the projects array off each tender summary in the response", async () => {
    const { service, prisma } = makeService();
    prisma.site.findUnique.mockResolvedValueOnce({
      id: "site-1",
      name: "Depot",
      suburb: null,
      client: null
    });
    prisma.tender.findMany.mockResolvedValueOnce([
      { id: "t-1", tenderNumber: "T-1", title: "A", status: "OPEN", dueDate: null, projects: [{ id: "p-1" }] }
    ]);

    const result = await service.getSite("site-1");

    const tenders = (result as { tenders: Array<{ projects?: unknown }> }).tenders;
    expect(tenders[0].projects).toBeUndefined();
  });
});

// ─── ResourceType ───────────────────────────────────────────────────────────

describe("MasterDataService — resource types", () => {
  it("list applies q filter and orders by name asc", async () => {
    const { service, prisma } = makeService();
    await service.listResourceTypes({ ...PAGE_QUERY, q: "op" } as never);

    expect(prisma.resourceType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: "op", mode: "insensitive" } },
        orderBy: { name: "asc" }
      })
    );
  });

  it("upsert creates when id is undefined and audits as create", async () => {
    const { service, prisma, audit } = makeService();
    prisma.resourceType.create.mockResolvedValueOnce({ id: "rt-new" });

    await service.upsertResourceType(
      undefined,
      { name: "Operator", category: "Worker" } as never,
      "user-1"
    );

    expect(prisma.resourceType.create).toHaveBeenCalledWith({
      data: { name: "Operator", category: "Worker" }
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "masterdata.resource-type.create",
        entityType: "ResourceType"
      })
    );
  });

  it("upsert updates when id is provided and audits as update", async () => {
    const { service, prisma, audit } = makeService();
    prisma.resourceType.update.mockResolvedValueOnce({ id: "rt-1" });

    await service.upsertResourceType(
      "rt-1",
      { name: "Operator", category: "Worker" } as never
    );

    expect(prisma.resourceType.update).toHaveBeenCalledWith({
      where: { id: "rt-1" },
      data: { name: "Operator", category: "Worker" }
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "masterdata.resource-type.update" })
    );
  });
});

// ─── Competency ─────────────────────────────────────────────────────────────

describe("MasterDataService — competencies", () => {
  it("list includes workerCompetencies and orders by name asc", async () => {
    const { service, prisma } = makeService();
    await service.listCompetencies(PAGE_QUERY);

    expect(prisma.competency.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { workerCompetencies: true },
        orderBy: { name: "asc" }
      })
    );
  });

  it("upsert creates and audits as competency.create", async () => {
    const { service, prisma, audit } = makeService();
    prisma.competency.create.mockResolvedValueOnce({ id: "comp-new" });

    await service.upsertCompetency(
      undefined,
      { name: "White Card" } as never,
      "user-1"
    );

    expect(prisma.competency.create).toHaveBeenCalledWith({ data: { name: "White Card" } });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "masterdata.competency.create",
        entityType: "Competency"
      })
    );
  });

  it("upsert updates and audits as competency.update", async () => {
    const { service, prisma, audit } = makeService();
    prisma.competency.update.mockResolvedValueOnce({ id: "comp-1" });

    await service.upsertCompetency("comp-1", { name: "White Card" } as never);

    expect(prisma.competency.update).toHaveBeenCalledWith({
      where: { id: "comp-1" },
      data: { name: "White Card" }
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "masterdata.competency.update" })
    );
  });
});

// ─── Worker ─────────────────────────────────────────────────────────────────

describe("MasterDataService — workers", () => {
  it("list searches firstName | lastName | employeeCode and orders by lastName, firstName", async () => {
    const { service, prisma } = makeService();
    await service.listWorkers({ ...PAGE_QUERY, q: "smith" } as never);

    expect(prisma.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { firstName: { contains: "smith", mode: "insensitive" } },
            { lastName: { contains: "smith", mode: "insensitive" } },
            { employeeCode: { contains: "smith", mode: "insensitive" } }
          ]
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      })
    );
  });

  it("list omits where when q is absent", async () => {
    const { service, prisma } = makeService();
    await service.listWorkers(PAGE_QUERY);

    expect(prisma.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined })
    );
  });

  it("upsert creates and audits as worker.create", async () => {
    const { service, prisma, audit } = makeService();
    prisma.worker.create.mockResolvedValueOnce({ id: "w-new" });

    await service.upsertWorker(
      undefined,
      { firstName: "Bo", lastName: "Brown" } as never,
      "user-1"
    );

    expect(prisma.worker.create).toHaveBeenCalledWith({
      data: { firstName: "Bo", lastName: "Brown" }
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "masterdata.worker.create",
        entityType: "Worker"
      })
    );
  });

  it("upsert updates and audits as worker.update", async () => {
    const { service, prisma, audit } = makeService();
    prisma.worker.update.mockResolvedValueOnce({ id: "w-1" });

    await service.upsertWorker(
      "w-1",
      { firstName: "Bo", lastName: "Brown" } as never
    );

    expect(prisma.worker.update).toHaveBeenCalledWith({
      where: { id: "w-1" },
      data: { firstName: "Bo", lastName: "Brown" }
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "masterdata.worker.update" })
    );
  });
});

// ─── Crew ───────────────────────────────────────────────────────────────────

describe("MasterDataService — crews", () => {
  it("list includes members with their joined worker and orders by name asc", async () => {
    const { service, prisma } = makeService();
    await service.listCrews(PAGE_QUERY);

    expect(prisma.crew.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { members: { include: { worker: true } } },
        orderBy: { name: "asc" }
      })
    );
  });

  it("create enforces unique name", async () => {
    const { service, prisma } = makeService();
    prisma.crew.findFirst.mockResolvedValueOnce({ id: "crew-other", name: "Crew A" });

    await expect(
      service.upsertCrew(undefined, { name: "Crew A" } as never)
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.crew.create).not.toHaveBeenCalled();
  });

  it("update does NOT enforce unique name (rename is allowed)", async () => {
    const { service, prisma } = makeService();
    prisma.crew.update.mockResolvedValueOnce({ id: "crew-1" });
    // Even if findFirst would match, the service must not call it on update.
    prisma.crew.findFirst.mockResolvedValueOnce({ id: "crew-other", name: "Crew A" });

    await service.upsertCrew("crew-1", { name: "Crew A" } as never);

    expect(prisma.crew.findFirst).not.toHaveBeenCalled();
    expect(prisma.crew.update).toHaveBeenCalled();
  });

  it("create persists only the four crew fields, not workerIds", async () => {
    const { service, prisma } = makeService();
    prisma.crew.create.mockResolvedValueOnce({ id: "crew-new" });

    await service.upsertCrew(
      undefined,
      { name: "Crew A", code: "CA", description: "desc", status: "ACTIVE", workerIds: ["w-1"] } as never
    );

    expect(prisma.crew.create).toHaveBeenCalledWith({
      data: { name: "Crew A", code: "CA", description: "desc", status: "ACTIVE" }
    });
  });

  it("replaces members wholesale when workerIds is supplied (delete then create)", async () => {
    const { service, prisma } = makeService();
    prisma.crew.create.mockResolvedValueOnce({ id: "crew-new" });

    await service.upsertCrew(
      undefined,
      { name: "Crew A", workerIds: ["w-1", "w-2"] } as never
    );

    expect(prisma.crewWorker.deleteMany).toHaveBeenCalledWith({
      where: { crewId: "crew-new" }
    });
    expect(prisma.crewWorker.createMany).toHaveBeenCalledWith({
      data: [
        { crewId: "crew-new", workerId: "w-1" },
        { crewId: "crew-new", workerId: "w-2" }
      ]
    });
  });

  it("clears members when workerIds is an empty array (delete only, no create)", async () => {
    const { service, prisma } = makeService();
    prisma.crew.update.mockResolvedValueOnce({ id: "crew-1" });

    await service.upsertCrew("crew-1", { name: "Crew A", workerIds: [] } as never);

    expect(prisma.crewWorker.deleteMany).toHaveBeenCalledWith({ where: { crewId: "crew-1" } });
    expect(prisma.crewWorker.createMany).not.toHaveBeenCalled();
  });

  it("leaves membership untouched when workerIds is omitted", async () => {
    const { service, prisma } = makeService();
    prisma.crew.update.mockResolvedValueOnce({ id: "crew-1" });

    await service.upsertCrew("crew-1", { name: "Crew A" } as never);

    expect(prisma.crewWorker.deleteMany).not.toHaveBeenCalled();
    expect(prisma.crewWorker.createMany).not.toHaveBeenCalled();
  });

  it("audits crew.create on create and crew.update on update", async () => {
    const { service, prisma, audit } = makeService();
    prisma.crew.create.mockResolvedValueOnce({ id: "crew-new" });
    await service.upsertCrew(undefined, { name: "Crew A" } as never, "user-1");
    expect(audit.write).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "masterdata.crew.create", entityType: "Crew" })
    );

    prisma.crew.update.mockResolvedValueOnce({ id: "crew-1" });
    await service.upsertCrew("crew-1", { name: "Crew A" } as never, "user-1");
    expect(audit.write).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "masterdata.crew.update", entityType: "Crew" })
    );
  });
});

// ─── Asset ──────────────────────────────────────────────────────────────────

describe("MasterDataService — assets", () => {
  it("list searches name | assetCode and includes resourceType", async () => {
    const { service, prisma } = makeService();
    await service.listAssets({ ...PAGE_QUERY, q: "ex" } as never);

    expect(prisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: "ex", mode: "insensitive" } },
            { assetCode: { contains: "ex", mode: "insensitive" } }
          ]
        },
        include: { resourceType: true },
        orderBy: { name: "asc" }
      })
    );
  });

  it("upsert creates and audits as asset.create", async () => {
    const { service, prisma, audit } = makeService();
    prisma.asset.create.mockResolvedValueOnce({ id: "asset-new" });

    await service.upsertAsset(
      undefined,
      { name: "Excavator 1", assetCode: "EX-001" } as never,
      "user-1"
    );

    expect(prisma.asset.create).toHaveBeenCalledWith({
      data: { name: "Excavator 1", assetCode: "EX-001" }
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "masterdata.asset.create",
        entityType: "Asset"
      })
    );
  });

  it("upsert updates and audits as asset.update", async () => {
    const { service, prisma, audit } = makeService();
    prisma.asset.update.mockResolvedValueOnce({ id: "asset-1" });

    await service.upsertAsset(
      "asset-1",
      { name: "Excavator 1", assetCode: "EX-001" } as never
    );

    expect(prisma.asset.update).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: { name: "Excavator 1", assetCode: "EX-001" }
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "masterdata.asset.update" })
    );
  });
});

// ─── WorkerCompetency ───────────────────────────────────────────────────────

describe("MasterDataService — worker competencies", () => {
  it("list searches across nested worker.firstName / worker.lastName / competency.name", async () => {
    const { service, prisma } = makeService();
    await service.listWorkerCompetencies({ ...PAGE_QUERY, q: "card" } as never);

    expect(prisma.workerCompetency.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { worker: { firstName: { contains: "card", mode: "insensitive" } } },
            { worker: { lastName: { contains: "card", mode: "insensitive" } } },
            { competency: { name: { contains: "card", mode: "insensitive" } } }
          ]
        },
        include: { worker: true, competency: true },
        orderBy: { createdAt: "desc" }
      })
    );
  });

  it("upsert coerces achievedAt / expiresAt ISO strings to Date instances", async () => {
    const { service, prisma } = makeService();
    prisma.workerCompetency.create.mockResolvedValueOnce({ id: "wc-new" });

    await service.upsertWorkerCompetency(
      undefined,
      {
        workerId: "w-1",
        competencyId: "comp-1",
        achievedAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2027-01-01T00:00:00.000Z",
        notes: "ok"
      } as never
    );

    const passed = (prisma.workerCompetency.create.mock.calls[0]?.[0] as { data: AnyDto }).data;
    expect(passed.workerId).toBe("w-1");
    expect(passed.competencyId).toBe("comp-1");
    expect(passed.achievedAt).toBeInstanceOf(Date);
    expect(passed.expiresAt).toBeInstanceOf(Date);
    expect((passed.achievedAt as Date).toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect((passed.expiresAt as Date).toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(passed.notes).toBe("ok");
  });

  it("upsert leaves achievedAt / expiresAt undefined when DTO omits them", async () => {
    const { service, prisma } = makeService();
    await service.upsertWorkerCompetency(
      undefined,
      { workerId: "w-1", competencyId: "comp-1" } as never
    );

    const passed = (prisma.workerCompetency.create.mock.calls[0]?.[0] as { data: AnyDto }).data;
    expect(passed.achievedAt).toBeUndefined();
    expect(passed.expiresAt).toBeUndefined();
  });

  it("audits as worker-competency.create on create and .update on update", async () => {
    const { service, prisma, audit } = makeService();
    prisma.workerCompetency.create.mockResolvedValueOnce({ id: "wc-new" });
    await service.upsertWorkerCompetency(
      undefined,
      { workerId: "w-1", competencyId: "comp-1" } as never,
      "user-1"
    );
    expect(audit.write).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: "masterdata.worker-competency.create",
        entityType: "WorkerCompetency"
      })
    );

    prisma.workerCompetency.update.mockResolvedValueOnce({ id: "wc-1" });
    await service.upsertWorkerCompetency(
      "wc-1",
      { workerId: "w-1", competencyId: "comp-1" } as never,
      "user-1"
    );
    expect(audit.write).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "masterdata.worker-competency.update" })
    );
  });
});

// ─── LookupValue ────────────────────────────────────────────────────────────

describe("MasterDataService — lookup values", () => {
  it("list orders by category asc then sortOrder asc", async () => {
    const { service, prisma } = makeService();
    await service.listLookupValues(PAGE_QUERY);

    expect(prisma.lookupValue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }]
      })
    );
  });

  it("list searches category | key | value when q is supplied", async () => {
    const { service, prisma } = makeService();
    await service.listLookupValues({ ...PAGE_QUERY, q: "status" } as never);

    expect(prisma.lookupValue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { category: { contains: "status", mode: "insensitive" } },
            { key: { contains: "status", mode: "insensitive" } },
            { value: { contains: "status", mode: "insensitive" } }
          ]
        }
      })
    );
  });

  it("upsert creates and audits as lookup.create", async () => {
    const { service, prisma, audit } = makeService();
    prisma.lookupValue.create.mockResolvedValueOnce({ id: "lv-new" });

    await service.upsertLookupValue(
      undefined,
      { category: "site_status", key: "ACTIVE", value: "Active" } as never,
      "user-1"
    );

    expect(prisma.lookupValue.create).toHaveBeenCalledWith({
      data: { category: "site_status", key: "ACTIVE", value: "Active" }
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "masterdata.lookup.create",
        entityType: "LookupValue"
      })
    );
  });

  it("upsert updates and audits as lookup.update", async () => {
    const { service, prisma, audit } = makeService();
    prisma.lookupValue.update.mockResolvedValueOnce({ id: "lv-1" });

    await service.upsertLookupValue(
      "lv-1",
      { category: "site_status", key: "ACTIVE", value: "Active" } as never
    );

    expect(prisma.lookupValue.update).toHaveBeenCalledWith({
      where: { id: "lv-1" },
      data: { category: "site_status", key: "ACTIVE", value: "Active" }
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "masterdata.lookup.update" })
    );
  });
});

// ─── paginate helper ────────────────────────────────────────────────────────

describe("MasterDataService — paginate slicing", () => {
  it("returns the correct slice for page 2 with pageSize 2 (items 3-4 of 5)", async () => {
    const { service, prisma } = makeService();
    prisma.client.findMany.mockResolvedValueOnce([
      { id: "c-1" },
      { id: "c-2" },
      { id: "c-3" },
      { id: "c-4" },
      { id: "c-5" }
    ]);
    prisma.client.count.mockResolvedValueOnce(5);

    const result = await service.listClients({ page: 2, pageSize: 2 } as never);

    const ids = (result.items as Array<{ id: string }>).map((c) => c.id);
    expect(ids).toEqual(["c-3", "c-4"]);
    expect(result.total).toBe(5);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(2);
  });

  it("returns an empty slice when page is past the last page", async () => {
    const { service, prisma } = makeService();
    prisma.site.findMany.mockResolvedValueOnce([{ id: "s-1" }]);
    prisma.site.count.mockResolvedValueOnce(1);

    const result = await service.listSites({ page: 5, pageSize: 10 } as never);

    expect(result.items).toEqual([]);
    expect(result.total).toBe(1);
  });
});

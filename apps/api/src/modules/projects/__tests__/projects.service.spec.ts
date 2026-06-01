import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { Prisma, ProjectStatus } from "@prisma/client";
import { ProjectsService } from "../projects.service";

// ─── Test fixtures ─────────────────────────────────────────────────────────

const ACTOR_ADMIN = {
  userId: "user-admin",
  permissions: new Set(["projects.admin", "projects.manage"])
};
const ACTOR_MANAGER = {
  userId: "user-manager",
  permissions: new Set(["projects.manage"])
};

function decimal(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function hydratedProject(overrides: Record<string, unknown> = {}) {
  return {
    id: "p-1",
    projectNumber: "IS-P001",
    name: "Test Project",
    status: ProjectStatus.MOBILISING,
    clientId: "c-1",
    siteAddressLine1: "1 Site St",
    siteAddressLine2: null,
    siteAddressSuburb: "Brisbane",
    siteAddressState: "QLD",
    siteAddressPostcode: "4000",
    contractValue: decimal("100000"),
    budget: decimal("90000"),
    actualCost: decimal("0"),
    proposedStartDate: null,
    actualStartDate: null,
    practicalCompletionDate: null,
    closedDate: null,
    projectManagerId: null,
    supervisorId: null,
    estimatorId: null,
    whsOfficerId: null,
    sourceTenderId: null,
    client: { id: "c-1", name: "Acme Pty Ltd" },
    sourceTender: null,
    projectManager: null,
    supervisor: null,
    estimator: null,
    whsOfficer: null,
    scopeItems: [],
    milestones: [],
    activityLog: [],
    ...overrides
  };
}

// ─── Mock builders ─────────────────────────────────────────────────────────

type TxClient = {
  $executeRaw: jest.Mock;
  projectNumberSequence: { upsert: jest.Mock };
  project: { create: jest.Mock };
  projectActivityLog: { create: jest.Mock };
  projectScopeItem: { createMany: jest.Mock };
  tenderDocumentLink: { updateMany: jest.Mock };
};

function buildTxClient(): TxClient {
  return {
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    projectNumberSequence: {
      upsert: jest.fn().mockResolvedValue({ lastNumber: 7 })
    },
    project: {
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "p-new",
        ...data
      }))
    },
    projectActivityLog: { create: jest.fn().mockResolvedValue({}) },
    projectScopeItem: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    tenderDocumentLink: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) }
  };
}

function buildPrismaMock() {
  const tx = buildTxClient();
  const defaultHydrated = hydratedProject();
  const prisma = {
    projectNumberSequence: {
      findUnique: jest.fn().mockResolvedValue({ lastNumber: 7 })
    },
    project: {
      findUnique: jest.fn().mockResolvedValue(defaultHydrated),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      update: jest
        .fn()
        .mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
          ...defaultHydrated,
          id: where.id,
          ...data
        })),
      create: jest
        .fn()
        .mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "p-new", ...data }))
    },
    client: { findUnique: jest.fn().mockResolvedValue({ id: "c-1", name: "Acme Pty Ltd" }) },
    tender: { findUnique: jest.fn() },
    contract: { count: jest.fn().mockResolvedValue(0) },
    projectActivityLog: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    $transaction: jest.fn().mockImplementation(async (input: unknown) => {
      if (typeof input === "function") {
        return (input as (client: TxClient) => Promise<unknown>)(tx);
      }
      return Promise.all(input as Array<Promise<unknown>>);
    })
  };
  return { prisma, tx };
}

function buildService() {
  const { prisma, tx } = buildPrismaMock();
  const audit = { write: jest.fn().mockResolvedValue(undefined) };
  const notifications = { create: jest.fn().mockResolvedValue(undefined) };
  const email = { sendNotificationEmail: jest.fn().mockResolvedValue(undefined) };
  const service = new ProjectsService(
    prisma as never,
    audit as never,
    notifications as never,
    email as never
  );
  return { service, prisma, tx, audit, notifications, email };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("ProjectsService.previewNextNumber", () => {
  it("returns IS-P001 when the sequence has no row yet", async () => {
    const { service, prisma } = buildService();
    prisma.projectNumberSequence.findUnique.mockResolvedValueOnce(null);
    await expect(service.previewNextNumber()).resolves.toEqual({ nextNumber: "IS-P001" });
  });

  it("formats the next number from the existing sequence row", async () => {
    const { service, prisma } = buildService();
    prisma.projectNumberSequence.findUnique.mockResolvedValueOnce({ lastNumber: 41 });
    await expect(service.previewNextNumber()).resolves.toEqual({ nextNumber: "IS-P042" });
  });
});

describe("ProjectsService.getById", () => {
  it("returns the project with stringified decimals and variance", async () => {
    const { service, prisma } = buildService();
    prisma.project.findUnique.mockResolvedValueOnce(
      hydratedProject({ contractValue: decimal("200000"), budget: decimal("150000"), actualCost: decimal("40000") })
    );

    const result = await service.getById("p-1");

    expect(result.contractValue).toBe("200000");
    expect(result.budget).toBe("150000");
    expect(result.actualCost).toBe("40000");
    expect(result.variance).toBe("110000.00");
  });

  it("throws NotFoundException when the project does not exist", async () => {
    const { service, prisma } = buildService();
    prisma.project.findUnique.mockResolvedValueOnce(null);
    await expect(service.getById("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ProjectsService.list", () => {
  it("applies pagination defaults and an empty where clause when no filters are given", async () => {
    const { service, prisma } = buildService();
    prisma.project.findMany.mockResolvedValueOnce([]);
    prisma.project.count.mockResolvedValueOnce(0);

    const result = await service.list({} as never);

    expect(result.page).toBe(1);
    expect(result.limit).toBe(25);
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 0, take: 25 })
    );
  });

  it("builds the where clause from status, clientId, pmId and search filters", async () => {
    const { service, prisma } = buildService();
    prisma.project.findMany.mockResolvedValueOnce([]);
    prisma.project.count.mockResolvedValueOnce(0);

    await service.list({
      status: "MOBILISING,ACTIVE",
      clientId: "c-1",
      pmId: "u-1",
      search: "bridge",
      page: "2",
      limit: "10"
    } as never);

    const call = prisma.project.findMany.mock.calls[0][0] as { where: Record<string, unknown>; skip: number; take: number };
    expect(call.skip).toBe(10);
    expect(call.take).toBe(10);
    expect(call.where).toMatchObject({
      status: { in: ["MOBILISING", "ACTIVE"] },
      clientId: "c-1",
      projectManagerId: "u-1",
      OR: [
        { projectNumber: { contains: "bridge", mode: "insensitive" } },
        { name: { contains: "bridge", mode: "insensitive" } }
      ]
    });
  });
});

describe("ProjectsService.createManual", () => {
  it("throws BadRequestException when the client cannot be found", async () => {
    const { service, prisma } = buildService();
    prisma.client.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.createManual(
        {
          name: "New project",
          clientId: "missing",
          siteAddressLine1: "1 Site St",
          siteAddressSuburb: "Brisbane",
          siteAddressState: "QLD",
          siteAddressPostcode: "4000"
        } as never,
        ACTOR_MANAGER
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allocates a project number, writes a creation activity log, writes audit, and notifies the PM", async () => {
    const { service, prisma, tx, audit, notifications } = buildService();
    tx.projectNumberSequence.upsert.mockResolvedValueOnce({ lastNumber: 7 });

    await service.createManual(
      {
        name: "Bridge upgrade",
        clientId: "c-1",
        siteAddressLine1: "1 Site St",
        siteAddressSuburb: "Brisbane",
        siteAddressState: "QLD",
        siteAddressPostcode: "4000",
        contractValue: "100000",
        budget: "90000",
        projectManagerId: "pm-1"
      } as never,
      ACTOR_MANAGER
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectNumber: "IS-P007",
          name: "Bridge upgrade",
          clientId: "c-1",
          projectManagerId: "pm-1",
          createdById: ACTOR_MANAGER.userId
        })
      })
    );
    expect(tx.projectActivityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: ACTOR_MANAGER.userId,
          action: "PROJECT_CREATED",
          details: { source: "manual" }
        })
      })
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "projects.create",
        entityType: "Project",
        metadata: expect.objectContaining({ source: "manual", projectNumber: "IS-P007" })
      })
    );
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "pm-1", title: expect.stringContaining("IS-P007") }),
      "pm-1"
    );
  });

  it("skips PM notification when no projectManagerId is supplied", async () => {
    const { service, notifications } = buildService();

    await service.createManual(
      {
        name: "Bridge upgrade",
        clientId: "c-1",
        siteAddressLine1: "1 Site St",
        siteAddressSuburb: "Brisbane",
        siteAddressState: "QLD",
        siteAddressPostcode: "4000"
      } as never,
      ACTOR_MANAGER
    );

    expect(notifications.create).not.toHaveBeenCalled();
  });
});

describe("ProjectsService.update", () => {
  it("throws NotFoundException when the project does not exist", async () => {
    const { service, prisma } = buildService();
    prisma.project.findUnique.mockResolvedValueOnce(null);
    await expect(service.update("missing", { name: "Renamed" } as never, ACTOR_MANAGER)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("throws ForbiddenException when contractValue is changed without projects.admin", async () => {
    const { service, prisma } = buildService();
    prisma.project.findUnique.mockResolvedValueOnce(hydratedProject());

    await expect(
      service.update("p-1", { contractValue: "200000" } as never, ACTOR_MANAGER)
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("logs a CONTRACT_VALUE_CHANGED activity when the admin changes contract value", async () => {
    const { service, prisma, audit } = buildService();
    prisma.project.findUnique.mockResolvedValueOnce(
      hydratedProject({ contractValue: decimal("100000") })
    );

    await service.update("p-1", { contractValue: "200000" } as never, ACTOR_ADMIN);

    expect(prisma.projectActivityLog.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          projectId: "p-1",
          action: "CONTRACT_VALUE_CHANGED",
          details: { from: "100000", to: "200000" }
        })
      ]
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "projects.update", entityId: "p-1" })
    );
  });

  it("logs a TEAM_CHANGED activity when a team field changes", async () => {
    const { service, prisma } = buildService();
    prisma.project.findUnique.mockResolvedValueOnce(
      hydratedProject({ projectManagerId: "pm-old" })
    );

    await service.update("p-1", { projectManagerId: "pm-new" } as never, ACTOR_MANAGER);

    expect(prisma.projectActivityLog.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          action: "TEAM_CHANGED",
          details: { field: "projectManagerId", from: "pm-old", to: "pm-new" }
        })
      ]
    });
  });

  it("does not write an activity log when only no-op fields are set", async () => {
    const { service, prisma } = buildService();
    prisma.project.findUnique.mockResolvedValueOnce(hydratedProject({ projectManagerId: "pm-1" }));

    await service.update("p-1", { projectManagerId: "pm-1" } as never, ACTOR_MANAGER);

    expect(prisma.projectActivityLog.createMany).not.toHaveBeenCalled();
  });
});

describe("ProjectsService.transitionStatus", () => {
  it("throws NotFoundException when the project is missing", async () => {
    const { service, prisma } = buildService();
    prisma.project.findUnique.mockResolvedValueOnce(null);
    await expect(service.transitionStatus("missing", { status: "ACTIVE" } as never, ACTOR_MANAGER)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("returns the project unchanged when the status is the same as the current one", async () => {
    const { service, prisma } = buildService();
    prisma.project.findUnique.mockResolvedValue(hydratedProject({ status: ProjectStatus.ACTIVE }));

    const result = await service.transitionStatus("p-1", { status: "ACTIVE" } as never, ACTOR_MANAGER);

    expect(prisma.project.update).not.toHaveBeenCalled();
    expect(result.status).toBe(ProjectStatus.ACTIVE);
  });

  it("throws BadRequestException for an invalid transition", async () => {
    const { service, prisma } = buildService();
    prisma.project.findUnique.mockResolvedValueOnce(hydratedProject({ status: ProjectStatus.MOBILISING }));

    await expect(
      service.transitionStatus("p-1", { status: "CLOSED" } as never, ACTOR_MANAGER)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws BadRequestException when actualStartDate is missing on MOBILISING → ACTIVE", async () => {
    const { service, prisma } = buildService();
    prisma.project.findUnique.mockResolvedValueOnce(hydratedProject({ status: ProjectStatus.MOBILISING }));

    await expect(
      service.transitionStatus("p-1", { status: "ACTIVE" } as never, ACTOR_MANAGER)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws BadRequestException when practicalCompletionDate is missing on ACTIVE → PRACTICAL_COMPLETION", async () => {
    const { service, prisma } = buildService();
    prisma.project.findUnique.mockResolvedValueOnce(hydratedProject({ status: ProjectStatus.ACTIVE }));

    await expect(
      service.transitionStatus("p-1", { status: "PRACTICAL_COMPLETION" } as never, ACTOR_MANAGER)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws BadRequestException when closedDate is missing on DEFECTS → CLOSED", async () => {
    const { service, prisma } = buildService();
    prisma.project.findUnique.mockResolvedValueOnce(hydratedProject({ status: ProjectStatus.DEFECTS }));

    await expect(
      service.transitionStatus("p-1", { status: "CLOSED" } as never, ACTOR_MANAGER)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws ForbiddenException when a non-admin tries to reopen a CLOSED project", async () => {
    const { service, prisma } = buildService();
    prisma.project.findUnique.mockResolvedValueOnce(hydratedProject({ status: ProjectStatus.CLOSED }));

    await expect(
      service.transitionStatus("p-1", { status: "MOBILISING" } as never, ACTOR_MANAGER)
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("performs a valid transition, writes activity, audit, notifications and an email", async () => {
    const { service, prisma, audit, notifications, email } = buildService();
    prisma.project.findUnique.mockResolvedValue(
      hydratedProject({
        status: ProjectStatus.MOBILISING,
        projectManagerId: "pm-1",
        supervisorId: "sup-1"
      })
    );
    prisma.project.update.mockResolvedValueOnce({
      ...hydratedProject({
        status: ProjectStatus.ACTIVE,
        projectManagerId: "pm-1",
        supervisorId: "sup-1"
      })
    });

    await service.transitionStatus(
      "p-1",
      { status: "ACTIVE", actualStartDate: "2026-06-01" } as never,
      ACTOR_MANAGER
    );

    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p-1" },
        data: expect.objectContaining({ status: ProjectStatus.ACTIVE })
      })
    );
    expect(prisma.projectActivityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "STATUS_CHANGED",
          details: expect.objectContaining({ from: ProjectStatus.MOBILISING, to: ProjectStatus.ACTIVE })
        })
      })
    );
    expect(email.sendNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: "project.status_changed" })
    );
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "projects.status",
        metadata: { from: ProjectStatus.MOBILISING, to: ProjectStatus.ACTIVE }
      })
    );
  });
});

describe("ProjectsService.convertFromTender", () => {
  it("throws NotFoundException when the tender does not exist", async () => {
    const { service, prisma } = buildService();
    prisma.tender.findUnique.mockResolvedValueOnce(null);

    await expect(service.convertFromTender("missing", ACTOR_MANAGER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws BadRequestException when the tender is not AWARDED", async () => {
    const { service, prisma } = buildService();
    prisma.tender.findUnique.mockResolvedValueOnce({
      id: "t-1",
      status: "IN_PROGRESS",
      tenderClients: [],
      estimate: null
    });

    await expect(service.convertFromTender("t-1", ACTOR_MANAGER)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws ConflictException when the tender has already been converted", async () => {
    const { service, prisma } = buildService();
    prisma.tender.findUnique.mockResolvedValueOnce({
      id: "t-1",
      status: "AWARDED",
      tenderClients: [{ clientId: "c-1", isAwarded: true }],
      estimate: null
    });
    prisma.project.findFirst.mockResolvedValueOnce({ id: "p-existing", projectNumber: "IS-P002" });

    await expect(service.convertFromTender("t-1", ACTOR_MANAGER)).rejects.toBeInstanceOf(ConflictException);
  });

  it("throws BadRequestException when the AWARDED tender has no linked client", async () => {
    const { service, prisma } = buildService();
    prisma.tender.findUnique.mockResolvedValueOnce({
      id: "t-1",
      status: "AWARDED",
      tenderClients: [],
      estimate: null
    });

    await expect(service.convertFromTender("t-1", ACTOR_MANAGER)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("ProjectsService.activity", () => {
  it("clamps page and limit and returns paginated activity rows", async () => {
    const { service, prisma } = buildService();
    prisma.projectActivityLog.findMany.mockResolvedValueOnce([{ id: "a-1" }]);
    prisma.projectActivityLog.count.mockResolvedValueOnce(1);

    const result = await service.activity("p-1", 0, 500);

    expect(result).toMatchObject({ items: [{ id: "a-1" }], total: 1, page: 1, limit: 100 });
    expect(prisma.projectActivityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: "p-1" }, skip: 0, take: 100 })
    );
  });
});

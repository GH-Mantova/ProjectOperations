// Mock-based unit tests for SafetyService — incident reports and hazard
// observations (§13 Forms & Compliance). Mirrors the house pattern
// (quote.service.spec.ts / jobs.service.spec.ts): Prisma is a plain object
// of jest.fn()s, the service is instantiated directly with `as never` casts.
//
// Coverage emphasis (backlog pr-89): sequence-backed IS-INC### / IS-HAZ###
// numbering (the LL-26 neighbourhood — transaction-scoped upserts), the
// fire-and-forget notification fan-out to safety.admin holders (plus the
// critical-severity email and hazard-assignee dedup), enum/required-field
// validation, and the NotFound guard paths.

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SafetyService } from "../safety.service";

const ACTOR = "user-actor";

// Lets the unawaited `void this.notifyIncident(...)` fan-out settle before
// the test asserts on the notification mocks.
const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

const incidentInput = (overrides: Record<string, unknown> = {}) => ({
  incidentDate: "2026-06-01T00:00:00.000Z",
  location: "Depot yard",
  incidentType: "near_miss",
  severity: "low",
  description: "Forklift reversed without spotter",
  ...overrides
});

const hazardInput = (overrides: Record<string, unknown> = {}) => ({
  observationDate: "2026-06-01T00:00:00.000Z",
  location: "Site shed",
  hazardType: "electrical",
  riskLevel: "medium",
  description: "Frayed extension lead",
  ...overrides
});

function buildService(extraPrisma: Record<string, unknown> = {}) {
  const prisma: Record<string, unknown> = {
    safetyIncident: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ id: "inc-1" }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "inc-new", ...args.data })
      ),
      update: jest.fn().mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ id: args.where.id, ...args.data })
      ),
      groupBy: jest.fn().mockResolvedValue([])
    },
    hazardObservation: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ id: "haz-1" }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "haz-new", ...args.data })
      ),
      update: jest.fn().mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ id: args.where.id, ...args.data })
      ),
      groupBy: jest.fn().mockResolvedValue([])
    },
    safetyIncidentNumberSequence: {
      upsert: jest.fn().mockResolvedValue({ id: 1, lastNumber: 1 })
    },
    hazardNumberSequence: {
      upsert: jest.fn().mockResolvedValue({ id: 1, lastNumber: 1 })
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null)
    },
    $transaction: jest.fn().mockImplementation((input: unknown) => {
      if (typeof input === "function") {
        return (input as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(input as Array<Promise<unknown>>);
    }),
    ...extraPrisma
  };

  const notifications = { create: jest.fn().mockResolvedValue({ id: "notif-1" }) };
  const email = { sendNotificationEmail: jest.fn().mockResolvedValue(undefined) };

  const service = new SafetyService(prisma as never, notifications as never, email as never);

  return { service, prisma, notifications, email };
}

// ─── Incident numbering ────────────────────────────────────────────────────

describe("SafetyService incident numbering", () => {
  it("issues IS-INC numbers from the sequence upsert inside a transaction", async () => {
    const { service, prisma } = buildService();
    (prisma.safetyIncidentNumberSequence as { upsert: jest.Mock }).upsert.mockResolvedValueOnce({
      id: 1,
      lastNumber: 7
    });

    const created = await service.createIncident(incidentInput(), ACTOR);

    expect((prisma.safetyIncidentNumberSequence as { upsert: jest.Mock }).upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      create: { id: 1, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } }
    });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(created.incidentNumber).toBe("IS-INC007");
  });

  it("pads the incident number to three digits and grows past 999 without truncation", async () => {
    const { service, prisma } = buildService();
    const upsert = (prisma.safetyIncidentNumberSequence as { upsert: jest.Mock }).upsert;

    upsert.mockResolvedValueOnce({ id: 1, lastNumber: 42 });
    const a = await service.createIncident(incidentInput(), ACTOR);
    upsert.mockResolvedValueOnce({ id: 1, lastNumber: 1000 });
    const b = await service.createIncident(incidentInput(), ACTOR);

    expect(a.incidentNumber).toBe("IS-INC042");
    expect(b.incidentNumber).toBe("IS-INC1000");
  });

  it("issues distinct sequential numbers for back-to-back creates (collision path)", async () => {
    const { service, prisma } = buildService();
    let last = 0;
    (prisma.safetyIncidentNumberSequence as { upsert: jest.Mock }).upsert.mockImplementation(() => {
      last += 1;
      return Promise.resolve({ id: 1, lastNumber: last });
    });

    const [first, second] = [
      await service.createIncident(incidentInput(), ACTOR),
      await service.createIncident(incidentInput(), ACTOR)
    ];

    expect(first.incidentNumber).toBe("IS-INC001");
    expect(second.incidentNumber).toBe("IS-INC002");
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});

describe("SafetyService hazard numbering", () => {
  it("issues IS-HAZ numbers from the dedicated hazard sequence", async () => {
    const { service, prisma } = buildService();
    (prisma.hazardNumberSequence as { upsert: jest.Mock }).upsert.mockResolvedValueOnce({
      id: 1,
      lastNumber: 13
    });

    const created = await service.createHazard(hazardInput(), ACTOR);

    expect((prisma.hazardNumberSequence as { upsert: jest.Mock }).upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      create: { id: 1, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } }
    });
    expect(created.hazardNumber).toBe("IS-HAZ013");
    // The incident sequence must not be touched by hazard creation.
    expect((prisma.safetyIncidentNumberSequence as { upsert: jest.Mock }).upsert).not.toHaveBeenCalled();
  });
});

// ─── createIncident validation + persistence ───────────────────────────────

describe("SafetyService.createIncident", () => {
  it.each([
    ["incidentType", incidentInput({ incidentType: "explosion" })],
    ["severity", incidentInput({ severity: "catastrophic" })]
  ])("rejects an invalid %s with 400", async (_field, input) => {
    const { service } = buildService();
    await expect(service.createIncident(input, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ["location", incidentInput({ location: "   " })],
    ["description", incidentInput({ description: "" })]
  ])("rejects an empty %s with 400", async (_field, input) => {
    const { service } = buildService();
    await expect(service.createIncident(input, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("persists trimmed fields, the actor as reporter, and array defaults", async () => {
    const { service, prisma } = buildService();

    await service.createIncident(
      incidentInput({ location: "  Depot yard  ", description: "  Near miss  " }),
      ACTOR
    );

    expect((prisma.safetyIncident as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reportedById: ACTOR,
        location: "Depot yard",
        description: "Near miss",
        tenderId: null,
        projectId: null,
        witnesses: [],
        documentPaths: [],
        incidentDate: new Date("2026-06-01T00:00:00.000Z")
      })
    });
  });

  it("passes through tender/project links, witnesses, and document paths", async () => {
    const { service, prisma } = buildService();

    await service.createIncident(
      incidentInput({
        tenderId: "tender-1",
        projectId: "project-1",
        witnesses: ["Jane Site"],
        documentPaths: ["1. Operations/photo.jpg"]
      }),
      ACTOR
    );

    expect((prisma.safetyIncident as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenderId: "tender-1",
        projectId: "project-1",
        witnesses: ["Jane Site"],
        documentPaths: ["1. Operations/photo.jpg"]
      })
    });
  });
});

// ─── Incident notification fan-out ─────────────────────────────────────────

describe("SafetyService incident notifications", () => {
  const admins = [
    { id: "admin-1", email: "a1@projectops.local" },
    { id: "admin-2", email: "a2@projectops.local" }
  ];

  it("notifies every safety.admin holder after a create", async () => {
    const { service, prisma, notifications } = buildService();
    (prisma.user as { findMany: jest.Mock }).findMany.mockResolvedValue(admins);

    await service.createIncident(incidentInput(), ACTOR);
    await flushAsync();

    expect((prisma.user as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          userRoles: {
            some: { role: { rolePermissions: { some: { permission: { code: "safety.admin" } } } } }
          }
        })
      })
    );
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-1", severity: "LOW", linkUrl: "/safety?incident=inc-new" })
    );
  });

  it("sends the critical-severity email and HIGH in-app severity for critical incidents", async () => {
    const { service, prisma, notifications, email } = buildService();
    (prisma.user as { findMany: jest.Mock }).findMany.mockResolvedValue([admins[0]]);

    await service.createIncident(incidentInput({ severity: "critical" }), ACTOR);
    await flushAsync();

    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ severity: "HIGH" }));
    expect(email.sendNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: "safety.incident_critical",
        subject: expect.stringContaining("[CRITICAL]")
      })
    );
  });

  it("does not email for non-critical incidents", async () => {
    const { service, prisma, email } = buildService();
    (prisma.user as { findMany: jest.Mock }).findMany.mockResolvedValue([admins[0]]);

    await service.createIncident(incidentInput({ severity: "high" }), ACTOR);
    await flushAsync();

    expect(email.sendNotificationEmail).not.toHaveBeenCalled();
  });

  it("truncates long descriptions to 160 chars in the notification body", async () => {
    const { service, prisma, notifications } = buildService();
    (prisma.user as { findMany: jest.Mock }).findMany.mockResolvedValue([admins[0]]);
    const longDescription = "x".repeat(200);

    await service.createIncident(incidentInput({ description: longDescription }), ACTOR);
    await flushAsync();

    const body = (notifications.create.mock.calls[0][0] as { body: string }).body;
    // 157 kept chars + the ellipsis.
    expect(body).toHaveLength(158);
    expect(body.endsWith("…")).toBe(true);
  });

  it("still resolves the create when the notification fan-out fails", async () => {
    const { service, prisma, notifications } = buildService();
    (prisma.user as { findMany: jest.Mock }).findMany.mockResolvedValue([admins[0]]);
    notifications.create.mockRejectedValue(new Error("notification store down"));

    await expect(service.createIncident(incidentInput(), ACTOR)).resolves.toMatchObject({
      id: "inc-new"
    });
    await flushAsync();
  });
});

// ─── Hazard notification fan-out ───────────────────────────────────────────

describe("SafetyService hazard notifications", () => {
  it("notifies safety admins plus the assignee, de-duplicated", async () => {
    const { service, prisma, notifications } = buildService();
    (prisma.user as { findMany: jest.Mock }).findMany.mockResolvedValue([
      { id: "admin-1", email: "a1@projectops.local" }
    ]);
    (prisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
      id: "worker-9",
      email: "w9@projectops.local"
    });

    await service.createHazard(hazardInput({ assignedToId: "worker-9" }), ACTOR);
    await flushAsync();

    const userIds = notifications.create.mock.calls.map((c) => (c[0] as { userId: string }).userId);
    expect(userIds.sort()).toEqual(["admin-1", "worker-9"]);
  });

  it("does not double-notify an assignee who is also a safety admin", async () => {
    const { service, prisma, notifications } = buildService();
    (prisma.user as { findMany: jest.Mock }).findMany.mockResolvedValue([
      { id: "admin-1", email: "a1@projectops.local" }
    ]);
    (prisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
      id: "admin-1",
      email: "a1@projectops.local"
    });

    await service.createHazard(hazardInput({ assignedToId: "admin-1" }), ACTOR);
    await flushAsync();

    expect(notifications.create).toHaveBeenCalledTimes(1);
  });

  it("uses HIGH severity for extreme/high risk and never emails", async () => {
    const { service, prisma, notifications, email } = buildService();
    (prisma.user as { findMany: jest.Mock }).findMany.mockResolvedValue([
      { id: "admin-1", email: "a1@projectops.local" }
    ]);

    await service.createHazard(hazardInput({ riskLevel: "extreme" }), ACTOR);
    await flushAsync();

    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ severity: "HIGH" }));
    expect(email.sendNotificationEmail).not.toHaveBeenCalled();
  });
});

// ─── createHazard validation ───────────────────────────────────────────────

describe("SafetyService.createHazard", () => {
  it.each([
    ["hazardType", hazardInput({ hazardType: "cosmic" })],
    ["riskLevel", hazardInput({ riskLevel: "apocalyptic" })]
  ])("rejects an invalid %s with 400", async (_field, input) => {
    const { service } = buildService();
    await expect(service.createHazard(input, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("parses dueDate when supplied and defaults it to null otherwise", async () => {
    const { service, prisma } = buildService();
    const create = (prisma.hazardObservation as { create: jest.Mock }).create;

    await service.createHazard(hazardInput({ dueDate: "2026-06-20T00:00:00.000Z" }), ACTOR);
    await service.createHazard(hazardInput(), ACTOR);

    expect(create.mock.calls[0][0].data.dueDate).toEqual(new Date("2026-06-20T00:00:00.000Z"));
    expect(create.mock.calls[1][0].data.dueDate).toBeNull();
  });
});

// ─── Update / close guard paths ────────────────────────────────────────────

describe("SafetyService.updateIncident", () => {
  it("404s when the incident does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.safetyIncident as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);

    await expect(service.updateIncident("missing", { location: "x" })).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("validates enum fields before touching the database", async () => {
    const { service, prisma } = buildService();

    await expect(service.updateIncident("inc-1", { status: "reopened" })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect((prisma.safetyIncident as { findUnique: jest.Mock }).findUnique).not.toHaveBeenCalled();
  });

  it("applies only the supplied fields and re-parses incidentDate", async () => {
    const { service, prisma } = buildService();

    await service.updateIncident("inc-1", {
      status: "investigating",
      rootCause: "No spotter rostered",
      incidentDate: "2026-06-02T00:00:00.000Z"
    });

    expect((prisma.safetyIncident as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: "inc-1" },
      data: {
        status: "investigating",
        rootCause: "No spotter rostered",
        incidentDate: new Date("2026-06-02T00:00:00.000Z")
      }
    });
  });
});

describe("SafetyService.closeIncident / closeHazard", () => {
  it("closeIncident stamps closedAt and the closing actor", async () => {
    const { service, prisma } = buildService();

    await service.closeIncident("inc-1", ACTOR);

    expect((prisma.safetyIncident as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: "inc-1" },
      data: { status: "closed", closedAt: expect.any(Date), closedById: ACTOR }
    });
  });

  it("closeHazard stamps closedAt but records no closer", async () => {
    const { service, prisma } = buildService();

    await service.closeHazard("haz-1");

    const data = (prisma.hazardObservation as { update: jest.Mock }).update.mock.calls[0][0].data;
    expect(data).toEqual({ status: "closed", closedAt: expect.any(Date) });
    expect(data).not.toHaveProperty("closedById");
  });

  it("closeIncident 404s on a missing incident", async () => {
    const { service, prisma } = buildService();
    (prisma.safetyIncident as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);

    await expect(service.closeIncident("missing", ACTOR)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("SafetyService.updateHazard", () => {
  it("clears dueDate on explicit null but leaves it untouched when undefined", async () => {
    const { service, prisma } = buildService();
    const update = (prisma.hazardObservation as { update: jest.Mock }).update;

    await service.updateHazard("haz-1", { dueDate: null });
    await service.updateHazard("haz-1", { location: "New spot" });

    expect(update.mock.calls[0][0].data).toEqual({ dueDate: null });
    expect(update.mock.calls[1][0].data).toEqual({ location: "New spot" });
  });

  it("404s when the hazard does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.hazardObservation as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);

    await expect(service.updateHazard("missing", {})).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── List pagination clamps ────────────────────────────────────────────────

describe("SafetyService list pagination", () => {
  it("clamps page size to 100 and page to >= 1", async () => {
    const { service, prisma } = buildService();

    const result = await service.listIncidents({ page: -3, limit: 5000 });

    expect((prisma.safetyIncident as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 100 })
    );
    expect(result).toMatchObject({ page: 1, pageSize: 100 });
  });

  it("applies status/severity/type filters to both query and count", async () => {
    const { service, prisma } = buildService();

    await service.listIncidents({ status: "open", severity: "high", type: "near_miss" });

    const where = { status: "open", severity: "high", incidentType: "near_miss" };
    expect((prisma.safetyIncident as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where })
    );
    expect((prisma.safetyIncident as { count: jest.Mock }).count).toHaveBeenCalledWith({ where });
  });

  it("maps hazard type filter to hazardType and defaults to page 1 / 25", async () => {
    const { service, prisma } = buildService();

    await service.listHazards({ type: "electrical" });

    expect((prisma.hazardObservation as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { hazardType: "electrical" }, skip: 0, take: 25 })
    );
  });
});

// ─── Get guard paths ───────────────────────────────────────────────────────

describe("SafetyService.getIncident / getHazard", () => {
  it("404s on missing rows", async () => {
    const { service, prisma } = buildService();
    (prisma.safetyIncident as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);
    (prisma.hazardObservation as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);

    await expect(service.getIncident("missing")).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getHazard("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── Dashboard ─────────────────────────────────────────────────────────────

describe("SafetyService.dashboard", () => {
  it("totals grouped severities/risk levels into sparse maps", async () => {
    const { service, prisma } = buildService();
    (prisma.safetyIncident as { groupBy: jest.Mock }).groupBy.mockResolvedValue([
      { severity: "high", _count: { _all: 2 } },
      { severity: "low", _count: { _all: 3 } }
    ]);
    (prisma.hazardObservation as { groupBy: jest.Mock }).groupBy.mockResolvedValue([
      { riskLevel: "extreme", _count: { _all: 1 } }
    ]);
    (prisma.hazardObservation as { count: jest.Mock }).count.mockResolvedValue(4);

    const result = await service.dashboard();

    expect(result.openIncidents).toEqual({ total: 5, bySeverity: { high: 2, low: 3 } });
    expect(result.openHazards).toEqual({ total: 1, byRiskLevel: { extreme: 1 } });
    expect(result.overdueHazards).toBe(4);
    expect(result.recentIncidents).toEqual([]);
    expect(result.recentHazards).toEqual([]);
  });
});

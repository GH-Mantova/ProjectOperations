// Mock-based unit tests for ComplianceService — §13 expiry surfacing, the
// daily alert + auto-block cron, and worker-qualification CRUD. Follows the
// house pattern (quote.service.spec.ts): Prisma is a plain object of
// jest.fn()s and the service is instantiated directly with `as never`.
//
// Coverage emphasis (backlog pr-90): the 30/7-day window arithmetic in
// computeStatus, the per-(item, tier) alert dedup, and the asymmetric
// auto-block/auto-unblock rule for critical licences and insurances.
// Date-window tests use jest.useFakeTimers with a fixed baseline so the
// threshold maths is deterministic.

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ComplianceService } from "../compliance.service";

const NOW = new Date("2026-06-05T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
  jest.useRealTimers();
});

function buildService(extraPrisma: Record<string, unknown> = {}) {
  const prisma: Record<string, unknown> = {
    entityLicence: { findMany: jest.fn().mockResolvedValue([]) },
    entityInsurance: { findMany: jest.fn().mockResolvedValue([]) },
    workerQualification: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "qual-new", ...args.data })
      ),
      update: jest.fn().mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ id: args.where.id, ...args.data })
      ),
      delete: jest.fn().mockResolvedValue({ id: "qual-1" })
    },
    complianceAlert: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    subcontractorSupplier: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ id: "sub-1" }),
      update: jest.fn().mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ id: args.where.id, ...args.data })
      )
    },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    workerProfile: { findUnique: jest.fn().mockResolvedValue({ id: "worker-1" }) },
    ...extraPrisma
  };

  const notifications = { create: jest.fn().mockResolvedValue({ id: "notif-1" }) };
  const email = { sendNotificationEmail: jest.fn().mockResolvedValue(undefined) };

  const service = new ComplianceService(prisma as never, notifications as never, email as never);

  return { service, prisma, notifications, email };
}

const licenceRow = (overrides: Record<string, unknown> = {}) => ({
  id: "lic-1",
  licenceType: "qbcc",
  licenceNumber: "L-123",
  expiryDate: daysFromNow(5),
  client: null,
  subcontractor: { id: "sub-1", name: "Acme Civil" },
  ...overrides
});

// ─── computeStatus / daysUntilExpiry window arithmetic ─────────────────────

describe("ComplianceService.computeStatus", () => {
  it.each<[string, Date | null, string]>([
    ["null expiry", null, "not_set"],
    ["past date", daysFromNow(-1), "expired"],
    ["3 days out", daysFromNow(3), "expiring_7"],
    ["exactly 7 days out", daysFromNow(7), "expiring_7"],
    ["8 days out", daysFromNow(8), "expiring_30"],
    ["exactly 30 days out", daysFromNow(30), "expiring_30"],
    ["31 days out", daysFromNow(31), "active"],
    ["a year out", daysFromNow(365), "active"]
  ])("%s → %s", (_label, expiry, expected) => {
    const { service } = buildService();
    expect(service.computeStatus(expiry as Date | null)).toBe(expected);
  });

  it("buckets the 7-day tier before the 30-day tier", () => {
    const { service } = buildService();
    expect(service.computeStatus(daysFromNow(6))).toBe("expiring_7");
  });
});

describe("ComplianceService.daysUntilExpiry", () => {
  it("rounds up and goes negative for already-expired items", () => {
    const { service } = buildService();
    expect(service.daysUntilExpiry(null)).toBeNull();
    expect(service.daysUntilExpiry(daysFromNow(2))).toBe(2);
    expect(service.daysUntilExpiry(new Date(NOW.getTime() + 1.5 * DAY_MS))).toBe(2);
    expect(service.daysUntilExpiry(daysFromNow(-3))).toBe(-3);
  });
});

// ─── getExpiringItems mapping ──────────────────────────────────────────────

describe("ComplianceService.getExpiringItems", () => {
  it("queries each model with the daysAhead cutoff and excludes null expiries", async () => {
    const { service, prisma } = buildService();

    await service.getExpiringItems(14);

    const expectedWhere = { expiryDate: { not: null, lte: daysFromNow(14) } };
    for (const model of ["entityLicence", "entityInsurance", "workerQualification"] as const) {
      expect((prisma[model] as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere })
      );
    }
  });

  it("maps owners — client licence, subcontractor insurance, worker qualification", async () => {
    const { service, prisma } = buildService();
    (prisma.entityLicence as { findMany: jest.Mock }).findMany.mockResolvedValue([
      licenceRow({ client: { id: "client-1", name: "BrisCo" }, subcontractor: null })
    ]);
    (prisma.entityInsurance as { findMany: jest.Mock }).findMany.mockResolvedValue([
      {
        id: "ins-1",
        insuranceType: "public_liability",
        policyNumber: "P-9",
        expiryDate: daysFromNow(-2),
        client: null,
        subcontractor: { id: "sub-1", name: "Acme Civil" }
      }
    ]);
    (prisma.workerQualification as { findMany: jest.Mock }).findMany.mockResolvedValue([
      {
        id: "qual-1",
        qualType: "white_card",
        licenceNumber: "W-1",
        expiryDate: daysFromNow(20),
        workerProfile: { id: "worker-1", firstName: "Sam", lastName: "Builder" }
      }
    ]);

    const result = await service.getExpiringItems();

    expect(result.licences[0]).toMatchObject({
      itemType: "licence",
      entityType: "client",
      entityId: "client-1",
      entityName: "BrisCo",
      status: "expiring_7",
      daysUntilExpiry: 5
    });
    expect(result.insurances[0]).toMatchObject({
      itemType: "insurance",
      entityType: "subcontractor",
      entityName: "Acme Civil",
      status: "expired",
      daysUntilExpiry: -2
    });
    expect(result.qualifications[0]).toMatchObject({
      itemType: "qualification",
      entityType: "worker",
      entityId: "worker-1",
      entityName: "Sam Builder",
      status: "expiring_30"
    });
  });

  it("labels company-owned licences with the profile trading name (same alert path as subs)", async () => {
    const { service, prisma } = buildService();
    (prisma.entityLicence as { findMany: jest.Mock }).findMany.mockResolvedValue([
      {
        id: "lic-c1",
        licenceType: "demolition",
        licenceNumber: "2328018",
        expiryDate: daysFromNow(5),
        client: null,
        subcontractor: null,
        companyProfile: { id: "singleton", tradingName: "Initial Services" }
      }
    ]);

    const result = await service.getExpiringItems();

    expect(result.licences[0]).toMatchObject({
      itemType: "licence",
      entityType: "company",
      entityId: "singleton",
      entityName: "Initial Services",
      status: "expiring_7"
    });
  });
});

// ─── Alert pass: tiers + dedup ─────────────────────────────────────────────

describe("ComplianceService.checkAndSendExpiryAlerts", () => {
  const admin = { id: "admin-1", email: "admin@projectops.local" };

  it("returns 0 and writes no dedup records when no compliance admins exist", async () => {
    const { service, prisma } = buildService();
    (prisma.entityLicence as { findMany: jest.Mock }).findMany.mockResolvedValue([licenceRow()]);

    await expect(service.checkAndSendExpiryAlerts()).resolves.toBe(0);
    expect((prisma.complianceAlert as { createMany: jest.Mock }).createMany).not.toHaveBeenCalled();
  });

  it("sends one notification per admin per new row and persists dedup tuples", async () => {
    const { service, prisma, notifications, email } = buildService();
    (prisma.user as { findMany: jest.Mock }).findMany.mockResolvedValue([
      admin,
      { id: "admin-2", email: "admin2@projectops.local" }
    ]);
    (prisma.entityLicence as { findMany: jest.Mock }).findMany.mockResolvedValue([licenceRow()]);

    const sent = await service.checkAndSendExpiryAlerts();

    expect(sent).toBe(1);
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(email.sendNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: "compliance.expiry_reminder" })
    );
    expect((prisma.complianceAlert as { createMany: jest.Mock }).createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ itemId: "lic-1", alertType: "expiring_7", sentToUserId: "admin-1" }),
        expect.objectContaining({ itemId: "lic-1", alertType: "expiring_7", sentToUserId: "admin-2" })
      ],
      skipDuplicates: true
    });
  });

  it("skips rows already alerted at the same tier (dedupe across daily runs)", async () => {
    const { service, prisma, notifications } = buildService();
    (prisma.user as { findMany: jest.Mock }).findMany.mockResolvedValue([admin]);
    (prisma.entityLicence as { findMany: jest.Mock }).findMany.mockResolvedValue([licenceRow()]);
    (prisma.complianceAlert as { findMany: jest.Mock }).findMany.mockResolvedValue([
      { itemId: "lic-1" }
    ]);

    const sent = await service.checkAndSendExpiryAlerts();

    expect(sent).toBe(0);
    expect(notifications.create).not.toHaveBeenCalled();
    expect((prisma.complianceAlert as { createMany: jest.Mock }).createMany).not.toHaveBeenCalled();
  });

  it("treats tiers independently — a 30-day dedup record does not mute the 7-day tier", async () => {
    const { service, prisma, notifications } = buildService();
    (prisma.user as { findMany: jest.Mock }).findMany.mockResolvedValue([admin]);
    // Row currently in the 7-day tier...
    (prisma.entityLicence as { findMany: jest.Mock }).findMany.mockResolvedValue([licenceRow()]);
    // ...whose dedup history only covers the expiring_30 tier.
    (prisma.complianceAlert as { findMany: jest.Mock }).findMany.mockImplementation(
      (args: { where: { alertType: string } }) =>
        Promise.resolve(args.where.alertType === "expiring_30" ? [{ itemId: "lic-1" }] : [])
    );

    const sent = await service.checkAndSendExpiryAlerts();

    expect(sent).toBe(1);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "HIGH", title: expect.stringContaining("Expiring soon") })
    );
  });

  it("uses LOW severity and a non-urgent subject for the 30-day tier", async () => {
    const { service, prisma, notifications, email } = buildService();
    (prisma.user as { findMany: jest.Mock }).findMany.mockResolvedValue([admin]);
    (prisma.entityLicence as { findMany: jest.Mock }).findMany.mockResolvedValue([
      licenceRow({ expiryDate: daysFromNow(20) })
    ]);

    await service.checkAndSendExpiryAlerts();

    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ severity: "LOW" }));
    expect(email.sendNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.not.stringContaining("[URGENT]") })
    );
  });

  it("flags expired items with the [URGENT] expired subject and Expired title", async () => {
    const { service, prisma, notifications, email } = buildService();
    (prisma.user as { findMany: jest.Mock }).findMany.mockResolvedValue([admin]);
    (prisma.entityLicence as { findMany: jest.Mock }).findMany.mockResolvedValue([
      licenceRow({ expiryDate: daysFromNow(-1) })
    ]);

    await service.checkAndSendExpiryAlerts();

    expect(email.sendNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("expired") })
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "HIGH", title: expect.stringContaining("Expired") })
    );
  });
});

// ─── Auto-block / auto-unblock ─────────────────────────────────────────────

describe("ComplianceService.autoBlockExpiredSubcontractors", () => {
  const subBase = {
    id: "sub-1",
    name: "Acme Civil",
    complianceBlocked: false,
    complianceBlockReason: null as string | null,
    licences: [] as Array<Record<string, unknown>>,
    insurances: [] as Array<Record<string, unknown>>
  };

  it("only evaluates approved-prequal subcontractors", async () => {
    const { service, prisma } = buildService();

    await service.autoBlockExpiredSubcontractors();

    expect((prisma.subcontractorSupplier as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { prequalStatus: "approved" } })
    );
  });

  it("blocks on an expired critical licence and notifies admins HIGH", async () => {
    const { service, prisma, notifications } = buildService();
    (prisma.user as { findMany: jest.Mock }).findMany.mockResolvedValue([
      { id: "admin-1", email: "admin@projectops.local" }
    ]);
    (prisma.subcontractorSupplier as { findMany: jest.Mock }).findMany.mockResolvedValue([
      { ...subBase, licences: [{ licenceType: "asbestos_a", expiryDate: daysFromNow(-1) }] }
    ]);

    const result = await service.autoBlockExpiredSubcontractors();

    expect(result).toEqual({ blocked: 1, unblocked: 0 });
    expect((prisma.subcontractorSupplier as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: {
        complianceBlocked: true,
        complianceBlockReason: "Critical licence expired: asbestos_a",
        complianceBlockedAt: expect.any(Date)
      }
    });
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ severity: "HIGH" }));
  });

  it("blocks on an expired critical insurance when licences are clean", async () => {
    const { service, prisma } = buildService();
    (prisma.subcontractorSupplier as { findMany: jest.Mock }).findMany.mockResolvedValue([
      {
        ...subBase,
        insurances: [{ insuranceType: "workers_compensation", expiryDate: daysFromNow(-10) }]
      }
    ]);

    const result = await service.autoBlockExpiredSubcontractors();

    expect(result.blocked).toBe(1);
    expect((prisma.subcontractorSupplier as { update: jest.Mock }).update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          complianceBlockReason: "Critical insurance expired: workers_compensation"
        })
      })
    );
  });

  it("ignores expired non-critical items and unexpired critical items", async () => {
    const { service, prisma } = buildService();
    (prisma.subcontractorSupplier as { findMany: jest.Mock }).findMany.mockResolvedValue([
      {
        ...subBase,
        licences: [
          { licenceType: "forklift", expiryDate: daysFromNow(-5) },
          { licenceType: "qbcc", expiryDate: daysFromNow(10) }
        ],
        insurances: [{ insuranceType: "motor_vehicle", expiryDate: daysFromNow(-5) }]
      }
    ]);

    const result = await service.autoBlockExpiredSubcontractors();

    expect(result).toEqual({ blocked: 0, unblocked: 0 });
    expect((prisma.subcontractorSupplier as { update: jest.Mock }).update).not.toHaveBeenCalled();
  });

  it("does not re-block an already-blocked subcontractor", async () => {
    const { service, prisma } = buildService();
    (prisma.subcontractorSupplier as { findMany: jest.Mock }).findMany.mockResolvedValue([
      {
        ...subBase,
        complianceBlocked: true,
        complianceBlockReason: "Critical licence expired: qbcc",
        licences: [{ licenceType: "qbcc", expiryDate: daysFromNow(-1) }]
      }
    ]);

    const result = await service.autoBlockExpiredSubcontractors();

    expect(result).toEqual({ blocked: 0, unblocked: 0 });
    expect((prisma.subcontractorSupplier as { update: jest.Mock }).update).not.toHaveBeenCalled();
  });

  it("lifts an auto-block once the critical items are current again", async () => {
    const { service, prisma, notifications } = buildService();
    (prisma.user as { findMany: jest.Mock }).findMany.mockResolvedValue([
      { id: "admin-1", email: "admin@projectops.local" }
    ]);
    (prisma.subcontractorSupplier as { findMany: jest.Mock }).findMany.mockResolvedValue([
      {
        ...subBase,
        complianceBlocked: true,
        complianceBlockReason: "Critical licence expired: qbcc",
        licences: [{ licenceType: "qbcc", expiryDate: daysFromNow(180) }]
      }
    ]);

    const result = await service.autoBlockExpiredSubcontractors();

    expect(result).toEqual({ blocked: 0, unblocked: 1 });
    expect((prisma.subcontractorSupplier as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { complianceBlocked: false, complianceBlockReason: null, complianceBlockedAt: null }
    });
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ severity: "LOW" }));
  });

  it("never lifts a manual block (asymmetric unblock rule)", async () => {
    const { service, prisma } = buildService();
    (prisma.subcontractorSupplier as { findMany: jest.Mock }).findMany.mockResolvedValue([
      {
        ...subBase,
        complianceBlocked: true,
        complianceBlockReason: "Manual block",
        licences: [{ licenceType: "qbcc", expiryDate: daysFromNow(180) }]
      }
    ]);

    const result = await service.autoBlockExpiredSubcontractors();

    expect(result).toEqual({ blocked: 0, unblocked: 0 });
    expect((prisma.subcontractorSupplier as { update: jest.Mock }).update).not.toHaveBeenCalled();
  });
});

describe("ComplianceService.manualBlock", () => {
  it("404s on a missing subcontractor", async () => {
    const { service, prisma } = buildService();
    (prisma.subcontractorSupplier as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);

    await expect(service.manualBlock("missing", true, "Audit fail")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("defaults a null reason to 'Manual block' when blocking", async () => {
    const { service, prisma } = buildService();

    await service.manualBlock("sub-1", true, null);

    expect((prisma.subcontractorSupplier as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: {
        complianceBlocked: true,
        complianceBlockReason: "Manual block",
        complianceBlockedAt: expect.any(Date)
      }
    });
  });

  it("clears reason and timestamp when unblocking", async () => {
    const { service, prisma } = buildService();

    await service.manualBlock("sub-1", false, "ignored");

    expect((prisma.subcontractorSupplier as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { complianceBlocked: false, complianceBlockReason: null, complianceBlockedAt: null }
    });
  });
});

// ─── Worker qualification CRUD ─────────────────────────────────────────────

describe("ComplianceService qualifications", () => {
  it("listQualifications decorates rows with a derived status", async () => {
    const { service, prisma } = buildService();
    (prisma.workerQualification as { findMany: jest.Mock }).findMany.mockResolvedValue([
      { id: "q-1", qualType: "white_card", expiryDate: daysFromNow(-1) },
      { id: "q-2", qualType: "first_aid", expiryDate: null }
    ]);

    const rows = await service.listQualifications("worker-1");

    expect(rows[0].status).toBe("expired");
    expect(rows[1].status).toBe("not_set");
  });

  it("listQualifications 404s on a missing worker profile", async () => {
    const { service, prisma } = buildService();
    (prisma.workerProfile as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);

    await expect(service.listQualifications("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("createQualification rejects a missing or invalid qualType", async () => {
    const { service } = buildService();

    await expect(service.createQualification("worker-1", {})).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(
      service.createQualification("worker-1", { qualType: "skydiving" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("createQualification parses dates defensively and records the actor", async () => {
    const { service, prisma } = buildService();

    await service.createQualification(
      "worker-1",
      { qualType: "ewp", expiryDate: "2026-12-01", issueDate: "" },
      "user-actor"
    );

    expect((prisma.workerQualification as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workerProfileId: "worker-1",
        qualType: "ewp",
        issueDate: null,
        expiryDate: new Date("2026-12-01"),
        createdById: "user-actor"
      })
    });
  });

  it("createQualification rejects an unparsable date with 400", async () => {
    const { service } = buildService();

    await expect(
      service.createQualification("worker-1", { qualType: "ewp", expiryDate: "not-a-date" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("updateQualification 404s when the row belongs to a different worker", async () => {
    const { service, prisma } = buildService();
    (prisma.workerQualification as { findFirst: jest.Mock }).findFirst.mockResolvedValue(null);

    await expect(service.updateQualification("worker-1", "qual-x", {})).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect((prisma.workerQualification as { findFirst: jest.Mock }).findFirst).toHaveBeenCalledWith({
      where: { id: "qual-x", workerProfileId: "worker-1" }
    });
  });

  it("updateQualification applies tri-state semantics — null clears, undefined skips", async () => {
    const { service, prisma } = buildService();
    (prisma.workerQualification as { findFirst: jest.Mock }).findFirst.mockResolvedValue({
      id: "qual-1"
    });

    await service.updateQualification("worker-1", "qual-1", {
      licenceNumber: null,
      expiryDate: "2027-01-01"
    });

    expect((prisma.workerQualification as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: "qual-1" },
      data: { licenceNumber: null, expiryDate: new Date("2027-01-01") }
    });
  });

  it("deleteQualification hard-deletes scoped to the owning worker", async () => {
    const { service, prisma } = buildService();
    (prisma.workerQualification as { findFirst: jest.Mock }).findFirst.mockResolvedValue({
      id: "qual-1"
    });

    await expect(service.deleteQualification("worker-1", "qual-1")).resolves.toEqual({
      id: "qual-1"
    });
    expect((prisma.workerQualification as { delete: jest.Mock }).delete).toHaveBeenCalledWith({
      where: { id: "qual-1" }
    });
  });
});

describe("ComplianceService.checkWorkerCompetency", () => {
  it("loads only qualType/expiryDate and returns the gate verdict", async () => {
    const { service, prisma } = buildService();
    (prisma.workerQualification as { findMany: jest.Mock }).findMany.mockResolvedValue([
      { qualType: "white_card", expiryDate: daysFromNow(365) }
    ]);

    const result = await service.checkWorkerCompetency("worker-1", ["white_card", "asbestos_a"]);

    expect((prisma.workerQualification as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith({
      where: { workerProfileId: "worker-1" },
      select: { qualType: true, expiryDate: true }
    });
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain("asbestos_a");
  });
});

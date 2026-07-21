// Mock-based unit tests for PrequalService — the structured subcontractor
// prequalification workflow (draft → submitted → under_review → approved /
// rejected, and approved → expired via cron). Follows the house pattern from
// compliance.service.spec.ts: Prisma is a plain object of jest.fn()s and the
// service is instantiated directly with `as never`.
//
// Coverage emphasis: the state-machine guards (only draft may submit, one
// open request at a time, terminal states are immutable), the reviewer
// side-effect on SubcontractorSupplier.prequalStatus, the point-in-time
// snapshot captured on approval, and the expiry cron's asymmetric flip
// (only approved rows go expired; sub prequalStatus goes approved → pending
// but manual/rejected states are left alone).

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrequalService } from "../prequal.service";

const NOW = new Date("2026-06-05T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
  jest.useRealTimers();
});

type PrequalRow = {
  id: string;
  subcontractorId: string;
  status: string;
  expiresAt?: Date | null;
  notes?: string | null;
};

function buildService(seed: {
  requests?: PrequalRow[];
  subcontractor?: { id: string } | null;
  subcontractorFull?: Record<string, unknown> | null;
} = {}) {
  const requests = seed.requests ?? [];
  const subcontractorLookup =
    seed.subcontractor === undefined ? { id: "sub-1" } : seed.subcontractor;
  const subcontractorFull =
    seed.subcontractorFull === undefined
      ? {
          id: "sub-1",
          licences: [{ id: "lic-1", licenceType: "qbcc", expiryDate: daysFromNow(120) }],
          insurances: [
            { id: "ins-1", insuranceType: "public_liability", expiryDate: daysFromNow(90) }
          ],
          documents: [{ id: "doc-1", documentType: "cert", name: "SafetyCert.pdf" }]
        }
      : seed.subcontractorFull;

  const prisma: Record<string, unknown> = {
    prequalificationRequest: {
      findFirst: jest.fn().mockImplementation(
        ({ where }: { where: { subcontractorId: string; status?: { in: string[] } } }) => {
          const open = requests.find(
            (r) =>
              r.subcontractorId === where.subcontractorId &&
              (where.status ? where.status.in.includes(r.status) : true)
          );
          return Promise.resolve(open ?? null);
        }
      ),
      findUnique: jest.fn().mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve(requests.find((r) => r.id === where.id) ?? null)
      ),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: "req-new", ...data })
      ),
      update: jest.fn().mockImplementation(
        ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
          Promise.resolve({ id: where.id, ...data })
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      groupBy: jest.fn().mockResolvedValue([])
    },
    subcontractorSupplier: {
      findUnique: jest.fn().mockResolvedValue(subcontractorLookup),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockImplementation(
        ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
          Promise.resolve({ id: where.id, ...data })
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops))
  };

  // findUnique for verify() needs the full sub with nested includes — inject a
  // per-call override so the default lookup stays lean.
  const originalReqFindUnique = (
    prisma.prequalificationRequest as { findUnique: jest.Mock }
  ).findUnique;
  (prisma.prequalificationRequest as { findUnique: jest.Mock }).findUnique = jest
    .fn()
    .mockImplementation(({ where, include }: { where: { id: string }; include?: unknown }) => {
      const row = requests.find((r) => r.id === where.id);
      if (!row) return Promise.resolve(null);
      if (include && subcontractorFull) {
        return Promise.resolve({ ...row, subcontractor: subcontractorFull });
      }
      return originalReqFindUnique({ where, include });
    });

  const service = new PrequalService(prisma as never);
  return { service, prisma };
}

// ─── create() — open a draft ─────────────────────────────────────────────────

describe("PrequalService.create", () => {
  it("opens a draft when the sub exists and has no open request", async () => {
    const { service, prisma } = buildService();
    const row = await service.create({ subcontractorId: "sub-1", notes: "hello" }, "actor-1");
    expect(row).toMatchObject({
      subcontractorId: "sub-1",
      status: "draft",
      notes: "hello",
      createdById: "actor-1"
    });
    expect((prisma.prequalificationRequest as { create: jest.Mock }).create).toHaveBeenCalledTimes(1);
  });

  it("404s when the subcontractor is missing", async () => {
    const { service } = buildService({ subcontractor: null });
    await expect(
      service.create({ subcontractorId: "sub-missing" }, "actor-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each<[string]>([["draft"], ["submitted"], ["under_review"]])(
    "blocks a second request while an existing %s cycle is open",
    async (openStatus) => {
      const { service } = buildService({
        requests: [{ id: "req-open", subcontractorId: "sub-1", status: openStatus }]
      });
      await expect(
        service.create({ subcontractorId: "sub-1" }, "actor-1")
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  );

  it("permits a fresh cycle after a terminal state (approved / rejected / expired)", async () => {
    const { service } = buildService({
      requests: [{ id: "req-old", subcontractorId: "sub-1", status: "expired" }]
    });
    const row = await service.create({ subcontractorId: "sub-1" }, "actor-1");
    expect(row.status).toBe("draft");
  });
});

// ─── submit() — draft → submitted ────────────────────────────────────────────

describe("PrequalService.submit", () => {
  it("stamps submittedAt=now and moves draft → submitted", async () => {
    const { service, prisma } = buildService({
      requests: [{ id: "req-1", subcontractorId: "sub-1", status: "draft" }]
    });
    const row = await service.submit("req-1");
    expect(row).toMatchObject({ id: "req-1", status: "submitted" });
    const call = (prisma.prequalificationRequest as { update: jest.Mock }).update.mock.calls[0][0];
    expect(call.data).toMatchObject({ status: "submitted" });
    expect(call.data.submittedAt).toEqual(NOW);
  });

  it("400s when the current state is anything other than draft", async () => {
    const { service } = buildService({
      requests: [{ id: "req-1", subcontractorId: "sub-1", status: "submitted" }]
    });
    await expect(service.submit("req-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("404s when the request id does not exist", async () => {
    const { service } = buildService();
    await expect(service.submit("nope")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── verify() — approve with snapshot + summary sync ─────────────────────────

describe("PrequalService.verify", () => {
  it("rejects an invalid riskRating", async () => {
    const { service } = buildService({
      requests: [{ id: "req-1", subcontractorId: "sub-1", status: "under_review" }]
    });
    await expect(
      service.verify("req-1", "actor-1", { riskRating: "extreme" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("captures a snapshot of insurances/licences/documents on approval", async () => {
    const { service, prisma } = buildService({
      requests: [{ id: "req-1", subcontractorId: "sub-1", status: "under_review" }]
    });
    await service.verify("req-1", "actor-1", { riskRating: "medium" });
    const call = (prisma.prequalificationRequest as { update: jest.Mock }).update.mock.calls[0][0];
    expect(call.data.status).toBe("approved");
    expect(call.data.snapshot).toMatchObject({
      licences: expect.arrayContaining([expect.objectContaining({ licenceType: "qbcc" })]),
      insurances: expect.arrayContaining([
        expect.objectContaining({ insuranceType: "public_liability" })
      ]),
      documents: expect.arrayContaining([expect.objectContaining({ documentType: "cert" })])
    });
    expect(call.data.snapshot.capturedAt).toBe(NOW.toISOString());
  });

  it("defaults expiresAt to now + 365 days when not supplied", async () => {
    const { service, prisma } = buildService({
      requests: [{ id: "req-1", subcontractorId: "sub-1", status: "submitted" }]
    });
    await service.verify("req-1", "actor-1", { riskRating: "low" });
    const call = (prisma.prequalificationRequest as { update: jest.Mock }).update.mock.calls[0][0];
    expect(call.data.expiresAt).toEqual(daysFromNow(365));
  });

  it("honours an explicit expiresAt when supplied", async () => {
    const { service, prisma } = buildService({
      requests: [{ id: "req-1", subcontractorId: "sub-1", status: "submitted" }]
    });
    const custom = new Date("2027-01-01T00:00:00.000Z");
    await service.verify("req-1", "actor-1", { riskRating: "high", expiresAt: custom.toISOString() });
    const call = (prisma.prequalificationRequest as { update: jest.Mock }).update.mock.calls[0][0];
    expect(call.data.expiresAt).toEqual(custom);
  });

  it("400s on an unparseable expiresAt", async () => {
    const { service } = buildService({
      requests: [{ id: "req-1", subcontractorId: "sub-1", status: "submitted" }]
    });
    await expect(
      service.verify("req-1", "actor-1", { riskRating: "low", expiresAt: "not-a-date" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("syncs SubcontractorSupplier.prequalStatus to approved + records reviewer", async () => {
    const { service, prisma } = buildService({
      requests: [{ id: "req-1", subcontractorId: "sub-1", status: "under_review" }]
    });
    await service.verify("req-1", "actor-1", { riskRating: "medium" });
    const subUpdate = (prisma.subcontractorSupplier as { update: jest.Mock }).update.mock.calls[0][0];
    expect(subUpdate).toMatchObject({
      where: { id: "sub-1" },
      data: {
        prequalStatus: "approved",
        prequalReviewedBy: "actor-1"
      }
    });
    expect(subUpdate.data.prequalReviewedAt).toEqual(NOW);
  });

  it("refuses to re-verify a request that already reached a terminal state", async () => {
    for (const terminal of ["approved", "rejected"] as const) {
      const { service } = buildService({
        requests: [{ id: "req-1", subcontractorId: "sub-1", status: terminal }]
      });
      await expect(
        service.verify("req-1", "actor-1", { riskRating: "low" })
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });
});

// ─── reject() — mandatory reason, summary flip ───────────────────────────────

describe("PrequalService.reject", () => {
  it("requires a non-empty reason", async () => {
    const { service } = buildService({
      requests: [{ id: "req-1", subcontractorId: "sub-1", status: "under_review" }]
    });
    await expect(service.reject("req-1", "actor-1", "   ")).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("records the trimmed reason + flips summary column to rejected", async () => {
    const { service, prisma } = buildService({
      requests: [{ id: "req-1", subcontractorId: "sub-1", status: "under_review" }]
    });
    await service.reject("req-1", "actor-1", "  missing insurance  ");
    const reqUpdate = (prisma.prequalificationRequest as { update: jest.Mock }).update.mock.calls[0][0];
    expect(reqUpdate.data).toMatchObject({
      status: "rejected",
      rejectionReason: "missing insurance",
      verifiedById: "actor-1"
    });
    const subUpdate = (prisma.subcontractorSupplier as { update: jest.Mock }).update.mock.calls[0][0];
    expect(subUpdate.data).toMatchObject({
      prequalStatus: "rejected",
      prequalReviewedBy: "actor-1"
    });
  });

  it("refuses to reject an already-approved request", async () => {
    const { service } = buildService({
      requests: [{ id: "req-1", subcontractorId: "sub-1", status: "approved" }]
    });
    await expect(service.reject("req-1", "actor-1", "late change")).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});

// ─── updateDraft() — only draft is editable ──────────────────────────────────

describe("PrequalService.updateDraft", () => {
  it("patches notes on a draft", async () => {
    const { service, prisma } = buildService({
      requests: [{ id: "req-1", subcontractorId: "sub-1", status: "draft" }]
    });
    await service.updateDraft("req-1", { notes: "updated" });
    const call = (prisma.prequalificationRequest as { update: jest.Mock }).update.mock.calls[0][0];
    expect(call.data).toEqual({ notes: "updated" });
  });

  it("400s once the request has left draft", async () => {
    const { service } = buildService({
      requests: [{ id: "req-1", subcontractorId: "sub-1", status: "submitted" }]
    });
    await expect(service.updateDraft("req-1", { notes: "late" })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});

// ─── expireStalePrequals() — daily cron ──────────────────────────────────────

describe("PrequalService.expireStalePrequals", () => {
  it("no-ops (and does not touch subs) when nothing is stale", async () => {
    const { service, prisma } = buildService();
    (prisma.prequalificationRequest as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([]);
    const result = await service.expireStalePrequals();
    expect(result).toEqual({ expired: 0 });
    expect((prisma.subcontractorSupplier as { updateMany: jest.Mock }).updateMany).not.toHaveBeenCalled();
  });

  it("flips approved+past-expiry rows to expired and drops sub summary approved → pending", async () => {
    const { service, prisma } = buildService();
    (prisma.prequalificationRequest as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      { id: "req-a", subcontractorId: "sub-1" },
      { id: "req-b", subcontractorId: "sub-2" }
    ]);
    const result = await service.expireStalePrequals();
    expect(result).toEqual({ expired: 2 });

    const reqCall = (prisma.prequalificationRequest as { updateMany: jest.Mock }).updateMany.mock.calls[0][0];
    expect(reqCall.where.id.in).toEqual(["req-a", "req-b"]);
    expect(reqCall.data).toEqual({ status: "expired" });

    // Only subs whose summary is CURRENTLY approved get flipped — a manual
    // "rejected" or "pending" must be left alone. Guard is expressed in the
    // where-clause; verify it exactly.
    const subCall = (prisma.subcontractorSupplier as { updateMany: jest.Mock }).updateMany.mock.calls[0][0];
    expect(subCall.where).toEqual({ id: { in: ["sub-1", "sub-2"] }, prequalStatus: "approved" });
    expect(subCall.data).toEqual({ prequalStatus: "pending" });
  });
});

// ─── dashboard() — rollup for compliance surface ─────────────────────────────

describe("PrequalService.dashboard", () => {
  it("assembles counts, riskMix, expiringSoon and subs-without-prequal", async () => {
    const { service, prisma } = buildService();
    (prisma.prequalificationRequest as { groupBy: jest.Mock }).groupBy
      .mockResolvedValueOnce([
        { status: "approved", _count: { _all: 3 } },
        { status: "rejected", _count: { _all: 1 } }
      ])
      .mockResolvedValueOnce([
        { riskRating: "low", _count: { _all: 2 } },
        { riskRating: "high", _count: { _all: 1 } }
      ]);
    (prisma.prequalificationRequest as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      {
        id: "req-a",
        subcontractorId: "sub-1",
        expiresAt: daysFromNow(20),
        riskRating: "medium",
        subcontractor: { id: "sub-1", name: "Acme Civil" }
      }
    ]);
    (prisma.subcontractorSupplier as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      { id: "sub-9", name: "NeverReviewed Pty", prequalStatus: null }
    ]);

    const out = await service.dashboard();
    expect(out.counts).toEqual({ approved: 3, rejected: 1 });
    expect(out.riskMix).toEqual({ low: 2, high: 1 });
    expect(out.expiringSoon).toEqual([
      {
        id: "req-a",
        subcontractorId: "sub-1",
        subcontractorName: "Acme Civil",
        expiresAt: daysFromNow(20),
        riskRating: "medium"
      }
    ]);
    expect(out.subcontractorsWithoutPrequal).toHaveLength(1);
  });
});

// ─── validateStatus() ────────────────────────────────────────────────────────

describe("PrequalService.validateStatus", () => {
  it("returns the input when the value is one of the six valid states", () => {
    const { service } = buildService();
    expect(service.validateStatus("draft")).toBe("draft");
    expect(service.validateStatus("expired")).toBe("expired");
  });

  it("throws BadRequest on an unknown status", () => {
    const { service } = buildService();
    expect(() => service.validateStatus("archived")).toThrow(BadRequestException);
  });
});

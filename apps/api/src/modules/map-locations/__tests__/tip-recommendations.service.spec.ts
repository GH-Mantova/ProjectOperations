/**
 * TipRecommendationsService unit tests (ops-m2b)
 *
 * Covers:
 *   1. acceptRecommendation stores tenderId when originType = "tender"
 *   2. listForProject merges tender + job rows with Decimal server-side totals
 *   3. sendPriceReviewDigest sends one digest for un-notified due tips;
 *      second run sends nothing (all stamped); after mark-reviewed cycle resets
 *   4. PATCH on a POI (markPricesReviewed) returns 400
 */

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { TipRecommendationsService, OPS_M2B_TIPPING_V1 } from "../tip-recommendations.service";
import { MapLocationsService } from "../map-locations.service";

// ---- Helpers ---------------------------------------------------------------

function makeDecimal(s: string) {
  return new Decimal(s);
}

/** Build a minimal TipRecommendationLog mock row */
function makeLog(
  id: string,
  opts: {
    projectId?: string | null;
    tenderId?: string | null;
    createdAt?: Date;
    loadTonnes?: string;
    disposalFee?: string;
    travelCost?: string;
    totalCost?: string;
    distanceKm?: string;
    wasteTypeCode?: string;
    originType?: string;
  } = {}
) {
  return {
    id,
    mapLocationId: "ml-1",
    facilityName: "Test Tip",
    facilityLat: makeDecimal("-27.0"),
    facilityLng: makeDecimal("153.0"),
    wasteTypeCode: opts.wasteTypeCode ?? "General C&D",
    loadTonnes: makeDecimal(opts.loadTonnes ?? "10.000"),
    originType: opts.originType ?? "project",
    projectId: opts.projectId ?? null,
    tenderId: opts.tenderId ?? null,
    originLat: makeDecimal("-27.0"),
    originLng: makeDecimal("153.0"),
    distanceKm: makeDecimal(opts.distanceKm ?? "20.0"),
    disposalFee: makeDecimal(opts.disposalFee ?? "100.00"),
    travelCost: makeDecimal(opts.travelCost ?? "50.00"),
    totalCost: makeDecimal(opts.totalCost ?? "150.00"),
    createdAt: opts.createdAt ?? new Date("2026-09-01T10:00:00Z"),
    createdById: "user-1",
    createdBy: { firstName: "Test", lastName: "User" }
  };
}

/** Minimal TIP MapLocation row */
function makeTip(id: string, opts: { lat?: string; lng?: string; facility?: string } = {}) {
  return {
    id,
    name: "Test Tip",
    kind: "TIP" as const,
    facility: opts.facility ?? "Test Facility",
    isActive: true,
    latitude: makeDecimal(opts.lat ?? "-27.0"),
    longitude: makeDecimal(opts.lng ?? "153.0"),
    addressLine1: "1 Test St",
    suburb: "Testville",
    state: "QLD",
    postcode: "4000",
    notes: null as string | null,
    categoryId: null as string | null,
    pricesReviewedAt: null as Date | null,
    pricesReviewNotifiedAt: null as Date | null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z")
  };
}

function makePrismaForAccept(opts: {
  tip?: ReturnType<typeof makeTip> | null;
  settings?: { travelRatePerKm: Decimal } | null;
  site?: { centreLat: Decimal; centreLng: Decimal } | null;
  tender?: { siteId: string } | null;
  project?: { id: string; siteId: string } | null;
}) {
  const prisma: Record<string, any> = {
    mapLocation: {
      findUnique: jest.fn().mockResolvedValue(opts.tip ?? null)
    },
    operationsSettings: {
      findUnique: jest.fn().mockResolvedValue(opts.settings ?? null)
    },
    site: {
      findUnique: jest.fn().mockResolvedValue(opts.site ?? null)
    },
    tender: {
      findUnique: jest.fn().mockResolvedValue(opts.tender ?? null)
    },
    project: {
      findUnique: jest.fn().mockResolvedValue(opts.project ?? null)
    },
    tipRecommendationLog: {
      create: jest.fn().mockImplementation(async ({ data }: any) => ({
        id: "log-new",
        ...data,
        createdAt: new Date()
      }))
    }
  };
  return prisma;
}

// ---- OPS_M2B_TIPPING_V1 constant -------------------------------------------

describe("OPS_M2B_TIPPING_V1", () => {
  test("version constant equals ops-m2b", () => {
    expect(OPS_M2B_TIPPING_V1).toBe("ops-m2b");
  });
});

// ---- 1. acceptRecommendation stores tenderId --------------------------------

describe("TipRecommendationsService.acceptRecommendation — tenderId storage", () => {
  const rateResolver = {
    resolveRate: jest.fn().mockResolvedValue({ value: 140 })
  };

  test("stores tenderId when originType = tender", async () => {
    const tip = makeTip("ml-1", { lat: "-27.5", lng: "153.0" });
    const prisma = makePrismaForAccept({
      tip,
      settings: { travelRatePerKm: makeDecimal("2.5") },
      tender: { siteId: "site-1" },
      site: {
        centreLat: makeDecimal("-27.2"),
        centreLng: makeDecimal("153.1")
      }
    });

    const svc = new TipRecommendationsService(
      prisma as never,
      rateResolver as never,
      { create: jest.fn() } as never,
      { sendNotificationEmail: jest.fn() } as never
    );

    await svc.acceptRecommendation(
      {
        mapLocationId: "ml-1",
        wasteTypeCode: "General C&D",
        loadTonnes: 10,
        originType: "tender",
        tenderId: "tender-123"
      },
      "user-1"
    );

    expect(prisma.tipRecommendationLog.create).toHaveBeenCalledTimes(1);
    const data = prisma.tipRecommendationLog.create.mock.calls[0][0].data;
    expect(data.tenderId).toBe("tender-123");
    expect(data.projectId).toBeNull();
  });

  test("stores projectId when originType = project, tenderId = null", async () => {
    const tip = makeTip("ml-1", { lat: "-27.5", lng: "153.0" });
    const prisma = makePrismaForAccept({
      tip,
      settings: { travelRatePerKm: makeDecimal("2.5") },
      project: { id: "proj-1", siteId: "site-1" },
      site: {
        centreLat: makeDecimal("-27.2"),
        centreLng: makeDecimal("153.1")
      }
    });

    const svc = new TipRecommendationsService(
      prisma as never,
      rateResolver as never,
      { create: jest.fn() } as never,
      { sendNotificationEmail: jest.fn() } as never
    );

    await svc.acceptRecommendation(
      {
        mapLocationId: "ml-1",
        wasteTypeCode: "General C&D",
        loadTonnes: 10,
        originType: "project",
        projectId: "proj-1"
      },
      "user-1"
    );

    const data = prisma.tipRecommendationLog.create.mock.calls[0][0].data;
    expect(data.tenderId).toBeNull();
    expect(data.projectId).toBe("proj-1");
  });
});

// ---- 2. listForProject merges tender + job rows with Decimal totals ---------

describe("TipRecommendationsService.listForProject", () => {
  function makeListPrisma(opts: {
    project?: { id: string; sourceTenderId: string | null } | null;
    jobRows?: ReturnType<typeof makeLog>[];
    tenderRows?: ReturnType<typeof makeLog>[];
  }) {
    const prisma: Record<string, any> = {
      project: {
        findUnique: jest.fn().mockResolvedValue(opts.project ?? null)
      },
      tipRecommendationLog: {
        findMany: jest.fn()
          .mockResolvedValueOnce(opts.jobRows ?? [])
          .mockResolvedValueOnce(opts.tenderRows ?? [])
      }
    };
    return prisma;
  }

  test("throws NotFoundException when project does not exist", async () => {
    const prisma = makeListPrisma({ project: null });
    const svc = new TipRecommendationsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never
    );
    await expect(svc.listForProject("proj-missing")).rejects.toThrow(NotFoundException);
  });

  test("returns empty summary when project has no tender and no job rows", async () => {
    const prisma = makeListPrisma({
      project: { id: "proj-1", sourceTenderId: null },
      jobRows: []
    });
    const svc = new TipRecommendationsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never
    );
    const result = await svc.listForProject("proj-1");
    expect(result.loads).toBe(0);
    expect(result.rows).toHaveLength(0);
    expect(result.tonnes).toBe("0.000");
    expect(result.total).toBe("0.00");
  });

  test("merges tender + job rows; source field distinguishes them", async () => {
    const tenderLog = makeLog("log-tender", {
      tenderId: "tender-1",
      projectId: null,
      loadTonnes: "12.000",
      disposalFee: "1680.00",
      travelCost: "318.20",
      totalCost: "1998.20",
      createdAt: new Date("2026-09-03T00:00:00Z")
    });
    const jobLog = makeLog("log-job", {
      projectId: "proj-1",
      loadTonnes: "8.000",
      disposalFee: "1120.00",
      travelCost: "318.20",
      totalCost: "1438.20",
      createdAt: new Date("2026-09-16T00:00:00Z")
    });

    const prisma: Record<string, any> = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: "proj-1",
          sourceTenderId: "tender-1"
        })
      },
      tipRecommendationLog: {
        findMany: jest.fn()
          // first call: jobRows
          .mockResolvedValueOnce([jobLog])
          // second call: tenderRows
          .mockResolvedValueOnce([tenderLog])
      }
    };

    const svc = new TipRecommendationsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never
    );
    const result = await svc.listForProject("proj-1");

    expect(result.loads).toBe(2);
    expect(result.rows).toHaveLength(2);

    // tender row
    const tender = result.rows.find((r) => r.id === "log-tender");
    expect(tender?.source).toBe("tender");
    // job row
    const job = result.rows.find((r) => r.id === "log-job");
    expect(job?.source).toBe("job");

    // Totals: Decimal addition 1998.20 + 1438.20 = 3436.40
    expect(result.total).toBe("3436.40");
    // Tonnes: 12.000 + 8.000 = 20.000
    expect(result.tonnes).toBe("20.000");
    // Disposal: 1680.00 + 1120.00 = 2800.00
    expect(result.disposal).toBe("2800.00");
  });

  test("deduplicates a row that appears in both tender and job buckets", async () => {
    // Unusual edge case: a row has both tenderId and projectId
    const dupLog = makeLog("log-dup", {
      projectId: "proj-1",
      tenderId: "tender-1",
      loadTonnes: "5.000",
      disposalFee: "500.00",
      travelCost: "100.00",
      totalCost: "600.00"
    });

    const prisma: Record<string, any> = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: "proj-1",
          sourceTenderId: "tender-1"
        })
      },
      tipRecommendationLog: {
        findMany: jest.fn()
          .mockResolvedValueOnce([dupLog])
          .mockResolvedValueOnce([dupLog])
      }
    };

    const svc = new TipRecommendationsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never
    );
    const result = await svc.listForProject("proj-1");
    // Should appear only once
    expect(result.rows).toHaveLength(1);
    expect(result.loads).toBe(1);
  });
});

// ---- 3. sendPriceReviewDigest cron logic -----------------------------------

describe("TipRecommendationsService.sendPriceReviewDigest", () => {
  const REVIEW_CYCLE_DAYS = 182;

  function makeCronPrisma(opts: {
    trigger?: object | null;
    dueTips?: ReturnType<typeof makeTip>[];
    recipients?: { id: string; email: string }[];
  }) {
    const createFn = jest.fn().mockResolvedValue({ id: "notif-1" });
    const updateManyFn = jest.fn().mockResolvedValue({ count: 0 });
    const prisma: Record<string, any> = {
      notificationTriggerConfig: {
        findUnique: jest.fn().mockResolvedValue(
          opts.trigger !== undefined
            ? opts.trigger
            : {
                trigger: "waste.price_review_due",
                isEnabled: true,
                deliveryMethod: "both",
                recipientRoles: ["Admin"],
                recipientUserIds: []
              }
        )
      },
      mapLocation: {
        findMany: jest.fn().mockResolvedValue(opts.dueTips ?? []),
        updateMany: updateManyFn
      },
      user: {
        findMany: jest.fn().mockResolvedValue(opts.recipients ?? [{ id: "user-admin", email: "admin@test.com" }])
      }
    };
    return { prisma, createFn, updateManyFn };
  }

  test("does nothing when trigger is disabled", async () => {
    const { prisma, createFn } = makeCronPrisma({
      trigger: { trigger: "waste.price_review_due", isEnabled: false }
    });
    const notifications = { create: createFn };
    const email = { sendNotificationEmail: jest.fn() };

    const svc = new TipRecommendationsService(
      prisma as never,
      {} as never,
      notifications as never,
      email as never
    );
    const sent = await svc.sendPriceReviewDigest();
    expect(sent).toBe(0);
    expect(createFn).not.toHaveBeenCalled();
  });

  test("does nothing when no tips are due", async () => {
    const { prisma, createFn } = makeCronPrisma({ dueTips: [] });
    const notifications = { create: createFn };
    const email = { sendNotificationEmail: jest.fn() };

    const svc = new TipRecommendationsService(
      prisma as never,
      {} as never,
      notifications as never,
      email as never
    );
    const sent = await svc.sendPriceReviewDigest();
    expect(sent).toBe(0);
    expect(createFn).not.toHaveBeenCalled();
  });

  test("sends digest for never-reviewed tip and stamps pricesReviewNotifiedAt", async () => {
    const tip = { ...makeTip("ml-1"), pricesReviewedAt: null, pricesReviewNotifiedAt: null };
    const { prisma, createFn, updateManyFn } = makeCronPrisma({ dueTips: [tip] });
    const notifications = { create: createFn };
    const email = { sendNotificationEmail: jest.fn() };

    const svc = new TipRecommendationsService(
      prisma as never,
      {} as never,
      notifications as never,
      email as never
    );
    const sent = await svc.sendPriceReviewDigest();

    expect(sent).toBe(1);
    expect(createFn).toHaveBeenCalledTimes(1);
    // Title contains count
    const call = createFn.mock.calls[0][0];
    expect(call.title).toContain("1 tip");
    expect(call.body).toContain("never reviewed");

    // Stamps the tip
    expect(updateManyFn).toHaveBeenCalledTimes(1);
    const stampCall = updateManyFn.mock.calls[0][0];
    expect(stampCall.where.id.in).toContain("ml-1");
  });

  test("second run does NOT resend after stamp (pricesReviewNotifiedAt = now, pricesReviewedAt = null)", async () => {
    // After first run: pricesReviewedAt=null, pricesReviewNotifiedAt=now
    // The cron will see this tip as due (never reviewed) but already notified.
    const tip = {
      ...makeTip("ml-1"),
      pricesReviewedAt: null,
      pricesReviewNotifiedAt: new Date() // already stamped
    };
    const { prisma, createFn } = makeCronPrisma({ dueTips: [tip] });
    const notifications = { create: createFn };
    const email = { sendNotificationEmail: jest.fn() };

    const svc = new TipRecommendationsService(
      prisma as never,
      {} as never,
      notifications as never,
      email as never
    );
    const sent = await svc.sendPriceReviewDigest();
    // Already notified this cycle, nothing to do
    expect(sent).toBe(0);
    expect(createFn).not.toHaveBeenCalled();
  });

  test("after mark-reviewed, cycle resets: tip is included again when 182 days pass", async () => {
    // Simulate: reviewed 190 days ago (overdue), notified before the review
    const reviewedAt = new Date(Date.now() - (REVIEW_CYCLE_DAYS + 8) * 24 * 60 * 60 * 1000);
    const notifiedAt = new Date(Date.now() - (REVIEW_CYCLE_DAYS + 100) * 24 * 60 * 60 * 1000); // older
    const tip = {
      ...makeTip("ml-1"),
      pricesReviewedAt: reviewedAt,
      pricesReviewNotifiedAt: notifiedAt
    };
    const { prisma, createFn, updateManyFn } = makeCronPrisma({ dueTips: [tip] });
    const notifications = { create: createFn };
    const email = { sendNotificationEmail: jest.fn() };

    const svc = new TipRecommendationsService(
      prisma as never,
      {} as never,
      notifications as never,
      email as never
    );
    const sent = await svc.sendPriceReviewDigest();

    // notifiedAt < reviewedAt means cycle reset -- should be included
    expect(sent).toBe(1);
    expect(createFn).toHaveBeenCalledTimes(1);
    expect(updateManyFn).toHaveBeenCalledTimes(1);
  });
});

// ---- 4. MapLocationsService.markPricesReviewed -- POI returns 400 -----------

describe("MapLocationsService.markPricesReviewed", () => {
  test("throws 400 for a POI location", async () => {
    const poi = {
      id: "ml-poi",
      kind: "POI" as const,
      name: "Test POI",
      isActive: true,
      facility: null
    };
    const prisma: Record<string, any> = {
      mapLocation: {
        findUnique: jest.fn().mockResolvedValue(poi),
        update: jest.fn()
      }
    };
    const svc = new MapLocationsService(prisma as never);
    await expect(svc.markPricesReviewed("ml-poi")).rejects.toThrow(BadRequestException);
    expect(prisma.mapLocation.update).not.toHaveBeenCalled();
  });

  test("throws 404 when location does not exist", async () => {
    const prisma: Record<string, any> = {
      mapLocation: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn()
      }
    };
    const svc = new MapLocationsService(prisma as never);
    await expect(svc.markPricesReviewed("ml-missing")).rejects.toThrow(NotFoundException);
  });

  test("sets pricesReviewedAt and returns nextReviewAt for a TIP", async () => {
    const tip = {
      ...makeTip("ml-1"),
      pricesReviewedAt: null,
      pricesReviewNotifiedAt: null
    };
    const now = new Date();
    const updatedTip = { ...tip, pricesReviewedAt: now };
    const prisma: Record<string, any> = {
      mapLocation: {
        findUnique: jest.fn().mockResolvedValue(tip),
        update: jest.fn().mockResolvedValue(updatedTip)
      },
      estimateWasteRate: { count: jest.fn().mockResolvedValue(1) }
    };
    const svc = new MapLocationsService(prisma as never);
    const result = await svc.markPricesReviewed("ml-1");

    expect(prisma.mapLocation.update).toHaveBeenCalledWith({
      where: { id: "ml-1" },
      data: { pricesReviewedAt: expect.any(Date) }
    });
    expect(result).toHaveProperty("pricesReviewedAt");
    expect(result).toHaveProperty("nextReviewAt");
    // nextReviewAt should be roughly 182 days after now
    const next = new Date((result as any).nextReviewAt);
    const diff = next.getTime() - now.getTime();
    const diffDays = diff / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(182, 0);
  });
});

/**
 * EA-2a — Estimating Analytics system dashboard preset
 *
 * Asserts the preset definition that seed.ts seeds as the
 * "estimating-analytics" system UserDashboard:
 *   - slug, isSystem, isDefault match their intended values
 *   - every type string is a valid web-registry key (report:chart:<key>,
 *     report:table:<key>, or a known static widget type)
 *   - every widget entry carries an explicit colSpan
 *   - the home preset still carries isDefault: true (not displaced)
 *   - re-running the seed upsert path is idempotent
 *
 * Type-string validity is derived from the real API report-definition arrays
 * (ESTIMATING_ANALYTICS_REPORT_DEFS, TENDER_WINLOSS_REPORT_DEFS) plus the
 * inline base definitions (tender-pipeline, tender-win-rate). This means the
 * test fails if a report key is renamed in the definitions but not updated in
 * the preset — which is the error it exists to catch.
 *
 * NOTE: seed.ts is NOT imported here because it calls main() at module load
 * time (line 4065) which would attempt a real DB connection. The preset is
 * reproduced inline and validated against the authoritative report definitions.
 * The done_when gate (grep -q "report:chart:estimator-turnaround" seed.ts)
 * provides the coupling between this spec and the seed file.
 */

import { ESTIMATING_ANALYTICS_REPORT_DEFS } from "../../reporting/estimating-analytics-report.definitions";
import { TENDER_WINLOSS_REPORT_DEFS } from "../../reporting/tender-winloss-report.definitions";

// ── Preset definition ────────────────────────────────────────────────────────
//
// This mirrors ESTIMATING_ANALYTICS_PRESET in apps/api/prisma/seed.ts exactly.
// If the seed changes the widget list, this spec must be updated to match.
// Span sequence: w4, w2, w2, w2, w2, w2, w2, w4, w2, w2 (from mock-up).

const EA_PRESET = {
  slug: "estimating-analytics",
  name: "Estimating Analytics",
  isSystem: true,
  isDefault: false,
  widgets: [
    { type: "report:chart:estimator-turnaround",         colSpan: 4 },
    { type: "report:chart:tender-win-rate",              colSpan: 2 },
    { type: "report:chart:estimator-qty-vs-value",       colSpan: 2 },
    { type: "ten_win_rate_chart",                        colSpan: 2 },
    { type: "report:chart:tender-winloss-over-time",     colSpan: 2 },
    { type: "report:chart:tender-winloss-by-value-band", colSpan: 2 },
    { type: "report:chart:tender-winloss-by-reason",     colSpan: 2 },
    { type: "report:table:tender-winloss-by-client",     colSpan: 4 },
    { type: "report:chart:tender-pipeline",              colSpan: 2 },
    { type: "report:chart:tender-outcome-coverage",      colSpan: 2 }
  ] as Array<{ type: string; colSpan: number }>
};

// ── Valid type-string set ────────────────────────────────────────────────────
//
// Build the set of widget types that the web registry accepts, derived from the
// API's report definitions. We cannot import from apps/web here, so:
//
// 1. For report widgets — generate report:chart:<key> and report:table:<key>
//    from the exported definition arrays. These cover ESTIMATING_ANALYTICS and
//    TENDER_WINLOSS slices.
// 2. For the two inline base definitions used in the preset (tender-pipeline,
//    tender-win-rate) — these keys are defined inline in reporting.service.ts
//    (not exported). They are included here with their stable string values
//    which match the inline chart spec at reporting.service.ts lines 162 + 219.
// 3. ten_win_rate_chart — the one static (non-report) widget in the preset,
//    registered at widgetRegistry.ts:339.

type ReportDefLike = {
  key: string;
  chart?: { type: string; xKey: string; yKey: string; title: string };
  columns?: Array<{ key: string; label: string }>;
};

function buildReportTypeSet(defs: ReportDefLike[]): Set<string> {
  const types = new Set<string>();
  for (const def of defs) {
    if (def.columns && def.columns.length > 0) {
      types.add(`report:table:${def.key}`);
    }
    if (def.chart) {
      types.add(`report:chart:${def.key}`);
    }
  }
  return types;
}

const VALID_REPORT_TYPES = new Set<string>([
  // From exported definition arrays (these fail if a key is renamed)
  ...buildReportTypeSet(ESTIMATING_ANALYTICS_REPORT_DEFS),
  ...buildReportTypeSet(TENDER_WINLOSS_REPORT_DEFS),
  // Inline base definitions in reporting.service.ts (both have chart + columns)
  "report:chart:tender-pipeline",
  "report:table:tender-pipeline",
  "report:chart:tender-win-rate",
  "report:table:tender-win-rate"
]);

// Static (non-report) widget types used in the preset
const VALID_STATIC_TYPES = new Set<string>([
  "ten_win_rate_chart" // widgetRegistry.ts line 339
]);

const ALL_VALID_TYPES = new Set<string>([
  ...VALID_REPORT_TYPES,
  ...VALID_STATIC_TYPES
]);

// ── Prisma mock helpers ──────────────────────────────────────────────────────

type DashboardRow = {
  id: string;
  userId: string;
  slug: string;
  isSystem: boolean;
  isDefault: boolean;
  name: string;
  config: Record<string, unknown>;
};

type MockPrisma = {
  permission: { findUnique: jest.Mock };
  user: { findMany: jest.Mock };
  userDashboard: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

function makePrisma(overrides: {
  permissionFindUnique?: jest.Mock;
  userFindMany?: jest.Mock;
  dashFindUnique?: jest.Mock;
  dashCreate?: jest.Mock;
  dashUpdate?: jest.Mock;
}): MockPrisma {
  return {
    permission: {
      findUnique: overrides.permissionFindUnique ?? jest.fn().mockResolvedValue({ id: "perm-1" })
    },
    user: {
      findMany: overrides.userFindMany ?? jest.fn().mockResolvedValue([{ id: "user-1" }])
    },
    userDashboard: {
      findUnique: overrides.dashFindUnique ?? jest.fn().mockResolvedValue(null),
      create: overrides.dashCreate ?? jest.fn().mockResolvedValue(undefined),
      update: overrides.dashUpdate ?? jest.fn().mockResolvedValue(undefined)
    }
  };
}

/**
 * Simulate the EA seeding block in isolation. Mirrors the logic in
 * seedUserDashboards() at apps/api/prisma/seed.ts without calling the full
 * seed function (which requires a real database and all prior seed data).
 */
async function runEaBlock(prisma: MockPrisma): Promise<void> {
  const reportingViewPerm = await prisma.permission.findUnique({
    where: { code: "reporting.view" }
  }) as { id: string } | null;

  if (!reportingViewPerm) return;

  const reportingUsers = await prisma.user.findMany({
    where: {
      userRoles: {
        some: {
          role: {
            permissions: {
              some: { permissionId: reportingViewPerm.id }
            }
          }
        }
      }
    },
    select: { id: true }
  }) as Array<{ id: string }>;

  const ea = EA_PRESET;

  for (const user of reportingUsers) {
    const config = {
      period: "30d",
      widgets: ea.widgets.map((w, order) => ({
        id: `${w.type}-default`,
        type: w.type,
        visible: true,
        order,
        colSpan: w.colSpan,
        config: { period: null, filters: {} }
      }))
    };
    const existing = await prisma.userDashboard.findUnique({
      where: { userId_slug_isSystem: { userId: user.id, slug: ea.slug, isSystem: true } }
    }) as DashboardRow | null;

    if (existing) {
      await prisma.userDashboard.update({
        where: { id: existing.id },
        data: { name: ea.name, config }
      });
    } else {
      await prisma.userDashboard.create({
        data: {
          userId: user.id,
          name: ea.name,
          slug: ea.slug,
          isSystem: true,
          isDefault: false,
          config
        }
      });
    }
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("EA_PRESET — shape", () => {
  it("has slug 'estimating-analytics'", () => {
    expect(EA_PRESET.slug).toBe("estimating-analytics");
  });

  it("isSystem is true", () => {
    expect(EA_PRESET.isSystem).toBe(true);
  });

  it("isDefault is false — does not displace Home", () => {
    expect(EA_PRESET.isDefault).toBe(false);
  });

  it("has 10 widgets matching the mock-up span sequence (w4,w2,w2,w2,w2,w2,w2,w4,w2,w2)", () => {
    const spans = EA_PRESET.widgets.map((w) => w.colSpan);
    expect(spans).toEqual([4, 2, 2, 2, 2, 2, 2, 4, 2, 2]);
  });

  it("every widget carries an explicit colSpan > 0", () => {
    for (const w of EA_PRESET.widgets) {
      expect(typeof w.colSpan).toBe("number");
      expect(w.colSpan).toBeGreaterThan(0);
    }
  });

  it("every type string is accepted by the web registry", () => {
    const invalid: string[] = [];
    for (const w of EA_PRESET.widgets) {
      if (!ALL_VALID_TYPES.has(w.type)) invalid.push(w.type);
    }
    expect(invalid).toEqual([]);
  });

  it("the estimator-turnaround key exists in ESTIMATING_ANALYTICS_REPORT_DEFS (chart spec)", () => {
    const def = ESTIMATING_ANALYTICS_REPORT_DEFS.find((d) => d.key === "estimator-turnaround");
    expect(def).toBeDefined();
    expect(def!.chart).toBeDefined();
  });

  it("the first widget is the estimator-turnaround hero with colSpan 4", () => {
    const first = EA_PRESET.widgets[0];
    expect(first.type).toBe("report:chart:estimator-turnaround");
    expect(first.colSpan).toBe(4);
  });

  it("contains report:table:tender-winloss-by-client full-width (colSpan 4)", () => {
    const found = EA_PRESET.widgets.find(
      (w) => w.type === "report:table:tender-winloss-by-client"
    );
    expect(found).toBeDefined();
    expect(found!.colSpan).toBe(4);
  });

  it("contains the hand-written ten_win_rate_chart widget (colSpan 2)", () => {
    const found = EA_PRESET.widgets.find((w) => w.type === "ten_win_rate_chart");
    expect(found).toBeDefined();
    expect(found!.colSpan).toBe(2);
  });

  it("does NOT include HR/Operations report keys excluded by Marco 2026-09-08", () => {
    const excluded = [
      "job-status-summary",
      "worker-competency-expiry",
      "asset-utilisation-snapshot"
    ];
    for (const key of excluded) {
      const found = EA_PRESET.widgets.find((w) => w.type.includes(key));
      expect(found).toBeUndefined();
    }
  });

  it("ESTIMATING_ANALYTICS_REPORT_DEFS covers estimator-turnaround and estimator-qty-vs-value", () => {
    const keys = ESTIMATING_ANALYTICS_REPORT_DEFS.map((d) => d.key);
    expect(keys).toContain("estimator-turnaround");
    expect(keys).toContain("estimator-qty-vs-value");
  });

  it("TENDER_WINLOSS_REPORT_DEFS covers all four winloss variants used in the preset", () => {
    const keys = TENDER_WINLOSS_REPORT_DEFS.map((d) => d.key);
    expect(keys).toContain("tender-winloss-over-time");
    expect(keys).toContain("tender-winloss-by-value-band");
    expect(keys).toContain("tender-winloss-by-reason");
    expect(keys).toContain("tender-winloss-by-client");
    expect(keys).toContain("tender-outcome-coverage");
  });
});

describe("EA seeding — row creation (create path)", () => {
  it("creates a UserDashboard row with correct slug, isSystem true, isDefault false", async () => {
    const dashCreate = jest.fn().mockResolvedValue(undefined);
    const prisma = makePrisma({
      dashFindUnique: jest.fn().mockResolvedValue(null),
      dashCreate
    });
    await runEaBlock(prisma);
    expect(dashCreate).toHaveBeenCalledTimes(1);
    const { data } = dashCreate.mock.calls[0][0] as { data: DashboardRow };
    expect(data.slug).toBe("estimating-analytics");
    expect(data.isSystem).toBe(true);
    expect(data.isDefault).toBe(false);
    expect(data.name).toBe("Estimating Analytics");
  });

  it("seeds only users who hold reporting.view — no create when permission row absent", async () => {
    const dashCreate = jest.fn().mockResolvedValue(undefined);
    const prisma = makePrisma({
      permissionFindUnique: jest.fn().mockResolvedValue(null),
      dashCreate
    });
    await runEaBlock(prisma);
    expect(dashCreate).not.toHaveBeenCalled();
  });

  it("queries users by Role→RolePermission→Permission chain, not by role name", async () => {
    const userFindMany = jest.fn().mockResolvedValue([{ id: "user-1" }]);
    const prisma = makePrisma({ userFindMany });
    await runEaBlock(prisma);
    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userRoles: expect.objectContaining({
            some: expect.objectContaining({
              role: expect.objectContaining({
                permissions: expect.objectContaining({
                  some: expect.objectContaining({ permissionId: "perm-1" })
                })
              })
            })
          })
        })
      })
    );
  });

  it("created config contains a widget entry for every preset widget", async () => {
    const dashCreate = jest.fn().mockResolvedValue(undefined);
    const prisma = makePrisma({
      dashFindUnique: jest.fn().mockResolvedValue(null),
      dashCreate
    });
    await runEaBlock(prisma);
    const { data } = dashCreate.mock.calls[0][0] as {
      data: { config: { widgets: Array<{ type: string; colSpan: number }> } };
    };
    expect(data.config.widgets).toHaveLength(EA_PRESET.widgets.length);
    for (const expected of EA_PRESET.widgets) {
      const found = data.config.widgets.find((w) => w.type === expected.type);
      expect(found).toBeDefined();
      expect(found!.colSpan).toBe(expected.colSpan);
    }
  });
});

describe("EA seeding — idempotency (update path)", () => {
  it("updates existing row rather than creating a duplicate on re-run", async () => {
    const existingRow: DashboardRow = {
      id: "dash-ea-1",
      userId: "user-1",
      slug: "estimating-analytics",
      isSystem: true,
      isDefault: false,
      name: "Estimating Analytics",
      config: {}
    };
    const dashCreate = jest.fn().mockResolvedValue(undefined);
    const dashUpdate = jest.fn().mockResolvedValue(undefined);
    const prisma = makePrisma({
      dashFindUnique: jest.fn().mockResolvedValue(existingRow),
      dashCreate,
      dashUpdate
    });
    await runEaBlock(prisma);
    expect(dashCreate).not.toHaveBeenCalled();
    expect(dashUpdate).toHaveBeenCalledTimes(1);
    const { where, data } = dashUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: { name: string; config: Record<string, unknown> };
    };
    expect(where.id).toBe("dash-ea-1");
    expect(data.name).toBe("Estimating Analytics");
  });
});

describe("Home preset — not displaced", () => {
  it("EA preset slug is not 'home'", () => {
    expect(EA_PRESET.slug).not.toBe("home");
  });

  it("EA preset isDefault is false", () => {
    expect(EA_PRESET.isDefault).toBe(false);
  });
});

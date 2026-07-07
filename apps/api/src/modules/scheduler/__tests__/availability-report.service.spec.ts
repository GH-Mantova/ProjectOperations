import { BadRequestException } from "@nestjs/common";
import { AvailabilityReportService } from "../availability-report.service";

/**
 * PR-454 — Availability heatmap service specs.
 *
 * Mocks PrismaService; asserts unique-by-name dedupe, archived exclusion,
 * skip-non-working-days, and CSV row/column shape.
 */

type PrismaSeed = {
  workers?: Array<{ id: string; firstName: string; lastName: string; role: string }>;
  leaves?: Array<{ workerProfileId: string; startDate: Date; endDate: Date }>;
  unavailability?: Array<{
    workerProfileId: string;
    startDate: Date | null;
    endDate: Date | null;
    recurringDay: number | null;
  }>;
  allocations?: Array<{
    workerProfileId: string;
    date: Date;
    project: { id: string; projectNumber: string; name: string };
  }>;
  holidays?: Array<{ date: Date }>;
};

function prismaMock(seed: PrismaSeed = {}) {
  return {
    workerProfile: {
      findMany: jest.fn().mockResolvedValue(seed.workers ?? [])
    },
    workerLeave: {
      findMany: jest.fn().mockResolvedValue(seed.leaves ?? [])
    },
    workerUnavailability: {
      findMany: jest.fn().mockResolvedValue(seed.unavailability ?? [])
    },
    scheduleAllocation: {
      findMany: jest.fn().mockResolvedValue(seed.allocations ?? [])
    },
    publicHoliday: {
      findMany: jest.fn().mockResolvedValue(seed.holidays ?? [])
    }
  } as never;
}

describe("AvailabilityReportService", () => {
  it("rejects an invalid month", async () => {
    const svc = new AvailabilityReportService(prismaMock());
    await expect(svc.report({ month: "2026-13" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("excludes archived workers (workerProfile.findMany is filtered isActive=true)", async () => {
    const prisma = prismaMock();
    const svc = new AvailabilityReportService(prisma);
    await svc.report({ month: "2026-07" });
    expect((prisma as never as { workerProfile: { findMany: jest.Mock } }).workerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } })
    );
  });

  it("counts the same display name only once in the TOTAL AVAILABLE row", async () => {
    const svc = new AvailabilityReportService(
      prismaMock({
        workers: [
          { id: "w-1", firstName: "Jane", lastName: "Smith", role: "Carpenter" },
          { id: "w-2", firstName: "JANE", lastName: " smith ", role: "Carpenter" },
          { id: "w-3", firstName: "Sam", lastName: "Jones", role: "Carpenter" }
        ]
      })
    );
    const r = await svc.report({ month: "2026-07" });
    const day = r.totals.uniqueAvailablePerDay.find((d) => d.date === "2026-07-01")!;
    // 3 records, 2 distinct names → 2 unique-by-name available.
    expect(day.count).toBe(2);
    // But the per-group counter is per-record, so total=3.
    expect(r.groups[0].total).toBe(3);
    expect(r.groups[0].perDay.find((d) => d.date === "2026-07-01")!.available).toBe(3);
  });

  it("skip-non-working-days removes weekends and seeded holidays from the day list", async () => {
    const svc = new AvailabilityReportService(
      prismaMock({
        workers: [{ id: "w-1", firstName: "Sam", lastName: "Jones", role: "Carpenter" }],
        holidays: [{ date: new Date(Date.UTC(2026, 6, 1)) }] // 2026-07-01
      })
    );
    const r = await svc.report({ month: "2026-07", skipNonWorkingDays: true });
    const holidayCell = r.days.find((d) => d.date === "2026-07-01")!;
    expect(holidayCell.isHoliday).toBe(true);
    expect(holidayCell.skipped).toBe(true);
    // 2026-07-04 is a Saturday.
    const sat = r.days.find((d) => d.date === "2026-07-04")!;
    expect(sat.isWeekend).toBe(true);
    expect(sat.skipped).toBe(true);
    // Skipped days produce zero on the unique-by-name total.
    const totalSat = r.totals.uniqueAvailablePerDay.find((d) => d.date === "2026-07-04")!;
    expect(totalSat.count).toBe(0);
  });

  it("classifies committed days vs available days and lists their projects", async () => {
    const allocDate = new Date(Date.UTC(2026, 6, 15));
    const svc = new AvailabilityReportService(
      prismaMock({
        workers: [{ id: "w-1", firstName: "Sam", lastName: "Jones", role: "Carpenter" }],
        allocations: [
          {
            workerProfileId: "w-1",
            date: allocDate,
            project: { id: "p-1", projectNumber: "J-001", name: "Buranda SS" }
          }
        ]
      })
    );
    const r = await svc.report({ month: "2026-07" });
    const worker = r.workers[0];
    expect(worker.status).toBe("MIXED");
    expect(worker.committedRanges.some(
      (c) => c.from === "2026-07-15" && c.to === "2026-07-15" && c.projects?.[0]?.projectNumber === "J-001"
    )).toBe(true);
    // Available days exclude the committed day.
    const day = r.groups[0].perDay.find((d) => d.date === "2026-07-15")!;
    expect(day.available).toBe(0);
  });

  it("CSV has header + one row per group + a TOTAL AVAILABLE row, with day columns", async () => {
    const svc = new AvailabilityReportService(
      prismaMock({
        workers: [
          { id: "w-1", firstName: "Sam", lastName: "Jones", role: "Carpenter" },
          { id: "w-2", firstName: "Pat", lastName: "Lee", role: "Operator" }
        ]
      })
    );
    const csv = await svc.reportCsv({ month: "2026-07" });
    const lines = csv.split("\r\n").filter((l) => l.length > 0);
    // 1 header + 2 groups + 1 total = 4 lines
    expect(lines).toHaveLength(4);
    expect(lines[0].startsWith("group,total,2026-07-01,")).toBe(true);
    expect(lines[lines.length - 1].startsWith("TOTAL AVAILABLE (unique by name),,")).toBe(true);
    // 31 day columns for July → header has 2 + 31 = 33 cols.
    expect(lines[0].split(",")).toHaveLength(33);
  });
});

describe("AvailabilityReportService.heatmap (dashboard widget)", () => {
  function heatmapPrismaMock(seed: {
    workers?: Array<{ id: string; firstName: string; lastName: string; role: string }>;
    allocations?: Array<{ workerProfileId: string; projectId: string; date: Date }>;
  }) {
    return {
      workerProfile: { findMany: jest.fn().mockResolvedValue(seed.workers ?? []) },
      scheduleAllocation: { findMany: jest.fn().mockResolvedValue(seed.allocations ?? []) }
    } as never;
  }

  it("buckets a fully-free worker as 'free' on every cell and reports totalLoad=0", async () => {
    const svc = new AvailabilityReportService(
      heatmapPrismaMock({
        workers: [{ id: "w-1", firstName: "A", lastName: "B", role: "Foreman" }]
      })
    );
    const result = await svc.heatmap({ days: 14, topN: 8 });
    expect(result.workers).toHaveLength(1);
    expect(result.workers[0].totalLoad).toBe(0);
    expect(result.workers[0].cells.every((c) => c.load === "free")).toBe(true);
    expect(result.days).toHaveLength(14);
  });

  it("collapses multi-role allocations on the same worker+day+project into ONE project (partial, not full)", async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const svc = new AvailabilityReportService(
      heatmapPrismaMock({
        workers: [{ id: "w-1", firstName: "Ken", lastName: "R", role: "Foreman" }],
        allocations: [
          { workerProfileId: "w-1", projectId: "p-A", date: today },
          { workerProfileId: "w-1", projectId: "p-A", date: today } // second role, same project
        ]
      })
    );
    const result = await svc.heatmap({ days: 14, topN: 8 });
    const firstCell = result.workers[0].cells[0];
    expect(firstCell.projectCount).toBe(1);
    expect(firstCell.load).toBe("partial");
  });

  it("counts allocations across DIFFERENT projects on the same day as 'full'", async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const svc = new AvailabilityReportService(
      heatmapPrismaMock({
        workers: [{ id: "w-1", firstName: "Ken", lastName: "R", role: "Foreman" }],
        allocations: [
          { workerProfileId: "w-1", projectId: "p-A", date: today },
          { workerProfileId: "w-1", projectId: "p-B", date: today }
        ]
      })
    );
    const result = await svc.heatmap({ days: 14, topN: 8 });
    const firstCell = result.workers[0].cells[0];
    expect(firstCell.projectCount).toBe(2);
    expect(firstCell.load).toBe("full");
  });

  it("caps returned workers at topN and ranks by allocation activity desc", async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const svc = new AvailabilityReportService(
      heatmapPrismaMock({
        workers: [
          { id: "w-1", firstName: "A", lastName: "A", role: "F" },
          { id: "w-2", firstName: "B", lastName: "B", role: "F" },
          { id: "w-3", firstName: "C", lastName: "C", role: "F" }
        ],
        allocations: [{ workerProfileId: "w-3", projectId: "p-A", date: today }]
      })
    );
    const result = await svc.heatmap({ days: 14, topN: 2 });
    expect(result.workers).toHaveLength(2);
    expect(result.workers[0].workerProfileId).toBe("w-3"); // highest load first
  });

  it("clamps day/topN to safe bounds", async () => {
    const svc = new AvailabilityReportService(heatmapPrismaMock({}));
    const tooSmall = await svc.heatmap({ days: 0, topN: 0 });
    expect(tooSmall.days).toHaveLength(7); // clamped to min
    const tooBig = await svc.heatmap({ days: 999, topN: 999 });
    expect(tooBig.days).toHaveLength(42); // clamped to max
  });
});

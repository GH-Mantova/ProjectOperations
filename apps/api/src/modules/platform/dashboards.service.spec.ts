import { DashboardsService } from "./dashboards.service";

describe("DashboardsService", () => {
  it("renders a KPI widget using scheduler conflicts as the default metric", async () => {
    const service = new DashboardsService(
      {
        schedulingConflict: {
          count: jest.fn().mockResolvedValue(5)
        }
      } as never,
      {} as never
    );

    const result = await (service as any).renderWidget({
      type: "kpi",
      config: {}
    });

    expect(result).toEqual({
      kind: "kpi",
      metricKey: "scheduler.conflicts",
      value: 5
    });
  });

  it("renders jobs by status chart from grouped live job data", async () => {
    const service = new DashboardsService(
      {
        job: {
          groupBy: jest.fn().mockResolvedValue([
            { status: "ACTIVE", _count: { _all: 2 } },
            { status: "PLANNING", _count: { _all: 1 } }
          ])
        }
      } as never,
      {} as never
    );

    const result = await (service as any).renderChart("jobs.byStatus");

    expect(result).toEqual({
      kind: "chart",
      metricKey: "jobs.byStatus",
      points: [
        { label: "ACTIVE", value: 2 },
        { label: "PLANNING", value: 1 }
      ]
    });
  });
});

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
      title: "Scheduler conflicts",
      config: {}
    });

    expect(result).toEqual({
      type: "kpi",
      title: "Scheduler conflicts",
      metricKey: "scheduler.conflicts",
      value: 5,
      trend: null,
      trendValue: null
    });
  });

  it("renders a bar chart from grouped live job data", async () => {
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

    const result = await (service as any).renderWidget({
      type: "bar_chart",
      title: "Jobs by status",
      config: { chart: "jobs.byStatus" }
    });

    expect(result).toEqual({
      type: "bar_chart",
      title: "Jobs by status",
      metricKey: "jobs.byStatus",
      data: [
        { label: "ACTIVE", value: 2 },
        { label: "PLANNING", value: 1 }
      ]
    });
  });

  it("renders a donut chart from grouped tender status data", async () => {
    const service = new DashboardsService(
      {
        tender: {
          groupBy: jest.fn().mockResolvedValue([
            { status: "SUBMITTED", _count: { _all: 3 } },
            { status: "AWARDED", _count: { _all: 1 } }
          ])
        }
      } as never,
      {} as never
    );

    const result = await (service as any).renderWidget({
      type: "donut_chart",
      title: "Tender pipeline",
      config: { chart: "tenders.byStage" }
    });

    expect(result).toEqual({
      type: "donut_chart",
      title: "Tender pipeline",
      metricKey: "tenders.byStage",
      data: [
        { label: "SUBMITTED", value: 3 },
        { label: "AWARDED", value: 1 }
      ]
    });
  });

  it("carries through trend and trendValue from KPI config", async () => {
    const service = new DashboardsService({} as never, {} as never);

    const result = await (service as any).renderWidget({
      type: "kpi",
      title: "Tender pipeline value",
      config: { value: "$7,240,000", trend: "up", trendValue: "+12% vs last quarter" }
    });

    expect(result).toEqual({
      type: "kpi",
      title: "Tender pipeline value",
      metricKey: "static",
      value: "$7,240,000",
      trend: "up",
      trendValue: "+12% vs last quarter"
    });
  });
});

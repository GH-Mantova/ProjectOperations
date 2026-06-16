import { describe, expect, it } from "vitest";
import {
  CUSTOM_WIDGET_TYPE,
  DATA_SOURCE_BY_KEY,
  chartsForMetric,
  computeCount,
  computeCountByStatus,
  computeSumValue,
  isDataSourceKey,
  metricsForSource,
  parseCustomConfig
} from "../customWidget";
import { WIDGET_BY_TYPE } from "../widgetRegistry";

describe("customWidget allowlist", () => {
  it("only recognises the five whitelisted data source keys", () => {
    expect(isDataSourceKey("tenders")).toBe(true);
    expect(isDataSourceKey("jobs")).toBe(true);
    expect(isDataSourceKey("projects")).toBe(true);
    expect(isDataSourceKey("formSubmissions")).toBe(true);
    expect(isDataSourceKey("maintenancePlans")).toBe(true);
    expect(isDataSourceKey("users")).toBe(false);
    expect(isDataSourceKey("../../etc/passwd")).toBe(false);
    expect(isDataSourceKey(null)).toBe(false);
  });

  it("offers sum_value only for sources that have a value field", () => {
    expect(metricsForSource(DATA_SOURCE_BY_KEY.tenders)).toContain("sum_value");
    expect(metricsForSource(DATA_SOURCE_BY_KEY.projects)).toContain("sum_value");
    expect(metricsForSource(DATA_SOURCE_BY_KEY.jobs)).not.toContain("sum_value");
    expect(metricsForSource(DATA_SOURCE_BY_KEY.formSubmissions)).not.toContain("sum_value");
  });

  it("matches each metric to compatible chart types", () => {
    expect(chartsForMetric("count")).toEqual(["kpi"]);
    expect(chartsForMetric("sum_value")).toEqual(["kpi"]);
    expect(chartsForMetric("count_by_status")).toEqual(["bar", "donut"]);
  });
});

describe("parseCustomConfig", () => {
  it("returns null for missing or unknown source", () => {
    expect(parseCustomConfig(undefined)).toBeNull();
    expect(parseCustomConfig({})).toBeNull();
    expect(parseCustomConfig({ dataSource: "evil", metric: "count", chartType: "kpi" })).toBeNull();
  });

  it("rejects sum_value on sources without a value field", () => {
    expect(
      parseCustomConfig({ dataSource: "jobs", metric: "sum_value", chartType: "kpi" })
    ).toBeNull();
  });

  it("rejects incompatible metric/chart combinations", () => {
    expect(
      parseCustomConfig({ dataSource: "tenders", metric: "count", chartType: "donut" })
    ).toBeNull();
  });

  it("accepts a valid config and falls back to a default title", () => {
    const parsed = parseCustomConfig({
      dataSource: "tenders",
      metric: "count_by_status",
      chartType: "bar"
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.title).toMatch(/tenders/i);
    expect(parsed!.dataSource).toBe("tenders");
  });

  it("keeps an explicit title and statusInclude filter", () => {
    const parsed = parseCustomConfig({
      title: "My pipeline",
      dataSource: "tenders",
      metric: "sum_value",
      chartType: "kpi",
      statusInclude: ["DRAFT", "SUBMITTED", 7]
    });
    expect(parsed?.title).toBe("My pipeline");
    expect(parsed?.statusInclude).toEqual(["DRAFT", "SUBMITTED"]);
  });
});

describe("metric aggregation", () => {
  const tenders = [
    { status: "DRAFT", estimatedValue: "1000" },
    { status: "SUBMITTED", estimatedValue: 2000 },
    { status: "SUBMITTED", estimatedValue: null },
    { status: "LOST", estimatedValue: "500" }
  ];

  it("counts all rows when no filter is set", () => {
    expect(computeCount(tenders, DATA_SOURCE_BY_KEY.tenders, undefined)).toBe(4);
  });

  it("counts only the included statuses", () => {
    expect(computeCount(tenders, DATA_SOURCE_BY_KEY.tenders, ["SUBMITTED"])).toBe(2);
  });

  it("sums monetary values, coercing strings and ignoring nulls", () => {
    expect(computeSumValue(tenders, DATA_SOURCE_BY_KEY.tenders, undefined)).toBe(3500);
    expect(computeSumValue(tenders, DATA_SOURCE_BY_KEY.tenders, ["SUBMITTED"])).toBe(2000);
  });

  it("groups by status and labels using the source's status map", () => {
    const grouped = computeCountByStatus(tenders, DATA_SOURCE_BY_KEY.tenders, undefined);
    const draft = grouped.find((g) => g.key === "DRAFT");
    const submitted = grouped.find((g) => g.key === "SUBMITTED");
    expect(draft?.value).toBe(1);
    expect(draft?.label).toBe("Identified");
    expect(submitted?.value).toBe(2);
    expect(submitted?.label).toBe("Submitted");
  });
});

describe("registry integration", () => {
  it("registers the custom widget under its expected type", () => {
    const meta = WIDGET_BY_TYPE[CUSTOM_WIDGET_TYPE];
    expect(meta).toBeDefined();
    expect(meta.category).toBe("custom");
    expect(typeof meta.component).toBe("function");
  });
});

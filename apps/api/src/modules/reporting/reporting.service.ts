import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

// Cross-module BI reporting layer (slice 1).
//
// Read-only aggregations over existing tables. New report definitions drop
// in by pushing another entry into REPORT_DEFS; the controller, exporter,
// and web page all pick them up without further wiring.
//
// Future slices layer an external warehouse and Power BI embed on top —
// this slice deliberately stays inside the transactional DB so the
// tabular/exportable surface ships now, beside the dashboard widget system.

export type ReportParamName = "from" | "to" | "projectId" | "clientId";

export interface ReportParameterSpec {
  name: ReportParamName;
  label: string;
  type: "date" | "string";
  required?: boolean;
  helperText?: string;
}

export interface ReportColumnSpec {
  key: string;
  label: string;
  align?: "left" | "right";
  format?: "text" | "number" | "currency" | "percent" | "date";
}

export interface ReportChartSpec {
  type: "bar";
  xKey: string;
  yKey: string;
  title: string;
  unit?: string;
}

export interface ReportRunParams {
  from?: string;
  to?: string;
  projectId?: string;
  clientId?: string;
}

export interface ReportRunResult {
  rows: Array<Record<string, string | number | null>>;
  totals?: Record<string, string | number>;
}

export interface ReportDefinition {
  key: string;
  title: string;
  description: string;
  parameters: ReportParameterSpec[];
  columns: ReportColumnSpec[];
  chart?: ReportChartSpec;
  run: (prisma: PrismaService, params: ReportRunParams) => Promise<ReportRunResult>;
}

export interface ReportDefinitionSummary {
  key: string;
  title: string;
  description: string;
  parameters: ReportParameterSpec[];
  columns: ReportColumnSpec[];
  chart?: ReportChartSpec;
}

export interface ReportRunResponse extends ReportDefinitionSummary {
  params: ReportRunParams;
  rows: Array<Record<string, string | number | null>>;
  totals?: Record<string, string | number>;
  generatedAt: string;
}

// ── date-window helpers ──────────────────────────────────────────────

function parseFromDate(raw?: string): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function parseToDate(raw?: string): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function dateRangeFilter(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  const gte = parseFromDate(from);
  const lte = parseToDate(to);
  if (!gte && !lte) return undefined;
  const filter: Prisma.DateTimeFilter = {};
  if (gte) filter.gte = gte;
  if (lte) filter.lte = lte;
  return filter;
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

function formatEstimatorName(estimator: { firstName: string | null; lastName: string | null; email: string } | null | undefined): string {
  if (!estimator) return "Unassigned";
  const name = [estimator.firstName, estimator.lastName].filter(Boolean).join(" ").trim();
  return name || estimator.email || "Unassigned";
}

// ── report definitions ───────────────────────────────────────────────

const TENDER_STATUS_ORDER = [
  "DRAFT",
  "IN_PROGRESS",
  "SUBMITTED",
  "AWARDED",
  "CONTRACT_ISSUED",
  "LOST",
  "WITHDRAWN"
] as const;

const JOB_STATUS_ORDER = [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED"
] as const;

const REPORT_DEFS: ReportDefinition[] = [
  {
    key: "tender-pipeline",
    title: "Tender pipeline",
    description:
      "Live tenders grouped by status with count and total estimated value. Filter by creation window and (optionally) client.",
    parameters: [
      { name: "from", label: "Created from", type: "date" },
      { name: "to", label: "Created to", type: "date" },
      { name: "clientId", label: "Client", type: "string", helperText: "Filter to tenders linked to a client" }
    ],
    columns: [
      { key: "status", label: "Status" },
      { key: "count", label: "Count", align: "right", format: "number" },
      { key: "estimatedValue", label: "Estimated value", align: "right", format: "currency" }
    ],
    chart: { type: "bar", xKey: "status", yKey: "count", title: "Tenders by status" },
    async run(prisma, params) {
      const createdAt = dateRangeFilter(params.from, params.to);
      const where: Prisma.TenderWhereInput = {};
      if (createdAt) where.createdAt = createdAt;
      if (params.clientId) {
        where.tenderClients = { some: { clientId: params.clientId } };
      }
      const tenders = await prisma.tender.findMany({
        where,
        select: { status: true, estimatedValue: true }
      });
      const buckets = new Map<string, { count: number; value: number }>();
      for (const t of tenders) {
        const key = t.status ?? "UNKNOWN";
        const bucket = buckets.get(key) ?? { count: 0, value: 0 };
        bucket.count += 1;
        bucket.value += decimalToNumber(t.estimatedValue);
        buckets.set(key, bucket);
      }
      const rows = [...TENDER_STATUS_ORDER, ...[...buckets.keys()].filter((k) => !TENDER_STATUS_ORDER.includes(k as (typeof TENDER_STATUS_ORDER)[number]))]
        .filter((status) => buckets.has(status))
        .map((status) => {
          const bucket = buckets.get(status)!;
          return {
            status,
            count: bucket.count,
            estimatedValue: bucket.value
          };
        });
      const totals = rows.reduce(
        (acc, row) => {
          acc.count += Number(row.count);
          acc.estimatedValue += Number(row.estimatedValue);
          return acc;
        },
        { count: 0, estimatedValue: 0 }
      );
      return { rows, totals };
    }
  },
  {
    key: "tender-win-rate",
    title: "Tender win rate by estimator",
    description:
      "Submitted / awarded / lost tenders per estimator, with rolling win rate. Window is measured against tender submission date.",
    parameters: [
      { name: "from", label: "Submitted from", type: "date" },
      { name: "to", label: "Submitted to", type: "date" }
    ],
    columns: [
      { key: "estimator", label: "Estimator" },
      { key: "submitted", label: "Submitted", align: "right", format: "number" },
      { key: "awarded", label: "Awarded", align: "right", format: "number" },
      { key: "lost", label: "Lost", align: "right", format: "number" },
      { key: "winRatePct", label: "Win rate", align: "right", format: "percent" }
    ],
    chart: { type: "bar", xKey: "estimator", yKey: "winRatePct", title: "Win rate (%) by estimator", unit: "%" },
    async run(prisma, params) {
      const submittedAt = dateRangeFilter(params.from, params.to);
      const where: Prisma.TenderWhereInput = {
        status: { in: ["SUBMITTED", "AWARDED", "LOST", "CONTRACT_ISSUED"] }
      };
      if (submittedAt) where.submittedAt = submittedAt;
      const tenders = await prisma.tender.findMany({
        where,
        select: {
          status: true,
          estimator: { select: { firstName: true, lastName: true, email: true } },
          assignedEstimator: { select: { firstName: true, lastName: true, email: true } }
        }
      });
      const buckets = new Map<string, { submitted: number; awarded: number; lost: number }>();
      for (const t of tenders) {
        const estimator = t.assignedEstimator ?? t.estimator;
        const name = formatEstimatorName(estimator);
        const bucket = buckets.get(name) ?? { submitted: 0, awarded: 0, lost: 0 };
        bucket.submitted += 1;
        if (t.status === "AWARDED" || t.status === "CONTRACT_ISSUED") bucket.awarded += 1;
        if (t.status === "LOST") bucket.lost += 1;
        buckets.set(name, bucket);
      }
      const rows = [...buckets.entries()]
        .map(([estimator, bucket]) => {
          const resolved = bucket.awarded + bucket.lost;
          const winRatePct = resolved === 0 ? 0 : Math.round((bucket.awarded / resolved) * 1000) / 10;
          return {
            estimator,
            submitted: bucket.submitted,
            awarded: bucket.awarded,
            lost: bucket.lost,
            winRatePct
          };
        })
        .sort((a, b) => Number(b.submitted) - Number(a.submitted));
      const totals = rows.reduce(
        (acc, row) => {
          acc.submitted += Number(row.submitted);
          acc.awarded += Number(row.awarded);
          acc.lost += Number(row.lost);
          return acc;
        },
        { submitted: 0, awarded: 0, lost: 0 }
      );
      return { rows, totals };
    }
  },
  {
    key: "job-status-summary",
    title: "Job status summary",
    description:
      "Live jobs grouped by status with count. Filter by creation window and (optionally) client.",
    parameters: [
      { name: "from", label: "Created from", type: "date" },
      { name: "to", label: "Created to", type: "date" },
      { name: "clientId", label: "Client", type: "string" }
    ],
    columns: [
      { key: "status", label: "Status" },
      { key: "count", label: "Count", align: "right", format: "number" }
    ],
    chart: { type: "bar", xKey: "status", yKey: "count", title: "Jobs by status" },
    async run(prisma, params) {
      const createdAt = dateRangeFilter(params.from, params.to);
      const where: Prisma.JobWhereInput = {};
      if (createdAt) where.createdAt = createdAt;
      if (params.clientId) where.clientId = params.clientId;
      const grouped = await prisma.job.groupBy({
        by: ["status"],
        where,
        _count: { _all: true }
      });
      const rows = [...JOB_STATUS_ORDER, ...grouped.map((g) => g.status).filter((s) => !JOB_STATUS_ORDER.includes(s as (typeof JOB_STATUS_ORDER)[number]))]
        .filter((status) => grouped.some((g) => g.status === status))
        .map((status) => {
          const match = grouped.find((g) => g.status === status);
          return { status, count: match?._count._all ?? 0 };
        });
      const totals = { count: rows.reduce((sum, row) => sum + Number(row.count), 0) };
      return { rows, totals };
    }
  },
  {
    key: "worker-competency-expiry",
    title: "Worker competency expiry",
    description:
      "Worker competencies expiring within the selected window (defaults to next 90 days). Proxy for WHS ticket / licence expiry until the full compliance-alert surface ships.",
    parameters: [
      { name: "from", label: "Expiring from", type: "date", helperText: "Defaults to today" },
      { name: "to", label: "Expiring to", type: "date", helperText: "Defaults to +90 days" }
    ],
    columns: [
      { key: "worker", label: "Worker" },
      { key: "competency", label: "Competency" },
      { key: "expiresAt", label: "Expires", format: "date" },
      { key: "daysToExpiry", label: "Days", align: "right", format: "number" }
    ],
    chart: undefined,
    async run(prisma, params) {
      const defaultFrom = new Date();
      defaultFrom.setUTCHours(0, 0, 0, 0);
      const defaultTo = new Date(defaultFrom);
      defaultTo.setUTCDate(defaultTo.getUTCDate() + 90);
      defaultTo.setUTCHours(23, 59, 59, 999);
      const gte = parseFromDate(params.from) ?? defaultFrom;
      const lte = parseToDate(params.to) ?? defaultTo;
      const records = await prisma.workerCompetency.findMany({
        where: { expiresAt: { not: null, gte, lte } },
        include: {
          worker: { select: { firstName: true, lastName: true } },
          competency: { select: { name: true } }
        },
        orderBy: { expiresAt: "asc" },
        take: 500
      });
      const now = Date.now();
      const rows = records.map((r) => {
        const expiresAt = r.expiresAt ? r.expiresAt.toISOString() : null;
        const daysToExpiry =
          r.expiresAt !== null
            ? Math.round((r.expiresAt.getTime() - now) / (1000 * 60 * 60 * 24))
            : 0;
        const worker = [r.worker?.firstName, r.worker?.lastName].filter(Boolean).join(" ").trim() || "Unknown worker";
        return {
          worker,
          competency: r.competency?.name ?? "Unknown competency",
          expiresAt,
          daysToExpiry
        };
      });
      return { rows, totals: { count: rows.length } };
    }
  },
  {
    key: "asset-utilisation-snapshot",
    title: "Asset utilisation snapshot",
    description:
      "Current asset register grouped by status. Snapshot view — for time-series utilisation see the maintenance report.",
    parameters: [],
    columns: [
      { key: "status", label: "Status" },
      { key: "count", label: "Count", align: "right", format: "number" }
    ],
    chart: { type: "bar", xKey: "status", yKey: "count", title: "Assets by status" },
    async run(prisma) {
      const grouped = await prisma.asset.groupBy({
        by: ["status"],
        _count: { _all: true }
      });
      const rows = grouped
        .map((g) => ({ status: g.status ?? "UNKNOWN", count: g._count._all }))
        .sort((a, b) => Number(b.count) - Number(a.count));
      const totals = { count: rows.reduce((sum, row) => sum + Number(row.count), 0) };
      return { rows, totals };
    }
  }
];

function toSummary(def: ReportDefinition): ReportDefinitionSummary {
  const { run: _run, ...rest } = def;
  void _run;
  return rest;
}

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  listDefinitions(): ReportDefinitionSummary[] {
    return REPORT_DEFS.map(toSummary);
  }

  getDefinition(key: string): ReportDefinition {
    const def = REPORT_DEFS.find((r) => r.key === key);
    if (!def) throw new NotFoundException(`Unknown report: ${key}`);
    return def;
  }

  async run(key: string, params: ReportRunParams): Promise<ReportRunResponse> {
    const def = this.getDefinition(key);
    const result = await def.run(this.prisma, params);
    return {
      ...toSummary(def),
      params,
      rows: result.rows,
      totals: result.totals,
      generatedAt: new Date().toISOString()
    };
  }
}

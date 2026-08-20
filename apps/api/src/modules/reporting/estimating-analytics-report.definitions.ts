import { Prisma } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { deriveLeadTimeDays } from "../win-likelihood/win-likelihood-features.service";

// EA-1: Two new read-only report definitions for estimating analytics.
// Decision D3: turnaround = days-to-quote (submittedAt − createdAt), excludes
//              still-open tenders (DRAFT / IN_PROGRESS).
// Decision D4: qty-vs-$ throughput = count + Σ estimatedValue per estimator.
// Decision D5: if currentUser is NOT isSuperUser, self-filter to own tenders.
//
// NOTE: This file intentionally does NOT import from reporting.service to avoid
// a circular dependency (reporting.service imports this file). It uses local
// copies of the inline-able helpers and re-uses the exported types via the
// module contract below.

// ── Local-only type aliases (mirror reporting.service exports) ──────────────
// These duplicate the interface shapes from reporting.service intentionally to
// avoid the circular import. They must remain structurally compatible.

type ReportParamName = "from" | "to" | "projectId" | "clientId" | "estimatorId";

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
  estimatorId?: string;
  currentUser?: AuthenticatedUser;
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

// ── Local utilities (inlined from reporting.service to avoid circular import) ─

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

function localDateRangeFilter(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  const gte = parseFromDate(from);
  const lte = parseToDate(to);
  if (!gte && !lte) return undefined;
  const filter: Prisma.DateTimeFilter = {};
  if (gte) filter.gte = gte;
  if (lte) filter.lte = lte;
  return filter;
}

function localDecimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

// ── Domain helpers ──────────────────────────────────────────────────────────

// Statuses that indicate a tender is NO LONGER still-open (has been quoted).
const CLOSED_OR_SUBMITTED_STATUSES = [
  "SUBMITTED",
  "AWARDED",
  "CONTRACT_ISSUED",
  "LOST",
  "WITHDRAWN"
] as const;

function formatEstimatorName(
  estimator:
    | { firstName: string | null; lastName: string | null; email: string }
    | null
    | undefined
): string {
  if (!estimator) return "Unassigned";
  const name = [estimator.firstName, estimator.lastName].filter(Boolean).join(" ").trim();
  return name || estimator.email || "Unassigned";
}

// Build the self-filter clause for D5 role gating.
// Estimator self-view: restrict to tenders assigned to the current user.
// Manager / super-user / no currentUser: no restriction.
function selfFilterClause(params: ReportRunParams): { assignedEstimatorId?: string } {
  if (params.currentUser && !params.currentUser.isSuperUser) {
    return { assignedEstimatorId: params.currentUser.sub };
  }
  return {};
}

// ── Shared tender select helper ─────────────────────────────────────────────

interface EstimatingTenderRow {
  createdAt: Date;
  submittedAt: Date | null;
  estimatedValue: Prisma.Decimal | null;
  estimator: { firstName: string | null; lastName: string | null; email: string } | null;
  assignedEstimator: { firstName: string | null; lastName: string | null; email: string } | null;
}

async function loadEstimatingTenders(
  prisma: PrismaService,
  params: ReportRunParams,
  extraWhere?: Prisma.TenderWhereInput
): Promise<EstimatingTenderRow[]> {
  const submittedAt = localDateRangeFilter(params.from, params.to);
  const where: Prisma.TenderWhereInput = {
    status: { in: [...CLOSED_OR_SUBMITTED_STATUSES] },
    ...selfFilterClause(params),
    ...extraWhere
  };
  if (submittedAt) where.submittedAt = submittedAt;
  if (params.clientId) {
    where.tenderClients = { some: { clientId: params.clientId } };
  }
  if (params.estimatorId) {
    where.assignedEstimatorId = params.estimatorId;
  }
  return prisma.tender.findMany({
    where,
    select: {
      createdAt: true,
      submittedAt: true,
      estimatedValue: true,
      estimator: { select: { firstName: true, lastName: true, email: true } },
      assignedEstimator: { select: { firstName: true, lastName: true, email: true } }
    }
  });
}

// ── Definition A — estimator-turnaround ────────────────────────────────────

async function runTurnaround(prisma: PrismaService, params: ReportRunParams): Promise<ReportRunResult> {
  const tenders = await loadEstimatingTenders(prisma, params);

  const buckets = new Map<string, { days: number[] }>();
  for (const t of tenders) {
    // D3: skip tenders with no submittedAt (null = still-open or never submitted).
    if (!t.submittedAt) continue;

    const leadDays = deriveLeadTimeDays({ submittedAt: t.submittedAt, createdAt: t.createdAt });
    if (leadDays === null) continue;

    const estimator = t.assignedEstimator ?? t.estimator;
    const name = formatEstimatorName(estimator);
    const bucket = buckets.get(name) ?? { days: [] };
    bucket.days.push(leadDays);
    buckets.set(name, bucket);
  }

  const rows = [...buckets.entries()]
    .map(([estimator, bucket]) => {
      const count = bucket.days.length;
      const avgDaysToQuote =
        count === 0 ? 0 : Math.round(bucket.days.reduce((s, d) => s + d, 0) / count);

      // Median: sort and pick middle value.
      const sorted = [...bucket.days].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const medianDaysToQuote =
        sorted.length === 0
          ? 0
          : sorted.length % 2 === 1
            ? sorted[mid]
            : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

      return { estimator, count, avgDaysToQuote, medianDaysToQuote };
    })
    .sort((a, b) => b.avgDaysToQuote - a.avgDaysToQuote);

  const totals: Record<string, number> = {
    count: rows.reduce((s, r) => s + r.count, 0)
  };

  return { rows, totals };
}

// ── Definition B — estimator-qty-vs-value ──────────────────────────────────

async function runQtyVsValue(prisma: PrismaService, params: ReportRunParams): Promise<ReportRunResult> {
  // D4: include all non-open tenders that have a non-null estimatedValue.
  const tenders = await loadEstimatingTenders(prisma, params, {
    estimatedValue: { not: null }
  });

  const buckets = new Map<string, { priced: number; sumEstimatedValue: number }>();
  for (const t of tenders) {
    const estimator = t.assignedEstimator ?? t.estimator;
    const name = formatEstimatorName(estimator);
    const bucket = buckets.get(name) ?? { priced: 0, sumEstimatedValue: 0 };
    bucket.priced += 1;
    bucket.sumEstimatedValue += localDecimalToNumber(t.estimatedValue);
    buckets.set(name, bucket);
  }

  const rows = [...buckets.entries()]
    .map(([estimator, bucket]) => ({
      estimator,
      priced: bucket.priced,
      sumEstimatedValue: bucket.sumEstimatedValue
    }))
    .sort((a, b) => b.sumEstimatedValue - a.sumEstimatedValue);

  const totals: Record<string, number> = {
    priced: rows.reduce((s, r) => s + r.priced, 0),
    sumEstimatedValue: rows.reduce((s, r) => s + r.sumEstimatedValue, 0)
  };

  return { rows, totals };
}

// ── Exported definitions array ─────────────────────────────────────────────

export const ESTIMATING_ANALYTICS_REPORT_DEFS: ReportDefinition[] = [
  {
    key: "estimator-turnaround",
    title: "Estimator turnaround (avg days-to-quote)",
    description:
      "Average and median days from tender creation to submission, per estimator. Excludes still-open tenders (DRAFT / IN_PROGRESS).",
    parameters: [
      { name: "estimatorId", label: "Estimator", type: "string" },
      { name: "clientId", label: "Client", type: "string" },
      { name: "from", label: "Submitted from", type: "date" },
      { name: "to", label: "Submitted to", type: "date" }
    ],
    columns: [
      { key: "estimator", label: "Estimator" },
      { key: "count", label: "Count", align: "right", format: "number" },
      { key: "avgDaysToQuote", label: "Avg days to quote", align: "right", format: "number" },
      { key: "medianDaysToQuote", label: "Median days to quote", align: "right", format: "number" }
    ],
    chart: {
      type: "bar",
      xKey: "estimator",
      yKey: "avgDaysToQuote",
      title: "Avg days to quote by estimator",
      unit: "days"
    },
    run: runTurnaround
  },
  {
    key: "estimator-qty-vs-value",
    title: "Estimator throughput (qty priced vs $ value)",
    description:
      "Count of tenders priced vs Σ estimatedValue, per estimator. Includes all submitted/awarded/lost tenders with a non-null estimated value.",
    parameters: [
      { name: "estimatorId", label: "Estimator", type: "string" },
      { name: "clientId", label: "Client", type: "string" },
      { name: "from", label: "Submitted from", type: "date" },
      { name: "to", label: "Submitted to", type: "date" }
    ],
    columns: [
      { key: "estimator", label: "Estimator" },
      { key: "priced", label: "Priced", align: "right", format: "number" },
      { key: "sumEstimatedValue", label: "Total estimated value", align: "right", format: "currency" }
    ],
    chart: {
      type: "bar",
      xKey: "estimator",
      yKey: "sumEstimatedValue",
      title: "Total estimated value by estimator",
      unit: "$"
    },
    run: runQtyVsValue
  }
];

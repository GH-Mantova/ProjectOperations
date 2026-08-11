import { Prisma, TenderOutcomeResult } from "@prisma/client";
import {
  dateRangeFilter,
  decimalToNumber,
  type ReportDefinition,
  type ReportRunParams,
  type ReportRunResult
} from "./reporting.service";
import type { PrismaService } from "../../prisma/prisma.service";

// WL-2 — Descriptive win/loss reports fed by the append-only TenderOutcome
// chain (WL-1a). All aggregations count only CURRENT outcomes — rows that no
// other outcome supersedes — so a correction never double-counts.

const CURRENT_OUTCOME_WHERE = { supersededBy: { is: null } } as const;

const TERMINAL_TENDER_STATUSES = ["AWARDED", "LOST", "CONTRACT_ISSUED", "WITHDRAWN"] as const;

const REASON_ORDER = [
  "PRICE_TOO_HIGH",
  "LOST_ON_RELATIONSHIP",
  "SCOPE_MISMATCH",
  "TIMING_PROGRAM_CLASH",
  "CAPACITY_CONSTRAINT",
  "CLIENT_WENT_ANOTHER_DIRECTION",
  "PROJECT_CANCELLED",
  "NO_RESPONSE_FROM_CLIENT",
  "DECLINED_TO_BID",
  "OTHER"
] as const;

interface WinLossBucket {
  won: number;
  lost: number;
  noBid: number;
}

function emptyBucket(): WinLossBucket {
  return { won: 0, lost: 0, noBid: 0 };
}

function bumpBucket(bucket: WinLossBucket, result: TenderOutcomeResult | null): void {
  if (result === "WON") bucket.won += 1;
  else if (result === "LOST") bucket.lost += 1;
  else if (result === "NO_BID") bucket.noBid += 1;
}

function winRatePct(bucket: WinLossBucket): number {
  const resolved = bucket.won + bucket.lost;
  if (resolved === 0) return 0;
  return Math.round((bucket.won / resolved) * 1000) / 10;
}

interface OutcomeRowForBuckets {
  resultType: TenderOutcomeResult | null;
  clientId: string | null;
  tenderValue: Prisma.Decimal | null;
  client: { name: string } | null;
}

async function loadCurrentOutcomesForBuckets(prisma: PrismaService, params: ReportRunParams) {
  const recordedAt = dateRangeFilter(params.from, params.to);
  const where: Prisma.TenderOutcomeWhereInput = { ...CURRENT_OUTCOME_WHERE };
  if (recordedAt) where.recordedAt = recordedAt;
  if (params.clientId) where.clientId = params.clientId;
  return prisma.tenderOutcome.findMany({
    where,
    select: {
      resultType: true,
      clientId: true,
      tenderValue: true,
      client: { select: { name: true } }
    }
  }) as Promise<OutcomeRowForBuckets[]>;
}

const VALUE_BANDS: Array<{ key: string; label: string; test: (v: number) => boolean }> = [
  { key: "lt50k", label: "<$50k", test: (v) => v < 50_000 },
  { key: "50k-250k", label: "$50k-$250k", test: (v) => v >= 50_000 && v < 250_000 },
  { key: "250k-1m", label: "$250k-$1M", test: (v) => v >= 250_000 && v < 1_000_000 },
  { key: "gt1m", label: ">$1M", test: (v) => v >= 1_000_000 }
];

function bandFor(value: Prisma.Decimal | null): string {
  if (value === null || value === undefined) return "Unknown";
  const n = decimalToNumber(value);
  const band = VALUE_BANDS.find((b) => b.test(n));
  return band ? band.label : "Unknown";
}

const BAND_ORDER = [...VALUE_BANDS.map((b) => b.label), "Unknown"];

const winLossColumns = [
  { key: "won", label: "Won", align: "right" as const, format: "number" as const },
  { key: "lost", label: "Lost", align: "right" as const, format: "number" as const },
  { key: "noBid", label: "No bid", align: "right" as const, format: "number" as const },
  { key: "winRatePct", label: "Win rate", align: "right" as const, format: "percent" as const }
];

function totalsFor(rows: Array<Record<string, string | number | null>>): Record<string, string | number> {
  const totals = { won: 0, lost: 0, noBid: 0 };
  for (const r of rows) {
    totals.won += Number(r.won ?? 0);
    totals.lost += Number(r.lost ?? 0);
    totals.noBid += Number(r.noBid ?? 0);
  }
  return {
    ...totals,
    winRatePct: winRatePct(totals)
  };
}

async function runByClient(prisma: PrismaService, params: ReportRunParams): Promise<ReportRunResult> {
  const outcomes = await loadCurrentOutcomesForBuckets(prisma, params);
  const buckets = new Map<string, WinLossBucket>();
  for (const o of outcomes) {
    const label = o.client?.name?.trim() || (o.clientId ? "Unknown client" : "Unknown client");
    const bucket = buckets.get(label) ?? emptyBucket();
    bumpBucket(bucket, o.resultType);
    buckets.set(label, bucket);
  }
  const rows = [...buckets.entries()]
    .map(([client, b]) => ({
      client,
      won: b.won,
      lost: b.lost,
      noBid: b.noBid,
      winRatePct: winRatePct(b)
    }))
    .sort((a, b) => b.won + b.lost + b.noBid - (a.won + a.lost + a.noBid));
  return { rows, totals: totalsFor(rows) };
}

async function runByValueBand(prisma: PrismaService, params: ReportRunParams): Promise<ReportRunResult> {
  const outcomes = await loadCurrentOutcomesForBuckets(prisma, params);
  const buckets = new Map<string, WinLossBucket>();
  for (const o of outcomes) {
    const label = bandFor(o.tenderValue);
    const bucket = buckets.get(label) ?? emptyBucket();
    bumpBucket(bucket, o.resultType);
    buckets.set(label, bucket);
  }
  const rows = BAND_ORDER.filter((band) => buckets.has(band)).map((band) => {
    const b = buckets.get(band)!;
    return {
      valueBand: band,
      won: b.won,
      lost: b.lost,
      noBid: b.noBid,
      winRatePct: winRatePct(b)
    };
  });
  return { rows, totals: totalsFor(rows) };
}

async function runByReason(prisma: PrismaService, params: ReportRunParams): Promise<ReportRunResult> {
  const recordedAt = dateRangeFilter(params.from, params.to);
  const where: Prisma.TenderOutcomeWhereInput = {
    ...CURRENT_OUTCOME_WHERE,
    resultType: { in: ["LOST", "NO_BID"] }
  };
  if (recordedAt) where.recordedAt = recordedAt;
  if (params.clientId) where.clientId = params.clientId;
  const grouped = await prisma.tenderOutcome.groupBy({
    by: ["reason"],
    where,
    _count: { _all: true }
  });
  const counts = new Map<string, number>();
  for (const g of grouped) {
    const key = g.reason ?? "OTHER";
    counts.set(key, (counts.get(key) ?? 0) + g._count._all);
  }
  const rows = [
    ...REASON_ORDER,
    ...[...counts.keys()].filter((k) => !REASON_ORDER.includes(k as (typeof REASON_ORDER)[number]))
  ]
    .filter((reason) => counts.has(reason))
    .map((reason) => ({ reason, count: counts.get(reason)! }))
    .sort((a, b) => Number(b.count) - Number(a.count));
  const totals = { count: rows.reduce((sum, row) => sum + Number(row.count), 0) };
  return { rows, totals };
}

function monthKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function runOverTime(prisma: PrismaService, params: ReportRunParams): Promise<ReportRunResult> {
  const recordedAt = dateRangeFilter(params.from, params.to);
  const where: Prisma.TenderOutcomeWhereInput = { ...CURRENT_OUTCOME_WHERE };
  if (recordedAt) where.recordedAt = recordedAt;
  if (params.clientId) where.clientId = params.clientId;
  const outcomes = await prisma.tenderOutcome.findMany({
    where,
    select: { resultType: true, recordedAt: true }
  });
  const buckets = new Map<string, WinLossBucket>();
  for (const o of outcomes) {
    const key = monthKey(o.recordedAt);
    const bucket = buckets.get(key) ?? emptyBucket();
    bumpBucket(bucket, o.resultType);
    buckets.set(key, bucket);
  }
  const rows = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, b]) => ({
      month,
      won: b.won,
      lost: b.lost,
      noBid: b.noBid,
      winRatePct: winRatePct(b)
    }));
  return { rows, totals: totalsFor(rows) };
}

async function runOutcomeCoverage(
  prisma: PrismaService,
  params: ReportRunParams
): Promise<ReportRunResult> {
  const updatedAt = dateRangeFilter(params.from, params.to);
  const closedWhere: Prisma.TenderWhereInput = {
    status: { in: [...TERMINAL_TENDER_STATUSES] }
  };
  if (updatedAt) closedWhere.updatedAt = updatedAt;
  if (params.clientId) {
    closedWhere.tenderClients = { some: { clientId: params.clientId } };
  }
  const closedTenders = await prisma.tender.findMany({
    where: closedWhere,
    select: {
      id: true,
      updatedAt: true,
      outcomes: {
        where: CURRENT_OUTCOME_WHERE,
        select: { id: true },
        take: 1
      }
    }
  });
  const buckets = new Map<string, { closed: number; withOutcome: number }>();
  for (const t of closedTenders) {
    const key = monthKey(t.updatedAt);
    const bucket = buckets.get(key) ?? { closed: 0, withOutcome: 0 };
    bucket.closed += 1;
    if (t.outcomes.length > 0) bucket.withOutcome += 1;
    buckets.set(key, bucket);
  }
  const rows = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, b]) => ({
      period,
      closedTenders: b.closed,
      withOutcome: b.withOutcome,
      coveragePct: b.closed === 0 ? 0 : Math.round((b.withOutcome / b.closed) * 1000) / 10
    }));
  const totalClosed = rows.reduce((sum, r) => sum + Number(r.closedTenders), 0);
  const totalWith = rows.reduce((sum, r) => sum + Number(r.withOutcome), 0);
  return {
    rows,
    totals: {
      closedTenders: totalClosed,
      withOutcome: totalWith,
      coveragePct: totalClosed === 0 ? 0 : Math.round((totalWith / totalClosed) * 1000) / 10
    }
  };
}

export const TENDER_WINLOSS_REPORT_DEFS: ReportDefinition[] = [
  {
    key: "tender-winloss-by-client",
    title: "Tender win rate by client",
    description:
      "Won / lost / no-bid counts per client with rolling win rate, from the append-only outcome capture. Filter by outcome-recorded window and (optionally) client.",
    parameters: [
      { name: "from", label: "Recorded from", type: "date" },
      { name: "to", label: "Recorded to", type: "date" },
      { name: "clientId", label: "Client", type: "string" }
    ],
    columns: [{ key: "client", label: "Client" }, ...winLossColumns],
    chart: { type: "bar", xKey: "client", yKey: "winRatePct", title: "Win rate (%) by client", unit: "%" },
    run: runByClient
  },
  {
    key: "tender-winloss-by-value-band",
    title: "Tender win rate by value band",
    description:
      "Won / lost / no-bid counts per tender-value band, from the append-only outcome capture. Bands: <$50k, $50k-$250k, $250k-$1M, >$1M.",
    parameters: [
      { name: "from", label: "Recorded from", type: "date" },
      { name: "to", label: "Recorded to", type: "date" },
      { name: "clientId", label: "Client", type: "string" }
    ],
    columns: [{ key: "valueBand", label: "Value band" }, ...winLossColumns],
    chart: { type: "bar", xKey: "valueBand", yKey: "winRatePct", title: "Win rate (%) by value band", unit: "%" },
    run: runByValueBand
  },
  {
    key: "tender-winloss-by-reason",
    title: "Loss / no-bid reasons",
    description:
      "Count of lost and no-bid outcomes grouped by structured reason. Highlights the top drivers of tenders not won.",
    parameters: [
      { name: "from", label: "Recorded from", type: "date" },
      { name: "to", label: "Recorded to", type: "date" },
      { name: "clientId", label: "Client", type: "string" }
    ],
    columns: [
      { key: "reason", label: "Reason" },
      { key: "count", label: "Count", align: "right", format: "number" }
    ],
    chart: { type: "bar", xKey: "reason", yKey: "count", title: "Loss / no-bid reasons" },
    run: runByReason
  },
  {
    key: "tender-winloss-over-time",
    title: "Tender win rate over time",
    description:
      "Monthly won / lost / no-bid counts with rolling win rate, bucketed by outcome recorded month.",
    parameters: [
      { name: "from", label: "Recorded from", type: "date" },
      { name: "to", label: "Recorded to", type: "date" },
      { name: "clientId", label: "Client", type: "string" }
    ],
    columns: [{ key: "month", label: "Month" }, ...winLossColumns],
    chart: { type: "bar", xKey: "month", yKey: "winRatePct", title: "Win rate (%) by month", unit: "%" },
    run: runOverTime
  },
  {
    key: "tender-outcome-coverage",
    title: "Tender outcome capture coverage",
    description:
      "For tenders in a terminal status (AWARDED, LOST, CONTRACT_ISSUED, WITHDRAWN), the share that have a current recorded outcome. Honesty check on the win-rate reports — a thin sample is not gospel.",
    parameters: [
      { name: "from", label: "Closed from", type: "date", helperText: "Filters on tender updatedAt" },
      { name: "to", label: "Closed to", type: "date" },
      { name: "clientId", label: "Client", type: "string" }
    ],
    columns: [
      { key: "period", label: "Month" },
      { key: "closedTenders", label: "Closed tenders", align: "right", format: "number" },
      { key: "withOutcome", label: "With outcome", align: "right", format: "number" },
      { key: "coveragePct", label: "Coverage", align: "right", format: "percent" }
    ],
    chart: { type: "bar", xKey: "period", yKey: "coveragePct", title: "Outcome coverage (%) by month", unit: "%" },
    run: runOutcomeCoverage
  }
];

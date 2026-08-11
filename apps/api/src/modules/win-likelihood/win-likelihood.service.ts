import { Injectable } from "@nestjs/common";
import { TenderOutcomeResult } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  TenderFeatures,
  VALUE_BAND_EDGES,
  ValueBand,
  WinLikelihoodFeaturesService
} from "./win-likelihood-features.service";

// ─── Confidence thresholds ────────────────────────────────────────────────────
// Exported so tests and future callers can reference canonical thresholds.
export const CONFIDENCE_THRESHOLDS = {
  /** Minimum cohort size for at least MEDIUM confidence. */
  MEDIUM_MIN_COHORT: 5,
  /** Minimum cohort size for HIGH confidence. */
  HIGH_MIN_COHORT: 15,
  /** Maximum Wilson-interval width to reach HIGH confidence. */
  HIGH_MAX_INTERVAL_WIDTH: 0.25,
  /** Maximum Wilson-interval width to reach MEDIUM confidence. */
  MEDIUM_MAX_INTERVAL_WIDTH: 0.45
} as const;

export type ConfidenceLabel = "LOW" | "MEDIUM" | "HIGH";

export interface WilsonInterval {
  low: number;
  high: number;
}

/** A single "why" factor explaining what drove the estimate. */
export interface WhyFactor {
  factor: string;
  direction: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  detail: string;
}

export interface WinLikelihoodResult {
  /** Fraction in [0,1], or null if no closed tenders in the cohort. */
  pointEstimate: number | null;
  /** 95% Wilson score interval, or null when pointEstimate is null. */
  interval: WilsonInterval | null;
  /** LOW / MEDIUM / HIGH derived from cohort size and interval width. */
  confidence: ConfidenceLabel;
  /** Number of closed tenders (WON or LOST) in the matching cohort. */
  cohortSize: number;
  /** Ordered factors that most influenced the estimate vs overall base rate. */
  whyFactors: WhyFactor[];
  /** Features absent/unreliable for this tender (from feature extraction). */
  captureGaps: string[];
}

export interface CaptureGapEntry {
  /** The feature / column name that is missing or unreliable. */
  feature: string;
  /** Fraction of recent tenders where this feature IS present (0-1). */
  coverageFraction: number;
  /** Human-readable explanation of why the feature matters. */
  whyItMatters: string;
}

export interface CaptureGapReport {
  /** Number of tenders scanned. */
  tendersScanned: number;
  gaps: CaptureGapEntry[];
}

// ─── Wilson score confidence interval ────────────────────────────────────────
// Classic closed-form implementation. z=1.96 for 95% CI.
// Formula: (p_hat + z^2/(2n) ± z*sqrt(p_hat*(1-p_hat)/n + z^2/(4n^2))) /
//           (1 + z^2/n)
// Reference: Wilson (1927); see e.g. https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval
const Z_95 = 1.96;

/**
 * Compute a 95% Wilson score confidence interval for a proportion.
 * Returns [0,1] clamped bounds.
 *
 * @param wins   Number of successes
 * @param total  Total trials (wins + losses)
 */
export function wilsonInterval(wins: number, total: number): WilsonInterval {
  if (total === 0) return { low: 0, high: 1 };
  const pHat = wins / total;
  const z2 = Z_95 * Z_95;
  const n = total;
  const centre = pHat + z2 / (2 * n);
  const margin =
    Z_95 * Math.sqrt((pHat * (1 - pHat)) / n + z2 / (4 * n * n));
  const denom = 1 + z2 / n;
  const low = Math.max(0, (centre - margin) / denom);
  const high = Math.min(1, (centre + margin) / denom);
  return { low, high };
}

function deriveConfidence(cohortSize: number, interval: WilsonInterval | null): ConfidenceLabel {
  if (cohortSize < CONFIDENCE_THRESHOLDS.MEDIUM_MIN_COHORT) return "LOW";
  const width = interval ? interval.high - interval.low : 1;
  if (
    cohortSize >= CONFIDENCE_THRESHOLDS.HIGH_MIN_COHORT &&
    width <= CONFIDENCE_THRESHOLDS.HIGH_MAX_INTERVAL_WIDTH
  ) {
    return "HIGH";
  }
  if (width <= CONFIDENCE_THRESHOLDS.MEDIUM_MAX_INTERVAL_WIDTH) return "MEDIUM";
  return "LOW";
}

// ─── Cohort row shape returned from Prisma ───────────────────────────────────
interface CohortTenderRow {
  id: string;
  estimatedValue: { toNumber(): number } | null;
  tenderClients: Array<{
    clientId: string;
    relationshipType: string | null;
  }>;
  outcomes: Array<{
    id: string;
    resultType: TenderOutcomeResult | null;
    supersededBy: { id: string } | null;
  }>;
}

@Injectable()
export class WinLikelihoodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly features: WinLikelihoodFeaturesService
  ) {}

  /**
   * Compute the baseline win-likelihood for a single tender.
   *
   * Algorithm:
   * 1. Extract bid-time features for the tender.
   * 2. Build a cohort of similar CLOSED tenders (match on client + value-band;
   *    degrade gracefully if those dimensions are missing/UNKNOWN).
   * 3. Compute wins/(wins+losses) point estimate + Wilson CI.
   * 4. Derive confidence label + why-factors.
   * 5. Merge per-tender capture gaps from feature extraction.
   */
  async computeForTender(tenderId: string): Promise<WinLikelihoodResult> {
    const tenderFeatures = await this.features.extractFeatures(tenderId);
    return this.computeFromFeatures(tenderFeatures, tenderId);
  }

  async computeFromFeatures(
    tenderFeatures: TenderFeatures,
    excludeTenderId: string
  ): Promise<WinLikelihoodResult> {
    // Step 1: fetch all CLOSED tenders for cohort building, excluding this one.
    const allClosed = (await this.fetchClosedTenders(excludeTenderId)) as CohortTenderRow[];

    // Step 2: overall base rate (all closed tenders).
    const { wins: overallWins, losses: overallLosses } =
      countWinsLosses(allClosed, this.features.resolveCurrentOutcome);
    const overallTotal = overallWins + overallLosses;
    const overallRate = overallTotal > 0 ? overallWins / overallTotal : null;

    // Step 3: matched cohort — client + value-band (degrade if missing).
    const cohortTenders = matchCohort(allClosed, tenderFeatures, this.features.resolveCurrentOutcome);
    const { wins: cohortWins, losses: cohortLosses } =
      countWinsLosses(cohortTenders, this.features.resolveCurrentOutcome);
    const cohortSize = cohortWins + cohortLosses;

    let pointEstimate: number | null = null;
    let interval: WilsonInterval | null = null;

    if (cohortSize > 0) {
      pointEstimate = cohortWins / cohortSize;
      interval = wilsonInterval(cohortWins, cohortSize);
    }

    const confidence = deriveConfidence(cohortSize, interval);

    // Step 4: why-factors.
    const whyFactors = buildWhyFactors(
      tenderFeatures,
      overallRate,
      cohortWins,
      cohortLosses,
      cohortSize
    );

    return {
      pointEstimate,
      interval,
      confidence,
      cohortSize,
      whyFactors,
      captureGaps: tenderFeatures.captureGaps
    };
  }

  /**
   * Aggregate capture-gap audit: scan the N most recent tenders and report
   * coverage % for each desired bid-time feature.
   *
   * @param limit How many recent tenders to scan (default 200).
   */
  async aggregateCaptureGaps(limit = 200): Promise<CaptureGapReport> {
    const recentTenders = await this.prisma.tender.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        estimatedValue: true,
        dueDate: true,
        tenderClients: { select: { clientId: true } }
      }
    });

    const total = recentTenders.length;
    if (total === 0) {
      return {
        tendersScanned: 0,
        gaps: []
      };
    }

    let hasEstimatedValue = 0;
    let hasDueDate = 0;
    let hasClient = 0;
    const hasDisipline = 0; // structural gap: column doesn't exist

    for (const t of recentTenders) {
      if (t.estimatedValue !== null) hasEstimatedValue++;
      if (t.dueDate !== null) hasDueDate++;
      if (t.tenderClients.length > 0) hasClient++;
    }

    const gaps: CaptureGapEntry[] = [
      {
        feature: "discipline",
        coverageFraction: hasDisipline / total,
        whyItMatters:
          "Work-type / discipline is the strongest expected predictor of win-likelihood. " +
          "No column exists on Tender yet — without it the cohort cannot segment by trade, " +
          "leading to mixed-discipline cohorts that dilute the signal. Add it in WL3-S1b."
      },
      {
        feature: "estimatedValue",
        coverageFraction: hasEstimatedValue / total,
        whyItMatters:
          "Value-band (e.g. <50k vs >1M) strongly influences competitive dynamics. " +
          "Tenders without estimatedValue are placed in the UNKNOWN band, widening the cohort."
      },
      {
        feature: "dueDate",
        coverageFraction: hasDueDate / total,
        whyItMatters:
          "Lead-time (days to due-date) reflects how competitive the invitation was. " +
          "Without dueDate the lead-time feature is null and seasonality falls back to createdAt."
      },
      {
        feature: "client",
        coverageFraction: hasClient / total,
        whyItMatters:
          "Client identity is used to look up historical win-rate with that client. " +
          "Tenders with no TenderClient row cannot use client-history signals."
      }
    ];

    return {
      tendersScanned: total,
      gaps
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async fetchClosedTenders(excludeTenderId: string) {
    return this.prisma.tender.findMany({
      where: {
        id: { not: excludeTenderId },
        status: { in: ["WON", "LOST", "CLOSED", "NO_BID"] }
      },
      select: {
        id: true,
        estimatedValue: true,
        tenderClients: {
          select: {
            clientId: true,
            relationshipType: true
          }
        },
        outcomes: {
          select: {
            id: true,
            resultType: true,
            supersededBy: { select: { id: true } }
          }
        }
      }
    });
  }
}

// ─── Pure functions (easier to unit-test) ────────────────────────────────────

type OutcomeRow = {
  id: string;
  resultType: TenderOutcomeResult | null;
  supersededBy: { id: string } | null;
};

type ResolveCurrentOutcomeFn = (
  outcomes: OutcomeRow[]
) => { id: string; resultType: TenderOutcomeResult | null } | null;

function countWinsLosses(
  tenders: CohortTenderRow[],
  resolveFn: ResolveCurrentOutcomeFn
): { wins: number; losses: number } {
  let wins = 0;
  let losses = 0;
  for (const t of tenders) {
    const current = resolveFn(t.outcomes);
    if (!current) continue;
    if (current.resultType === TenderOutcomeResult.WON) wins++;
    else if (current.resultType === TenderOutcomeResult.LOST) losses++;
  }
  return { wins, losses };
}

/**
 * Resolve the primary client for a cohort tender row using the same rule as
 * tendering.service.ts: first entry with "primary" in relationshipType, else
 * the first entry.
 */
function resolvePrimaryClientId(
  clients: Array<{ clientId: string; relationshipType: string | null }>
): string | null {
  if (!clients.length) return null;
  const primary =
    clients.find((c) => /primary/i.test(c.relationshipType ?? "")) ??
    clients[0];
  return primary.clientId;
}

function tenderValueBand(row: CohortTenderRow): ValueBand {
  if (row.estimatedValue === null) return "UNKNOWN";
  const n = row.estimatedValue.toNumber();
  for (const edge of VALUE_BAND_EDGES) {
    if (n < edge.maxExclusive) return edge.label;
  }
  return ">1M";
}

/**
 * Match a cohort of tenders similar to the target features.
 *
 * Matching order (most specific to least):
 * 1. Same client + same value band — if ≥ 1 result, use this.
 * 2. Same client only — if ≥ 1 result, use this.
 * 3. Same value band only — if ≥ 1 result, use this.
 * 4. All closed tenders (widest cohort, captures general base rate).
 */
function matchCohort(
  allClosed: CohortTenderRow[],
  target: TenderFeatures,
  resolveFn: ResolveCurrentOutcomeFn
): CohortTenderRow[] {
  const hasClient = !!target.primaryClientId;
  const hasValueBand = target.valueBand !== "UNKNOWN";

  if (hasClient && hasValueBand) {
    const tier1 = allClosed.filter((t) => {
      return (
        resolvePrimaryClientId(t.tenderClients) === target.primaryClientId &&
        tenderValueBand(t) === target.valueBand
      );
    });
    const { wins: w1, losses: l1 } = countWinsLosses(tier1, resolveFn);
    if (w1 + l1 >= 1) return tier1;
  }

  if (hasClient) {
    const tier2 = allClosed.filter(
      (t) =>
        resolvePrimaryClientId(t.tenderClients) === target.primaryClientId
    );
    const { wins: w2, losses: l2 } = countWinsLosses(tier2, resolveFn);
    if (w2 + l2 >= 1) return tier2;
  }

  if (hasValueBand) {
    const tier3 = allClosed.filter(
      (t) => tenderValueBand(t) === target.valueBand
    );
    const { wins: w3, losses: l3 } = countWinsLosses(tier3, resolveFn);
    if (w3 + l3 >= 1) return tier3;
  }

  return allClosed;
}

/**
 * Build an ordered list of "why" factors — what drove the estimate away from
 * the overall base rate.
 */
function buildWhyFactors(
  features: TenderFeatures,
  overallRate: number | null,
  cohortWins: number,
  cohortLosses: number,
  cohortSize: number
): WhyFactor[] {
  const factors: WhyFactor[] = [];

  if (cohortSize === 0 || overallRate === null) {
    factors.push({
      factor: "insufficient_data",
      direction: "NEUTRAL",
      detail: "No closed tenders found in the cohort — estimate is not available."
    });
    return factors;
  }

  const estimate = cohortWins / cohortSize;

  // Client history signal.
  if (features.clientHistory && features.clientHistory.winRate !== null) {
    const clientRate = features.clientHistory.winRate;
    const diff = clientRate - overallRate;
    const direction: WhyFactor["direction"] =
      diff > 0.05 ? "POSITIVE" : diff < -0.05 ? "NEGATIVE" : "NEUTRAL";
    factors.push({
      factor: "client_history",
      direction,
      detail: `This client: ${features.clientHistory.wins}/${
        features.clientHistory.wins + features.clientHistory.losses
      } won (${Math.round(clientRate * 100)}% vs overall ${Math.round(
        overallRate * 100
      )}%)`
    });
  } else if (!features.primaryClientId) {
    factors.push({
      factor: "client_unknown",
      direction: "NEUTRAL",
      detail: "No client attached — client-history signal unavailable."
    });
  }

  // Value-band signal.
  if (features.valueBand !== "UNKNOWN") {
    const diff = estimate - overallRate;
    const direction: WhyFactor["direction"] =
      diff > 0.05 ? "POSITIVE" : diff < -0.05 ? "NEGATIVE" : "NEUTRAL";
    factors.push({
      factor: "value_band",
      direction,
      detail: `Value band ${features.valueBand}: cohort win-rate ${Math.round(
        estimate * 100
      )}% (overall ${Math.round(overallRate * 100)}%)`
    });
  }

  // Capture-gap note when discipline is missing.
  if (features.captureGaps.includes("discipline")) {
    factors.push({
      factor: "discipline_gap",
      direction: "NEUTRAL",
      detail:
        "Work-type / discipline is not captured — cohort cannot segment by trade. " +
        "Accuracy will improve once WL3-S1b adds this field."
    });
  }

  // Lead-time note.
  if (features.leadTimeDays !== null) {
    const label =
      features.leadTimeDays < 14
        ? "very short lead time (<14 days)"
        : features.leadTimeDays > 60
        ? "long lead time (>60 days)"
        : null;
    if (label) {
      factors.push({
        factor: "lead_time",
        direction: "NEUTRAL",
        detail: `${label} — ${features.leadTimeDays} days between creation and due date.`
      });
    }
  }

  return factors;
}

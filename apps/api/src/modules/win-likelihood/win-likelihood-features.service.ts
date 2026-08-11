import { Injectable, NotFoundException } from "@nestjs/common";
import { TenderOutcomeResult } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

// ─── Value-band edges ─────────────────────────────────────────────────────────
// Exported so WL3-S2/S3 can reuse the same bucketing logic without duplication.
export const VALUE_BAND_EDGES = [
  { label: "<50k",      maxExclusive: 50_000 },
  { label: "50-250k",   maxExclusive: 250_000 },
  { label: "250k-1M",   maxExclusive: 1_000_000 },
  { label: ">1M",       maxExclusive: Infinity }
] as const;

export type ValueBand = typeof VALUE_BAND_EDGES[number]["label"] | "UNKNOWN";

/** Season derived from a month (0-indexed). */
export type Season = "Q1" | "Q2" | "Q3" | "Q4";

/** Client history win-rate: raw counts plus derived ratio. */
export interface ClientHistoryWinRate {
  wins: number;
  losses: number;
  /**
   * wins / (wins + losses); null when denominator is 0 (no closed outcomes
   * for this client yet).
   */
  winRate: number | null;
}

/**
 * Bid-time feature vector derived entirely from data knowable BEFORE a tender
 * outcome is recorded. Each nullable field represents a capture gap: when null,
 * the field name will appear in the per-tender captureGaps list.
 */
export interface TenderFeatures {
  tenderId: string;
  /** Primary client id (first TenderClient with relationshipType containing
   *  "primary", or the first TenderClient if none is marked primary). */
  primaryClientId: string | null;
  /** Dollar-band bucket for estimatedValue. "UNKNOWN" when value is absent. */
  valueBand: ValueBand;
  /** Calendar days between createdAt and dueDate (null when dueDate absent). */
  leadTimeDays: number | null;
  /** Month (1-12) derived from dueDate when present, else createdAt. */
  month: number;
  /** ISO quarter (Q1-Q4) derived from the same date as month. */
  season: Season;
  /** Win-rate for this client across their OTHER closed tenders. */
  clientHistory: ClientHistoryWinRate | null;
  /**
   * Names of features that are absent / unreliable for this tender.
   * Downstream code uses this to widen cohorts and surface to users.
   */
  captureGaps: string[];
}

function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const n = (value as { toNumber(): number }).toNumber();
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toValueBand(value: number | null | undefined): ValueBand {
  if (value === null || value === undefined || !Number.isFinite(value)) return "UNKNOWN";
  for (const edge of VALUE_BAND_EDGES) {
    if (value < edge.maxExclusive) return edge.label;
  }
  return ">1M";
}

function toSeason(month: number): Season {
  if (month <= 3) return "Q1";
  if (month <= 6) return "Q2";
  if (month <= 9) return "Q3";
  return "Q4";
}

/**
 * Resolves the "current" outcome for a tender: the head of the append-only
 * supersedes chain — the row that has no supersededBy pointer (i.e. it is not
 * itself superseded).
 *
 * This mirrors the contract of tender-outcome-capture.service.ts: the most
 * recent row (by recordedAt desc) that is NOT superseded by another row.
 * Because supersedesId is @unique, there is at most one such head row.
 */
function resolveCurrentOutcome(
  outcomes: Array<{
    id: string;
    resultType: TenderOutcomeResult | null;
    supersededBy?: { id: string } | null;
  }>
): { id: string; resultType: TenderOutcomeResult | null } | null {
  // The head is the row with no supersededBy entry.
  const head = outcomes.find((o) => !o.supersededBy);
  return head ?? null;
}

@Injectable()
export class WinLikelihoodFeaturesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Extract bid-time features for the given tender.
   *
   * All data is read from existing rows — no writes, no schema change.
   * Features that cannot be derived (missing data) are captured in
   * `captureGaps` and set to null/UNKNOWN on the returned object.
   */
  async extractFeatures(tenderId: string): Promise<TenderFeatures> {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        estimatedValue: true,
        dueDate: true,
        createdAt: true,
        tenderClients: {
          select: {
            clientId: true,
            relationshipType: true
          }
        }
      }
    });

    if (!tender) {
      throw new NotFoundException(`Tender ${tenderId} not found`);
    }

    const captureGaps: string[] = [];

    // ── Primary client ────────────────────────────────────────────────────
    let primaryClientId: string | null = null;
    if (tender.tenderClients.length > 0) {
      const primaryEntry =
        tender.tenderClients.find((tc) =>
          /primary/i.test(tc.relationshipType ?? "")
        ) ?? tender.tenderClients[0];
      primaryClientId = primaryEntry.clientId;
    }
    // No gap recorded for missing client — a tender with zero clients is valid.

    // ── Value band ────────────────────────────────────────────────────────
    const rawValue = decimalToNumber(tender.estimatedValue);
    const valueBand = toValueBand(rawValue);
    if (valueBand === "UNKNOWN") {
      captureGaps.push("estimatedValue");
    }

    // ── Temporal features ─────────────────────────────────────────────────
    const dateForSeason = tender.dueDate ?? tender.createdAt;
    const month = dateForSeason.getMonth() + 1; // 1-12
    const season = toSeason(month);

    let leadTimeDays: number | null = null;
    if (tender.dueDate) {
      const msPerDay = 86_400_000;
      leadTimeDays = Math.round(
        (tender.dueDate.getTime() - tender.createdAt.getTime()) / msPerDay
      );
    } else {
      captureGaps.push("dueDate");
    }

    // ── Client history win-rate ───────────────────────────────────────────
    let clientHistory: ClientHistoryWinRate | null = null;
    if (primaryClientId) {
      clientHistory = await this.computeClientHistory(primaryClientId, tenderId);
    }

    // ── Structural gap: discipline/work-type ──────────────────────────────
    // No column exists on Tender for discipline/work-type yet (WL3-S1b will
    // add it). Always flag as a structural gap so the audit report surfaces it.
    captureGaps.push("discipline");

    return {
      tenderId: tender.id,
      primaryClientId,
      valueBand,
      leadTimeDays,
      month,
      season,
      clientHistory,
      captureGaps
    };
  }

  /**
   * Compute win-rate for a client from their closed tenders EXCLUDING the
   * given tender (so we don't include the tender being assessed in its own
   * cohort history).
   *
   * Only considers the CURRENT outcome row for each tender (head of the
   * supersedes chain). NO_BID outcomes are excluded from the denominator —
   * only WON and LOST count.
   */
  async computeClientHistory(
    clientId: string,
    excludeTenderId: string
  ): Promise<ClientHistoryWinRate> {
    // Fetch all tenders for this client, plus their outcomes (including the
    // supersededBy relation to resolve the current head).
    const tenderClients = await this.prisma.tenderClient.findMany({
      where: { clientId, tenderId: { not: excludeTenderId } },
      select: {
        tender: {
          select: {
            id: true,
            outcomes: {
              select: {
                id: true,
                resultType: true,
                supersededBy: { select: { id: true } }
              }
            }
          }
        }
      }
    });

    let wins = 0;
    let losses = 0;

    for (const tc of tenderClients) {
      const currentOutcome = resolveCurrentOutcome(tc.tender.outcomes);
      if (!currentOutcome) continue;
      if (currentOutcome.resultType === TenderOutcomeResult.WON) wins++;
      else if (currentOutcome.resultType === TenderOutcomeResult.LOST) losses++;
      // NO_BID excluded from denominator per spec.
    }

    const denom = wins + losses;
    return {
      wins,
      losses,
      winRate: denom > 0 ? wins / denom : null
    };
  }

  /**
   * Exported so the baseline service can access the current-outcome resolver
   * without re-deriving it.
   */
  resolveCurrentOutcome = resolveCurrentOutcome;
}

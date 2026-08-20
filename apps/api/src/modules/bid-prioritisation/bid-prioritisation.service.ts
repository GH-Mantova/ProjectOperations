import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  ConfidenceLabel,
  WhyFactor,
  WinLikelihoodService
} from "../win-likelihood/win-likelihood.service";

// ─── Configuration constant ───────────────────────────────────────────────────
// TODO: replace with admin-configurable config row (AppConfig key: bid_priority_weight)
// when the config infrastructure is wired. For BP-1 the weight is hardcoded to 1.0.
export const BID_PRIORITY_WEIGHT = 1.0;

// ─── Public types ─────────────────────────────────────────────────────────────

export interface BidPriorityItem {
  tenderId: string;
  title: string;
  client: string | null;
  estimatedValue: number | null;
  dueDate: Date | null;
  pointEstimate: number | null;
  confidence: ConfidenceLabel;
  expectedValueScore: number | null;
  whyFactors: WhyFactor[];
  insufficientData: boolean;
}

// ─── Closed statuses (mirror win-likelihood.service.ts fetchClosedTenders) ───
// Open tenders are those whose status is NOT in this set. Uses notIn rather
// than a positive allowlist so new active statuses are included automatically.
const CLOSED_STATUSES = ["WON", "LOST", "CLOSED", "NO_BID", "WITHDRAWN"] as const;

/**
 * Compute the expected-value priority ranking for all open tenders.
 *
 * Score formula: pointEstimate * estimatedValue * BID_PRIORITY_WEIGHT
 *
 * Tenders with null pointEstimate or null estimatedValue are flagged as
 * insufficientData: true and sorted last (score remains null — never imputed
 * as 0 to avoid mis-ranking against real estimates).
 *
 * ADVISORY ONLY — this ranking MUST NOT feed pricing, auto-accept, or auto-reject.
 * It is a decision-support surface only.
 */
@Injectable()
export class BidPrioritisationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly winLikelihood: WinLikelihoodService
  ) {}

  /**
   * Return open tenders ranked by expected-value score (DESC), nulls last.
   *
   * Implementation uses a single Prisma query for all open tenders, then
   * batches the per-tender win-likelihood computation via Promise.all to
   * avoid the N+1 sequential query anti-pattern.
   */
  async getRankedOpenTenders(): Promise<BidPriorityItem[]> {
    // Single query — fetch all open tenders with client info.
    const openTenders = await this.prisma.tender.findMany({
      where: {
        status: { notIn: [...CLOSED_STATUSES] }
      },
      select: {
        id: true,
        title: true,
        estimatedValue: true,
        dueDate: true,
        tenderClients: {
          select: {
            client: { select: { name: true } },
            relationshipType: true
          }
        }
      }
    });

    if (openTenders.length === 0) {
      return [];
    }

    // Batch win-likelihood for all open tenders in parallel — no sequential for…await.
    const likelihoodResults = await Promise.all(
      openTenders.map((t) => this.winLikelihood.computeForTender(t.id))
    );

    // Build ranked items.
    const items: BidPriorityItem[] = openTenders.map((tender, idx) => {
      const wl = likelihoodResults[idx];

      // Resolve primary client name (same rule as tendering service: prefer
      // "primary" relationshipType, else first entry).
      const primaryClient = resolvePrimaryClient(tender.tenderClients);

      // Convert Decimal to number explicitly — never leak the Decimal object.
      const estimatedValue =
        tender.estimatedValue !== null
          ? tender.estimatedValue.toNumber()
          : null;

      const pointEstimate = wl.pointEstimate;

      // Score: non-null only when both pointEstimate and estimatedValue are available.
      const insufficientData = pointEstimate === null || estimatedValue === null;
      const expectedValueScore = insufficientData
        ? null
        : pointEstimate * estimatedValue * BID_PRIORITY_WEIGHT;

      return {
        tenderId: tender.id,
        title: tender.title,
        client: primaryClient,
        estimatedValue,
        dueDate: tender.dueDate,
        pointEstimate,
        confidence: wl.confidence,
        expectedValueScore,
        whyFactors: wl.whyFactors,
        insufficientData
      };
    });

    // Sort: real scores DESC first, then insufficientData items last.
    return items.sort((itemA, itemB) => {
      if (itemA.expectedValueScore !== null && itemB.expectedValueScore !== null) {
        return itemB.expectedValueScore - itemA.expectedValueScore;
      }
      if (itemA.expectedValueScore !== null) return -1; // a has score, b doesn't → a first
      if (itemB.expectedValueScore !== null) return 1;  // b has score, a doesn't → b first
      return 0; // both null — preserve relative order
    });
  }
}

// ─── Pure helper ─────────────────────────────────────────────────────────────

type TenderClientRow = {
  client: { name: string };
  relationshipType: string | null;
};

function resolvePrimaryClient(clients: TenderClientRow[]): string | null {
  if (!clients.length) return null;
  const primary =
    clients.find((row) => /primary/i.test(row.relationshipType ?? "")) ??
    clients[0];
  return primary.client.name;
}

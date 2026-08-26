import { Injectable } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../../prisma/prisma.service";
import { VALUE_BAND_EDGES } from "../win-likelihood/win-likelihood-features.service";

// ── Terminal tender statuses ──────────────────────────────────────────────────
// Tenders in these statuses are closed; they do not contribute to an
// estimator's active workload.
const TERMINAL_STATUSES = ["AWARDED", "CONTRACT_ISSUED", "CONVERTED", "LOST", "WITHDRAWN"] as const;

// ── Size-band keys ────────────────────────────────────────────────────────────
// VALUE_BAND_EDGES has 4 entries (index 0..3) and its LAST edge is
// maxExclusive: Infinity, so exactly four bands are reachable here.
// AllocationWeightConfig seeds FIVE size keys (prisma/seed.ts:3951-3957):
// XS 0.50, S 1.00, M 2.00, L 3.50, XL 5.00. Because the >1M edge is the
// last one, every tender above 1M lands on "L" (3.50) and the seeded "XL"
// (5.00) row is unreachable. That is a real gap, but closing it means
// choosing a fifth value threshold, which is not derivable from anything
// in the repo - it is a product decision, so it is documented here and
// raised rather than guessed. Do NOT simply append "XL" to the list below
// expecting the fallback in sizeBand() to select it: that fallback is
// unreachable while the last edge is Infinity.
// null estimatedValue falls back to "M" (middle tier).
const SIZE_BAND_KEYS = ["XS", "S", "M", "L"] as const;
export type SizeBandKey = (typeof SIZE_BAND_KEYS)[number];

// ── Urgency-key thresholds (days) ────────────────────────────────────────────
const URGENCY_CRITICAL_DAYS = 7;
const URGENCY_HIGH_DAYS = 21;
const URGENCY_MEDIUM_DAYS = 60;

export type UrgencyKey = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

/** Capacity data for a single estimator. */
export interface EstimatorCapacityData {
  concurrentCap: number;
  availabilityPct: number;
  effectiveCap: number;
}

@Injectable()
export class CapacityService {
  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Weight config
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Reads AllocationWeightConfig rows and returns them as Maps keyed by their
   * dimension key (e.g. "CRITICAL", "XS").  Called once per computeTenderLoad
   * invocation — no cross-request cache is needed at this stage.
   */
  async getWeightConfig(): Promise<{
    urgency: Map<string, number>;
    size: Map<string, number>;
  }> {
    const rows = await this.prisma.allocationWeightConfig.findMany();

    const urgency = new Map<string, number>();
    const size = new Map<string, number>();

    for (const row of rows) {
      const weight = typeof row.weight === "object" && row.weight !== null
        ? (row.weight as Decimal).toNumber()
        : Number(row.weight);

      if (row.dimension === "urgency") {
        urgency.set(row.key, weight);
      } else if (row.dimension === "size") {
        size.set(row.key, weight);
      }
    }

    return { urgency, size };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Urgency classification
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Maps a tender due date to an urgency key.
   *
   * - null            -> "MEDIUM"
   * - < 7 days        -> "CRITICAL"
   * - < 21 days       -> "HIGH"
   * - < 60 days       -> "MEDIUM"
   * - >= 60 days      -> "LOW"
   */
  urgencyKey(dueDate: Date | null): UrgencyKey {
    if (dueDate === null) return "MEDIUM";

    const nowMs = Date.now();
    const daysUntilDue = (dueDate.getTime() - nowMs) / (1000 * 60 * 60 * 24);

    if (daysUntilDue < URGENCY_CRITICAL_DAYS) return "CRITICAL";
    if (daysUntilDue < URGENCY_HIGH_DAYS) return "HIGH";
    if (daysUntilDue < URGENCY_MEDIUM_DAYS) return "MEDIUM";
    return "LOW";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Size-band classification
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Maps an estimated value to a size-band key using VALUE_BAND_EDGES.
   * null -> "M".
   */
  sizeBand(estimatedValue: Decimal | null): SizeBandKey {
    if (estimatedValue === null) return "M";

    const value = estimatedValue.toNumber();

    for (let i = 0; i < VALUE_BAND_EDGES.length; i++) {
      if (value < VALUE_BAND_EDGES[i].maxExclusive) {
        return SIZE_BAND_KEYS[i];
      }
    }

    // Fallback: value >= all edges — return last key
    return SIZE_BAND_KEYS[SIZE_BAND_KEYS.length - 1];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Per-tender weighted load
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Computes the weighted load for a single tender:
   *   load = urgency_weight(dueDate) x size_weight(estimatedValue)
   *
   * Falls back to 1.0 for any missing weight config row so that a tender
   * always has a non-zero load contribution.
   */
  async computeTenderLoad(tender: {
    dueDate: Date | null;
    estimatedValue: Decimal | null;
  }): Promise<number> {
    const { urgency, size } = await this.getWeightConfig();

    const urgKey = this.urgencyKey(tender.dueDate);
    const sizeKey = this.sizeBand(tender.estimatedValue);

    const urgWeight = urgency.get(urgKey) ?? 1;
    const sizeWeight = size.get(sizeKey) ?? 1;

    return urgWeight * sizeWeight;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Estimator load
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Returns the total weighted load for an estimator across all open
   * (non-terminal-status) tenders where assignedEstimatorId = estimatorId.
   */
  async getEstimatorLoad(estimatorId: string): Promise<number> {
    const openTenders = await this.prisma.tender.findMany({
      where: {
        assignedEstimatorId: estimatorId,
        status: { notIn: [...TERMINAL_STATUSES] }
      },
      select: { dueDate: true, estimatedValue: true }
    });

    const loads = await Promise.all(
      openTenders.map((t) =>
        this.computeTenderLoad({
          dueDate: t.dueDate ?? null,
          estimatedValue: t.estimatedValue ?? null
        })
      )
    );

    return loads.reduce((sum, l) => sum + l, 0);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Capacity
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Reads EstimatorCapacity for the given user.  If no row exists, defaults to
   * concurrentCap=5 and availabilityPct=100.
   *
   * effectiveCap = concurrentCap x (availabilityPct / 100)
   */
  async getCapacity(estimatorId: string): Promise<EstimatorCapacityData> {
    const row = await this.prisma.estimatorCapacity.findUnique({
      where: { userId: estimatorId }
    });

    const concurrentCap = row?.concurrentCap ?? 5;
    const availabilityPct = row?.availabilityPct ?? 100;
    const effectiveCap = concurrentCap * (availabilityPct / 100);

    return { concurrentCap, availabilityPct, effectiveCap };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Overload check
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Returns true when an estimator's current weighted load exceeds their
   * effectiveCap.
   */
  async isOverloaded(estimatorId: string): Promise<boolean> {
    const [load, { effectiveCap }] = await Promise.all([
      this.getEstimatorLoad(estimatorId),
      this.getCapacity(estimatorId)
    ]);

    return load > effectiveCap;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Least-loaded selection
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Returns the estimator with the lowest load/effectiveCap ratio from the
   * supplied list, or null if every candidate is at or over capacity.
   *
   * Selection is by RATIO (load / effectiveCap) not by raw load, so an
   * estimator with a small cap who is half-full is preferred over one with a
   * large cap who is nearly full.
   */
  async getLeastLoaded(estimatorIds: string[]): Promise<string | null> {
    if (estimatorIds.length === 0) return null;

    const entries = await Promise.all(
      estimatorIds.map(async (id) => {
        const [load, capacity] = await Promise.all([
          this.getEstimatorLoad(id),
          this.getCapacity(id)
        ]);
        return { id, load, effectiveCap: capacity.effectiveCap };
      })
    );

    // Filter out anyone at or over capacity
    const underCapacity = entries.filter((e) => e.load < e.effectiveCap);

    if (underCapacity.length === 0) return null;

    // Pick the one with the lowest load/effectiveCap ratio
    underCapacity.sort((a, b) => {
      const ratioA = a.load / a.effectiveCap;
      const ratioB = b.load / b.effectiveCap;
      return ratioA - ratioB;
    });

    return underCapacity[0].id;
  }
}

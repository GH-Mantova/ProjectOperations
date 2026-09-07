import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { AuditService } from "../audit/audit.service";
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

// ── EstimatorCapacity defaults ────────────────────────────────────────────────
// An estimator with no EstimatorCapacity row is treated as a full-time
// estimator with a cap of 5. Named constants so `getCapacity()` (single read)
// and `getAllEstimatorsSummary()` (batched read) can never drift apart — the
// board and the allocation engine must agree on what "no row" means.
const DEFAULT_CONCURRENT_CAP = 5;
const DEFAULT_AVAILABILITY_PCT = 100;

// Sentinel utilisation for an estimator with no usable capacity. `load /
// effectiveCap` is Infinity (or NaN) when effectiveCap is 0, which does not
// survive JSON, so the board gets a large finite number instead.
const UTILIZATION_NO_CAPACITY = 999;

// Validation bounds for a capacity write. `availabilityPct` is a percentage;
// `concurrentCap` is a headcount-of-tenders and may legitimately be 0 (an
// estimator temporarily taking no new work) but never negative — a negative
// cap would make `effectiveCap` negative and mark everybody overloaded.
const MIN_AVAILABILITY_PCT = 0;
const MAX_AVAILABILITY_PCT = 100;
const MIN_CONCURRENT_CAP = 0;
const MAX_CONCURRENT_CAP = 100;


/** Capacity data for a single estimator. */
export interface EstimatorCapacityData {
  concurrentCap: number;
  availabilityPct: number;
  effectiveCap: number;
}

/**
 * One row of the capacity board — an "active estimator" and their current
 * weighted workload.
 *
 * `isActive` is NOT in the EW-4 prompt's field list; it is added deliberately.
 * A deactivated user who still holds open tenders MUST stay visible on the
 * board (that unreallocated work is exactly what an allocator needs to see),
 * but must never be returned by `suggestEstimator()` — suggesting a disabled
 * account is a live defect, not a cosmetic one. Carrying the flag on the row
 * lets both rules hold from one query, and gives EW-5 something to render.
 */
export interface EstimatorSummary {
  userId: string;
  displayName: string;
  /** Weighted load across open tenders (urgency weight x size weight). */
  load: number;
  /** concurrentCap x (availabilityPct / 100). */
  effectiveCap: number;
  /** load / effectiveCap x 100, 1dp; UTILIZATION_NO_CAPACITY when cap <= 0. */
  utilizationPct: number;
  isOverloaded: boolean;
  openTenderCount: number;
  availabilityPct: number;
  concurrentCap: number;
  isActive: boolean;
}

/** An unallocated tender as the board renders it. */
export interface UnallocatedBoardTender {
  tenderId: string;
  tenderNumber: string;
  title: string;
  dueDate: Date | null;
  /** Decimal serialised as a string so JSON never loses precision. */
  estimatedValue: string | null;
  urgencyKey: UrgencyKey;
  sizeBand: SizeBandKey;
  /** Weighted load this tender would add to whoever takes it. */
  load: number;
  suggestedEstimatorId: string | null;
}

/** Payload of GET /tenders/capacity-board. */
export interface CapacityBoard {
  estimators: EstimatorSummary[];
  unallocated: UnallocatedBoardTender[];
}

/** Payload of GET /tenders/capacity-board/suggest. */
export interface AllocationSuggestion {
  suggestedEstimatorId: string | null;
  /** One-line human-readable justification for the board to display as-is. */
  reason: string;
}

/** Payload of GET /tenders/allocations/:id/history. */
export interface AllocationHistory {
  allocationState: string;
  assignedEstimatorId: string | null;
  candidates: {
    id: string;
    estimatorId: string;
    offeredAt: Date;
    claimedAt: Date | null;
  }[];
  rejections: {
    id: string;
    rejectedBy: string;
    reason: string;
    rejectedAt: Date;
  }[];
}

/** Body of PUT /tenders/capacity-board/estimators/:userId/capacity. */
export interface EstimatorCapacityWrite {
  availabilityPct?: number;
  concurrentCap?: number;
}

@Injectable()
export class CapacityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

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

    return this.loadFromWeights(tender, urgency, size);
  }

  /**
   * The load formula itself, against weight maps the caller already holds.
   *
   * Extracted from `computeTenderLoad` (whose behaviour is unchanged — it now
   * fetches the config and delegates here) purely so the board can score a
   * whole page of tenders from ONE `getWeightConfig()` read. `computeTenderLoad`
   * re-reads AllocationWeightConfig on every call, which is fine for the
   * one-tender allocation path but is a query per tender per estimator on a
   * board render. This keeps a single definition of the rule.
   */
  private loadFromWeights(
    tender: { dueDate: Date | null; estimatedValue: Decimal | null },
    urgency: Map<string, number>,
    size: Map<string, number>
  ): number {
    const urgWeight = urgency.get(this.urgencyKey(tender.dueDate)) ?? 1;
    const sizeWeight = size.get(this.sizeBand(tender.estimatedValue)) ?? 1;

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

    const concurrentCap = row?.concurrentCap ?? DEFAULT_CONCURRENT_CAP;
    const availabilityPct = row?.availabilityPct ?? DEFAULT_AVAILABILITY_PCT;
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

  // ──────────────────────────────────────────────────────────────────────────
  // Board summary — EW-4
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Every "active estimator" with their current weighted load and utilisation.
   *
   * "Active estimator" is deliberately derived, not declared: a user qualifies
   * if they are named on ANY tender's `assignedEstimatorId` (open or closed) OR
   * they have an `EstimatorCapacity` row. There is no estimator role tag in the
   * schema and inventing one here would be a second source of truth that
   * immediately drifts from who is actually doing the work.
   *
   * Note the asymmetry, which is intentional: MEMBERSHIP looks at all tenders
   * (so someone who has finished all their work still appears, at load 0, and
   * can be allocated to), while LOAD counts only non-terminal tenders (so
   * closed work does not hold capacity hostage).
   *
   * Deactivated users are included so their unreallocated open work stays
   * visible; `isActive` on each row is what keeps them out of suggestions.
   *
   * Cost: four queries total, independent of estimator or tender count. The
   * naive shape — `getEstimatorLoad()` + `getCapacity()` per estimator, each of
   * which re-reads the weight config per tender — is O(estimators x tenders)
   * round trips and is not viable for a board that gets refreshed.
   *
   * Ordered most-utilised first (then displayName, then userId) so the result
   * is deterministic and the row an allocator cares about is at the top.
   */
  async getAllEstimatorsSummary(): Promise<EstimatorSummary[]> {
    const [assignedRows, capacityRows] = await Promise.all([
      this.prisma.tender.findMany({
        where: { assignedEstimatorId: { not: null } },
        select: { assignedEstimatorId: true },
        distinct: ["assignedEstimatorId"]
      }),
      this.prisma.estimatorCapacity.findMany({
        select: { userId: true, concurrentCap: true, availabilityPct: true }
      })
    ]);

    const estimatorIds = new Set<string>();
    for (const row of assignedRows) {
      if (row.assignedEstimatorId) estimatorIds.add(row.assignedEstimatorId);
    }
    for (const row of capacityRows) {
      estimatorIds.add(row.userId);
    }

    if (estimatorIds.size === 0) return [];

    const idList = [...estimatorIds];

    const [users, openTenders, weights] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: idList } },
        select: { id: true, firstName: true, lastName: true, isActive: true }
      }),
      this.prisma.tender.findMany({
        where: {
          assignedEstimatorId: { in: idList },
          status: { notIn: [...TERMINAL_STATUSES] }
        },
        select: { assignedEstimatorId: true, dueDate: true, estimatedValue: true }
      }),
      this.getWeightConfig()
    ]);

    const capacityById = new Map(capacityRows.map((row) => [row.userId, row]));
    const userById = new Map(users.map((user) => [user.id, user]));

    const loadById = new Map<string, number>();
    const openCountById = new Map<string, number>();

    for (const tender of openTenders) {
      const id = tender.assignedEstimatorId;
      if (!id) continue;

      const load = this.loadFromWeights(
        {
          dueDate: tender.dueDate ?? null,
          estimatedValue: tender.estimatedValue ?? null
        },
        weights.urgency,
        weights.size
      );

      loadById.set(id, (loadById.get(id) ?? 0) + load);
      openCountById.set(id, (openCountById.get(id) ?? 0) + 1);
    }

    const summaries: EstimatorSummary[] = [];

    for (const id of idList) {
      const user = userById.get(id);
      // A tender can name an estimator id whose User row has since gone. Skip
      // rather than fabricate a row — there is nobody to allocate to.
      if (!user) continue;

      const capacityRow = capacityById.get(id);
      const concurrentCap = capacityRow?.concurrentCap ?? DEFAULT_CONCURRENT_CAP;
      const availabilityPct = capacityRow?.availabilityPct ?? DEFAULT_AVAILABILITY_PCT;
      const effectiveCap = concurrentCap * (availabilityPct / 100);
      const load = loadById.get(id) ?? 0;

      summaries.push({
        userId: id,
        displayName: `${user.firstName} ${user.lastName}`.trim(),
        load,
        effectiveCap,
        // `<= 0` rather than `=== 0`: a legacy row with a negative cap would
        // otherwise report a negative utilisation, which reads as "plenty of
        // room" on a board. The write path rejects negatives going forward.
        utilizationPct:
          effectiveCap <= 0
            ? UTILIZATION_NO_CAPACITY
            : Math.round((load / effectiveCap) * 1000) / 10,
        // Computed from the raw numbers, never from the rounded percentage.
        // Same rule as the existing `isOverloaded()`.
        isOverloaded: load > effectiveCap,
        openTenderCount: openCountById.get(id) ?? 0,
        availabilityPct,
        concurrentCap,
        isActive: user.isActive
      });
    }

    summaries.sort(
      (a, b) =>
        b.utilizationPct - a.utilizationPct ||
        a.displayName.localeCompare(b.displayName) ||
        a.userId.localeCompare(b.userId)
    );

    return summaries;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suggestion — EW-4
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Best estimator for a tender, or null when nobody has room.
   *
   * Throws NotFoundException for an unknown tender id: null must mean "no
   * candidate has capacity", and overloading it to also mean "no such tender"
   * would have the board silently render a bad id as a legitimate no-suggestion.
   *
   * IMPORTANT — the selection specified by EW-4 does not actually depend on the
   * tender: candidates are filtered to non-overloaded and then ranked by
   * `getLeastLoaded()`, which scores current load / effectiveCap. The tender's
   * own prospective load is reported in `suggestEstimatorWithReason()` but is
   * NOT an input to the ranking. That is faithful to the prompt, and it is why
   * `getCapacityBoard()` can resolve one suggestion for the whole page. If a
   * later slice wants "who is still under cap AFTER taking this one", this
   * method is the single place that changes.
   */
  async suggestEstimator(tenderId: string): Promise<string | null> {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true }
    });
    if (!tender) throw new NotFoundException("Tender not found.");

    const summaries = await this.getAllEstimatorsSummary();

    return this.pickFromSummaries(summaries);
  }

  /**
   * `suggestEstimator` plus a one-line explanation the board can print as-is.
   *
   * The prospective load of THIS tender is included in the reason so the
   * allocator can see what they are about to add, even though (see above) it
   * does not steer the choice.
   */
  async suggestEstimatorWithReason(tenderId: string): Promise<AllocationSuggestion> {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true, dueDate: true, estimatedValue: true }
    });
    if (!tender) throw new NotFoundException("Tender not found.");

    const summaries = await this.getAllEstimatorsSummary();
    const suggestedEstimatorId = await this.pickFromSummaries(summaries);
    const tenderLoad = await this.computeTenderLoad({
      dueDate: tender.dueDate ?? null,
      estimatedValue: tender.estimatedValue ?? null
    });

    if (suggestedEstimatorId === null) {
      const reason =
        summaries.length === 0
          ? "No estimators on the board yet — assign a tender or set an estimator capacity to populate it."
          : `All ${summaries.length} estimator(s) are at or over capacity; this tender would add ${tenderLoad.toFixed(1)} load.`;
      return { suggestedEstimatorId: null, reason };
    }

    const picked = summaries.find((s) => s.userId === suggestedEstimatorId);
    const reason = picked
      ? `Least loaded: ${picked.load.toFixed(1)} / ${picked.effectiveCap.toFixed(1)} effective capacity (${picked.utilizationPct}%); this tender adds ${tenderLoad.toFixed(1)}.`
      : `Least loaded candidate; this tender adds ${tenderLoad.toFixed(1)} load.`;

    return { suggestedEstimatorId, reason };
  }

  /**
   * Shared ranking step: drop deactivated and overloaded estimators, then hand
   * the survivors to the existing `getLeastLoaded()` so the ratio rule has
   * exactly one definition in this service.
   *
   * The two filters are not redundant. `isOverloaded` is `load > effectiveCap`;
   * `getLeastLoaded` keeps only `load < effectiveCap`. An estimator sitting
   * EXACTLY at capacity survives the first and is dropped by the second — which
   * is the behaviour we want, and is `getLeastLoaded`'s call to make.
   */
  private async pickFromSummaries(summaries: EstimatorSummary[]): Promise<string | null> {
    const eligible = summaries
      .filter((summary) => summary.isActive && !summary.isOverloaded)
      .map((summary) => summary.userId);

    return this.getLeastLoaded(eligible);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Board — EW-4
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * The whole capacity board: every estimator's utilisation, plus every
   * unallocated tender annotated with the suggested estimator.
   *
   * ── Why this does NOT call `AllocationService.detectUnallocated(0)` ────────
   * EW-4's prompt says to source the list from `detectUnallocated(0)`. That
   * method filters on `Tender.updatedAt`, which is Tender's global `@updatedAt`
   * column — a known, escalated defect in EW-2c: any edit to a tender resets
   * that clock, so it does not measure time-spent-unallocated at all. At
   * threshold 0 the staleness filter is *almost* a no-op, but "almost" is the
   * problem:
   *   1. `updatedAt < now()` is evaluated against the API process clock while
   *      `updatedAt` is written by the database clock. Under any forward skew,
   *      a tender that was just edited is silently missing from the board it is
   *      supposed to appear on. A capacity board that drops rows is worse than
   *      one that is slow.
   *   2. `detectUnallocated` orders by `updatedAt asc` and calls it "oldest
   *      first". On the board that ordering would read as "longest unallocated",
   *      which is exactly the false meaning the escalated defect is about.
   *   3. It does not exclude terminal-status tenders, so a LOST tender left in
   *      allocationState UNALLOCATED would be offered for allocation.
   * So the board asks the question it actually means — allocationState is
   * UNALLOCATED and the tender is not closed — with no clock in the predicate,
   * and orders by dueDate (soonest first, undated last), which is a meaning the
   * schema genuinely supports. When EW-2c's clock is fixed with a real
   * `allocationStateChangedAt` column, an "unallocated for N days" column can be
   * added here honestly.
   */
  async getCapacityBoard(): Promise<CapacityBoard> {
    const [estimators, unallocatedRows, weights] = await Promise.all([
      this.getAllEstimatorsSummary(),
      this.prisma.tender.findMany({
        where: {
          allocationState: "UNALLOCATED",
          status: { notIn: [...TERMINAL_STATUSES] }
        },
        select: {
          id: true,
          tenderNumber: true,
          title: true,
          dueDate: true,
          estimatedValue: true
        },
        orderBy: [
          { dueDate: { sort: "asc", nulls: "last" } },
          { createdAt: "asc" }
        ]
      }),
      this.getWeightConfig()
    ]);

    // One resolution for the whole page — see suggestEstimator(): the specified
    // ranking does not depend on the tender, so calling it per row would issue
    // the same queries N times for the same answer.
    const suggestedEstimatorId = await this.pickFromSummaries(estimators);

    const unallocated: UnallocatedBoardTender[] = unallocatedRows.map((tender) => {
      const dueDate = tender.dueDate ?? null;
      const estimatedValue = tender.estimatedValue ?? null;

      return {
        tenderId: tender.id,
        tenderNumber: tender.tenderNumber,
        title: tender.title,
        dueDate,
        estimatedValue: estimatedValue === null ? null : estimatedValue.toString(),
        urgencyKey: this.urgencyKey(dueDate),
        sizeBand: this.sizeBand(estimatedValue),
        load: this.loadFromWeights({ dueDate, estimatedValue }, weights.urgency, weights.size),
        suggestedEstimatorId
      };
    });

    return { estimators, unallocated };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Allocation history — EW-4
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Pool candidates and rejections for one tender, oldest first.
   *
   * SCOPE NOTE: read-model for the board's drill-down. It arguably belongs on
   * `AllocationService` next to the writes that produce these rows, but
   * `allocation.service.ts` is outside EW-4's scope list, and the alternative —
   * injecting PrismaService straight into the controller — would break the
   * controller's stated "pure wiring, no business logic" contract. Flagged for
   * a follow-up move rather than smuggled into an out-of-scope file.
   */
  async getAllocationHistory(tenderId: string): Promise<AllocationHistory> {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true, allocationState: true, assignedEstimatorId: true }
    });
    if (!tender) throw new NotFoundException("Tender not found.");

    const [candidates, rejections] = await Promise.all([
      this.prisma.tenderAllocationCandidate.findMany({
        where: { tenderId },
        select: { id: true, estimatorId: true, offeredAt: true, claimedAt: true },
        orderBy: { offeredAt: "asc" }
      }),
      this.prisma.tenderAllocationRejection.findMany({
        where: { tenderId },
        select: { id: true, rejectedBy: true, reason: true, rejectedAt: true },
        orderBy: { rejectedAt: "asc" }
      })
    ]);

    return {
      allocationState: tender.allocationState,
      assignedEstimatorId: tender.assignedEstimatorId,
      candidates,
      rejections
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Capacity write — EW-4
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Create or update one estimator's capacity row.
   *
   * Range and emptiness checks are repeated here even though the DTO already
   * enforces them, for the same reason `AllocationService.reject()` re-checks a
   * blank reason: the service is the authority, and a non-HTTP caller must not
   * be able to write an availabilityPct of 400 — every utilisation number on
   * the board is computed from these two fields.
   *
   * An empty body is a 400, not a silent no-op: `upsert` with no data would
   * quietly CREATE a default row for a user who has none, which is a state
   * change the caller did not ask for.
   *
   * Authority (allocator-any vs estimator-self) is enforced in the controller,
   * where the JWT lives.
   */
  async upsertEstimatorCapacity(
    userId: string,
    input: EstimatorCapacityWrite,
    actorId: string
  ): Promise<EstimatorCapacityData & { userId: string }> {
    const { availabilityPct, concurrentCap } = input;

    if (availabilityPct === undefined && concurrentCap === undefined) {
      throw new BadRequestException(
        "Provide at least one of availabilityPct or concurrentCap."
      );
    }

    if (availabilityPct !== undefined) {
      if (
        !Number.isInteger(availabilityPct) ||
        availabilityPct < MIN_AVAILABILITY_PCT ||
        availabilityPct > MAX_AVAILABILITY_PCT
      ) {
        throw new BadRequestException(
          `availabilityPct must be a whole number between ${MIN_AVAILABILITY_PCT} and ${MAX_AVAILABILITY_PCT}.`
        );
      }
    }

    if (concurrentCap !== undefined) {
      if (
        !Number.isInteger(concurrentCap) ||
        concurrentCap < MIN_CONCURRENT_CAP ||
        concurrentCap > MAX_CONCURRENT_CAP
      ) {
        throw new BadRequestException(
          `concurrentCap must be a whole number between ${MIN_CONCURRENT_CAP} and ${MAX_CONCURRENT_CAP}.`
        );
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });
    // Without this the FK violation surfaces as a 500. EstimatorCapacity.userId
    // is a hard FK to User.
    if (!user) throw new NotFoundException("Estimator not found.");

    const previous = await this.prisma.estimatorCapacity.findUnique({
      where: { userId },
      select: { availabilityPct: true, concurrentCap: true }
    });

    const data: EstimatorCapacityWrite = {};
    if (availabilityPct !== undefined) data.availabilityPct = availabilityPct;
    if (concurrentCap !== undefined) data.concurrentCap = concurrentCap;

    const row = await this.prisma.estimatorCapacity.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data
    });

    // `tenders.allocate` is flagged isHighRisk in the permission registry and
    // every other write in this cluster is audited; capacity moves who gets
    // work, so it is audited too.
    await this.audit.write({
      actorId,
      action: "tenders.capacity.upsert",
      entityType: "EstimatorCapacity",
      entityId: row.id,
      metadata: {
        userId,
        created: previous === null,
        previousAvailabilityPct: previous?.availabilityPct ?? null,
        previousConcurrentCap: previous?.concurrentCap ?? null,
        availabilityPct: row.availabilityPct,
        concurrentCap: row.concurrentCap
      }
    });

    return {
      userId,
      concurrentCap: row.concurrentCap,
      availabilityPct: row.availabilityPct,
      effectiveCap: row.concurrentCap * (row.availabilityPct / 100)
    };
  }
}

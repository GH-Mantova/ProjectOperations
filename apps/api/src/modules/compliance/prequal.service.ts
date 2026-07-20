import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Status values for a {@link PrequalificationRequest}. The workflow is:
 *
 *   draft ─▶ submitted ─▶ under_review ─▶ approved
 *                                    └─▶ rejected
 *   approved ─▶ expired (via daily cron once `expiresAt` passes)
 *
 * `draft` is editable in place; every later state is immutable except via
 * the explicit verify/reject transitions.
 */
export type PrequalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "expired";

export type PrequalRiskRating = "low" | "medium" | "high";

const VALID_STATUSES: PrequalStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "expired"
];
const VALID_RISK: PrequalRiskRating[] = ["low", "medium", "high"];

// Default prequal validity window when a request is approved without an
// explicit `expiresAt`. 12 months mirrors industry-standard annual review.
const DEFAULT_VALIDITY_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Service for the structured subcontractor prequalification workflow.
 *
 * A `PrequalificationRequest` is one review cycle for a single subcontractor.
 * Unlike `SubcontractorSupplier.prequalStatus` — which is a scalar summary
 * suitable for filtering the directory — a request preserves history: prior
 * cycles remain queryable after renewal, and every approval carries a JSON
 * snapshot of the insurances/licences/documents that were on file at the
 * moment of verification. That snapshot is the authoritative "what did we
 * verify" record; downstream edits to the underlying rows do not rewrite it.
 *
 * The summary field on `SubcontractorSupplier` is kept in sync: approving a
 * request stamps `prequalStatus = "approved"` (+ reviewer/reviewedAt); a
 * rejection stamps `"rejected"`. Existing `SubcontractorSupplier.prequal*`
 * columns are the fast-read view; this table is the audit ledger behind it.
 */
@Injectable()
export class PrequalService {
  private readonly logger = new Logger(PrequalService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Reads ──────────────────────────────────────────────────────────────

  /**
   * List prequalification requests, optionally filtered.
   *
   * When `subcontractorId` is supplied returns only rows for that sub
   * (ordered newest first — good for a "review history" panel). When it is
   * omitted returns rows across all subs, useful for the compliance
   * dashboard cross-cut.
   */
  async list(filters: { subcontractorId?: string; status?: string; riskRating?: string }) {
    const where: Record<string, unknown> = {};
    if (filters.subcontractorId) where.subcontractorId = filters.subcontractorId;
    if (filters.status) where.status = filters.status;
    if (filters.riskRating) where.riskRating = filters.riskRating;
    return this.prisma.prequalificationRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        subcontractor: { select: { id: true, name: true, complianceBlocked: true } },
        verifiedBy: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });
  }

  async getById(id: string) {
    const row = await this.prisma.prequalificationRequest.findUnique({
      where: { id },
      include: {
        subcontractor: {
          select: {
            id: true,
            name: true,
            complianceBlocked: true,
            licences: true,
            insurances: true,
            documents: true
          }
        },
        verifiedBy: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });
    if (!row) throw new NotFoundException("Prequalification request not found.");
    return row;
  }

  /**
   * Cross-subcontractor rollup for the compliance dashboard.
   *
   * Returns counts by status, the number of currently-approved prequals
   * expiring within the next 30 days, and a list of subs that have never
   * had a prequalification request. Used to answer "who needs review?"
   * without loading every request row.
   */
  async dashboard() {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * DAY_MS);

    const [byStatus, byRisk, expiringSoon, missingSubs] = await Promise.all([
      this.prisma.prequalificationRequest.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      this.prisma.prequalificationRequest.groupBy({
        by: ["riskRating"],
        _count: { _all: true },
        where: { status: "approved", riskRating: { not: null } }
      }),
      this.prisma.prequalificationRequest.findMany({
        where: { status: "approved", expiresAt: { not: null, lte: in30, gte: now } },
        orderBy: { expiresAt: "asc" },
        include: { subcontractor: { select: { id: true, name: true } } }
      }),
      this.prisma.subcontractorSupplier.findMany({
        where: { isActive: true, prequalRequests: { none: {} } },
        select: { id: true, name: true, prequalStatus: true }
      })
    ]);

    return {
      counts: Object.fromEntries(
        byStatus.map((row) => [row.status, row._count._all])
      ),
      riskMix: Object.fromEntries(
        byRisk
          .filter((row) => row.riskRating)
          .map((row) => [row.riskRating as string, row._count._all])
      ),
      expiringSoon: expiringSoon.map((row) => ({
        id: row.id,
        subcontractorId: row.subcontractorId,
        subcontractorName: row.subcontractor.name,
        expiresAt: row.expiresAt,
        riskRating: row.riskRating
      })),
      subcontractorsWithoutPrequal: missingSubs
    };
  }

  // ─── Writes ─────────────────────────────────────────────────────────────

  /**
   * Open a new prequalification request in `draft` for a subcontractor.
   *
   * A sub may only have one open (draft/submitted/under_review) request at
   * a time — opening a second while the first is unfinished is a
   * BadRequest. Renewal after `approved`/`rejected`/`expired` is fine.
   */
  async create(input: { subcontractorId: string; notes?: string | null }, actorId: string) {
    const sub = await this.prisma.subcontractorSupplier.findUnique({
      where: { id: input.subcontractorId },
      select: { id: true }
    });
    if (!sub) throw new NotFoundException("Subcontractor not found.");

    const openStates: PrequalStatus[] = ["draft", "submitted", "under_review"];
    const existing = await this.prisma.prequalificationRequest.findFirst({
      where: { subcontractorId: input.subcontractorId, status: { in: openStates } },
      select: { id: true, status: true }
    });
    if (existing) {
      throw new BadRequestException(
        `Subcontractor already has an open prequalification request (${existing.id}, ${existing.status}).`
      );
    }

    return this.prisma.prequalificationRequest.create({
      data: {
        subcontractorId: input.subcontractorId,
        status: "draft",
        notes: input.notes ?? null,
        createdById: actorId
      }
    });
  }

  /**
   * Mark a draft prequalification as submitted for review.
   *
   * Stamps `submittedAt = now()` and moves status to `submitted`. Only
   * `draft` rows may be submitted — any other current state is a 400.
   */
  async submit(id: string) {
    const row = await this.prisma.prequalificationRequest.findUnique({
      where: { id },
      select: { id: true, status: true }
    });
    if (!row) throw new NotFoundException("Prequalification request not found.");
    if (row.status !== "draft") {
      throw new BadRequestException(`Only draft requests may be submitted (current: ${row.status}).`);
    }
    return this.prisma.prequalificationRequest.update({
      where: { id },
      data: { status: "submitted", submittedAt: new Date() }
    });
  }

  /**
   * Patch a draft request's notes. Only editable while `draft`.
   */
  async updateDraft(
    id: string,
    input: { notes?: string | null }
  ) {
    const row = await this.prisma.prequalificationRequest.findUnique({
      where: { id },
      select: { id: true, status: true }
    });
    if (!row) throw new NotFoundException("Prequalification request not found.");
    if (row.status !== "draft") {
      throw new BadRequestException(`Only draft requests are editable (current: ${row.status}).`);
    }
    const data: Record<string, unknown> = {};
    if (input.notes !== undefined) data.notes = input.notes;
    return this.prisma.prequalificationRequest.update({ where: { id }, data });
  }

  /**
   * Approve a prequalification, capturing a point-in-time snapshot of the
   * subcontractor's insurances / licences / documents.
   *
   * Also updates the summary columns on `SubcontractorSupplier`
   * (`prequalStatus = "approved"`, `prequalReviewedAt`, `prequalReviewedBy`)
   * so the directory list surface reflects the outcome without a join.
   *
   * `expiresAt` defaults to now + 365 days when not supplied.
   */
  async verify(
    id: string,
    actorId: string,
    input: {
      riskRating: string;
      notes?: string | null;
      expiresAt?: string | null;
    }
  ) {
    if (!VALID_RISK.includes(input.riskRating as PrequalRiskRating)) {
      throw new BadRequestException(`riskRating must be one of: ${VALID_RISK.join(", ")}`);
    }

    const row = await this.prisma.prequalificationRequest.findUnique({
      where: { id },
      include: {
        subcontractor: {
          select: {
            id: true,
            licences: {
              select: { id: true, licenceType: true, expiryDate: true }
            },
            insurances: {
              select: { id: true, insuranceType: true, expiryDate: true }
            },
            documents: {
              select: { id: true, documentType: true, name: true }
            }
          }
        }
      }
    });
    if (!row) throw new NotFoundException("Prequalification request not found.");
    if (row.status === "approved" || row.status === "rejected") {
      throw new BadRequestException(`Request already ${row.status}; open a new one to re-verify.`);
    }

    const now = new Date();
    const expiresAt = input.expiresAt
      ? new Date(input.expiresAt)
      : new Date(now.getTime() + DEFAULT_VALIDITY_DAYS * DAY_MS);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException("Invalid expiresAt date.");
    }

    const snapshot = {
      insurances: row.subcontractor.insurances,
      licences: row.subcontractor.licences,
      documents: row.subcontractor.documents,
      capturedAt: now.toISOString()
    };

    const [updated] = await this.prisma.$transaction([
      this.prisma.prequalificationRequest.update({
        where: { id },
        data: {
          status: "approved",
          riskRating: input.riskRating,
          verifiedById: actorId,
          verifiedAt: now,
          expiresAt,
          notes: input.notes ?? row.notes,
          snapshot
        }
      }),
      this.prisma.subcontractorSupplier.update({
        where: { id: row.subcontractorId },
        data: {
          prequalStatus: "approved",
          prequalReviewedAt: now,
          prequalReviewedBy: actorId
        }
      })
    ]);

    return updated;
  }

  /**
   * Reject a prequalification with a mandatory reason. Also flips the
   * summary column on `SubcontractorSupplier` to `"rejected"`.
   */
  async reject(id: string, actorId: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException("rejection reason is required.");
    }
    const row = await this.prisma.prequalificationRequest.findUnique({
      where: { id },
      select: { id: true, status: true, subcontractorId: true }
    });
    if (!row) throw new NotFoundException("Prequalification request not found.");
    if (row.status === "approved" || row.status === "rejected") {
      throw new BadRequestException(`Request already ${row.status}; open a new one to re-verify.`);
    }
    const now = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.prequalificationRequest.update({
        where: { id },
        data: {
          status: "rejected",
          verifiedById: actorId,
          verifiedAt: now,
          rejectionReason: reason.trim()
        }
      }),
      this.prisma.subcontractorSupplier.update({
        where: { id: row.subcontractorId },
        data: {
          prequalStatus: "rejected",
          prequalReviewedAt: now,
          prequalReviewedBy: actorId
        }
      })
    ]);
    return updated;
  }

  // ─── Expiry cron ────────────────────────────────────────────────────────

  /**
   * Daily pass — flip `approved` requests whose `expiresAt` has passed to
   * `expired` and drop the parent sub's `prequalStatus` back to `"pending"`
   * so the directory filter surfaces them for re-review.
   *
   * Runs at 20:30 UTC (30 min before the compliance-alerts cron at 21:00
   * UTC) so a sub that expires today is already flagged when the alerts
   * pass runs against `SubcontractorSupplier.prequalStatus`.
   */
  @Cron("30 20 * * *", { name: "prequal-expiry", timeZone: "UTC" })
  async expireStalePrequals(): Promise<{ expired: number }> {
    const now = new Date();
    const stale = await this.prisma.prequalificationRequest.findMany({
      where: { status: "approved", expiresAt: { not: null, lte: now } },
      select: { id: true, subcontractorId: true }
    });
    if (stale.length === 0) return { expired: 0 };

    await this.prisma.$transaction([
      this.prisma.prequalificationRequest.updateMany({
        where: { id: { in: stale.map((r) => r.id) } },
        data: { status: "expired" }
      }),
      this.prisma.subcontractorSupplier.updateMany({
        where: { id: { in: stale.map((r) => r.subcontractorId) }, prequalStatus: "approved" },
        data: { prequalStatus: "pending" }
      })
    ]);

    this.logger.log(`Prequal expiry: ${stale.length} requests expired.`);
    return { expired: stale.length };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  validateStatus(s: string): PrequalStatus {
    if (!VALID_STATUSES.includes(s as PrequalStatus)) {
      throw new BadRequestException(`status must be one of: ${VALID_STATUSES.join(", ")}`);
    }
    return s as PrequalStatus;
  }
}

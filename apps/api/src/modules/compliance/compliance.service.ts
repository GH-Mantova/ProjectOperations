import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../platform/notifications.service";
import { EmailService } from "../email/email.service";
import {
  CompetencyGateResult,
  checkCompetencyGate
} from "./competency-gate";

const DAY_MS = 24 * 60 * 60 * 1000;

const QUAL_TYPES = [
  "white_card",
  "asbestos_a",
  "asbestos_b",
  "forklift",
  "ewp",
  "rigger",
  "scaffolder",
  "first_aid",
  "warden",
  "dogman",
  "crane",
  "electrical",
  "plumbing",
  "other"
] as const;

const CRITICAL_LICENCE_TYPES = ["asbestos_a", "asbestos_b", "qbcc", "demolition", "waste_transport"];
const CRITICAL_INSURANCE_TYPES = ["public_liability", "workers_compensation"];

/**
 * Derived compliance status for an item with an `expiryDate`.
 *
 * - `not_set` — `expiryDate` is `null`; status cannot be computed.
 * - `active` — expires more than 30 days from now.
 * - `expiring_30` — expires within 30 days (but more than 7).
 * - `expiring_7` — expires within 7 days.
 * - `expired` — `expiryDate` is in the past.
 *
 * Thresholds are fixed in {@link ComplianceService.computeStatus} and are
 * independent of the look-ahead window passed to dashboard endpoints.
 */
export type ComplianceStatus = "not_set" | "active" | "expiring_30" | "expiring_7" | "expired";

type AlertType = "expiring_30" | "expiring_7" | "expired";

/**
 * Normalised row shape returned by {@link ComplianceService.getExpiringItems}
 * for licences, insurances, and worker qualifications alike. Lets the
 * frontend render all three item types through a single component.
 *
 * `entityType` discriminates the owner — `licence` and `insurance` rows
 * resolve to a `client` or `subcontractor`; `qualification` rows always
 * resolve to a `worker`. `entityName` is a display string already joined
 * (worker `firstName` + `lastName`) so the frontend never has to look up
 * owners.
 */
export type ExpiryRow = {
  id: string;
  itemType: "licence" | "insurance" | "qualification";
  type: string;
  number: string | null;
  expiryDate: Date | null;
  status: ComplianceStatus;
  daysUntilExpiry: number | null;
  // "company" — Initial Services' own licences and insurances, tracked
  // through the CompanyProfile polymorphic FK. They flow through the same
  // alert path as subcontractors but are NEVER auto-blocked (a company
  // cannot block itself; an expired company demolition licence is a
  // stop-the-business event that gets manual attention).
  entityType: "client" | "subcontractor" | "worker" | "company";
  entityId: string;
  entityName: string;
};

/**
 * Service layer for the compliance module — §13 Forms & Compliance, the WHS
 * surface that anchors Marco's primary working day. Owns three concerns:
 *
 *  1. **Expiry surfacing** — {@link getExpiringItems} unifies licences,
 *     insurances, and worker qualifications into a single
 *     {@link ExpiryRow} shape with a derived {@link ComplianceStatus}.
 *  2. **Daily alert + auto-block cron** — runs at 21:00 UTC (≈7am AEST).
 *     Sends tiered email + in-app notifications to users with
 *     `compliance.admin` and automatically blocks/unblocks subcontractors
 *     whose critical licences or insurances have expired.
 *  3. **Worker qualifications CRUD + competency gate** — keyed on a worker
 *     profile, with a read-only competency-gate endpoint used by future
 *     allocation flows (roadmap §7, not yet wired into AllocationsService).
 *
 * Auto-block semantics: only critical licences
 * (`asbestos_a`, `asbestos_b`, `qbcc`, `demolition`, `waste_transport`) and
 * critical insurances (`public_liability`, `workers_compensation`) trigger
 * auto-block. Auto-unblock is asymmetric — the cron only lifts blocks it
 * set itself (reason starting with `"Critical"`); manual blocks survive
 * until manually lifted via {@link manualBlock}.
 *
 * Alert dedup: every (item, tier, recipient) tuple is recorded in
 * `ComplianceAlert` so admins are not re-spammed across daily runs. The
 * three tiers (`expired`, `expiring_7`, `expiring_30`) are independent — a
 * row may alert once at the 30-day threshold and again at the 7-day
 * threshold without dedup collision.
 *
 * Notification fan-out is fire-and-forget for email
 * (`void this.email.sendNotificationEmail(...)`) and awaited for in-app
 * notifications (so dedup state and notification rows stay consistent).
 */
@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService
  ) {}

  // ─── Status computation ─────────────────────────────────────────────────
  /**
   * Derive a {@link ComplianceStatus} from a nullable `expiryDate`.
   *
   * Thresholds are fixed: 7 days = `expiring_7`, 30 days = `expiring_30`,
   * anything further out is `active`, anything in the past is `expired`,
   * and a `null` expiry is `not_set`. The 7-day check runs before the
   * 30-day check so 7-day-tier items don't get bucketed as `expiring_30`.
   *
   * @param expiryDate The item's expiry, or `null` if unset.
   * @returns The derived status.
   */
  computeStatus(expiryDate: Date | null): ComplianceStatus {
    if (!expiryDate) return "not_set";
    const now = Date.now();
    const exp = new Date(expiryDate).getTime();
    if (exp < now) return "expired";
    if (exp - now <= 7 * DAY_MS) return "expiring_7";
    if (exp - now <= 30 * DAY_MS) return "expiring_30";
    return "active";
  }

  /**
   * Days until an `expiryDate` (rounded up).
   *
   * Negative values mean the item has already expired by that many days
   * (handy for sorting expired items by recency in the dashboard).
   *
   * @param expiryDate The item's expiry, or `null` if unset.
   * @returns Days remaining (or `null` if `expiryDate` is `null`).
   */
  daysUntilExpiry(expiryDate: Date | null): number | null {
    if (!expiryDate) return null;
    return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / DAY_MS);
  }

  // ─── Expiring items aggregator ──────────────────────────────────────────
  /**
   * Aggregate licences, insurances, and worker qualifications expiring within
   * `daysAhead` days into a single shape suitable for the WHS dashboard.
   *
   * The `daysAhead` value is the *look-ahead window*: any item whose
   * `expiryDate` is `<= now + daysAhead` is included, which means items
   * already in the past are returned too. Items with `expiryDate = null` are
   * excluded — they cannot be expired or expiring. Each returned row carries
   * a derived {@link ComplianceStatus} and `daysUntilExpiry` so callers don't
   * have to re-compute either.
   *
   * Owner resolution: licence/insurance rows resolve to a `client` or
   * `subcontractor` via the polymorphic join — exactly one of those FKs is
   * non-null in well-formed data. Qualification rows always resolve to a
   * `worker`, with `entityName` pre-joined as `firstName lastName`.
   *
   * @param daysAhead Look-ahead window in days. Defaults to 30.
   * @returns Object with `licences`, `insurances`, and `qualifications`
   *   buckets, each an array of {@link ExpiryRow}, sorted ascending by
   *   `expiryDate` within each bucket.
   */
  async getExpiringItems(daysAhead = 30) {
    const cutoff = new Date(Date.now() + daysAhead * DAY_MS);

    const [licences, insurances, qualifications] = await Promise.all([
      this.prisma.entityLicence.findMany({
        where: { expiryDate: { not: null, lte: cutoff } },
        include: {
          client: { select: { id: true, name: true } },
          subcontractor: { select: { id: true, name: true } },
          // Include the company profile so we can label company-owned
          // licences with the trading name in alert emails.
          companyProfile: { select: { id: true, tradingName: true } }
        },
        orderBy: { expiryDate: "asc" }
      }),
      this.prisma.entityInsurance.findMany({
        where: { expiryDate: { not: null, lte: cutoff } },
        include: {
          client: { select: { id: true, name: true } },
          subcontractor: { select: { id: true, name: true } },
          companyProfile: { select: { id: true, tradingName: true } }
        },
        orderBy: { expiryDate: "asc" }
      }),
      this.prisma.workerQualification.findMany({
        where: { expiryDate: { not: null, lte: cutoff } },
        include: { workerProfile: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { expiryDate: "asc" }
      })
    ]);

    const mapLicence = (row: (typeof licences)[number]): ExpiryRow => ({
      id: row.id,
      itemType: "licence",
      type: row.licenceType,
      number: row.licenceNumber,
      expiryDate: row.expiryDate,
      status: this.computeStatus(row.expiryDate),
      daysUntilExpiry: this.daysUntilExpiry(row.expiryDate),
      entityType: row.companyProfile
        ? "company"
        : row.client
          ? "client"
          : "subcontractor",
      entityId:
        (row.companyProfile?.id ?? row.client?.id ?? row.subcontractor?.id) ?? "",
      entityName:
        (row.companyProfile?.tradingName ?? row.client?.name ?? row.subcontractor?.name) ??
        "—"
    });
    const mapInsurance = (row: (typeof insurances)[number]): ExpiryRow => ({
      id: row.id,
      itemType: "insurance",
      type: row.insuranceType,
      number: row.policyNumber,
      expiryDate: row.expiryDate,
      status: this.computeStatus(row.expiryDate),
      daysUntilExpiry: this.daysUntilExpiry(row.expiryDate),
      entityType: row.companyProfile
        ? "company"
        : row.client
          ? "client"
          : "subcontractor",
      entityId:
        (row.companyProfile?.id ?? row.client?.id ?? row.subcontractor?.id) ?? "",
      entityName:
        (row.companyProfile?.tradingName ?? row.client?.name ?? row.subcontractor?.name) ??
        "—"
    });
    const mapQualification = (row: (typeof qualifications)[number]): ExpiryRow => ({
      id: row.id,
      itemType: "qualification",
      type: row.qualType,
      number: row.licenceNumber,
      expiryDate: row.expiryDate,
      status: this.computeStatus(row.expiryDate),
      daysUntilExpiry: this.daysUntilExpiry(row.expiryDate),
      entityType: "worker",
      entityId: row.workerProfile.id,
      entityName: `${row.workerProfile.firstName} ${row.workerProfile.lastName}`
    });

    return {
      licences: licences.map(mapLicence),
      insurances: insurances.map(mapInsurance),
      qualifications: qualifications.map(mapQualification)
    };
  }

  // ─── Daily alert cron ───────────────────────────────────────────────────
  // 7am AEST = 21:00 UTC the previous day. nestjs/schedule treats the spec
  // as UTC unless a timeZone is provided.
  /**
   * Daily compliance cron — runs at 21:00 UTC (≈7am AEST).
   *
   * Two-step pass:
   *   1. {@link checkAndSendExpiryAlerts} for the three-tier expiry digest.
   *   2. {@link autoBlockExpiredSubcontractors} to block/unblock based on
   *      critical licence and insurance expiries.
   *
   * Failures are caught and logged via {@link Logger.error} — the cron
   * never throws out of process.
   *
   * @returns A promise that resolves when both steps have completed (or
   *   failed and been logged).
   */
  @Cron("0 21 * * *", { name: "compliance-expiry-alerts", timeZone: "UTC" })
  async runDailyComplianceTasks() {
    try {
      const sent = await this.checkAndSendExpiryAlerts();
      this.logger.log(`Compliance: ${sent} new expiry alerts sent.`);
      const blocked = await this.autoBlockExpiredSubcontractors();
      this.logger.log(`Compliance: ${blocked.blocked} blocked, ${blocked.unblocked} unblocked.`);
    } catch (err) {
      this.logger.error(`Compliance daily task failed: ${(err as Error).message}`);
    }
  }

  /**
   * Run the tiered expiry-alert pass and dispatch new notifications.
   *
   * Three tiers are evaluated independently against every expiring item
   * surfaced by {@link getExpiringItems} (30-day window): `expired`,
   * `expiring_7`, `expiring_30`. For each tier, items already recorded in
   * `ComplianceAlert` for that tier are skipped (per-item dedup, persisted
   * indefinitely), so admins are not re-spammed across daily runs. A tier
   * may still fire for a row that already fired at a coarser tier — a
   * licence can alert at the 30-day threshold today and at the 7-day
   * threshold next week.
   *
   * Recipients are all active users with the `compliance.admin` permission.
   * If none exist, the pass returns `0` without writing dedup records (so
   * onboarding a first admin still gets the existing backlog). The email
   * digest is fire-and-forget (`void ... sendNotificationEmail`); in-app
   * notifications are awaited so dedup state cannot drift from notification
   * rows.
   *
   * @returns The count of new alerts dispatched this run, summed across
   *   tiers and recipients.
   */
  async checkAndSendExpiryAlerts(): Promise<number> {
    const data = await this.getExpiringItems(30);
    const allRows: ExpiryRow[] = [...data.licences, ...data.insurances, ...data.qualifications];

    const recipients = await this.findComplianceAdmins();
    if (recipients.length === 0) return 0;

    const tiers: Array<{ alertType: AlertType; predicate: (r: ExpiryRow) => boolean }> = [
      { alertType: "expired", predicate: (r) => r.status === "expired" },
      { alertType: "expiring_7", predicate: (r) => r.status === "expiring_7" },
      { alertType: "expiring_30", predicate: (r) => r.status === "expiring_30" }
    ];

    let sent = 0;
    for (const tier of tiers) {
      const tierRows = allRows.filter(tier.predicate);
      if (tierRows.length === 0) continue;

      // Look up what alerts have already been sent for this tier so we don't
      // spam users every day.
      const existing = await this.prisma.complianceAlert.findMany({
        where: { alertType: tier.alertType, itemId: { in: tierRows.map((r) => r.id) } },
        select: { itemId: true }
      });
      const alreadySent = new Set(existing.map((a) => a.itemId));
      const newRows = tierRows.filter((r) => !alreadySent.has(r.id));
      if (newRows.length === 0) continue;

      const subject =
        tier.alertType === "expired"
          ? `[URGENT] ${newRows.length} compliance items expired — IS Operations`
          : tier.alertType === "expiring_7"
            ? `[URGENT] ${newRows.length} compliance items expiring within 7 days — IS Operations`
            : `${newRows.length} compliance items expiring within 30 days — IS Operations`;

      const html = this.renderAlertEmail(newRows, tier.alertType);
      const text = newRows
        .map(
          (r) =>
            `${r.entityName} — ${r.itemType} ${r.type} — ${r.expiryDate ? new Date(r.expiryDate).toISOString().slice(0, 10) : "no expiry"} (${r.daysUntilExpiry ?? "—"} days)`
        )
        .join("\n");

      void this.email.sendNotificationEmail({
        trigger: "compliance.expiry_reminder",
        subject,
        html,
        text
      });

      for (const user of recipients) {
        for (const row of newRows) {
          const title =
            tier.alertType === "expired"
              ? `Expired: ${row.itemType} on ${row.entityName}`
              : `Expiring soon: ${row.itemType} on ${row.entityName}`;
          await this.notifications.create({
            userId: user.id,
            title,
            body: `${row.type.replace(/_/g, " ")}${
              row.expiryDate ? ` expires ${new Date(row.expiryDate).toLocaleDateString("en-AU")}` : ""
            }.`,
            severity: tier.alertType === "expiring_30" ? "LOW" : "HIGH",
            linkUrl: "/compliance"
          });
        }
      }

      // Persist dedup records — one per (item, tier, recipient).
      await this.prisma.complianceAlert.createMany({
        data: newRows.flatMap((row) =>
          recipients.map((user) => ({
            entityType: row.entityType,
            entityId: row.entityId,
            itemType: row.itemType,
            itemId: row.id,
            alertType: tier.alertType,
            sentToUserId: user.id
          }))
        ),
        skipDuplicates: true
      });

      sent += newRows.length;
    }

    return sent;
  }

  /**
   * Block subcontractors whose critical licences or insurances have expired,
   * and lift auto-blocks whose underlying expiries have all been renewed.
   *
   * Only `approved`-prequal subcontractors are evaluated. A subcontractor
   * is blocked when any of its licences in {@link CRITICAL_LICENCE_TYPES}
   * (`asbestos_a`, `asbestos_b`, `qbcc`, `demolition`, `waste_transport`)
   * or insurances in {@link CRITICAL_INSURANCE_TYPES} (`public_liability`,
   * `workers_compensation`) has expired (`expiryDate < now`). The block
   * reason is stamped onto `complianceBlockReason` with a `"Critical
   * licence expired: …"` or `"Critical insurance expired: …"` prefix.
   *
   * Auto-unblock is asymmetric: this pass only lifts blocks whose
   * `complianceBlockReason` starts with `"Critical"`. Manual blocks (set
   * via {@link manualBlock}) survive until manually lifted, even if the
   * underlying critical items are all current.
   *
   * Both transitions notify users with `compliance.admin` via
   * {@link NotificationsService} (HIGH on block, LOW on unblock); no
   * email is sent.
   *
   * @returns Counts of `blocked` and `unblocked` subcontractors this run.
   */
  async autoBlockExpiredSubcontractors(): Promise<{ blocked: number; unblocked: number }> {
    const now = new Date();
    const subs = await this.prisma.subcontractorSupplier.findMany({
      where: { prequalStatus: "approved" },
      include: {
        licences: true,
        insurances: true
      }
    });

    let blockedCount = 0;
    let unblockedCount = 0;

    for (const sub of subs) {
      const expiredCriticalLicence = sub.licences.find(
        (l) => CRITICAL_LICENCE_TYPES.includes(l.licenceType) && l.expiryDate && l.expiryDate < now
      );
      const expiredCriticalInsurance = sub.insurances.find(
        (i) => CRITICAL_INSURANCE_TYPES.includes(i.insuranceType) && i.expiryDate && i.expiryDate < now
      );
      const shouldBlock = Boolean(expiredCriticalLicence || expiredCriticalInsurance);

      if (shouldBlock && !sub.complianceBlocked) {
        const reason = expiredCriticalLicence
          ? `Critical licence expired: ${expiredCriticalLicence.licenceType}`
          : `Critical insurance expired: ${expiredCriticalInsurance?.insuranceType}`;
        await this.prisma.subcontractorSupplier.update({
          where: { id: sub.id },
          data: {
            complianceBlocked: true,
            complianceBlockReason: reason,
            complianceBlockedAt: now
          }
        });
        blockedCount += 1;
        await this.notifyAdmins(
          `${sub.name} automatically blocked`,
          reason,
          "HIGH"
        );
      } else if (!shouldBlock && sub.complianceBlocked && sub.complianceBlockReason?.startsWith("Critical")) {
        // Auto-block was set by us; renewals brought everything back under
        // control, so we can lift the block.
        await this.prisma.subcontractorSupplier.update({
          where: { id: sub.id },
          data: {
            complianceBlocked: false,
            complianceBlockReason: null,
            complianceBlockedAt: null
          }
        });
        unblockedCount += 1;
        await this.notifyAdmins(`${sub.name} compliance block lifted`, `All critical items now active.`, "LOW");
      }
    }

    return { blocked: blockedCount, unblocked: unblockedCount };
  }

  /**
   * List every subcontractor currently flagged with `complianceBlocked = true`.
   *
   * Includes both auto-blocked (cron) and manually blocked rows. Ordered
   * most recently blocked first, so the dashboard surfaces fresh incidents
   * at the top.
   *
   * @returns Array of `SubcontractorSupplier` rows.
   */
  async listBlockedSubcontractors() {
    return this.prisma.subcontractorSupplier.findMany({
      where: { complianceBlocked: true },
      orderBy: { complianceBlockedAt: "desc" }
    });
  }

  /**
   * Manually toggle a subcontractor's compliance block.
   *
   * When `blocked = true`, `complianceBlockReason` is set to `reason` (or
   * `"Manual block"` if `reason` is `null`) and `complianceBlockedAt` is
   * stamped to now. When `blocked = false`, both columns are cleared. The
   * controller enforces that `reason` is non-null when blocking; this
   * service-level path tolerates `null` and falls back to a default so
   * direct service callers don't need extra validation.
   *
   * Manual blocks are not auto-lifted by the daily cron — only blocks
   * whose reason starts with `"Critical"` are. See
   * {@link autoBlockExpiredSubcontractors} for the asymmetry.
   *
   * @param id The subcontractor ID.
   * @param blocked Target block state.
   * @param reason Free-text reason. Used only when `blocked = true`.
   * @returns The updated `SubcontractorSupplier` row.
   * @throws NotFoundException When the subcontractor does not exist.
   */
  async manualBlock(id: string, blocked: boolean, reason: string | null) {
    const exists = await this.prisma.subcontractorSupplier.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!exists) throw new NotFoundException("Subcontractor not found.");
    return this.prisma.subcontractorSupplier.update({
      where: { id },
      data: {
        complianceBlocked: blocked,
        complianceBlockReason: blocked ? reason ?? "Manual block" : null,
        complianceBlockedAt: blocked ? new Date() : null
      }
    });
  }

  // ─── Worker qualifications CRUD ─────────────────────────────────────────
  /**
   * List a worker's qualifications, decorated with a derived `status`.
   *
   * The derived `status` is computed from `expiryDate` on every read via
   * {@link computeStatus} — the schema does not persist a status column for
   * qualifications today. Ordered by `expiryDate` ascending with `qualType`
   * as the tiebreaker, so soonest-expiring surfaces first.
   *
   * @param workerProfileId The worker profile to list qualifications for.
   * @returns Array of `WorkerQualification` rows with derived `status`.
   * @throws NotFoundException When the worker profile does not exist.
   */
  async listQualifications(workerProfileId: string) {
    await this.requireWorker(workerProfileId);
    const rows = await this.prisma.workerQualification.findMany({
      where: { workerProfileId },
      orderBy: [{ expiryDate: "asc" }, { qualType: "asc" }]
    });
    return rows.map((r) => ({ ...r, status: this.computeStatus(r.expiryDate) }));
  }

  /**
   * Create a qualification on a worker.
   *
   * `qualType` is mandatory and must be one of the supported codes
   * (`white_card`, `asbestos_a`, `asbestos_b`, `forklift`, `ewp`, `rigger`,
   * `scaffolder`, `first_aid`, `warden`, `dogman`, `crane`, `electrical`,
   * `plumbing`, `other`). Dates are parsed defensively via
   * {@link parseDate} — empty strings collapse to `null`, invalid dates
   * throw 400. `actorId`, when supplied, is recorded as `createdById`.
   *
   * @param workerProfileId The worker the qualification belongs to.
   * @param input Qualification fields. `qualType` is required.
   * @param actorId JWT actor — recorded as `createdById`. Optional for
   *   direct service callers (e.g. seed scripts).
   * @returns The created `WorkerQualification` row.
   * @throws NotFoundException When the worker profile does not exist.
   * @throws BadRequestException When `qualType` is missing or invalid, or
   *   any date string fails to parse.
   */
  async createQualification(
    workerProfileId: string,
    input: {
      qualType?: string;
      licenceNumber?: string | null;
      issuingAuthority?: string | null;
      issueDate?: string | null;
      expiryDate?: string | null;
      notes?: string | null;
    },
    actorId?: string
  ) {
    await this.requireWorker(workerProfileId);
    if (!input.qualType || !QUAL_TYPES.includes(input.qualType as never)) {
      throw new BadRequestException(`qualType must be one of: ${QUAL_TYPES.join(", ")}`);
    }
    return this.prisma.workerQualification.create({
      data: {
        workerProfileId,
        qualType: input.qualType,
        licenceNumber: input.licenceNumber ?? null,
        issuingAuthority: input.issuingAuthority ?? null,
        issueDate: this.parseDate(input.issueDate),
        expiryDate: this.parseDate(input.expiryDate),
        notes: input.notes ?? null,
        createdById: actorId ?? null
      }
    });
  }

  /**
   * Partial update of a worker's qualification.
   *
   * Tri-state field semantics: `undefined` leaves the column untouched,
   * `null` clears it, and a value sets it. The lookup is scoped to the
   * owning worker (`workerProfileId`) so callers cannot edit
   * qualifications off unrelated workers by guessing IDs — a 404 is
   * returned in both the missing-row and wrong-owner cases. `qualType`,
   * if supplied, is validated against the supported set.
   *
   * @param workerProfileId The owning worker profile.
   * @param qualId The qualification row to update.
   * @param input Partial qualification fields.
   * @returns The updated `WorkerQualification` row.
   * @throws NotFoundException When the qualification does not exist on the
   *   given worker.
   * @throws BadRequestException When `qualType` is supplied but invalid,
   *   or any date string fails to parse.
   */
  async updateQualification(
    workerProfileId: string,
    qualId: string,
    input: {
      qualType?: string;
      licenceNumber?: string | null;
      issuingAuthority?: string | null;
      issueDate?: string | null;
      expiryDate?: string | null;
      notes?: string | null;
    }
  ) {
    const existing = await this.prisma.workerQualification.findFirst({
      where: { id: qualId, workerProfileId }
    });
    if (!existing) throw new NotFoundException("Qualification not found.");
    if (input.qualType && !QUAL_TYPES.includes(input.qualType as never)) {
      throw new BadRequestException(`qualType must be one of: ${QUAL_TYPES.join(", ")}`);
    }
    const data: Record<string, unknown> = {};
    if (input.qualType !== undefined) data.qualType = input.qualType;
    if (input.licenceNumber !== undefined) data.licenceNumber = input.licenceNumber;
    if (input.issuingAuthority !== undefined) data.issuingAuthority = input.issuingAuthority;
    if (input.issueDate !== undefined) data.issueDate = this.parseDate(input.issueDate);
    if (input.expiryDate !== undefined) data.expiryDate = this.parseDate(input.expiryDate);
    if (input.notes !== undefined) data.notes = input.notes;
    return this.prisma.workerQualification.update({ where: { id: qualId }, data });
  }

  /**
   * Hard-delete a worker's qualification.
   *
   * The row is removed from the database, not soft-flagged. Scoped to the
   * owning worker so cross-worker access attempts return 404.
   *
   * @param workerProfileId The owning worker profile.
   * @param qualId The qualification row to delete.
   * @returns `{ id }` echoing the deleted qualification ID.
   * @throws NotFoundException When the qualification does not exist on the
   *   given worker.
   */
  async deleteQualification(workerProfileId: string, qualId: string) {
    const existing = await this.prisma.workerQualification.findFirst({
      where: { id: qualId, workerProfileId }
    });
    if (!existing) throw new NotFoundException("Qualification not found.");
    await this.prisma.workerQualification.delete({ where: { id: qualId } });
    return { id: qualId };
  }

  // ─── Competency gate (read-only, roadmap §7) ───────────────────────────
  // Helper-backed read endpoint. Does NOT mutate any allocation today —
  // wiring this into AllocationsService is a deliberate next PR.
  /**
   * Evaluate whether a worker meets a required qualification set.
   *
   * Loads only the fields {@link checkCompetencyGate} needs (`qualType`,
   * `expiryDate`) and delegates to that pure helper for the verdict.
   * Read-only — does NOT mutate or block any allocation today; the wiring
   * into AllocationsService is a deliberate future PR (roadmap §7).
   *
   * @param workerProfileId The worker profile to evaluate.
   * @param requiredQualTypes The `qualType` codes the work requires. Empty
   *   arrays produce an unconditionally-allowed verdict; callers (the
   *   controller) typically guard against that upstream.
   * @returns A {@link CompetencyGateResult} — `allowed` flag plus `missing`,
   *   `expired`, and `expiringSoon` arrays.
   * @throws NotFoundException When the worker profile does not exist.
   */
  async checkWorkerCompetency(
    workerProfileId: string,
    requiredQualTypes: string[]
  ): Promise<CompetencyGateResult> {
    await this.requireWorker(workerProfileId);
    const quals = await this.prisma.workerQualification.findMany({
      where: { workerProfileId },
      select: { qualType: true, expiryDate: true }
    });
    return checkCompetencyGate(quals, requiredQualTypes);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────
  private async findComplianceAdmins() {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        userRoles: {
          some: {
            role: {
              rolePermissions: { some: { permission: { code: "compliance.admin" } } }
            }
          }
        }
      },
      select: { id: true, email: true }
    });
  }

  private async notifyAdmins(title: string, body: string, severity: "LOW" | "HIGH") {
    const recipients = await this.findComplianceAdmins();
    for (const user of recipients) {
      await this.notifications.create({
        userId: user.id,
        title,
        body,
        severity,
        linkUrl: "/compliance"
      });
    }
  }

  private renderAlertEmail(rows: ExpiryRow[], tier: AlertType): string {
    const headerColour = tier === "expired" ? "#dc2626" : tier === "expiring_7" ? "#f97316" : "#eab308";
    const tierLabel = tier === "expired" ? "Expired" : tier === "expiring_7" ? "Expiring within 7 days" : "Expiring within 30 days";
    const tableRows = rows
      .map(
        (r) => `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${r.entityName}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${r.itemType}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${r.type.replace(/_/g, " ")}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${r.expiryDate ? new Date(r.expiryDate).toLocaleDateString("en-AU") : "—"}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${r.daysUntilExpiry ?? "—"} days</td>
        </tr>`
      )
      .join("");
    return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f1117">
      <h2 style="color:${headerColour};margin:0 0 12px">${tierLabel}: ${rows.length} item${rows.length === 1 ? "" : "s"}</h2>
      <p>Review at <a href="/compliance">the compliance dashboard</a>.</p>
      <table style="border-collapse:collapse;width:100%;margin-top:12px">
        <thead><tr style="background:#f6f6f6">
          <th style="padding:6px 10px;text-align:left">Entity</th>
          <th style="padding:6px 10px;text-align:left">Type</th>
          <th style="padding:6px 10px;text-align:left">Item</th>
          <th style="padding:6px 10px;text-align:left">Expiry</th>
          <th style="padding:6px 10px;text-align:left">Days</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;
  }

  private async requireWorker(id: string) {
    const w = await this.prisma.workerProfile.findUnique({ where: { id }, select: { id: true } });
    if (!w) throw new NotFoundException("Worker profile not found.");
    return w;
  }

  private parseDate(v: string | null | undefined): Date | null {
    if (v === undefined || v === null || v === "") return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw new BadRequestException("Invalid date format.");
    return d;
  }
}

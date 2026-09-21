/**
 * TipRecommendationsService
 *
 * Computes ranked tip recommendations for a given waste type + load size +
 * origin, and writes an append-only TipRecommendationLog row when an operator
 * accepts a recommendation ("use this facility").
 *
 * Service location is a contract -- the next slice declares
 * `requires_file_on_main` against this exact path. Do not rename.
 *
 * Costing (v1):
 *   disposalFee = loadTonnes x resolvedRate  (via RateResolverService, "waste" slug)
 *   travelCost  = haversineKm x 2 x OperationsSettings.travelRatePerKm  (round trip)
 *   totalCost   = disposalFee + travelCost
 *
 * TIPs with no matching EstimateWasteRate row are returned greyed as
 * "not-accepted" with zero costs -- the caller renders them separately.
 */

import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../../prisma/prisma.service";
import { RateResolverService } from "../rates/rate-resolver.service";
import { NotificationsService } from "../platform/notifications.service";
import { EmailService } from "../email/email.service";

// ---- Version marker (required by done_when gate) ---------------------------
export const OPS_M2B_TIPPING_V1 = "ops-m2b";

// ---- Office fallback coordinates (Initial Services -- Grice St, Clontarf QLD) -
// Used when the operator selects "office" as the origin rather than a project.
const OFFICE_LAT = -27.2495;
const OFFICE_LNG = 153.1053;

// ---- Price review: 182 days = 6 calendar months (26 weeks) -----------------
const REVIEW_CYCLE_DAYS = 182;

// ---- Types -----------------------------------------------------------------

export type TipOriginType = "project" | "office" | "tender";

export type ComputeRecommendationsDto = {
  /** Waste type code -- must match a row in EstimateWasteRate.wasteType */
  wasteTypeCode: string;
  /** Load size in tonnes (positive non-zero) */
  loadTonnes: number;
  /**
   * "project" -> use the project site's stored coords
   * "office"  -> use OFFICE_LAT/LNG
   * "tender"  -> use the tender's site.centreLat/centreLng (OPS-M3)
   */
  originType: TipOriginType;
  /** Required when originType = "project" */
  projectId?: string;
  /** Required when originType = "tender" */
  tenderId?: string;
};

export type AcceptRecommendationDto = {
  /** MapLocation.id of the accepted tip */
  mapLocationId: string;
  wasteTypeCode: string;
  loadTonnes: number;
  originType: TipOriginType;
  projectId?: string;
  /** Required when originType = "tender" */
  tenderId?: string;
};

export type TipRecommendationCard = {
  mapLocationId: string;
  facilityName: string;
  addressLine1: string;
  suburb: string;
  state: string;
  postcode: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  /** null -> no rate row exists for this tip x waste type */
  disposalFee: number | null;
  /** null when disposalFee is null */
  travelCost: number | null;
  totalCost: number | null;
  /** Per-tonne rate resolved for this facility x waste type */
  ratePerTonne: number | null;
  travelRatePerKm: number | null;
  accepted: boolean;
};

export type TippingLogRow = {
  id: string;
  createdAt: string;
  facilityName: string;
  wasteTypeCode: string;
  loadTonnes: string;
  distanceKm: string;
  disposalFee: string;
  travelCost: string;
  totalCost: string;
  /** "tender" | "job" -- tender rows were planned before award */
  source: "tender" | "job";
  createdBy: { firstName: string; lastName: string } | null;
};

export type TippingLogSummary = {
  rows: TippingLogRow[];
  loads: number;
  tonnes: string;
  disposal: string;
  travel: string;
  total: string;
};

// ---- Haversine -------------------------------------------------------------

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(distKm * 100) / 100; // 2 dp
}

// ---- Service ---------------------------------------------------------------

@Injectable()
export class TipRecommendationsService {
  private readonly logger = new Logger(TipRecommendationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rateResolver: RateResolverService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService
  ) {}

  /**
   * Compute ranked tip recommendations.
   *
   * Returns all active TIP MapLocations, each scored with:
   *   - disposal fee (resolved via RateResolverService "waste" slug)
   *   - travel cost (haversine x 2 x travelRatePerKm from OperationsSettings)
   *   - total cost
   *
   * TIPs with no matching rate row are included but marked accepted=false with
   * null costs so the UI can render them greyed as "not accepted / rates needed".
   *
   * Result is sorted: accepted tips by totalCost ascending, then unaccepted tips.
   */
  async computeRecommendations(dto: ComputeRecommendationsDto): Promise<TipRecommendationCard[]> {
    const { wasteTypeCode, loadTonnes, originType, projectId, tenderId } = dto;

    if (loadTonnes <= 0) {
      throw new BadRequestException("loadTonnes must be greater than zero.");
    }

    // Resolve origin coordinates
    const { originLat, originLng } = await this.resolveOrigin(originType, projectId, tenderId);

    // Fetch OperationsSettings for travelRatePerKm
    const settings = await this.prisma.operationsSettings.findUnique({
      where: { id: "singleton" }
    });
    const travelRatePerKm = settings?.travelRatePerKm != null ? Number(settings.travelRatePerKm) : null;

    // Fetch all active TIP locations that have coordinates
    const tips = await this.prisma.mapLocation.findMany({
      where: { kind: "TIP", isActive: true }
    });

    // Compute per-tip
    const cards: TipRecommendationCard[] = [];

    for (const tip of tips) {
      if (tip.latitude === null || tip.longitude === null) {
        // No coordinates -- cannot compute distance; include greyed
        cards.push({
          mapLocationId: tip.id,
          facilityName: tip.name,
          addressLine1: tip.addressLine1,
          suburb: tip.suburb,
          state: tip.state,
          postcode: tip.postcode,
          latitude: 0,
          longitude: 0,
          distanceKm: 0,
          disposalFee: null,
          travelCost: null,
          totalCost: null,
          ratePerTonne: null,
          travelRatePerKm,
          accepted: false
        });
        continue;
      }

      const tipLat = Number(tip.latitude);
      const tipLng = Number(tip.longitude);
      const distKm = haversineKm(originLat, originLng, tipLat, tipLng);

      // Resolve disposal rate via RateResolverService using "waste" slug
      let ratePerTonne: number | null = null;
      if (tip.facility) {
        try {
          const resolved = await this.rateResolver.resolveRate("waste", {
            wasteType: wasteTypeCode,
            facility: tip.facility
          });
          ratePerTonne = resolved.value;
        } catch {
          // No rate row for this tip x waste type -- leave null
        }
      }

      if (ratePerTonne === null || travelRatePerKm === null) {
        // Missing rate or travel rate -- cannot price
        cards.push({
          mapLocationId: tip.id,
          facilityName: tip.name,
          addressLine1: tip.addressLine1,
          suburb: tip.suburb,
          state: tip.state,
          postcode: tip.postcode,
          latitude: tipLat,
          longitude: tipLng,
          distanceKm: distKm,
          disposalFee: null,
          travelCost: null,
          totalCost: null,
          ratePerTonne,
          travelRatePerKm,
          accepted: false
        });
        continue;
      }

      const disposalFee = Math.round(loadTonnes * ratePerTonne * 100) / 100;
      const travelCost = Math.round(distKm * 2 * travelRatePerKm * 100) / 100;
      const totalCost = Math.round((disposalFee + travelCost) * 100) / 100;

      cards.push({
        mapLocationId: tip.id,
        facilityName: tip.name,
        addressLine1: tip.addressLine1,
        suburb: tip.suburb,
        state: tip.state,
        postcode: tip.postcode,
        latitude: tipLat,
        longitude: tipLng,
        distanceKm: distKm,
        disposalFee,
        travelCost,
        totalCost,
        ratePerTonne,
        travelRatePerKm,
        accepted: true
      });
    }

    // Sort: fully priced tips by totalCost asc, then unpriced tips
    cards.sort((a, b) => {
      if (a.accepted && b.accepted) return (a.totalCost ?? 0) - (b.totalCost ?? 0);
      if (a.accepted) return -1;
      if (b.accepted) return 1;
      return a.facilityName.localeCompare(b.facilityName);
    });

    return cards;
  }

  /**
   * Accept a recommendation -- writes a TipRecommendationLog row.
   * The row snapshots prices at decision time; it never recomputes.
   * ops-m2b: also stores tenderId when originType = "tender".
   */
  async acceptRecommendation(
    dto: AcceptRecommendationDto,
    actorId: string
  ): Promise<{ logId: string }> {
    const { mapLocationId, wasteTypeCode, loadTonnes, originType, projectId, tenderId } = dto;

    if (loadTonnes <= 0) {
      throw new BadRequestException("loadTonnes must be greater than zero.");
    }

    // Verify location exists and is active
    const tip = await this.prisma.mapLocation.findUnique({ where: { id: mapLocationId } });
    if (!tip || !tip.isActive) {
      throw new NotFoundException(`TIP location ${mapLocationId} not found or inactive.`);
    }
    if (tip.kind !== "TIP") {
      throw new BadRequestException(`Location ${mapLocationId} is not a TIP.`);
    }
    if (tip.latitude === null || tip.longitude === null) {
      throw new BadRequestException(
        `TIP location "${tip.name}" has no coordinates -- cannot compute travel cost.`
      );
    }

    // Verify required context fields per originType
    if (originType === "project" && !projectId) {
      throw new BadRequestException('projectId is required when originType = "project".');
    }
    if (originType === "tender" && !tenderId) {
      throw new BadRequestException('tenderId is required when originType = "tender".');
    }
    const { originLat, originLng } = await this.resolveOrigin(originType, projectId, tenderId);

    // Fetch OperationsSettings
    const settings = await this.prisma.operationsSettings.findUnique({
      where: { id: "singleton" }
    });
    const travelRatePerKm = settings?.travelRatePerKm != null ? Number(settings.travelRatePerKm) : null;
    if (travelRatePerKm === null) {
      throw new BadRequestException(
        "Travel rate per km is not configured in Operations Settings. Contact your administrator."
      );
    }

    // Resolve rate -- must exist to accept
    if (!tip.facility) {
      throw new BadRequestException(
        `TIP location "${tip.name}" has no facility name -- cannot resolve disposal rate.`
      );
    }
    let ratePerTonne: number;
    try {
      const resolved = await this.rateResolver.resolveRate("waste", {
        wasteType: wasteTypeCode,
        facility: tip.facility
      });
      ratePerTonne = resolved.value;
    } catch {
      throw new BadRequestException(
        `No disposal rate found for waste type "${wasteTypeCode}" at facility "${tip.facility}". ` +
          `Add a rate in Rates & Lists before accepting this recommendation.`
      );
    }

    const tipLat = Number(tip.latitude);
    const tipLng = Number(tip.longitude);
    const distKm = haversineKm(originLat, originLng, tipLat, tipLng);
    const disposalFee = Math.round(loadTonnes * ratePerTonne * 100) / 100;
    const travelCost = Math.round(distKm * 2 * travelRatePerKm * 100) / 100;
    const totalCost = Math.round((disposalFee + travelCost) * 100) / 100;

    const log = await this.prisma.tipRecommendationLog.create({
      data: {
        mapLocationId,
        facilityName: tip.name,
        facilityLat: tipLat,
        facilityLng: tipLng,
        wasteTypeCode,
        loadTonnes,
        originType,
        projectId: projectId ?? null,
        // ops-m2b: store tenderId for tender-stage picks
        tenderId: tenderId ?? null,
        originLat,
        originLng,
        distanceKm: distKm,
        disposalFee,
        travelCost,
        totalCost,
        createdById: actorId
      }
    });

    this.logger.log({
      event: "tip-recommendation-accepted",
      logId: log.id,
      facility: tip.facility,
      wasteTypeCode,
      loadTonnes,
      totalCost
    });

    return { logId: log.id };
  }

  /**
   * List tipping log rows for a project.
   *
   * Returns rows where projectId = the given project, PLUS rows whose
   * tenderId = the project's sourceTender.id, newest first.
   * Totals are summed server-side in Decimal to avoid floating-point drift.
   * Each row carries source: "tender" | "job".
   *
   * Guarded by projects.view at the controller layer.
   */
  async listForProject(projectId: string): Promise<TippingLogSummary> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, sourceTenderId: true }
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found.`);
    }

    // Collect job rows (origin = project)
    const jobRows = await this.prisma.tipRecommendationLog.findMany({
      where: { projectId },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" }
    });

    // Collect tender rows (planned before award, if the project came from a tender)
    let tenderRows: typeof jobRows = [];
    if (project.sourceTenderId) {
      tenderRows = await this.prisma.tipRecommendationLog.findMany({
        where: { tenderId: project.sourceTenderId },
        include: { createdBy: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" }
      });
    }

    // Merge: tender rows first if same date, deduplicate by id (a row cannot be both)
    const seen = new Set<string>();
    const all: Array<{ row: (typeof jobRows)[0]; source: "tender" | "job" }> = [];
    for (const r of tenderRows) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        all.push({ row: r, source: "tender" });
      }
    }
    for (const r of jobRows) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        all.push({ row: r, source: "job" });
      }
    }
    // Sort merged list newest first
    all.sort((a, b) => b.row.createdAt.getTime() - a.row.createdAt.getTime());

    // Totals in Decimal -- never float arithmetic on money
    let sumTonnes = new Decimal(0);
    let sumDisposal = new Decimal(0);
    let sumTravel = new Decimal(0);
    let sumTotal = new Decimal(0);

    for (const { row } of all) {
      sumTonnes = sumTonnes.add(row.loadTonnes);
      sumDisposal = sumDisposal.add(row.disposalFee);
      sumTravel = sumTravel.add(row.travelCost);
      sumTotal = sumTotal.add(row.totalCost);
    }

    const rows: TippingLogRow[] = all.map(({ row, source }) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      facilityName: row.facilityName,
      wasteTypeCode: row.wasteTypeCode,
      loadTonnes: row.loadTonnes.toFixed(3),
      distanceKm: row.distanceKm.toFixed(1),
      disposalFee: row.disposalFee.toFixed(2),
      travelCost: row.travelCost.toFixed(2),
      totalCost: row.totalCost.toFixed(2),
      source,
      createdBy: row.createdBy
        ? { firstName: row.createdBy.firstName, lastName: row.createdBy.lastName }
        : null
    }));

    return {
      rows,
      loads: all.length,
      tonnes: sumTonnes.toFixed(3),
      disposal: sumDisposal.toFixed(2),
      travel: sumTravel.toFixed(2),
      total: sumTotal.toFixed(2)
    };
  }

  // ---- Daily cron: waste price review digest --------------------------------

  /**
   * Daily cron at 21:00 UTC -- sends one digest listing all active TIPs that
   * are due a price review and have not yet been notified this cycle.
   *
   * "Due" = pricesReviewedAt is null OR pricesReviewedAt + 182 days <= now.
   * "Not yet notified this cycle" = pricesReviewNotifiedAt is null OR
   *   pricesReviewNotifiedAt < pricesReviewedAt (cycle reset by a new review).
   *
   * Sends ONE digest per run (not per-tip), then stamps pricesReviewNotifiedAt
   * on each listed tip so it is not included again until reviewed + 182 days.
   *
   * Reads the waste.price_review_due NotificationTriggerConfig for isEnabled,
   * deliveryMethod, and recipientRoles/recipientUserIds. If disabled or no
   * recipients, does nothing.
   */
  @Cron("0 21 * * *", { name: "waste-price-review", timeZone: "UTC" })
  async runPriceReviewDigest(): Promise<void> {
    try {
      const sent = await this.sendPriceReviewDigest();
      this.logger.log(`Waste price review digest: ${sent} notifications sent.`);
    } catch (err) {
      this.logger.error(`Waste price review digest failed: ${(err as Error).message}`);
    }
  }

  /**
   * Core logic for the price review digest -- separated so tests can call it
   * directly without the cron decorator.
   *
   * @returns number of in-app notifications created
   */
  async sendPriceReviewDigest(): Promise<number> {
    const trigger = await this.prisma.notificationTriggerConfig.findUnique({
      where: { trigger: "waste.price_review_due" }
    });
    if (!trigger || !trigger.isEnabled) {
      this.logger.debug("waste.price_review_due trigger not enabled -- skipping digest");
      return 0;
    }

    const now = new Date();
    const reviewCutoff = new Date(now.getTime() - REVIEW_CYCLE_DAYS * 24 * 60 * 60 * 1000);

    // Active TIPs that are due AND not yet notified this cycle
    const dueTips = await this.prisma.mapLocation.findMany({
      where: {
        kind: "TIP",
        isActive: true,
        AND: [
          // Due: never reviewed OR reviewed > 182 days ago
          {
            OR: [
              { pricesReviewedAt: null },
              { pricesReviewedAt: { lte: reviewCutoff } }
            ]
          },
          // Not yet notified this cycle: never notified OR notified before last review
          {
            OR: [
              { pricesReviewNotifiedAt: null },
              // pricesReviewedAt is not null here (we reset the cycle when reviewed)
              // and pricesReviewNotifiedAt < pricesReviewedAt means a new review happened
              // after the last notification -- the check below handles it
            ]
          }
        ]
      }
    });

    // Further filter: skip tips where pricesReviewNotifiedAt >= pricesReviewedAt
    // (already notified in the current cycle). When pricesReviewedAt is null,
    // any non-null pricesReviewNotifiedAt means it was already sent this cycle.
    const unnotified = dueTips.filter((tip) => {
      if (tip.pricesReviewNotifiedAt === null) return true; // never notified
      if (tip.pricesReviewedAt === null) return false; // notified but never reviewed -- already sent
      // notified before the last review -- cycle reset; include again
      return tip.pricesReviewNotifiedAt < tip.pricesReviewedAt;
    });

    if (unnotified.length === 0) {
      this.logger.debug("waste price review: no tips due notification this cycle");
      return 0;
    }

    // Resolve recipients
    const recipients = await this.resolveRecipients(
      trigger.recipientUserIds,
      trigger.recipientRoles
    );
    if (recipients.length === 0) {
      this.logger.debug("no recipients configured for waste.price_review_due");
      return 0;
    }

    // Build digest content
    const count = unnotified.length;
    const tipLines = unnotified.map((tip) => {
      if (tip.pricesReviewedAt === null) {
        return `${tip.name} (never reviewed)`;
      }
      const daysSince = Math.floor(
        (now.getTime() - tip.pricesReviewedAt.getTime()) / (24 * 60 * 60 * 1000)
      );
      const overdueDays = daysSince - REVIEW_CYCLE_DAYS;
      return `${tip.name} (overdue ${overdueDays} day${overdueDays === 1 ? "" : "s"})`;
    });

    const title = `${count} tip${count === 1 ? "" : "s"} are due a price review`;
    const body =
      tipLines.join(" and ") +
      ". Open Map locations -> Tips.";
    const emailSubject = `Tip price review due -- ${count} facilit${count === 1 ? "y" : "ies"}`;

    const emailHtmlLines = unnotified.map((tip) => {
      if (tip.pricesReviewedAt === null) {
        return `<li>${tip.name} -- never reviewed</li>`;
      }
      const d = tip.pricesReviewedAt.toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
      return `<li>${tip.name} -- last reviewed ${d}</li>`;
    });

    const emailHtml = `<p>Hi,</p>
<p>These tips haven't had their prices checked in the last six months:</p>
<ul>${emailHtmlLines.join("")}</ul>
<p>Check each one's rates, then mark it reviewed in Settings &rarr; Map locations &rarr; Tips.</p>`;

    const emailText =
      "These tips haven't had their prices checked in the last six months:\n" +
      tipLines.map((l) => `- ${l}`).join("\n") +
      "\nCheck each one's rates, then mark it reviewed in Settings -> Map locations -> Tips.";

    // Send email if delivery method includes email
    if (trigger.deliveryMethod !== "inapp") {
      void this.email.sendNotificationEmail({
        trigger: "waste.price_review_due",
        subject: emailSubject,
        html: emailHtml,
        text: emailText
      });
    }

    // Send in-app notifications
    let sent = 0;
    if (trigger.deliveryMethod !== "email") {
      for (const user of recipients) {
        await this.notifications.create({
          userId: user.id,
          title,
          body,
          severity: "LOW",
          linkUrl: "/settings/administration/map-locations"
        });
        sent += 1;
      }
    }

    // Stamp pricesReviewNotifiedAt on all listed tips
    await this.prisma.mapLocation.updateMany({
      where: { id: { in: unnotified.map((t) => t.id) } },
      data: { pricesReviewNotifiedAt: now }
    });

    return sent;
  }

  // ---- Private helpers -------------------------------------------------------

  private async resolveRecipients(
    recipientUserIds: string[],
    recipientRoles: string[]
  ): Promise<Array<{ id: string; email: string }>> {
    if (recipientUserIds.length > 0) {
      return this.prisma.user.findMany({
        where: { id: { in: recipientUserIds }, isActive: true },
        select: { id: true, email: true }
      });
    }
    if (recipientRoles.length > 0) {
      return this.prisma.user.findMany({
        where: {
          isActive: true,
          userRoles: { some: { role: { name: { in: recipientRoles } } } }
        },
        select: { id: true, email: true }
      });
    }
    return [];
  }

  private async resolveOrigin(
    originType: TipOriginType,
    projectId?: string,
    tenderId?: string
  ): Promise<{ originLat: number; originLng: number }> {
    if (originType === "office") {
      return { originLat: OFFICE_LAT, originLng: OFFICE_LNG };
    }

    if (originType === "tender") {
      if (!tenderId) {
        throw new BadRequestException('tenderId is required when originType = "tender".');
      }
      const tender = await this.prisma.tender.findUnique({
        where: { id: tenderId },
        select: { siteId: true }
      });
      if (!tender) {
        throw new NotFoundException(`Tender ${tenderId} not found.`);
      }
      const tenderSite = await this.prisma.site.findUnique({
        where: { id: tender.siteId },
        select: { centreLat: true, centreLng: true, addressLine1: true, suburb: true }
      });
      if (!tenderSite?.centreLat || !tenderSite?.centreLng) {
        throw new BadRequestException(
          `Tender site has no coordinates stored. ` +
            `Update the site coordinates in Settings > Map locations to enable distance calculation.`
        );
      }
      return {
        originLat: Number(tenderSite.centreLat),
        originLng: Number(tenderSite.centreLng)
      };
    }

    if (!projectId) {
      throw new BadRequestException('projectId is required when originType = "project".');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, siteId: true }
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found.`);
    }

    // Site lat/lng is stored on the Site record (centreLat/centreLng)
    const site = await this.prisma.site.findUnique({
      where: { id: project.siteId },
      select: { centreLat: true, centreLng: true, addressLine1: true, suburb: true }
    });

    if (!site?.centreLat || !site?.centreLng) {
      throw new BadRequestException(
        `Project site has no coordinates stored. ` +
          `Update the site coordinates in Master Data to enable distance calculation.`
      );
    }

    return {
      originLat: Number(site.centreLat),
      originLng: Number(site.centreLng)
    };
  }
}

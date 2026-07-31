/**
 * TipRecommendationsService
 *
 * Computes ranked tip recommendations for a given waste type + load size +
 * origin, and writes an append-only TipRecommendationLog row when an operator
 * accepts a recommendation ("use this facility").
 *
 * Service location is a contract — the next slice declares
 * `requires_file_on_main` against this exact path. Do not rename.
 *
 * Costing (v1):
 *   disposalFee = loadTonnes × resolvedRate  (via RateResolverService, "waste" slug)
 *   travelCost  = haversineKm × 2 × OperationsSettings.travelRatePerKm  (round trip)
 *   totalCost   = disposalFee + travelCost
 *
 * TIPs with no matching EstimateWasteRate row are returned greyed as
 * "not-accepted" with zero costs — the caller renders them separately.
 */

import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RateResolverService } from "../rates/rate-resolver.service";

// ── Office fallback coordinates (Initial Services — Grice St, Clontarf QLD) ──
// Used when the operator selects "office" as the origin rather than a project.
const OFFICE_LAT = -27.2495;
const OFFICE_LNG = 153.1053;

// ── Types ────────────────────────────────────────────────────────────────────

export type TipOriginType = "project" | "office";

export type ComputeRecommendationsDto = {
  /** Waste type code — must match a row in EstimateWasteRate.wasteType */
  wasteTypeCode: string;
  /** Load size in tonnes (positive non-zero) */
  loadTonnes: number;
  /** "project" → use the project site's stored coords; "office" → use OFFICE_LAT/LNG */
  originType: TipOriginType;
  /** Required when originType = "project" */
  projectId?: string;
};

export type AcceptRecommendationDto = {
  /** MapLocation.id of the accepted tip */
  mapLocationId: string;
  wasteTypeCode: string;
  loadTonnes: number;
  originType: TipOriginType;
  projectId?: string;
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
  /** null → no rate row exists for this tip × waste type */
  disposalFee: number | null;
  /** null when disposalFee is null */
  travelCost: number | null;
  totalCost: number | null;
  /** Per-tonne rate resolved for this facility × waste type */
  ratePerTonne: number | null;
  travelRatePerKm: number | null;
  accepted: boolean;
};

// ── Haversine ────────────────────────────────────────────────────────────────

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

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class TipRecommendationsService {
  private readonly logger = new Logger(TipRecommendationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rateResolver: RateResolverService
  ) {}

  /**
   * Compute ranked tip recommendations.
   *
   * Returns all active TIP MapLocations, each scored with:
   *   - disposal fee (resolved via RateResolverService "waste" slug)
   *   - travel cost (haversine × 2 × travelRatePerKm from OperationsSettings)
   *   - total cost
   *
   * TIPs with no matching rate row are included but marked accepted=false with
   * null costs so the UI can render them greyed as "not accepted / rates needed".
   *
   * Result is sorted: accepted tips by totalCost ascending, then unaccepted tips.
   */
  async computeRecommendations(dto: ComputeRecommendationsDto): Promise<TipRecommendationCard[]> {
    const { wasteTypeCode, loadTonnes, originType, projectId } = dto;

    if (loadTonnes <= 0) {
      throw new BadRequestException("loadTonnes must be greater than zero.");
    }

    // Resolve origin coordinates
    const { originLat, originLng } = await this.resolveOrigin(originType, projectId);

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
        // No coordinates — cannot compute distance; include greyed
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
          // No rate row for this tip × waste type — leave null
        }
      }

      if (ratePerTonne === null || travelRatePerKm === null) {
        // Missing rate or travel rate — cannot price
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
   * Accept a recommendation — writes a TipRecommendationLog row.
   * The row snapshots prices at decision time; it never recomputes.
   */
  async acceptRecommendation(
    dto: AcceptRecommendationDto,
    actorId: string
  ): Promise<{ logId: string }> {
    const { mapLocationId, wasteTypeCode, loadTonnes, originType, projectId } = dto;

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
        `TIP location "${tip.name}" has no coordinates — cannot compute travel cost.`
      );
    }

    // Verify project exists when originType = "project"
    if (originType === "project" && !projectId) {
      throw new BadRequestException('projectId is required when originType = "project".');
    }
    const { originLat, originLng } = await this.resolveOrigin(originType, projectId);

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

    // Resolve rate — must exist to accept
    if (!tip.facility) {
      throw new BadRequestException(
        `TIP location "${tip.name}" has no facility name — cannot resolve disposal rate.`
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

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async resolveOrigin(
    originType: TipOriginType,
    projectId?: string
  ): Promise<{ originLat: number; originLng: number }> {
    if (originType === "office") {
      return { originLat: OFFICE_LAT, originLng: OFFICE_LNG };
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

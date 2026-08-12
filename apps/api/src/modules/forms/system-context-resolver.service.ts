import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WeatherService } from "../platform/weather.service";
import type { WeatherResponse } from "../platform/weather.service";

/**
 * Asset reading snapshot for a single asset picked by the form filler.
 * Fields are null when the asset carries no recorded odometer/hour data.
 */
export type AssetReadingSnapshot = {
  assetId: string;
  assetCode: string;
  assetName: string;
  /** Latest odometer reading in kilometres, or null when not tracked. */
  currentKm: number | null;
  /** Latest engine-hours reading, or null when not tracked. */
  currentHours: number | null;
};

/** One competency expiry entry for the caller's worker profile. */
export type CompetencyExpiryEntry = {
  competencyId: string;
  competencyName: string;
  competencyCode: string | null;
  achievedAt: Date | null;
  expiresAt: Date | null;
  isExpired: boolean;
};

/** Minimal site attribute snapshot. */
export type SiteAttributeSnapshot = {
  siteId: string;
  name: string;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  centreLat: number | null;
  centreLng: number | null;
};

/**
 * Snapshot returned by resolveContext.
 *
 * Design (§5.3 "one batched call, not N"): a single server round-trip
 * collects all context data the rule engine may need at fill time.
 * The client caches this snapshot and evaluates conditions locally.
 * On submit, the server re-resolves fresh (never trusts the client copy
 * for BLOCK decisions).
 *
 * Weather is sourced from the PlatformModule WeatherService. If the
 * weather service is unavailable the key is null — context resolution
 * never throws.
 */
export type SystemContextSnapshot = {
  resolvedAt: string;
  /** Asset readings for every asset visible to the form filler. */
  assetReadings: AssetReadingSnapshot[];
  /** WorkerCompetency expiry state for the caller (empty when no worker profile exists). */
  competencies: CompetencyExpiryEntry[];
  /** Site attributes when siteId is known. */
  site: SiteAttributeSnapshot | null;
  /**
   * Weather for the site at resolve time.
   * null when no siteId was given, or the upstream service failed.
   */
  weather: WeatherResponse | null;
  /**
   * Total hours worked across the 7-day window ending now (inclusive).
   * Null when the actor has no worker profile or no timesheet rows.
   */
  timesheetHours7d: number | null;
  /** Filler's role from their WorkerProfile, or null when the profile is absent. */
  fillerRole: string | null;
};

/**
 * SystemContextResolverService — one batched call that pre-fetches all
 * system values the rule engine needs at form-fill time.
 *
 * Weather is delegated to WeatherService (PlatformModule). All other
 * reads are direct read-only Prisma queries against their owning tables.
 * No write operations are performed here.
 */
@Injectable()
export class SystemContextResolverService {
  private readonly logger = new Logger(SystemContextResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly weather: WeatherService
  ) {}

  /**
   * Resolve a full system-context snapshot for the given template + actor.
   *
   * @param templateId - used to scope asset list (any AVAILABLE asset is returned;
   *   pass for future template-level asset filtering)
   * @param actorId - internal User.id of the form filler
   * @param siteId - optional site; drives weather + site-attribute sections
   * @returns a snapshot covering assets, competencies, site, weather,
   *   7-day timesheet hours, and the filler's role
   */
  async resolveContext(
    templateId: string,
    actorId: string,
    siteId?: string | null
  ): Promise<SystemContextSnapshot> {
    const [assetReadings, competencies, site, timesheetHours7d, fillerRole, weatherResult] =
      await Promise.all([
        this.resolveAssetReadings(),
        this.resolveCompetencies(actorId),
        this.resolveSiteAttributes(siteId),
        this.resolveTimesheetHours(actorId),
        this.resolveFillerRole(actorId),
        this.resolveWeather(siteId)
      ]);

    // Suppress unused templateId lint — kept in signature for future scope.
    void templateId;

    return {
      resolvedAt: new Date().toISOString(),
      assetReadings,
      competencies,
      site,
      weather: weatherResult,
      timesheetHours7d,
      fillerRole
    };
  }

  // ── Private resolution helpers ──────────────────────────────────────────

  /**
   * Return a reading snapshot for every AVAILABLE asset.
   *
   * The current schema does not have dedicated odometer/hours columns on the
   * Asset or AssetMaintenanceEvent models (no currentKmReading / currentHours
   * fields). Both counters are returned as null until a future schema slice
   * adds usage-reading support. This is a best-effort snapshot — never throws.
   */
  private async resolveAssetReadings(): Promise<AssetReadingSnapshot[]> {
    try {
      const assets = await this.prisma.asset.findMany({
        where: { status: "AVAILABLE" },
        select: {
          id: true,
          assetCode: true,
          name: true
        },
        orderBy: { name: "asc" }
      });
      return assets.map((a) => ({
        assetId: a.id,
        assetCode: a.assetCode,
        assetName: a.name,
        // Schema does not carry usage-reading counters yet — null until
        // the AssetUsageReading slice lands.
        currentKm: null,
        currentHours: null
      }));
    } catch (err) {
      this.logger.warn(
        `resolveAssetReadings failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return [];
    }
  }

  /**
   * Return WorkerCompetency expiry entries for the caller.
   *
   * Uses the Worker → WorkerCompetency path (not WorkerProfile) because
   * WorkerCompetency is on Worker, not WorkerProfile. Returns empty array
   * when the actor has no Worker record (admin-only users, etc.).
   */
  private async resolveCompetencies(actorId: string): Promise<CompetencyExpiryEntry[]> {
    try {
      const worker = await this.prisma.worker.findFirst({
        where: { userId: actorId },
        select: {
          competencies: {
            select: {
              competencyId: true,
              achievedAt: true,
              expiresAt: true,
              competency: { select: { name: true, code: true } }
            }
          }
        }
      });
      if (!worker) return [];
      const now = new Date();
      return worker.competencies.map((wc) => ({
        competencyId: wc.competencyId,
        competencyName: wc.competency.name,
        competencyCode: wc.competency.code ?? null,
        achievedAt: wc.achievedAt ?? null,
        expiresAt: wc.expiresAt ?? null,
        isExpired: wc.expiresAt != null && new Date(wc.expiresAt) < now
      }));
    } catch (err) {
      this.logger.warn(
        `resolveCompetencies failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return [];
    }
  }

  private async resolveSiteAttributes(
    siteId: string | null | undefined
  ): Promise<SiteAttributeSnapshot | null> {
    if (!siteId) return null;
    try {
      const site = await this.prisma.site.findUnique({
        where: { id: siteId },
        select: {
          id: true,
          name: true,
          suburb: true,
          state: true,
          postcode: true,
          centreLat: true,
          centreLng: true
        }
      });
      if (!site) return null;
      return {
        siteId: site.id,
        name: site.name,
        suburb: site.suburb ?? null,
        state: site.state ?? null,
        postcode: site.postcode ?? null,
        centreLat: site.centreLat != null ? Number(site.centreLat) : null,
        centreLng: site.centreLng != null ? Number(site.centreLng) : null
      };
    } catch (err) {
      this.logger.warn(
        `resolveSiteAttributes failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }

  /**
   * Sum hoursWorked for the actor's timesheet rows in the 7-day window ending now.
   * Returns null when no worker profile exists or no rows fall in the window.
   */
  private async resolveTimesheetHours(actorId: string): Promise<number | null> {
    try {
      const workerProfile = await this.prisma.workerProfile.findUnique({
        where: { internalUserId: actorId },
        select: { id: true }
      });
      if (!workerProfile) return null;

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const agg = await this.prisma.timesheet.aggregate({
        where: {
          workerProfileId: workerProfile.id,
          date: { gte: since }
        },
        _sum: { hoursWorked: true }
      });
      const total = agg._sum.hoursWorked;
      return total != null ? Number(total) : null;
    } catch (err) {
      this.logger.warn(
        `resolveTimesheetHours failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }

  private async resolveFillerRole(actorId: string): Promise<string | null> {
    try {
      const profile = await this.prisma.workerProfile.findUnique({
        where: { internalUserId: actorId },
        select: { role: true }
      });
      return profile?.role ?? null;
    } catch (err) {
      this.logger.warn(
        `resolveFillerRole failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }

  private async resolveWeather(siteId: string | null | undefined): Promise<WeatherResponse | null> {
    if (!siteId) return null;
    try {
      const result = await this.weather.getSiteWeather(siteId);
      if (result.unavailable) return null;
      return result;
    } catch (err) {
      this.logger.warn(
        `resolveWeather failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }
}

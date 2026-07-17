import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ScheduleAllocationService } from "./schedule-allocation.service";
import type { ScheduleTargetType } from "./dto/schedule-allocation.dto";
import type { SchedulerSuggestQueryDto } from "./dto/suggestion.dto";

/**
 * §9 Scheduler — SUGGEST engine (D365 Field Service RSO parity, phase 1).
 *
 * Given an open slot (date + project + optional jobRole), return a ranked
 * shortlist of workers (or assets) that fit, each with an explainable score
 * (roleFit + availability + proximity) and machine-code reasons.
 *
 * ASSISTIVE only: the planner still picks. No allocation is created here.
 * Phase 2 (auto-assign) is a separate flow behind its own flag; do NOT
 * introduce mutation paths in this service.
 *
 * Scoring is intentionally simple + explainable — every point is traceable
 * to a reason string so the UI can render "why this person".
 *
 *   roleFit      0..40   competency requirements for the jobRole
 *   availability 0..30   no leave / unavailability / double-book on the date
 *   proximity    0..30   distance from project site to worker's recent site
 *                        (neutral 15 when either coord is unknown)
 *   ────────────────
 *   TOTAL        0..100
 *
 * The reason list is stable for machine parsing (`roleFit:met`,
 * `availability:free`, `proximity:km=22:recent=2026-07-15`) and human-friendly
 * enough that the UI can render it verbatim as a tooltip.
 */

const PROXIMITY_LOOKBACK_DAYS = 30;

const ROLE_FIT_MAX = 40;
const AVAILABILITY_MAX = 30;
const PROXIMITY_MAX = 30;
const PROXIMITY_NEUTRAL = 15;

export type SuggestionBreakdown = {
  roleFit: number;
  availability: number;
  proximity: number;
};

export type WorkerSuggestion = {
  targetType: "WORKER";
  worker: { id: string; firstName: string; lastName: string; role: string | null };
  score: number;
  eligible: boolean;
  reasons: string[];
  breakdown: SuggestionBreakdown;
};

export type AssetSuggestion = {
  targetType: "ASSET";
  asset: { id: string; name: string; assetCode: string };
  score: number;
  eligible: boolean;
  reasons: string[];
  breakdown: SuggestionBreakdown;
};

export type Suggestion = WorkerSuggestion | AssetSuggestion;

function dayUtc(input: string | Date): Date {
  const d = typeof input === "string" ? new Date(input) : input;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Great-circle distance in kilometres (Haversine). */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Map a distance to a proximity score band + reason code. */
export function proximityScoreForKm(km: number, recentDate: string): {
  score: number;
  reason: string;
} {
  if (km <= 15) return { score: PROXIMITY_MAX, reason: `proximity:km=${km.toFixed(0)}:recent=${recentDate}` };
  if (km <= 40) return { score: 20, reason: `proximity:km=${km.toFixed(0)}:recent=${recentDate}` };
  if (km <= 100) return { score: 10, reason: `proximity:km=${km.toFixed(0)}:recent=${recentDate}` };
  return { score: 5, reason: `proximity:km=${km.toFixed(0)}:recent=${recentDate}` };
}

@Injectable()
export class SchedulerSuggestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly allocations: ScheduleAllocationService
  ) {}

  async suggestAllocation(query: SchedulerSuggestQueryDto): Promise<{ suggestions: Suggestion[] }> {
    const day = dayUtc(query.date);
    const targetType: ScheduleTargetType = query.targetType ?? "WORKER";
    const limit = query.limit ?? 5;

    const project = await this.prisma.project.findUnique({
      where: { id: query.projectId },
      select: {
        id: true,
        projectNumber: true,
        name: true,
        site: { select: { id: true, centreLat: true, centreLng: true } }
      }
    });
    if (!project) throw new NotFoundException("Project not found.");

    if (query.jobRoleId) {
      const role = await this.prisma.jobRole.findUnique({
        where: { id: query.jobRoleId },
        select: { id: true }
      });
      if (!role) throw new NotFoundException("Job role not found.");
    }

    const projectCoord = this.projectCoord(project.site);

    if (targetType === "WORKER") {
      const suggestions = await this.suggestWorkers(query, day, projectCoord, limit);
      return { suggestions };
    }

    const suggestions = await this.suggestAssets(query, day, limit);
    return { suggestions };
  }

  private projectCoord(
    site: { centreLat: unknown; centreLng: unknown } | null
  ): { lat: number; lng: number } | null {
    if (!site) return null;
    const lat = toNumber(site.centreLat);
    const lng = toNumber(site.centreLng);
    if (lat === null || lng === null) return null;
    return { lat, lng };
  }

  private async suggestWorkers(
    query: SchedulerSuggestQueryDto,
    day: Date,
    projectCoord: { lat: number; lng: number } | null,
    limit: number
  ): Promise<WorkerSuggestion[]> {
    const workers = await this.prisma.workerProfile.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, role: true }
    });

    const proximityLookbackStart = new Date(
      day.getTime() - PROXIMITY_LOOKBACK_DAYS * 86_400_000
    );

    const scored = await Promise.all(
      workers.map(async (w) => {
        const verdict = await this.allocations.computeEligibility(
          w.id,
          query.jobRoleId,
          day,
          query.projectId
        );

        const roleFit = this.scoreRoleFit(verdict.reasons);
        const availability = this.scoreAvailability(verdict.reasons);
        const proximity = await this.scoreWorkerProximity(
          w.id,
          projectCoord,
          proximityLookbackStart,
          day
        );

        const reasons: string[] = [];
        reasons.push(roleFit.reason);
        reasons.push(availability.reason);
        reasons.push(proximity.reason);
        for (const r of verdict.reasons) reasons.push(`blocker:${r}`);

        const score = roleFit.score + availability.score + proximity.score;
        const suggestion: WorkerSuggestion = {
          targetType: "WORKER",
          worker: w,
          score,
          eligible: verdict.eligible,
          reasons,
          breakdown: {
            roleFit: roleFit.score,
            availability: availability.score,
            proximity: proximity.score
          }
        };
        return suggestion;
      })
    );

    const eligible = scored.filter((s) => s.eligible);
    const ineligible = scored.filter((s) => !s.eligible);

    const sortDesc = (a: Suggestion, b: Suggestion) =>
      b.score - a.score ||
      ("worker" in a && "worker" in b
        ? a.worker.lastName.localeCompare(b.worker.lastName)
        : 0);

    eligible.sort(sortDesc);
    ineligible.sort(sortDesc);

    const combined = query.includeIneligible ? [...eligible, ...ineligible] : eligible;
    return combined.slice(0, limit);
  }

  private async suggestAssets(
    query: SchedulerSuggestQueryDto,
    day: Date,
    limit: number
  ): Promise<AssetSuggestion[]> {
    const assets = await this.prisma.asset.findMany({
      where: { status: "AVAILABLE" },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, assetCode: true }
    });

    const taken = await this.prisma.scheduleAllocation.findMany({
      where: { date: day, assetId: { in: assets.map((a) => a.id) } },
      select: { assetId: true, projectId: true }
    });
    const takenIds = new Set(
      taken
        .filter((t) => t.projectId !== query.projectId)
        .map((t) => t.assetId!)
        .filter((id): id is string => Boolean(id))
    );

    const suggestions: AssetSuggestion[] = assets.map((a) => {
      const isTaken = takenIds.has(a.id);
      const eligible = !isTaken;
      const availability = isTaken ? 0 : AVAILABILITY_MAX;
      const reasons: string[] = [];
      reasons.push("roleFit:asset_role_agnostic");
      reasons.push(isTaken ? "availability:double_booked" : "availability:free");
      reasons.push("proximity:asset_home_base_unmapped");
      if (isTaken) reasons.push("blocker:double_booked");
      const score = availability + PROXIMITY_NEUTRAL;
      return {
        targetType: "ASSET",
        asset: a,
        score,
        eligible,
        reasons,
        breakdown: { roleFit: 0, availability, proximity: PROXIMITY_NEUTRAL }
      };
    });

    suggestions.sort(
      (a, b) => b.score - a.score || a.asset.name.localeCompare(b.asset.name)
    );

    const filtered = query.includeIneligible ? suggestions : suggestions.filter((s) => s.eligible);
    return filtered.slice(0, limit);
  }

  private scoreRoleFit(reasons: string[]): { score: number; reason: string } {
    const missing = reasons.filter((r) => r.startsWith("missing:") || r.startsWith("expired:"));
    if (missing.length === 0) return { score: ROLE_FIT_MAX, reason: "roleFit:met" };
    return { score: 0, reason: `roleFit:blocked:${missing.join(",")}` };
  }

  private scoreAvailability(reasons: string[]): { score: number; reason: string } {
    const conflicts = reasons.filter(
      (r) => r.startsWith("on_leave") || r.startsWith("unavailable") || r.startsWith("double_booked")
    );
    if (conflicts.length === 0) return { score: AVAILABILITY_MAX, reason: "availability:free" };
    return { score: 0, reason: `availability:blocked:${conflicts.join(",")}` };
  }

  private async scoreWorkerProximity(
    workerProfileId: string,
    projectCoord: { lat: number; lng: number } | null,
    lookbackStart: Date,
    day: Date
  ): Promise<{ score: number; reason: string }> {
    if (!projectCoord) {
      return { score: PROXIMITY_NEUTRAL, reason: "proximity:project_no_coords" };
    }

    const recent = await this.prisma.scheduleAllocation.findMany({
      where: {
        workerProfileId,
        date: { gte: lookbackStart, lte: day }
      },
      orderBy: { date: "desc" },
      take: 8,
      select: {
        date: true,
        project: {
          select: {
            projectNumber: true,
            site: { select: { centreLat: true, centreLng: true } }
          }
        }
      }
    });

    for (const cell of recent) {
      const c = this.projectCoord(cell.project?.site ?? null);
      if (!c) continue;
      const km = haversineKm(projectCoord, c);
      if (!Number.isFinite(km)) continue;
      return proximityScoreForKm(km, cell.date.toISOString().slice(0, 10));
    }

    return { score: PROXIMITY_NEUTRAL, reason: "proximity:no_recent_history" };
  }
}


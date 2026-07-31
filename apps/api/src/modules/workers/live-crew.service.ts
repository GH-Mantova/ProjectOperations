import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

// ERP live crew map — a worker is "on the clock" when their most recent
// timesheet has clockOnTime set but clockOffTime is still null.
//
// Location doctrine (GPS-A2):
// Tracking runs ONLY while the worker is on the clock AND the field app is
// open in the foreground. Points come from two sources — the mandatory
// clock-on pin (captured server-side in FieldService) and periodic
// breadcrumbs POSTed by the field app while the tab is visible. There is NO
// background/native/service-worker tracking; when the tab is hidden or the
// worker clocks off, sampling stops dead. Live-crew rows surface the LATEST
// of clock-on pin vs newest breadcrumb, so dispatch sees the freshest
// foreground position without any implication of continuous tracking.
export type WhosWorkingRow = {
  workerProfileId: string;
  workerName: string;
  role: string;
  projectId: string;
  projectName: string;
  projectNumber: string;
  clockOnTime: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  lastFixAt: string | null;
  lastFixSource: "clock_on" | "breadcrumb" | null;
};

export type NearestWorkerResult = {
  workerProfileId: string;
  workerName: string;
  role: string;
  projectId: string;
  projectName: string;
  distanceKm: number;
  lat: number;
  lng: number;
};

export type TrailPoint = {
  lat: number;
  lng: number;
  accuracy: number | null;
  recordedAt: string;
  source: "clock_on" | "breadcrumb";
};

export type TrailResponse = {
  workerProfileId: string;
  timesheetId: string;
  clockOnTime: string;
  points: TrailPoint[];
};

@Injectable()
export class LiveCrewService {
  constructor(private readonly prisma: PrismaService) {}

  // "Currently on the clock" — timesheets with clockOnTime set and
  // clockOffTime null. Returns worker + freshest known GPS + project.
  // Freshest = latest of the clock-on pin vs the newest breadcrumb for the
  // same open shift. Ordered by longest on-clock first so dispatch can see
  // who has been out the longest without a clock-off.
  async whosWorking(): Promise<WhosWorkingRow[]> {
    const rows = await this.prisma.timesheet.findMany({
      where: { clockOnTime: { not: null }, clockOffTime: null },
      orderBy: { clockOnTime: "asc" },
      include: {
        workerProfile: { select: { id: true, firstName: true, lastName: true, role: true } },
        project: { select: { id: true, name: true, projectNumber: true } }
      }
    });

    const openTimesheetIds = rows.map((r) => r.id);
    const latestBreadcrumbByTimesheet = new Map<
      string,
      { latitude: unknown; longitude: unknown; accuracy: unknown; recordedAt: Date }
    >();
    if (openTimesheetIds.length > 0) {
      const breadcrumbs = await this.prisma.workerLocationLog.findMany({
        where: { timesheetId: { in: openTimesheetIds }, eventType: "breadcrumb" },
        orderBy: { recordedAt: "desc" },
        select: {
          timesheetId: true,
          latitude: true,
          longitude: true,
          accuracy: true,
          recordedAt: true
        }
      });
      for (const b of breadcrumbs) {
        if (b.timesheetId && !latestBreadcrumbByTimesheet.has(b.timesheetId)) {
          latestBreadcrumbByTimesheet.set(b.timesheetId, {
            latitude: b.latitude,
            longitude: b.longitude,
            accuracy: b.accuracy,
            recordedAt: b.recordedAt
          });
        }
      }
    }

    return rows.map((r) => {
      const clockOnLat = r.clockOnLat === null ? null : Number(r.clockOnLat);
      const clockOnLng = r.clockOnLng === null ? null : Number(r.clockOnLng);
      const clockOnAcc = r.clockOnAccuracy === null ? null : Number(r.clockOnAccuracy);
      const crumb = latestBreadcrumbByTimesheet.get(r.id);
      const clockOnAt = r.clockOnTime as Date;

      // Prefer the breadcrumb only when it's actually newer than the clock-on
      // pin and both lat/lng are present. Otherwise fall back to the pin.
      let lat: number | null = clockOnLat;
      let lng: number | null = clockOnLng;
      let accuracy: number | null = clockOnAcc;
      let lastFixAt: Date | null = clockOnLat !== null && clockOnLng !== null ? clockOnAt : null;
      let lastFixSource: "clock_on" | "breadcrumb" | null =
        clockOnLat !== null && clockOnLng !== null ? "clock_on" : null;

      if (crumb && crumb.recordedAt.getTime() > clockOnAt.getTime()) {
        lat = Number(crumb.latitude);
        lng = Number(crumb.longitude);
        accuracy = crumb.accuracy === null ? null : Number(crumb.accuracy);
        lastFixAt = crumb.recordedAt;
        lastFixSource = "breadcrumb";
      }

      return {
        workerProfileId: r.workerProfile.id,
        workerName: `${r.workerProfile.firstName} ${r.workerProfile.lastName}`.trim(),
        role: r.workerProfile.role,
        projectId: r.project.id,
        projectName: r.project.name,
        projectNumber: r.project.projectNumber,
        clockOnTime: clockOnAt.toISOString(),
        lat,
        lng,
        accuracy,
        lastFixAt: lastFixAt ? lastFixAt.toISOString() : null,
        lastFixSource
      };
    });
  }

  // Nearest available worker to a point — reactive dispatch helper. Only
  // considers on-clock workers with a known GPS point. Distances are
  // straight-line (Haversine, km) since we have no routing service.
  async nearestWorker(lat: number, lng: number, limit = 5): Promise<NearestWorkerResult[]> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException("lat and lng must be finite numbers.");
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new BadRequestException("lat/lng out of range.");
    }
    const cap = Math.min(20, Math.max(1, Math.trunc(limit) || 5));
    const on = await this.whosWorking();
    const withGps = on.filter((r): r is WhosWorkingRow & { lat: number; lng: number } => r.lat !== null && r.lng !== null);
    return withGps
      .map((r) => ({
        workerProfileId: r.workerProfileId,
        workerName: r.workerName,
        role: r.role,
        projectId: r.projectId,
        projectName: r.projectName,
        distanceKm: haversineKm(lat, lng, r.lat, r.lng),
        lat: r.lat,
        lng: r.lng
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, cap);
  }

  // GPS-A2: ordered trail of clock-on pin + breadcrumbs for a worker's
  // currently-open shift. Returns the pin as the first point (when GPS was
  // captured at clock-on) followed by breadcrumbs oldest-first. Access:
  // callers holding scheduler.view see any worker's trail; a worker can
  // fetch their own without that permission (checked in the controller via
  // the resolveSelfWorkerProfileId helper).
  async getTrail(
    workerProfileId: string,
    actor: { userId: string; permissions: Set<string> }
  ): Promise<TrailResponse | null> {
    const isDispatcher = actor.permissions.has("scheduler.view");
    if (!isDispatcher) {
      const self = await this.prisma.workerProfile.findUnique({
        where: { internalUserId: actor.userId },
        select: { id: true }
      });
      if (!self || self.id !== workerProfileId) {
        throw new ForbiddenException(
          "You may only view your own breadcrumb trail unless you have scheduler.view."
        );
      }
    }

    const open = await this.prisma.timesheet.findFirst({
      where: {
        workerProfileId,
        clockOnTime: { not: null },
        clockOffTime: null
      },
      orderBy: { clockOnTime: "desc" },
      select: {
        id: true,
        clockOnTime: true,
        clockOnLat: true,
        clockOnLng: true,
        clockOnAccuracy: true
      }
    });
    if (!open) return null;

    const breadcrumbs = await this.prisma.workerLocationLog.findMany({
      where: { timesheetId: open.id, eventType: "breadcrumb" },
      orderBy: { recordedAt: "asc" },
      select: { latitude: true, longitude: true, accuracy: true, recordedAt: true }
    });

    const points: TrailPoint[] = [];
    if (open.clockOnLat !== null && open.clockOnLng !== null && open.clockOnTime) {
      points.push({
        lat: Number(open.clockOnLat),
        lng: Number(open.clockOnLng),
        accuracy: open.clockOnAccuracy === null ? null : Number(open.clockOnAccuracy),
        recordedAt: (open.clockOnTime as Date).toISOString(),
        source: "clock_on"
      });
    }
    for (const b of breadcrumbs) {
      points.push({
        lat: Number(b.latitude),
        lng: Number(b.longitude),
        accuracy: b.accuracy === null ? null : Number(b.accuracy),
        recordedAt: b.recordedAt.toISOString(),
        source: "breadcrumb"
      });
    }

    return {
      workerProfileId,
      timesheetId: open.id,
      clockOnTime: (open.clockOnTime as Date).toISOString(),
      points
    };
  }
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

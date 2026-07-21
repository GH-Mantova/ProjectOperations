import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

// ERP live crew map — a worker is "on the clock" when their most recent
// timesheet has clockOnTime set but clockOffTime is still null. We surface
// only the last clock-on GPS point (already captured for geofence audit) —
// we do NOT introduce continuous background tracking (privacy).
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

@Injectable()
export class LiveCrewService {
  constructor(private readonly prisma: PrismaService) {}

  // "Currently on the clock" — timesheets with clockOnTime set and
  // clockOffTime null. Returns worker + last known GPS + project. Ordered
  // by longest on-clock first so dispatch can see who has been out the
  // longest without a clock-off (potential forgotten clock-off).
  async whosWorking(): Promise<WhosWorkingRow[]> {
    const rows = await this.prisma.timesheet.findMany({
      where: { clockOnTime: { not: null }, clockOffTime: null },
      orderBy: { clockOnTime: "asc" },
      include: {
        workerProfile: { select: { id: true, firstName: true, lastName: true, role: true } },
        project: { select: { id: true, name: true, projectNumber: true } }
      }
    });
    return rows.map((r) => ({
      workerProfileId: r.workerProfile.id,
      workerName: `${r.workerProfile.firstName} ${r.workerProfile.lastName}`.trim(),
      role: r.workerProfile.role,
      projectId: r.project.id,
      projectName: r.project.name,
      projectNumber: r.project.projectNumber,
      clockOnTime: (r.clockOnTime as Date).toISOString(),
      lat: r.clockOnLat === null ? null : Number(r.clockOnLat),
      lng: r.clockOnLng === null ? null : Number(r.clockOnLng),
      accuracy: r.clockOnAccuracy === null ? null : Number(r.clockOnAccuracy)
    }));
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

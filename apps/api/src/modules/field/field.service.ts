import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../platform/notifications.service";
import {
  BulkApproveTimesheetsDto,
  CreatePreStartDto,
  CreateSiteGeofenceDto,
  CreateTimesheetDto,
  FieldListQueryDto,
  GeofenceLookupQueryDto,
  ListSiteGeofencesQueryDto,
  ManageTimesheetQueryDto,
  PayrollExportQueryDto,
  RejectTimesheetDto,
  TimesheetSummaryQueryDto,
  UpdatePreStartDto,
  UpdateSiteGeofenceDto,
  UpdateTimesheetDto
} from "./dto/field.dto";
import {
  formatIsoDate,
  renderPayrollCsv,
  truncateNotes,
  type PayrollCsvRow
} from "./payroll-csv.helpers";

type ActorContext = { userId: string; permissions: Set<string> };

function startOfDay(input: string | Date): Date {
  const d = new Date(input);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function formatDateDdMmmYyyy(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

@Injectable()
export class FieldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  private async resolveWorkerProfile(userId: string) {
    const worker = await this.prisma.workerProfile.findUnique({ where: { internalUserId: userId } });
    if (!worker) {
      throw new ForbiddenException(
        "No worker profile is linked to your account. Ask your office to provision mobile access."
      );
    }
    return worker;
  }

  // Worker self-service: opt in/out of GPS clock-on. Setting consent=false on
  // an existing profile does not delete prior location data — that's a
  // separate admin action — but stops new GPS captures immediately.
  async setLocationConsent(actor: ActorContext, consent: boolean) {
    const worker = await this.resolveWorkerProfile(actor.userId);
    const now = new Date();
    return this.prisma.workerProfile.update({
      where: { id: worker.id },
      data: {
        locationConsent: consent,
        // Preserve the most recent grant + most recent revocation separately
        // so the audit trail survives toggling. We only update the side that
        // matches the new state.
        locationConsentAt: consent ? now : worker.locationConsentAt,
        locationConsentRevokedAt: consent ? worker.locationConsentRevokedAt : now
      },
      select: {
        id: true,
        locationConsent: true,
        locationConsentAt: true,
        locationConsentRevokedAt: true
      }
    });
  }

  async getLocationConsent(actor: ActorContext) {
    const worker = await this.resolveWorkerProfile(actor.userId);
    return {
      workerProfileId: worker.id,
      locationConsent: worker.locationConsent,
      locationConsentAt: worker.locationConsentAt,
      locationConsentRevokedAt: worker.locationConsentRevokedAt
    };
  }

  private async recordLocationLogs(
    workerProfileId: string,
    timesheetId: string,
    dto: {
      clockOnLat?: number;
      clockOnLng?: number;
      clockOnAccuracy?: number;
      clockOffLat?: number;
      clockOffLng?: number;
      clockOffAccuracy?: number;
    }
  ) {
    const rows: Prisma.WorkerLocationLogCreateManyInput[] = [];

    // Dedupe: skip writing if a row of the same eventType for this timesheet
    // was already written in the last 60s. Stops repeated PATCHes from
    // spamming the location_logs table.
    const cutoff = new Date(Date.now() - 60_000);
    const recent = await this.prisma.workerLocationLog.findMany({
      where: {
        timesheetId,
        recordedAt: { gte: cutoff }
      },
      select: { eventType: true }
    });
    const recentEvents = new Set(recent.map((r) => r.eventType));

    if (
      dto.clockOnLat !== undefined &&
      dto.clockOnLng !== undefined &&
      !recentEvents.has("clock_on")
    ) {
      rows.push({
        workerProfileId,
        timesheetId,
        eventType: "clock_on",
        latitude: new Prisma.Decimal(dto.clockOnLat),
        longitude: new Prisma.Decimal(dto.clockOnLng),
        accuracy: dto.clockOnAccuracy !== undefined ? new Prisma.Decimal(dto.clockOnAccuracy) : null
      });
    }
    if (
      dto.clockOffLat !== undefined &&
      dto.clockOffLng !== undefined &&
      !recentEvents.has("clock_off")
    ) {
      rows.push({
        workerProfileId,
        timesheetId,
        eventType: "clock_off",
        latitude: new Prisma.Decimal(dto.clockOffLat),
        longitude: new Prisma.Decimal(dto.clockOffLng),
        accuracy:
          dto.clockOffAccuracy !== undefined ? new Prisma.Decimal(dto.clockOffAccuracy) : null
      });
    }
    if (rows.length > 0) {
      await this.prisma.workerLocationLog.createMany({ data: rows });
    }
  }

  // ── ERP gap C — geofence evaluation ───────────────────────────────────
  // Distance in metres between two lat/lng points using the Haversine
  // formula. Good enough for site-scale geofences (radius up to a few km);
  // we don't need geodesic ellipsoid corrections at this range.
  private haversineMetres(aLat: number, aLng: number, bLat: number, bLng: number): number {
    const R = 6_371_000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLng / 2);
    const h = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // Resolve the geofence a lat/lng falls inside for the site attached to
  // this project. Returns null if the project has no site, the site has
  // no active geofences, or the point is outside every active geofence.
  // When multiple geofences overlap, the closest centre wins.
  private async resolveGeofenceForProject(
    projectId: string,
    lat: number,
    lng: number
  ): Promise<{ id: string; distanceMetres: number } | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { siteId: true }
    });
    if (!project?.siteId) return null;
    const fences = await this.prisma.siteGeofence.findMany({
      where: { siteId: project.siteId, isActive: true },
      select: { id: true, centreLat: true, centreLng: true, radiusMetres: true }
    });
    let best: { id: string; distanceMetres: number } | null = null;
    for (const f of fences) {
      const d = this.haversineMetres(lat, lng, Number(f.centreLat), Number(f.centreLng));
      if (d <= f.radiusMetres && (best === null || d < best.distanceMetres)) {
        best = { id: f.id, distanceMetres: d };
      }
    }
    return best;
  }

  private async evaluateGeofenceForTimesheet(
    projectId: string,
    lat: number | undefined,
    lng: number | undefined
  ): Promise<{ inGeofence: boolean | null; geofenceId: string | null }> {
    if (lat === undefined || lng === undefined) return { inGeofence: null, geofenceId: null };
    const hit = await this.resolveGeofenceForProject(projectId, lat, lng);
    if (hit) return { inGeofence: true, geofenceId: hit.id };
    // A point was submitted but no active fence contains it. Only flag
    // "outside" when the site actually has at least one active geofence
    // configured — otherwise the concept doesn't apply and the flag stays
    // null.
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { siteId: true }
    });
    if (!project?.siteId) return { inGeofence: null, geofenceId: null };
    const count = await this.prisma.siteGeofence.count({
      where: { siteId: project.siteId, isActive: true }
    });
    return { inGeofence: count > 0 ? false : null, geofenceId: null };
  }

  // Field-app helper: given a live position, return the worker's active
  // allocations whose project sits inside a geofence covering that point.
  // Used to auto-select the correct job on clock-in.
  async lookupAllocationsAtPosition(actor: ActorContext, query: GeofenceLookupQueryDto) {
    const worker = await this.resolveWorkerProfile(actor.userId);
    const today = startOfDay(new Date());
    const allocations = await this.prisma.projectAllocation.findMany({
      where: {
        workerProfileId: worker.id,
        type: "WORKER",
        project: { status: { in: ["MOBILISING", "ACTIVE"] } },
        OR: [{ endDate: null }, { endDate: { gte: today } }]
      },
      include: {
        project: {
          select: { id: true, projectNumber: true, name: true, siteId: true, site: { select: { id: true, name: true } } }
        }
      }
    });

    const siteIds = Array.from(
      new Set(allocations.map((a) => a.project.siteId).filter((s): s is string => Boolean(s)))
    );
    if (siteIds.length === 0) return { matches: [] };

    const fences = await this.prisma.siteGeofence.findMany({
      where: { siteId: { in: siteIds }, isActive: true },
      select: {
        id: true,
        siteId: true,
        name: true,
        centreLat: true,
        centreLng: true,
        radiusMetres: true
      }
    });

    const hitsBySite = new Map<string, { id: string; name: string; distanceMetres: number }>();
    for (const f of fences) {
      const d = this.haversineMetres(query.lat, query.lng, Number(f.centreLat), Number(f.centreLng));
      if (d <= f.radiusMetres) {
        const current = hitsBySite.get(f.siteId);
        if (!current || d < current.distanceMetres) {
          hitsBySite.set(f.siteId, { id: f.id, name: f.name, distanceMetres: d });
        }
      }
    }

    const matches = allocations
      .filter((a) => a.project.siteId && hitsBySite.has(a.project.siteId))
      .map((a) => {
        const hit = hitsBySite.get(a.project.siteId as string)!;
        return {
          allocationId: a.id,
          projectId: a.project.id,
          projectNumber: a.project.projectNumber,
          projectName: a.project.name,
          siteId: a.project.siteId,
          siteName: a.project.site?.name ?? null,
          geofence: {
            id: hit.id,
            name: hit.name,
            distanceMetres: Math.round(hit.distanceMetres)
          }
        };
      })
      .sort((a, b) => a.geofence.distanceMetres - b.geofence.distanceMetres);

    return { matches };
  }

  // ── Admin CRUD for SiteGeofence ───────────────────────────────────────
  async listSiteGeofences(query: ListSiteGeofencesQueryDto) {
    const where: Prisma.SiteGeofenceWhereInput = {};
    if (query.siteId) where.siteId = query.siteId;
    if (query.activeOnly) where.isActive = true;
    const rows = await this.prisma.siteGeofence.findMany({
      where,
      orderBy: [{ site: { name: "asc" } }, { name: "asc" }],
      include: { site: { select: { id: true, name: true, code: true } } }
    });
    return rows.map((r) => ({
      id: r.id,
      siteId: r.siteId,
      siteName: r.site.name,
      siteCode: r.site.code,
      name: r.name,
      centreLat: r.centreLat.toString(),
      centreLng: r.centreLng.toString(),
      radiusMetres: r.radiusMetres,
      isActive: r.isActive,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
  }

  async createSiteGeofence(dto: CreateSiteGeofenceDto) {
    const site = await this.prisma.site.findUnique({ where: { id: dto.siteId } });
    if (!site) throw new NotFoundException("Site not found.");
    return this.prisma.siteGeofence.create({
      data: {
        siteId: dto.siteId,
        name: dto.name,
        centreLat: new Prisma.Decimal(dto.centreLat),
        centreLng: new Prisma.Decimal(dto.centreLng),
        radiusMetres: dto.radiusMetres,
        isActive: dto.isActive ?? true,
        notes: dto.notes ?? null
      }
    });
  }

  async updateSiteGeofence(id: string, dto: UpdateSiteGeofenceDto) {
    const existing = await this.prisma.siteGeofence.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Geofence not found.");
    return this.prisma.siteGeofence.update({
      where: { id },
      data: {
        name: dto.name,
        centreLat: dto.centreLat !== undefined ? new Prisma.Decimal(dto.centreLat) : undefined,
        centreLng: dto.centreLng !== undefined ? new Prisma.Decimal(dto.centreLng) : undefined,
        radiusMetres: dto.radiusMetres,
        isActive: dto.isActive,
        notes: dto.notes
      }
    });
  }

  async deleteSiteGeofence(id: string) {
    const existing = await this.prisma.siteGeofence.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Geofence not found.");
    await this.prisma.siteGeofence.delete({ where: { id } });
    return { deleted: true };
  }

  async myAllocations(actor: ActorContext) {
    const worker = await this.resolveWorkerProfile(actor.userId);
    const today = startOfDay(new Date());
    const allocations = await this.prisma.projectAllocation.findMany({
      where: {
        workerProfileId: worker.id,
        type: "WORKER",
        project: { status: { in: ["MOBILISING", "ACTIVE"] } },
        OR: [{ endDate: null }, { endDate: { gte: today } }]
      },
      orderBy: { startDate: "asc" },
      include: {
        project: {
          select: {
            id: true,
            projectNumber: true,
            name: true,
            status: true,
            siteAddressLine1: true,
            siteAddressLine2: true,
            siteAddressSuburb: true,
            siteAddressState: true,
            siteAddressPostcode: true,
            projectManager: { select: { id: true, firstName: true, lastName: true } },
            scopeItems: { select: { scopeCode: true } }
          }
        }
      }
    });

    const pmIds = Array.from(
      new Set(allocations.map((a) => a.project.projectManager?.id).filter(Boolean) as string[])
    );
    const pmWorkers = pmIds.length
      ? await this.prisma.workerProfile.findMany({
          where: { internalUserId: { in: pmIds } },
          select: { internalUserId: true, phone: true }
        })
      : [];
    const pmPhoneByUserId = new Map<string, string | null>(
      pmWorkers.map((w) => [w.internalUserId!, w.phone])
    );

    return allocations.map((a) => ({
      id: a.id,
      projectId: a.project.id,
      projectNumber: a.project.projectNumber,
      projectName: a.project.name,
      projectStatus: a.project.status,
      siteAddress: {
        line1: a.project.siteAddressLine1,
        line2: a.project.siteAddressLine2,
        suburb: a.project.siteAddressSuburb,
        state: a.project.siteAddressState,
        postcode: a.project.siteAddressPostcode
      },
      roleOnProject: a.roleOnProject,
      startDate: a.startDate,
      endDate: a.endDate,
      scopeCodes: Array.from(new Set(a.project.scopeItems.map((s) => s.scopeCode))),
      projectManager: a.project.projectManager
        ? {
            id: a.project.projectManager.id,
            name: `${a.project.projectManager.firstName} ${a.project.projectManager.lastName}`,
            phone: pmPhoneByUserId.get(a.project.projectManager.id) ?? null
          }
        : null
    }));
  }

  async documentsForAllocation(allocationId: string, actor: ActorContext) {
    const worker = await this.resolveWorkerProfile(actor.userId);
    const allocation = await this.prisma.projectAllocation.findUnique({ where: { id: allocationId } });
    if (!allocation || allocation.workerProfileId !== worker.id) {
      if (!actor.permissions.has("field.manage")) {
        throw new NotFoundException("Allocation not found.");
      }
    }
    if (!allocation) throw new NotFoundException("Allocation not found.");

    const docs = await this.prisma.tenderDocumentLink.findMany({
      where: { projectId: allocation.projectId },
      orderBy: { createdAt: "desc" },
      include: { fileLink: true }
    });
    return docs.map((d) => ({
      id: d.id,
      name: d.title,
      category: d.category,
      fileUrl: d.fileLink?.webUrl ?? null,
      fileType: d.fileLink?.mimeType ?? null,
      uploadedAt: d.createdAt
    }));
  }

  // ── Pre-start checklists ──────────────────────────────────────────────
  async listPreStarts(query: FieldListQueryDto, actor: ActorContext) {
    const worker = await this.resolveWorkerProfile(actor.userId);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const skip = (page - 1) * limit;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.preStartChecklist.count({ where: { workerProfileId: worker.id } }),
      this.prisma.preStartChecklist.findMany({
        where: { workerProfileId: worker.id },
        orderBy: { date: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          date: true,
          status: true,
          project: { select: { projectNumber: true, name: true } }
        }
      })
    ]);

    return {
      items: items.map((i) => ({
        id: i.id,
        date: i.date,
        status: i.status,
        projectNumber: i.project.projectNumber,
        projectName: i.project.name
      })),
      total,
      page,
      limit
    };
  }

  async createPreStart(dto: CreatePreStartDto, actor: ActorContext) {
    const worker = await this.resolveWorkerProfile(actor.userId);
    const allocation = await this.prisma.projectAllocation.findUnique({ where: { id: dto.allocationId } });
    if (!allocation || allocation.workerProfileId !== worker.id) {
      throw new ForbiddenException("You cannot start a pre-start on an allocation that is not yours.");
    }

    const date = startOfDay(dto.date);
    const existing = await this.prisma.preStartChecklist.findUnique({
      where: {
        workerProfileId_allocationId_date: {
          workerProfileId: worker.id,
          allocationId: allocation.id,
          date
        }
      }
    });
    if (existing) {
      throw new ConflictException({
        message: "A pre-start for this job on this date already exists.",
        existingId: existing.id
      });
    }

    return this.prisma.preStartChecklist.create({
      data: {
        projectId: allocation.projectId,
        workerProfileId: worker.id,
        allocationId: allocation.id,
        date,
        status: "DRAFT"
      }
    });
  }

  async getPreStart(id: string, actor: ActorContext) {
    const worker = await this.resolveWorkerProfile(actor.userId);
    const checklist = await this.prisma.preStartChecklist.findUnique({ where: { id } });
    if (!checklist) throw new NotFoundException("Pre-start not found.");
    if (checklist.workerProfileId !== worker.id && !actor.permissions.has("field.manage")) {
      throw new ForbiddenException("You cannot view another worker's pre-start.");
    }
    return checklist;
  }

  async updatePreStart(id: string, dto: UpdatePreStartDto, actor: ActorContext) {
    const worker = await this.resolveWorkerProfile(actor.userId);
    const existing = await this.prisma.preStartChecklist.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Pre-start not found.");
    if (existing.workerProfileId !== worker.id) {
      throw new ForbiddenException("You cannot edit another worker's pre-start.");
    }
    if (existing.status !== "DRAFT") {
      throw new BadRequestException("Submitted pre-starts cannot be edited.");
    }

    return this.prisma.preStartChecklist.update({
      where: { id },
      data: {
        supervisorName: dto.supervisorName,
        siteHazardsAcknowledged: dto.siteHazardsAcknowledged,
        hazardNotes: dto.hazardNotes,
        ppeHelmet: dto.ppeHelmet,
        ppeGloves: dto.ppeGloves,
        ppeBoots: dto.ppeBoots,
        ppeHighVis: dto.ppeHighVis,
        ppeRespirator: dto.ppeRespirator,
        ppeOther: dto.ppeOther,
        plantChecksCompleted: dto.plantChecksCompleted,
        plantCheckNotes: dto.plantCheckNotes,
        fitForWork: dto.fitForWork,
        fitForWorkDeclaration: dto.fitForWorkDeclaration,
        workerSignature: dto.workerSignature,
        workerSignedAt: dto.workerSignature && !existing.workerSignedAt ? new Date() : undefined,
        asbEnclosureInspection: dto.asbEnclosureInspection,
        asbAirMonitoring: dto.asbAirMonitoring,
        asbDeconOperational: dto.asbDeconOperational,
        civExcavationPermit: dto.civExcavationPermit,
        civUndergroundClearance: dto.civUndergroundClearance
      }
    });
  }

  async submitPreStart(id: string, actor: ActorContext) {
    const worker = await this.resolveWorkerProfile(actor.userId);
    const checklist = await this.prisma.preStartChecklist.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, projectNumber: true, projectManagerId: true, name: true } }
      }
    });
    if (!checklist) throw new NotFoundException("Pre-start not found.");
    if (checklist.workerProfileId !== worker.id) {
      throw new ForbiddenException("You cannot submit another worker's pre-start.");
    }
    if (checklist.status !== "DRAFT") {
      throw new BadRequestException("Pre-start has already been submitted.");
    }
    if (!checklist.fitForWork) {
      throw new BadRequestException("You must confirm the fit-for-work declaration before submitting.");
    }
    if (!checklist.workerSignature) {
      throw new BadRequestException("A worker signature is required before submitting.");
    }

    const now = new Date();
    const updated = await this.prisma.preStartChecklist.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: now, workerSignedAt: checklist.workerSignedAt ?? now }
    });

    await this.prisma.projectActivityLog.create({
      data: {
        projectId: checklist.projectId,
        userId: actor.userId,
        action: "PRESTART_SUBMITTED",
        details: {
          checklistId: checklist.id,
          workerName: `${worker.firstName} ${worker.lastName}`.trim(),
          date: checklist.date.toISOString(),
          allocationId: checklist.allocationId
        } satisfies Prisma.InputJsonValue
      }
    });

    if (checklist.project.projectManagerId) {
      await this.notifications.create(
        {
          userId: checklist.project.projectManagerId,
          title: `Pre-start submitted for ${checklist.project.projectNumber}`,
          body: `${worker.firstName} ${worker.lastName} has submitted a pre-start for ${checklist.project.projectNumber} on ${formatDateDdMmmYyyy(checklist.date)}`,
          severity: "LOW",
          linkUrl: `/projects/${checklist.project.id}`
        },
        actor.userId
      );
    }

    return updated;
  }

  // ── Timesheets ─────────────────────────────────────────────────────────
  async listTimesheets(query: FieldListQueryDto, actor: ActorContext) {
    const worker = await this.resolveWorkerProfile(actor.userId);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const skip = (page - 1) * limit;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.timesheet.count({ where: { workerProfileId: worker.id } }),
      this.prisma.timesheet.findMany({
        where: { workerProfileId: worker.id },
        orderBy: { date: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          date: true,
          hoursWorked: true,
          status: true,
          rejectedReason: true,
          rejectedAt: true,
          project: { select: { projectNumber: true, name: true } }
        }
      })
    ]);

    return {
      items: items.map((i) => ({
        id: i.id,
        date: i.date,
        hoursWorked: i.hoursWorked.toString(),
        status: i.status,
        rejectedReason: i.rejectedReason,
        rejectedAt: i.rejectedAt,
        projectNumber: i.project.projectNumber,
        projectName: i.project.name
      })),
      total,
      page,
      limit
    };
  }

  async createTimesheet(dto: CreateTimesheetDto, actor: ActorContext) {
    const worker = await this.resolveWorkerProfile(actor.userId);
    const allocation = await this.prisma.projectAllocation.findUnique({ where: { id: dto.allocationId } });
    if (!allocation || allocation.workerProfileId !== worker.id) {
      throw new ForbiddenException("You cannot submit a timesheet on an allocation that is not yours.");
    }

    const date = startOfDay(dto.date);
    const existing = await this.prisma.timesheet.findUnique({
      where: {
        workerProfileId_allocationId_date: {
          workerProfileId: worker.id,
          allocationId: allocation.id,
          date
        }
      }
    });
    if (existing) {
      throw new ConflictException({
        message: "A timesheet for this job on this date already exists.",
        existingId: existing.id
      });
    }

    // Privacy rule: GPS columns are only persisted when the worker has
    // recorded explicit location consent on their profile. If consent is
    // absent, the lat/lng silently drops — the timesheet still saves.
    const includeGps = worker.locationConsent;
    const onGeo = includeGps
      ? await this.evaluateGeofenceForTimesheet(allocation.projectId, dto.clockOnLat, dto.clockOnLng)
      : { inGeofence: null, geofenceId: null };
    const offGeo = includeGps
      ? await this.evaluateGeofenceForTimesheet(allocation.projectId, dto.clockOffLat, dto.clockOffLng)
      : { inGeofence: null, geofenceId: null };
    const created = await this.prisma.timesheet.create({
      data: {
        projectId: allocation.projectId,
        workerProfileId: worker.id,
        allocationId: allocation.id,
        date,
        hoursWorked: new Prisma.Decimal(dto.hoursWorked),
        breakMinutes: dto.breakMinutes ?? 0,
        description: dto.description ?? null,
        clockOnTime: dto.clockOnTime ? new Date(dto.clockOnTime) : null,
        clockOffTime: dto.clockOffTime ? new Date(dto.clockOffTime) : null,
        clockOnLat: includeGps && dto.clockOnLat !== undefined ? new Prisma.Decimal(dto.clockOnLat) : null,
        clockOnLng: includeGps && dto.clockOnLng !== undefined ? new Prisma.Decimal(dto.clockOnLng) : null,
        clockOnAccuracy:
          includeGps && dto.clockOnAccuracy !== undefined
            ? new Prisma.Decimal(dto.clockOnAccuracy)
            : null,
        clockOffLat:
          includeGps && dto.clockOffLat !== undefined ? new Prisma.Decimal(dto.clockOffLat) : null,
        clockOffLng:
          includeGps && dto.clockOffLng !== undefined ? new Prisma.Decimal(dto.clockOffLng) : null,
        clockOffAccuracy:
          includeGps && dto.clockOffAccuracy !== undefined
            ? new Prisma.Decimal(dto.clockOffAccuracy)
            : null,
        clockOnInGeofence: onGeo.inGeofence,
        clockOnGeofenceId: onGeo.geofenceId,
        clockOffInGeofence: offGeo.inGeofence,
        clockOffGeofenceId: offGeo.geofenceId,
        status: "DRAFT"
      }
    });

    if (includeGps) {
      await this.recordLocationLogs(worker.id, created.id, dto);
    }

    return created;
  }

  async updateTimesheet(id: string, dto: UpdateTimesheetDto, actor: ActorContext) {
    const worker = await this.resolveWorkerProfile(actor.userId);
    const existing = await this.prisma.timesheet.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Timesheet not found.");
    if (existing.workerProfileId !== worker.id) {
      throw new ForbiddenException("You cannot edit another worker's timesheet.");
    }
    if (existing.status !== "DRAFT") {
      throw new BadRequestException("Submitted timesheets cannot be edited.");
    }

    const includeGps = worker.locationConsent;
    // Re-evaluate geofence only when the corresponding lat/lng was resent
    // in the update. Absent lat/lng means "leave the existing flag alone",
    // matching the pattern used by the other GPS columns.
    const onGeo =
      includeGps && dto.clockOnLat !== undefined && dto.clockOnLng !== undefined
        ? await this.evaluateGeofenceForTimesheet(existing.projectId, dto.clockOnLat, dto.clockOnLng)
        : null;
    const offGeo =
      includeGps && dto.clockOffLat !== undefined && dto.clockOffLng !== undefined
        ? await this.evaluateGeofenceForTimesheet(existing.projectId, dto.clockOffLat, dto.clockOffLng)
        : null;
    const updated = await this.prisma.timesheet.update({
      where: { id },
      data: {
        hoursWorked: dto.hoursWorked !== undefined ? new Prisma.Decimal(dto.hoursWorked) : undefined,
        breakMinutes: dto.breakMinutes,
        description: dto.description,
        clockOnTime: dto.clockOnTime ? new Date(dto.clockOnTime) : undefined,
        clockOffTime: dto.clockOffTime ? new Date(dto.clockOffTime) : undefined,
        clockOnLat:
          includeGps && dto.clockOnLat !== undefined ? new Prisma.Decimal(dto.clockOnLat) : undefined,
        clockOnLng:
          includeGps && dto.clockOnLng !== undefined ? new Prisma.Decimal(dto.clockOnLng) : undefined,
        clockOnAccuracy:
          includeGps && dto.clockOnAccuracy !== undefined
            ? new Prisma.Decimal(dto.clockOnAccuracy)
            : undefined,
        clockOffLat:
          includeGps && dto.clockOffLat !== undefined ? new Prisma.Decimal(dto.clockOffLat) : undefined,
        clockOffLng:
          includeGps && dto.clockOffLng !== undefined ? new Prisma.Decimal(dto.clockOffLng) : undefined,
        clockOffAccuracy:
          includeGps && dto.clockOffAccuracy !== undefined
            ? new Prisma.Decimal(dto.clockOffAccuracy)
            : undefined,
        clockOnInGeofence: onGeo?.inGeofence ?? undefined,
        clockOnGeofenceId: onGeo?.geofenceId ?? undefined,
        clockOffInGeofence: offGeo?.inGeofence ?? undefined,
        clockOffGeofenceId: offGeo?.geofenceId ?? undefined
      }
    });

    if (includeGps) {
      await this.recordLocationLogs(worker.id, updated.id, dto);
    }

    return updated;
  }

  async submitTimesheet(id: string, actor: ActorContext) {
    const worker = await this.resolveWorkerProfile(actor.userId);
    const timesheet = await this.prisma.timesheet.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, projectNumber: true, projectManagerId: true, name: true } }
      }
    });
    if (!timesheet) throw new NotFoundException("Timesheet not found.");
    if (timesheet.workerProfileId !== worker.id) {
      throw new ForbiddenException("You cannot submit another worker's timesheet.");
    }
    if (timesheet.status !== "DRAFT") {
      throw new BadRequestException("Timesheet has already been submitted.");
    }

    const now = new Date();
    const updated = await this.prisma.timesheet.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: now }
    });

    await this.prisma.projectActivityLog.create({
      data: {
        projectId: timesheet.projectId,
        userId: actor.userId,
        action: "TIMESHEET_SUBMITTED",
        details: {
          timesheetId: timesheet.id,
          workerName: `${worker.firstName} ${worker.lastName}`.trim(),
          date: timesheet.date.toISOString(),
          hoursWorked: timesheet.hoursWorked.toString(),
          allocationId: timesheet.allocationId
        } satisfies Prisma.InputJsonValue
      }
    });

    if (timesheet.project.projectManagerId) {
      await this.notifications.create(
        {
          userId: timesheet.project.projectManagerId,
          title: `Timesheet submitted for ${timesheet.project.projectNumber}`,
          body: `${worker.firstName} ${worker.lastName} has submitted a timesheet for ${timesheet.project.projectNumber} on ${formatDateDdMmmYyyy(timesheet.date)} — ${timesheet.hoursWorked.toString()} hours`,
          severity: "LOW",
          linkUrl: `/projects/${timesheet.project.id}`
        },
        actor.userId
      );
    }

    return updated;
  }

  async approveTimesheet(id: string, actor: ActorContext) {
    const timesheet = await this.prisma.timesheet.findUnique({
      where: { id },
      include: {
        workerProfile: { select: { firstName: true, lastName: true, internalUserId: true } },
        project: { select: { id: true, projectNumber: true, name: true } }
      }
    });
    if (!timesheet) throw new NotFoundException("Timesheet not found.");
    if (timesheet.status === "APPROVED") return timesheet;
    if (timesheet.status === "DRAFT") {
      throw new BadRequestException("Timesheet must be submitted before it can be approved.");
    }

    const updated = await this.prisma.timesheet.update({
      where: { id },
      data: { status: "APPROVED", approvedById: actor.userId, approvedAt: new Date() }
    });

    if (timesheet.workerProfile?.internalUserId) {
      await this.notifications.create(
        {
          userId: timesheet.workerProfile.internalUserId,
          title: `Timesheet approved for ${timesheet.project.projectNumber}`,
          body: `Your timesheet for ${timesheet.project.name} on ${formatDateDdMmmYyyy(timesheet.date)} has been approved`,
          severity: "LOW",
          linkUrl: `/field/timesheet`
        },
        actor.userId
      );
    }

    return updated;
  }

  // ── Management (field.manage) ────────────────────────────────────────
  async listPendingTimesheets(query: FieldListQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 50)));
    const skip = (page - 1) * limit;

    const where: Prisma.TimesheetWhereInput = { status: "SUBMITTED" };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.timesheet.count({ where }),
      this.prisma.timesheet.findMany({
        where,
        orderBy: { date: "asc" },
        skip,
        take: limit,
        include: {
          workerProfile: { select: { id: true, firstName: true, lastName: true, role: true } },
          project: { select: { id: true, projectNumber: true, name: true } },
          allocation: { select: { id: true, roleOnProject: true } }
        }
      })
    ]);
    return { items: items.map(this.serialiseManagedTimesheet), total, page, limit };
  }

  async listAllTimesheets(query: ManageTimesheetQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 50)));
    const skip = (page - 1) * limit;

    const where: Prisma.TimesheetWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.workerId ? { workerProfileId: query.workerId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            date: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {})
            }
          }
        : {})
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.timesheet.count({ where }),
      this.prisma.timesheet.findMany({
        where,
        orderBy: { date: "desc" },
        skip,
        take: limit,
        include: {
          workerProfile: { select: { id: true, firstName: true, lastName: true, role: true } },
          project: { select: { id: true, projectNumber: true, name: true } },
          allocation: { select: { id: true, roleOnProject: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
          rejectedBy: { select: { id: true, firstName: true, lastName: true } }
        }
      })
    ]);
    return { items: items.map(this.serialiseManagedTimesheet), total, page, limit };
  }

  async timesheetSummary(query: TimesheetSummaryQueryDto) {
    const where: Prisma.TimesheetWhereInput = {
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            date: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {})
            }
          }
        : {})
    };

    const [approvedCount, pendingCount, draftCount, approvedRows, oldestPending] = await this.prisma.$transaction([
      this.prisma.timesheet.count({ where: { ...where, status: "APPROVED" } }),
      this.prisma.timesheet.count({ where: { ...where, status: "SUBMITTED" } }),
      this.prisma.timesheet.count({ where: { ...where, status: "DRAFT" } }),
      this.prisma.timesheet.findMany({
        where: { ...where, status: "APPROVED" },
        select: {
          hoursWorked: true,
          workerProfileId: true,
          projectId: true,
          workerProfile: { select: { firstName: true, lastName: true } },
          project: { select: { projectNumber: true, name: true } }
        }
      }),
      this.prisma.timesheet.findFirst({
        where: { ...where, status: "SUBMITTED" },
        orderBy: { date: "asc" },
        select: { date: true }
      })
    ]);

    let totalHours = 0;
    const byWorker = new Map<
      string,
      { workerProfileId: string; firstName: string; lastName: string; totalHours: number; timesheetCount: number }
    >();
    const byProject = new Map<
      string,
      { projectId: string; projectNumber: string; projectName: string; totalHours: number; timesheetCount: number }
    >();
    for (const row of approvedRows) {
      const hours = Number(row.hoursWorked.toString());
      totalHours += hours;
      const wkr = byWorker.get(row.workerProfileId) ?? {
        workerProfileId: row.workerProfileId,
        firstName: row.workerProfile.firstName,
        lastName: row.workerProfile.lastName,
        totalHours: 0,
        timesheetCount: 0
      };
      wkr.totalHours += hours;
      wkr.timesheetCount += 1;
      byWorker.set(row.workerProfileId, wkr);

      const proj = byProject.get(row.projectId) ?? {
        projectId: row.projectId,
        projectNumber: row.project.projectNumber,
        projectName: row.project.name,
        totalHours: 0,
        timesheetCount: 0
      };
      proj.totalHours += hours;
      proj.timesheetCount += 1;
      byProject.set(row.projectId, proj);
    }

    return {
      totalHours: Number(totalHours.toFixed(2)),
      pendingCount,
      draftCount,
      approvedCount,
      oldestPendingDate: oldestPending?.date ?? null,
      byWorker: Array.from(byWorker.values()).map((w) => ({ ...w, totalHours: Number(w.totalHours.toFixed(2)) })),
      byProject: Array.from(byProject.values()).map((p) => ({ ...p, totalHours: Number(p.totalHours.toFixed(2)) }))
    };
  }

  async rejectTimesheet(id: string, dto: RejectTimesheetDto, actor: ActorContext) {
    const timesheet = await this.prisma.timesheet.findUnique({
      where: { id },
      include: {
        workerProfile: { select: { firstName: true, lastName: true, internalUserId: true } },
        project: { select: { id: true, projectNumber: true, name: true } }
      }
    });
    if (!timesheet) throw new NotFoundException("Timesheet not found.");
    if (timesheet.status !== "SUBMITTED") {
      throw new BadRequestException("Only SUBMITTED timesheets can be returned.");
    }

    const now = new Date();
    const updated = await this.prisma.timesheet.update({
      where: { id },
      data: {
        status: "DRAFT",
        rejectedReason: dto.reason,
        rejectedById: actor.userId,
        rejectedAt: now,
        submittedAt: null
      }
    });

    await this.prisma.projectActivityLog.create({
      data: {
        projectId: timesheet.projectId,
        userId: actor.userId,
        action: "TIMESHEET_REJECTED",
        details: {
          timesheetId: timesheet.id,
          workerName: `${timesheet.workerProfile.firstName} ${timesheet.workerProfile.lastName}`.trim(),
          date: timesheet.date.toISOString(),
          hoursWorked: timesheet.hoursWorked.toString(),
          reason: dto.reason,
          rejectedById: actor.userId
        } satisfies Prisma.InputJsonValue
      }
    });

    if (timesheet.workerProfile.internalUserId) {
      await this.notifications.create(
        {
          userId: timesheet.workerProfile.internalUserId,
          title: `Timesheet returned for ${timesheet.project.projectNumber}`,
          body: `Your timesheet for ${timesheet.project.name} on ${formatDateDdMmmYyyy(timesheet.date)} has been returned — ${dto.reason}`,
          severity: "MEDIUM",
          linkUrl: `/field/timesheet`
        },
        actor.userId
      );
    }

    return updated;
  }

  async bulkApproveTimesheets(dto: BulkApproveTimesheetsDto, actor: ActorContext) {
    const rows = await this.prisma.timesheet.findMany({
      where: { id: { in: dto.timesheetIds } },
      include: {
        workerProfile: { select: { firstName: true, lastName: true, internalUserId: true } },
        project: { select: { id: true, projectNumber: true, name: true } }
      }
    });

    const foundIds = new Set(rows.map((r) => r.id));
    const invalidIds: string[] = [];
    for (const id of dto.timesheetIds) {
      if (!foundIds.has(id)) invalidIds.push(id);
    }
    for (const row of rows) {
      if (row.status !== "SUBMITTED") invalidIds.push(row.id);
    }
    if (invalidIds.length > 0) {
      throw new BadRequestException({
        message: "Some timesheets could not be approved — not found or not in SUBMITTED state.",
        invalidIds: Array.from(new Set(invalidIds))
      });
    }

    const now = new Date();
    const approved = await this.prisma.$transaction(
      rows.map((row) =>
        this.prisma.timesheet.update({
          where: { id: row.id },
          data: { status: "APPROVED", approvedById: actor.userId, approvedAt: now }
        })
      )
    );

    // Deduplicate notifications — one per worker.
    const notifiedUsers = new Set<string>();
    for (const row of rows) {
      const userId = row.workerProfile.internalUserId;
      if (!userId || notifiedUsers.has(userId)) continue;
      notifiedUsers.add(userId);
      const matching = rows.filter((r) => r.workerProfile.internalUserId === userId);
      const projectNumbers = Array.from(new Set(matching.map((r) => r.project.projectNumber)));
      await this.notifications.create(
        {
          userId,
          title: `${matching.length} timesheet${matching.length === 1 ? "" : "s"} approved`,
          body:
            matching.length === 1
              ? `Your timesheet for ${matching[0].project.name} on ${formatDateDdMmmYyyy(matching[0].date)} has been approved`
              : `${matching.length} of your timesheets have been approved (${projectNumbers.join(", ")})`,
          severity: "LOW",
          linkUrl: `/field/timesheet`
        },
        actor.userId
      );
    }

    return { approved: approved.length, timesheets: approved };
  }

  // §7 payroll export — read-only CSV of APPROVED timesheets in [from, to]
  // (inclusive). Amy downloads this for the payroll system. WorkerProfile
  // has no payroll-specific employee_id field today, so worker_employee_id
  // falls back to the WorkerProfile UUID — a future column rename will be
  // the right home if/when payroll IDs land in the schema.
  async getPayrollExportCsv(query: PayrollExportQueryDto): Promise<string> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException("from and to must be valid ISO dates.");
    }
    if (from > to) {
      throw new BadRequestException("from must be on or before to.");
    }
    // Make the upper bound inclusive of the entire day so callers can pass
    // the same calendar value for from/to to fetch a single day.
    const toInclusive = new Date(to);
    toInclusive.setUTCHours(23, 59, 59, 999);

    const rows = await this.prisma.timesheet.findMany({
      where: {
        status: "APPROVED",
        date: { gte: from, lte: toInclusive }
      },
      include: {
        workerProfile: { select: { id: true, firstName: true, lastName: true } },
        project: { select: { projectNumber: true } }
      }
    });

    const mapped: (PayrollCsvRow & { sortKey: string })[] = rows.map((row) => {
      const workerName = `${row.workerProfile.firstName} ${row.workerProfile.lastName}`.trim();
      return {
        workerName,
        workerEmployeeId: row.workerProfile.id,
        date: formatIsoDate(row.date),
        jobRef: row.project.projectNumber,
        regularHours: row.hoursWorked.toString(),
        notes: truncateNotes(row.description),
        sortKey: `${workerName.toLowerCase()} ${row.date.toISOString()}`
      };
    });

    mapped.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));

    return renderPayrollCsv(mapped.map(({ sortKey: _sortKey, ...rest }) => rest));
  }

  private serialiseManagedTimesheet = (t: {
    id: string;
    date: Date;
    hoursWorked: Prisma.Decimal;
    breakMinutes: number;
    description: string | null;
    clockOnTime: Date | null;
    clockOffTime: Date | null;
    status: string;
    submittedAt: Date | null;
    approvedAt?: Date | null;
    rejectedReason?: string | null;
    rejectedAt?: Date | null;
    workerProfile: { id: string; firstName: string; lastName: string; role: string };
    project: { id: string; projectNumber: string; name: string };
    allocation: { id: string; roleOnProject: string | null };
    approvedBy?: { id: string; firstName: string; lastName: string } | null;
    rejectedBy?: { id: string; firstName: string; lastName: string } | null;
  }) => ({
    id: t.id,
    date: t.date,
    hoursWorked: t.hoursWorked.toString(),
    breakMinutes: t.breakMinutes,
    description: t.description,
    clockOnTime: t.clockOnTime,
    clockOffTime: t.clockOffTime,
    status: t.status,
    submittedAt: t.submittedAt,
    approvedAt: t.approvedAt ?? null,
    rejectedReason: t.rejectedReason ?? null,
    rejectedAt: t.rejectedAt ?? null,
    workerProfile: t.workerProfile,
    project: t.project,
    allocation: t.allocation,
    approvedBy: t.approvedBy
      ? { id: t.approvedBy.id, firstName: t.approvedBy.firstName, lastName: t.approvedBy.lastName }
      : null,
    rejectedBy: t.rejectedBy
      ? { id: t.rejectedBy.id, firstName: t.rejectedBy.firstName, lastName: t.rejectedBy.lastName }
      : null
  });
}

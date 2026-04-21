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
  CreateTimesheetDto,
  FieldListQueryDto,
  ManageTimesheetQueryDto,
  RejectTimesheetDto,
  TimesheetSummaryQueryDto,
  UpdatePreStartDto,
  UpdateTimesheetDto
} from "./dto/field.dto";

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

    return this.prisma.timesheet.create({
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
        status: "DRAFT"
      }
    });
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

    return this.prisma.timesheet.update({
      where: { id },
      data: {
        hoursWorked: dto.hoursWorked !== undefined ? new Prisma.Decimal(dto.hoursWorked) : undefined,
        breakMinutes: dto.breakMinutes,
        description: dto.description,
        clockOnTime: dto.clockOnTime ? new Date(dto.clockOnTime) : undefined,
        clockOffTime: dto.clockOffTime ? new Date(dto.clockOffTime) : undefined
      }
    });
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

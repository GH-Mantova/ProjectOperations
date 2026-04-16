import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../platform/notifications.service";
import { SharePointService } from "../platform/sharepoint.service";
import {
  CloseoutJobDto,
  CreateJobActivityDto,
  CreateJobIssueDto,
  CreateJobProgressEntryDto,
  CreateJobStageDto,
  CreateJobVariationDto,
  UpdateJobActivityDto,
  UpdateJobDto,
  UpdateJobIssueDto,
  UpdateJobStageDto,
  UpdateJobStatusDto,
  UpdateJobVariationDto
} from "./dto/job-delivery.dto";
import {
  ConvertTenderToJobDto,
  IssueTenderContractDto,
  ReuseArchivedJobConversionDto,
  RollbackTenderLifecycleDto
} from "./dto/job-conversion.dto";
import { JobQueryDto } from "./dto/job-query.dto";

const tenderConversionInclude = {
  estimator: {
    select: {
      id: true,
      firstName: true,
      lastName: true
    }
  },
  tenderClients: {
    include: {
      client: true,
      contact: true,
      jobConversion: {
        include: {
          job: {
            select: {
              id: true,
              jobNumber: true,
              name: true,
              status: true
            }
          }
        }
      }
    }
  },
  tenderNotes: true,
  clarifications: true,
  pricingSnapshots: true,
  followUps: {
    include: {
      assignedUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    }
  },
  outcomes: true,
  tenderDocuments: {
    include: {
      folderLink: true,
      fileLink: true
    }
  },
  sourceJob: {
    select: {
      id: true,
      jobNumber: true,
      name: true,
      status: true
    }
  }
} as const;

const jobInclude = {
  client: true,
  site: true,
  sourceTender: {
    select: {
      id: true,
      tenderNumber: true,
      title: true,
      status: true,
      dueDate: true,
      estimatedValue: true,
      probability: true,
      estimator: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    }
  },
  projectManager: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true
    }
  },
  supervisor: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true
    }
  },
  conversion: {
    select: {
      id: true,
      carriedDocuments: true,
      tenderClient: {
        select: {
          id: true,
          client: true,
          contact: true,
          relationshipType: true,
          notes: true
        }
      }
    }
  },
  stages: {
    orderBy: { stageOrder: "asc" },
    include: {
      activities: {
        orderBy: { activityOrder: "asc" },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          shifts: {
            orderBy: { startAt: "asc" },
            select: {
              id: true,
              title: true,
              status: true,
              startAt: true,
              endAt: true,
              lead: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              },
              conflicts: {
                select: {
                  id: true,
                  severity: true,
                  code: true,
                  message: true
                }
              }
            }
          }
        }
      }
    }
  },
  issues: {
    include: {
      reportedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  },
  variations: {
    include: {
      approvedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  },
  progressEntries: {
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: { entryDate: "desc" }
  },
  statusHistory: {
    include: {
      changedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: { changedAt: "desc" }
  },
  closeout: {
    include: {
      archivedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    }
  }
} as const;

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly sharePointService: SharePointService,
    private readonly notificationsService: NotificationsService
  ) {}

  async list(query: JobQueryDto) {
    const activeJobWhere: Prisma.JobWhereInput = {
      OR: [{ closeout: { is: null } }, { closeout: { is: { archivedAt: null } } }]
    };

    const where: Prisma.JobWhereInput | undefined = query.q
      ? {
          OR: [
            { jobNumber: { contains: query.q, mode: "insensitive" } },
            { name: { contains: query.q, mode: "insensitive" } },
            { client: { name: { contains: query.q, mode: "insensitive" } } }
          ],
          AND: [activeJobWhere]
        }
      : activeJobWhere;

    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        include: jobInclude,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: query.pageSize
      }),
      this.prisma.job.count({ where })
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize
    };
  }

  async listArchive(query: JobQueryDto) {
    const where: Prisma.JobWhereInput = {
      closeout: {
        is: {
          archivedAt: { not: null }
        }
      },
      ...(query.q
        ? {
            OR: [
              { jobNumber: { contains: query.q, mode: "insensitive" } },
              { name: { contains: query.q, mode: "insensitive" } },
              { client: { name: { contains: query.q, mode: "insensitive" } } }
            ]
          }
        : {})
    };

    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        include: jobInclude,
        orderBy: [{ updatedAt: "desc" }],
        skip,
        take: query.pageSize
      }),
      this.prisma.job.count({ where })
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize
    };
  }

  async getById(id: string) {
    const job = await this.requireJob(id);

    const documents = await this.prisma.documentLink.findMany({
      where: {
        linkedEntityType: "Job",
        linkedEntityId: id
      },
      include: {
        folderLink: true,
        fileLink: true
      },
      orderBy: { createdAt: "desc" }
    });

    return {
      ...job,
      documents
    };
  }

  async updateJob(id: string, dto: UpdateJobDto, actorId?: string) {
    await this.ensureNotReadOnly(id);
    await this.requireJob(id);

    const updated = await this.prisma.job.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        siteId: dto.siteId ?? null,
        projectManagerId: dto.projectManagerId ?? null,
        supervisorId: dto.supervisorId ?? null
      }
    });

    await this.auditService.write({
      actorId,
      action: "jobs.update",
      entityType: "Job",
      entityId: updated.id,
      metadata: dto as Prisma.InputJsonValue
    });
    await this.notificationsService.refreshLiveFollowUps(actorId);

    return this.getById(id);
  }

  async updateStatus(id: string, dto: UpdateJobStatusDto, actorId?: string) {
    await this.ensureNotReadOnly(id);
    const job = await this.requireJob(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id },
        data: { status: dto.status }
      });

      await tx.jobStatusHistory.create({
        data: {
          jobId: id,
          fromStatus: job.status,
          toStatus: dto.status,
          note: dto.note,
          changedById: actorId
        }
      });
    });

    await this.auditService.write({
      actorId,
      action: "jobs.status.update",
      entityType: "Job",
      entityId: id,
      metadata: {
        fromStatus: job.status,
        toStatus: dto.status,
        note: dto.note
      }
    });
    await this.notificationsService.refreshLiveFollowUps(actorId);

    return this.getById(id);
  }

  async createStage(jobId: string, dto: CreateJobStageDto, actorId?: string) {
    await this.ensureNotReadOnly(jobId);
    await this.requireJob(jobId);

    const stage = await this.prisma.jobStage.create({
      data: {
        jobId,
        name: dto.name,
        description: dto.description,
        stageOrder: dto.stageOrder ?? 0,
        status: dto.status ?? "PLANNED",
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null
      }
    });

    await this.auditService.write({
      actorId,
      action: "jobs.stage.create",
      entityType: "JobStage",
      entityId: stage.id,
      metadata: { jobId, name: stage.name }
    });
    await this.notificationsService.refreshLiveFollowUps(actorId);

    return this.getById(jobId);
  }

  async updateStage(jobId: string, stageId: string, dto: UpdateJobStageDto, actorId?: string) {
    await this.ensureNotReadOnly(jobId);
    const stage = await this.requireStage(jobId, stageId);

    await this.prisma.jobStage.update({
      where: { id: stage.id },
      data: {
        name: dto.name,
        description: dto.description,
        stageOrder: dto.stageOrder,
        status: dto.status,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null
      }
    });

    await this.auditService.write({
      actorId,
      action: "jobs.stage.update",
      entityType: "JobStage",
      entityId: stage.id,
      metadata: { jobId, name: dto.name }
    });
    await this.notificationsService.refreshLiveFollowUps(actorId);

    return this.getById(jobId);
  }

  async createActivity(jobId: string, dto: CreateJobActivityDto, actorId?: string) {
    await this.ensureNotReadOnly(jobId);
    await this.requireJob(jobId);
    await this.requireStage(jobId, dto.jobStageId);

    const activity = await this.prisma.jobActivity.create({
      data: {
        jobId,
        jobStageId: dto.jobStageId,
        name: dto.name,
        description: dto.description,
        activityOrder: dto.activityOrder ?? 0,
        status: dto.status ?? "PLANNED",
        plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : null,
        notes: dto.notes,
        ownerUserId: dto.ownerUserId ?? null
      }
    });

    await this.auditService.write({
      actorId,
      action: "jobs.activity.create",
      entityType: "JobActivity",
      entityId: activity.id,
      metadata: { jobId, stageId: dto.jobStageId, name: dto.name }
    });
    await this.notificationsService.refreshLiveFollowUps(actorId);

    return this.getById(jobId);
  }

  async updateActivity(jobId: string, activityId: string, dto: UpdateJobActivityDto, actorId?: string) {
    await this.ensureNotReadOnly(jobId);
    const activity = await this.requireActivity(jobId, activityId);
    await this.requireStage(jobId, dto.jobStageId);

    await this.prisma.jobActivity.update({
      where: { id: activity.id },
      data: {
        jobStageId: dto.jobStageId,
        name: dto.name,
        description: dto.description,
        activityOrder: dto.activityOrder,
        status: dto.status,
        plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : null,
        notes: dto.notes,
        ownerUserId: dto.ownerUserId ?? null
      }
    });

    await this.auditService.write({
      actorId,
      action: "jobs.activity.update",
      entityType: "JobActivity",
      entityId: activity.id,
      metadata: { jobId, stageId: dto.jobStageId, name: dto.name }
    });
    await this.notificationsService.refreshLiveFollowUps(actorId);

    return this.getById(jobId);
  }

  async createIssue(jobId: string, dto: CreateJobIssueDto, actorId?: string) {
    await this.ensureNotReadOnly(jobId);
    await this.requireJob(jobId);

    const issue = await this.prisma.jobIssue.create({
      data: {
        jobId,
        title: dto.title,
        description: dto.description,
        severity: dto.severity ?? "MEDIUM",
        status: dto.status ?? "OPEN",
        reportedById: actorId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null
      }
    });

    await this.auditService.write({
      actorId,
      action: "jobs.issue.create",
      entityType: "JobIssue",
      entityId: issue.id,
      metadata: { jobId, title: dto.title }
    });
    await this.notificationsService.refreshLiveFollowUps(actorId);

    return this.getById(jobId);
  }

  async updateIssue(jobId: string, issueId: string, dto: UpdateJobIssueDto, actorId?: string) {
    await this.ensureNotReadOnly(jobId);
    const issue = await this.requireIssue(jobId, issueId);

    await this.prisma.jobIssue.update({
      where: { id: issue.id },
      data: {
        title: dto.title,
        description: dto.description,
        severity: dto.severity,
        status: dto.status,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null
      }
    });

    await this.auditService.write({
      actorId,
      action: "jobs.issue.update",
      entityType: "JobIssue",
      entityId: issue.id,
      metadata: { jobId, title: dto.title }
    });
    await this.notificationsService.refreshLiveFollowUps(actorId);

    return this.getById(jobId);
  }

  async createVariation(jobId: string, dto: CreateJobVariationDto, actorId?: string) {
    await this.ensureNotReadOnly(jobId);
    await this.requireJob(jobId);
    await this.ensureUniqueVariationReference(jobId, dto.reference);

    const variation = await this.prisma.jobVariation.create({
      data: {
        jobId,
        reference: dto.reference,
        title: dto.title,
        description: dto.description,
        status: dto.status ?? "PROPOSED",
        amount: dto.amount ? new Prisma.Decimal(dto.amount) : null,
        approvedById: dto.approvedById ?? null,
        approvedAt: dto.approvedAt ? new Date(dto.approvedAt) : null
      }
    });

    await this.auditService.write({
      actorId,
      action: "jobs.variation.create",
      entityType: "JobVariation",
      entityId: variation.id,
      metadata: { jobId, reference: dto.reference }
    });
    await this.notificationsService.refreshLiveFollowUps(actorId);

    return this.getById(jobId);
  }

  async updateVariation(jobId: string, variationId: string, dto: UpdateJobVariationDto, actorId?: string) {
    await this.ensureNotReadOnly(jobId);
    const variation = await this.requireVariation(jobId, variationId);
    if (dto.reference !== variation.reference) {
      await this.ensureUniqueVariationReference(jobId, dto.reference, variationId);
    }

    await this.prisma.jobVariation.update({
      where: { id: variation.id },
      data: {
        reference: dto.reference,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        amount: dto.amount ? new Prisma.Decimal(dto.amount) : null,
        approvedById: dto.approvedById ?? null,
        approvedAt: dto.approvedAt ? new Date(dto.approvedAt) : null
      }
    });

    await this.auditService.write({
      actorId,
      action: "jobs.variation.update",
      entityType: "JobVariation",
      entityId: variation.id,
      metadata: { jobId, reference: dto.reference }
    });
    await this.notificationsService.refreshLiveFollowUps(actorId);

    return this.getById(jobId);
  }

  async createProgressEntry(jobId: string, dto: CreateJobProgressEntryDto, actorId?: string) {
    await this.ensureNotReadOnly(jobId);
    await this.requireJob(jobId);

    const entry = await this.prisma.jobProgressEntry.create({
      data: {
        jobId,
        entryType: dto.entryType ?? "PROGRESS",
        entryDate: new Date(dto.entryDate),
        summary: dto.summary,
        percentComplete: dto.percentComplete ?? null,
        details: dto.details,
        authorUserId: actorId
      }
    });

    await this.auditService.write({
      actorId,
      action: "jobs.progress.create",
      entityType: "JobProgressEntry",
      entityId: entry.id,
      metadata: { jobId, entryType: entry.entryType }
    });
    await this.notificationsService.refreshLiveFollowUps(actorId);

    return this.getById(jobId);
  }

  async closeoutJob(jobId: string, dto: CloseoutJobDto, actorId?: string) {
    const job = await this.requireJob(jobId);
    const closeoutStatus = dto.status ?? "CLOSED";
    const archivedAt = dto.archivedAt ? new Date(dto.archivedAt) : new Date();
    const readOnlyFrom = dto.readOnlyFrom ? new Date(dto.readOnlyFrom) : archivedAt;
    const finalStatus = closeoutStatus === "ARCHIVED" || closeoutStatus === "CLOSED" ? "COMPLETE" : job.status;

    await this.prisma.$transaction(async (tx) => {
      await tx.jobCloseout.upsert({
        where: { jobId },
        update: {
          status: closeoutStatus,
          checklistJson: (dto.checklistJson ?? {}) as Prisma.InputJsonValue,
          summary: dto.summary ?? null,
          archivedAt,
          archivedById: actorId ?? null,
          readOnlyFrom
        },
        create: {
          jobId,
          status: closeoutStatus,
          checklistJson: (dto.checklistJson ?? {}) as Prisma.InputJsonValue,
          summary: dto.summary ?? null,
          archivedAt,
          archivedById: actorId ?? null,
          readOnlyFrom
        }
      });

      await tx.job.update({
        where: { id: jobId },
        data: { status: finalStatus }
      });

      await tx.jobStatusHistory.create({
        data: {
          jobId,
          fromStatus: job.status,
          toStatus: finalStatus,
          note: dto.summary ?? "Job closeout completed.",
          changedById: actorId
        }
      });
    });

    await this.auditService.write({
      actorId,
      action: "jobs.closeout",
      entityType: "JobCloseout",
      entityId: jobId,
      metadata: {
        closeoutStatus,
        archivedAt: archivedAt.toISOString()
      }
    });

    return this.getById(jobId);
  }

  async awardTenderClient(tenderId: string, tenderClientId: string, actorId?: string) {
    const tender = await this.requireTender(tenderId);
    const targetClient = tender.tenderClients.find((item) => item.id === tenderClientId);

    if (!targetClient) {
      throw new NotFoundException("Tender client not found.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tenderClient.updateMany({
        where: { tenderId },
        data: { isAwarded: false }
      });

      await tx.tenderClient.update({
        where: { id: tenderClientId },
        data: { isAwarded: true }
      });

      await tx.tender.update({
        where: { id: tenderId },
        data: { status: "AWARDED" }
      });
    });

    await this.auditService.write({
      actorId,
      action: "tenderconversion.award",
      entityType: "TenderClient",
      entityId: tenderClientId,
      metadata: {
        tenderId,
        clientId: targetClient.clientId
      }
    });
    await this.notificationsService.refreshLiveFollowUps(actorId);

    return this.requireTender(tenderId);
  }

  async issueContract(tenderId: string, dto: IssueTenderContractDto, actorId?: string) {
    const tender = await this.requireTender(tenderId);
    const targetClient = tender.tenderClients.find((item) => item.id === dto.tenderClientId);

    if (!targetClient) {
      throw new NotFoundException("Tender client not found.");
    }

    if (!targetClient.isAwarded) {
      throw new BadRequestException("Only the awarded client can issue a contract.");
    }

    const contractIssuedAt = dto.contractIssuedAt ? new Date(dto.contractIssuedAt) : new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.tenderClient.update({
        where: { id: dto.tenderClientId },
        data: {
          contractIssued: true,
          contractIssuedAt
        }
      });

      await tx.tender.update({
        where: { id: tenderId },
        data: { status: "CONTRACT_ISSUED" }
      });
    });

    await this.auditService.write({
      actorId,
      action: "tenderconversion.contract.issue",
      entityType: "TenderClient",
      entityId: dto.tenderClientId,
      metadata: {
        tenderId,
        contractIssuedAt: contractIssuedAt.toISOString()
      }
    });
    await this.notificationsService.refreshLiveFollowUps(actorId);

    return this.requireTender(tenderId);
  }

  async convertTenderToJob(tenderId: string, dto: ConvertTenderToJobDto, actorId?: string) {
    const tender = await this.requireTender(tenderId);

    if (tender.sourceJob) {
      throw new ConflictException("This tender has already been converted to a job.");
    }

    const awardedContractedClient = tender.tenderClients.find(
      (item) => item.isAwarded && item.contractIssued
    );

    if (!awardedContractedClient) {
      throw new BadRequestException(
        "A job can only be created after the awarded client issues a contract."
      );
    }

    const existingJob = await this.prisma.job.findFirst({
      where: {
        OR: [{ jobNumber: dto.jobNumber }, { sourceTenderId: tenderId }]
      },
      include: {
        closeout: true
      }
    });

    if (existingJob) {
      throw new ConflictException({
        message: "A job with this number and source tender already exists.",
        archivedJobId: existingJob.closeout?.archivedAt ? existingJob.id : null,
        isArchived: Boolean(existingJob.closeout?.archivedAt)
      });
    }

    const requestedDocumentIds = dto.tenderDocumentIds ?? [];
    const carryTenderDocuments = dto.carryTenderDocuments ?? false;

    if (!carryTenderDocuments && requestedDocumentIds.length > 0) {
      throw new BadRequestException("Document carry-forward must be enabled to select documents.");
    }

    const selectedDocuments =
      carryTenderDocuments && requestedDocumentIds.length > 0
        ? tender.tenderDocuments.filter((document) => requestedDocumentIds.includes(document.id))
        : carryTenderDocuments
          ? tender.tenderDocuments
          : [];

    if (requestedDocumentIds.length > 0 && selectedDocuments.length !== requestedDocumentIds.length) {
      throw new BadRequestException("One or more selected tender documents do not belong to this tender.");
    }

    const jobFolder = await this.sharePointService.ensureFolder(
      {
        name: dto.name,
        relativePath: `Project Operations/Jobs/${dto.jobNumber}_${this.slugify(dto.name)}`,
        module: "jobs",
        linkedEntityType: "Job",
        linkedEntityId: tenderId
      },
      actorId
    );

    const job = await this.prisma.$transaction(async (tx) => {
      const createdJob = await tx.job.create({
        data: {
          jobNumber: dto.jobNumber,
          name: dto.name,
          description: dto.description ?? tender.description ?? null,
          clientId: awardedContractedClient.clientId,
          siteId: dto.siteId ?? null,
          sourceTenderId: tenderId,
          status: "PLANNING",
          projectManagerId: dto.projectManagerId ?? null,
          supervisorId: dto.supervisorId ?? null
        }
      });

      await tx.jobConversion.create({
        data: {
          tenderId,
          tenderClientId: awardedContractedClient.id,
          jobId: createdJob.id,
          carriedDocuments: selectedDocuments.length > 0
        }
      });

      await tx.sharePointFolderLink.update({
        where: { id: jobFolder.id },
        data: {
          linkedEntityType: "Job",
          linkedEntityId: createdJob.id
        }
      });

      if (selectedDocuments.length > 0) {
        await tx.documentLink.createMany({
          data: selectedDocuments.map((document) => ({
            linkedEntityType: "Job",
            linkedEntityId: createdJob.id,
            module: "jobs",
            category: document.category,
            title: document.title,
            description: document.description,
            folderLinkId: document.folderLinkId,
            fileLinkId: document.fileLinkId
          }))
        });
      }

      await tx.searchEntry.create({
        data: {
          entityType: "Job",
          entityId: createdJob.id,
          title: `${createdJob.jobNumber} - ${createdJob.name}`,
          subtitle: tender.tenderNumber,
          body: `Converted from tender ${tender.tenderNumber}`,
          module: "jobs",
          url: "/jobs"
        }
      });

      await tx.tender.update({
        where: { id: tenderId },
        data: { status: "CONVERTED" }
      });

      return createdJob;
    });

    await this.auditService.write({
      actorId,
      action: "tenderconversion.convert",
      entityType: "Job",
      entityId: job.id,
      metadata: {
        tenderId,
        tenderClientId: awardedContractedClient.id,
        carryTenderDocuments,
        tenderDocumentIds: selectedDocuments.map((document) => document.id)
      }
    });
    await this.notificationsService.refreshLiveFollowUps(actorId);

    return this.getById(job.id);
  }

  async reuseArchivedJobConversion(tenderId: string, dto: ReuseArchivedJobConversionDto, actorId?: string) {
    const tender = await this.requireTender(tenderId);

    if (tender.sourceJob) {
      throw new ConflictException("This tender has already been converted to a job.");
    }

    const awardedContractedClient = tender.tenderClients.find(
      (item) => item.isAwarded && item.contractIssued
    );

    if (!awardedContractedClient) {
      throw new BadRequestException(
        "A job can only be created after the awarded client issues a contract."
      );
    }

    const archivedJobInclude = {
      closeout: true,
      stages: {
        orderBy: { stageOrder: "desc" as const },
        take: 1
      }
    };

    const existingJob = dto.archivedJobId
      ? await this.prisma.job.findUnique({
          where: { id: dto.archivedJobId },
          include: archivedJobInclude
        })
      : await this.prisma.job.findFirst({
          where: {
            jobNumber: {
              equals: dto.jobNumber.trim(),
              mode: "insensitive"
            },
            closeout: {
              is: {
                archivedAt: { not: null }
              }
            }
          },
          include: archivedJobInclude
        });

    if (!existingJob?.closeout?.archivedAt) {
      throw new ConflictException("A reusable archived job with this number and source tender was not found.");
    }

    const requestedDocumentIds = dto.tenderDocumentIds ?? [];
    const carryTenderDocuments = dto.carryTenderDocuments ?? false;

    if (!carryTenderDocuments && requestedDocumentIds.length > 0) {
      throw new BadRequestException("Document carry-forward must be enabled to select documents.");
    }

    const selectedDocuments =
      carryTenderDocuments && requestedDocumentIds.length > 0
        ? tender.tenderDocuments.filter((document) => requestedDocumentIds.includes(document.id))
        : carryTenderDocuments
          ? tender.tenderDocuments
          : [];

    if (requestedDocumentIds.length > 0 && selectedDocuments.length !== requestedDocumentIds.length) {
      throw new BadRequestException("One or more selected tender documents do not belong to this tender.");
    }

      const job = await this.prisma.$transaction(async (tx) => {
        const reopenedJob = await tx.job.update({
          where: { id: existingJob.id },
          data: {
            name: dto.name,
            description: dto.description ?? tender.description ?? null,
            clientId: awardedContractedClient.clientId,
            siteId: dto.siteId ?? null,
            sourceTenderId: tenderId,
            status: "ACTIVE",
            projectManagerId: dto.projectManagerId ?? null,
            supervisorId: dto.supervisorId ?? null
          }
        });

      await tx.jobCloseout.upsert({
        where: { jobId: existingJob.id },
        update: {
          status: "REOPENED",
          summary: dto.description ?? "Reopened from tender conversion as a new stage.",
          archivedAt: null,
          archivedById: null,
          readOnlyFrom: null
        },
        create: {
          jobId: existingJob.id,
          status: "REOPENED",
          summary: dto.description ?? "Reopened from tender conversion as a new stage.",
          archivedAt: null,
          archivedById: null,
          readOnlyFrom: null
        }
      });

      await tx.jobStage.create({
        data: {
          jobId: existingJob.id,
          name: dto.stageName,
          description: `Created from tender ${tender.tenderNumber}`,
          stageOrder: (existingJob.stages[0]?.stageOrder ?? -1) + 1,
          status: "ACTIVE"
        }
      });

      await tx.jobConversion.upsert({
        where: { tenderId },
        update: {
          tenderClientId: awardedContractedClient.id,
          jobId: existingJob.id,
          carriedDocuments: selectedDocuments.length > 0
        },
        create: {
          tenderId,
          tenderClientId: awardedContractedClient.id,
          jobId: existingJob.id,
          carriedDocuments: selectedDocuments.length > 0
        }
      });

      if (selectedDocuments.length > 0) {
        await tx.documentLink.createMany({
          data: selectedDocuments.map((document) => ({
            linkedEntityType: "Job",
            linkedEntityId: existingJob.id,
            module: "jobs",
            category: document.category,
            title: document.title,
            description: document.description,
            folderLinkId: document.folderLinkId,
            fileLinkId: document.fileLinkId
          }))
        });
      }

      await tx.tender.update({
        where: { id: tenderId },
        data: { status: "CONVERTED" }
      });

      return reopenedJob;
    });

    await this.auditService.write({
      actorId,
      action: "tenderconversion.convert.reuse-archived",
      entityType: "Job",
      entityId: job.id,
      metadata: {
        tenderId,
        tenderClientId: awardedContractedClient.id,
        stageName: dto.stageName,
        carryTenderDocuments,
        tenderDocumentIds: selectedDocuments.map((document) => document.id)
      }
    });
    await this.notificationsService.refreshLiveFollowUps(actorId);

    return this.getById(job.id);
  }

  async rollbackTenderLifecycle(tenderId: string, dto: RollbackTenderLifecycleDto, actorId?: string) {
    const tender = await this.requireTender(tenderId);
    const requiresAwardPath = dto.targetStage === "AWARDED" || dto.targetStage === "CONTRACT_ISSUED";
    const fallbackClient =
      tender.tenderClients.find((item) => item.isAwarded || item.contractIssued) ??
      tender.tenderClients[0];
    const targetClientId = requiresAwardPath ? dto.tenderClientId ?? fallbackClient?.id : undefined;

    if (requiresAwardPath && !targetClientId) {
      throw new BadRequestException("Select a tender client before rolling this tender back.");
    }

    const targetClient = targetClientId
      ? tender.tenderClients.find((item) => item.id === targetClientId)
      : null;

    if (requiresAwardPath && !targetClient) {
      throw new NotFoundException("Tender client not found.");
    }

    await this.prisma.$transaction(async (tx) => {
      if (tender.sourceJob) {
        const archivedAt = new Date();
        await tx.jobCloseout.upsert({
          where: { jobId: tender.sourceJob.id },
          update: {
            status: "ARCHIVED",
            checklistJson: {} as Prisma.InputJsonValue,
            summary: "Archived because the source tender was moved back from Converted.",
            archivedAt,
            archivedById: actorId ?? null,
            readOnlyFrom: archivedAt
          },
          create: {
            jobId: tender.sourceJob.id,
            status: "ARCHIVED",
            checklistJson: {} as Prisma.InputJsonValue,
            summary: "Archived because the source tender was moved back from Converted.",
            archivedAt,
            archivedById: actorId ?? null,
            readOnlyFrom: archivedAt
          }
        });

        await tx.job.update({
          where: { id: tender.sourceJob.id },
          data: {
            status: "COMPLETE",
            sourceTenderId: null
          }
        });

        await tx.jobConversion.deleteMany({
          where: { tenderId }
        });
      }

      await tx.tenderClient.updateMany({
        where: { tenderId },
        data: {
          isAwarded: false,
          contractIssued: false,
          contractIssuedAt: null
        }
      });

      if (targetClientId && targetClient) {
        await tx.tenderClient.update({
          where: { id: targetClientId },
          data: {
            isAwarded: true,
            contractIssued: dto.targetStage === "CONTRACT_ISSUED",
            contractIssuedAt: dto.targetStage === "CONTRACT_ISSUED"
              ? targetClient.contractIssuedAt ?? new Date()
              : null
          }
        });
      }

      await tx.tender.update({
        where: { id: tenderId },
        data: { status: dto.targetStage }
      });
    });

    await this.auditService.write({
      actorId,
      action: "tenderconversion.rollback",
      entityType: "Tender",
      entityId: tenderId,
      metadata: {
        targetStage: dto.targetStage,
        tenderClientId: targetClientId,
        detachedJobId: tender.sourceJob?.id ?? null
      }
    });
    await this.notificationsService.refreshLiveFollowUps(actorId);

    return this.requireTender(tenderId);
  }

  private async requireTender(tenderId: string) {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      include: tenderConversionInclude
    });

    if (!tender) {
      throw new NotFoundException("Tender not found.");
    }

    return tender;
  }

  private async requireJob(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: jobInclude
    });

    if (!job) {
      throw new NotFoundException("Job not found.");
    }

    return job;
  }

  private async ensureNotReadOnly(jobId: string) {
    const closeout = await this.prisma.jobCloseout.findUnique({
      where: { jobId }
    });

    if (closeout?.readOnlyFrom && closeout.readOnlyFrom <= new Date()) {
      throw new ForbiddenException("Archived jobs are read-only.");
    }
  }

  private async requireStage(jobId: string, stageId: string) {
    const stage = await this.prisma.jobStage.findUnique({
      where: { id: stageId }
    });

    if (!stage || stage.jobId !== jobId) {
      throw new NotFoundException("Job stage not found.");
    }

    return stage;
  }

  private async requireActivity(jobId: string, activityId: string) {
    const activity = await this.prisma.jobActivity.findUnique({
      where: { id: activityId }
    });

    if (!activity || activity.jobId !== jobId) {
      throw new NotFoundException("Job activity not found.");
    }

    return activity;
  }

  private async requireIssue(jobId: string, issueId: string) {
    const issue = await this.prisma.jobIssue.findUnique({
      where: { id: issueId }
    });

    if (!issue || issue.jobId !== jobId) {
      throw new NotFoundException("Job issue not found.");
    }

    return issue;
  }

  private async requireVariation(jobId: string, variationId: string) {
    const variation = await this.prisma.jobVariation.findUnique({
      where: { id: variationId }
    });

    if (!variation || variation.jobId !== jobId) {
      throw new NotFoundException("Job variation not found.");
    }

    return variation;
  }

  private async ensureUniqueVariationReference(jobId: string, reference: string, ignoreId?: string) {
    const existing = await this.prisma.jobVariation.findFirst({
      where: {
        jobId,
        reference,
        ...(ignoreId ? { NOT: { id: ignoreId } } : {})
      }
    });

    if (existing) {
      throw new ConflictException("Variation reference already exists for this job.");
    }
  }

  private slugify(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }
}

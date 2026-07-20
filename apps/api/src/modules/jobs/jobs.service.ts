import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../platform/notifications.service";
import { SharePointService } from "../platform/sharepoint.service";
import { SharePointFolderMappingsService } from "../platform/sharepoint-folder-mappings.service";
import {
  CloseoutJobDto,
  CreateJobActivityDto,
  CreateJobDto,
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
import { JobNumberService } from "./job-number.service";

// Job.siteId is NOT NULL (see migration 20260716140000_site_id_not_null_backfill).
// When a caller omits a site we point the row at the seeded "Unassigned" Site so
// the row stays valid; users can reassign later from the job page.
const UNASSIGNED_SITE_ID = "site-unassigned";

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

/**
 * B02.1 race-fix helper. Returns true when the error is a Prisma
 * unique-constraint violation (P2002) whose target includes the
 * `job_number` column. Prisma encodes `meta.target` inconsistently
 * across providers — sometimes as a string, sometimes as a string
 * array — so we check both shapes.
 */
function isJobNumberUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code !== "P2002") return false;
  const target = err.meta?.target;
  if (Array.isArray(target)) return target.includes("job_number");
  if (typeof target === "string") return target.includes("job_number");
  return false;
}

/**
 * Service layer for the jobs module (§8 Jobs and Delivery). Covers the
 * full delivery lifecycle: job CRUD, stages, activities, issues,
 * variations, progress entries, status history, and closeout / archive.
 * Also exposes the tender → job conversion path
 * ({@link awardTenderClient} → {@link issueContract} →
 * {@link convertTenderToJob}) plus the archived-job reuse and lifecycle
 * rollback flows used by {@link TenderConversionController}.
 *
 * Mutating calls flow through {@link ensureNotReadOnly} so that once a
 * job's closeout sets `readOnlyFrom`, writes are rejected with 403 — the
 * archive is intentionally append-only. Every write also writes a row to
 * `AuditLog` via {@link AuditService} and pokes
 * {@link NotificationsService.refreshLiveFollowUps} so the activity feed
 * stays current.
 *
 * Job numbers are canonical `J{YYMMDD}-{SLUG}-{NNN}` (G5) and always
 * server-generated via {@link JobNumberService.generate} from the job's
 * client; both creation paths translate Prisma P2002 races into 409
 * {@link ConflictException} via {@link isJobNumberUniqueViolation}.
 */
@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly sharePointService: SharePointService,
    private readonly notificationsService: NotificationsService,
    private readonly jobNumberService: JobNumberService,
    // Optional so the many existing unit tests that construct JobsService
    // directly (without DI) keep compiling. Nest wires the real service
    // in production; when absent, jobs root falls back to the historic
    // hardcoded path — same behaviour as before this PR.
    @Optional() private readonly folderMappings?: SharePointFolderMappingsService
  ) {}

  // Legacy hardcoded root, used only if `folderMappings` is unavailable
  // (test-only path). Prod always resolves the DB-configured mapping.
  private static readonly LEGACY_JOBS_ROOT = "Project Operations/Jobs";

  /**
   * Paginated list of active (non-archived) jobs ordered by `createdAt`
   * desc. Excludes any job whose `closeout.archivedAt` is set; jobs with
   * no closeout row are also included. `q` does case-insensitive matches
   * on `jobNumber`, `name`, and `client.name`.
   */
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

  /**
   * Paginated list of archived jobs (those with `closeout.archivedAt` set)
   * ordered by `updatedAt` desc. Surface used by the Archive route to
   * expose read-only historical jobs. Same `q` search semantics as
   * {@link list}.
   */
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

  /**
   * Full job detail with the standard {@link jobInclude} graph (client,
   * site, source tender, PM/supervisor, stages → activities → shifts,
   * issues, variations, progress entries, status history, closeout) plus
   * any {@link DocumentLink} rows attached to this job (sorted newest
   * first).
   *
   * @throws NotFoundException When no job with `id` exists.
   */
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

  /**
   * PR B05 — manual job creation. The frontend's `NewJobSlideOver`
   * modal (apps/web/src/pages/jobs/JobsListPage.tsx) POSTs here.
   *
   * Job numbers are always server-generated via JobNumberService
   * (G5 canonical J{YYMMDD}-{SLUG}-{NNN}, per-client sequence, Brisbane
   * TZ date stamp) — callers cannot supply one.
   *
   * Race protection (B02.1): the explicit findUnique pre-check gives a
   * friendly 409 in the common case; the try/catch on prisma.job.create
   * translates a P2002 unique-constraint violation (race between two
   * concurrent creators) into a ConflictException so the caller sees a
   * proper 409 rather than a 500.
   *
   * Audit + initial-state semantics unchanged from B02:
   *   - audit via action: "jobs.create"
   *   - no JobStatusHistory entry on creation (table tracks transitions,
   *     not initial state — matches convertTenderToJob)
   */
  async createJob(dto: CreateJobDto, actorId?: string) {
    if (!dto.name?.trim()) throw new BadRequestException("name is required.");
    if (!dto.clientId?.trim()) throw new BadRequestException("clientId is required.");

    const clientId = dto.clientId.trim();

    // FK validation: client must exist (controlled 404 instead of FK 500).
    // The name feeds the G5 slug in the generated job number.
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true }
    });
    if (!client) throw new NotFoundException("Client not found.");

    // G5 — job numbers are server-generated (J{YYMMDD}-{SLUG}-{NNN});
    // callers can no longer supply one.
    const { jobNumber, clientSlugSnapshot } = await this.jobNumberService.generate(
      clientId,
      client.name
    );

    if (dto.siteId) {
      const site = await this.prisma.site.findUnique({
        where: { id: dto.siteId.trim() },
        select: { id: true }
      });
      if (!site) throw new NotFoundException("Site not found.");
    }

    // jobNumber uniqueness — friendly pre-check. The try/catch below
    // handles the case where two concurrent requests both pass this check.
    const existing = await this.prisma.job.findUnique({
      where: { jobNumber },
      select: { id: true }
    });
    if (existing) {
      throw new ConflictException(`Job number "${jobNumber}" is already in use.`);
    }

    let created;
    try {
      created = await this.prisma.job.create({
        data: {
          jobNumber,
          clientSlugSnapshot,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          clientId,
          siteId: dto.siteId?.trim() || UNASSIGNED_SITE_ID,
          status: dto.status?.trim() || "PLANNING",
          projectManagerId: dto.projectManagerId?.trim() || null,
          supervisorId: dto.supervisorId?.trim() || null
        }
      });
    } catch (err) {
      // B02.1 race-fix: P2002 on job_number means another request
      // inserted the same number between our pre-check and this create.
      // Translate to ConflictException with the same shape as the
      // pre-check so callers see a consistent 409.
      if (isJobNumberUniqueViolation(err)) {
        throw new ConflictException(`Job number "${jobNumber}" is already in use.`);
      }
      throw err;
    }

    await this.auditService.write({
      actorId,
      action: "jobs.create",
      entityType: "Job",
      entityId: created.id,
      metadata: { jobNumber, clientId }
    });

    return this.getById(created.id);
  }

  /**
   * Patch a job's editable fields (name, description, site assignment,
   * PM/supervisor). Status changes go through {@link updateStatus};
   * `jobNumber` and `clientId` are immutable on this path.
   *
   * @throws ForbiddenException When the job is archived (read-only).
   * @throws NotFoundException When the job does not exist.
   */
  async updateJob(id: string, dto: UpdateJobDto, actorId?: string) {
    await this.ensureNotReadOnly(id);
    await this.requireJob(id);

    const updated = await this.prisma.job.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        siteId: dto.siteId ?? UNASSIGNED_SITE_ID,
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

  /**
   * Transition a job to a new status. Updates `job.status` and writes a
   * {@link JobStatusHistory} row capturing `fromStatus`, `toStatus`, the
   * optional `note`, and `actorId` — both inside the same transaction so
   * the history is always consistent with the job's current status.
   *
   * @throws ForbiddenException When the job is archived (read-only).
   * @throws NotFoundException When the job does not exist.
   */
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

  /**
   * Append a new stage to a job. `stageOrder` defaults to 0 and `status`
   * defaults to `"PLANNED"`. `startDate` / `endDate` are parsed from ISO
   * strings when provided.
   *
   * @throws ForbiddenException When the job is archived (read-only).
   * @throws NotFoundException When the job does not exist.
   */
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

  /**
   * Patch a stage, scoped to its job parent. Each field is overwritten
   * with the supplied value; date fields are re-parsed and reset to
   * `null` when omitted.
   *
   * @throws ForbiddenException When the job is archived (read-only).
   * @throws NotFoundException When the stage doesn't exist or doesn't
   *   belong to `jobId`.
   */
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

  /**
   * Create an activity under a stage. `activityOrder` defaults to 0,
   * `status` defaults to `"PLANNED"`. The stage must belong to the same
   * job — the parent linkage is validated before insert.
   *
   * @throws ForbiddenException When the job is archived (read-only).
   * @throws NotFoundException When the job or stage does not exist (the
   *   latter scoped to `jobId`).
   */
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

  /**
   * Patch an activity, scoped to its job parent. Activities can be moved
   * between stages by supplying a different `jobStageId`; the target
   * stage is verified to belong to the same job.
   *
   * @throws ForbiddenException When the job is archived (read-only).
   * @throws NotFoundException When the activity or target stage doesn't
   *   exist or doesn't belong to `jobId`.
   */
  async updateActivity(jobId: string, activityId: string, dto: UpdateJobActivityDto, actorId?: string) {
    await this.ensureNotReadOnly(jobId);
    const activity = await this.requireActivity(jobId, activityId);
    if (dto.jobStageId !== undefined) {
      await this.requireStage(jobId, dto.jobStageId);
    }

    await this.prisma.jobActivity.update({
      where: { id: activity.id },
      data: {
        jobStageId: dto.jobStageId,
        name: dto.name,
        description: dto.description,
        activityOrder: dto.activityOrder,
        status: dto.status,
        plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : undefined,
        notes: dto.notes,
        ownerUserId: dto.ownerUserId
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

  /**
   * Raise a new issue against a job. `severity` defaults to `"MEDIUM"`,
   * `status` to `"OPEN"`. `reportedById` is stamped from `actorId` so
   * the caller is always recorded as the reporter.
   *
   * @throws ForbiddenException When the job is archived (read-only).
   * @throws NotFoundException When the job does not exist.
   */
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

    // Timeline auto-log — issues don't have their own history table on the
    // job the way status changes do, so surface them via ActivityEntry so
    // they appear in the universal timeline control.
    await this.prisma.activityEntry.create({
      data: {
        entityType: "Job",
        entityId: jobId,
        kind: "system",
        body: `Issue raised: ${dto.title}`,
        authorId: actorId ?? null,
        metadata: { issueId: issue.id, severity: issue.severity }
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

  /**
   * Patch an issue, scoped to its job parent. `reportedById` is
   * preserved from creation and is not overwritten on update.
   *
   * @throws ForbiddenException When the job is archived (read-only).
   * @throws NotFoundException When the issue doesn't exist or doesn't
   *   belong to `jobId`.
   */
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

  /**
   * Create a job variation. `reference` is enforced unique within a job
   * via {@link ensureUniqueVariationReference}. `amount` is parsed into
   * a `Prisma.Decimal` when supplied; `status` defaults to `"PROPOSED"`.
   *
   * @throws ForbiddenException When the job is archived (read-only).
   * @throws NotFoundException When the job does not exist.
   * @throws ConflictException When the variation `reference` is already
   *   in use on this job.
   */
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

  /**
   * Patch a variation, scoped to its job parent. If `reference` is
   * changed it is re-checked for uniqueness within the job; if
   * unchanged the check is skipped.
   *
   * @throws ForbiddenException When the job is archived (read-only).
   * @throws NotFoundException When the variation doesn't exist or
   *   doesn't belong to `jobId`.
   * @throws ConflictException When the new `reference` collides with
   *   another variation on this job.
   */
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

  /**
   * Append a progress or daily-note entry to a job. `entryType` defaults
   * to `"PROGRESS"`; `entryDate` is required and parsed from an ISO
   * string. `authorUserId` is stamped from `actorId` so authorship is
   * always preserved.
   *
   * @throws ForbiddenException When the job is archived (read-only).
   * @throws NotFoundException When the job does not exist.
   */
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

  /**
   * Upsert the job's closeout record and stamp the job into its final
   * state. `status` defaults to `"CLOSED"`; `archivedAt` and
   * `readOnlyFrom` default to "now". For closeouts that land in
   * `"CLOSED"` or `"ARCHIVED"` the job's own status is forced to
   * `"COMPLETE"`. The transaction also writes a {@link JobStatusHistory}
   * row capturing the transition.
   *
   * Once `readOnlyFrom` is in the past the job is gated by
   * {@link ensureNotReadOnly} on every subsequent write call. This
   * method itself does not enforce read-only — closeout is the
   * transition that creates the read-only state, and re-runs are
   * allowed so the closeout record can be re-saved by admins.
   *
   * @throws NotFoundException When the job does not exist.
   */
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

  /**
   * Mark a tender client as the winner of the tender. First clears
   * `isAwarded` from any other tender client on the same tender (only
   * one can be awarded at a time), then flips the supplied client's
   * `isAwarded` flag and moves the tender into `"AWARDED"` status — all
   * inside one transaction.
   *
   * @throws NotFoundException When the tender or the tender client does
   *   not exist (the latter scoped to `tenderId`).
   */
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

  /**
   * Issue a contract against the previously-awarded tender client.
   * `contractIssuedAt` defaults to "now". Sets `contractIssued = true`
   * on the tender client and transitions the tender to
   * `"CONTRACT_ISSUED"`.
   *
   * @throws NotFoundException When the tender or the supplied tender
   *   client does not exist.
   * @throws BadRequestException When the supplied tender client has
   *   not been awarded — only the awarded client can sign a contract.
   */
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

  /**
   * Convert an awarded-and-contracted tender into a brand-new job.
   * Resolves a canonical job number via {@link JobNumberService}
   * (validating supplied or generating fresh — see {@link createJob}
   * for the same semantics), provisions a SharePoint folder under
   * `Project Operations/Jobs/{jobNumber}_{slug(name)}`, and creates the
   * job + {@link JobConversion} bridge row + a {@link SearchEntry}
   * inside one transaction. Selected tender documents are copied
   * forward as {@link DocumentLink} rows pointing at the same
   * SharePoint folder/file links. The source tender is transitioned to
   * `"CONVERTED"`.
   *
   * Document carry-forward modes:
   *   - `carryTenderDocuments = false` → no documents carried.
   *   - `carryTenderDocuments = true`, no IDs → all tender documents carried.
   *   - `carryTenderDocuments = true`, with IDs → only the listed
   *     documents are carried (all IDs must belong to this tender).
   *
   * @throws NotFoundException When the tender doesn't exist.
   * @throws ConflictException When the tender already has a source job,
   *   or when a job with the resolved `jobNumber` already exists (incl.
   *   the P2002 race during the transaction — the error payload then
   *   includes `archivedJobId` and `isArchived` so the UI can offer the
   *   reuse-archived flow).
   * @throws BadRequestException When the tender isn't in
   *   `"CONTRACT_ISSUED"`, no awarded-and-contracted client is found,
   *   `tenderDocumentIds` is supplied without `carryTenderDocuments`, or
   *   any supplied document ID doesn't belong to this tender.
   */
  async convertTenderToJob(tenderId: string, dto: ConvertTenderToJobDto, actorId?: string) {
    const tender = await this.requireTender(tenderId);

    if (tender.sourceJob) {
      throw new ConflictException("This tender has already been converted to a job.");
    }

    if (tender.status !== "CONTRACT_ISSUED") {
      throw new BadRequestException(
        "Tender must be at CONTRACT_ISSUED status before converting to a job."
      );
    }

    const awardedContractedClient = tender.tenderClients.find(
      (item) => item.isAwarded && item.contractIssued
    );

    if (!awardedContractedClient) {
      throw new BadRequestException(
        "A job can only be created after the awarded client issues a contract."
      );
    }

    // G5 — job numbers are server-generated from the awarded client
    // (J{YYMMDD}-{SLUG}-{NNN}); callers can no longer supply one.
    const { jobNumber: resolvedJobNumber, clientSlugSnapshot } =
      await this.jobNumberService.generate(
        awardedContractedClient.clientId,
        awardedContractedClient.client?.name ?? ""
      );

    const existingJob = await this.prisma.job.findFirst({
      where: {
        OR: [{ jobNumber: resolvedJobNumber }, { sourceTenderId: tenderId }]
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

    // PR sharepoint-folder-mappings — jobs root is now a DB-configured
    // path (Admin → Platform → SharePoint folder mappings). Was a
    // hardcoded "Project Operations/Jobs" that doesn't exist in live
    // SharePoint. See migration 20260714120000 for the seeded default.
    const jobsRoot = this.folderMappings
      ? await this.folderMappings.getFolderPath("JOB")
      : JobsService.LEGACY_JOBS_ROOT;
    const jobFolder = await this.sharePointService.ensureFolder(
      {
        name: dto.name,
        relativePath: `${jobsRoot}/${resolvedJobNumber}_${this.slugify(dto.name)}`,
        module: "jobs",
        linkedEntityType: "Job",
        linkedEntityId: tenderId
      },
      actorId
    );

    let job;
    try {
      job = await this.prisma.$transaction(async (tx) => {
      const createdJob = await tx.job.create({
        data: {
          jobNumber: resolvedJobNumber,
          clientSlugSnapshot,
          name: dto.name,
          description: dto.description ?? tender.description ?? null,
          clientId: awardedContractedClient.clientId,
          siteId: dto.siteId ?? UNASSIGNED_SITE_ID,
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
    } catch (err) {
      // B02.1 race-fix on the convert path. Same shape as createJob's
      // P2002 handling — if two requests race to create a job with
      // the same number, translate to 409.
      if (isJobNumberUniqueViolation(err)) {
        throw new ConflictException(`Job number "${resolvedJobNumber}" is already in use.`);
      }
      throw err;
    }

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

  /**
   * Reopen an archived job and attach it to a fresh tender conversion
   * as a new stage. Reuses the existing job row (its `jobNumber` is
   * unchanged, so no P2002 race is possible on this path) but: clears
   * its closeout to `"REOPENED"` with null `archivedAt` / `readOnlyFrom`,
   * sets status `"ACTIVE"`, links it to the new tender via
   * {@link JobConversion}, and inserts a new {@link JobStage} named
   * `dto.stageName` so the new work has its own home. Document
   * carry-forward semantics match {@link convertTenderToJob}.
   *
   * The archived job is looked up by `archivedJobId` when supplied,
   * else by case-insensitive `jobNumber` match restricted to archived
   * rows.
   *
   * @throws NotFoundException When the tender doesn't exist.
   * @throws ConflictException When the tender already has a source
   *   job, or when no reusable archived job matches the lookup.
   * @throws BadRequestException When no awarded-and-contracted client
   *   is found, or document carry-forward inputs are inconsistent
   *   (same rules as {@link convertTenderToJob}).
   */
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

      // No B02.1 race-fix needed here: this path uses tx.job.update and
      // does NOT change jobNumber, so P2002 on the job_number unique
      // constraint cannot occur. (PR B05.)
      const job = await this.prisma.$transaction(async (tx) => {
        const reopenedJob = await tx.job.update({
          where: { id: existingJob.id },
          data: {
            name: dto.name,
            description: dto.description ?? tender.description ?? null,
            clientId: awardedContractedClient.clientId,
            siteId: dto.siteId ?? UNASSIGNED_SITE_ID,
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

  /**
   * Move a tender backwards through its lifecycle to `dto.targetStage`
   * (one of `DRAFT` / `IN_PROGRESS` / `SUBMITTED` / `AWARDED` /
   * `CONTRACT_ISSUED`). Clears award + contract flags on every tender
   * client first, then — for the `AWARDED` and `CONTRACT_ISSUED`
   * targets only — re-applies them on the supplied
   * `dto.tenderClientId` (falling back to the previously-awarded or
   * first-listed client). Existing `contractIssuedAt` is preserved
   * when rolling back to `CONTRACT_ISSUED`.
   *
   * If the tender already has a `sourceJob`, that job is archived
   * (closeout status `"ARCHIVED"`, `archivedAt = now`) and detached
   * from the tender (`sourceTenderId = null`) so future conversions
   * don't collide. The {@link JobConversion} bridge row is removed.
   *
   * @throws NotFoundException When the tender or the supplied tender
   *   client (for award-path targets) does not exist.
   * @throws BadRequestException When `AWARDED` / `CONTRACT_ISSUED` is
   *   requested but no client is supplied or resolvable.
   */
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

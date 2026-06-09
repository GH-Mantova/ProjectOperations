import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ArchiveQueryDto } from "./dto/archive-query.dto";

/**
 * Service layer for the §16 closeout/archive module — read-only views over
 * jobs that have reached the CLOSED or ARCHIVED state.
 *
 * The archive does not mutate any underlying data: state transitions onto a
 * job (CLOSED → ARCHIVED) are owned by the jobs/closeout modules. The two
 * methods here simply project that state into:
 *
 *  1. A paginated summary list keyed on the linked `JobCloseout` row, and
 *  2. A full nested export including stages, activities, issues, variations,
 *     progress entries, status history, linked documents, and form
 *     submissions.
 *
 * Filter semantics:
 *  - `status=ARCHIVED` is stricter than `status=CLOSED` — ARCHIVED requires a
 *    non-null `closeout.archivedAt`; CLOSED matches both CLOSED and ARCHIVED
 *    closeout rows.
 *  - `year` matches jobs by `closeout.archivedAt` when set, falling back to
 *    `closeout.createdAt` when the job is closed but not yet archived. This
 *    keeps the year filter useful during the close → archive window.
 */
@Injectable()
export class ArchiveService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List archived/closed jobs with search, client, year, and status filters.
   * Orders by `updatedAt desc` and returns a flat `{ items, total, page,
   * pageSize }` envelope where each item carries the closeout-derived status
   * and dates rather than the raw job status.
   *
   * @param query - validated filter and pagination parameters
   * @returns paginated envelope of summary rows
   */
  async list(query: ArchiveQueryDto) {
    const where = this.buildWhere(query);
    const skip = (query.page - 1) * query.pageSize;

    const [jobs, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          closeout: { select: { status: true, archivedAt: true, createdAt: true, updatedAt: true } }
        },
        orderBy: [{ updatedAt: "desc" }],
        skip,
        take: query.pageSize
      }),
      this.prisma.job.count({ where })
    ]);

    return {
      items: jobs.map((job) => ({
        id: job.id,
        jobNumber: job.jobNumber,
        name: job.name,
        clientName: job.client.name,
        closedAt: job.closeout?.createdAt?.toISOString() ?? null,
        archivedAt: job.closeout?.archivedAt?.toISOString() ?? null,
        status: job.closeout?.status ?? job.status
      })),
      total,
      page: query.page,
      pageSize: query.pageSize
    };
  }

  /**
   * Build the full read-only archive export for a single job.
   *
   * Includes the job header (client, site, PM, supervisor), all stages and
   * activities, the issues/variations/progressEntries/statusHistory streams,
   * the closeout record (with checklist JSON and archiver identity), every
   * `DocumentLink` whose linked entity is this job (with file/folder
   * projections), and every `FormSubmission` for the job (with values,
   * attachments, and signatures projected to flat shapes).
   *
   * The export is a point-in-time snapshot — no rows are written. The job is
   * not required to be CLOSED or ARCHIVED; callers needing that gate must
   * enforce it themselves.
   *
   * @param jobId - id of the job to export
   * @returns nested snapshot suitable for compliance download and audit review
   * @throws NotFoundException — when no job exists with the given id
   */
  async export(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        client: true,
        site: true,
        projectManager: { select: { id: true, firstName: true, lastName: true, email: true } },
        supervisor: { select: { id: true, firstName: true, lastName: true, email: true } },
        stages: { orderBy: { stageOrder: "asc" } },
        activities: { orderBy: [{ jobStageId: "asc" }, { activityOrder: "asc" }] },
        issues: { orderBy: { reportedAt: "desc" } },
        variations: { orderBy: { createdAt: "desc" } },
        progressEntries: { orderBy: { entryDate: "desc" } },
        statusHistory: { orderBy: { changedAt: "desc" } },
        closeout: {
          include: {
            archivedBy: { select: { id: true, firstName: true, lastName: true } }
          }
        }
      }
    });

    if (!job) {
      throw new NotFoundException("Archived job not found.");
    }

    const [documents, formSubmissions] = await Promise.all([
      this.prisma.documentLink.findMany({
        where: { linkedEntityType: "Job", linkedEntityId: jobId },
        include: { fileLink: true, folderLink: true },
        orderBy: [{ category: "asc" }, { versionNumber: "desc" }]
      }),
      this.prisma.formSubmission.findMany({
        where: { jobId },
        include: {
          templateVersion: {
            include: { template: { select: { id: true, name: true, code: true } } }
          },
          values: true,
          attachments: true,
          signatures: true
        },
        orderBy: { submittedAt: "desc" }
      })
    ]);

    return {
      exportedAt: new Date().toISOString(),
      summary: {
        id: job.id,
        jobNumber: job.jobNumber,
        name: job.name,
        description: job.description,
        status: job.status,
        client: job.client,
        site: job.site,
        projectManager: job.projectManager,
        supervisor: job.supervisor,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      },
      closeout: job.closeout,
      checklist: (job.closeout?.checklistJson as Prisma.JsonValue) ?? null,
      stages: job.stages,
      activities: job.activities,
      issues: job.issues,
      variations: job.variations,
      progressEntries: job.progressEntries,
      statusHistory: job.statusHistory,
      documents: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        description: doc.description,
        category: doc.category,
        module: doc.module,
        status: doc.status,
        versionLabel: doc.versionLabel,
        versionNumber: doc.versionNumber,
        documentFamilyKey: doc.documentFamilyKey,
        isCurrentVersion: doc.isCurrentVersion,
        fileName: doc.fileLink?.name ?? null,
        webUrl: doc.fileLink?.webUrl ?? null,
        folderPath: doc.folderLink?.relativePath ?? null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
      })),
      formSubmissions: formSubmissions.map((submission) => ({
        id: submission.id,
        templateCode: submission.templateVersion.template.code,
        templateName: submission.templateVersion.template.name,
        versionNumber: submission.templateVersion.versionNumber,
        status: submission.status,
        submittedAt: submission.submittedAt,
        summary: submission.summary,
        values: submission.values.map((value) => ({
          fieldKey: value.fieldKey,
          valueText: value.valueText,
          valueNumber: value.valueNumber,
          valueDateTime: value.valueDateTime,
          valueJson: value.valueJson
        })),
        attachments: submission.attachments.map((attachment) => ({
          fieldKey: attachment.fieldKey,
          fileName: attachment.fileName,
          fileUrl: attachment.fileUrl
        })),
        signatures: submission.signatures.map((signature) => ({
          fieldKey: signature.fieldKey,
          signerName: signature.signerName,
          signedAt: signature.signedAt
        }))
      }))
    };
  }

  private buildWhere(query: ArchiveQueryDto): Prisma.JobWhereInput {
    const filters: Prisma.JobWhereInput[] = [];

    const statusFilter = query.status ?? "ALL";
    const closeoutFilter: Prisma.JobCloseoutWhereInput = {};
    if (statusFilter === "ARCHIVED") {
      closeoutFilter.archivedAt = { not: null };
    } else if (statusFilter === "CLOSED") {
      closeoutFilter.status = { in: ["CLOSED", "ARCHIVED"] };
    } else {
      closeoutFilter.status = { in: ["CLOSED", "ARCHIVED"] };
    }
    filters.push({ closeout: { is: closeoutFilter } });

    if (query.search) {
      filters.push({
        OR: [
          { jobNumber: { contains: query.search, mode: "insensitive" } },
          { name: { contains: query.search, mode: "insensitive" } },
          { client: { is: { name: { contains: query.search, mode: "insensitive" } } } }
        ]
      });
    }

    if (query.clientId) {
      filters.push({ clientId: query.clientId });
    }

    if (query.year) {
      const start = new Date(Date.UTC(query.year, 0, 1));
      const end = new Date(Date.UTC(query.year + 1, 0, 1));
      filters.push({
        OR: [
          { closeout: { is: { archivedAt: { gte: start, lt: end } } } },
          { closeout: { is: { archivedAt: null, createdAt: { gte: start, lt: end } } } }
        ]
      });
    }

    return filters.length === 1 ? filters[0] : { AND: filters };
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ArchiveQueryDto } from "./dto/archive-query.dto";

@Injectable()
export class ArchiveService {
  constructor(private readonly prisma: PrismaService) {}

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

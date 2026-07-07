import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export type JpmReconciliationReport = {
  linkedPairs: number;
  orphanJobs: number;
  orphanProjects: number;
  jobsTotal: number;
  projectsTotal: number;
  jobsWithoutSourceTender: number;
  projectsWithoutSourceTender: number;
  generatedAt: string;
};

export type JpmBackfillResult = {
  linked: number;
  orphanJobs: number;
  orphanProjects: number;
};

/**
 * Job/Project merge Phase A support service.
 *
 * Phase A adds a nullable Job.survivingProjectId + Project.sourceJobId pair
 * (survivor = Project) and backfills them for records that share a
 * source_tender_id. This service exposes:
 *  - {@link backfillLinks} — idempotent SQL backfill callable from tests /
 *    seeds. The migration itself runs the same statements once at deploy;
 *    this exists so tests can re-assert idempotency on a live client.
 *  - {@link buildReconciliationReport} — read-only counts so an admin can
 *    eyeball coverage (linked vs orphan) before Phase B repoints anything.
 *
 * No behaviour changes and no writes beyond the two nullable link columns.
 */
@Injectable()
export class JpmService {
  constructor(private readonly prisma: PrismaService) {}

  async backfillLinks(): Promise<JpmBackfillResult> {
    await this.prisma.$executeRawUnsafe(
      `UPDATE "jobs" AS j
          SET "surviving_project_id" = p."id"
         FROM "projects" AS p
        WHERE j."source_tender_id" IS NOT NULL
          AND p."source_tender_id" = j."source_tender_id"
          AND j."surviving_project_id" IS NULL`
    );
    await this.prisma.$executeRawUnsafe(
      `UPDATE "projects" AS p
          SET "source_job_id" = j."id"
         FROM "jobs" AS j
        WHERE p."source_tender_id" IS NOT NULL
          AND j."source_tender_id" = p."source_tender_id"
          AND p."source_job_id" IS NULL`
    );
    const report = await this.buildReconciliationReport();
    return {
      linked: report.linkedPairs,
      orphanJobs: report.orphanJobs,
      orphanProjects: report.orphanProjects
    };
  }

  async buildReconciliationReport(): Promise<JpmReconciliationReport> {
    const [linkedPairs, orphanJobs, orphanProjects, jobsTotal, projectsTotal, jobsNoTender, projectsNoTender] =
      await Promise.all([
        this.prisma.job.count({ where: { survivingProjectId: { not: null } } }),
        this.prisma.job.count({ where: { survivingProjectId: null } }),
        this.prisma.project.count({ where: { sourceJobId: null } }),
        this.prisma.job.count(),
        this.prisma.project.count(),
        this.prisma.job.count({ where: { sourceTenderId: null } }),
        this.prisma.project.count({ where: { sourceTenderId: null } })
      ]);

    return {
      linkedPairs,
      orphanJobs,
      orphanProjects,
      jobsTotal,
      projectsTotal,
      jobsWithoutSourceTender: jobsNoTender,
      projectsWithoutSourceTender: projectsNoTender,
      generatedAt: new Date().toISOString()
    };
  }
}

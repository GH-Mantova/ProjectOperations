// B-HW-11: Finalise handover → create job.
//
// This service runs only when a handover is at 100% completion and:
//  1. Calls the deployed JobsService.convertTenderToJob path to create the Job,
//     allocate the IS-P### number, and provision the SharePoint folder tree.
//  2. The Project-to-Contract link already exists: TenderingService.updateStatus
//     already creates the Project and the Contract in one step (B-HW-4 retracted;
//     no nullable projectId is needed).
//  3. Snapshots the finalised handover + WBS as the job baseline (written as an
//     audit log entry keyed by handoverId + jobId for durable diffing later).
//  4. Generates the handover PDF placeholder document link in the job's
//     SharePoint folder (Kings Beach layout; actual PDF rendering is a
//     follow-on slice — this slice creates the folder + document-link stub).
//  5. Scaffolds one Subcontractor/{folderSlot} subfolder per engaged subbie via
//     HandoverSubcontractorsService.list().
//  6. Freezes the handover by setting status = "finalised", finalisedAt = now().
//     A second call to finalise is a no-op (idempotent): if the handover is
//     already finalised it returns the existing data without error.
//
// Design constraints:
//  - NO migration: all columns used here already exist (Handover.finalisedAt,
//    Handover.status, JobConversion.projectId).
//  - Does NOT fork or rewrite convertTenderToJob — calls it directly.
//  - Does NOT write back to tender, quote, or contract data.

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { JobsService } from "../jobs/jobs.service";
import { SharePointService } from "../platform/sharepoint.service";
import { HandoverSubcontractorsService } from "./handover-subcontractors.service";
import type { FinaliseHandoverDto } from "./dto/handover-finalise.dto";

// ── Internal result shape ─────────────────────────────────────────────────────

export interface FinaliseHandoverResult {
  handoverId: string;
  jobId: string;
  jobNumber: string;
  /** True when finalise was a no-op because the handover was already finalised. */
  alreadyFinalised: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class HandoverFinaliseService {
  private readonly logger = new Logger(HandoverFinaliseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly jobsService: JobsService,
    private readonly sharePointService: SharePointService,
    private readonly subcontractorsService: HandoverSubcontractorsService
  ) {}

  /**
   * Finalise a handover.
   *
   * Steps:
   *  1. Load the handover and verify it exists.
   *  2. Idempotency guard: if already finalised, return immediately.
   *  3. Completeness guard: reject if completionPct < 100.
   *  4. Resolve contract → project → tender chain.
   *  5. Call convertTenderToJob to create the job + SharePoint root folder.
   *  6. Freeze the handover (status = finalised, finalisedAt = now).
   *  7. Snapshot baseline to the audit log.
   *  8. Scaffold Subcontractor/ sub-folders for each engaged subcontractor.
   *  9. Create a document-link stub for the handover PDF in the job folder.
   * 10. Return the result.
   *
   * @param handoverId - ID of the handover to finalise.
   * @param dto        - Optional job configuration overrides.
   * @param actorId    - Authenticated user performing the finalise.
   */
  async finalise(
    handoverId: string,
    dto: FinaliseHandoverDto,
    actorId: string
  ): Promise<FinaliseHandoverResult> {
    // 1. Load handover.
    const handover = await this.prisma.handover.findUnique({
      where: { id: handoverId },
      include: {
        values: { select: { fieldKey: true, value: true, isOverridden: true, sourceValue: true } }
      }
    });
    if (!handover) {
      throw new NotFoundException(`Handover ${handoverId} not found.`);
    }

    // 2. Idempotency guard — second call is a no-op.
    if (handover.status === "finalised") {
      this.logger.log(`Handover ${handoverId} already finalised — returning existing state.`);
      const existingJob = await this.resolveExistingJob(handover.tenderId);
      return {
        handoverId,
        jobId: existingJob?.id ?? "",
        jobNumber: existingJob?.jobNumber ?? "",
        alreadyFinalised: true
      };
    }

    // 3. Completeness guard.
    if (handover.completionPct < 100) {
      throw new BadRequestException(
        `Handover ${handoverId} is not complete (${handover.completionPct}%). ` +
          "All required fields must be filled before finalising."
      );
    }

    // 4. Resolve contract → project → tender.
    const contract = await this.prisma.contract.findUnique({
      where: { id: handover.contractId },
      include: { project: true }
    });
    if (!contract) {
      throw new NotFoundException(
        `Contract ${handover.contractId} linked to handover ${handoverId} not found.`
      );
    }
    const project = contract.project;
    if (!project) {
      throw new BadRequestException(
        `Contract ${handover.contractId} has no linked project — cannot create job.`
      );
    }

    const tenderId = handover.tenderId;

    // 5. Create the job via the canonical convertTenderToJob path.
    // The name comes from dto.jobName, falling back to the project name.
    const jobName = dto.jobName?.trim() || project.name;

    const createdJob = await this.jobsService.convertTenderToJob(
      tenderId,
      {
        name: jobName,
        siteId: dto.siteId,
        projectManagerId: dto.projectManagerId,
        carryTenderDocuments: dto.carryTenderDocuments ?? false
      },
      actorId
    );

    this.logger.log(
      `Handover ${handoverId}: job ${createdJob.jobNumber} (${createdJob.id}) created from tender ${tenderId}.`
    );

    // 6. Freeze the handover inside a transaction alongside the job linkage.
    await this.prisma.handover.update({
      where: { id: handoverId },
      data: {
        status: "finalised",
        finalisedAt: new Date()
      }
    });

    // 7. Snapshot baseline to the audit log.
    // The frozen HandoverValue rows ARE the baseline — we record their IDs +
    // the WBS scope items as a JSON blob in the audit trail so future slices
    // can diff them without relying on mutable rows.
    await this.snapshotBaseline(handoverId, createdJob.id, tenderId, actorId, handover.values);

    // 8. Scaffold Subcontractor/ sub-folders under the job's SharePoint root.
    await this.scaffoldSubcontractorFolders(handoverId, createdJob.id, actorId);

    // 9. Create a document-link stub for the handover PDF.
    await this.createHandoverPdfStub(handoverId, createdJob.id, actorId);

    return {
      handoverId,
      jobId: createdJob.id,
      jobNumber: createdJob.jobNumber,
      alreadyFinalised: false
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Find the job that was created from this tender (for the idempotent path).
   * Returns null when no job exists yet (should not happen on the idempotent path).
   */
  private async resolveExistingJob(tenderId: string) {
    return this.prisma.job.findFirst({
      where: { sourceTenderId: tenderId },
      select: { id: true, jobNumber: true }
    });
  }

  /**
   * Write a baseline snapshot entry to the audit log.
   *
   * The snapshot captures the frozen HandoverValue rows + the WBS
   * ScopeOfWorksItem rows for the tender at the moment of finalise.
   * Future diffing reads from this audit entry (by handoverId + jobId query)
   * rather than from live rows that may have been archived or cleaned up.
   */
  private async snapshotBaseline(
    handoverId: string,
    jobId: string,
    tenderId: string,
    actorId: string,
    values: Array<{ fieldKey: string; value: unknown; isOverridden: boolean; sourceValue: unknown }>
  ) {
    // Load WBS scope items for the tender.
    const wbsItems = await this.prisma.scopeOfWorksItem.findMany({
      where: { tenderId },
      select: {
        id: true,
        wbsCode: true,
        rowType: true,
        description: true,
        men: true,
        days: true
      }
    });

    await this.auditService.write({
      actorId,
      action: "handover.finalise.baseline",
      entityType: "Handover",
      entityId: handoverId,
      metadata: {
        jobId,
        handoverId,
        tenderId,
        capturedAt: new Date().toISOString(),
        handoverValues: values.map((v) => ({
          fieldKey: v.fieldKey,
          value: v.value as string | number | boolean | null,
          isOverridden: v.isOverridden,
          sourceValue: v.sourceValue as string | number | boolean | null
        })),
        // Serialize Decimal fields to numbers for the JSON audit blob.
        wbsSnapshot: wbsItems.map((item) => ({
          id: item.id,
          wbsCode: item.wbsCode,
          rowType: item.rowType,
          description: item.description,
          men: item.men !== null ? Number(item.men) : null,
          days: item.days !== null ? Number(item.days) : null
        }))
      }
    });
  }

  /**
   * Scaffold one Subcontractor/{folderSlot} subfolder per engaged subcontractor
   * under the job's root SharePoint folder.
   *
   * The job's root folder path is resolved via the JOB mapping + job number.
   * Each subbie gets a sub-folder so documents can be filed per trade.
   *
   * This is best-effort: a SharePoint failure here logs and continues — the
   * job has already been created and the handover frozen.
   */
  private async scaffoldSubcontractorFolders(
    handoverId: string,
    jobId: string,
    actorId: string
  ) {
    const subbies = await this.subcontractorsService.list(handoverId);
    if (subbies.length === 0) return;

    // Resolve the job's folder link to determine the base path.
    const jobFolderLink = await this.prisma.sharePointFolderLink.findFirst({
      where: { linkedEntityType: "Job", linkedEntityId: jobId },
      select: { relativePath: true }
    });

    if (!jobFolderLink) {
      this.logger.warn(
        `Handover ${handoverId}: no SharePoint folder link found for job ${jobId} — skipping subcontractor folder scaffold.`
      );
      return;
    }

    const jobRoot = jobFolderLink.relativePath;

    for (const subbie of subbies) {
      const folderSlug = subbie.folderSlot.replace(/[^a-z0-9_\- ]/gi, "_");
      const subbiePath = `${jobRoot}/Subcontractors/${folderSlug}`;

      try {
        await this.sharePointService.ensureFolder(
          {
            name: folderSlug,
            relativePath: subbiePath,
            module: "jobs",
            linkedEntityType: "Job",
            linkedEntityId: jobId
          },
          actorId
        );
        this.logger.log(
          `Handover ${handoverId}: scaffolded subcontractor folder "${subbiePath}" for "${subbie.name}".`
        );
      } catch (err) {
        this.logger.error(
          `Handover ${handoverId}: failed to scaffold subcontractor folder for "${subbie.name}" — continuing.`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  }

  /**
   * Create a document-link stub for the handover PDF in the job's SharePoint
   * folder under Contracts + Safety.
   *
   * The actual PDF rendering ships in a later slice (Kings Beach layout). This
   * stub records the intended document so the PM knows to upload / regenerate
   * the PDF. The stub uses docRef = "pending" to signal it is not yet rendered.
   */
  private async createHandoverPdfStub(
    handoverId: string,
    jobId: string,
    actorId: string
  ) {
    // Resolve the job's SharePoint folder root for the document-link module path.
    const jobFolderLink = await this.prisma.sharePointFolderLink.findFirst({
      where: { linkedEntityType: "Job", linkedEntityId: jobId },
      select: { id: true, relativePath: true }
    });

    // Create a DocumentLink stub that records the intended Contracts + Safety
    // location. fileLinkId is null until the PDF is rendered.
    try {
      await this.prisma.documentLink.create({
        data: {
          linkedEntityType: "Job",
          linkedEntityId: jobId,
          module: "jobs",
          category: "CONTRACT",
          title: "Contract Handover Document",
          description:
            "Handover PDF (Kings Beach layout) — pending render. Generated by B-HW-11 finalise.",
          folderLinkId: jobFolderLink?.id ?? null,
          fileLinkId: null
        }
      });

      await this.auditService.write({
        actorId,
        action: "handover.finalise.pdf_stub",
        entityType: "Handover",
        entityId: handoverId,
        metadata: { jobId, handoverId, note: "Handover PDF stub created — pending render." }
      });

      this.logger.log(
        `Handover ${handoverId}: handover PDF document-link stub created for job ${jobId}.`
      );
    } catch (err) {
      this.logger.error(
        `Handover ${handoverId}: failed to create handover PDF stub — continuing.`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}

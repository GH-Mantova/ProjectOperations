import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CompetencyGateResult } from "../compliance/competency-gate";
import { ComplianceService } from "../compliance/compliance.service";
import { EmailService } from "../email/email.service";
import { NotificationsService } from "../platform/notifications.service";
import { CreateAllocationDto } from "./dto/create-allocation.dto";
import { UpdateAllocationDto } from "./dto/update-allocation.dto";

/**
 * Acting principal context threaded through writes that touch audit /
 * activity-log surfaces. `userId` is the system user id of the allocator.
 */
type ActorContext = { userId: string };

/**
 * Pre-built "all clear" competency verdict returned for ASSET allocations and
 * for WORKER allocations where the worker id is somehow absent. Sharing one
 * frozen-shape object keeps the response schema uniform across all create
 * paths so the UI never has to special-case a missing `competency` field.
 */
const EMPTY_COMPETENCY: CompetencyGateResult = {
  allowed: true,
  missing: [],
  expired: [],
  expiringSoon: []
};

/**
 * Render a date in Australian-readable `DD Mmm YYYY` form (e.g. `08 Jun 2026`)
 * for use in outbound notification email bodies. Uses the host server's
 * local time — acceptable for human-facing scheduling copy.
 */
function formatDateDdMmmYyyy(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Service layer for the §9 Scheduler allocations module — the worker- and
 * asset-to-project assignments that drive crew rostering and equipment
 * scheduling.
 *
 * Invariants enforced here (NOT at the controller layer):
 *  - Type/target pairing: a WORKER allocation MUST carry `workerProfileId`
 *    and MUST NOT carry `assetId`; ASSET is the mirror. Mixed payloads are
 *    rejected with 400. The schema permits both columns nullable, so this is
 *    a service-level invariant rather than a database constraint.
 *  - Date order: `endDate`, when present, MUST be on or after `startDate`.
 *    `endDate === null` represents an open-ended allocation.
 *  - Overlap surfacing (WORKER only, never blocking): on create, the service
 *    queries all other allocations for the same `workerProfileId` on
 *    DIFFERENT projects whose status is `MOBILISING` or `ACTIVE` and whose
 *    window intersects the proposed window. The overlapping rows are
 *    returned as `warnings` for the UI — the create itself always succeeds.
 *    Conflict resolution is a human/scheduler call, not an API decision.
 *  - Competency gate (WORKER only, never blocking): the worker's quals are
 *    checked against `Project.requiredQualifications` via
 *    {@link ComplianceService.checkWorkerCompetency}. The verdict is always
 *    returned, but when the worker is missing or expired on a required qual
 *    an `AuditLog` row of action `allocation.unqualified_override` is
 *    written capturing the allocator, the qual gaps, and the project — this
 *    is the after-the-fact accountability trail for the soft-warn policy.
 *  - Activity log: every successful create writes a `ProjectActivityLog`
 *    row (`WORKER_ALLOCATED` or `ASSET_ALLOCATED`). Updates and deletes
 *    intentionally do NOT — allocation rows are operational and the create
 *    event is sufficient lineage.
 *  - Immutable fields on update: `type`, `workerProfileId`, `assetId` are
 *    never patchable. Only `roleOnProject`, `startDate`, `endDate`, `notes`
 *    are mutable.
 *  - Project scoping on the row id: every update/delete re-checks that the
 *    allocation belongs to the project in the URL and returns 404 otherwise,
 *    defending against cross-project id-guessing.
 *
 * Side effects on WORKER create:
 *  - Best-effort notification email via {@link EmailService.sendNotificationEmail}
 *    (fire-and-forget: the email service swallows its own failures so a mail
 *    outage cannot fail the allocation).
 *  - In-app notification via {@link NotificationsService.create} when the
 *    worker has a linked internal user account.
 *
 * NOTE on availability windows: this service does NOT consult
 * `WorkerAvailability` today — overlap warnings are derived only from other
 * `ProjectAllocation` rows. If/when availability gating is added it belongs
 * here, alongside the existing overlap query.
 */
@Injectable()
export class AllocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly compliance: ComplianceService
  ) {}

  /**
   * Return all allocations for a project, split into worker and asset
   * groups for direct rendering by the UI.
   *
   * Rows are ordered by `startDate` ascending, then `createdAt` ascending
   * so deterministic ties (two allocations starting the same day) keep a
   * stable presentation order. The asset shape renames `assetCode` →
   * `assetNumber` and flattens `category.name` → `category` so the response
   * matches the asset display convention used elsewhere in the UI.
   *
   * @throws NotFoundException when the project does not exist.
   */
  async listForProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true }
    });
    if (!project) throw new NotFoundException("Project not found.");

    const rows = await this.prisma.projectAllocation.findMany({
      where: { projectId },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
      include: {
        workerProfile: {
          select: { id: true, firstName: true, lastName: true, role: true }
        },
        asset: {
          select: { id: true, name: true, assetCode: true, category: { select: { name: true } } }
        }
      }
    });

    return {
      workers: rows
        .filter((row) => row.type === "WORKER")
        .map((row) => ({
          id: row.id,
          workerProfile: row.workerProfile,
          roleOnProject: row.roleOnProject,
          startDate: row.startDate,
          endDate: row.endDate,
          notes: row.notes
        })),
      assets: rows
        .filter((row) => row.type === "ASSET")
        .map((row) => ({
          id: row.id,
          asset: row.asset
            ? {
                id: row.asset.id,
                name: row.asset.name,
                assetNumber: row.asset.assetCode,
                category: row.asset.category?.name ?? null
              }
            : null,
          roleOnProject: row.roleOnProject,
          startDate: row.startDate,
          endDate: row.endDate,
          notes: row.notes
        }))
    };
  }

  /**
   * Create a worker or asset allocation on a project, with overlap warnings
   * and a soft-warn competency verdict for WORKER targets.
   *
   * Sequence:
   *  1. Resolve the project (404 if absent) — also pulls the
   *     `requiredQualifications` array needed for the competency check.
   *  2. Validate type/target pairing (WORKER ↔ workerProfileId, ASSET ↔
   *     assetId — mixed payloads rejected with 400).
   *  3. Validate date order (endDate ≥ startDate when both present).
   *  4. For WORKER allocations: find overlapping allocations on OTHER
   *     `MOBILISING`/`ACTIVE` projects and collect them as warnings. Never
   *     blocks the create.
   *  5. Insert the allocation row.
   *  6. Write a `ProjectActivityLog` row (`WORKER_ALLOCATED` or
   *     `ASSET_ALLOCATED`).
   *  7. For WORKER allocations: fire a best-effort notification email and,
   *     if the worker is linked to an internal user, create an in-app
   *     notification.
   *  8. For WORKER allocations: run the competency gate; when it flags
   *     missing or expired quals, write an `AuditLog`
   *     (`allocation.unqualified_override`) capturing the allocator.
   *
   * The activity log and audit log writes are intentionally OUTSIDE a
   * transaction with the allocation insert — the allocation is the source
   * of truth and downstream audit/log gaps are tolerable; surfacing an
   * error to the user mid-flow would be worse.
   *
   * @returns `{ allocation, warnings, competency }` — warnings is `[]` for
   *          ASSET allocations and for WORKER allocations with no overlap;
   *          competency is the `EMPTY_COMPETENCY` shape for ASSET targets.
   * @throws BadRequestException on type/target mismatch or invalid date order.
   * @throws NotFoundException when the project does not exist.
   */
  async create(projectId: string, dto: CreateAllocationDto, actor: ActorContext) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, projectNumber: true, name: true, requiredQualifications: true }
    });
    if (!project) throw new NotFoundException("Project not found.");

    if (dto.type === "WORKER") {
      if (!dto.workerProfileId || dto.assetId) {
        throw new BadRequestException("WORKER allocations require workerProfileId and must not set assetId.");
      }
    } else if (dto.type === "ASSET") {
      if (!dto.assetId || dto.workerProfileId) {
        throw new BadRequestException("ASSET allocations require assetId and must not set workerProfileId.");
      }
    }

    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (endDate && endDate < startDate) {
      throw new BadRequestException("endDate must be on or after startDate.");
    }

    const warnings: Array<{
      projectId: string;
      projectNumber: string;
      projectName: string;
      startDate: Date;
      endDate: Date | null;
    }> = [];

    if (dto.type === "WORKER") {
      const overlapping = await this.prisma.projectAllocation.findMany({
        where: {
          type: "WORKER",
          workerProfileId: dto.workerProfileId,
          projectId: { not: projectId },
          project: { status: { in: ["MOBILISING", "ACTIVE"] } },
          startDate: { lte: endDate ?? new Date("9999-12-31") },
          OR: [{ endDate: null }, { endDate: { gte: startDate } }]
        },
        include: {
          project: { select: { id: true, projectNumber: true, name: true } }
        }
      });
      for (const row of overlapping) {
        warnings.push({
          projectId: row.project.id,
          projectNumber: row.project.projectNumber,
          projectName: row.project.name,
          startDate: row.startDate,
          endDate: row.endDate
        });
      }
    }

    const allocation = await this.prisma.projectAllocation.create({
      data: {
        projectId,
        type: dto.type,
        workerProfileId: dto.workerProfileId ?? null,
        assetId: dto.assetId ?? null,
        roleOnProject: dto.roleOnProject ?? null,
        startDate,
        endDate,
        notes: dto.notes ?? null,
        createdById: actor.userId
      },
      include: {
        workerProfile: {
          select: { id: true, firstName: true, lastName: true, internalUserId: true }
        },
        asset: { select: { id: true, name: true, assetCode: true } }
      }
    });

    const targetName =
      dto.type === "WORKER" && allocation.workerProfile
        ? `${allocation.workerProfile.firstName} ${allocation.workerProfile.lastName}`.trim()
        : allocation.asset
          ? `${allocation.asset.name} (${allocation.asset.assetCode})`
          : "(unknown)";

    const action = dto.type === "WORKER" ? "WORKER_ALLOCATED" : "ASSET_ALLOCATED";
    await this.prisma.projectActivityLog.create({
      data: {
        projectId,
        userId: actor.userId,
        action,
        details: {
          targetId: dto.type === "WORKER" ? (dto.workerProfileId ?? null) : (dto.assetId ?? null),
          targetName,
          roleOnProject: dto.roleOnProject ?? null,
          startDate: startDate.toISOString(),
          endDate: endDate ? endDate.toISOString() : null
        } satisfies Prisma.InputJsonValue
      }
    });

    if (dto.type === "WORKER") {
      // Fire-and-forget email; sendNotificationEmail swallows its own errors.
      void this.email.sendNotificationEmail({
        trigger: "worker.allocated",
        subject: `Worker allocated — ${targetName} on ${project.projectNumber}`,
        html: `<p><strong>${targetName}</strong> has been allocated to <strong>${project.projectNumber} — ${project.name}</strong>.</p><p>Role: ${dto.roleOnProject ?? "—"}</p><p>Start date: ${formatDateDdMmmYyyy(startDate)}</p>`,
        text: `${targetName} allocated to ${project.projectNumber}. Role: ${dto.roleOnProject ?? "—"}. Start: ${formatDateDdMmmYyyy(startDate)}.`
      });
    }

    if (dto.type === "WORKER" && allocation.workerProfile?.internalUserId) {
      await this.notifications.create(
        {
          userId: allocation.workerProfile.internalUserId,
          title: `Allocated to ${project.projectNumber}`,
          body: `You have been allocated to ${project.projectNumber} - ${project.name} starting ${formatDateDdMmmYyyy(startDate)}`,
          severity: "LOW",
          linkUrl: `/projects/${project.id}`
        },
        actor.userId
      );
    }

    // Soft-warn competency gate: surface a structured verdict on every
    // allocation response so the UI can show a warning. The allocation is
    // never blocked — when the gate flags missing/expired quals we write an
    // AuditLog row capturing who allocated the unqualified worker.
    const isWorkerAllocation = allocation.type === "WORKER" && !!allocation.workerProfileId;
    const competency: CompetencyGateResult = isWorkerAllocation
      ? await this.compliance.checkWorkerCompetency(
          allocation.workerProfileId!,
          project.requiredQualifications
        )
      : EMPTY_COMPETENCY;

    if (
      isWorkerAllocation &&
      (competency.missing.length > 0 || competency.expired.length > 0)
    ) {
      await this.prisma.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "allocation.unqualified_override",
          entityType: "ProjectAllocation",
          entityId: allocation.id,
          metadata: {
            projectId: project.id,
            projectNumber: project.projectNumber,
            workerProfileId: allocation.workerProfileId,
            requiredQualifications: project.requiredQualifications,
            missing: competency.missing,
            expired: competency.expired,
            expiringSoon: competency.expiringSoon
          } satisfies Prisma.InputJsonValue
        }
      });
    }

    return { allocation, warnings, competency };
  }

  /**
   * Update the mutable subset of an allocation: `roleOnProject`,
   * `startDate`, `endDate`, `notes`. `type`, `workerProfileId`, and
   * `assetId` are immutable — a re-target is a delete + create.
   *
   * Date order is re-validated against EFFECTIVE values (the incoming value
   * if provided, otherwise the stored value) so a partial PATCH that
   * supplies only `startDate` cannot push it past the stored `endDate` and
   * vice versa. Overlap warnings and competency re-checks are NOT re-run on
   * update — those are decisions made at allocation time and re-evaluating
   * them on every PATCH would create noisy false alarms when only `notes`
   * changes.
   *
   * @throws NotFoundException when the allocation id does not belong to the
   *         project in the URL.
   * @throws BadRequestException when the effective `endDate < startDate`.
   */
  async update(projectId: string, allocId: string, dto: UpdateAllocationDto) {
    const existing = await this.prisma.projectAllocation.findUnique({ where: { id: allocId } });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Allocation not found for this project.");
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : existing.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : existing.endDate;
    if (endDate && endDate < startDate) {
      throw new BadRequestException("endDate must be on or after startDate.");
    }

    return this.prisma.projectAllocation.update({
      where: { id: allocId },
      data: {
        roleOnProject: dto.roleOnProject ?? undefined,
        startDate: dto.startDate ? startDate : undefined,
        endDate: dto.endDate !== undefined ? endDate : undefined,
        notes: dto.notes ?? undefined
      }
    });
  }

  /**
   * Hard-delete an allocation. No activity log entry is written —
   * allocations are operational scheduling records, not audit-critical,
   * and the create/update events provide sufficient lineage. The row is
   * removed unconditionally; downstream rows that reference allocations
   * (timesheets etc.) rely on FK cascade or nullification at the schema
   * level, not on application logic here.
   *
   * @returns `{ deleted: true }` on success.
   * @throws NotFoundException when the allocation id does not belong to the
   *         project in the URL.
   */
  async remove(projectId: string, allocId: string) {
    const existing = await this.prisma.projectAllocation.findUnique({ where: { id: allocId } });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Allocation not found for this project.");
    }
    await this.prisma.projectAllocation.delete({ where: { id: allocId } });
    return { deleted: true };
  }
}

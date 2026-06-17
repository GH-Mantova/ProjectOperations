import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
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
 * activity-log surfaces. `userId` is the system user id of the allocator;
 * `permissions` carries the JWT-granted permission codes and `isSuperUser`
 * is the root-tier bypass — together they decide whether the actor may
 * override the competency gate.
 */
type ActorContext = {
  userId: string;
  permissions?: ReadonlyArray<string>;
  isSuperUser?: boolean;
};

const EMPTY_COMPETENCY: CompetencyGateResult = {
  allowed: true,
  missing: [],
  expired: [],
  expiringSoon: []
};

/**
 * Permission codes whose holders may override a blocked competency gate.
 * SuperUser bypasses regardless. `resources.manage` is the same code that
 * gates the POST route itself; we re-check it at the service layer to keep
 * the rule explicit and to defend against the controller-level permission
 * matrix drifting.
 */
const COMPETENCY_OVERRIDE_PERMISSIONS = ["resources.manage"] as const;

function canOverrideCompetencyGate(actor: ActorContext): boolean {
  if (actor.isSuperUser) return true;
  const granted = actor.permissions ?? [];
  return COMPETENCY_OVERRIDE_PERMISSIONS.some((code) => granted.includes(code));
}

function formatDateDdMmmYyyy(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Service layer for the §9 Scheduler allocations module.
 *
 * Competency-gate enforcement (this PR — block + logged override):
 *  - For WORKER targets the gate runs BEFORE the allocation insert (the
 *    earlier soft-warn path ran it after). If the worker holds the project's
 *    `requiredQualifications`, the allocation is created and a verdict is
 *    returned.
 *  - If the gate would block (missing or expired qualType codes) and the
 *    request carries no `override`, the service throws a 409 with a
 *    machine-readable list of the gaps so the UI can name them. The
 *    allocation row is NOT created.
 *  - If the request carries an `override` and the actor holds override
 *    authority (SuperUser or `resources.manage`), the allocation IS
 *    created and a `CompetencyOverride` row is persisted alongside a
 *    `allocation.unqualified_override` AuditLog entry, capturing who
 *    overrode what and why.
 *  - An `override` payload from an unauthorised actor is rejected with 403;
 *    an `override` payload with a missing/blank `reason` is rejected at the
 *    DTO layer with 400. An `override` payload supplied when the gate
 *    actually passes is silently ignored (no override row written).
 *
 * Other invariants (unchanged from prior PRs): type/target pairing
 * (WORKER↔workerProfileId, ASSET↔assetId), date order, overlap warnings
 * (WORKER only, never blocking, returned in `warnings`), activity log,
 * best-effort email + in-app notification, immutable fields on update.
 */
@Injectable()
export class AllocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly compliance: ComplianceService
  ) {}

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
   * Create a worker or asset allocation. See class-level JSDoc for the full
   * contract including the competency-gate enforcement + override path.
   *
   * @throws BadRequestException on type/target mismatch or invalid date order.
   * @throws NotFoundException when the project does not exist.
   * @throws ConflictException when the competency gate blocks the worker and
   *         no `override` is supplied. Response payload includes a
   *         `competency` field listing the missing/expired qualType codes.
   * @throws ForbiddenException when an `override` is supplied by an actor
   *         lacking override authority.
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

    // Competency gate runs BEFORE the insert so a blocked allocation never
    // creates a row. ASSET allocations skip the gate (no quals to evaluate).
    let competency: CompetencyGateResult = EMPTY_COMPETENCY;
    if (dto.type === "WORKER" && dto.workerProfileId) {
      competency = await this.compliance.checkWorkerCompetency(
        dto.workerProfileId,
        project.requiredQualifications
      );
    }

    const gateBlocks =
      dto.type === "WORKER" &&
      (competency.missing.length > 0 || competency.expired.length > 0);

    if (gateBlocks) {
      if (!dto.override) {
        throw new ConflictException({
          error: "COMPETENCY_GATE_BLOCKED",
          message:
            "Worker is missing required qualifications. Allocation blocked — submit an override with a reason to proceed.",
          competency,
          projectId: project.id,
          projectNumber: project.projectNumber,
          requiredQualifications: project.requiredQualifications
        });
      }
      if (!canOverrideCompetencyGate(actor)) {
        throw new ForbiddenException(
          "Overriding the competency gate requires resources.manage or super-user."
        );
      }
      const trimmedReason = dto.override.reason?.trim() ?? "";
      if (trimmedReason.length === 0) {
        // Defence-in-depth: DTO validator rejects empty strings already.
        throw new BadRequestException("Override reason is required.");
      }
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

    // Persist the override row + audit log when the gate was blocked AND the
    // caller overrode it. Order matters: allocation row first (insert above),
    // then override row referencing it, then audit log. Outside a transaction
    // intentionally — see prior history; the allocation is the source of truth.
    if (gateBlocks && dto.override) {
      await this.prisma.competencyOverride.create({
        data: {
          allocationId: allocation.id,
          projectId: project.id,
          workerProfileId: dto.workerProfileId!,
          missingQualTypes: competency.missing,
          expiredQualTypes: competency.expired,
          reason: dto.override.reason.trim(),
          overriddenById: actor.userId
        }
      });

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
            expiringSoon: competency.expiringSoon,
            reason: dto.override.reason.trim()
          } satisfies Prisma.InputJsonValue
        }
      });
    }

    return {
      allocation,
      warnings,
      competency,
      overrideApplied: gateBlocks && !!dto.override
    };
  }

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

  async remove(projectId: string, allocId: string) {
    const existing = await this.prisma.projectAllocation.findUnique({ where: { id: allocId } });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Allocation not found for this project.");
    }
    await this.prisma.projectAllocation.delete({ where: { id: allocId } });
    return { deleted: true };
  }
}

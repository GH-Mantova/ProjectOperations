import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  ResourcesQueryDto,
  UpsertAvailabilityWindowDto,
  UpsertShiftRoleRequirementDto,
  UpsertWorkerRoleSuitabilityDto
} from "./dto/resources.dto";

/**
 * Business logic for scheduler resource data (Module 10): workers,
 * availability windows, role suitabilities, and shift role requirements.
 *
 * Every mutation writes an audit entry under the `resources.*` action
 * namespace via AuditService.
 */
@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  /**
   * Get a single worker with full competencies, availability windows,
   * role suitabilities, and shift assignments.
   *
   * Shift assignments include job, activity, and conflict detail, ordered
   * most recently assigned first.
   *
   * @param workerId - worker id
   * @returns the worker with all related records eager-loaded
   * @throws NotFoundException when the worker does not exist
   */
  async getWorker(workerId: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
      include: {
        resourceType: true,
        competencies: { include: { competency: true } },
        availabilityWindows: { orderBy: { startAt: "asc" } },
        roleSuitabilities: { orderBy: { roleLabel: "asc" } },
        shiftAssignments: {
          include: {
            shift: {
              include: {
                job: { select: { id: true, jobNumber: true, name: true } },
                activity: { select: { id: true, name: true } },
                conflicts: { select: { id: true, severity: true, code: true, message: true } }
              }
            }
          },
          orderBy: { assignedAt: "desc" }
        }
      }
    });
    if (!worker) {
      throw new NotFoundException("Worker not found.");
    }
    return worker;
  }

  /**
   * List workers with competencies, availability windows, and role
   * suitabilities, filtered and paginated.
   *
   * Free-text `q` matches firstName, lastName, or employeeCode
   * (case-insensitive); competencyId restricts to workers holding it.
   *
   * @param query - q / competencyId filters plus page and pageSize
   * @returns { items, total, page, pageSize } ordered by last then first name
   */
  async listWorkers(query: ResourcesQueryDto) {
    const where = {
      ...(query.q
        ? {
            OR: [
              { firstName: { contains: query.q, mode: "insensitive" as const } },
              { lastName: { contains: query.q, mode: "insensitive" as const } },
              { employeeCode: { contains: query.q, mode: "insensitive" as const } }
            ]
          }
        : {}),
      ...(query.competencyId
        ? {
            competencies: {
              some: {
                competencyId: query.competencyId
              }
            }
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.worker.findMany({
        where,
        include: {
          resourceType: true,
          competencies: { include: { competency: true } },
          availabilityWindows: { orderBy: { startAt: "asc" } },
          roleSuitabilities: { orderBy: { roleLabel: "asc" } }
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      this.prisma.worker.count({ where })
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * Create (id undefined) or update (id given) an availability window.
   *
   * Status defaults to AVAILABLE when omitted. Writes a
   * `resources.availability.create` / `.update` audit entry. No overlap
   * validation is performed against existing windows.
   *
   * @param id - existing window id, or undefined to create
   * @param dto - workerId, startAt/endAt ISO strings, optional status and notes
   * @param actorId - acting user id recorded in the audit entry
   * @returns the created or updated availability window
   */
  async upsertAvailabilityWindow(id: string | undefined, dto: UpsertAvailabilityWindowDto, actorId?: string) {
    const record = id
      ? await this.prisma.availabilityWindow.update({
          where: { id },
          data: {
            workerId: dto.workerId,
            startAt: new Date(dto.startAt),
            endAt: new Date(dto.endAt),
            status: dto.status ?? "AVAILABLE",
            notes: dto.notes
          }
        })
      : await this.prisma.availabilityWindow.create({
          data: {
            workerId: dto.workerId,
            startAt: new Date(dto.startAt),
            endAt: new Date(dto.endAt),
            status: dto.status ?? "AVAILABLE",
            notes: dto.notes
          }
        });

    await this.auditService.write({
      actorId,
      action: id ? "resources.availability.update" : "resources.availability.create",
      entityType: "AvailabilityWindow",
      entityId: record.id
    });

    return record;
  }

  /**
   * Create (id undefined) or update (id given) a worker role suitability.
   *
   * Creation rejects duplicates per worker + roleLabel; updates skip that
   * check. Suitability defaults to SUITABLE. Writes a
   * `resources.role-suitability.create` / `.update` audit entry.
   *
   * @param id - existing suitability id, or undefined to create
   * @param dto - workerId, roleLabel, optional suitability and notes
   * @param actorId - acting user id recorded in the audit entry
   * @returns the created or updated suitability record
   * @throws ConflictException when creating and the worker already has suitability for that role
   */
  async upsertWorkerRoleSuitability(id: string | undefined, dto: UpsertWorkerRoleSuitabilityDto, actorId?: string) {
    if (!id) {
      const existing = await this.prisma.workerRoleSuitability.findFirst({
        where: { workerId: dto.workerId, roleLabel: dto.roleLabel }
      });

      if (existing) {
        throw new ConflictException("Worker already has suitability configured for that role.");
      }
    }

    const record = id
      ? await this.prisma.workerRoleSuitability.update({
          where: { id },
          data: {
            workerId: dto.workerId,
            roleLabel: dto.roleLabel,
            suitability: dto.suitability ?? "SUITABLE",
            notes: dto.notes
          }
        })
      : await this.prisma.workerRoleSuitability.create({
          data: {
            workerId: dto.workerId,
            roleLabel: dto.roleLabel,
            suitability: dto.suitability ?? "SUITABLE",
            notes: dto.notes
          }
        });

    await this.auditService.write({
      actorId,
      action: id ? "resources.role-suitability.update" : "resources.role-suitability.create",
      entityType: "WorkerRoleSuitability",
      entityId: record.id
    });

    return record;
  }

  /**
   * List role requirements for a shift, oldest first, with competency
   * included.
   *
   * Does not verify the shift exists — an unknown shiftId returns an
   * empty array.
   *
   * @param shiftId - shift id whose requirements to list
   * @returns ShiftRoleRequirement records for the shift
   */
  async listShiftRequirements(shiftId: string) {
    return this.prisma.shiftRoleRequirement.findMany({
      where: { shiftId },
      include: { competency: true },
      orderBy: { createdAt: "asc" }
    });
  }

  /**
   * Create (id undefined) or update (id given) a shift role requirement.
   *
   * requiredCount defaults to 1. Writes a
   * `resources.shift-requirement.create` / `.update` audit entry with the
   * shiftId in metadata, then returns the shift's full requirement list.
   *
   * @param shiftId - shift the requirement belongs to (must exist)
   * @param id - existing requirement id, or undefined to create
   * @param dto - roleLabel, optional competencyId and requiredCount
   * @param actorId - acting user id recorded in the audit entry
   * @returns all requirements for the shift after the write
   * @throws NotFoundException when the shift does not exist
   */
  async upsertShiftRequirement(shiftId: string, id: string | undefined, dto: UpsertShiftRoleRequirementDto, actorId?: string) {
    const shift = await this.prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shift) {
      throw new NotFoundException("Shift not found.");
    }

    const record = id
      ? await this.prisma.shiftRoleRequirement.update({
          where: { id },
          data: {
            roleLabel: dto.roleLabel,
            competencyId: dto.competencyId ?? null,
            requiredCount: dto.requiredCount ?? 1
          }
        })
      : await this.prisma.shiftRoleRequirement.create({
          data: {
            shiftId,
            roleLabel: dto.roleLabel,
            competencyId: dto.competencyId ?? null,
            requiredCount: dto.requiredCount ?? 1
          }
        });

    await this.auditService.write({
      actorId,
      action: id ? "resources.shift-requirement.update" : "resources.shift-requirement.create",
      entityType: "ShiftRoleRequirement",
      entityId: record.id,
      metadata: { shiftId }
    });

    return this.listShiftRequirements(shiftId);
  }
}

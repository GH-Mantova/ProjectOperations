import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  ResourcesQueryDto,
  UpsertAvailabilityWindowDto,
  UpsertShiftRoleRequirementDto,
  UpsertWorkerRoleSuitabilityDto
} from "./dto/resources.dto";

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

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

  async listShiftRequirements(shiftId: string) {
    return this.prisma.shiftRoleRequirement.findMany({
      where: { shiftId },
      include: { competency: true },
      orderBy: { createdAt: "asc" }
    });
  }

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

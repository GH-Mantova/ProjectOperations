import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../platform/notifications.service";
import { CreateAllocationDto } from "./dto/create-allocation.dto";
import { UpdateAllocationDto } from "./dto/update-allocation.dto";

type ActorContext = { userId: string };

function formatDateDdMmmYyyy(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

@Injectable()
export class AllocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
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

  async create(projectId: string, dto: CreateAllocationDto, actor: ActorContext) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, projectNumber: true, name: true }
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

    return { allocation, warnings };
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

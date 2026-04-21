import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateWorkerDto } from "./dto/create-worker.dto";
import { ListWorkersQueryDto, UpdateWorkerDto } from "./dto/update-worker.dto";

@Injectable()
export class WorkersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListWorkersQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 50)));
    const skip = (page - 1) * limit;

    const isActive = query.isActive === undefined ? true : query.isActive === "true";
    const where: Prisma.WorkerProfileWhereInput = {
      isActive,
      ...(query.role ? { role: { equals: query.role, mode: "insensitive" } } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
              { preferredName: { contains: query.search, mode: "insensitive" } },
              { role: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.workerProfile.count({ where }),
      this.prisma.workerProfile.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          preferredName: true,
          role: true,
          phone: true,
          email: true,
          hasMobileAccess: true,
          isActive: true
        }
      })
    ]);

    return { items, total, page, limit };
  }

  async getById(id: string) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { id },
      include: {
        allocations: {
          where: {
            OR: [{ endDate: null }, { endDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }]
          },
          orderBy: { startDate: "asc" },
          include: {
            project: {
              select: { id: true, projectNumber: true, name: true, status: true }
            }
          }
        }
      }
    });
    if (!profile) throw new NotFoundException("Worker not found.");
    return profile;
  }

  create(dto: CreateWorkerDto) {
    return this.prisma.workerProfile.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        preferredName: dto.preferredName ?? null,
        role: dto.role,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        emergencyContactName: dto.emergencyContactName ?? null,
        emergencyContactPhone: dto.emergencyContactPhone ?? null,
        licenceNumber: dto.licenceNumber ?? null,
        licenceClass: dto.licenceClass ?? null,
        ticketNumbers: dto.ticketNumbers ?? null,
        hasMobileAccess: dto.hasMobileAccess ?? false
      }
    });
  }

  async update(id: string, dto: UpdateWorkerDto) {
    const existing = await this.prisma.workerProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Worker not found.");
    return this.prisma.workerProfile.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        preferredName: dto.preferredName,
        role: dto.role,
        phone: dto.phone,
        email: dto.email,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        licenceNumber: dto.licenceNumber,
        licenceClass: dto.licenceClass,
        ticketNumbers: dto.ticketNumbers,
        hasMobileAccess: dto.hasMobileAccess
      }
    });
  }

  async deactivate(id: string) {
    const existing = await this.prisma.workerProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Worker not found.");
    return this.prisma.workerProfile.update({
      where: { id },
      data: { isActive: false }
    });
  }

  allocationsForWorker(id: string) {
    return this.prisma.projectAllocation.findMany({
      where: { workerProfileId: id },
      orderBy: { startDate: "desc" },
      include: {
        project: {
          select: { id: true, projectNumber: true, name: true, status: true }
        }
      }
    });
  }
}

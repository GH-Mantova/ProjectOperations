import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateJobRoleDto } from "./dto/create-job-role.dto";
import { JobRoleRequirementDto } from "./dto/job-role-requirement.dto";
import { UpdateJobRoleDto } from "./dto/update-job-role.dto";

const ROLE_WITH_REQUIREMENTS = {
  requirements: {
    include: { competency: { select: { id: true, name: true, code: true } } },
    orderBy: [{ isMandatory: "desc" as const }, { id: "asc" as const }]
  }
};

@Injectable()
export class JobRolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.jobRole.findMany({
      include: ROLE_WITH_REQUIREMENTS.requirements ? ROLE_WITH_REQUIREMENTS : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  async get(id: string) {
    const role = await this.prisma.jobRole.findUnique({
      where: { id },
      include: ROLE_WITH_REQUIREMENTS
    });
    if (!role) throw new NotFoundException("Job role not found.");
    return role;
  }

  async create(dto: CreateJobRoleDto) {
    const requirements = dto.requirements ?? [];
    await this.assertCompetenciesExist(requirements);
    try {
      return await this.prisma.jobRole.create({
        data: {
          name: dto.name,
          description: dto.description,
          colour: dto.colour,
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 0,
          requirements: requirements.length
            ? { create: requirements.map((r) => this.toRequirementCreate(r)) }
            : undefined
        },
        include: ROLE_WITH_REQUIREMENTS
      });
    } catch (err) {
      this.translatePrismaError(err);
    }
  }

  async update(id: string, dto: UpdateJobRoleDto) {
    await this.get(id);
    const data: Prisma.JobRoleUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.colour !== undefined) data.colour = dto.colour;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    try {
      if (dto.requirements !== undefined) {
        await this.assertCompetenciesExist(dto.requirements);
        return await this.prisma.$transaction(async (tx) => {
          await tx.jobRoleRequirement.deleteMany({ where: { jobRoleId: id } });
          if (dto.requirements!.length) {
            await tx.jobRoleRequirement.createMany({
              data: dto.requirements!.map((r) => ({
                jobRoleId: id,
                competencyId: r.competencyId,
                isMandatory: r.isMandatory ?? true,
                minMonthsExperience: r.minMonthsExperience,
                notes: r.notes
              }))
            });
          }
          return tx.jobRole.update({ where: { id }, data, include: ROLE_WITH_REQUIREMENTS });
        });
      }
      return await this.prisma.jobRole.update({
        where: { id },
        data,
        include: ROLE_WITH_REQUIREMENTS
      });
    } catch (err) {
      this.translatePrismaError(err);
    }
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.jobRole.delete({ where: { id } });
    return { deleted: true };
  }

  private toRequirementCreate(r: JobRoleRequirementDto): Prisma.JobRoleRequirementCreateWithoutJobRoleInput {
    return {
      competency: { connect: { id: r.competencyId } },
      isMandatory: r.isMandatory ?? true,
      minMonthsExperience: r.minMonthsExperience,
      notes: r.notes
    };
  }

  private async assertCompetenciesExist(requirements: ReadonlyArray<JobRoleRequirementDto>) {
    if (!requirements.length) return;
    const ids = Array.from(new Set(requirements.map((r) => r.competencyId)));
    const found = await this.prisma.competency.findMany({
      where: { id: { in: ids } },
      select: { id: true }
    });
    if (found.length !== ids.length) {
      const missing = ids.filter((id) => !found.find((c) => c.id === id));
      throw new BadRequestException(`Unknown competency id(s): ${missing.join(", ")}`);
    }
  }

  private translatePrismaError(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ConflictException("A job role with this name already exists.");
    }
    throw err as Error;
  }
}

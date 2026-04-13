import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";

const roleInclude = {
  rolePermissions: {
    include: {
      permission: true
    }
  }
} as const;

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async list(query: PaginationQueryDto) {
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.role.findMany({
        include: roleInclude,
        orderBy: { name: "asc" },
        skip,
        take: query.pageSize
      }),
      this.prisma.role.count()
    ]);

    return {
      items: items.map((role) => ({
        ...role,
        permissions: role.rolePermissions.map((item) => item.permission)
      })),
      total,
      page: query.page,
      pageSize: query.pageSize
    };
  }

  async create(input: CreateRoleDto, actorId?: string) {
    const existing = await this.prisma.role.findUnique({ where: { name: input.name } });

    if (existing) {
      throw new ConflictException("A role with that name already exists.");
    }

    const role = await this.prisma.role.create({
      data: {
        name: input.name,
        description: input.description,
        isSystem: input.isSystem ?? false,
        rolePermissions: input.permissionIds?.length
          ? {
              create: input.permissionIds.map((permissionId) => ({ permissionId }))
            }
          : undefined
      },
      include: roleInclude
    });

    await this.auditService.write({
      actorId,
      action: "roles.create",
      entityType: "Role",
      entityId: role.id,
      metadata: { name: role.name }
    });

    return role;
  }

  async update(roleId: string, input: UpdateRoleDto, actorId?: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });

    if (!role) {
      throw new NotFoundException("Role not found.");
    }

    if (input.permissionIds) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId } });
      if (input.permissionIds.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: input.permissionIds.map((permissionId) => ({ roleId, permissionId }))
        });
      }
    }

    const updatedRole = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        name: input.name,
        description: input.description,
        isSystem: input.isSystem
      },
      include: roleInclude
    });

    await this.auditService.write({
      actorId,
      action: "roles.update",
      entityType: "Role",
      entityId: roleId,
      metadata: { updatedFields: Object.keys(input) }
    });

    return updatedRole;
  }
}

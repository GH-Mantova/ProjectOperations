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

/**
 * Business logic for role administration and role-permission linking.
 *
 * Create and update both write audit entries via AuditService. Updating
 * `permissionIds` fully replaces the role's permission set.
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  /**
   * List roles ordered by name, with pagination.
   *
   * Each item carries a flattened `permissions` array derived from its
   * rolePermissions join rows (which are also included on the item).
   *
   * @param query - page / pageSize pagination options
   * @returns `{ items, total, page, pageSize }`
   */
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

  /**
   * Create a role, optionally linking permissions at creation time.
   *
   * `isSystem` defaults to false when omitted. Writes a `roles.create`
   * audit entry after creation.
   *
   * @param input - role name, description, isSystem flag and optional permission ids
   * @param actorId - id of the acting user for audit attribution
   * @returns the created role with rolePermissions included
   * @throws ConflictException when a role with the same name already exists
   */
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

  /**
   * Update a role; supplying `permissionIds` replaces its permission set.
   *
   * Permission replacement is delete-then-create and is not transactional
   * with the role update itself. There is no `isSystem` guard — system
   * roles can be edited like any other. Writes a `roles.update` audit entry.
   *
   * @param roleId - id of the role to update
   * @param input - partial fields (name, description, isSystem, permissionIds)
   * @param actorId - id of the acting user for audit attribution
   * @returns the updated role with rolePermissions included
   * @throws NotFoundException when the role does not exist
   */
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

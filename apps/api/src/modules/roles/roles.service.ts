import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
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

// Permissions whose absence from every role would lock the /admin/settings
// matrix out of view for non-super-users. Super-users bypass permission
// checks, so this is defence-in-depth: it guarantees at least one role
// still grants a support admin the ability to see the page.
const MATRIX_ACCESS_PERMISSIONS = new Set(["permissions.view", "roles.view"]);

/**
 * Business logic for role administration and role-permission linking.
 *
 * `create`, `update`, `grantPermission`, and `revokePermission` all
 * write audit entries via AuditService. `update` still fully replaces a
 * role's permission set (delete-then-create); the per-row grant/revoke
 * methods are the additive/subtractive path used by the editable matrix
 * so a single tick in the UI does not require rewriting the whole role.
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

  /**
   * Grant a single permission to a role. Idempotent — a duplicate grant
   * is treated as a no-op (unique [roleId, permissionId] index absorbs it).
   *
   * Audit action: `role_permissions.grant`.
   *
   * @throws NotFoundException when the role or permission does not exist
   */
  async grantPermission(roleId: string, permissionId: string, actorId?: string) {
    const [role, permission] = await Promise.all([
      this.prisma.role.findUnique({ where: { id: roleId } }),
      this.prisma.permission.findUnique({ where: { id: permissionId } })
    ]);
    if (!role) throw new NotFoundException("Role not found.");
    if (!permission) throw new NotFoundException("Permission not found.");

    const existing = await this.prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId, permissionId } }
    });
    if (existing) {
      return { granted: false, alreadyGranted: true };
    }

    await this.prisma.rolePermission.create({ data: { roleId, permissionId } });

    await this.auditService.write({
      actorId,
      action: "role_permissions.grant",
      entityType: "RolePermission",
      entityId: `${roleId}:${permissionId}`,
      metadata: {
        roleId,
        roleName: role.name,
        permissionId,
        permissionCode: permission.code,
        isHighRisk: permission.isHighRisk
      }
    });

    return { granted: true, alreadyGranted: false };
  }

  /**
   * Revoke a single permission from a role. Idempotent — revoking a
   * permission the role never had is a no-op.
   *
   * Guardrail (defence-in-depth): revoking `permissions.view` or
   * `roles.view` is blocked if it would leave zero roles granting that
   * permission — otherwise a non-super-user support admin could be
   * locked out of the matrix page entirely.
   *
   * Audit action: `role_permissions.revoke`.
   *
   * @throws NotFoundException when the role or permission does not exist
   * @throws ForbiddenException when the guardrail would fire
   */
  async revokePermission(roleId: string, permissionId: string, actorId?: string) {
    const [role, permission] = await Promise.all([
      this.prisma.role.findUnique({ where: { id: roleId } }),
      this.prisma.permission.findUnique({ where: { id: permissionId } })
    ]);
    if (!role) throw new NotFoundException("Role not found.");
    if (!permission) throw new NotFoundException("Permission not found.");

    if (MATRIX_ACCESS_PERMISSIONS.has(permission.code)) {
      const otherHolders = await this.prisma.rolePermission.count({
        where: { permissionId, NOT: { roleId } }
      });
      if (otherHolders === 0) {
        throw new ForbiddenException(
          `Cannot revoke "${permission.code}" from the last role that grants it — non-super-user admins would lose access to the roles/permissions page. Grant it to another role first.`
        );
      }
    }

    const deleted = await this.prisma.rolePermission.deleteMany({
      where: { roleId, permissionId }
    });

    if (deleted.count === 0) {
      return { revoked: false, alreadyRevoked: true };
    }

    await this.auditService.write({
      actorId,
      action: "role_permissions.revoke",
      entityType: "RolePermission",
      entityId: `${roleId}:${permissionId}`,
      metadata: {
        roleId,
        roleName: role.name,
        permissionId,
        permissionCode: permission.code,
        isHighRisk: permission.isHighRisk
      }
    });

    return { revoked: true, alreadyRevoked: false };
  }
}

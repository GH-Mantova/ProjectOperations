import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { PasswordService } from "../../common/security/password.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

const userInclude = {
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true
            }
          }
        }
      }
    }
  }
} as const;

/**
 * Business logic for user administration and account lookups.
 *
 * Emails are always normalised to lowercase, passwords are hashed via
 * PasswordService before storage, mutations write audit entries, and all
 * outward-facing results are sanitised through `toSafeUser` so the
 * password hash never leaves the service.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly auditService: AuditService
  ) {}

  /**
   * List users ordered by last name then first name, with pagination.
   *
   * When `role` is provided, only users holding a role whose name equals
   * the value (case-insensitive exact match) are returned.
   *
   * @param query - page / pageSize pagination options
   * @param role - optional role name filter
   * @returns `{ items, total, page, pageSize }` where items are safe user shapes
   */
  async list(query: PaginationQueryDto, role?: string) {
    const skip = (query.page - 1) * query.pageSize;
    // `contains` rather than `equals`: callers filter by role *family*
    // (the Team panel sends role=estimator and must match the seeded
    // "Senior Estimator" role).
    const where = role
      ? {
          userRoles: {
            some: {
              role: { name: { contains: role, mode: "insensitive" as const } }
            }
          }
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip,
        take: query.pageSize
      }),
      this.prisma.user.count({ where })
    ]);

    return {
      items: items.map((item) => this.toSafeUser(item)),
      total,
      page: query.page,
      pageSize: query.pageSize
    };
  }

  /**
   * Create a user with a hashed password and optional role assignments.
   *
   * The email is lowercased before the uniqueness check and storage.
   * Writes a `users.create` audit entry after creation.
   *
   * @param input - email, names, plaintext password and optional role ids
   * @param actorId - id of the acting user, stamped as createdBy/updatedBy
   * @returns the created user without its password hash
   * @throws ConflictException when a user with the same email already exists
   */
  async create(input: CreateUserDto, actorId?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });

    if (existing) {
      throw new ConflictException("A user with that email already exists.");
    }

    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash: this.passwordService.hashPassword(input.password),
        createdById: actorId,
        updatedById: actorId,
        userRoles: input.roleIds?.length
          ? {
              create: input.roleIds.map((roleId) => ({ roleId }))
            }
          : undefined
      },
      include: userInclude
    });

    await this.auditService.write({
      actorId,
      action: "users.create",
      entityType: "User",
      entityId: user.id,
      metadata: { email: user.email, roleIds: input.roleIds ?? [] }
    });

    return this.toSafeUser(user);
  }

  /**
   * Partially update a user; only fields present in the DTO are applied.
   *
   * Supplying `roleIds` replaces the entire role set (delete-then-create,
   * not transactional with the user update). A new password is re-hashed.
   * Writes a `users.activation` audit entry when `isActive` is toggled,
   * otherwise `users.update`.
   *
   * @param userId - id of the user to update
   * @param input - partial fields (email, names, password, isActive, roleIds)
   * @param actorId - id of the acting user, stamped as updatedBy
   * @returns the updated user without its password hash
   * @throws NotFoundException when the user does not exist
   */
  async update(userId: string, input: UpdateUserDto, actorId?: string) {
    await this.ensureUserExists(userId);

    const data: Record<string, unknown> = { updatedById: actorId };

    if (input.email) data.email = input.email.toLowerCase();
    if (input.firstName) data.firstName = input.firstName;
    if (input.lastName) data.lastName = input.lastName;
    if (typeof input.isActive === "boolean") data.isActive = input.isActive;
    if (input.password) data.passwordHash = this.passwordService.hashPassword(input.password);

    if (input.managerId !== undefined) {
      if (input.managerId === null) {
        data.managerId = null;
      } else {
        if (input.managerId === userId) {
          throw new BadRequestException("A user cannot be their own manager.");
        }
        const targetExists = await this.prisma.user.findUnique({
          where: { id: input.managerId },
          select: { id: true }
        });
        if (!targetExists) {
          throw new BadRequestException("Manager user not found.");
        }
        const subtree = await this.getReportSubtreeIds(userId);
        if (subtree.includes(input.managerId)) {
          throw new BadRequestException("Assigning this manager would create a cycle in the reporting line.");
        }
        data.managerId = input.managerId;
      }
    }

    if (input.roleIds) {
      await this.prisma.userRole.deleteMany({ where: { userId } });
      if (input.roleIds.length > 0) {
        await this.prisma.userRole.createMany({
          data: input.roleIds.map((roleId) => ({ userId, roleId }))
        });
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      include: userInclude
    });

    await this.auditService.write({
      actorId,
      action: typeof input.isActive === "boolean" ? "users.activation" : "users.update",
      entityType: "User",
      entityId: userId,
      metadata: { updatedFields: Object.keys(input) }
    });

    return this.toSafeUser(user);
  }

  /**
   * Fetch a user by id with roles and role permissions eagerly loaded.
   *
   * Returns the raw Prisma record (including the password hash) — callers
   * must sanitise with `toSafeUser` before exposing it.
   *
   * @param userId - id of the user to fetch
   * @returns the user with relations, or null when not found
   */
  findByIdWithRelations(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: userInclude
    });
  }

  /**
   * Fetch a user by email (lowercased) with roles and permissions loaded.
   *
   * Intended for authentication flows — the returned record includes the
   * password hash, so it must never be returned to clients directly.
   *
   * @param email - email address; normalised to lowercase before lookup
   * @returns the user with relations, or null when not found
   */
  findByEmailWithSecurity(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: userInclude
    });
  }

  /**
   * Flatten a user's roles into a deduplicated array of permission codes.
   *
   * @param user - user shape carrying userRoles -> role -> rolePermissions
   * @returns unique permission code strings across all of the user's roles
   */
  flattenPermissions(user: {
    userRoles: Array<{
      role: { rolePermissions: Array<{ permission: { code: string } }> };
    }>;
  }) {
    return [
      ...new Set(user.userRoles.flatMap((userRole) => userRole.role.rolePermissions.map((item) => item.permission.code)))
    ];
  }

  /**
   * Map a user record (with relations) to a client-safe shape.
   *
   * Strips the password hash, flattens roles to `{ id, name, description }`
   * summaries and includes the deduplicated permission code list. Missing
   * `isSuperUser` coerces to false.
   *
   * @param user - user record including userRoles with role permissions
   * @param permissions - optional precomputed permission codes; defaults to `flattenPermissions(user)`
   * @returns sanitised user object with `roles` and `permissions` arrays
   */
  toSafeUser(
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      isActive: boolean;
      isSuperUser?: boolean;
      managerId?: string | null;
      lastLoginAt: Date | null;
      userRoles: Array<{
        role: {
          id: string;
          name: string;
          description: string | null;
          rolePermissions: Array<{ permission: { code: string } }>;
        };
      }>;
    },
    permissions = this.flattenPermissions(user)
  ) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      isSuperUser: Boolean(user.isSuperUser),
      managerId: user.managerId ?? null,
      lastLoginAt: user.lastLoginAt,
      roles: user.userRoles.map((userRole) => ({
        id: userRole.role.id,
        name: userRole.role.name,
        description: userRole.role.description
      })),
      permissions
    };
  }

  /**
   * Return the given user's id plus every transitive direct report.
   *
   * Iterative BFS with a visited set — guards against cycles even though
   * `update` rejects them, so bad data on disk cannot infinite-loop this.
   *
   * @param userId - id of the root user
   * @returns array of user ids including the root, in BFS order
   */
  async getReportSubtreeIds(userId: string): Promise<string[]> {
    const visited = new Set<string>([userId]);
    let frontier: string[] = [userId];

    while (frontier.length > 0) {
      const children = await this.prisma.user.findMany({
        where: { managerId: { in: frontier } },
        select: { id: true }
      });
      const next: string[] = [];
      for (const { id } of children) {
        if (!visited.has(id)) {
          visited.add(id);
          next.push(id);
        }
      }
      frontier = next;
    }

    return [...visited];
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException("User not found.");
    }
  }
}

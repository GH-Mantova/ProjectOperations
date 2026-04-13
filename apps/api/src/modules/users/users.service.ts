import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
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

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly auditService: AuditService
  ) {}

  async list(query: PaginationQueryDto) {
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        include: userInclude,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip,
        take: query.pageSize
      }),
      this.prisma.user.count()
    ]);

    return {
      items: items.map((item) => this.toSafeUser(item)),
      total,
      page: query.page,
      pageSize: query.pageSize
    };
  }

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

  async update(userId: string, input: UpdateUserDto, actorId?: string) {
    await this.ensureUserExists(userId);

    const data: Record<string, unknown> = { updatedById: actorId };

    if (input.email) data.email = input.email.toLowerCase();
    if (input.firstName) data.firstName = input.firstName;
    if (input.lastName) data.lastName = input.lastName;
    if (typeof input.isActive === "boolean") data.isActive = input.isActive;
    if (input.password) data.passwordHash = this.passwordService.hashPassword(input.password);

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

  findByIdWithRelations(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: userInclude
    });
  }

  findByEmailWithSecurity(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: userInclude
    });
  }

  flattenPermissions(user: {
    userRoles: Array<{
      role: { rolePermissions: Array<{ permission: { code: string } }> };
    }>;
  }) {
    return [
      ...new Set(user.userRoles.flatMap((userRole) => userRole.role.rolePermissions.map((item) => item.permission.code)))
    ];
  }

  toSafeUser(
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      isActive: boolean;
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
      lastLoginAt: user.lastLoginAt,
      roles: user.userRoles.map((userRole) => ({
        id: userRole.role.id,
        name: userRole.role.name,
        description: userRole.role.description
      })),
      permissions
    };
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException("User not found.");
    }
  }
}

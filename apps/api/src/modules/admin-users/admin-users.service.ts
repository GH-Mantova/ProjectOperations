import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { randomBytes, scryptSync } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";

export type ViewerTier = "super" | "admin" | "none";

export function tierOf(user: { isSuperUser: boolean; roles: { name: string }[] }): ViewerTier {
  if (user.isSuperUser) return "super";
  if (user.roles.some((r) => r.name === "Admin")) return "admin";
  return "none";
}

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: { select: { name: true } } } } }
    });
    if (!u) throw new NotFoundException("User not found.");
    return {
      id: u.id,
      isSuperUser: u.isSuperUser,
      roles: u.userRoles.map((ur) => ({ name: ur.role.name }))
    };
  }

  async list(viewerId: string) {
    const viewer = await this.me(viewerId);
    const tier = tierOf(viewer);
    if (tier === "none") throw new ForbiddenException("Admin access required.");

    const users = await this.prisma.user.findMany({
      include: {
        userRoles: { include: { role: { select: { id: true, name: true } } } }
      },
      orderBy: { firstName: "asc" }
    });

    return users
      .filter((u) => {
        if (tier === "super") return true;
        // Admins see everyone except Super Users and other Admins.
        if (u.isSuperUser) return false;
        if (u.userRoles.some((ur) => ur.role.name === "Admin")) return false;
        return true;
      })
      .map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        isActive: u.isActive,
        isSuperUser: u.isSuperUser,
        role: u.userRoles[0] ? { id: u.userRoles[0].role.id, name: u.userRoles[0].role.name } : null
      }));
  }

  async update(
    viewerId: string,
    targetId: string,
    dto: { firstName?: string; lastName?: string; email?: string; roleId?: string; isActive?: boolean; isSuperUser?: boolean }
  ) {
    const viewer = await this.me(viewerId);
    const tier = tierOf(viewer);
    if (tier === "none") throw new ForbiddenException("Admin access required.");

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      include: { userRoles: { include: { role: { select: { name: true } } } } }
    });
    if (!target) throw new NotFoundException("User not found.");

    const targetTier = tierOf({
      isSuperUser: target.isSuperUser,
      roles: target.userRoles.map((ur) => ({ name: ur.role.name }))
    });

    if (tier === "admin" && targetTier !== "none") {
      throw new ForbiddenException("Admins cannot modify Admins or Super Users. Ask a Super User.");
    }

    // Role promotion guard. Admins cannot assign Admin role or set super-user.
    if (dto.roleId) {
      const role = await this.prisma.role.findUnique({ where: { id: dto.roleId }, select: { name: true } });
      if (!role) throw new BadRequestException("Unknown roleId.");
      if (tier === "admin" && role.name === "Admin") {
        throw new ForbiddenException("Admins cannot assign the Admin role.");
      }
    }
    if (dto.isSuperUser && tier !== "super") {
      throw new ForbiddenException("Only Super Users can promote another user to Super User.");
    }

    // Self-deactivation guard.
    if (dto.isActive === false && targetId === viewerId) {
      throw new BadRequestException("You cannot deactivate your own account.");
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        isActive: dto.isActive,
        isSuperUser: dto.isSuperUser
      }
    });
    if (dto.roleId) {
      await this.prisma.userRole.deleteMany({ where: { userId: targetId } });
      await this.prisma.userRole.create({ data: { userId: targetId, roleId: dto.roleId } });
    }
    return updated;
  }

  async create(
    viewerId: string,
    dto: { firstName: string; lastName: string; email: string; roleId: string; temporaryPassword: string; forcePasswordReset?: boolean; isSuperUser?: boolean }
  ) {
    const viewer = await this.me(viewerId);
    const tier = tierOf(viewer);
    if (tier === "none") throw new ForbiddenException("Admin access required.");

    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId }, select: { name: true } });
    if (!role) throw new BadRequestException("Unknown roleId.");
    if (tier === "admin" && role.name === "Admin") {
      throw new ForbiddenException("Admins cannot create Admins.");
    }
    if (dto.isSuperUser && tier !== "super") {
      throw new ForbiddenException("Only Super Users can create Super Users.");
    }
    if (!dto.temporaryPassword || dto.temporaryPassword.length < 8) {
      throw new BadRequestException("Temporary password must be at least 8 characters.");
    }
    const dup = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (dup) throw new ConflictException("A user with this email already exists.");

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.trim(),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        passwordHash: hashPassword(dto.temporaryPassword),
        isActive: true,
        isSuperUser: dto.isSuperUser ?? false,
        forcePasswordReset: dto.forcePasswordReset ?? true
      }
    });
    await this.prisma.userRole.create({ data: { userId: user.id, roleId: dto.roleId } });
    return user;
  }

  async deactivate(viewerId: string, targetId: string) {
    return this.update(viewerId, targetId, { isActive: false });
  }
}

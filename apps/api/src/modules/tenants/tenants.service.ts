import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export type CreateTenantDto = {
  name: string;
  code?: string;
};

export type UpdateTenantDto = {
  name?: string;
  code?: string;
  isActive?: boolean;
};

/**
 * TenantsService — CRUD for Tenant rows (MT-5).
 *
 * All mutations are intended for super-users only; the controller layer
 * enforces JwtAuthGuard + SuperUserGuard on every endpoint. This service
 * focuses purely on data access and validation.
 */
@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  /** List all Tenant rows ordered by name. */
  async listTenants() {
    return this.prisma.tenant.findMany({
      orderBy: { name: "asc" }
    });
  }

  /** Create a new Tenant. Duplicate code (unique constraint) raises 400. */
  async createTenant(dto: CreateTenantDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException("name must not be blank.");

    if (dto.code) {
      const code = dto.code.trim();
      const existing = await this.prisma.tenant.findUnique({
        where: { code }
      });
      if (existing) {
        throw new BadRequestException(`Tenant code "${code}" is already in use.`);
      }
    }

    return this.prisma.tenant.create({
      data: {
        name,
        code: dto.code?.trim() || null
      }
    });
  }

  /** Partial-update a Tenant by id. */
  async updateTenant(id: string, dto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found.`);

    if (dto.code !== undefined) {
      const code = dto.code?.trim() || null;
      if (code) {
        const conflict = await this.prisma.tenant.findFirst({
          where: { code, NOT: { id } }
        });
        if (conflict) {
          throw new BadRequestException(`Tenant code "${code}" is already in use.`);
        }
      }
      dto = { ...dto, code: code ?? undefined };
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data["name"] = dto.name.trim();
    if ("code" in dto) data["code"] = dto.code?.trim() || null;
    if (dto.isActive !== undefined) data["isActive"] = dto.isActive;

    return this.prisma.tenant.update({ where: { id }, data });
  }

  /**
   * Assign a user to a tenant by setting User.homeTenantId.
   * Validates that both the tenant and user exist, and that the user is active.
   */
  async assignUser(tenantId: string, userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found.`);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found.`);
    if (!user.isActive) throw new BadRequestException("Cannot assign an inactive user to a tenant.");

    return this.prisma.user.update({
      where: { id: userId },
      data: { homeTenantId: tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        homeTenantId: true
      }
    });
  }

  /** List users assigned to a tenant (homeTenantId = tenantId). */
  async listTenantUsers(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found.`);

    return this.prisma.user.findMany({
      where: { homeTenantId: tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        homeTenantId: true
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    });
  }
}

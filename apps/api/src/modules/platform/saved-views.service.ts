import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

export type SavedViewSort = { key: string; dir: "asc" | "desc" };

export type CreateSavedViewInput = {
  entityType: string;
  name: string;
  filters?: Record<string, unknown>;
  columns?: unknown[];
  sort?: SavedViewSort | null;
  isDefault?: boolean;
};

export type UpdateSavedViewInput = {
  name?: string;
  filters?: Record<string, unknown>;
  columns?: unknown[];
  sort?: SavedViewSort | null;
  isDefault?: boolean;
};

@Injectable()
export class SavedViewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  list(ownerId: string, entityType?: string) {
    return this.prisma.savedView.findMany({
      where: { ownerId, ...(entityType ? { entityType } : {}) },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }]
    });
  }

  async getById(ownerId: string, id: string) {
    const record = await this.prisma.savedView.findUnique({ where: { id } });
    if (!record || record.ownerId !== ownerId) {
      throw new NotFoundException("Saved view not found.");
    }
    return record;
  }

  async create(ownerId: string, dto: CreateSavedViewInput) {
    const filters = (dto.filters ?? {}) as unknown as Prisma.InputJsonValue;
    const columns = (dto.columns ?? []) as unknown as Prisma.InputJsonValue;
    const sort =
      dto.sort === undefined || dto.sort === null
        ? Prisma.JsonNull
        : (dto.sort as unknown as Prisma.InputJsonValue);

    const record = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.savedView.updateMany({
          where: { ownerId, entityType: dto.entityType, isDefault: true },
          data: { isDefault: false }
        });
      }
      return tx.savedView.create({
        data: {
          ownerId,
          entityType: dto.entityType,
          name: dto.name,
          filters,
          columns,
          sort,
          isDefault: dto.isDefault ?? false
        }
      });
    });

    await this.audit.write({
      actorId: ownerId,
      action: "savedViews.create",
      entityType: "SavedView",
      entityId: record.id,
      metadata: { targetEntityType: dto.entityType, name: dto.name }
    });
    return record;
  }

  async update(ownerId: string, id: string, dto: UpdateSavedViewInput) {
    const existing = await this.getById(ownerId, id);

    const data: Prisma.SavedViewUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.filters !== undefined) data.filters = dto.filters as unknown as Prisma.InputJsonValue;
    if (dto.columns !== undefined) data.columns = dto.columns as unknown as Prisma.InputJsonValue;
    if (dto.sort !== undefined) {
      data.sort =
        dto.sort === null ? Prisma.JsonNull : (dto.sort as unknown as Prisma.InputJsonValue);
    }
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;

    const record = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.savedView.updateMany({
          where: {
            ownerId,
            entityType: existing.entityType,
            isDefault: true,
            id: { not: existing.id }
          },
          data: { isDefault: false }
        });
      }
      return tx.savedView.update({ where: { id: existing.id }, data });
    });

    await this.audit.write({
      actorId: ownerId,
      action: "savedViews.update",
      entityType: "SavedView",
      entityId: record.id
    });
    return record;
  }

  async remove(ownerId: string, id: string) {
    const existing = await this.getById(ownerId, id);
    await this.prisma.savedView.delete({ where: { id: existing.id } });
    await this.audit.write({
      actorId: ownerId,
      action: "savedViews.delete",
      entityType: "SavedView",
      entityId: id
    });
    return { id };
  }

  async setDefault(ownerId: string, id: string) {
    const existing = await this.getById(ownerId, id);
    await this.prisma.$transaction([
      this.prisma.savedView.updateMany({
        where: {
          ownerId,
          entityType: existing.entityType,
          id: { not: existing.id }
        },
        data: { isDefault: false }
      }),
      this.prisma.savedView.update({
        where: { id: existing.id },
        data: { isDefault: true }
      })
    ]);
    await this.audit.write({
      actorId: ownerId,
      action: "savedViews.setDefault",
      entityType: "SavedView",
      entityId: id,
      metadata: { targetEntityType: existing.entityType }
    });
    return this.getById(ownerId, id);
  }
}

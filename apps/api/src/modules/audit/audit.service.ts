import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { PrismaService } from "../../prisma/prisma.service";

type WriteAuditLogInput = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  write(entry: WriteAuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata
      }
    });
  }

  async list(query: PaginationQueryDto) {
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: query.pageSize
      }),
      this.prisma.auditLog.count()
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize
    };
  }
}

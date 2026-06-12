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

/**
 * Central write/read service for the immutable audit log.
 *
 * Other modules (users, roles, auth, etc.) call `write` after mutating
 * state; entries are append-only — there is no update or delete path.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist a single audit log entry.
   *
   * Missing `actorId`/`entityId` are stored as null (e.g. system-initiated
   * actions or failed logins with no resolved user).
   *
   * @param entry - action code, entity type/id, optional actor and JSON metadata
   * @returns the created AuditLog record
   */
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

  /**
   * List audit log entries, newest first, with a paginated envelope.
   *
   * Each item includes a trimmed actor projection (id, email, firstName,
   * lastName). Items and total count are fetched in a single transaction.
   *
   * @param query - page / pageSize pagination options
   * @returns `{ items, total, page, pageSize }`
   */
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

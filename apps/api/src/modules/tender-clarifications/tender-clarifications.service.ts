import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

const DIRECTIONS = ["sent", "received"] as const;
type Direction = (typeof DIRECTIONS)[number];

@Injectable()
export class TenderClarificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async list(tenderId: string, clientId?: string) {
    await this.requireTender(tenderId);
    return this.prisma.tenderClarificationNote.findMany({
      where: { tenderId, ...(clientId ? { clientId } : {}) },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { occurredAt: "desc" }
    });
  }

  async create(
    tenderId: string,
    actorId: string,
    dto: {
      direction: string;
      text: string;
      date?: string | null;
      noteType?: string;
      clientId?: string | null;
    }
  ) {
    await this.requireTender(tenderId);
    if (!DIRECTIONS.includes(dto.direction as Direction)) {
      throw new BadRequestException(`direction must be one of ${DIRECTIONS.join(", ")}.`);
    }
    const clean = dto.text?.trim();
    if (!clean) throw new BadRequestException("text cannot be empty.");

    // Parse the date here so an invalid string returns 400 (and a clear
    // message) instead of cascading into a 500 when Prisma rejects an
    // Invalid Date.
    let occurredAt: Date;
    if (dto.date) {
      const parsed = new Date(dto.date);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException("Invalid date format — expected ISO-8601 (e.g. 2026-04-22).");
      }
      occurredAt = parsed;
    } else {
      occurredAt = new Date();
    }

    if (dto.clientId) {
      const client = await this.prisma.client.findUnique({
        where: { id: dto.clientId },
        select: { id: true }
      });
      if (!client) throw new BadRequestException("clientId does not match a known client.");
    }

    return this.prisma.tenderClarificationNote.create({
      data: {
        tenderId,
        direction: dto.direction,
        noteType: dto.noteType ?? "note",
        text: clean,
        occurredAt,
        createdById: actorId,
        clientId: dto.clientId ?? null
      },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } }
    });
  }

  async update(
    tenderId: string,
    id: string,
    dto: {
      direction?: string;
      text?: string;
      date?: string | null;
      noteType?: string;
      clientId?: string | null;
    }
  ) {
    const existing = await this.prisma.tenderClarificationNote.findUnique({ where: { id } });
    if (!existing || existing.tenderId !== tenderId) {
      throw new NotFoundException("Clarification not found on this tender.");
    }
    const data: {
      direction?: string;
      text?: string;
      occurredAt?: Date;
      noteType?: string;
      clientId?: string | null;
    } = {};
    if (dto.direction !== undefined) {
      if (!DIRECTIONS.includes(dto.direction as Direction)) {
        throw new BadRequestException(`direction must be one of ${DIRECTIONS.join(", ")}.`);
      }
      data.direction = dto.direction;
    }
    if (dto.text !== undefined) {
      const clean = dto.text.trim();
      if (!clean) throw new BadRequestException("text cannot be empty.");
      data.text = clean;
    }
    if (dto.date !== undefined && dto.date !== null) {
      const parsed = new Date(dto.date);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException("Invalid date format — expected ISO-8601.");
      }
      data.occurredAt = parsed;
    }
    if (dto.noteType !== undefined) data.noteType = dto.noteType;
    if (dto.clientId !== undefined) {
      if (dto.clientId) {
        const client = await this.prisma.client.findUnique({
          where: { id: dto.clientId },
          select: { id: true }
        });
        if (!client) throw new BadRequestException("clientId does not match a known client.");
      }
      data.clientId = dto.clientId ?? null;
    }
    return this.prisma.tenderClarificationNote.update({
      where: { id },
      data,
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } }
    });
  }

  async remove(tenderId: string, id: string, actorId?: string) {
    const existing = await this.prisma.tenderClarificationNote.findUnique({ where: { id } });
    if (!existing || existing.tenderId !== tenderId) {
      throw new NotFoundException("Clarification not found on this tender.");
    }
    await this.prisma.tenderClarificationNote.delete({ where: { id } });
    await this.auditService.write({
      actorId,
      action: "COMM_ENTRY_DELETED",
      entityType: "CommEntry",
      entityId: id,
      metadata: { tenderId }
    });
    return { id };
  }

  private async requireTender(tenderId: string) {
    const tender = await this.prisma.tender.findUnique({ where: { id: tenderId }, select: { id: true } });
    if (!tender) throw new NotFoundException("Tender not found.");
    return tender;
  }
}

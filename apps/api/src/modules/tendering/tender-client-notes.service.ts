import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

const ALLOWED_TYPES = new Set(["note", "call", "email", "meeting", "site_visit"]);

export type CreateTenderClientNoteInput = {
  noteType?: string;
  subject?: string | null;
  body: string;
  occurredAt?: string | null;
};

@Injectable()
export class TenderClientNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async list(tenderId: string, clientId: string) {
    await this.ensureTenderClient(tenderId, clientId);
    return this.prisma.tenderClientNote.findMany({
      where: { tenderId, clientId },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { occurredAt: "desc" }
    });
  }

  async create(tenderId: string, clientId: string, dto: CreateTenderClientNoteInput, actorId?: string) {
    await this.ensureTenderClient(tenderId, clientId);
    if (!dto.body || !dto.body.trim()) {
      throw new BadRequestException("Note body is required.");
    }
    const noteType = dto.noteType ?? "note";
    if (!ALLOWED_TYPES.has(noteType)) {
      throw new BadRequestException(`Invalid noteType "${noteType}".`);
    }
    const record = await this.prisma.tenderClientNote.create({
      data: {
        tenderId,
        clientId,
        noteType,
        subject: dto.subject ?? null,
        body: dto.body.trim(),
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        createdById: actorId ?? null
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });
    await this.audit.write({
      actorId,
      action: "tenders.clientNotes.create",
      entityType: "TenderClientNote",
      entityId: record.id,
      metadata: { tenderId, clientId, noteType }
    });
    return record;
  }

  async remove(tenderId: string, clientId: string, noteId: string, actorId?: string) {
    await this.ensureTenderClient(tenderId, clientId);
    const existing = await this.prisma.tenderClientNote.findUnique({ where: { id: noteId } });
    if (!existing || existing.tenderId !== tenderId || existing.clientId !== clientId) {
      throw new NotFoundException("Note not found.");
    }
    await this.prisma.tenderClientNote.delete({ where: { id: noteId } });
    await this.audit.write({
      actorId,
      action: "tenders.clientNotes.delete",
      entityType: "TenderClientNote",
      entityId: noteId
    });
    return { id: noteId };
  }

  private async ensureTenderClient(tenderId: string, clientId: string) {
    const link = await this.prisma.tenderClient.findFirst({
      where: { tenderId, clientId },
      select: { id: true }
    });
    if (!link) {
      throw new NotFoundException("Client is not linked to this tender.");
    }
  }
}

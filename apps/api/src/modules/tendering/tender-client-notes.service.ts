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

/**
 * Service for per-client interaction notes (TenderClientNote rows)
 * scoped to a (tender, client) link.
 *
 * Every method first verifies the client is linked to the tender via
 * TenderClient. Create and delete write audit entries.
 */
@Injectable()
export class TenderClientNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * List notes for a (tender, client) pair, newest occurredAt first.
   *
   * @returns notes including createdBy (id, firstName, lastName)
   * @throws NotFoundException when the client is not linked to the tender
   */
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

  /**
   * Create a note on a (tender, client) pair; writes an audit entry.
   *
   * noteType defaults to "note"; occurredAt defaults to now.
   *
   * @param dto - body (required), optional noteType/subject/occurredAt
   * @returns the created note with createdBy metadata
   * @throws NotFoundException when the client is not linked to the tender
   * @throws BadRequestException when the body is blank or noteType is invalid
   */
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

  /**
   * Hard-delete a note; writes an audit entry after deletion.
   *
   * @returns { id } of the deleted note
   * @throws NotFoundException when the client is not linked to the tender, or the note does not belong to this (tender, client) pair
   */
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

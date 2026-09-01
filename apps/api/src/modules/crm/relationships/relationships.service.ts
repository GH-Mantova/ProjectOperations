import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InteractionChannel, Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { CRM_COLD_V2 } from "../accounts/accounts.service";

// ── Types ────────────────────────────────────────────────────────────────────

export { InteractionChannel };

/**
 * The finite set of valid channel values. Mirrors the InteractionChannel enum
 * so the controller layer can validate without importing Prisma directly.
 */
export const INTERACTION_CHANNELS = [
  "phone",
  "email",
  "meeting",
  "site_visit",
  "other"
] as const;

export type CreateNoteInput = {
  accountId?: string | null;
  contactId?: string | null;
  authorId: string;
  body: string;
  /** CRM-S7: communication medium. Omit/null for historic or channel-unknown notes. */
  channel?: InteractionChannel | null;
};

export type UpdateNoteInput = {
  body: string;
};

export type ListNotesQuery = {
  accountId?: string;
  contactId?: string;
  authorId?: string;
  page?: number;
  limit?: number;
};

/**
 * Default threshold (days) for the "going cold" nudge.
 * Sourced from CRM_COLD_V2 so the KPI tile (accounts summary) and this list
 * ALWAYS agree. Do NOT redeclare a local literal here — the tile once read 14
 * while this read 30, so the tile showed 0 while the tab listed 9 rows.
 */
const GOING_COLD_DAYS_DEFAULT = CRM_COLD_V2.THRESHOLD_DAYS;

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * CRM-2: RelationshipsService
 *
 * Owns RelationshipNote CRUD plus two derived read operations:
 *   - "going cold" nudge: accounts/contacts whose lastContactedAt is older
 *     than N days (default 30) — prompts re-engagement.
 *   - "repeat business" surfacing: accounts whose linked Client has won more
 *     than one tender (winCount > 1) — read-only derivation from the
 *     transactional spine, never duplicated.
 *
 * Ownership rule: this service NEVER writes into Tender, Job, or Contract.
 * It reads them read-only for the repeat-business derivation.
 */
@Injectable()
export class RelationshipsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── RelationshipNote CRUD ─────────────────────────────────────────────────

  async createNote(input: CreateNoteInput) {
    if (!input.body?.trim()) {
      throw new BadRequestException("Note body must not be empty.");
    }
    if (!input.accountId && !input.contactId) {
      throw new BadRequestException(
        "A note must be linked to at least one of: accountId, contactId."
      );
    }

    await this.requireUser(input.authorId);
    if (input.accountId) await this.requireAccount(input.accountId);
    if (input.contactId) await this.requireContact(input.contactId);

    const note = await this.prisma.relationshipNote.create({
      data: {
        accountId: input.accountId ?? null,
        contactId: input.contactId ?? null,
        authorId: input.authorId,
        body: input.body.trim(),
        channel: input.channel ?? null
      },
      include: this.noteInclude()
    });

    // Update lastContactedAt on the contact if provided.
    if (input.contactId) {
      await this.prisma.contact.update({
        where: { id: input.contactId },
        data: { lastContactedAt: note.createdAt }
      });
    }

    return note;
  }

  async listNotes(query: ListNotesQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));

    const where: Prisma.RelationshipNoteWhereInput = {};
    if (query.accountId) where.accountId = query.accountId;
    if (query.contactId) where.contactId = query.contactId;
    if (query.authorId) where.authorId = query.authorId;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.relationshipNote.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: this.noteInclude()
      }),
      this.prisma.relationshipNote.count({ where })
    ]);

    return { items, total, page, limit };
  }

  async getNote(id: string) {
    const note = await this.prisma.relationshipNote.findUnique({
      where: { id },
      include: this.noteInclude()
    });
    if (!note) throw new NotFoundException(`RelationshipNote ${id} not found.`);
    return note;
  }

  async updateNote(id: string, input: UpdateNoteInput) {
    if (!input.body?.trim()) {
      throw new BadRequestException("Note body must not be empty.");
    }
    const existing = await this.prisma.relationshipNote.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`RelationshipNote ${id} not found.`);

    return this.prisma.relationshipNote.update({
      where: { id },
      data: { body: input.body.trim() },
      include: this.noteInclude()
    });
  }

  async deleteNote(id: string) {
    const existing = await this.prisma.relationshipNote.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`RelationshipNote ${id} not found.`);
    await this.prisma.relationshipNote.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Derived reads ─────────────────────────────────────────────────────────

  /**
   * "Going cold" — accounts whose linked contact(s) have not been contacted
   * in the last N days (or have never been contacted), and the account itself
   * has not been archived.
   *
   * Returns accounts ordered by oldest lastContactedAt first so the stalest
   * relationships surface at the top.
   */
  async getGoingColdAccounts(thresholdDays = GOING_COLD_DAYS_DEFAULT) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - thresholdDays);

    const accounts = await this.prisma.account.findMany({
      where: {
        archivedAt: null,
        contacts: {
          some: {
            OR: [
              { lastContactedAt: null },
              { lastContactedAt: { lt: cutoff } }
            ]
          }
        }
      },
      orderBy: { updatedAt: "asc" },
      take: 50,
      include: {
        client: { select: { id: true, name: true, code: true, isActive: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
        contacts: {
          where: {
            OR: [
              { lastContactedAt: null },
              { lastContactedAt: { lt: cutoff } }
            ]
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            email: true,
            lastContactedAt: true
          },
          orderBy: { lastContactedAt: "asc" },
          take: 3
        }
      }
    });

    return accounts.map((acc) => ({
      ...acc,
      coldSince: this.oldestContactDate(acc.contacts.map((c) => c.lastContactedAt)),
      thresholdDays
    }));
  }

  /**
   * "Repeat business" — accounts whose linked Client has won more than one
   * tender (Client.winCount > 1). Read-only derivation from the transactional
   * spine; no facts are duplicated.
   */
  async getRepeatBusinessAccounts() {
    const accounts = await this.prisma.account.findMany({
      where: {
        archivedAt: null,
        client: {
          winCount: { gt: 1 }
        }
      },
      orderBy: { client: { lastWonAt: "desc" } },
      take: 50,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
            winCount: true,
            tenderCount: true,
            winRate: true,
            lastWonAt: true,
            isActive: true
          }
        },
        owner: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    return accounts;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private noteInclude() {
    return {
      author: { select: { id: true, firstName: true, lastName: true } },
      account: { select: { id: true, client: { select: { id: true, name: true } } } },
      contact: { select: { id: true, firstName: true, lastName: true } }
    } satisfies Prisma.RelationshipNoteInclude;
  }

  private oldestContactDate(dates: (Date | null)[]): Date | null {
    const valid = dates.filter((d): d is Date => d != null);
    if (valid.length === 0) return null;
    return valid.reduce((oldest, d) => (d < oldest ? d : oldest));
  }

  private async requireUser(id: string) {
    const row = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException(`User ${id} not found.`);
  }

  private async requireAccount(id: string) {
    const row = await this.prisma.account.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException(`Account ${id} not found.`);
  }

  private async requireContact(id: string) {
    const row = await this.prisma.contact.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException(`Contact ${id} not found.`);
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Days threshold above which a contact is considered "cooling". */
const COOLING_THRESHOLD_DAYS = 30;
/** Days threshold above which a contact is considered "cold". */
const COLD_THRESHOLD_DAYS = 60;

// ── Types ─────────────────────────────────────────────────────────────────────

export type GoingColdStatus = "warm" | "cooling" | "cold" | "never_contacted";

export type GoingColdResult = {
  accountId: string;
  status: GoingColdStatus;
  daysSinceLastContact: number | null;
  lastContactedAt: Date | null;
};

export type RepeatBusinessSignal = {
  accountId: string;
  clientId: string | null;
  tenderCount: number;
  winCount: number;
  winRate: number | null;
  lastTenderAt: Date | null;
  lastWonAt: Date | null;
  hasRepeatBusiness: boolean;
};

export type CreateNoteInput = {
  accountId?: string | null;
  contactId?: string | null;
  authorId: string;
  body: string;
};

export type ListNotesQuery = {
  accountId?: string;
  contactId?: string;
  page?: number;
  limit?: number;
};

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * CRM-2: RelationshipsService — relationship notes + intelligence signals.
 *
 * CRUD for RelationshipNote scoped by account/contact; a `deriveGoingCold`
 * helper that reads `lastContactedAt` across the account's contacts and
 * returns a nudge; a `repeatBusinessSignal` helper that surfaces from existing
 * accounts/clients (derived reads only, no duplicated facts).
 *
 * Ownership rule: CRM owns contacts + relationship graph; transactional modules
 * own Tender/Job/Contract. This service reads them read-only — never writes.
 */
@Injectable()
export class RelationshipsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Note CRUD ──────────────────────────────────────────────────────────────

  async createNote(input: CreateNoteInput) {
    if (!input.accountId && !input.contactId) {
      throw new BadRequestException(
        "At least one of accountId or contactId is required."
      );
    }
    if (!input.body?.trim()) {
      throw new BadRequestException("Note body must not be empty.");
    }

    if (input.accountId) await this.requireAccount(input.accountId);
    if (input.contactId) await this.requireContact(input.contactId);
    await this.requireUser(input.authorId);

    return this.prisma.relationshipNote.create({
      data: {
        accountId: input.accountId ?? null,
        contactId: input.contactId ?? null,
        authorId: input.authorId,
        body: input.body.trim()
      },
      include: this.noteInclude()
    });
  }

  async listNotes(query: ListNotesQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));

    const where: Prisma.RelationshipNoteWhereInput = {};
    if (query.accountId) where.accountId = query.accountId;
    if (query.contactId) where.contactId = query.contactId;

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
    const row = await this.prisma.relationshipNote.findUnique({
      where: { id },
      include: this.noteInclude()
    });
    if (!row) throw new NotFoundException(`RelationshipNote ${id} not found.`);
    return row;
  }

  async deleteNote(id: string) {
    const row = await this.prisma.relationshipNote.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`RelationshipNote ${id} not found.`);
    await this.prisma.relationshipNote.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Going-cold nudge ───────────────────────────────────────────────────────

  /**
   * Derives a "going cold" status for an Account based on the most recent
   * `lastContactedAt` across all contacts linked to that Account.
   *
   * Thresholds (calendar days since last contact):
   *   - 0–29  days  → "warm"
   *   - 30–59 days  → "cooling"  (nudge: follow up soon)
   *   - 60+   days  → "cold"     (nudge: relationship at risk)
   *   - null         → "never_contacted" (no lastContactedAt set on any contact)
   */
  async deriveGoingCold(accountId: string): Promise<GoingColdResult> {
    await this.requireAccount(accountId);

    const contacts = await this.prisma.contact.findMany({
      where: { accountId },
      select: { lastContactedAt: true }
    });

    if (contacts.length === 0) {
      return {
        accountId,
        status: "never_contacted",
        daysSinceLastContact: null,
        lastContactedAt: null
      };
    }

    // Find the most recent lastContactedAt across all contacts
    const mostRecent = contacts.reduce<Date | null>((best, row) => {
      if (!row.lastContactedAt) return best;
      if (!best) return row.lastContactedAt;
      return row.lastContactedAt > best ? row.lastContactedAt : best;
    }, null);

    if (!mostRecent) {
      return {
        accountId,
        status: "never_contacted",
        daysSinceLastContact: null,
        lastContactedAt: null
      };
    }

    const now = new Date();
    const daysSince = Math.floor(
      (now.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24)
    );

    let status: GoingColdStatus;
    if (daysSince >= COLD_THRESHOLD_DAYS) {
      status = "cold";
    } else if (daysSince >= COOLING_THRESHOLD_DAYS) {
      status = "cooling";
    } else {
      status = "warm";
    }

    return {
      accountId,
      status,
      daysSinceLastContact: daysSince,
      lastContactedAt: mostRecent
    };
  }

  /**
   * Surfaces repeat-business signals for an Account by reading the read-only
   * cache fields on the linked Client (winCount, tenderCount, winRate,
   * lastTenderAt, lastWonAt). Derived reads only — never writes.
   *
   * An account is considered to have "repeat business" when winCount >= 2.
   */
  async repeatBusinessSignal(accountId: string): Promise<RepeatBusinessSignal> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        clientId: true,
        client: {
          select: {
            winCount: true,
            tenderCount: true,
            winRate: true,
            lastTenderAt: true,
            lastWonAt: true
          }
        }
      }
    });

    if (!account) throw new NotFoundException(`Account ${accountId} not found.`);

    const client = account.client;
    if (!client) {
      return {
        accountId,
        clientId: null,
        tenderCount: 0,
        winCount: 0,
        winRate: null,
        lastTenderAt: null,
        lastWonAt: null,
        hasRepeatBusiness: false
      };
    }

    const winRate = client.winRate ? client.winRate.toNumber() : null;

    return {
      accountId,
      clientId: account.clientId,
      tenderCount: client.tenderCount,
      winCount: client.winCount,
      winRate,
      lastTenderAt: client.lastTenderAt,
      lastWonAt: client.lastWonAt,
      hasRepeatBusiness: client.winCount >= 2
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private noteInclude() {
    return {
      author: { select: { id: true, firstName: true, lastName: true } },
      account: { select: { id: true } },
      contact: { select: { id: true, firstName: true, lastName: true } }
    } satisfies Prisma.RelationshipNoteInclude;
  }

  private async requireAccount(id: string) {
    const row = await this.prisma.account.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!row) throw new NotFoundException(`Account ${id} not found.`);
  }

  private async requireContact(id: string) {
    const row = await this.prisma.contact.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!row) throw new NotFoundException(`Contact ${id} not found.`);
  }

  private async requireUser(id: string) {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!row) throw new NotFoundException(`User ${id} not found.`);
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { EmailDirection, Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { EmailService } from "../../email/email.service";

// ── Entity types an email can be anchored to ─────────────────────────────────

/**
 * The CRM-5 slice scopes email anchoring to Account and Tender per
 * `docs/plans/crm-module-plan.md` §CRM-5. Storing this as a String column on
 * the row (see schema.prisma:`email_logs`) preserves the sub-module boundary
 * — no FK into Account/Tender — and matches the CommThread/CommTask pattern.
 */
export const EMAIL_LOG_ENTITY_TYPES = ["ACCOUNT", "TENDER"] as const;
export type EmailLogEntityType = (typeof EMAIL_LOG_ENTITY_TYPES)[number];

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Envelope of a Graph message the caller has already fetched via the
 * existing M365 seam (`apps/api/src/modules/email/**`). This service does
 * NOT talk to Graph itself — it persists a link between an already-captured
 * message and the CRM record it belongs to.
 */
export type LogEmailInput = {
  entityType: EmailLogEntityType;
  entityId: string;
  direction: EmailDirection;
  /** Microsoft Graph message id — unique per row. */
  graphMessageId: string;
  subject: string;
  fromAddress: string;
  toAddresses: string[];
  ccAddresses?: string[] | null;
  snippet?: string | null;
  sentAt: Date | string;
  /**
   * User attributing the log. Null when the capture path is a Graph webhook
   * or delta sync with no acting user (see EmailLog.loggedById on the schema).
   */
  loggedById?: string | null;
};

export type ListEmailsQuery = {
  entityType?: EmailLogEntityType;
  entityId?: string;
  direction?: EmailDirection;
  page?: number;
  limit?: number;
};

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * CRM-5: EmailLogService — persists Outlook/Graph emails against
 * Account/Tender inside the CRM-4 comms sub-module boundary.
 *
 * Consumes the EXISTING M365 seam (`EmailService`) for provider resolution;
 * does NOT re-implement the provider and does NOT touch Azure / Entra /
 * SharePoint config. The auto-capture wiring (Graph webhook / delta sync)
 * depends on Marco's tenant provisioning and lands separately — until then
 * this service is the write path any capture worker will call.
 *
 * The unique constraint on `graphMessageId` makes `logEmail` idempotent:
 * re-logging the same Graph message is a no-op that returns the existing
 * row (never throws), so a delta-sync retry can't create duplicates.
 */
@Injectable()
export class EmailLogService {
  private readonly logger = new Logger(EmailLogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService
  ) {}

  // ── Write ──────────────────────────────────────────────────────────────────

  async logEmail(input: LogEmailInput) {
    this.requireEntityType(input.entityType);
    if (!input.entityId?.trim()) {
      throw new BadRequestException("entityId is required.");
    }
    if (!input.graphMessageId?.trim()) {
      throw new BadRequestException("graphMessageId is required.");
    }
    if (!input.subject?.trim()) {
      throw new BadRequestException("subject is required.");
    }
    if (!input.fromAddress?.trim()) {
      throw new BadRequestException("fromAddress is required.");
    }
    if (!Array.isArray(input.toAddresses) || input.toAddresses.length === 0) {
      throw new BadRequestException("toAddresses must contain at least one recipient.");
    }
    if (input.loggedById) await this.requireUser(input.loggedById);

    const sentAt = new Date(input.sentAt);
    if (Number.isNaN(sentAt.getTime())) {
      throw new BadRequestException("sentAt is not a valid date.");
    }

    // Idempotent: a delta-sync retry that hands us the same graphMessageId
    // must not blow up — return the row we already have so the capture
    // worker can treat this call as fire-and-forget.
    const existing = await this.prisma.emailLog.findUnique({
      where: { graphMessageId: input.graphMessageId }
    });
    if (existing) {
      this.logger.debug(`emailLog: existing graphMessageId=${input.graphMessageId}`);
      return existing;
    }

    return this.prisma.emailLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        direction: input.direction,
        graphMessageId: input.graphMessageId,
        subject: input.subject,
        fromAddress: input.fromAddress,
        toAddresses: input.toAddresses,
        ccAddresses: input.ccAddresses?.length ? input.ccAddresses : Prisma.JsonNull,
        snippet: input.snippet ?? null,
        sentAt,
        loggedById: input.loggedById ?? null
      }
    });
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  async listEmails(query: ListEmailsQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));

    const where: Prisma.EmailLogWhereInput = {};
    if (query.entityType) {
      this.requireEntityType(query.entityType);
      where.entityType = query.entityType;
    }
    if (query.entityId) where.entityId = query.entityId;
    if (query.direction) where.direction = query.direction;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.emailLog.findMany({
        where,
        orderBy: [{ sentAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.emailLog.count({ where })
    ]);

    return { items, total, page, limit };
  }

  async getEmail(id: string) {
    const row = await this.prisma.emailLog.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`EmailLog ${id} not found.`);
    return row;
  }

  // ── Provider health probe (reuses EmailService seam) ──────────────────────

  /**
   * Thin pass-through to the existing EmailService verifier so an admin
   * screen can confirm the Graph seam this service relies on is reachable
   * WITHOUT this module having its own Azure config. Failure is returned
   * (not thrown) — mirrors EmailService.verifyConnection contract.
   */
  async verifyProvider() {
    return this.email.verifyConnection();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private requireEntityType(type: string): asserts type is EmailLogEntityType {
    if (!EMAIL_LOG_ENTITY_TYPES.includes(type as EmailLogEntityType)) {
      throw new BadRequestException(
        `Unsupported entityType "${type}". Expected one of ${EMAIL_LOG_ENTITY_TYPES.join(", ")}.`
      );
    }
  }

  private async requireUser(id: string) {
    const row = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException(`User ${id} not found.`);
  }
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

// D365 Timeline parity. Every entity type this route serves must be
// listed here so callers cannot fetch or write against arbitrary strings.
// Adding a new host = one line here plus (optionally) merged reads below.
const SUPPORTED_ENTITIES = ["Job", "Tender", "Client", "Contact"] as const;
export type TimelineEntityType = (typeof SUPPORTED_ENTITIES)[number];

export type TimelineItem = {
  id: string;
  kind: "note" | "status" | "attachment" | "system" | "correspondence" | "progress";
  body: string;
  createdAt: Date;
  author: { id: string; firstName: string; lastName: string } | null;
  metadata?: Record<string, unknown>;
};

/** Opaque compound cursor key. Valid only within the SAME from/to/kinds filter. */
export type TimelineCursor = { createdAt: Date; id: string };

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// NOTE: pagination is response-level — the in-memory merge still reads all rows;
// DB-level paging across four heterogeneous sources is a future follow-up.

/**
 * Backs the universal activity timeline. `list` merges four sources into a
 * single chronological stream so a host record's page shows notes,
 * correspondence, status transitions, progress notes and attachments in
 * one place — the classic D365 "Timeline" control. `addNote` writes only
 * to ActivityEntry; the merge does the rest of the work at read time.
 *
 * Only Job has all four merge sources today; other supported entity types
 * fall back to their ActivityEntry rows plus any DocumentLink attachments.
 * Adding richer merges (e.g. Tender status history, Client correspondence)
 * is a one-file follow-up — the shape is already correct.
 */
@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  parseEntityType(value: string): TimelineEntityType {
    if (!SUPPORTED_ENTITIES.includes(value as TimelineEntityType)) {
      throw new BadRequestException(
        `entityType must be one of ${SUPPORTED_ENTITIES.join(", ")}`
      );
    }
    return value as TimelineEntityType;
  }

  async list(
    entityType: TimelineEntityType,
    entityId: string,
    opts: {
      limit?: number;
      kinds?: TimelineItem["kind"][];
      /** Filter inclusive lower bound: items with createdAt >= from. */
      from?: Date;
      /** Filter inclusive upper bound: items with createdAt <= end-of-day(to). */
      to?: Date;
      /**
       * Cursor for the next page. Only valid within the SAME from/to/kinds filter.
       * After sort+filter, drop every item at-or-before the cursor by compound
       * compare (createdAt DESC, id DESC), then take `limit`.
       */
      cursor?: TimelineCursor;
    } = {}
  ): Promise<{
    items: TimelineItem[];
    nextCursor: TimelineCursor | null;
    entityType: TimelineEntityType;
    entityId: string;
  }> {
    await this.requireEntity(entityType, entityId);
    const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

    // Validate date range
    if (opts.from && opts.to && opts.from > opts.to) {
      throw new BadRequestException("`from` must be before or equal to `to`.");
    }

    const merged = [
      ...(await this.fromActivityEntries(entityType, entityId)),
      ...(await this.fromDocumentLinks(entityType, entityId)),
      ...(entityType === "Job" ? await this.fromJobSignals(entityId) : []),
      ...(await this.fromCorrespondence(entityType, entityId))
    ];

    let filtered = opts.kinds && opts.kinds.length > 0
      ? merged.filter((item) => opts.kinds!.includes(item.kind))
      : merged;

    // Apply date range filter
    if (opts.from) {
      const from = opts.from;
      filtered = filtered.filter((item) => item.createdAt >= from);
    }
    if (opts.to) {
      // Inclusive: end-of-day means 23:59:59.999 of that calendar day
      const endOfDay = new Date(opts.to);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter((item) => item.createdAt <= endOfDay);
    }

    // Stable compound sort: createdAt DESC, then id DESC as tiebreaker.
    // Seed/batch data routinely shares timestamps; sorting on createdAt alone
    // would make a cursor keyed on createdAt skip/repeat rows.
    filtered.sort((a, b) => {
      const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
    });

    // Apply cursor: drop every item at-or-before the cursor position
    let afterCursor = filtered;
    if (opts.cursor) {
      const { createdAt: cursorAt, id: cursorId } = opts.cursor;
      const cursorMs = cursorAt.getTime();
      // Find the cursor position and take only items after it
      const cursorIdx = filtered.findIndex(
        (item) =>
          item.createdAt.getTime() === cursorMs && item.id === cursorId
      );
      if (cursorIdx !== -1) {
        afterCursor = filtered.slice(cursorIdx + 1);
      } else {
        // Cursor not found in current window (e.g. item deleted or filter changed).
        // Drop all items that are "older" than the cursor (at-or-before by compound order).
        afterCursor = filtered.filter((item) => {
          const itemMs = item.createdAt.getTime();
          if (itemMs !== cursorMs) return itemMs < cursorMs;
          return item.id < cursorId;
        });
      }
    }

    const page = afterCursor.slice(0, limit);
    const hasMore = afterCursor.length > limit;
    const nextCursor: TimelineCursor | null = hasMore
      ? { createdAt: page[page.length - 1].createdAt, id: page[page.length - 1].id }
      : null;

    return { items: page, nextCursor, entityType, entityId };
  }

  async addNote(
    entityType: TimelineEntityType,
    entityId: string,
    body: string,
    authorId: string
  ): Promise<TimelineItem> {
    await this.requireEntity(entityType, entityId);
    const trimmed = body?.trim();
    if (!trimmed) throw new BadRequestException("Note body is required.");

    const entry = await this.prisma.activityEntry.create({
      data: { entityType, entityId, kind: "note", body: trimmed, authorId },
      include: { author: { select: { id: true, firstName: true, lastName: true } } }
    });

    return {
      id: entry.id,
      kind: "note",
      body: entry.body,
      createdAt: entry.createdAt,
      author: entry.author,
      metadata: (entry.metadata as Record<string, unknown>) ?? undefined
    };
  }

  private async fromActivityEntries(
    entityType: TimelineEntityType,
    entityId: string
  ): Promise<TimelineItem[]> {
    const rows = await this.prisma.activityEntry.findMany({
      where: { entityType, entityId },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind as TimelineItem["kind"],
      body: row.body,
      createdAt: row.createdAt,
      author: row.author,
      metadata: (row.metadata as Record<string, unknown>) ?? undefined
    }));
  }

  private async fromDocumentLinks(
    entityType: TimelineEntityType,
    entityId: string
  ): Promise<TimelineItem[]> {
    const rows = await this.prisma.documentLink.findMany({
      where: { linkedEntityType: entityType, linkedEntityId: entityId },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((row) => ({
      id: `doc:${row.id}`,
      kind: "attachment" as const,
      body: row.title,
      createdAt: row.createdAt,
      author: row.createdBy,
      metadata: {
        documentLinkId: row.id,
        category: row.category,
        module: row.module,
        versionLabel: row.versionLabel ?? undefined
      }
    }));
  }

  private async fromJobSignals(jobId: string): Promise<TimelineItem[]> {
    const [statusHistory, progressEntries] = await Promise.all([
      this.prisma.jobStatusHistory.findMany({
        where: { jobId },
        include: { changedBy: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { changedAt: "desc" }
      }),
      this.prisma.jobProgressEntry.findMany({
        where: { jobId },
        include: { author: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" }
      })
    ]);

    const statusItems: TimelineItem[] = statusHistory.map((row) => ({
      id: `status:${row.id}`,
      kind: "status" as const,
      body: row.note ?? `Status changed to ${row.toStatus}`,
      createdAt: row.changedAt,
      author: row.changedBy,
      metadata: {
        fromStatus: row.fromStatus ?? undefined,
        toStatus: row.toStatus
      }
    }));

    const progressItems: TimelineItem[] = progressEntries.map((row) => ({
      id: `progress:${row.id}`,
      kind: "progress" as const,
      body: row.summary,
      createdAt: row.createdAt,
      author: row.author,
      metadata: {
        entryType: row.entryType,
        percentComplete: row.percentComplete ?? undefined,
        entryDate: row.entryDate.toISOString()
      }
    }));

    return [...statusItems, ...progressItems];
  }

  private async fromCorrespondence(
    entityType: TimelineEntityType,
    entityId: string
  ): Promise<TimelineItem[]> {
    // CorrespondenceThread is polymorphic across only client/tender/job.
    const ownerFilter =
      entityType === "Client"
        ? { clientId: entityId }
        : entityType === "Tender"
          ? { tenderId: entityId }
          : entityType === "Job"
            ? { jobId: entityId }
            : null;
    if (!ownerFilter) return [];

    const messages = await this.prisma.correspondenceMessage.findMany({
      where: { thread: ownerFilter },
      include: {
        sentBy: { select: { id: true, firstName: true, lastName: true } },
        thread: { select: { subject: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return messages.map((msg) => ({
      id: `corr:${msg.id}`,
      kind: "correspondence" as const,
      body: msg.thread.subject,
      createdAt: msg.sentAt ?? msg.receivedAt ?? msg.createdAt,
      author: msg.sentBy,
      metadata: {
        direction: msg.direction,
        fromAddress: msg.fromAddress,
        toAddresses: msg.toAddresses,
        preview: msg.bodyText.slice(0, 200)
      }
    }));
  }

  private async requireEntity(entityType: TimelineEntityType, entityId: string) {
    const delegates: Record<TimelineEntityType, Prisma.ModelName> = {
      Job: "Job",
      Tender: "Tender",
      Client: "Client",
      Contact: "Contact"
    };
    const modelName = delegates[entityType];
    // Bracketed access — Prisma's dynamic delegate lookup. Every entity
    // has a `findUnique({ where: { id }, select: { id: true } })` shape.
    const delegate = (this.prisma as unknown as Record<string, { findUnique: (args: { where: { id: string }; select: { id: true } }) => Promise<{ id: string } | null> }>)[
      modelName.charAt(0).toLowerCase() + modelName.slice(1)
    ];
    const row = await delegate.findUnique({ where: { id: entityId }, select: { id: true } });
    if (!row) throw new NotFoundException(`${entityType} not found.`);
  }
}

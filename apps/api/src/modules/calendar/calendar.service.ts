import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { CALENDAR_ADAPTER, CalendarAdapter } from "./calendar.adapter";
import {
  CalendarSyncedEventDto,
  CalendarSyncRunResultDto,
  CalendarSyncStatusDto
} from "./dto/calendar.dto";
import {
  isShiftSyncable,
  shiftToCalendarEvent,
  SYNCABLE_SHIFT_STATUSES,
  type SyncableShift
} from "./calendar-event.mapper";

// PR-216 — Calendar sync orchestrator. Mock-mode-first. The
// schedulable item set is currently "shifts where the user is the
// lead and the shift is still planned/in-progress and ends in the
// future". On every run we:
//  1. Look up the candidate shifts for the user.
//  2. Upsert each one through the adapter (idempotent).
//  3. For any previously-synced row whose source shift is no longer
//     in the candidate set (cancelled, completed, deleted, lead
//     changed), cancel it through the adapter.
@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(CALENDAR_ADAPTER) private readonly adapter: CalendarAdapter
  ) {}

  get mode(): "mock" | "live" {
    return this.config.get<string>("CALENDAR_MODE", "mock") === "live" ? "live" : "mock";
  }

  async runSync(userId: string): Promise<CalendarSyncRunResultDto> {
    const now = new Date();

    const shifts = (await this.prisma.shift.findMany({
      where: {
        leadUserId: userId,
        status: { in: Array.from(SYNCABLE_SHIFT_STATUSES) },
        endAt: { gt: now }
      },
      include: {
        job: { select: { jobNumber: true, name: true } },
        activity: { select: { name: true } }
      }
    })) as unknown as SyncableShift[];

    // Snapshot existing rows so we can diff candidate-set vs. on-file.
    const existing = await this.prisma.calendarSyncedEvent.findMany({
      where: { userId, sourceType: "shift" },
      select: { sourceId: true, status: true, startAt: true, endAt: true, title: true, location: true }
    });
    const existingBySourceId = new Map(existing.map((row) => [row.sourceId, row]));

    let created = 0;
    let updated = 0;
    let cancelled = 0;

    const seenSourceIds = new Set<string>();
    for (const shift of shifts) {
      if (!isShiftSyncable(shift, now)) continue;
      seenSourceIds.add(shift.id);

      const event = shiftToCalendarEvent(shift, userId);
      const existingRow = existingBySourceId.get(shift.id);

      await this.adapter.upsertEvent(event);

      if (!existingRow || existingRow.status === "cancelled") {
        created += 1;
      } else if (
        existingRow.startAt.getTime() !== shift.startAt.getTime() ||
        existingRow.endAt.getTime() !== shift.endAt.getTime() ||
        existingRow.title !== event.title ||
        (existingRow.location ?? null) !== (event.location ?? null)
      ) {
        updated += 1;
      }
    }

    // Anything previously active but no longer in the candidate set
    // gets cancelled. This handles shift deletion (Prisma cascade
    // doesn't help us here — the row only goes to cancelled, not
    // hard-deleted, because the live adapter will need it to know
    // which Graph event id to cancel).
    for (const row of existing) {
      if (row.status === "active" && !seenSourceIds.has(row.sourceId)) {
        await this.adapter.cancelEvent({
          userId,
          sourceType: "shift",
          sourceId: row.sourceId
        });
        cancelled += 1;
      }
    }

    const activeCount = await this.prisma.calendarSyncedEvent.count({
      where: { userId, status: "active" }
    });

    return { created, updated, cancelled, activeCount };
  }

  async getStatus(userId: string): Promise<CalendarSyncStatusDto> {
    const [activeCount, cancelledCount, latest] = await Promise.all([
      this.prisma.calendarSyncedEvent.count({ where: { userId, status: "active" } }),
      this.prisma.calendarSyncedEvent.count({ where: { userId, status: "cancelled" } }),
      this.prisma.calendarSyncedEvent.findFirst({
        where: { userId },
        orderBy: { lastSyncedAt: "desc" },
        select: { lastSyncedAt: true }
      })
    ]);

    return {
      mode: this.mode,
      activeCount,
      cancelledCount,
      lastSyncedAt: latest?.lastSyncedAt.toISOString() ?? null
    };
  }

  async listEvents(userId: string): Promise<CalendarSyncedEventDto[]> {
    const rows = await this.prisma.calendarSyncedEvent.findMany({
      where: { userId },
      orderBy: { startAt: "asc" }
    });
    return rows.map((row) => ({
      id: row.id,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      externalEventId: row.externalEventId,
      title: row.title,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      location: row.location,
      status: row.status as "active" | "cancelled",
      lastSyncedAt: row.lastSyncedAt.toISOString()
    }));
  }

  // Genuinely useful interim while the live Graph adapter is pending:
  // the active synced events emitted as an iCalendar feed. The user
  // can subscribe Outlook / Apple Calendar / Google Calendar to this
  // URL (with their bearer token via an auth proxy) and see shifts
  // without any Graph permission. Format follows RFC 5545 closely
  // enough for the major clients to import without complaint.
  async buildIcsFeed(userId: string): Promise<string> {
    const events = await this.prisma.calendarSyncedEvent.findMany({
      where: { userId, status: "active" },
      orderBy: { startAt: "asc" }
    });

    const stamp = formatIcsDate(new Date());
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Initial Services//Project Operations Calendar Sync//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH"
    ];

    for (const event of events) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${event.externalEventId}@projectops.local`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${formatIcsDate(event.startAt)}`,
        `DTEND:${formatIcsDate(event.endAt)}`,
        `SUMMARY:${escapeIcsText(event.title)}`,
        ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
        "END:VEVENT"
      );
    }

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatIcsDate(date: Date): string {
  return (
    date.getUTCFullYear().toString() +
    pad2(date.getUTCMonth() + 1) +
    pad2(date.getUTCDate()) +
    "T" +
    pad2(date.getUTCHours()) +
    pad2(date.getUTCMinutes()) +
    pad2(date.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcsText(value: string): string {
  // RFC 5545 §3.3.11 — backslash, semicolon, comma, newline.
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

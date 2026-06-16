import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CalendarAdapter,
  CalendarEventInput,
  CalendarEventResult
} from "./calendar.adapter";

// PR-216 — Mock calendar adapter. Records "synced" events in the
// calendar_synced_events table. The flow (sync now → see events →
// re-sync to update → shift removed → row marked cancelled) is fully
// exercisable without a Microsoft Graph credential.
@Injectable()
export class MockCalendarAdapter implements CalendarAdapter {
  constructor(private readonly prisma: PrismaService) {}

  async upsertEvent(input: CalendarEventInput): Promise<CalendarEventResult> {
    const existing = await this.prisma.calendarSyncedEvent.findUnique({
      where: {
        userId_sourceType_sourceId: {
          userId: input.userId,
          sourceType: input.sourceType,
          sourceId: input.sourceId
        }
      }
    });

    const externalEventId = existing?.externalEventId ?? `mock-${randomUUID()}`;

    await this.prisma.calendarSyncedEvent.upsert({
      where: {
        userId_sourceType_sourceId: {
          userId: input.userId,
          sourceType: input.sourceType,
          sourceId: input.sourceId
        }
      },
      create: {
        userId: input.userId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        externalEventId,
        title: input.title,
        startAt: input.startAt,
        endAt: input.endAt,
        location: input.location ?? null,
        status: "active",
        lastSyncedAt: new Date()
      },
      update: {
        title: input.title,
        startAt: input.startAt,
        endAt: input.endAt,
        location: input.location ?? null,
        status: "active",
        lastSyncedAt: new Date()
      }
    });

    return { externalEventId, webUrl: "mock://calendar" };
  }

  async cancelEvent(input: {
    userId: string;
    sourceType: string;
    sourceId: string;
  }): Promise<void> {
    await this.prisma.calendarSyncedEvent.updateMany({
      where: {
        userId: input.userId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        status: "active"
      },
      data: { status: "cancelled", lastSyncedAt: new Date() }
    });
  }
}

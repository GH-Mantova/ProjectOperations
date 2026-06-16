import { Inject } from "@nestjs/common";

// PR-216 — Calendar Sync (mock-mode) adapter contract. Mirrors the
// SharePoint adapter pattern (SHAREPOINT_MODE) so a live Microsoft
// Graph calendar implementation can be wired in later without
// touching CalendarService. Live Graph calendar is a follow-up — it
// requires the Calendars.ReadWrite delegated permission (or
// Calendars.ReadWrite.All app permission) on the Entra app
// registration plus Marco's sign-off.

export type CalendarEventInput = {
  // Mock-mode key: the unique combination of (userId, sourceType,
  // sourceId) lets re-syncs idempotently create/update/cancel.
  userId: string;
  sourceType: string;
  sourceId: string;
  title: string;
  startAt: Date;
  endAt: Date;
  location?: string | null;
};

export type CalendarEventResult = {
  externalEventId: string;
  // Where the event lives. For the mock adapter this is just a label
  // ("mock"); the live Graph adapter would return the Outlook URL.
  webUrl?: string;
};

export interface CalendarAdapter {
  // Upserts one event. Idempotent — repeated calls with the same
  // (userId, sourceType, sourceId) update the existing event in place.
  upsertEvent(input: CalendarEventInput): Promise<CalendarEventResult>;
  // Marks the event for (userId, sourceType, sourceId) as cancelled.
  // Idempotent — cancelling a non-existent event is a no-op.
  cancelEvent(input: { userId: string; sourceType: string; sourceId: string }): Promise<void>;
}

export const CALENDAR_ADAPTER = Symbol("CALENDAR_ADAPTER");
export const InjectCalendarAdapter = () => Inject(CALENDAR_ADAPTER);

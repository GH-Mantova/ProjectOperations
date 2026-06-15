import { Injectable } from "@nestjs/common";
import { CalendarAdapter, CalendarEventInput, CalendarEventResult } from "./calendar.adapter";

// PR-216 — Stub for the live Microsoft Graph calendar adapter.
// Follow-up work: implement upsertEvent/cancelEvent against the
// /users/{id}/events Graph endpoint using the Calendars.ReadWrite[.All]
// permission on the Entra app registration. Until that's done and
// Marco has signed off on the added permission, CALENDAR_MODE=live
// is intentionally non-functional.
@Injectable()
export class GraphCalendarAdapter implements CalendarAdapter {
  async upsertEvent(_input: CalendarEventInput): Promise<CalendarEventResult> {
    void _input;
    throw new Error(
      "Live Microsoft Graph calendar adapter is not yet implemented (PR-216 follow-up). Set CALENDAR_MODE=mock."
    );
  }

  async cancelEvent(_input: {
    userId: string;
    sourceType: string;
    sourceId: string;
  }): Promise<void> {
    void _input;
    throw new Error(
      "Live Microsoft Graph calendar adapter is not yet implemented (PR-216 follow-up). Set CALENDAR_MODE=mock."
    );
  }
}

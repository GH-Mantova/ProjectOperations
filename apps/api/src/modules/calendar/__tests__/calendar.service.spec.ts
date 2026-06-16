import { CalendarService } from "../calendar.service";
import type { CalendarAdapter, CalendarEventInput, CalendarEventResult } from "../calendar.adapter";

type SyncedRow = {
  sourceId: string;
  status: "active" | "cancelled";
  startAt: Date;
  endAt: Date;
  title: string;
  location: string | null;
};

class FakeAdapter implements CalendarAdapter {
  upserts: CalendarEventInput[] = [];
  cancellations: Array<{ sourceId: string }> = [];

  async upsertEvent(input: CalendarEventInput): Promise<CalendarEventResult> {
    this.upserts.push(input);
    return { externalEventId: `mock-${input.sourceId}`, webUrl: "mock://calendar" };
  }
  async cancelEvent(input: { userId: string; sourceType: string; sourceId: string }) {
    this.cancellations.push({ sourceId: input.sourceId });
  }
}

function buildService(opts: {
  shifts: Array<{
    id: string;
    leadUserId: string;
    title: string;
    startAt: Date;
    endAt: Date;
    status: string;
    notes: null;
    workInstructions: null;
    jobId: string;
    jobActivityId: string;
    job: { jobNumber: string; name: string };
    activity: { name: string };
  }>;
  existing: SyncedRow[];
}) {
  const adapter = new FakeAdapter();
  const prisma = {
    shift: { findMany: jest.fn().mockResolvedValue(opts.shifts) },
    calendarSyncedEvent: {
      findMany: jest.fn().mockResolvedValue(opts.existing),
      count: jest.fn().mockResolvedValue(opts.existing.filter((e) => e.status === "active").length),
      findFirst: jest.fn().mockResolvedValue(null)
    }
  };
  const config = { get: (_k: string, d: unknown) => d } as never;
  return { service: new CalendarService(prisma as never, config, adapter), adapter, prisma };
}

const makeShift = (overrides: Partial<{ id: string; status: string; endAt: Date; startAt: Date; title: string }> = {}) => ({
  id: overrides.id ?? "shift-1",
  leadUserId: "user-1",
  title: overrides.title ?? "Concrete pour",
  startAt: overrides.startAt ?? new Date("2027-01-01T07:00:00Z"),
  endAt: overrides.endAt ?? new Date("2027-01-01T15:00:00Z"),
  status: overrides.status ?? "PLANNED",
  notes: null,
  workInstructions: null,
  jobId: "job-1",
  jobActivityId: "activity-1",
  job: { jobNumber: "J-100", name: "Site A" },
  activity: { name: "Slab works" }
});

describe("CalendarService.runSync", () => {
  it("creates events for new shifts", async () => {
    const { service, adapter } = buildService({ shifts: [makeShift()], existing: [] });
    const result = await service.runSync("user-1");
    expect(adapter.upserts).toHaveLength(1);
    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.cancelled).toBe(0);
  });

  it("counts an update when the existing row's times have shifted", async () => {
    const shift = makeShift({ startAt: new Date("2027-01-01T09:00:00Z") });
    const { service } = buildService({
      shifts: [shift],
      existing: [
        {
          sourceId: shift.id,
          status: "active",
          startAt: new Date("2027-01-01T07:00:00Z"),
          endAt: shift.endAt,
          title: "[J-100] Concrete pour — Slab works",
          location: "Site A"
        }
      ]
    });
    const result = await service.runSync("user-1");
    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.cancelled).toBe(0);
  });

  it("cancels events whose source shift is no longer in the candidate set", async () => {
    const { service, adapter } = buildService({
      shifts: [],
      existing: [
        {
          sourceId: "shift-gone",
          status: "active",
          startAt: new Date("2027-01-01T07:00:00Z"),
          endAt: new Date("2027-01-01T15:00:00Z"),
          title: "Old shift",
          location: null
        }
      ]
    });
    const result = await service.runSync("user-1");
    expect(adapter.cancellations).toEqual([{ sourceId: "shift-gone" }]);
    expect(result.cancelled).toBe(1);
  });

  it("does not double-cancel rows already marked cancelled", async () => {
    const { service, adapter } = buildService({
      shifts: [],
      existing: [
        {
          sourceId: "shift-old",
          status: "cancelled",
          startAt: new Date("2027-01-01T07:00:00Z"),
          endAt: new Date("2027-01-01T15:00:00Z"),
          title: "Old shift",
          location: null
        }
      ]
    });
    const result = await service.runSync("user-1");
    expect(adapter.cancellations).toEqual([]);
    expect(result.cancelled).toBe(0);
  });
});

describe("CalendarService.buildIcsFeed", () => {
  it("emits a VCALENDAR/VEVENT envelope for each active row", async () => {
    const prisma = {
      calendarSyncedEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            externalEventId: "mock-1",
            title: "Shift; with, special\\chars",
            startAt: new Date("2027-01-01T07:00:00Z"),
            endAt: new Date("2027-01-01T15:00:00Z"),
            location: "Site A"
          }
        ])
      },
      shift: { findMany: jest.fn() }
    };
    const adapter: CalendarAdapter = {
      upsertEvent: jest.fn().mockResolvedValue({ externalEventId: "x" }),
      cancelEvent: jest.fn().mockResolvedValue(undefined)
    };
    const service = new CalendarService(
      prisma as never,
      { get: (_k: string, d: unknown) => d } as never,
      adapter
    );
    const ics = await service.buildIcsFeed("user-1");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("UID:mock-1@projectops.local");
    expect(ics).toContain("DTSTART:20270101T070000Z");
    expect(ics).toContain("DTEND:20270101T150000Z");
    expect(ics).toContain("SUMMARY:Shift\\; with\\, special\\\\chars");
    expect(ics).toContain("LOCATION:Site A");
  });
});

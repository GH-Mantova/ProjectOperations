import { isShiftSyncable, shiftToCalendarEvent, type SyncableShift } from "../calendar-event.mapper";

function buildShift(overrides: Partial<SyncableShift> = {}): SyncableShift {
  return {
    id: "shift-1",
    jobId: "job-1",
    jobActivityId: "activity-1",
    leadUserId: "user-1",
    title: "Concrete pour",
    startAt: new Date("2026-06-20T07:00:00Z"),
    endAt: new Date("2026-06-20T15:00:00Z"),
    status: "PLANNED",
    notes: null,
    workInstructions: null,
    job: { jobNumber: "J-100", name: "Site A" },
    activity: { name: "Slab works" },
    ...overrides
  };
}

describe("calendar-event.mapper", () => {
  describe("isShiftSyncable", () => {
    const now = new Date("2026-06-19T00:00:00Z");

    it("syncs PLANNED shifts ending in the future", () => {
      expect(isShiftSyncable(buildShift({ status: "PLANNED" }), now)).toBe(true);
    });

    it("syncs IN_PROGRESS shifts ending in the future", () => {
      expect(isShiftSyncable(buildShift({ status: "IN_PROGRESS" }), now)).toBe(true);
    });

    it("excludes COMPLETED shifts", () => {
      expect(isShiftSyncable(buildShift({ status: "COMPLETED" }), now)).toBe(false);
    });

    it("excludes CANCELLED shifts", () => {
      expect(isShiftSyncable(buildShift({ status: "CANCELLED" }), now)).toBe(false);
    });

    it("excludes shifts that have already ended", () => {
      expect(
        isShiftSyncable(
          buildShift({ endAt: new Date("2026-06-18T15:00:00Z") }),
          now
        )
      ).toBe(false);
    });
  });

  describe("shiftToCalendarEvent", () => {
    it("builds a calendar event with job number, title and activity", () => {
      const event = shiftToCalendarEvent(buildShift(), "user-1");
      expect(event).toEqual({
        userId: "user-1",
        sourceType: "shift",
        sourceId: "shift-1",
        title: "[J-100] Concrete pour — Slab works",
        startAt: new Date("2026-06-20T07:00:00Z"),
        endAt: new Date("2026-06-20T15:00:00Z"),
        location: "Site A"
      });
    });

    it("omits the job-number prefix when no job number is present", () => {
      const event = shiftToCalendarEvent(
        buildShift({ job: { jobNumber: null, name: "Site A" } }),
        "user-1"
      );
      expect(event.title).toBe("Concrete pour — Slab works");
    });

    it("omits the activity suffix when no activity name is present", () => {
      const event = shiftToCalendarEvent(buildShift({ activity: { name: null } }), "user-1");
      expect(event.title).toBe("[J-100] Concrete pour");
    });

    it("falls back to null location when the job has no name", () => {
      const event = shiftToCalendarEvent(
        buildShift({ job: { jobNumber: "J-100", name: null } }),
        "user-1"
      );
      expect(event.location).toBeNull();
    });
  });
});

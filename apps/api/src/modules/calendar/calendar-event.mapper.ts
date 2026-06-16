// PR-216 — Maps schedulable Shifts to CalendarEventInputs. Pulled
// out into its own module so the mapping can be unit-tested without
// touching Prisma or the adapter wiring.

import type { CalendarEventInput } from "./calendar.adapter";

// Shape we accept from the scheduler — only the fields we need. Keeps
// the mapper decoupled from Prisma's generated Shift type so the
// adapter tier doesn't depend on @prisma/client.
export type SyncableShift = {
  id: string;
  jobId: string;
  jobActivityId: string;
  leadUserId: string | null;
  title: string;
  startAt: Date;
  endAt: Date;
  status: string;
  notes: string | null;
  workInstructions: string | null;
  job?: { jobNumber?: string | null; name?: string | null } | null;
  activity?: { name?: string | null } | null;
};

// Sync only the shifts the user is leading and that are still
// expected to happen (PLANNED / IN_PROGRESS, end in future). Anything
// outside the window — completed, cancelled, or ending in the past —
// is excluded and should be cancelled on the calendar side.
export const SYNCABLE_SHIFT_STATUSES = new Set(["PLANNED", "IN_PROGRESS"]);

export function isShiftSyncable(shift: Pick<SyncableShift, "status" | "endAt">, now: Date): boolean {
  return SYNCABLE_SHIFT_STATUSES.has(shift.status) && shift.endAt.getTime() > now.getTime();
}

export function shiftToCalendarEvent(shift: SyncableShift, userId: string): CalendarEventInput {
  const jobNumber = shift.job?.jobNumber ?? null;
  const activityName = shift.activity?.name ?? null;

  const titlePieces = [jobNumber ? `[${jobNumber}]` : null, shift.title, activityName ? `— ${activityName}` : null]
    .filter((piece): piece is string => Boolean(piece));

  return {
    userId,
    sourceType: "shift",
    sourceId: shift.id,
    title: titlePieces.join(" "),
    startAt: shift.startAt,
    endAt: shift.endAt,
    location: shift.job?.name ?? null
  };
}

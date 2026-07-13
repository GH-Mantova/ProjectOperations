/**
 * Canonical status catalogues for Project and Job records.
 *
 * Single source of truth for the frontend — mirrors the Prisma `ProjectStatus`
 * enum and the values `Job.status` is written with by the API. Any UI that
 * lists, labels, or filters by these statuses should import from here so a
 * schema change can't drift silently in one page while leaving others stale
 * (S3-006 was the same class of bug in forms analytics; S3-014 is this one).
 *
 * The web app does not import Prisma types — the `PROJECT_STATUSES` list is
 * asserted to match the enum in `customWidget.test.ts`.
 */

export const PROJECT_STATUSES = [
  "MOBILISING",
  "ACTIVE",
  "PRACTICAL_COMPLETION",
  "DEFECTS",
  "CLOSED"
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  MOBILISING: "Mobilising",
  ACTIVE: "Active",
  PRACTICAL_COMPLETION: "Practical Completion",
  DEFECTS: "Defects",
  CLOSED: "Closed"
};

export const JOB_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETE"] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETE: "Complete"
};

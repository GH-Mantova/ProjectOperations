export type JobProgressStage = {
  id: string;
  activities?: Array<{ id: string; status: string }>;
};

export type JobProgressShape = {
  stages?: JobProgressStage[];
};

export function progressPercent(job: JobProgressShape): number {
  const activities = job.stages?.flatMap((stage) => stage.activities ?? []) ?? [];
  if (activities.length === 0) return 0;
  const done = activities.filter((activity) => activity.status === "COMPLETE").length;
  return Math.round((done / activities.length) * 100);
}

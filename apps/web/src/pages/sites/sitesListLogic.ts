export type SiteJobsCountShape = {
  _count?: { jobs?: number };
};

export function siteJobsCount(site: SiteJobsCountShape): number {
  return site._count?.jobs ?? 0;
}

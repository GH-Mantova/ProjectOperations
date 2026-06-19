export type UtilisationRow = {
  assetId: string;
  assetName: string;
  category: string;
  hoursAllocated: number;
  hoursAvailable: number;
  utilisationRate: number;
  allocationCount: number;
};

export type UtilisationSummary = {
  assetCount: number;
  totalHoursAllocated: number;
  totalHoursAvailable: number;
  fleetUtilisationRate: number;
  topAsset: UtilisationRow | null;
};

export function summariseUtilisation(rows: UtilisationRow[]): UtilisationSummary {
  if (rows.length === 0) {
    return {
      assetCount: 0,
      totalHoursAllocated: 0,
      totalHoursAvailable: 0,
      fleetUtilisationRate: 0,
      topAsset: null
    };
  }
  let allocated = 0;
  let available = 0;
  let top: UtilisationRow = rows[0];
  for (const row of rows) {
    allocated += row.hoursAllocated;
    available += row.hoursAvailable;
    if (row.utilisationRate > top.utilisationRate) top = row;
  }
  const fleetRate = available > 0 ? Math.min(allocated / available, 1) : 0;
  return {
    assetCount: rows.length,
    totalHoursAllocated: allocated,
    totalHoursAvailable: available,
    fleetUtilisationRate: fleetRate,
    topAsset: top
  };
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

export function buildChartData(rows: UtilisationRow[], limit = 10): Array<{ label: string; value: number }> {
  return rows.slice(0, limit).map((row) => ({
    label: row.assetName,
    value: Number((row.utilisationRate * 100).toFixed(1))
  }));
}

export function defaultDateRange(now: Date = new Date()): { from: string; to: string } {
  const to = new Date(now);
  to.setHours(0, 0, 0, 0);
  const from = new Date(to);
  from.setDate(from.getDate() - 27);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

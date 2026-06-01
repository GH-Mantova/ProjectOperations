export type QuoteScopeItemForGrouping = {
  id: string;
  quoteDiscipline: string | null;
  label: string | null;
};

const KNOWN_DISCIPLINES = new Set(["DEM", "CIV", "ASB"]);

export function disciplineForItem(item: QuoteScopeItemForGrouping): string {
  if (item.quoteDiscipline) return item.quoteDiscipline;
  const prefix = item.label ? /^[A-Za-z]+/.exec(item.label)?.[0]?.toUpperCase() : null;
  if (prefix && KNOWN_DISCIPLINES.has(prefix)) return prefix;
  return "Other";
}

export function groupByDiscipline<T extends QuoteScopeItemForGrouping>(
  rows: readonly T[],
  emptyGroups?: Iterable<string>
): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const key = disciplineForItem(r);
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }
  if (emptyGroups) {
    for (const eg of emptyGroups) {
      if (!groups.has(eg)) groups.set(eg, []);
    }
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function arrayMove<T>(arr: readonly T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/**
 * Recompute sortOrder when an item is dragged within a single discipline.
 * Returns the full reordered rows array (preserving the absolute positions of
 * items in other disciplines) OR null when the move is invalid or a no-op:
 *  - active === over (dropped on itself)
 *  - either id not found in rows
 *  - active and over belong to different disciplines (cross-group drop)
 */
export function recomputeSortOrderWithinGroup<T extends QuoteScopeItemForGrouping>(
  rows: readonly T[],
  activeId: string,
  overId: string
): T[] | null {
  if (activeId === overId) return null;

  const active = rows.find((r) => r.id === activeId);
  const over = rows.find((r) => r.id === overId);
  if (!active || !over) return null;

  const activeDisc = disciplineForItem(active);
  const overDisc = disciplineForItem(over);
  if (activeDisc !== overDisc) return null;

  const group = rows.filter((r) => disciplineForItem(r) === activeDisc);
  const gFrom = group.findIndex((r) => r.id === activeId);
  const gTo = group.findIndex((r) => r.id === overId);
  if (gFrom < 0 || gTo < 0) return null;

  const reordered = arrayMove(group, gFrom, gTo);
  const groupIds = new Set(group.map((r) => r.id));
  let cursor = 0;
  return rows.map((r) => (groupIds.has(r.id) ? reordered[cursor++]! : r));
}

/**
 * reportingTemplate — pure function that seeds a UserDashboardConfig from a
 * list of ReportDefinitionSummary objects.
 *
 * SLICE 7 of reporting-dashboard-layout-plan.md §7.
 *
 * The resulting config contains one `report:table:<key>` widget per definition,
 * in the order the definitions are supplied. Each widget is visible, has a
 * unique id, and an `order` value that increases monotonically from 0.
 * dashboardFilters is left empty (the user tunes from there, per plan §2
 * Option A description).
 *
 * Rationale for table-only (not chart): the template seeds one widget per
 * definition so the dashboard is immediately useful. Chart widgets are
 * optionally added afterwards via the widget gallery. (SLICE 7 spec says
 * "one report:table widget per definition".)
 */

import type { UserDashboardConfig, WidgetConfigEntry } from "./types";
import type { ReportDefinitionSummary } from "./widgets/reportRegistry";

/**
 * Build a UserDashboardConfig that seeds one `report:table:<key>` widget for
 * every entry in `defs`. An empty `defs` list produces a valid config with an
 * empty widgets array.
 *
 * Widget ids are constructed as `report-table-<key>` which is guaranteed unique
 * as long as definition keys are unique (enforced by the BI registry).
 */
export function reportingTemplate(defs: ReportDefinitionSummary[]): UserDashboardConfig {
  const widgets: WidgetConfigEntry[] = defs.map((def, index) => ({
    id: `report-table-${def.key}`,
    type: `report:table:${def.key}`,
    visible: true,
    order: index,
    config: { period: null, filters: {} }
  }));

  return {
    period: "30d",
    widgets
  };
}

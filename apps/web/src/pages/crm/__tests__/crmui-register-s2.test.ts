// crmui-register-s2 — CRM_FOLLOWUPS_V2 pure logic assertions.
//
// The Follow-ups summary and the controls it was missing: the four KPI cards,
// the entity-type toggle group built on the five status Sets that were dead in
// the page, and the Type chip column that is derived from those same Sets.
//
// No jsdom; pure unit tests over the exported helpers only — same pattern as
// crmui-accounts-list-s1.test.ts, crmui-register-s1.test.ts and
// crm-s8-register-helpers.test.ts.

import { describe, expect, it } from "vitest";
import {
  classifyEntityType,
  classifyNextAction,
  columnsForTab,
  computeRegisterKpis,
  entityTypeChipLabel,
  entityTypePassesFilter,
  formatMoneyAUD,
  isDueThisWeek,
  nextActionPassesFilter,
  normalizeColumnVisibility,
  visibleColumnsForTab,
  visibleRegisterColumns,
  ALL_REGISTER_COLUMNS,
  DEFAULT_COLUMN_VISIBILITY,
  DEFAULT_ENTITY_TYPE_TOGGLES,
  DUE_SOON_MS,
  DUE_THIS_WEEK_MS,
  EM_RULE,
  ENTITY_TYPES,
  FOLLOWUPS_COLUMNS,
  FOLLOWUPS_DEFAULT_TOGGLES,
  KPI_CARD_LABELS,
  LEAD_STATUSES,
  OPPORTUNITY_STATUSES,
  REGISTER_COLUMNS,
  SUBMITTED_STATUSES,
  WITHDRAWN_STATUSES,
  WON_LOST_STATUSES,
  type EntityTypeToggles,
  type RegisterKpiRow
} from "../tendersRegisterPage.helpers";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date("2026-09-05T10:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(NOW.getTime() + n * DAY).toISOString();
const agoDays = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString();

function makeKpiRow(overrides: Partial<RegisterKpiRow> = {}): RegisterKpiRow {
  return {
    estimatedValue: null,
    lastInteractionAt: agoDays(4),
    nextActionAt: inDays(30),
    ...overrides
  };
}

/**
 * The worked example used throughout: six rows in scope.
 *
 *   A  overdue 2 days,  $1,500,000, logged 4 days ago
 *   B  overdue 1 day,   $2,700,000, never logged
 *   C  due in 2 days,   $  400,000, logged 9 days ago     (also "Due soon")
 *   D  due in 6 days,   $  900,000, never logged          (this week, not soon)
 *   E  due in 20 days,  $3,000,000, logged 1 day ago      (on track)
 *   F  no next action,  null,       never logged
 */
const SIX_ROWS: RegisterKpiRow[] = [
  { estimatedValue: "1500000.00", lastInteractionAt: agoDays(4), nextActionAt: agoDays(2) },
  { estimatedValue: "2700000.00", lastInteractionAt: null, nextActionAt: agoDays(1) },
  { estimatedValue: "400000.00", lastInteractionAt: agoDays(9), nextActionAt: inDays(2) },
  { estimatedValue: "900000.00", lastInteractionAt: null, nextActionAt: inDays(6) },
  { estimatedValue: "3000000.00", lastInteractionAt: agoDays(1), nextActionAt: inDays(20) },
  { estimatedValue: null, lastInteractionAt: null, nextActionAt: null }
];

// ── Item 1: the two windows, kept apart ──────────────────────────────────────

describe("DUE_SOON_MS / DUE_THIS_WEEK_MS — two windows, pinned independently", () => {
  it("DUE_SOON_MS is still three days — this slice does not touch it", () => {
    expect(DUE_SOON_MS).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it("DUE_THIS_WEEK_MS is seven days — the card's own window", () => {
    expect(DUE_THIS_WEEK_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("the card window is strictly wider than the toggle window", () => {
    expect(DUE_THIS_WEEK_MS).toBeGreaterThan(DUE_SOON_MS);
  });

  it("a row due in 5 days is 'this week' but NOT 'due soon'", () => {
    const dueAt = inDays(5);
    expect(isDueThisWeek(dueAt, NOW)).toBe(true);
    expect(classifyNextAction(dueAt, NOW)).toBe("on_track");
  });

  it("a row due in 2 days is both", () => {
    const dueAt = inDays(2);
    expect(isDueThisWeek(dueAt, NOW)).toBe(true);
    expect(classifyNextAction(dueAt, NOW)).toBe("due_soon");
  });
});

describe("isDueThisWeek — boundaries", () => {
  it("excludes a row with no next action", () => {
    expect(isDueThisWeek(null, NOW)).toBe(false);
    expect(isDueThisWeek(undefined, NOW)).toBe(false);
  });

  it("excludes an unparseable timestamp rather than counting it", () => {
    expect(isDueThisWeek("not-a-date", NOW)).toBe(false);
  });

  it("excludes an already-overdue row — the Overdue card counts that one", () => {
    expect(isDueThisWeek(agoDays(1), NOW)).toBe(false);
  });

  it("uses the same boundary as classifyNextAction: due exactly now is overdue", () => {
    const dueAt = NOW.toISOString();
    expect(classifyNextAction(dueAt, NOW)).toBe("overdue");
    expect(isDueThisWeek(dueAt, NOW)).toBe(false);
  });

  it("includes the far edge of the window and excludes just past it", () => {
    expect(isDueThisWeek(inDays(7), NOW)).toBe(true);
    expect(isDueThisWeek(new Date(NOW.getTime() + 7 * DAY + 1).toISOString(), NOW)).toBe(false);
  });

  it("Overdue and Due this week are disjoint across the whole fixture", () => {
    const both = SIX_ROWS.filter(
      (r) =>
        classifyNextAction(r.nextActionAt ?? null, NOW) === "overdue" &&
        isDueThisWeek(r.nextActionAt, NOW)
    );
    expect(both).toHaveLength(0);
  });
});

// ── Item 1: the four KPI figures ─────────────────────────────────────────────

describe("computeRegisterKpis — the four cards, against a fixed instant", () => {
  it("names the four cards in the mock-up's order", () => {
    expect([...KPI_CARD_LABELS]).toEqual([
      "Overdue",
      "Due this week",
      "Never logged",
      "Value at risk"
    ]);
  });

  it("counts the worked example exactly", () => {
    const kpis = computeRegisterKpis(SIX_ROWS, NOW);
    expect(kpis.overdue).toBe(2); // rows A, B
    expect(kpis.dueThisWeek).toBe(2); // rows C, D
    expect(kpis.neverLogged).toBe(3); // rows B, D, F
    expect(kpis.valueAtRisk).toBe(1_500_000 + 2_700_000);
  });

  it("Value at risk sums ONLY the overdue rows, formatted with the money helper", () => {
    const kpis = computeRegisterKpis(SIX_ROWS, NOW);
    expect(formatMoneyAUD(kpis.valueAtRisk)).toBe("$4,200,000");
  });

  it("Never logged is exactly the rows absent from the last-interaction map", () => {
    const rows = [
      makeKpiRow({ lastInteractionAt: null }),
      makeKpiRow({ lastInteractionAt: null }),
      makeKpiRow({ lastInteractionAt: agoDays(1) })
    ];
    expect(computeRegisterKpis(rows, NOW).neverLogged).toBe(2);
  });

  it("returns four zeroes and no value for an empty list", () => {
    const kpis = computeRegisterKpis([], NOW);
    expect(kpis).toEqual({ overdue: 0, dueThisWeek: 0, neverLogged: 0, valueAtRisk: null });
  });

  it("Value at risk is null — not $0 — when no overdue row carries an estimate", () => {
    const rows = [makeKpiRow({ nextActionAt: agoDays(1), estimatedValue: null })];
    const kpis = computeRegisterKpis(rows, NOW);
    expect(kpis.overdue).toBe(1);
    expect(kpis.valueAtRisk).toBeNull();
    expect(kpis.valueAtRisk === null ? EM_RULE : formatMoneyAUD(kpis.valueAtRisk)).toBe(EM_RULE);
  });

  it("skips an unparseable estimate instead of poisoning the sum with NaN", () => {
    const rows = [
      makeKpiRow({ nextActionAt: agoDays(1), estimatedValue: "not-money" }),
      makeKpiRow({ nextActionAt: agoDays(1), estimatedValue: "250000.00" })
    ];
    expect(computeRegisterKpis(rows, NOW).valueAtRisk).toBe(250_000);
  });

  it("ignores the estimate of a row that is not overdue", () => {
    const rows = [makeKpiRow({ nextActionAt: inDays(1), estimatedValue: "9999999.00" })];
    expect(computeRegisterKpis(rows, NOW).valueAtRisk).toBeNull();
  });

  it("is pure — the same rows and instant give the same figures twice", () => {
    expect(computeRegisterKpis(SIX_ROWS, NOW)).toEqual(computeRegisterKpis(SIX_ROWS, NOW));
  });
});

describe("computeRegisterKpis — cards and list cannot disagree", () => {
  /** The page computes the cards from the SAME array the table renders. */
  const filterRows = (rows: RegisterKpiRow[], toggles: typeof FOLLOWUPS_DEFAULT_TOGGLES) =>
    rows.filter((r) =>
      nextActionPassesFilter(classifyNextAction(r.nextActionAt ?? null, NOW), toggles)
    );

  it("default Follow-ups toggles: 4 rows in the list, cards computed from those 4", () => {
    // On track is off by default, so rows D (6 days out) and E (20 days out)
    // are not in scope — and the Due this week card counts only C.
    const inScope = filterRows(SIX_ROWS, FOLLOWUPS_DEFAULT_TOGGLES);
    expect(inScope).toHaveLength(4); // A, B, C, F
    const kpis = computeRegisterKpis(inScope, NOW);
    expect(kpis).toEqual({
      overdue: 2,
      dueThisWeek: 1,
      neverLogged: 2,
      valueAtRisk: 4_200_000
    });
  });

  it("turning On track ON widens the list AND the Due this week card together", () => {
    const inScope = filterRows(SIX_ROWS, { ...FOLLOWUPS_DEFAULT_TOGGLES, onTrack: true });
    expect(inScope).toHaveLength(6); // every row
    const kpis = computeRegisterKpis(inScope, NOW);
    expect(kpis.dueThisWeek).toBe(2); // C and D
    expect(kpis.neverLogged).toBe(3); // B, D, F
    expect(kpis.overdue).toBe(2); // unchanged — no overdue row was hidden
  });

  it("turning Overdue off moves the list AND the Overdue card together", () => {
    const inScope = filterRows(SIX_ROWS, { ...FOLLOWUPS_DEFAULT_TOGGLES, overdue: false });
    expect(inScope).toHaveLength(2); // C, F
    const kpis = computeRegisterKpis(inScope, NOW);
    expect(kpis.overdue).toBe(0);
    expect(kpis.valueAtRisk).toBeNull();
    expect(kpis.dueThisWeek).toBe(1); // C
    expect(kpis.neverLogged).toBe(1); // F
  });
});

// ── Item 2: the entity-type toggle group ─────────────────────────────────────

describe("status groups — the vocabulary that was dead in the page", () => {
  it("keeps the membership the page declared, byte for byte", () => {
    expect([...WON_LOST_STATUSES].sort()).toEqual(["AWARDED", "CONTRACT_ISSUED", "LOST"]);
    expect([...SUBMITTED_STATUSES]).toEqual(["SUBMITTED"]);
    expect([...OPPORTUNITY_STATUSES]).toEqual(["IN_PROGRESS"]);
    expect([...LEAD_STATUSES]).toEqual(["DRAFT"]);
    expect([...WITHDRAWN_STATUSES]).toEqual(["WITHDRAWN"]);
  });

  it("WITHDRAWN_STATUSES belongs to NO toggle group — the mock-up has no control for it", () => {
    for (const status of WITHDRAWN_STATUSES) {
      expect(classifyEntityType(status)).toBeNull();
      expect(entityTypeChipLabel(status)).toBeNull();
    }
    expect(ENTITY_TYPES.some((def) => def.statuses === WITHDRAWN_STATUSES)).toBe(false);
  });
});

describe("ENTITY_TYPES — the four toggles in the mock-up's order", () => {
  it("renders the mock-up's labels, in order", () => {
    expect(ENTITY_TYPES.map((def) => def.label)).toEqual([
      "Submitted tenders",
      "Opportunities",
      "Leads",
      "Won & lost"
    ]);
  });

  it("each toggle is backed by the Set the page's comment named", () => {
    expect(ENTITY_TYPES.find((d) => d.id === "submitted")?.statuses).toBe(SUBMITTED_STATUSES);
    expect(ENTITY_TYPES.find((d) => d.id === "opportunity")?.statuses).toBe(OPPORTUNITY_STATUSES);
    expect(ENTITY_TYPES.find((d) => d.id === "lead")?.statuses).toBe(LEAD_STATUSES);
    expect(ENTITY_TYPES.find((d) => d.id === "wonLost")?.statuses).toBe(WON_LOST_STATUSES);
  });

  it("defaults to all four OFF, i.e. no entity-type narrowing on arrival", () => {
    expect(DEFAULT_ENTITY_TYPE_TOGGLES).toEqual({
      submitted: false,
      opportunity: false,
      lead: false,
      wonLost: false
    });
  });

  it("no status is claimed by two groups", () => {
    const seen = new Set<string>();
    for (const def of ENTITY_TYPES) {
      for (const status of def.statuses) {
        expect(seen.has(status)).toBe(false);
        seen.add(status);
      }
    }
  });
});

describe("entityTypePassesFilter — a status filter", () => {
  const allOff = DEFAULT_ENTITY_TYPE_TOGGLES;
  const only = (id: keyof EntityTypeToggles): EntityTypeToggles => ({ ...allOff, [id]: true });

  it("all four off → every row passes, withdrawn included", () => {
    for (const status of ["SUBMITTED", "IN_PROGRESS", "DRAFT", "AWARDED", "WITHDRAWN"]) {
      expect(entityTypePassesFilter(status, allOff)).toBe(true);
    }
  });

  it("'Submitted tenders' alone passes only SUBMITTED", () => {
    expect(entityTypePassesFilter("SUBMITTED", only("submitted"))).toBe(true);
    expect(entityTypePassesFilter("DRAFT", only("submitted"))).toBe(false);
    expect(entityTypePassesFilter("AWARDED", only("submitted"))).toBe(false);
  });

  it("'Won & lost' alone passes all three of its statuses", () => {
    for (const status of ["AWARDED", "CONTRACT_ISSUED", "LOST"]) {
      expect(entityTypePassesFilter(status, only("wonLost"))).toBe(true);
    }
    expect(entityTypePassesFilter("SUBMITTED", only("wonLost"))).toBe(false);
  });

  it("two toggles on is a union, not an intersection", () => {
    const toggles: EntityTypeToggles = { ...allOff, lead: true, submitted: true };
    expect(entityTypePassesFilter("DRAFT", toggles)).toBe(true);
    expect(entityTypePassesFilter("SUBMITTED", toggles)).toBe(true);
    expect(entityTypePassesFilter("IN_PROGRESS", toggles)).toBe(false);
  });

  it("a withdrawn row drops out as soon as any toggle is on — no group claims it", () => {
    expect(entityTypePassesFilter("WITHDRAWN", only("submitted"))).toBe(false);
    expect(entityTypePassesFilter("WITHDRAWN", only("wonLost"))).toBe(false);
  });

  it("an unknown status is treated as ungrouped rather than silently passing", () => {
    expect(entityTypePassesFilter("NOT_A_STATUS", allOff)).toBe(true);
    expect(entityTypePassesFilter("NOT_A_STATUS", only("lead"))).toBe(false);
  });
});

describe("the two toggle groups compose rather than override", () => {
  type Row = RegisterKpiRow & { status: string };
  const ROWS: Row[] = [
    { status: "SUBMITTED", nextActionAt: agoDays(2), lastInteractionAt: null },
    { status: "SUBMITTED", nextActionAt: inDays(20), lastInteractionAt: null },
    { status: "DRAFT", nextActionAt: agoDays(1), lastInteractionAt: null },
    { status: "IN_PROGRESS", nextActionAt: agoDays(3), lastInteractionAt: null },
    { status: "WITHDRAWN", nextActionAt: agoDays(5), lastInteractionAt: null }
  ];

  const apply = (entity: EntityTypeToggles, next: typeof FOLLOWUPS_DEFAULT_TOGGLES) =>
    ROWS.filter(
      (r) =>
        entityTypePassesFilter(r.status, entity) &&
        nextActionPassesFilter(classifyNextAction(r.nextActionAt ?? null, NOW), next)
    );

  it("no entity toggle + default next-action toggles → 4 of 5 rows", () => {
    expect(apply(DEFAULT_ENTITY_TYPE_TOGGLES, FOLLOWUPS_DEFAULT_TOGGLES)).toHaveLength(4);
  });

  it("'Submitted tenders' alone (all next-action toggles off) → 2 rows", () => {
    const entity: EntityTypeToggles = { ...DEFAULT_ENTITY_TYPE_TOGGLES, submitted: true };
    const noNext = { overdue: false, dueSoon: false, noNextAction: false, onTrack: false };
    expect(apply(entity, noNext)).toHaveLength(2);
  });

  it("'Submitted tenders' AND 'Overdue' together → 1 row, the intersection", () => {
    const entity: EntityTypeToggles = { ...DEFAULT_ENTITY_TYPE_TOGGLES, submitted: true };
    const onlyOverdue = { overdue: true, dueSoon: false, noNextAction: false, onTrack: false };
    const rows = apply(entity, onlyOverdue);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("SUBMITTED");
    expect(classifyNextAction(rows[0].nextActionAt ?? null, NOW)).toBe("overdue");
  });

  it("neither group can resurrect a row the other excluded", () => {
    const entity: EntityTypeToggles = { ...DEFAULT_ENTITY_TYPE_TOGGLES, lead: true };
    const onlyOnTrack = { overdue: false, dueSoon: false, noNextAction: false, onTrack: true };
    expect(apply(entity, onlyOnTrack)).toHaveLength(0);
  });
});

// ── Item 3: the Type chip column ─────────────────────────────────────────────

describe("entityTypeChipLabel — one source of truth with the toggles", () => {
  it("labels each kind of row", () => {
    expect(entityTypeChipLabel("SUBMITTED")).toBe("Tender");
    expect(entityTypeChipLabel("IN_PROGRESS")).toBe("Opportunity");
    expect(entityTypeChipLabel("DRAFT")).toBe("Lead");
    expect(entityTypeChipLabel("AWARDED")).toBe("Won / lost");
    expect(entityTypeChipLabel("LOST")).toBe("Won / lost");
  });

  it("returns null for a status no toggle claims, so the cell shows the em-rule", () => {
    expect(entityTypeChipLabel("WITHDRAWN")).toBeNull();
    expect(entityTypeChipLabel("NOT_A_STATUS")).toBeNull();
  });

  it("agrees with the filter: a chip renders iff its own toggle would keep the row", () => {
    for (const def of ENTITY_TYPES) {
      for (const status of def.statuses) {
        const only: EntityTypeToggles = { ...DEFAULT_ENTITY_TYPE_TOGGLES, [def.id]: true };
        expect(entityTypePassesFilter(status, only)).toBe(true);
        expect(entityTypeChipLabel(status)).toBe(def.chipLabel);
      }
    }
  });
});

describe("column sets — Type is a Follow-ups column only", () => {
  it("the Register header row is unchanged by this slice", () => {
    expect(columnsForTab("register").map((c) => c.label)).toEqual([
      "Tender",
      "Client",
      "Status",
      "Value",
      "Last interaction",
      "Logged by",
      "Next action",
      "Actions"
    ]);
    expect(columnsForTab("register")).toBe(REGISTER_COLUMNS);
  });

  it("the Follow-ups header row inserts Type directly after Tender", () => {
    expect(columnsForTab("followups").map((c) => c.label)).toEqual([
      "Tender",
      "Type",
      "Client",
      "Status",
      "Value",
      "Last interaction",
      "Logged by",
      "Next action",
      "Actions"
    ]);
  });

  it("Register has no Type column and Follow-ups has exactly one", () => {
    expect(REGISTER_COLUMNS.map((c) => c.id)).not.toContain("type");
    expect(FOLLOWUPS_COLUMNS.filter((c) => c.id === "type")).toHaveLength(1);
  });

  it("adds exactly one column and reorders nothing else", () => {
    expect(FOLLOWUPS_COLUMNS).toHaveLength(REGISTER_COLUMNS.length + 1);
    expect(FOLLOWUPS_COLUMNS.filter((c) => c.id !== "type")).toEqual([...REGISTER_COLUMNS]);
  });

  it("Type is hideable and unsortable — the chip is a label, not a key", () => {
    const type = FOLLOWUPS_COLUMNS.find((c) => c.id === "type");
    expect(type?.hideable).toBe(true);
    expect(type?.sortKey).toBeNull();
  });
});

describe("column visibility still round-trips with the Type column in the union", () => {
  it("defaults every column on, Type included", () => {
    expect(DEFAULT_COLUMN_VISIBILITY.type).toBe(true);
    expect(Object.values(DEFAULT_COLUMN_VISIBILITY).every(Boolean)).toBe(true);
    expect(Object.keys(DEFAULT_COLUMN_VISIBILITY)).toHaveLength(ALL_REGISTER_COLUMNS.length);
  });

  it("a stored blob that hides Type survives normalisation as a known id", () => {
    const restored = normalizeColumnVisibility({ type: false });
    expect(restored.type).toBe(false);
    expect(visibleColumnsForTab("followups", restored).map((c) => c.id)).not.toContain("type");
  });

  it("hiding Type does not disturb the Register column set", () => {
    const restored = normalizeColumnVisibility({ type: false });
    expect(visibleColumnsForTab("register", restored)).toEqual(visibleRegisterColumns(restored));
    expect(visibleColumnsForTab("register", restored)).toHaveLength(REGISTER_COLUMNS.length);
  });

  it("the two anchor columns stay unhideable on Follow-ups too", () => {
    const restored = normalizeColumnVisibility({ tender: false, actions: false, type: false });
    const ids = visibleColumnsForTab("followups", restored).map((c) => c.id);
    expect(ids[0]).toBe("tender");
    expect(ids).toContain("actions");
  });

  it("the four next-action toggle defaults are untouched by this slice", () => {
    expect(FOLLOWUPS_DEFAULT_TOGGLES).toEqual({
      overdue: true,
      dueSoon: true,
      noNextAction: true,
      onTrack: false
    });
  });
});

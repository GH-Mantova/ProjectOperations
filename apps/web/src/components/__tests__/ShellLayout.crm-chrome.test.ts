// crmui-chrome-s1 — CRM_CHROME_V1 pure logic assertions.
//
// The chrome around the three CRM screens: nav count badges, in-sidebar tab
// rows, tab counts, and the two Inbox row actions that already shipped on
// /tenders/leads. The web workspace has no @testing-library and no jsdom, so
// nothing here renders — every assertion is against an exported pure function
// or against the NAV_GROUPS data itself.

import { describe, expect, it } from "vitest";
import {
  countDistinctOverdueTenders,
  isNavTabActive,
  navTabId,
  sumCommsBadgeCount,
  NAV_GROUPS,
  type CrmOverdueTaskRow,
  type NavTab
} from "../ShellLayout";
import {
  isIntakeLeadEmpty,
  leadRowActionSet,
  sortLeadsOldestFirst,
  type EmptyLeadFields
} from "../../pages/crm/CommsInboxTriage";

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOW = new Date("2026-09-04T12:00:00Z").getTime();
const hoursFromNow = (n: number) => new Date(NOW + n * 60 * 60 * 1000).toISOString();

function task(entityId: string, dueAt: string | null): CrmOverdueTaskRow {
  return { entityId, dueAt };
}

function lead(overrides: Partial<EmptyLeadFields> = {}): EmptyLeadFields {
  return {
    notes: null,
    contact: null,
    account: null,
    dropReason: null,
    ...overrides
  };
}

const crmGroup = NAV_GROUPS.find((g) => g.id === "crm");
const crmItems = crmGroup?.items ?? [];
const findItem = (to: string) => crmItems.find((item) => item.to === to);

// ── NavItem.badge — the type widened, the old badges did not change ───────────

describe("NavItem.badge — CRM_CHROME_V1 widened the union", () => {
  it("Safety still carries badge 'safety'", () => {
    const safety = NAV_GROUPS.find((g) => g.id === "safety")?.items.find((i) => i.to === "/safety");
    expect(safety?.badge).toBe("safety");
  });

  it("Compliance still carries badge 'compliance'", () => {
    const compliance = NAV_GROUPS.find((g) => g.id === "safety")?.items.find(
      (i) => i.to === "/compliance"
    );
    expect(compliance?.badge).toBe("compliance");
  });

  it("no nav item outside Safety & Compliance carries a safety/compliance badge", () => {
    const strays = NAV_GROUPS.filter((g) => g.id !== "safety").flatMap((g) =>
      g.items.filter((i) => i.badge === "safety" || i.badge === "compliance")
    );
    expect(strays).toHaveLength(0);
  });

  it("Tenders carries the amber CRM badge and Comms hub the red one", () => {
    expect(findItem("/crm/register")?.badge).toBe("crm-tenders");
    expect(findItem("/crm/comms")?.badge).toBe("crm-comms");
  });

  it("Accounts carries no badge — the mock-up draws none", () => {
    expect(findItem("/crm/accounts")?.badge).toBeUndefined();
  });
});

// ── The CRM group is untouched architecture (Marco's decisions 1-8) ───────────

describe("CRM nav group — three flat items, order unchanged", () => {
  it("has exactly three items in the shipped order", () => {
    expect(crmItems.map((i) => i.label)).toEqual(["Accounts", "Tenders", "Comms hub"]);
  });

  it("no CRM item is a collapsible parent", () => {
    expect(crmItems.every((i) => i.children === undefined)).toBe(true);
  });

  it("every CRM item still gates on crm.view", () => {
    expect(crmItems.every((i) => i.requiresPermission === "crm.view")).toBe(true);
  });
});

// ── Tab rows beneath the flat items ──────────────────────────────────────────

describe("CRM nav tab rows — CRM_CHROME_V1", () => {
  it("Accounts draws List and Relationships at the shipped ?tab= URLs", () => {
    expect(findItem("/crm/accounts")?.tabs).toEqual([
      { label: "List", to: "/crm/accounts" },
      { label: "Relationships", to: "/crm/accounts?tab=relationships" }
    ]);
  });

  it("Tenders draws Register and Follow-ups", () => {
    expect(findItem("/crm/register")?.tabs).toEqual([
      { label: "Register", to: "/crm/register" },
      { label: "Follow-ups", to: "/crm/register?tab=follow-ups" }
    ]);
  });

  it("Comms hub draws Inbox, Threads and To-dos", () => {
    expect(findItem("/crm/comms")?.tabs).toEqual([
      { label: "Inbox", to: "/crm/comms" },
      { label: "Threads", to: "/crm/comms?tab=threads" },
      { label: "To-dos", to: "/crm/comms?tab=todos" }
    ]);
  });

  it("no nav item outside CRM grew tab rows", () => {
    const strays = NAV_GROUPS.filter((g) => g.id !== "crm").flatMap((g) =>
      g.items.filter((i) => i.tabs !== undefined)
    );
    expect(strays).toHaveLength(0);
  });
});

describe("navTabId", () => {
  it("returns '' for a default tab URL with no query", () => {
    expect(navTabId("/crm/comms")).toBe("");
  });

  it("returns the ?tab= value", () => {
    expect(navTabId("/crm/comms?tab=todos")).toBe("todos");
  });

  it("returns '' when the query carries no tab key", () => {
    expect(navTabId("/crm/comms?entityType=TENDER")).toBe("");
  });
});

describe("isNavTabActive", () => {
  const commsTabs: NavTab[] = [
    { label: "Inbox", to: "/crm/comms" },
    { label: "Threads", to: "/crm/comms?tab=threads" },
    { label: "To-dos", to: "/crm/comms?tab=todos" }
  ];

  it("the first tab is active with no ?tab= at all", () => {
    expect(isNavTabActive("/crm/comms", commsTabs, "/crm/comms", "")).toBe(true);
    expect(isNavTabActive("/crm/comms?tab=threads", commsTabs, "/crm/comms", "")).toBe(false);
  });

  it("the named tab is active when ?tab= matches", () => {
    expect(isNavTabActive("/crm/comms?tab=todos", commsTabs, "/crm/comms", "?tab=todos")).toBe(true);
    expect(isNavTabActive("/crm/comms", commsTabs, "/crm/comms", "?tab=todos")).toBe(false);
  });

  it("an unrecognised ?tab= falls back to the first tab, exactly like the shell", () => {
    expect(isNavTabActive("/crm/comms", commsTabs, "/crm/comms", "?tab=nope")).toBe(true);
  });

  it("a different pathname is never active", () => {
    expect(isNavTabActive("/crm/comms?tab=threads", commsTabs, "/crm/register", "?tab=threads")).toBe(
      false
    );
  });

  it("unrelated query parameters do not disturb the default tab", () => {
    expect(
      isNavTabActive("/crm/comms", commsTabs, "/crm/comms", "?entityType=TENDER&entityId=t-1")
    ).toBe(true);
  });
});

// ── Tenders badge / Follow-ups count: distinct overdue tenders ────────────────

describe("countDistinctOverdueTenders — CRM_CHROME_V1", () => {
  it("counts a single overdue task once", () => {
    expect(countDistinctOverdueTenders([task("t-1", hoursFromNow(-1))], NOW)).toBe(1);
  });

  it("two overdue tasks on ONE tender count once", () => {
    const rows = [task("t-1", hoursFromNow(-48)), task("t-1", hoursFromNow(-2))];
    expect(countDistinctOverdueTenders(rows, NOW)).toBe(1);
  });

  it("overdue tasks on two tenders count twice", () => {
    const rows = [task("t-1", hoursFromNow(-48)), task("t-2", hoursFromNow(-2))];
    expect(countDistinctOverdueTenders(rows, NOW)).toBe(2);
  });

  it("a task with a null dueAt counts zero", () => {
    expect(countDistinctOverdueTenders([task("t-1", null)], NOW)).toBe(0);
  });

  it("a task due in the future counts zero", () => {
    expect(countDistinctOverdueTenders([task("t-1", hoursFromNow(24))], NOW)).toBe(0);
  });

  it("a tender whose only other task is future-dated still counts once", () => {
    const rows = [task("t-1", hoursFromNow(-1)), task("t-1", hoursFromNow(24))];
    expect(countDistinctOverdueTenders(rows, NOW)).toBe(1);
  });

  it("an empty task list counts zero", () => {
    expect(countDistinctOverdueTenders([], NOW)).toBe(0);
  });

  it("an unparseable dueAt counts zero rather than throwing", () => {
    expect(countDistinctOverdueTenders([task("t-1", "not-a-date")], NOW)).toBe(0);
  });

  it("due exactly now is overdue — same boundary as classifyNextAction", () => {
    expect(countDistinctOverdueTenders([task("t-1", new Date(NOW).toISOString())], NOW)).toBe(1);
  });
});

// ── Comms hub badge: untriaged + overdue to-dos ───────────────────────────────

describe("sumCommsBadgeCount — CRM_CHROME_V1", () => {
  it("adds the two totals", () => {
    expect(sumCommsBadgeCount(11, 4)).toBe(15);
  });

  it("is zero when both sources are zero — the pill then renders nothing", () => {
    expect(sumCommsBadgeCount(0, 0)).toBe(0);
  });

  it("is the untriaged total when there are no overdue to-dos", () => {
    expect(sumCommsBadgeCount(7, 0)).toBe(7);
  });

  it("is the overdue-to-do total when the Inbox is empty", () => {
    expect(sumCommsBadgeCount(0, 3)).toBe(3);
  });

  it("treats a malformed (negative or non-finite) total as zero", () => {
    expect(sumCommsBadgeCount(-5, 3)).toBe(3);
    expect(sumCommsBadgeCount(Number.NaN, 3)).toBe(3);
  });
});

// ── Inbox row actions: Archive / Don't pursue / Price it, or Delete ───────────

describe("isIntakeLeadEmpty / leadRowActionSet — CRM_CHROME_V1", () => {
  it("a lead with nothing at all is empty and offers Delete", () => {
    expect(isIntakeLeadEmpty(lead())).toBe(true);
    expect(leadRowActionSet(lead())).toBe("delete");
  });

  it("a lead with notes only is NOT empty and offers the triage actions", () => {
    const row = lead({ notes: "Called back, wants a price on the slab." });
    expect(isIntakeLeadEmpty(row)).toBe(false);
    expect(leadRowActionSet(row)).toBe("triage");
  });

  it("a lead with a contact only is NOT empty", () => {
    const row = lead({
      contact: { id: "c-1", firstName: "Dana", lastName: "Reed", email: null }
    });
    expect(isIntakeLeadEmpty(row)).toBe(false);
    expect(leadRowActionSet(row)).toBe("triage");
  });

  it("a lead with an account only is NOT empty — the server blocks on account too", () => {
    const row = lead({ account: { id: "a-1", lifecycleStatus: "PROSPECT" } });
    expect(isIntakeLeadEmpty(row)).toBe(false);
  });

  it("a lead with a drop reason only is NOT empty", () => {
    const row = lead({ dropReason: { id: "d-1", label: "No capacity" } });
    expect(isIntakeLeadEmpty(row)).toBe(false);
  });

  it("an empty-string note does not block Delete", () => {
    expect(isIntakeLeadEmpty(lead({ notes: "" }))).toBe(true);
  });
});

// ── Inbox oldest-first sort (within the page only) ────────────────────────────

describe("sortLeadsOldestFirst — CRM_CHROME_V1", () => {
  const at = (iso: string | null, id: string) => ({ id, createdAt: iso });

  it("puts the oldest createdAt first", () => {
    const rows = [
      at("2026-09-03T09:00:00Z", "new"),
      at("2026-08-01T09:00:00Z", "old"),
      at("2026-09-01T09:00:00Z", "mid")
    ];
    expect(sortLeadsOldestFirst(rows).map((r) => r.id)).toEqual(["old", "mid", "new"]);
  });

  it("keeps the incoming order for equal timestamps (stable)", () => {
    const rows = [
      at("2026-09-01T09:00:00Z", "a"),
      at("2026-09-01T09:00:00Z", "b"),
      at("2026-09-01T09:00:00Z", "c")
    ];
    expect(sortLeadsOldestFirst(rows).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts rows with a null createdAt last, in their incoming order", () => {
    const rows = [
      at(null, "n1"),
      at("2026-09-01T09:00:00Z", "dated"),
      at(null, "n2"),
      at("2026-08-01T09:00:00Z", "older")
    ];
    expect(sortLeadsOldestFirst(rows).map((r) => r.id)).toEqual(["older", "dated", "n1", "n2"]);
  });

  it("treats an unparseable createdAt like a null one", () => {
    const rows = [at("not-a-date", "bad"), at("2026-09-01T09:00:00Z", "good")];
    expect(sortLeadsOldestFirst(rows).map((r) => r.id)).toEqual(["good", "bad"]);
  });

  it("does not mutate the input array", () => {
    const rows = [at("2026-09-03T09:00:00Z", "new"), at("2026-08-01T09:00:00Z", "old")];
    sortLeadsOldestFirst(rows);
    expect(rows.map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("returns an empty array unchanged", () => {
    expect(sortLeadsOldestFirst([])).toEqual([]);
  });
});

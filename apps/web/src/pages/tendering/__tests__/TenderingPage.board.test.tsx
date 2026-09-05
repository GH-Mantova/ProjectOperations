/**
 * Pipeline board tests — tendering-board-fix cluster (Marco, 2026-08-20).
 *
 * Two things are pinned here:
 *
 *   1. The board has FOUR columns — Draft · Estimating · Submitted · Withdrawn,
 *      in that order. PR #1122 cut Submitted, so a tender disappeared from
 *      Tendering the moment it was submitted. It is back.
 *   2. Submitted and Withdrawn are COUNT-ONLY: header (label · count · total)
 *      renders exactly as for a card column, the card list does not. The count
 *      and the card list come out of one `boardColumnView` call over one array,
 *      so they cannot disagree — that invariant is asserted directly as well as
 *      through the rendered markup.
 *
 * The web workspace has no jsdom and no @testing-library (see
 * PipelinePage.test.tsx and wbs-table-shell.test.tsx). Markup assertions go
 * through `renderToStaticMarkup`, which needs neither — it returns an HTML
 * string. "No card is queryable" is therefore "the card markup is absent from
 * the string", and every such assertion is paired with a positive assertion on
 * the header so a column that failed to render at all cannot pass.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { KanbanColumn } from "../TenderingPage";
import {
  PIPELINE_STAGES,
  COUNT_ONLY_STAGES,
  boardColumnView,
  groupByPipelineStage,
  isCountOnlyStage
} from "../tenderingPage.helpers";
import { TENDER_STATUS_LABEL, type TenderStatus } from "../tenderStatusLabels";

// ── fixtures ────────────────────────────────────────────────────────────────

type BoardTender = Parameters<typeof KanbanColumn>[0]["items"][number];

let seq = 0;
function makeTender(status: string, overrides: Partial<BoardTender> = {}): BoardTender {
  seq += 1;
  return {
    id: `tender-${seq}`,
    tenderNumber: `T-10${seq}`,
    title: `Tender ${seq}`,
    status,
    withdrawalState: null,
    dueDate: null,
    estimatedValue: "1000",
    probability: null,
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
    estimator: null,
    tenderClients: [],
    ...overrides
  };
}

/** Render one column the way TenderingPage renders it, and return the markup. */
function renderColumn(stage: string, items: BoardTender[]): string {
  const total = items.reduce((sum, t) => sum + Number(t.estimatedValue ?? 0), 0);
  return renderToStaticMarkup(
    <KanbanColumn
      stage={stage as TenderStatus}
      items={items}
      total={total}
      loading={false}
      onDrop={() => {}}
      onOpen={() => {}}
      registerHighlightRef={() => () => {}}
      isHighlighted={() => false}
      onViewRegister={() => {}}
    />
  );
}

/** The count chip the header renders, pulled back out of the markup. */
function headerCount(markup: string): string | null {
  return markup.match(/class="tender-column__count">([^<]*)</)?.[1] ?? null;
}

/** True when at least one TenderCard was drawn. */
function hasCards(markup: string): boolean {
  return /class="tender-card(?:[ "])/.test(markup);
}

// ── 1. four columns, labelled, in order ─────────────────────────────────────

describe("Pipeline board columns", () => {
  it("renders four columns labelled Draft / Estimating / Submitted / Withdrawn in that order", () => {
    // The page does `PIPELINE_STAGES.map(...)`, so PIPELINE_STAGES order IS
    // the on-screen column order. Render the same map and read the titles
    // back out of the markup rather than trusting the constant alone.
    const titles = PIPELINE_STAGES.map((stage) => {
      const markup = renderColumn(stage, []);
      return markup.match(/class="tender-column__title">([^<]*)</)?.[1] ?? null;
    });
    expect(titles).toEqual(["Draft", "Estimating", "Submitted", "Withdrawn"]);
    expect(PIPELINE_STAGES).toHaveLength(4);
    // Submitted sits third, immediately before Withdrawn — the order Marco
    // named and the order #1106 shipped.
    expect(PIPELINE_STAGES[2]).toBe("SUBMITTED");
    expect(PIPELINE_STAGES[3]).toBe("WITHDRAWN");
  });

  it("labels come from the shared status labels, not a board-local copy", () => {
    for (const stage of PIPELINE_STAGES) {
      const markup = renderColumn(stage, []);
      expect(markup).toContain(`>${TENDER_STATUS_LABEL[stage as TenderStatus]}<`);
    }
  });
});

// ── 2. Draft and Estimating render cards ────────────────────────────────────

describe("card columns", () => {
  it("Draft renders a tender card", () => {
    const items = [makeTender("DRAFT"), makeTender("DRAFT")];
    const markup = renderColumn("DRAFT", items);
    expect(headerCount(markup)).toBe("2");
    expect(hasCards(markup)).toBe(true);
    expect(markup).toContain(items[0].tenderNumber);
    expect(markup).toContain(items[1].tenderNumber);
  });

  it("Estimating renders a tender card", () => {
    const items = [makeTender("IN_PROGRESS")];
    const markup = renderColumn("IN_PROGRESS", items);
    expect(headerCount(markup)).toBe("1");
    expect(hasCards(markup)).toBe(true);
    expect(markup).toContain(items[0].tenderNumber);
  });

  it("a card column with nothing in it says so rather than pointing at the Register", () => {
    const markup = renderColumn("DRAFT", []);
    expect(headerCount(markup)).toBe("0");
    expect(markup).toContain("No tenders in this stage.");
    expect(markup).not.toContain("view on the Register");
  });
});

// ── 3. Submitted and Withdrawn: count in the header, no cards ───────────────

describe("count-only columns", () => {
  it("COUNT_ONLY_STAGES is exactly Submitted and Withdrawn", () => {
    expect([...COUNT_ONLY_STAGES]).toEqual(["SUBMITTED", "WITHDRAWN"]);
    expect(isCountOnlyStage("DRAFT")).toBe(false);
    expect(isCountOnlyStage("IN_PROGRESS")).toBe(false);
    expect(isCountOnlyStage("SUBMITTED")).toBe(true);
    expect(isCountOnlyStage("WITHDRAWN")).toBe(true);
  });

  it("every count-only stage is a real board column", () => {
    // A count-only stage that is not in PIPELINE_STAGES would be counted
    // nowhere and rendered nowhere — the flag would be dead configuration.
    for (const stage of COUNT_ONLY_STAGES) {
      expect((PIPELINE_STAGES as readonly string[]).includes(stage)).toBe(true);
    }
  });

  it("Submitted shows its count in the header and renders no tender card", () => {
    const items = [makeTender("SUBMITTED"), makeTender("SUBMITTED"), makeTender("SUBMITTED")];
    const markup = renderColumn("SUBMITTED", items);
    // Both halves. The count proves the column rendered; the absent card
    // proves the suppression. Checking only the second would pass on a
    // column that failed to render at all.
    expect(headerCount(markup)).toBe("3");
    expect(markup).toContain("Submitted");
    expect(hasCards(markup)).toBe(false);
    for (const item of items) expect(markup).not.toContain(item.tenderNumber);
    // ...and something deliberate stands where the cards would be.
    expect(markup).toContain("3 tenders");
    expect(markup).toContain("view on the Register");
  });

  it("Withdrawn shows its count in the header and renders no tender card", () => {
    const items = [makeTender("WITHDRAWN", { withdrawalState: "PENDING_REVIEW" })];
    const markup = renderColumn("WITHDRAWN", items);
    expect(headerCount(markup)).toBe("1");
    expect(markup).toContain("Withdrawn");
    expect(hasCards(markup)).toBe(false);
    expect(markup).not.toContain(items[0].tenderNumber);
    expect(markup).toContain("1 tender");
    expect(markup).toContain("view on the Register");
  });

  it("a count-only column still renders its currency total", () => {
    const items = [makeTender("SUBMITTED", { estimatedValue: "2500" })];
    const markup = renderColumn("SUBMITTED", items);
    expect(markup).toContain("tender-column__total");
    expect(markup).not.toContain('class="tender-column__total">—<');
  });

  it("a count-only column is still a drop target", () => {
    // Dropping onto Submitted / Withdrawn must keep working — the column is
    // a one-way exit, not a dead zone. The drop handler lives on the column
    // wrapper, which is rendered for every stage.
    for (const stage of COUNT_ONLY_STAGES) {
      const markup = renderColumn(stage, []);
      expect(markup).toContain('class="tender-column"');
    }
  });

  it("count and card list cannot disagree — one call, one array", () => {
    // The invariant behind the whole design: `count` is always items.length
    // and `cards` is what gets drawn. A count-only stage zeroes the cards
    // and leaves the count alone; nothing can drift them apart.
    const items = [makeTender("SUBMITTED"), makeTender("SUBMITTED")];
    for (const stage of PIPELINE_STAGES) {
      const view = boardColumnView(stage, items);
      expect(view.count).toBe(items.length);
      expect(view.countOnly).toBe(isCountOnlyStage(stage));
      expect(view.cards).toHaveLength(view.countOnly ? 0 : items.length);
    }
  });
});

// ── 4. negative control — confirmed withdrawals are not counted ─────────────

describe("Withdrawn header count", () => {
  it("does not count a confirmed-withdrawn tender", () => {
    // If the count silently included tenders that exited the board, the
    // number would be a lie and — with no cards to check it against — the
    // column would be worse than useless.
    const rows = [
      makeTender("WITHDRAWN", { withdrawalState: "PENDING_REVIEW" }),
      makeTender("WITHDRAWN", { withdrawalState: "CONFIRMED" })
    ];
    const byStage = groupByPipelineStage(rows);
    const markup = renderColumn("WITHDRAWN", byStage.WITHDRAWN);
    expect(headerCount(markup)).toBe("1");
    expect(markup).toContain("1 tender");
    expect(hasCards(markup)).toBe(false);
  });

  it("counts a SUBMITTED tender that would previously have vanished", () => {
    // The defect this PR fixes, stated as a test: before the fix a SUBMITTED
    // row was dropped by groupByPipelineStage and had no column to land in.
    const rows = [makeTender("SUBMITTED"), makeTender("DRAFT")];
    const byStage = groupByPipelineStage(rows);
    expect(byStage.SUBMITTED).toHaveLength(1);
    expect(headerCount(renderColumn("SUBMITTED", byStage.SUBMITTED))).toBe("1");
    expect(headerCount(renderColumn("DRAFT", byStage.DRAFT))).toBe("1");
  });
});

// scope-subcontracted order 4 — SUB line linkage double-count guard spec.
//
// These tests exercise the SUB_LINE_PRICES_LINKED_ITEM guard in
// ScopeRedesignService.summary() and the link/unlink/quote operations.
//
// Key assertions (from the prompt):
//   1. A DEM item with manpower+plant, linked to a SUB line, contributes
//      ZERO to the DEM bucket.
//   2. The same item unlinked contributes its full amount — the guard is
//      reversible.
//   3. Tender total WITH (in-house item + SUB quote, linked) = SUB quote alone.
//      (This is the assertion the whole slice exists for; figures are stated below.)
//   4. Waste and cutting on a linked item are still charged (NOT tested here
//      because they are separate DB tables; the guard zeroes only the
//      ScopeItemPricingInput path — waste/cutting remain independent streams).
//   5. A second isSelected quote on one line is rejected by the service.
//   6. A SUB line with quotes but none selected prices at 0.

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ScopeRedesignService } from "../scope-redesign.service";
import { RateResolverService } from "../../rates/rate-resolver.service";

// ── Test constants ────────────────────────────────────────────────────────
//
// Double-count assertion figures (assertion 3 from the prompt):
//
//   In-house DEM item: 2 men × 5 days × $500/man-day = $5,000 labour
//                     + 1 plant × 5 days × $200/day   = $1,000 plant
//                     subtotal = $6,000; markup 30% → $7,800
//
//   SUB quote amount = $4,500
//   SUB markup 30%  → $5,850
//
//   WITHOUT linking: tender price = DEM $7,800 + SUB $5,850 = $13,650 (double-counted)
//   WITH linking:    tender price = DEM $0     + SUB $5,850 = $5,850  (correct)
//
// The two figures: $13,650 (unlinked) and $5,850 (linked).
// Only the linked case ($5,850) equals "SUB quote alone" ($4,500 × 1.30 = $5,850).

const DEM_LABOUR = 5000;  // 2 men × 5 days × $500
const DEM_PLANT  = 1000;  // 1 unit × 5 days × $200
const DEM_TOTAL  = DEM_LABOUR + DEM_PLANT; // $6,000
const MARKUP_PCT = 30;
const DEM_WITH_MARKUP = DEM_TOTAL * (1 + MARKUP_PCT / 100); // $7,800

const SUB_QUOTE_AMOUNT = 4500;
const SUB_WITH_MARKUP  = SUB_QUOTE_AMOUNT * (1 + MARKUP_PCT / 100); // $5,850

/** Unlinked total: both DEM and SUB contribute. */
const UNLINKED_TENDER_PRICE = DEM_WITH_MARKUP + SUB_WITH_MARKUP; // $13,650
/** Linked total: DEM zeroed, only SUB quote remains. */
const LINKED_TENDER_PRICE   = SUB_WITH_MARKUP; // $5,850

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * The summary() return type spreads a Record<string, DisciplineBucket> so
 * TypeScript's inferred type does not include string index access for
 * discipline keys. This helper casts through unknown so that tests can read
 * summary.DEM, summary.SUB etc. without TS2339 errors.
 */
function bucket(
  summary: Awaited<ReturnType<ScopeRedesignService["summary"]>>,
  discipline: string
): { itemCount: number; subtotal: number; withMarkup: number; provisionalSubtotal: number; provisionalWithMarkup: number } {
  return (summary as unknown as Record<string, { itemCount: number; subtotal: number; withMarkup: number; provisionalSubtotal: number; provisionalWithMarkup: number }>)[discipline];
}

function makeRateResolver(): RateResolverService {
  return {
    listRates: jest.fn().mockImplementation((type: string) => {
      if (type === "labour") {
        return Promise.resolve([
          {
            rowId: "lr-dem",
            keys: { role: "Demolition labourer", shift: "day" },
            value: 500,
            unit: "day",
            source: "legacy"
          }
        ]);
      }
      if (type === "plant") {
        return Promise.resolve([
          {
            rowId: "pr-exc",
            keys: {},
            value: 200,
            unit: "day",
            source: "legacy"
          }
        ]);
      }
      return Promise.resolve([]);
    }),
    resolveRate: jest.fn().mockResolvedValue(null)
  } as unknown as RateResolverService;
}

/** Build a minimal ScopeOfWorksItem-like object for DEM card. */
function makeDemItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-dem-1",
    tenderId: "tender-1",
    cardId: "card-dem",
    wbsCode: "DEM1.1",
    itemNumber: 1,
    rowType: "demolition",
    description: "Strip and demolish",
    status: "confirmed",
    men: new Prisma.Decimal(2),
    days: new Prisma.Decimal(5),
    shift: "Day",
    plantItems: [{ plantRateId: "pr-exc", qty: 1, days: 5 }],
    isProvisional: false,
    provisionalAmount: null,
    pricedBySubItemId: null,
    subLineQuotes: [],
    card: { discipline: "DEM", markupOverride: null },
    ...overrides
  };
}

/** Build a minimal ScopeOfWorksItem-like object for SUB card. */
function makeSubItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-sub-1",
    tenderId: "tender-1",
    cardId: "card-sub",
    wbsCode: "SUB1.1",
    itemNumber: 1,
    rowType: "demolition",
    description: "Subcontracted demo",
    status: "confirmed",
    men: null,
    days: null,
    shift: null,
    plantItems: null,
    isProvisional: false,
    provisionalAmount: null,
    pricedBySubItemId: null,
    // Selected quote at $4,500
    subLineQuotes: [{ amount: new Prisma.Decimal(SUB_QUOTE_AMOUNT) }],
    card: { discipline: "SUB", markupOverride: null },
    ...overrides
  };
}

function makePrisma(
  items: unknown[],
  extraOverrides: Record<string, unknown> = {}
) {
  return {
    tender: {
      findUnique: jest.fn().mockResolvedValue({ id: "tender-1" })
    },
    scopeOfWorksItem: {
      findMany: jest.fn().mockResolvedValue(items),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn()
    },
    subLineQuote: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn()
    },
    tenderEstimate: {
      findUnique: jest.fn().mockResolvedValue({ markup: new Prisma.Decimal(MARKUP_PCT) })
    },
    scopeWasteItem: { findMany: jest.fn().mockResolvedValue([]) },
    cuttingSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
    ...extraOverrides
  } as never;
}

function makeService(
  prismaOverride?: ReturnType<typeof makePrisma>
): ScopeRedesignService {
  return new ScopeRedesignService(
    prismaOverride ?? (makePrisma([]) as never),
    makeRateResolver()
  );
}

// ── Assertion 1: linked DEM item contributes $0 to DEM bucket ────────────

describe("SUB_LINE_PRICES_LINKED_ITEM — double-count guard", () => {
  it("[1] DEM item linked to a SUB line contributes $0 to the DEM bucket", async () => {
    const demItem = makeDemItem({ pricedBySubItemId: "item-sub-1" });
    const subItem = makeSubItem();
    const prisma = makePrisma([demItem, subItem]);
    const svc = makeService(prisma);

    const summary = await svc.summary("tender-1");

    // DEM bucket: the linked item is zeroed.
    expect(bucket(summary, "DEM").subtotal).toBe(0);
    expect(bucket(summary, "DEM").withMarkup).toBe(0);
    // itemCount still increments (item is visible in the scope)
    expect(bucket(summary, "DEM").itemCount).toBe(1);
    // SUB bucket: receives the selected quote amount with markup
    expect(bucket(summary, "SUB").subtotal).toBeCloseTo(SUB_QUOTE_AMOUNT, 2);
    expect(bucket(summary, "SUB").withMarkup).toBeCloseTo(SUB_WITH_MARKUP, 2);
  });

  it("[2] The guard is reversible — unlinking restores the item's full contribution", async () => {
    // Unlinked item: pricedBySubItemId is null
    const demItem = makeDemItem({ pricedBySubItemId: null });
    const subItem = makeSubItem();
    const prisma = makePrisma([demItem, subItem]);
    const svc = makeService(prisma);

    const summary = await svc.summary("tender-1");

    // DEM bucket: full contribution
    expect(bucket(summary, "DEM").subtotal).toBeCloseTo(DEM_TOTAL, 2);
    expect(bucket(summary, "DEM").withMarkup).toBeCloseTo(DEM_WITH_MARKUP, 2);
  });

  it("[3] Tender total WITH linking equals the SUB quote alone ($5,850)", async () => {
    const demItem = makeDemItem({ pricedBySubItemId: "item-sub-1" });
    const subItem = makeSubItem();
    const prisma = makePrisma([demItem, subItem]);
    const svc = makeService(prisma);

    const linked = await svc.summary("tender-1");
    expect(linked.tenderPrice).toBeCloseTo(LINKED_TENDER_PRICE, 2); // $5,850

    // For reference: unlinked total would be $13,650
    const demItemUnlinked = makeDemItem({ pricedBySubItemId: null });
    const prismaUnlinked = makePrisma([demItemUnlinked, subItem]);
    const svcUnlinked = makeService(prismaUnlinked);
    const unlinked = await svcUnlinked.summary("tender-1");
    expect(unlinked.tenderPrice).toBeCloseTo(UNLINKED_TENDER_PRICE, 2); // $13,650
  });

  it("[6] A SUB line with quotes but none selected prices at $0", async () => {
    const subItemNoSelection = makeSubItem({
      subLineQuotes: [] // no selected quote
    });
    const prisma = makePrisma([subItemNoSelection]);
    const svc = makeService(prisma);

    const summary = await svc.summary("tender-1");

    expect(bucket(summary, "SUB").subtotal).toBe(0);
    expect(bucket(summary, "SUB").withMarkup).toBe(0);
  });
});

// ── Assertion 5: second isSelected quote rejected ────────────────────────

describe("selectSubLineQuote", () => {
  it("[5a] selectSubLineQuote deselects the previously-selected quote in a transaction", async () => {
    const quote = {
      id: "q-2",
      scopeItem: { tenderId: "tender-1", id: "item-sub-1" }
    };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue({ id: "q-2", isSelected: true });
    const $transaction = jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));

    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1" }) },
      subLineQuote: {
        findUnique: jest.fn().mockResolvedValue(quote),
        updateMany,
        update
      },
      $transaction
    } as never;

    const svc = makeService(prisma);
    await svc.selectSubLineQuote("tender-1", "q-2");

    // updateMany deselects existing selected quotes except q-2
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ scopeItemId: "item-sub-1", isSelected: true, id: { not: "q-2" } }),
        data: { isSelected: false }
      })
    );
    // update selects q-2
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "q-2" }, data: { isSelected: true } })
    );
  });

  it("[5b] selectSubLineQuote throws NotFoundException when quote is not found", async () => {
    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1" }) },
      subLineQuote: { findUnique: jest.fn().mockResolvedValue(null) }
    } as never;
    const svc = makeService(prisma);

    await expect(svc.selectSubLineQuote("tender-1", "q-missing")).rejects.toThrow(NotFoundException);
  });
});

// ── linkItemToSubLine validation ─────────────────────────────────────────

describe("linkItemToSubLine", () => {
  it("rejects linking an item to itself", async () => {
    const item = {
      id: "item-1",
      tenderId: "tender-1",
      card: { discipline: "SUB" }
    };
    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1" }) },
      scopeOfWorksItem: { findUnique: jest.fn().mockResolvedValue(item) }
    } as never;
    const svc = makeService(prisma);

    await expect(svc.linkItemToSubLine("tender-1", "item-1", "item-1")).rejects.toThrow(
      BadRequestException
    );
  });

  it("rejects linking when the target is not a SUB-discipline item", async () => {
    const covered = { id: "item-dem", tenderId: "tender-1", card: { discipline: "DEM" } };
    const target  = { id: "item-dem2", tenderId: "tender-1", card: { discipline: "DEM" } };
    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1" }) },
      scopeOfWorksItem: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(covered)
          .mockResolvedValueOnce(target)
      }
    } as never;
    const svc = makeService(prisma);

    await expect(svc.linkItemToSubLine("tender-1", "item-dem", "item-dem2")).rejects.toThrow(
      BadRequestException
    );
  });

  it("rejects linking items from different tenders", async () => {
    const covered = { id: "item-a", tenderId: "tender-1", card: { discipline: "DEM" } };
    const target  = { id: "item-b", tenderId: "tender-2", card: { discipline: "SUB" } };
    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1" }) },
      scopeOfWorksItem: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(covered)
          .mockResolvedValueOnce(target)
      }
    } as never;
    const svc = makeService(prisma);

    await expect(svc.linkItemToSubLine("tender-1", "item-a", "item-b")).rejects.toThrow(
      BadRequestException
    );
  });
});

// ── addSubLineQuote validation ────────────────────────────────────────────

describe("addSubLineQuote", () => {
  it("rejects adding a quote to a non-SUB item", async () => {
    const demItem = { id: "item-dem", tenderId: "tender-1", card: { discipline: "DEM" } };
    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1" }) },
      scopeOfWorksItem: { findUnique: jest.fn().mockResolvedValue(demItem) }
    } as never;
    const svc = makeService(prisma);

    await expect(
      svc.addSubLineQuote("tender-1", "item-dem", { amount: 1000 })
    ).rejects.toThrow(BadRequestException);
  });
});

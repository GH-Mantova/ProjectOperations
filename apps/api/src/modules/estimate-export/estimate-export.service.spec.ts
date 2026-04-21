import { EstimateExportService, SCOPE_CODE_ORDER } from "./estimate-export.service";

// These tests hit the pure calculation + shaping path of loadPayload by feeding
// a fake Prisma client. We don't spin up a DB — the server-side recomputation
// contract is what matters.

function makeDecimal(v: number) {
  return { toString: () => String(v) } as unknown as { toString(): string };
}

type FakeItem = {
  id: string;
  code: string;
  itemNumber: number;
  title: string;
  description: string | null;
  isProvisional: boolean;
  provisionalAmount: { toString(): string } | null;
  markup: { toString(): string };
  labourLines: Array<{
    role: string;
    qty: { toString(): string };
    days: { toString(): string };
    shift: string;
    rate: { toString(): string };
  }>;
  plantLines: Array<{
    plantItem: string;
    qty: { toString(): string };
    days: { toString(): string };
    rate: { toString(): string };
  }>;
  equipLines: Array<{
    description: string;
    qty: { toString(): string };
    duration: { toString(): string };
    rate: { toString(): string };
  }>;
  wasteLines: Array<{
    wasteType: string;
    facility: string;
    qtyTonnes: { toString(): string };
    tonRate: { toString(): string };
    loads: number;
    loadRate: { toString(): string };
  }>;
  cuttingLines: Array<{ qty: { toString(): string }; rate: { toString(): string } }>;
};

function buildTender(items: FakeItem[], markup = 30) {
  return {
    id: "t-1",
    tenderNumber: "TEN-001",
    title: "Demo Project",
    status: "DRAFT",
    createdAt: new Date("2026-04-21T00:00:00Z"),
    dueDate: null,
    probability: null,
    estimatedValue: null,
    estimator: { firstName: "Raj", lastName: "Pudasaini", email: "raj@example.com" },
    tenderClients: [
      {
        createdAt: new Date(),
        client: { name: "Client Co" },
        contact: { firstName: "Jane", lastName: "Doe", phone: "0400", email: "jd@example.com" }
      }
    ],
    estimate: { markup: makeDecimal(markup), items }
  };
}

function makeService(tender: unknown) {
  const prisma = {
    tender: { findUnique: async () => tender },
    estimateExport: { create: async () => undefined }
  } as unknown as ConstructorParameters<typeof EstimateExportService>[0];
  return new EstimateExportService(prisma);
}

function item(partial: Partial<FakeItem>): FakeItem {
  return {
    id: partial.id ?? "i-1",
    code: partial.code ?? "SO",
    itemNumber: partial.itemNumber ?? 1,
    title: partial.title ?? "Strip-out",
    description: partial.description ?? null,
    isProvisional: partial.isProvisional ?? false,
    provisionalAmount: partial.provisionalAmount ?? null,
    markup: partial.markup ?? makeDecimal(30),
    labourLines: partial.labourLines ?? [],
    plantLines: partial.plantLines ?? [],
    equipLines: partial.equipLines ?? [],
    wasteLines: partial.wasteLines ?? [],
    cuttingLines: partial.cuttingLines ?? []
  };
}

describe("EstimateExportService.loadPayload", () => {
  it("recomputes totals from raw lines — sum matches labour + plant + waste + cutting", async () => {
    const tender = buildTender([
      item({
        code: "SO",
        itemNumber: 1,
        title: "Level 1 strip-out",
        labourLines: [
          { role: "Demo labourer", qty: makeDecimal(2), days: makeDecimal(5), shift: "Day", rate: makeDecimal(600) }
        ],
        plantLines: [
          { plantItem: "Bobcat", qty: makeDecimal(1), days: makeDecimal(3), rate: makeDecimal(800) }
        ],
        wasteLines: [
          {
            wasteType: "General",
            facility: "Tip",
            qtyTonnes: makeDecimal(10),
            tonRate: makeDecimal(150),
            loads: 2,
            loadRate: makeDecimal(400)
          }
        ],
        cuttingLines: []
      })
    ]);
    const svc = makeService(tender);
    const payload = await svc.loadPayload("t-1");
    const i0 = payload.items[0];
    // 2 * 5 * 600 = 6000
    expect(i0.labour).toBeCloseTo(6000, 2);
    // 1 * 3 * 800 = 2400
    expect(i0.plant).toBeCloseTo(2400, 2);
    // 10 * 150 + 2 * 400 = 2300
    expect(i0.waste).toBeCloseTo(2300, 2);
    // subtotal = 6000 + 2400 + 2300 = 10700
    expect(i0.subtotal).toBeCloseTo(10700, 2);
    // markup 30% = 3210
    expect(i0.markup).toBeCloseTo(3210, 2);
    // price = 13910
    expect(i0.price).toBeCloseTo(13910, 2);
    expect(payload.totals.totalExGst).toBeCloseTo(13910, 2);
  });

  it("provisional-sum items use provisionalAmount as subtotal and count toward provisionalTotal only", async () => {
    const tender = buildTender([
      item({
        id: "prov",
        code: "Prv",
        itemNumber: 1,
        title: "GPR scanning",
        isProvisional: true,
        provisionalAmount: makeDecimal(2500),
        markup: makeDecimal(0),
        labourLines: []
      }),
      item({
        id: "real",
        code: "SO",
        itemNumber: 1,
        title: "Strip-out",
        labourLines: [
          { role: "Labourer", qty: makeDecimal(1), days: makeDecimal(1), shift: "Day", rate: makeDecimal(500) }
        ]
      })
    ]);
    const svc = makeService(tender);
    const payload = await svc.loadPayload("t-1");

    // Provisional amount is preserved as the item price (0% markup)
    const prov = payload.items.find((i) => i.itemId === "prov")!;
    expect(prov.subtotal).toBeCloseTo(2500, 2);
    expect(prov.price).toBeCloseTo(2500, 2);

    // totals.subtotal excludes provisional (non-prov rows only)
    expect(payload.totals.subtotal).toBeCloseTo(500, 2);
    expect(payload.totals.provisionalTotal).toBeCloseTo(2500, 2);
    // total ex-GST includes both
    expect(payload.totals.totalExGst).toBeCloseTo(500 + 500 * 0.3 + 2500, 2);
  });

  it("groups items in SO → Str → Asb → Civ → Prv order", async () => {
    const tender = buildTender([
      item({ id: "a", code: "Civ", itemNumber: 1, title: "Civ item" }),
      item({ id: "b", code: "SO", itemNumber: 1, title: "SO item" }),
      item({ id: "c", code: "Asb", itemNumber: 1, title: "Asb item" }),
      item({ id: "d", code: "Str", itemNumber: 1, title: "Str item" }),
      item({ id: "e", code: "Prv", itemNumber: 1, title: "Prov item", isProvisional: true, provisionalAmount: makeDecimal(100) })
    ]);
    const svc = makeService(tender);
    const payload = await svc.loadPayload("t-1");
    const codes = payload.items.map((i) => i.code);
    expect(codes).toEqual(["SO", "Str", "Asb", "Civ", "Prv"]);
    expect(payload.groups.map((g) => g.code)).toEqual([...SCOPE_CODE_ORDER]);
  });

  it("returns the tender number as quote number exactly as stored", async () => {
    const tender = buildTender([item({})]);
    const svc = makeService(tender);
    const payload = await svc.loadPayload("t-1");
    expect(payload.tender.tenderNumber).toBe("TEN-001");
  });

  it("returns totals.totalExGst > 0 so the GST disclaimer will render on the PDF", async () => {
    const tender = buildTender([
      item({
        code: "SO",
        itemNumber: 1,
        labourLines: [
          { role: "Labourer", qty: makeDecimal(1), days: makeDecimal(1), shift: "Day", rate: makeDecimal(100) }
        ]
      })
    ]);
    const svc = makeService(tender);
    const payload = await svc.loadPayload("t-1");
    expect(payload.totals.totalExGst).toBeGreaterThan(0);
  });
});

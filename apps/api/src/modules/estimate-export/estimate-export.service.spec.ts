import {
  DISCIPLINE_ORDER,
  EstimateExportService,
  type ExportPayload
} from "./estimate-export.service";
import type { ScopeRedesignService } from "../tendering/scope-redesign.service";

// These tests hit the pure fetch + shape path of fetchTenderForExport by
// feeding fake Prisma and ScopeRedesignService instances. We don't spin up a
// DB — the contract we care about is: PDF/Excel get a payload that matches
// the Quote tab view, and summary numbers come from ScopeRedesignService.summary.

function makeDecimal(v: number) {
  return { toString: () => String(v) } as unknown as { toString(): string };
}

function baseSummary() {
  return {
    SO: { itemCount: 0, subtotal: 0, withMarkup: 0 },
    Str: { itemCount: 0, subtotal: 0, withMarkup: 0 },
    Asb: { itemCount: 0, subtotal: 0, withMarkup: 0 },
    Civ: { itemCount: 0, subtotal: 0, withMarkup: 0 },
    Prv: { itemCount: 0, subtotal: 0, withMarkup: 0 },
    cutting: { itemCount: 0, subtotal: 0 },
    tenderPrice: 0
  };
}

type FakeTender = {
  id: string;
  tenderNumber: string;
  title: string;
  status: string;
  createdAt: Date;
  dueDate: Date | null;
  estimatedValue: { toString(): string } | null;
  ratesSnapshotAt: Date | null;
  estimator: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    workerProfile: { phone: string | null } | null;
  } | null;
  tenderClients: Array<{
    createdAt: Date;
    client: { id: string; name: string; email: string | null; phone: string | null };
    contact: { firstName: string; lastName: string; email: string | null; phone: string | null } | null;
  }>;
  scopeHeader: {
    siteAddress: string | null;
    siteContactName: string | null;
    siteContactPhone: string | null;
    proposedStartDate: Date | null;
    durationWeeks: number | null;
  } | null;
  scopeItems: Array<Record<string, unknown>>;
  cuttingSheetItems: Array<Record<string, unknown>>;
  tenderDocuments: Array<{ id: string; title: string; fileLink: { name: string } | null }>;
  assumptions: Array<{ text: string; sortOrder: number }>;
  exclusions: Array<{ text: string; sortOrder: number }>;
  tandC: { clauses: unknown } | null;
};

function makeService(tender: FakeTender, summary = baseSummary()) {
  const prisma = {
    tender: { findUnique: async () => tender },
    estimateExport: { create: async () => undefined }
  } as unknown as ConstructorParameters<typeof EstimateExportService>[0];
  const scope = {
    summary: async () => summary
  } as unknown as ScopeRedesignService;
  return new EstimateExportService(prisma, scope);
}

function scopeItem(partial: Partial<{
  id: string;
  wbsCode: string;
  discipline: string;
  rowType: string;
  description: string | null;
  itemNumber: number;
  sortOrder: number;
  status: string;
  provisionalAmount: { toString(): string } | null;
  notes: string | null;
}> = {}) {
  return {
    id: partial.id ?? "s-1",
    wbsCode: partial.wbsCode ?? "SO1",
    discipline: partial.discipline ?? "SO",
    rowType: partial.rowType ?? "demolition",
    description: partial.description ?? "Strip out level 1",
    itemNumber: partial.itemNumber ?? 1,
    sortOrder: partial.sortOrder ?? 0,
    status: partial.status ?? "draft",
    provisionalAmount: partial.provisionalAmount ?? null,
    notes: partial.notes ?? null,
    men: null,
    days: null,
    shift: null,
    measurementQty: null,
    measurementUnit: null,
    material: null,
    wasteType: null,
    wasteFacility: null,
    wasteTonnes: null,
    wasteLoads: null
  };
}

function baseTender(partial: Partial<FakeTender> = {}): FakeTender {
  return {
    id: "t-1",
    tenderNumber: "TEN-001",
    title: "Demo Project",
    status: "DRAFT",
    createdAt: new Date("2026-04-21T00:00:00Z"),
    dueDate: null,
    estimatedValue: null,
    ratesSnapshotAt: null,
    estimator: {
      id: "user-raj",
      firstName: "Raj",
      lastName: "Pudasaini",
      email: "raj@example.com",
      workerProfile: null
    },
    tenderClients: [
      {
        createdAt: new Date(),
        client: { id: "c-1", name: "Client Co", email: null, phone: null },
        contact: { firstName: "Jane", lastName: "Doe", email: "jd@example.com", phone: "0400" }
      }
    ],
    scopeHeader: null,
    scopeItems: [],
    cuttingSheetItems: [],
    tenderDocuments: [],
    assumptions: [],
    exclusions: [],
    tandC: null,
    ...partial
  };
}

describe("EstimateExportService.fetchTenderForExport", () => {
  it("returns tender + client + estimator shaped for the PDF builder", async () => {
    const tender = baseTender();
    const svc = makeService(tender);
    const payload = await svc.fetchTenderForExport("t-1");
    expect(payload.tender.tenderNumber).toBe("TEN-001");
    expect(payload.tender.clients[0].name).toBe("Client Co");
    expect(payload.tender.clients[0].contactName).toBe("Jane Doe");
    expect(payload.tender.clients[0].contactEmail).toBe("jd@example.com");
    expect(payload.tender.estimator?.firstName).toBe("Raj");
  });

  it("sorts scope items SO → Str → Asb → Civ → Prv by discipline", async () => {
    const tender = baseTender({
      scopeItems: [
        scopeItem({ id: "a", discipline: "Civ", wbsCode: "Civ1" }),
        scopeItem({ id: "b", discipline: "SO", wbsCode: "SO1" }),
        scopeItem({ id: "c", discipline: "Asb", wbsCode: "Asb1" }),
        scopeItem({ id: "d", discipline: "Str", wbsCode: "Str1" }),
        scopeItem({
          id: "e",
          discipline: "Prv",
          wbsCode: "Prv1",
          provisionalAmount: makeDecimal(2500)
        })
      ]
    });
    const svc = makeService(tender);
    const payload = await svc.fetchTenderForExport("t-1");
    const disciplines = payload.scopeItems.map((i) => i.discipline);
    expect(disciplines).toEqual(["SO", "Str", "Asb", "Civ", "Prv"]);
  });

  it("buckets cutting items into sawCuts / coreHoles / otherRates and flags POA for >650mm core holes", async () => {
    const tender = baseTender({
      cuttingSheetItems: [
        {
          itemType: "saw-cut",
          wbsRef: "SO1",
          description: "Slab cut",
          equipment: "Roadsaw",
          elevation: "Floor",
          material: "Concrete",
          depthMm: 100,
          diameterMm: null,
          quantityLm: makeDecimal(10),
          quantityEach: null,
          ratePerM: makeDecimal(12.5),
          ratePerHole: null,
          lineTotal: makeDecimal(125),
          shift: "Day",
          shiftLoading: null,
          method: null,
          notes: null,
          sortOrder: 0,
          otherRate: null
        },
        {
          itemType: "core-hole",
          wbsRef: "SO1",
          description: null,
          equipment: null,
          elevation: "Floor",
          material: null,
          depthMm: 200,
          diameterMm: 700,
          quantityLm: null,
          quantityEach: 1,
          ratePerM: null,
          ratePerHole: null,
          lineTotal: makeDecimal(0),
          shift: "Day",
          shiftLoading: null,
          method: null,
          notes: null,
          sortOrder: 0,
          otherRate: null
        },
        {
          itemType: "other-rate",
          wbsRef: "SO1",
          description: null,
          equipment: null,
          elevation: null,
          material: null,
          depthMm: null,
          diameterMm: null,
          quantityLm: null,
          quantityEach: 2,
          ratePerM: null,
          ratePerHole: null,
          lineTotal: makeDecimal(240),
          shift: null,
          shiftLoading: null,
          method: null,
          notes: null,
          sortOrder: 0,
          otherRate: { description: "Establishment fee", unit: "each", rate: makeDecimal(120) }
        }
      ]
    });
    const svc = makeService(tender);
    const payload = await svc.fetchTenderForExport("t-1");
    expect(payload.cuttingItems.sawCuts).toHaveLength(1);
    expect(payload.cuttingItems.coreHoles).toHaveLength(1);
    expect(payload.cuttingItems.coreHoles[0].isPOA).toBe(true);
    expect(payload.cuttingItems.otherRates).toHaveLength(1);
    expect(payload.cuttingItems.otherRates[0].otherRate?.description).toBe("Establishment fee");
  });

  it("uses TenderTandC.clauses when present and falls back to parsed defaults otherwise", async () => {
    const custom = [{ number: "1", heading: "CUSTOM", body: "Custom body." }];
    const svcWithCustom = makeService(baseTender({ tandC: { clauses: custom } }));
    const payloadA = await svcWithCustom.fetchTenderForExport("t-1");
    expect(payloadA.tandc.clauses).toEqual(custom);

    const svcDefault = makeService(baseTender());
    const payloadB = await svcDefault.fetchTenderForExport("t-1");
    expect(payloadB.tandc.clauses.length).toBeGreaterThan(5);
    expect(payloadB.tandc.clauses[0].number).toBe("1");
  });

  it("reuses ScopeRedesignService.summary for the cost summary (no local recalculation)", async () => {
    const summary = {
      ...baseSummary(),
      SO: { itemCount: 2, subtotal: 10000, withMarkup: 13000 },
      Str: { itemCount: 1, subtotal: 5000, withMarkup: 6500 },
      cutting: { itemCount: 3, subtotal: 2400 },
      tenderPrice: 21900
    };
    const svc = makeService(baseTender(), summary);
    const payload = await svc.fetchTenderForExport("t-1");
    expect(payload.summary.SO.withMarkup).toBe(13000);
    expect(payload.summary.Str.withMarkup).toBe(6500);
    expect(payload.summary.cutting.subtotal).toBe(2400);
    expect(payload.summary.tenderPrice).toBe(21900);
  });

  it("exposes DISCIPLINE_ORDER in the canonical SO-Str-Asb-Civ-Prv sequence", () => {
    expect([...DISCIPLINE_ORDER]).toEqual(["SO", "Str", "Asb", "Civ", "Prv"]);
  });

  it("pipes the payload through buildQuotePdf without throwing (integration smoke)", async () => {
    const tender = baseTender({
      scopeItems: [scopeItem({ discipline: "SO", wbsCode: "SO1", description: "Strip out" })]
    });
    const summary = {
      ...baseSummary(),
      SO: { itemCount: 1, subtotal: 1000, withMarkup: 1300 },
      tenderPrice: 1300
    };
    const svc = makeService(tender, summary);
    const { buffer } = await svc.exportPdf("t-1", "u-1");
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    // PDF magic header
    expect(buffer.slice(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("pipes the payload through buildEstimateExcel without throwing (integration smoke)", async () => {
    const tender = baseTender({
      scopeItems: [scopeItem({ discipline: "SO", wbsCode: "SO1", description: "Strip out" })]
    });
    const summary = {
      ...baseSummary(),
      SO: { itemCount: 1, subtotal: 1000, withMarkup: 1300 },
      tenderPrice: 1300
    };
    const svc = makeService(tender, summary);
    const { buffer, filename } = await svc.exportExcel("t-1", "u-1");
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(filename).toMatch(/IS_Estimate_.*\.xlsx$/);
  });

  it("exposes ratesSnapshotAt on the payload (null until first SUBMITTED transition)", async () => {
    const snapshot = new Date("2026-04-23T10:00:00Z");
    const svc = makeService(baseTender({ ratesSnapshotAt: snapshot }));
    const payload: ExportPayload = await svc.fetchTenderForExport("t-1");
    expect(payload.tender.ratesSnapshotAt).toEqual(snapshot);
  });
});

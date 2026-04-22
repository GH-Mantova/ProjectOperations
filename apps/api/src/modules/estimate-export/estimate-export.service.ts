import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { parseDefaultClauses, type TcClause } from "../quote/tc-parser";
import { ScopeRedesignService } from "../tendering/scope-redesign.service";
import { buildEstimateExcel } from "./excel/estimate-excel.builder";
import { buildQuotePdf } from "./pdf/quote-pdf.builder";

// Discipline display order must match the Quote tab and the cost-summary bar.
export const DISCIPLINE_ORDER = ["SO", "Str", "Asb", "Civ", "Prv"] as const;
export type Discipline = (typeof DISCIPLINE_ORDER)[number];

export const DISCIPLINE_LABEL: Record<string, string> = {
  SO: "Strip-outs",
  Str: "Structural Demolition",
  Asb: "Asbestos Removal",
  Civ: "Civil Works",
  Prv: "Provisional Sums"
};

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number((v as { toString(): string }).toString());
  return Number.isFinite(n) ? n : 0;
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return (v as { toString(): string }).toString();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// A ScopeOfWorksItem projected into the PDF's row shape. Decimals are kept
// as strings so the builder can format them consistently with the Quote tab.
export type ScopeRow = {
  id: string;
  wbsCode: string;
  discipline: string;
  rowType: string;
  description: string;
  men: string | null;
  days: string | null;
  shift: string | null;
  measurementQty: string | null;
  measurementUnit: string | null;
  material: string | null;
  wasteType: string | null;
  wasteFacility: string | null;
  wasteTonnes: string | null;
  wasteLoads: number | null;
  provisionalAmount: string | null;
  notes: string | null;
  sortOrder: number;
};

export type SawCutRow = {
  wbsRef: string;
  description: string | null;
  equipment: string | null;
  elevation: string | null;
  material: string | null;
  depthMm: number | null;
  quantityLm: string | null;
  ratePerM: string | null;
  lineTotal: string | null;
  shift: string | null;
  shiftLoading: string | null;
  method: string | null;
  notes: string | null;
};

export type CoreHoleRow = {
  wbsRef: string;
  description: string | null;
  diameterMm: number | null;
  depthMm: number | null;
  quantityEach: number | null;
  ratePerHole: string | null;
  lineTotal: string | null;
  shift: string | null;
  shiftLoading: string | null;
  method: string | null;
  notes: string | null;
  isPOA: boolean;
};

export type OtherRateRow = {
  wbsRef: string;
  description: string | null;
  quantityEach: number | null;
  lineTotal: string | null;
  notes: string | null;
  otherRate: { description: string; unit: string; rate: string } | null;
};

export type ExportPayload = {
  tender: {
    id: string;
    tenderNumber: string;
    title: string;
    status: string;
    value: string | null;
    dueDate: Date | null;
    createdAt: Date;
    ratesSnapshotAt: Date | null;
    estimator: {
      firstName: string;
      lastName: string;
      email: string;
    } | null;
    clients: Array<{
      id: string;
      name: string;
      contactName: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
    }>;
    scopeHeader: {
      siteAddress: string | null;
      siteContactName: string | null;
      siteContactPhone: string | null;
      proposedStartDate: Date | null;
      durationWeeks: number | null;
    } | null;
  };
  scopeItems: ScopeRow[];
  cuttingItems: {
    sawCuts: SawCutRow[];
    coreHoles: CoreHoleRow[];
    otherRates: OtherRateRow[];
  };
  assumptions: Array<{ text: string }>;
  exclusions: Array<{ text: string }>;
  tandc: { clauses: TcClause[] };
  summary: {
    SO: { itemCount: number; subtotal: number; withMarkup: number };
    Str: { itemCount: number; subtotal: number; withMarkup: number };
    Asb: { itemCount: number; subtotal: number; withMarkup: number };
    Civ: { itemCount: number; subtotal: number; withMarkup: number };
    Prv: { itemCount: number; subtotal: number; withMarkup: number };
    cutting: { itemCount: number; subtotal: number };
    tenderPrice: number;
  };
};

function isClauseArray(value: unknown): value is TcClause[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (c) =>
      c !== null &&
      typeof c === "object" &&
      typeof (c as TcClause).number === "string" &&
      typeof (c as TcClause).heading === "string" &&
      typeof (c as TcClause).body === "string"
  );
}

@Injectable()
export class EstimateExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeSummary: ScopeRedesignService
  ) {}

  async fetchTenderForExport(tenderId: string): Promise<ExportPayload> {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      include: {
        estimator: { select: { firstName: true, lastName: true, email: true } },
        tenderClients: {
          orderBy: { createdAt: "asc" },
          include: {
            client: { select: { id: true, name: true, email: true, phone: true } },
            contact: { select: { firstName: true, lastName: true, email: true, phone: true } }
          }
        },
        scopeHeader: true,
        scopeItems: {
          where: { status: { not: "excluded" } },
          orderBy: [{ sortOrder: "asc" }, { itemNumber: "asc" }]
        },
        cuttingSheetItems: {
          orderBy: [{ wbsRef: "asc" }, { sortOrder: "asc" }],
          include: { otherRate: true }
        },
        assumptions: { orderBy: { sortOrder: "asc" } },
        exclusions: { orderBy: { sortOrder: "asc" } },
        tandC: true
      }
    });
    if (!tender) throw new NotFoundException("Tender not found.");

    // Reuse the same summary endpoint the Quote tab uses — this keeps the
    // PDF in lock-step with what the user sees on screen and prevents
    // double-implementation of discipline markup / provisional handling.
    const summary = await this.scopeSummary.summary(tenderId);

    // T&C: use the per-tender editable copy; fall back to the canonical
    // tc-text.const defaults if the row hasn't been created yet. The Quote
    // tab creates the row lazily on first read, but the PDF may be the first
    // surface that needs clauses.
    let clauses: TcClause[];
    if (tender.tandC && isClauseArray(tender.tandC.clauses)) {
      clauses = tender.tandC.clauses;
    } else {
      clauses = parseDefaultClauses();
    }

    const clients = tender.tenderClients.map((tc) => {
      const contact = tc.contact;
      const contactName = contact ? `${contact.firstName} ${contact.lastName}`.trim() : null;
      return {
        id: tc.client.id,
        name: tc.client.name,
        contactName: contactName || null,
        contactEmail: contact?.email ?? tc.client.email ?? null,
        contactPhone: contact?.phone ?? tc.client.phone ?? null
      };
    });

    const disciplineIndex: Record<string, number> = Object.fromEntries(
      DISCIPLINE_ORDER.map((d, i) => [d, i])
    );
    const scopeItems: ScopeRow[] = tender.scopeItems
      .slice()
      .sort((a, b) => {
        const ai = disciplineIndex[a.discipline] ?? 99;
        const bi = disciplineIndex[b.discipline] ?? 99;
        if (ai !== bi) return ai - bi;
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.itemNumber - b.itemNumber;
      })
      .map((i) => ({
        id: i.id,
        wbsCode: i.wbsCode,
        discipline: i.discipline,
        rowType: i.rowType,
        description: i.description ?? "",
        men: toStr(i.men),
        days: toStr(i.days),
        shift: i.shift,
        measurementQty: toStr(i.measurementQty),
        measurementUnit: i.measurementUnit,
        material: i.material,
        wasteType: i.wasteType,
        wasteFacility: i.wasteFacility,
        wasteTonnes: toStr(i.wasteTonnes),
        wasteLoads: i.wasteLoads,
        provisionalAmount: toStr(i.provisionalAmount),
        notes: i.notes,
        sortOrder: i.sortOrder
      }));

    const sawCuts: SawCutRow[] = tender.cuttingSheetItems
      .filter((c) => c.itemType === "saw-cut")
      .map((c) => ({
        wbsRef: c.wbsRef,
        description: c.description,
        equipment: c.equipment,
        elevation: c.elevation,
        material: c.material,
        depthMm: c.depthMm,
        quantityLm: toStr(c.quantityLm),
        ratePerM: toStr(c.ratePerM),
        lineTotal: toStr(c.lineTotal),
        shift: c.shift,
        shiftLoading: toStr(c.shiftLoading),
        method: c.method,
        notes: c.notes
      }));

    const coreHoles: CoreHoleRow[] = tender.cuttingSheetItems
      .filter((c) => c.itemType === "core-hole")
      .map((c) => ({
        wbsRef: c.wbsRef,
        description: c.description,
        diameterMm: c.diameterMm,
        depthMm: c.depthMm,
        quantityEach: c.quantityEach,
        ratePerHole: toStr(c.ratePerHole),
        lineTotal: toStr(c.lineTotal),
        shift: c.shift,
        shiftLoading: toStr(c.shiftLoading),
        method: c.method,
        notes: c.notes,
        isPOA: (c.diameterMm ?? 0) > 650
      }));

    const otherRates: OtherRateRow[] = tender.cuttingSheetItems
      .filter((c) => c.itemType === "other-rate")
      .map((c) => ({
        wbsRef: c.wbsRef,
        description: c.description,
        quantityEach: c.quantityEach,
        lineTotal: toStr(c.lineTotal),
        notes: c.notes,
        otherRate: c.otherRate
          ? {
              description: c.otherRate.description,
              unit: c.otherRate.unit,
              rate: c.otherRate.rate.toString()
            }
          : null
      }));

    // ScopeRedesignService.summary() spreads per-discipline keys into the
    // result, but TypeScript loses that relationship through the spread.
    // Cast to the shape we know is returned so the builders get a stable
    // contract.
    const summaryTyped = summary as unknown as {
      SO: { itemCount: number; subtotal: number; withMarkup: number };
      Str: { itemCount: number; subtotal: number; withMarkup: number };
      Asb: { itemCount: number; subtotal: number; withMarkup: number };
      Civ: { itemCount: number; subtotal: number; withMarkup: number };
      Prv: { itemCount: number; subtotal: number; withMarkup: number };
      cutting: { itemCount: number; subtotal: number };
      tenderPrice: number;
    };
    const discBucket = (code: Discipline) => ({
      itemCount: summaryTyped[code].itemCount,
      subtotal: round2(summaryTyped[code].subtotal),
      withMarkup: round2(summaryTyped[code].withMarkup)
    });

    return {
      tender: {
        id: tender.id,
        tenderNumber: tender.tenderNumber,
        title: tender.title,
        status: tender.status,
        value: tender.estimatedValue ? tender.estimatedValue.toString() : null,
        dueDate: tender.dueDate,
        createdAt: tender.createdAt,
        ratesSnapshotAt: tender.ratesSnapshotAt,
        estimator: tender.estimator
          ? {
              firstName: tender.estimator.firstName,
              lastName: tender.estimator.lastName,
              email: tender.estimator.email
            }
          : null,
        clients,
        scopeHeader: tender.scopeHeader
          ? {
              siteAddress: tender.scopeHeader.siteAddress,
              siteContactName: tender.scopeHeader.siteContactName,
              siteContactPhone: tender.scopeHeader.siteContactPhone,
              proposedStartDate: tender.scopeHeader.proposedStartDate,
              durationWeeks: tender.scopeHeader.durationWeeks
            }
          : null
      },
      scopeItems,
      cuttingItems: { sawCuts, coreHoles, otherRates },
      assumptions: tender.assumptions.map((a) => ({ text: a.text })),
      exclusions: tender.exclusions.map((e) => ({ text: e.text })),
      tandc: { clauses },
      summary: {
        SO: discBucket("SO"),
        Str: discBucket("Str"),
        Asb: discBucket("Asb"),
        Civ: discBucket("Civ"),
        Prv: discBucket("Prv"),
        cutting: { itemCount: summaryTyped.cutting.itemCount, subtotal: round2(summaryTyped.cutting.subtotal) },
        tenderPrice: round2(summaryTyped.tenderPrice)
      }
    };
  }

  async exportPdf(tenderId: string, userId: string): Promise<{ buffer: Buffer; filename: string }> {
    const payload = await this.fetchTenderForExport(tenderId);
    const buffer = await buildQuotePdf(payload);
    await this.prisma.estimateExport.create({
      data: { tenderId, type: "pdf", generatedBy: userId }
    });
    return {
      buffer,
      filename: `IS_Quote_${payload.tender.tenderNumber.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`
    };
  }

  async exportExcel(tenderId: string, userId: string): Promise<{ buffer: Buffer; filename: string }> {
    const payload = await this.fetchTenderForExport(tenderId);
    const buffer = await buildEstimateExcel(payload);
    await this.prisma.estimateExport.create({
      data: { tenderId, type: "excel", generatedBy: userId }
    });
    return {
      buffer,
      filename: `IS_Estimate_${payload.tender.tenderNumber.replace(/[^A-Za-z0-9_-]/g, "_")}.xlsx`
    };
  }
}

export const __test__ = { round2, toNum, DISCIPLINE_LABEL };

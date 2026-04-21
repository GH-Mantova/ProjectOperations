import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { buildQuotePdf } from "./pdf/quote-pdf.builder";
import { buildEstimateExcel } from "./excel/estimate-excel.builder";

export const SCOPE_CODE_ORDER = ["SO", "Str", "Asb", "Civ", "Prv"] as const;
export type ScopeCode = (typeof SCOPE_CODE_ORDER)[number];

export type ExportLine = {
  itemId: string;
  code: string;
  itemNumber: number;
  title: string;
  description: string | null;
  isProvisional: boolean;
  markupPct: number;
  labour: number;
  equip: number;
  plant: number;
  waste: number;
  cutting: number;
  subtotal: number;
  markup: number;
  price: number;
  // Raw line detail for Excel sheets 2 + 3.
  labourLines: Array<{ role: string; qty: number; days: number; shift: string; rate: number; total: number }>;
  plantLines: Array<{ description: string; qty: number; days: number; rate: number; total: number }>;
  wasteLines: Array<{ description: string; qty: number; rate: number; total: number; loads: number; loadRate: number }>;
};

export type ExportPayload = {
  tender: {
    id: string;
    tenderNumber: string;
    title: string;
    status: string;
    createdAt: Date;
    dueDate: Date | null;
    probability: number | null;
    estimatedValue: string | null;
  };
  client: {
    company: string | null;
    contact: string | null;
    phone: string | null;
    email: string | null;
  };
  estimator: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  markupPct: number;
  items: ExportLine[];
  groups: Array<{ code: string; label: string; itemCount: number; subtotal: number; total: number }>;
  totals: {
    labour: number;
    equip: number;
    plant: number;
    waste: number;
    cutting: number;
    subtotal: number;
    markup: number;
    provisionalTotal: number;
    totalExGst: number;
  };
};

const SCOPE_LABELS: Record<string, string> = {
  SO: "Strip-outs",
  Str: "Structural Demolition",
  Asb: "Asbestos Removal",
  Civ: "Civil Works",
  Prv: "Provisional Sums"
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class EstimateExportService {
  constructor(private readonly prisma: PrismaService) {}

  async loadPayload(tenderId: string): Promise<ExportPayload> {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      include: {
        estimator: { select: { firstName: true, lastName: true, email: true } },
        tenderClients: {
          orderBy: { createdAt: "asc" },
          include: {
            client: { select: { name: true } },
            contact: { select: { firstName: true, lastName: true, phone: true, email: true } }
          }
        },
        estimate: {
          include: {
            items: {
              orderBy: [{ code: "asc" }, { itemNumber: "asc" }],
              include: {
                labourLines: true,
                plantLines: true,
                equipLines: true,
                wasteLines: true,
                cuttingLines: true
              }
            }
          }
        }
      }
    });
    if (!tender) throw new NotFoundException("Tender not found.");

    const primaryClient = tender.tenderClients[0] ?? null;
    const clientContact = primaryClient?.contact ?? null;

    // Recompute every total from raw lines — never trust stored totals.
    const itemPayloads: ExportLine[] = [];
    for (const item of tender.estimate?.items ?? []) {
      const labourLines = item.labourLines.map((l) => {
        const total = round2(toNum(l.qty) * toNum(l.days) * toNum(l.rate));
        return {
          role: l.role,
          qty: toNum(l.qty),
          days: toNum(l.days),
          shift: l.shift,
          rate: toNum(l.rate),
          total
        };
      });
      const equipLines = item.equipLines.map((l) => ({
        description: l.description,
        qty: toNum(l.qty),
        days: toNum(l.duration),
        rate: toNum(l.rate),
        total: round2(toNum(l.qty) * toNum(l.duration) * toNum(l.rate))
      }));
      const plantLines = item.plantLines.map((l) => ({
        description: l.plantItem,
        qty: toNum(l.qty),
        days: toNum(l.days),
        rate: toNum(l.rate),
        total: round2(toNum(l.qty) * toNum(l.days) * toNum(l.rate))
      }));
      const wasteLines = item.wasteLines.map((l) => ({
        description: `${l.wasteType} @ ${l.facility}`,
        qty: toNum(l.qtyTonnes),
        rate: toNum(l.tonRate),
        loads: l.loads,
        loadRate: toNum(l.loadRate),
        total: round2(toNum(l.qtyTonnes) * toNum(l.tonRate) + l.loads * toNum(l.loadRate))
      }));
      const cuttingLines = item.cuttingLines.map((l) => ({
        total: round2(toNum(l.qty) * toNum(l.rate))
      }));

      const labour = round2(labourLines.reduce((sum, l) => sum + l.total, 0));
      const equip = round2(equipLines.reduce((sum, l) => sum + l.total, 0));
      const plant = round2(plantLines.reduce((sum, l) => sum + l.total, 0));
      const waste = round2(wasteLines.reduce((sum, l) => sum + l.total, 0));
      const cutting = round2(cuttingLines.reduce((sum, l) => sum + l.total, 0));

      // Provisional sum items are passed through at cost — provisionalAmount IS
      // the client-facing price, with no markup applied (IS QS practice).
      const storedMarkupPct = toNum(item.markup);
      let subtotal: number;
      let markupPct: number;
      let markup: number;
      let price: number;
      if (item.isProvisional) {
        const amount = round2(toNum(item.provisionalAmount));
        subtotal = amount;
        markupPct = 0;
        markup = 0;
        price = amount;
      } else {
        subtotal = round2(labour + equip + plant + waste + cutting);
        markupPct = storedMarkupPct;
        markup = round2(subtotal * (markupPct / 100));
        price = round2(subtotal + markup);
      }

      itemPayloads.push({
        itemId: item.id,
        code: item.code,
        itemNumber: item.itemNumber,
        title: item.title,
        description: item.description,
        isProvisional: item.isProvisional,
        markupPct,
        labour,
        equip,
        plant,
        waste,
        cutting,
        subtotal,
        markup,
        price,
        labourLines,
        plantLines,
        wasteLines: wasteLines.map((l) => ({
          description: l.description,
          qty: l.qty,
          rate: l.rate,
          total: l.total,
          loads: l.loads,
          loadRate: l.loadRate
        }))
      });
    }

    // Sort items globally by discipline order then itemNumber.
    itemPayloads.sort((a, b) => {
      const ai = SCOPE_CODE_ORDER.indexOf(a.code as ScopeCode);
      const bi = SCOPE_CODE_ORDER.indexOf(b.code as ScopeCode);
      const aIdx = ai === -1 ? 99 : ai;
      const bIdx = bi === -1 ? 99 : bi;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return a.itemNumber - b.itemNumber;
    });

    // Per-group summary.
    const groups: ExportPayload["groups"] = [];
    for (const code of SCOPE_CODE_ORDER) {
      const rows = itemPayloads.filter((i) => i.code === code);
      if (rows.length === 0) continue;
      const subtotal = round2(rows.reduce((sum, r) => sum + r.subtotal, 0));
      const total = round2(rows.reduce((sum, r) => sum + r.price, 0));
      groups.push({ code, label: SCOPE_LABELS[code] ?? code, itemCount: rows.length, subtotal, total });
    }

    const nonProvisional = itemPayloads.filter((i) => !i.isProvisional);
    const provisional = itemPayloads.filter((i) => i.isProvisional);
    const totals = {
      labour: round2(nonProvisional.reduce((sum, i) => sum + i.labour, 0)),
      equip: round2(nonProvisional.reduce((sum, i) => sum + i.equip, 0)),
      plant: round2(nonProvisional.reduce((sum, i) => sum + i.plant, 0)),
      waste: round2(nonProvisional.reduce((sum, i) => sum + i.waste, 0)),
      cutting: round2(nonProvisional.reduce((sum, i) => sum + i.cutting, 0)),
      subtotal: round2(nonProvisional.reduce((sum, i) => sum + i.subtotal, 0)),
      markup: round2(itemPayloads.reduce((sum, i) => sum + i.markup, 0)),
      provisionalTotal: round2(provisional.reduce((sum, i) => sum + i.price, 0)),
      totalExGst: round2(itemPayloads.reduce((sum, i) => sum + i.price, 0))
    };

    return {
      tender: {
        id: tender.id,
        tenderNumber: tender.tenderNumber,
        title: tender.title,
        status: tender.status,
        createdAt: tender.createdAt,
        dueDate: tender.dueDate,
        probability: tender.probability,
        estimatedValue: tender.estimatedValue ? tender.estimatedValue.toString() : null
      },
      client: {
        company: primaryClient?.client.name ?? null,
        contact: clientContact ? `${clientContact.firstName} ${clientContact.lastName}`.trim() : null,
        phone: clientContact?.phone ?? null,
        email: clientContact?.email ?? null
      },
      estimator: tender.estimator
        ? {
            firstName: tender.estimator.firstName,
            lastName: tender.estimator.lastName,
            email: tender.estimator.email
          }
        : null,
      markupPct: toNum(tender.estimate?.markup ?? 30),
      items: itemPayloads,
      groups,
      totals
    };
  }

  async exportPdf(tenderId: string, userId: string): Promise<{ buffer: Buffer; filename: string }> {
    const payload = await this.loadPayload(tenderId);
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
    const payload = await this.loadPayload(tenderId);
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

export const __test__ = { round2, toNum, SCOPE_LABELS };

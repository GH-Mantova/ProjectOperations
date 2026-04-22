import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  EstimateExportService,
  type ExportPayload
} from "../estimate-export/estimate-export.service";
import {
  buildQuotePdf,
  type QuoteOverlay
} from "../estimate-export/pdf/quote-pdf.builder";
import { ClientQuotesService } from "./client-quotes.service";

function toNum(v: { toString(): string } | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class QuotePdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: ClientQuotesService,
    private readonly exportSvc: EstimateExportService
  ) {}

  async generate(
    tenderId: string,
    quoteId: string,
    userId: string
  ): Promise<{ buffer: Buffer; filename: string }> {
    // Base payload (tender meta, scope, cutting, T&C, etc.) reuses the same
    // fetch the EstimateExportService does — this keeps site details, scope
    // grouping, and T&C clauses identical to the tender-level PDF.
    const base: ExportPayload = await this.exportSvc.fetchTenderForExport(tenderId);

    const quote = await this.prisma.clientQuote.findUnique({
      where: { id: quoteId },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        costLines: { orderBy: { sortOrder: "asc" } },
        provisionalLines: { orderBy: { sortOrder: "asc" } },
        costOptions: { orderBy: { sortOrder: "asc" } },
        assumptions: { orderBy: [{ sortOrder: "asc" }] },
        exclusions: { orderBy: { sortOrder: "asc" } }
      }
    });
    if (!quote || quote.tenderId !== tenderId) throw new NotFoundException("Quote not found.");

    // Pull the client + contact for the cover page so per-quote PDFs address
    // the right client, not the first one linked to the tender.
    const tenderClientRecord = await this.prisma.tenderClient.findFirst({
      where: { tenderId, clientId: quote.clientId },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        contact: { select: { firstName: true, lastName: true, email: true, phone: true } }
      }
    });

    const summary = await this.quotes.summary(tenderId, quoteId);

    const overlay: QuoteOverlay = {
      quoteRef: quote.quoteRef,
      revision: quote.revision,
      assumptionMode: (quote.assumptionMode === "linked" ? "linked" : "free") as "linked" | "free",
      showProvisional: quote.showProvisional,
      showCostOptions: quote.showCostOptions,
      clientFacingTotal: summary.clientFacingTotal,
      costLines: quote.costLines.map((l) => ({
        id: l.id,
        label: l.label,
        description: l.description,
        price: toNum(l.price),
        sortOrder: l.sortOrder
      })),
      provisionalLines: quote.provisionalLines.map((l) => ({
        description: l.description,
        price: toNum(l.price),
        notes: l.notes
      })),
      costOptions: quote.costOptions.map((l) => ({
        label: l.label,
        description: l.description,
        price: toNum(l.price),
        notes: l.notes
      })),
      assumptions: quote.assumptions.map((a) => ({
        text: a.text,
        costLineId: a.costLineId
      })),
      exclusions: quote.exclusions.map((e) => ({ text: e.text }))
    };

    // If this quote is for a specific client, replace the client block on
    // the cover page with that client (the base payload uses the first
    // tenderClient, which may be different).
    if (tenderClientRecord) {
      const contact = tenderClientRecord.contact;
      base.tender.clients = [
        {
          id: tenderClientRecord.client.id,
          name: tenderClientRecord.client.name,
          contactName: contact ? `${contact.firstName} ${contact.lastName}`.trim() : null,
          contactEmail: contact?.email ?? tenderClientRecord.client.email ?? null,
          contactPhone: contact?.phone ?? tenderClientRecord.client.phone ?? null
        }
      ];
    }

    const buffer = await buildQuotePdf(base, overlay);

    const filename = `IS_Quote_${quote.quoteRef.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`;
    await this.prisma.estimateExport.create({
      data: { tenderId, type: "pdf", generatedBy: userId }
    });
    return { buffer, filename };
  }
}
